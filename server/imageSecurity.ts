import crypto from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "./storage";
import type { ImageAccessToken, ImageAccessLog } from "@shared/schema";

const DOMAIN_WHITELIST = process.env.DOMAIN_WHITELIST?.split(',') || [];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];

// Domínios permitidos para imagens - APENAS o hostname exato do projeto Supabase
// NUNCA usar wildcards como .supabase.co pois permite qualquer projeto Supabase
const ALLOWED_IMAGE_DOMAINS = [
  // Extrair hostname exato da URL do Supabase (ex: abc123.supabase.co)
  process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null,
  // Adicionar hostname do storage se diferente
  process.env.SUPABASE_STORAGE_URL ? new URL(process.env.SUPABASE_STORAGE_URL).hostname : null,
].filter(Boolean) as string[];

console.log('🔒 Domínios de imagem permitidos (SSRF protection):', ALLOWED_IMAGE_DOMAINS);

// Validar se a URL da imagem é de um domínio permitido
export function isAllowedImageUrl(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl);
    
    // Verificar protocolo (apenas HTTPS)
    if (url.protocol !== 'https:') {
      return false;
    }
    
    // Verificar se o hostname está na lista de permitidos (comparação exata apenas)
    const hostname = url.hostname;
    
    // Comparação exata - sem wildcards
    if (ALLOWED_IMAGE_DOMAINS.includes(hostname)) {
      return true;
    }
    
    // Se não está na lista, bloquear
    console.warn(`⚠️ URL bloqueada: ${imageUrl} - Hostname ${hostname} não está na lista de permitidos`);
    return false;
  } catch {
    return false;
  }
}

// Gerar token seguro para acesso à imagem
export function generateImageToken(imageUrl: string, expirationMinutes: number = 30): string {
  const token = crypto.randomBytes(32).toString('hex');
  const data = `${imageUrl}:${Date.now()}:${token}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Middleware para adicionar cabeçalhos de segurança
export const imageSecurityHeaders: RequestHandler = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Forçar inline (nunca permitir download direto)
  res.setHeader('Content-Disposition', 'inline');
  
  // Prevenir que a imagem seja carregada em frames
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Content Security Policy para imagens
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  
  // Prevenir cache agressivo
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
};

// Extrair IP do cliente (considerando proxies)
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Verificar se o referer é válido
export function isValidReferer(referer: string | undefined, allowedReferers: string[]): boolean {
  if (!referer) return false;
  
  try {
    const refererUrl = new URL(referer);
    const refererHost = refererUrl.hostname;
    
    // Verificar se o hostname está na lista de permitidos
    for (const allowed of allowedReferers) {
      if (allowed === '*') return true;
      
      // Suporta wildcards (e.g., *.example.com)
      if (allowed.startsWith('*.')) {
        const domain = allowed.substring(2);
        if (refererHost.endsWith(domain)) return true;
      } else if (refererHost === allowed) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

// Middleware para verificar token de acesso
export const verifyImageToken: RequestHandler = async (req, res, next) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      await logImageAccess(req, req.path, 'view', false, 'Token ausente');
      return res.status(401).json({ error: 'Token de acesso não fornecido' });
    }
    
    // Buscar token no banco de dados
    const tokenData = await storage.getImageAccessToken(token);
    
    if (!tokenData) {
      await logImageAccess(req, 'unknown', 'view', false, 'Token inválido');
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    
    const imageUrl = tokenData.imageUrl;
    
    // Verificar se o token expirou
    if (new Date() > new Date(tokenData.expiresAt)) {
      await logImageAccess(req, imageUrl, 'view', false, 'Token expirado');
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    // Verificar se o token foi revogado
    if (tokenData.isRevoked) {
      await logImageAccess(req, imageUrl, 'view', false, 'Token revogado');
      return res.status(401).json({ error: 'Token revogado' });
    }
    
    // Verificar número máximo de visualizações
    const viewCount = tokenData.viewCount ?? 0;
    const maxViews = tokenData.maxViews ?? 10;
    if (viewCount >= maxViews) {
      await logImageAccess(req, imageUrl, 'view', false, 'Limite de visualizações excedido');
      return res.status(429).json({ error: 'Limite de visualizações excedido' });
    }
    
    // Incrementar contador de visualizações
    await storage.incrementTokenViewCount(token);
    
    // Anexar dados do token à request
    (req as any).imageToken = tokenData;
    
    // Registrar acesso com a URL real do asset
    await logImageAccess(req, tokenData.imageUrl, 'view', true);
    next();
  } catch (error) {
    console.error('Erro ao verificar token de imagem:', error);
    await logImageAccess(req, 'error', 'view', false, 'Erro interno');
    return res.status(500).json({ error: 'Erro ao verificar token' });
  }
};

// Middleware para verificar referer
export const verifyReferer: RequestHandler = async (req, res, next) => {
  try {
    const settings = await storage.getImageSecuritySettings();
    
    // Se a verificação de referer estiver desabilitada, pular
    if (!settings?.enableRefererCheck) {
      return next();
    }
    
    const referer = req.headers.referer || req.headers.origin;
    const allowedReferers = settings.allowedReferers || [];
    
    // Adicionar domínio atual à lista de permitidos
    const currentHost = req.headers.host;
    if (currentHost && !allowedReferers.includes(currentHost)) {
      allowedReferers.push(currentHost);
    }
    
    // Adicionar domínios do whitelist
    allowedReferers.push(...DOMAIN_WHITELIST);
    allowedReferers.push(...ALLOWED_ORIGINS);
    
    if (!isValidReferer(referer, allowedReferers)) {
      await logImageAccess(req, req.path, 'hotlink_attempt', false, 'Referer inválido');
      return res.status(403).json({ error: 'Acesso negado: origem não autorizada' });
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar referer:', error);
    next();
  }
};

// Middleware para verificar restrição de IP
export const verifyIpRestriction: RequestHandler = async (req, res, next) => {
  try {
    const settings = await storage.getImageSecuritySettings();
    
    // Se a restrição de IP estiver desabilitada, pular
    if (!settings?.enableIpRestriction) {
      return next();
    }
    
    const clientIp = getClientIp(req);
    const allowedIps = settings.allowedIps || [];
    
    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      await logImageAccess(req, req.path, 'ip_blocked', false, `IP não autorizado: ${clientIp}`);
      return res.status(403).json({ error: 'Acesso negado: IP não autorizado' });
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar restrição de IP:', error);
    next();
  }
};

// Registrar acesso à imagem
export async function logImageAccess(
  req: Request,
  imageUrl: string,
  accessType: string,
  success: boolean = true,
  blockReason?: string,
  metadata?: any
): Promise<void> {
  try {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers.referer || req.headers.origin || '';
    const tokenData = (req as any).imageToken;
    
    await storage.createImageAccessLog({
      imageUrl,
      tokenId: tokenData?.id || null,
      userId: tokenData?.userId || null,
      ipAddress: clientIp,
      userAgent,
      referer,
      accessType,
      success,
      blockReason: blockReason || null,
      metadata: metadata || null,
    });
    
    // Verificar se precisa alertar (múltiplas tentativas falhas)
    if (!success) {
      await checkForSuspiciousActivity(clientIp, imageUrl);
    }
  } catch (error) {
    console.error('Erro ao registrar acesso à imagem:', error);
  }
}

// Verificar atividade suspeita
async function checkForSuspiciousActivity(ipAddress: string, imageUrl: string): Promise<void> {
  try {
    const settings = await storage.getImageSecuritySettings();
    const threshold = settings?.alertThreshold || 5;
    
    // Buscar tentativas falhas recentes (últimos 10 minutos)
    const recentLogs = await storage.getRecentFailedImageAccess(ipAddress, imageUrl, 10);
    
    if (recentLogs >= threshold) {
      console.warn(`⚠️ ALERTA DE SEGURANÇA: IP ${ipAddress} teve ${recentLogs} tentativas falhas de acesso à imagem ${imageUrl}`);
      
      // Aqui você pode implementar ações adicionais:
      // - Enviar email de alerta
      // - Bloquear IP temporariamente
      // - Revogar tokens associados
      // - Notificar administradores
    }
  } catch (error) {
    console.error('Erro ao verificar atividade suspeita:', error);
  }
}

// Criar token de acesso para uma imagem
export async function createImageAccessToken(
  imageUrl: string,
  userId?: string,
  req?: Request
): Promise<{ token: string; expiresAt: Date; url: string }> {
  try {
    // VALIDAÇÃO CRÍTICA: Verificar se a URL é de um domínio permitido (prevenir SSRF)
    if (!isAllowedImageUrl(imageUrl)) {
      console.error(`⚠️ SSRF ATTEMPT BLOCKED: Tentativa de gerar token para URL não permitida: ${imageUrl}`);
      throw new Error('URL de imagem não permitida. Apenas domínios autorizados são aceitos.');
    }
    
    const settings = await storage.getImageSecuritySettings();
    const expirationMinutes = settings?.tokenExpirationMinutes || 30;
    const maxViews = settings?.maxViewsPerToken || 10;
    
    const token = generateImageToken(imageUrl, expirationMinutes);
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    
    const ipAddress = req ? getClientIp(req) : undefined;
    const userAgent = req?.headers['user-agent'];
    const referer = req?.headers.referer || req?.headers.origin;
    
    await storage.createImageAccessToken({
      token,
      imageUrl,
      userId: userId || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      referer: referer || null,
      expiresAt,
      maxViews,
      isRevoked: false,
    });
    
    // Gerar URL com token
    const url = `/api/secure-image?token=${token}`;
    
    return { token, expiresAt, url };
  } catch (error) {
    console.error('Erro ao criar token de acesso:', error);
    throw error;
  }
}

// Revogar token
export async function revokeImageToken(token: string): Promise<void> {
  try {
    await storage.revokeImageToken(token);
  } catch (error) {
    console.error('Erro ao revogar token:', error);
    throw new Error('Erro ao revogar token');
  }
}

// Limpar tokens expirados
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    return await storage.deleteExpiredImageTokens();
  } catch (error) {
    console.error('Erro ao limpar tokens expirados:', error);
    return 0;
  }
}

// Agendar limpeza automática de tokens (executar a cada hora)
setInterval(async () => {
  const deleted = await cleanupExpiredTokens();
  if (deleted > 0) {
    console.log(`🧹 Limpeza automática: ${deleted} tokens expirados removidos`);
  }
}, 60 * 60 * 1000); // 1 hora
