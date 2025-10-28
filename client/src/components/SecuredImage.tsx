import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Lock } from "lucide-react";

interface SecuredImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  userId?: string;
  useCanvas?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  onSuspiciousActivity?: (activityType: string) => void;
}

// Função para registrar tentativa suspeita no backend
async function logSuspiciousAccess(imageUrl: string, accessType: string, metadata?: any) {
  try {
    await apiRequest("POST", "/api/secure-image/log-suspicious-access", {
      imageUrl,
      accessType,
      metadata,
    });
  } catch (error) {
    console.error('Erro ao registrar acesso suspeito:', error);
  }
}

export function SecuredImage({
  imageUrl,
  alt,
  className = "",
  userId,
  useCanvas = true,
  enableWatermark = true,
  watermarkText = "© Protegido",
  onSuspiciousActivity,
}: SecuredImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [suspiciousAttempts, setSuspiciousAttempts] = useState(0);
  const [protectedUrl, setProtectedUrl] = useState<string>("");

  // Detectar abertura de DevTools
  useEffect(() => {
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      const isOpen = widthThreshold || heightThreshold;
      
      if (isOpen && !devToolsOpen) {
        setDevToolsOpen(true);
        logSuspiciousAccess(imageUrl, 'devtools_opened', {
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        });
        onSuspiciousActivity?.('devtools_opened');
      }
    };

    const interval = setInterval(detectDevTools, 1000);
    return () => clearInterval(interval);
  }, [imageUrl, devToolsOpen, onSuspiciousActivity]);

  // Detectar extensões de download (tentativa)
  useEffect(() => {
    const detectExtensions = () => {
      // Detectar elementos injetados por extensões de download
      const suspiciousElements = document.querySelectorAll('[class*="download"], [class*="save"], [id*="download"]');
      
      if (suspiciousElements.length > 0) {
        logSuspiciousAccess(imageUrl, 'download_extension_detected', {
          elementsCount: suspiciousElements.length,
        });
        onSuspiciousActivity?.('download_extension_detected');
      }
    };

    const interval = setInterval(detectExtensions, 5000);
    return () => clearInterval(interval);
  }, [imageUrl, onSuspiciousActivity]);

  // Handler para bloquear menu de contexto
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSuspiciousAttempts(prev => prev + 1);
    logSuspiciousAccess(imageUrl, 'right_click_attempt', {
      x: e.clientX,
      y: e.clientY,
    });
    onSuspiciousActivity?.('right_click_attempt');
    return false;
  }, [imageUrl, onSuspiciousActivity]);

  // Handler para bloquear arrastar
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSuspiciousAttempts(prev => prev + 1);
    logSuspiciousAccess(imageUrl, 'drag_attempt');
    onSuspiciousActivity?.('drag_attempt');
    return false;
  }, [imageUrl, onSuspiciousActivity]);

  // Bloquear seleção usando addEventListener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };
    
    container.addEventListener('selectstart', handleSelectStart);
    return () => container.removeEventListener('selectstart', handleSelectStart);
  }, []);

  // Handler para detectar tentativas de copiar
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    setSuspiciousAttempts(prev => prev + 1);
    logSuspiciousAccess(imageUrl, 'copy_attempt');
    onSuspiciousActivity?.('copy_attempt');
    return false;
  }, [imageUrl, onSuspiciousActivity]);

  // Handler para detectar print screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detectar Print Screen, Ctrl+P, Cmd+P
      if (
        e.key === 'PrintScreen' ||
        (e.key === 'p' && (e.ctrlKey || e.metaKey))
      ) {
        logSuspiciousAccess(imageUrl, 'print_screen_attempt', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        });
        onSuspiciousActivity?.('print_screen_attempt');
      }
      
      // Detectar Ctrl+S, Cmd+S (Save)
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        logSuspiciousAccess(imageUrl, 'save_attempt');
        onSuspiciousActivity?.('save_attempt');
      }
      
      // Detectar F12 (DevTools)
      if (e.key === 'F12') {
        logSuspiciousAccess(imageUrl, 'f12_pressed');
        onSuspiciousActivity?.('f12_pressed');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, onSuspiciousActivity]);

  // Gerar token e carregar imagem através da rota protegida
  useEffect(() => {
    if (!useCanvas || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Função para gerar token e carregar imagem
    const loadProtectedImage = async () => {
      try {
        // Gerar token para acessar a imagem
        const tokenResponse = await apiRequest("POST", "/api/secure-image/generate-token", {
          imageUrl,
          userId,
        });

        if (!tokenResponse.url) {
          throw new Error('Token não gerado');
        }

        // Carregar imagem usando o token
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // Configurar dimensões do canvas
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          
          // Desenhar imagem
          ctx.drawImage(img, 0, 0);
          
          // Adicionar marca d'água se habilitado
          if (enableWatermark && watermarkText) {
            const fontSize = Math.max(20, canvas.width / 30);
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            
            // Desenhar marca d'água repetida
            const spacing = fontSize * 5;
            for (let y = fontSize; y < canvas.height; y += spacing) {
              for (let x = -canvas.width; x < canvas.width; x += spacing * 3) {
                ctx.save();
                ctx.translate(x + spacing, y);
                ctx.rotate(-45 * Math.PI / 180);
                ctx.strokeText(watermarkText, 0, 0);
                ctx.fillText(watermarkText, 0, 0);
                ctx.restore();
              }
            }
            
            // Adicionar timestamp invisível (esteganografia básica)
            const timestamp = Date.now().toString();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.001)';
            ctx.fillText(timestamp, 10, 10);
          }
          
          setIsLoading(false);
        };
        
        img.onerror = () => {
          setError('Erro ao carregar imagem protegida');
          setIsLoading(false);
          logSuspiciousAccess(imageUrl, 'image_load_error');
        };
        
        // Usar a URL protegida com token
        img.src = tokenResponse.url;
      } catch (error) {
        console.error('Erro ao gerar token:', error);
        setError('Erro ao acessar imagem protegida');
        setIsLoading(false);
        logSuspiciousAccess(imageUrl, 'token_generation_error');
      }
    };

    loadProtectedImage();
  }, [imageUrl, useCanvas, enableWatermark, watermarkText, userId]);

  // Alertar se muitas tentativas suspeitas
  useEffect(() => {
    if (suspiciousAttempts >= 3) {
      logSuspiciousAccess(imageUrl, 'multiple_suspicious_attempts', {
        count: suspiciousAttempts,
      });
      onSuspiciousActivity?.('multiple_suspicious_attempts');
    }
  }, [suspiciousAttempts, imageUrl, onSuspiciousActivity]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (useCanvas) {
    return (
      <div
        ref={containerRef}
        className={`relative ${className}`}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onCopy={handleCopy}
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        } as React.CSSProperties}
        data-testid="secured-image-container"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Carregando imagem protegida...</p>
            </div>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className={`w-full h-auto ${isLoading ? 'hidden' : ''}`}
          style={{
            pointerEvents: 'none',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        
        {/* Overlay transparente para bloquear interações */}
        <div
          className="absolute inset-0 cursor-default"
          style={{
            background: 'transparent',
            zIndex: 10,
          }}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          data-testid="image-overlay"
        />
        
        {devToolsOpen && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold z-20">
            ⚠️ Monitoramento Ativo
          </div>
        )}
      </div>
    );
  }

  // Gerar token para modo fallback (sem canvas)
  useEffect(() => {
    if (useCanvas) return; // Apenas para modo fallback
    
    const generateToken = async () => {
      try {
        const tokenResponse = await apiRequest("POST", "/api/secure-image/generate-token", {
          imageUrl,
          userId,
        });
        
        if (tokenResponse.url) {
          setProtectedUrl(tokenResponse.url);
        } else {
          throw new Error('Token não gerado');
        }
      } catch (error) {
        console.error('Erro ao gerar token:', error);
        setError('Erro ao acessar imagem protegida');
        setIsLoading(false);
        logSuspiciousAccess(imageUrl, 'token_generation_error');
      }
    };
    
    generateToken();
  }, [imageUrl, userId, useCanvas]);

  // Fallback: usar img tag com proteções básicas
  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onCopy={handleCopy}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
      } as React.CSSProperties}
      data-testid="secured-image-container"
    >
      {protectedUrl ? (
        <img
          ref={imgRef}
          src={protectedUrl}
          alt={alt}
          draggable={false}
          className="w-full h-auto pointer-events-none select-none"
          style={{
            userSelect: 'none',
            WebkitUserDrag: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
          } as React.CSSProperties}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError('Erro ao carregar imagem protegida');
            setIsLoading(false);
          }}
          data-testid="secured-image"
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400 animate-pulse" />
        </div>
      )}
      
      {/* Overlay transparente */}
      <div
        className="absolute inset-0 cursor-default"
        style={{
          background: 'transparent',
          zIndex: 10,
        }}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        data-testid="image-overlay"
      />
      
      {devToolsOpen && (
        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold z-20">
          ⚠️ Monitoramento Ativo
        </div>
      )}
    </div>
  );
}

export default SecuredImage;
