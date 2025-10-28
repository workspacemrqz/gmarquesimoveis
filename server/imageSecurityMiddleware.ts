import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from './storage';

// Interface para tokens de acesso temporário
interface ImageAccessToken {
  imageUrl: string;
  sessionId: string;
  expiresAt: number;
  ipAddress: string;
  userAgent: string;
}

// Cache em memória para tokens (em produção, usar Redis)
const tokenCache = new Map<string, ImageAccessToken>();
const accessLog = new Map<string, { count: number; lastAccess: number; blocked: boolean }>();

// Configurações de segurança
const SECURITY_CONFIG = {
  TOKEN_EXPIRY_MS: 30 * 60 * 1000, // 30 minutos
  MAX_ATTEMPTS_PER_IP: 10, // Máximo de tentativas por IP por hora
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000, // 1 hora
  ALLOWED_REFERERS: [
    'localhost:3000',
    'localhost:5173',
    process.env.DOMAIN || 'gmarquesimoveis.com'
  ]
};

// Gerar token de acesso temporário
export function generateImageAccessToken(
  imageUrl: string, 
  sessionId: string, 
  ipAddress: string, 
  userAgent: string
): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SECURITY_CONFIG.TOKEN_EXPIRY_MS;
  
  tokenCache.set(token, {
    imageUrl,
    sessionId,
    expiresAt,
    ipAddress,
    userAgent
  });
  
  // Limpar tokens expirados periodicamente
  setTimeout(() => {
    if (tokenCache.has(token)) {
      const tokenData = tokenCache.get(token)!;
      if (Date.now() > tokenData.expiresAt) {
        tokenCache.delete(token);
      }
    }
  }, SECURITY_CONFIG.TOKEN_EXPIRY_MS + 60000); // +1 minuto de buffer
  
  return token;
}

// Validar token de acesso
function validateImageAccessToken(
  token: string, 
  sessionId: string, 
  ipAddress: string, 
  userAgent: string
): ImageAccessToken | null {
  const tokenData = tokenCache.get(token);
  
  if (!tokenData) {
    return null;
  }
  
  // Verificar expiração
  if (Date.now() > tokenData.expiresAt) {
    tokenCache.delete(token);
    return null;
  }
  
  // Verificar sessão, IP e User-Agent
  if (tokenData.sessionId !== sessionId || 
      tokenData.ipAddress !== ipAddress || 
      tokenData.userAgent !== userAgent) {
    return null;
  }
  
  return tokenData;
}

// Verificar referer
function isValidReferer(referer: string | undefined): boolean {
  if (!referer) return false;
  
  try {
    const refererUrl = new URL(referer);
    return SECURITY_CONFIG.ALLOWED_REFERERS.some(allowed => 
      refererUrl.hostname.includes(allowed) || allowed.includes(refererUrl.hostname)
    );
  } catch {
    return false;
  }
}

// Rate limiting por IP
function checkRateLimit(ipAddress: string): boolean {
  const now = Date.now();
  const key = ipAddress;
  
  if (!accessLog.has(key)) {
    accessLog.set(key, { count: 1, lastAccess: now, blocked: false });
    return true;
  }
  
  const log = accessLog.get(key)!;
  
  // Reset contador se passou da janela de tempo
  if (now - log.lastAccess > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
    log.count = 1;
    log.lastAccess = now;
    log.blocked = false;
    return true;
  }
  
  log.count++;
  log.lastAccess = now;
  
  if (log.count > SECURITY_CONFIG.MAX_ATTEMPTS_PER_IP) {
    log.blocked = true;
    return false;
  }
  
  return true;
}

// Log de tentativas de acesso
function logImageAccess(
  ipAddress: string, 
  userAgent: string, 
  imageUrl: string, 
  success: boolean, 
  reason?: string
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ipAddress,
    userAgent,
    imageUrl,
    success,
    reason: reason || (success ? 'Authorized access' : 'Unauthorized access')
  };
  
  console.log('[IMAGE_SECURITY]', JSON.stringify(logEntry));
  
  // Em produção, salvar em banco de dados ou sistema de logs
  // await storage.logImageAccess(logEntry);
}

// Middleware principal de segurança para imagens
export const secureImageMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const referer = req.get('Referer');
  const sessionId = req.sessionID;
  const token = req.query.token as string;
  const imageUrl = req.originalUrl;
  
  // Configurar cabeçalhos de segurança
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Verificar rate limiting
  if (!checkRateLimit(ipAddress)) {
    logImageAccess(ipAddress, userAgent, imageUrl, false, 'Rate limit exceeded');
    return res.status(429).json({ 
      error: 'Too many requests. Access temporarily blocked.' 
    });
  }
  
  // Verificar referer (proteção contra hotlinking)
  if (!isValidReferer(referer)) {
    logImageAccess(ipAddress, userAgent, imageUrl, false, 'Invalid referer');
    return res.status(403).json({ 
      error: 'Access denied. Invalid referer.' 
    });
  }
  
  // Verificar se é uma requisição para imagem protegida
  if (imageUrl.includes('/protected-images/') || token) {
    // Verificar autenticação de sessão
    if (!req.session?.isAdmin && !sessionId) {
      logImageAccess(ipAddress, userAgent, imageUrl, false, 'No valid session');
      return res.status(401).json({ 
        error: 'Authentication required.' 
      });
    }
    
    // Verificar token de acesso
    if (!token) {
      logImageAccess(ipAddress, userAgent, imageUrl, false, 'Missing access token');
      return res.status(403).json({ 
        error: 'Access token required.' 
      });
    }
    
    const tokenData = validateImageAccessToken(token, sessionId, ipAddress, userAgent);
    if (!tokenData) {
      logImageAccess(ipAddress, userAgent, imageUrl, false, 'Invalid or expired token');
      return res.status(403).json({ 
        error: 'Invalid or expired access token.' 
      });
    }
    
    // Verificar se o token corresponde à imagem solicitada
    if (!imageUrl.includes(tokenData.imageUrl.split('/').pop() || '')) {
      logImageAccess(ipAddress, userAgent, imageUrl, false, 'Token mismatch');
      return res.status(403).json({ 
        error: 'Token does not match requested image.' 
      });
    }
  }
  
  // Log de acesso autorizado
  logImageAccess(ipAddress, userAgent, imageUrl, true);
  
  next();
};

// Middleware para gerar tokens de acesso para imagens
export const generateImageTokens = async (req: Request, res: Response) => {
  const { imageUrls } = req.body;
  const sessionId = req.sessionID;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  if (!Array.isArray(imageUrls)) {
    return res.status(400).json({ error: 'imageUrls must be an array' });
  }
  
  const tokens = imageUrls.map(imageUrl => ({
    imageUrl,
    token: generateImageAccessToken(imageUrl, sessionId, ipAddress, userAgent),
    expiresAt: Date.now() + SECURITY_CONFIG.TOKEN_EXPIRY_MS
  }));
  
  res.json({ tokens });
};

// Função para limpar tokens expirados (executar periodicamente)
export function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of Array.from(tokenCache.entries())) {
    if (now > data.expiresAt) {
      tokenCache.delete(token);
    }
  }
}

// Limpar tokens expirados a cada 5 minutos
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

// Função para obter estatísticas de segurança
export function getSecurityStats() {
  return {
    activeTokens: tokenCache.size,
    accessLogs: accessLog.size,
    blockedIPs: Array.from(accessLog.entries())
      .filter(([_, log]) => log.blocked)
      .map(([ip]) => ip)
  };
}