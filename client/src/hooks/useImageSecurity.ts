import { useState, useEffect, useCallback } from 'react';

interface ImageToken {
  imageUrl: string;
  token: string;
  expiresAt: number;
}

interface SecurityStats {
  activeTokens: number;
  accessLogs: number;
  blockedIPs: string[];
}

export const useImageSecurity = () => {
  const [tokens, setTokens] = useState<Map<string, ImageToken>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para obter tokens de acesso para múltiplas imagens
  const getImageTokens = useCallback(async (imageUrls: string[]): Promise<ImageToken[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/image-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrls }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to get image tokens: ${response.statusText}`);
      }

      const data = await response.json();
      const newTokens = data.tokens as ImageToken[];

      // Atualizar cache de tokens
      const updatedTokens = new Map(tokens);
      newTokens.forEach(token => {
        updatedTokens.set(token.imageUrl, token);
      });
      setTokens(updatedTokens);

      return newTokens;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  // Função para obter token de uma única imagem
  const getImageToken = useCallback(async (imageUrl: string): Promise<ImageToken | null> => {
    // Verificar se já temos um token válido em cache
    const cachedToken = tokens.get(imageUrl);
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) { // 1 minuto de buffer
      return cachedToken;
    }

    try {
      const tokenArray = await getImageTokens([imageUrl]);
      return tokenArray[0] || null;
    } catch (err) {
      console.error('Error getting single image token:', err);
      return null;
    }
  }, [tokens, getImageTokens]);

  // Função para construir URL segura com token
  const getSecureImageUrl = useCallback(async (imageUrl: string): Promise<string | null> => {
    try {
      const tokenData = await getImageToken(imageUrl);
      if (!tokenData) {
        return null;
      }

      const url = new URL(imageUrl, window.location.origin);
      url.searchParams.set('token', tokenData.token);
      return url.toString();
    } catch (err) {
      console.error('Error creating secure image URL:', err);
      return null;
    }
  }, [getImageToken]);

  // Função para verificar se um token está válido
  const isTokenValid = useCallback((imageUrl: string): boolean => {
    const token = tokens.get(imageUrl);
    return token ? Date.now() < token.expiresAt : false;
  }, [tokens]);

  // Função para limpar tokens expirados
  const cleanupExpiredTokens = useCallback(() => {
    const now = Date.now();
    const updatedTokens = new Map();
    
    for (const [url, token] of tokens.entries()) {
      if (now < token.expiresAt) {
        updatedTokens.set(url, token);
      }
    }
    
    setTokens(updatedTokens);
  }, [tokens]);

  // Função para obter estatísticas de segurança (apenas admin)
  const getSecurityStats = useCallback(async (): Promise<SecurityStats | null> => {
    try {
      const response = await fetch('/api/admin/security-stats', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to get security stats');
      }

      return await response.json();
    } catch (err) {
      console.error('Error getting security stats:', err);
      return null;
    }
  }, []);

  // Limpar tokens expirados periodicamente
  useEffect(() => {
    const interval = setInterval(cleanupExpiredTokens, 5 * 60 * 1000); // A cada 5 minutos
    return () => clearInterval(interval);
  }, [cleanupExpiredTokens]);

  // Detectar tentativas de bypass
  useEffect(() => {
    const detectBypassAttempts = () => {
      // Detectar abertura de ferramentas de desenvolvedor
      let devtools = false;
      const threshold = 160;

      const checkDevTools = () => {
        if (
          window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold
        ) {
          if (!devtools) {
            devtools = true;
            console.clear();
            console.log('%cAcesso Negado!', 'color: red; font-size: 50px; font-weight: bold;');
            console.log('%cEste conteúdo é protegido.', 'color: red; font-size: 16px;');
            
            // Log da tentativa de bypass
            fetch('/api/security-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'devtools_detected',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
              }),
              credentials: 'include'
            }).catch(() => {}); // Silenciar erros de log
          }
        } else {
          devtools = false;
        }
      };

      const interval = setInterval(checkDevTools, 1000);
      return () => clearInterval(interval);
    };

    const cleanup = detectBypassAttempts();
    return cleanup;
  }, []);

  // Prevenir print screen globalmente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevenir Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        
        // Log da tentativa
        fetch('/api/security-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'print_screen_attempt',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }),
          credentials: 'include'
        }).catch(() => {});
        
        // Opcional: mostrar alerta
        alert('Captura de tela não permitida para conteúdo protegido.');
      }

      // Prevenir outras teclas de atalho perigosas
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        
        fetch('/api/security-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'devtools_shortcut_attempt',
            key: e.key,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }),
          credentials: 'include'
        }).catch(() => {});
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    tokens: Array.from(tokens.values()),
    isLoading,
    error,
    getImageToken,
    getImageTokens,
    getSecureImageUrl,
    isTokenValid,
    cleanupExpiredTokens,
    getSecurityStats
  };
};

export default useImageSecurity;