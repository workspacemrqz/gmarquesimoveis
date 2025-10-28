import type { Request, Response, NextFunction } from "express";

// Interfaces para rastreamento
interface RequestRecord {
  timestamp: number;
  messageHash?: string;
}

interface UserRateData {
  chatRequests: RequestRecord[];
  executeRequests: RequestRecord[];
  lastRequestTime: number;
  violations: number;
  blockedUntil: number | null;
  recentMessages: Array<{ hash: string; timestamp: number }>;
}

// Maps para rastreamento em memória
const userRateLimits = new Map<string, UserRateData>();
const requestQueue = new Map<string, Promise<void>>();

// Configurações
const CHAT_LIMIT = 10; // requisições por minuto
const CHAT_WINDOW = 60 * 1000; // 1 minuto em ms
const EXECUTE_LIMIT = 20; // requisições por hora
const EXECUTE_WINDOW = 60 * 60 * 1000; // 1 hora em ms
const MIN_REQUEST_DELAY = 500; // 500ms entre requisições
const SPAM_DUPLICATE_WINDOW = 5000; // 5 segundos para detectar duplicatas
const MAX_SEQUENTIAL_DUPLICATES = 3; // máximo de mensagens idênticas em sequência
const MIN_MESSAGE_LENGTH = 3;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_VIOLATIONS = 3; // bloqueio após 3 violações
const BLOCK_DURATION = 10 * 60 * 1000; // 10 minutos em ms
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos em ms

// Função para gerar hash simples de mensagem
function hashMessage(message: string): string {
  // Remove espaços extras e normaliza para detectar duplicatas
  const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
  // Hash simples baseado em código de caracteres
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para 32bit integer
  }
  return hash.toString(36);
}

// Função para obter ou criar dados do usuário
function getUserData(userId: string): UserRateData {
  if (!userRateLimits.has(userId)) {
    userRateLimits.set(userId, {
      chatRequests: [],
      executeRequests: [],
      lastRequestTime: 0,
      violations: 0,
      blockedUntil: null,
      recentMessages: [],
    });
  }
  return userRateLimits.get(userId)!;
}

// Limpeza automática de dados antigos
function cleanupOldData() {
  const now = Date.now();
  
  for (const [userId, data] of Array.from(userRateLimits.entries())) {
    // Limpar requisições antigas de chat (> 1 minuto)
    data.chatRequests = data.chatRequests.filter(
      (req: RequestRecord) => now - req.timestamp < CHAT_WINDOW
    );
    
    // Limpar requisições antigas de execução (> 1 hora)
    data.executeRequests = data.executeRequests.filter(
      (req: RequestRecord) => now - req.timestamp < EXECUTE_WINDOW
    );
    
    // Limpar mensagens antigas (> 1 minuto)
    data.recentMessages = data.recentMessages.filter(
      (msg: { hash: string; timestamp: number }) => now - msg.timestamp < 60000
    );
    
    // Limpar bloqueio expirado
    if (data.blockedUntil && now > data.blockedUntil) {
      data.blockedUntil = null;
      data.violations = 0;
      console.log(`[RateLimiter] Bloqueio removido para usuário: ${userId}`);
    }
    
    // Remover usuário se não houver dados recentes
    const hasRecentActivity = 
      data.chatRequests.length > 0 ||
      data.executeRequests.length > 0 ||
      data.recentMessages.length > 0 ||
      data.blockedUntil !== null ||
      (now - data.lastRequestTime < EXECUTE_WINDOW);
    
    if (!hasRecentActivity) {
      userRateLimits.delete(userId);
    }
  }
  
  console.log(`[RateLimiter] Limpeza concluída. Usuários ativos: ${userRateLimits.size}`);
}

// Iniciar limpeza periódica
setInterval(cleanupOldData, CLEANUP_INTERVAL);

// Função para adicionar delay entre requisições
async function throttleRequest(userId: string): Promise<void> {
  const userData = getUserData(userId);
  const now = Date.now();
  const timeSinceLastRequest = now - userData.lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
    const delayNeeded = MIN_REQUEST_DELAY - timeSinceLastRequest;
    console.log(`[RateLimiter] Throttling usuário ${userId} por ${delayNeeded}ms`);
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  userData.lastRequestTime = Date.now();
}

// Função para detectar spam em mensagens
function detectSpam(userId: string, message: string): { isSpam: boolean; reason?: string } {
  // Verificar comprimento da mensagem
  if (message.length < MIN_MESSAGE_LENGTH) {
    return { 
      isSpam: true, 
      reason: `Mensagem muito curta (mínimo: ${MIN_MESSAGE_LENGTH} caracteres)` 
    };
  }
  
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { 
      isSpam: true, 
      reason: `Mensagem muito longa (máximo: ${MAX_MESSAGE_LENGTH} caracteres)` 
    };
  }
  
  const userData = getUserData(userId);
  const messageHash = hashMessage(message);
  const now = Date.now();
  
  // Verificar mensagens duplicadas recentes (< 5 segundos)
  const recentDuplicate = userData.recentMessages.find(
    msg => msg.hash === messageHash && (now - msg.timestamp) < SPAM_DUPLICATE_WINDOW
  );
  
  if (recentDuplicate) {
    return { 
      isSpam: true, 
      reason: 'Mensagem duplicada enviada muito rapidamente' 
    };
  }
  
  // Contar mensagens idênticas sequenciais
  const recentSequentialDuplicates = userData.recentMessages
    .slice(-MAX_SEQUENTIAL_DUPLICATES)
    .filter(msg => msg.hash === messageHash);
  
  if (recentSequentialDuplicates.length >= MAX_SEQUENTIAL_DUPLICATES) {
    return { 
      isSpam: true, 
      reason: 'Muitas mensagens idênticas em sequência' 
    };
  }
  
  // Adicionar mensagem ao histórico
  userData.recentMessages.push({ hash: messageHash, timestamp: now });
  
  // Manter apenas as últimas 10 mensagens
  if (userData.recentMessages.length > 10) {
    userData.recentMessages.shift();
  }
  
  return { isSpam: false };
}

// Middleware de rate limiting para chat
export function rateLimitChat(req: Request, res: Response, next: NextFunction) {
  // Obter ID do usuário (session ou IP como fallback)
  const userId = req.sessionID || req.ip || 'unknown';
  const now = Date.now();
  
  console.log(`[RateLimiter] Chat request de usuário: ${userId}`);
  
  const userData = getUserData(userId);
  
  // Verificar se usuário está bloqueado
  if (userData.blockedUntil && now < userData.blockedUntil) {
    const retryAfter = Math.ceil((userData.blockedUntil - now) / 1000);
    console.log(`[RateLimiter] Usuário bloqueado: ${userId}, retry after: ${retryAfter}s`);
    
    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      message: `Você foi temporariamente bloqueado por exceder os limites. Tente novamente em ${retryAfter} segundos.`
    });
  }
  
  // Limpar requisições antigas
  userData.chatRequests = userData.chatRequests.filter(
    req => now - req.timestamp < CHAT_WINDOW
  );
  
  // Verificar limite de rate
  if (userData.chatRequests.length >= CHAT_LIMIT) {
    userData.violations++;
    console.log(`[RateLimiter] Rate limit excedido para ${userId}. Violações: ${userData.violations}`);
    
    // Bloquear após múltiplas violações
    if (userData.violations >= MAX_VIOLATIONS) {
      userData.blockedUntil = now + BLOCK_DURATION;
      const retryAfter = Math.ceil(BLOCK_DURATION / 1000);
      
      console.error(`[RateLimiter] ABUSO DETECTADO - Usuário bloqueado: ${userId} por ${retryAfter}s`);
      
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({
        message: `Bloqueado temporariamente por múltiplas violações de limite. Tente novamente em ${retryAfter} segundos.`
      });
    }
    
    const oldestRequest = userData.chatRequests[0];
    const resetTime = oldestRequest.timestamp + CHAT_WINDOW;
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    res.set({
      'X-RateLimit-Limit': CHAT_LIMIT.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      'Retry-After': retryAfter.toString(),
    });
    
    return res.status(429).json({
      message: `Muitas requisições. Tente novamente em ${retryAfter} segundos.`
    });
  }
  
  // Verificar spam (apenas para chat com mensagens)
  if (req.body && req.body.message) {
    const spamCheck = detectSpam(userId, req.body.message);
    if (spamCheck.isSpam) {
      userData.violations++;
      console.log(`[RateLimiter] Spam detectado de ${userId}: ${spamCheck.reason}`);
      
      // Bloquear após múltiplas violações de spam
      if (userData.violations >= MAX_VIOLATIONS) {
        userData.blockedUntil = now + BLOCK_DURATION;
        const retryAfter = Math.ceil(BLOCK_DURATION / 1000);
        
        console.error(`[RateLimiter] SPAM ABUSE - Usuário bloqueado: ${userId}`);
        
        res.set('Retry-After', retryAfter.toString());
        return res.status(429).json({
          message: `Bloqueado temporariamente por spam. Tente novamente em ${retryAfter} segundos.`
        });
      }
      
      return res.status(429).json({
        message: `Spam detectado: ${spamCheck.reason}. Por favor, aguarde antes de enviar novamente.`
      });
    }
  }
  
  // Aplicar throttling (enfileirar se necessário)
  const throttlePromise = throttleRequest(userId);
  
  // Adicionar requisição ao registro
  userData.chatRequests.push({ timestamp: Date.now() });
  
  // Calcular tempo até reset
  const oldestRequest = userData.chatRequests[0];
  const resetTime = oldestRequest ? oldestRequest.timestamp + CHAT_WINDOW : now + CHAT_WINDOW;
  const remaining = Math.max(0, CHAT_LIMIT - userData.chatRequests.length);
  
  // Adicionar headers de rate limit
  res.set({
    'X-RateLimit-Limit': CHAT_LIMIT.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
  });
  
  // Aguardar throttling antes de continuar
  throttlePromise.then(() => next()).catch(next);
}

// Middleware de rate limiting para execução de ações
export function rateLimitExecute(req: Request, res: Response, next: NextFunction) {
  // Obter ID do usuário (session ou IP como fallback)
  const userId = req.sessionID || req.ip || 'unknown';
  const now = Date.now();
  
  console.log(`[RateLimiter] Execute request de usuário: ${userId}`);
  
  const userData = getUserData(userId);
  
  // Verificar se usuário está bloqueado
  if (userData.blockedUntil && now < userData.blockedUntil) {
    const retryAfter = Math.ceil((userData.blockedUntil - now) / 1000);
    console.log(`[RateLimiter] Usuário bloqueado: ${userId}, retry after: ${retryAfter}s`);
    
    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      message: `Você foi temporariamente bloqueado por exceder os limites. Tente novamente em ${retryAfter} segundos.`
    });
  }
  
  // Limpar requisições antigas
  userData.executeRequests = userData.executeRequests.filter(
    req => now - req.timestamp < EXECUTE_WINDOW
  );
  
  // Verificar limite de rate
  if (userData.executeRequests.length >= EXECUTE_LIMIT) {
    userData.violations++;
    console.log(`[RateLimiter] Execute rate limit excedido para ${userId}. Violações: ${userData.violations}`);
    
    // Bloquear após múltiplas violações
    if (userData.violations >= MAX_VIOLATIONS) {
      userData.blockedUntil = now + BLOCK_DURATION;
      const retryAfter = Math.ceil(BLOCK_DURATION / 1000);
      
      console.error(`[RateLimiter] ABUSO DETECTADO - Usuário bloqueado: ${userId} por ${retryAfter}s`);
      
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({
        message: `Bloqueado temporariamente por múltiplas violações de limite. Tente novamente em ${retryAfter} segundos.`
      });
    }
    
    const oldestRequest = userData.executeRequests[0];
    const resetTime = oldestRequest.timestamp + EXECUTE_WINDOW;
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    res.set({
      'X-RateLimit-Limit': EXECUTE_LIMIT.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      'Retry-After': retryAfter.toString(),
    });
    
    return res.status(429).json({
      message: `Muitas requisições. Tente novamente em ${retryAfter} segundos.`
    });
  }
  
  // Aplicar throttling
  const throttlePromise = throttleRequest(userId);
  
  // Adicionar requisição ao registro
  userData.executeRequests.push({ timestamp: Date.now() });
  
  // Calcular tempo até reset
  const oldestRequest = userData.executeRequests[0];
  const resetTime = oldestRequest ? oldestRequest.timestamp + EXECUTE_WINDOW : now + EXECUTE_WINDOW;
  const remaining = Math.max(0, EXECUTE_LIMIT - userData.executeRequests.length);
  
  // Adicionar headers de rate limit
  res.set({
    'X-RateLimit-Limit': EXECUTE_LIMIT.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
  });
  
  // Aguardar throttling antes de continuar
  throttlePromise.then(() => next()).catch(next);
}

// Exportar função de limpeza manual (útil para testes)
export function cleanupRateLimitData() {
  cleanupOldData();
}

// Exportar função para obter estatísticas (útil para debug)
export function getRateLimitStats() {
  const stats = {
    totalUsers: userRateLimits.size,
    blockedUsers: 0,
    usersWithViolations: 0,
  };
  
  for (const userData of Array.from(userRateLimits.values())) {
    if (userData.blockedUntil && Date.now() < userData.blockedUntil) {
      stats.blockedUsers++;
    }
    if (userData.violations > 0) {
      stats.usersWithViolations++;
    }
  }
  
  return stats;
}
