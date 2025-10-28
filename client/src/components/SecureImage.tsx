import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SecureImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
  enableRightClickProtection?: boolean;
  enableDragProtection?: boolean;
  enableSelectProtection?: boolean;
  enableOverlay?: boolean;
  useCanvas?: boolean;
  watermarkText?: string;
}

interface ImageToken {
  imageUrl: string;
  token: string;
  expiresAt: number;
}

export const SecureImage: React.FC<SecureImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  onLoad,
  onError,
  enableRightClickProtection = true,
  enableDragProtection = true,
  enableSelectProtection = true,
  enableOverlay = true,
  useCanvas = true,
  watermarkText
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [imageToken, setImageToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [secureUrl, setSecureUrl] = useState<string>('');

  // Função para obter token de acesso à imagem
  const getImageToken = useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch('/api/image-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrls: [imageUrl] }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to get image token');
      }

      const data = await response.json();
      return data.tokens[0];
    } catch (error) {
      console.error('Error getting image token:', error);
      return null;
    }
  }, []);

  // Função para renderizar imagem no canvas
  const renderImageToCanvas = useCallback((img: HTMLImageElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar dimensões do canvas
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let canvasWidth = width || img.naturalWidth;
    let canvasHeight = height || img.naturalHeight;

    if (width && !height) {
      canvasHeight = width / aspectRatio;
    } else if (height && !width) {
      canvasWidth = height * aspectRatio;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Desenhar a imagem
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

    // Adicionar marca d'água se especificada
    if (watermarkText) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'white';
      ctx.font = `${Math.max(canvasWidth / 20, 16)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(watermarkText, canvasWidth / 2, canvasHeight / 2);
      ctx.restore();
    }

    // Adicionar ruído para dificultar OCR
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Adicionar pequeno ruído aleatório
      const noise = (Math.random() - 0.5) * 2;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
  }, [width, height, watermarkText]);

  // Inicializar componente
  useEffect(() => {
    const initializeSecureImage = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // Obter token de acesso
        const tokenData = await getImageToken(src);
        if (!tokenData) {
          throw new Error('Failed to get access token');
        }

        setImageToken(tokenData.token);
        
        // Construir URL segura com token
        const url = new URL(src, window.location.origin);
        url.searchParams.set('token', tokenData.token);
        setSecureUrl(url.toString());

      } catch (error) {
        console.error('Error initializing secure image:', error);
        setHasError(true);
        onError?.();
      } finally {
        setIsLoading(false);
      }
    };

    if (src) {
      initializeSecureImage();
    }
  }, [src, getImageToken, onError]);

  // Manipular carregamento da imagem
  const handleImageLoad = useCallback(() => {
    if (useCanvas && canvasRef.current && imgRef.current) {
      renderImageToCanvas(imgRef.current, canvasRef.current);
    }
    onLoad?.();
  }, [useCanvas, renderImageToCanvas, onLoad]);

  // Prevenir ações do usuário
  const preventAction = useCallback((e: React.MouseEvent | React.DragEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  // Prevenir teclas de atalho
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevenir Ctrl+S, Ctrl+A, F12, etc.
    if (
      (e.ctrlKey && (e.key === 's' || e.key === 'a' || e.key === 'c' || e.key === 'v')) ||
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
    ) {
      preventAction(e);
    }
  }, [preventAction]);

  // Prevenir print screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Opcional: mostrar alerta
        alert('Captura de tela não permitida para este conteúdo protegido.');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Detectar ferramentas de desenvolvedor
  useEffect(() => {
    let devtools = false;
    const threshold = 160;

    const detectDevTools = () => {
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        if (!devtools) {
          devtools = true;
          console.clear();
          console.log('%cAcesso negado!', 'color: red; font-size: 50px; font-weight: bold;');
          console.log('%cEste conteúdo é protegido contra download.', 'color: red; font-size: 16px;');
        }
      } else {
        devtools = false;
      }
    };

    const interval = setInterval(detectDevTools, 500);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-200 animate-pulse", className)}>
        <div className="text-gray-500">Carregando imagem segura...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-200", className)}>
        <div className="text-red-500">Erro ao carregar imagem</div>
      </div>
    );
  }

  const containerProps = {
    className: cn(
      "relative inline-block",
      enableSelectProtection && "select-none",
      className
    ),
    onContextMenu: enableRightClickProtection ? preventAction : undefined,
    onDragStart: enableDragProtection ? preventAction : undefined,
    onDrop: enableDragProtection ? preventAction : undefined,
    onKeyDown: handleKeyDown,
    tabIndex: 0,
    style: {
      WebkitUserSelect: enableSelectProtection ? 'none' : undefined,
      MozUserSelect: enableSelectProtection ? 'none' : undefined,
      msUserSelect: enableSelectProtection ? 'none' : undefined,
      userSelect: enableSelectProtection ? 'none' : undefined,
      WebkitTouchCallout: 'none',
      WebkitUserDrag: enableDragProtection ? 'none' : undefined,
    }
  };

  return (
    <div {...containerProps}>
      {useCanvas ? (
        <>
          {/* Imagem oculta para carregar dados */}
          <img
            ref={imgRef}
            src={secureUrl}
            alt={alt}
            style={{ display: 'none' }}
            onLoad={handleImageLoad}
            onError={() => setHasError(true)}
            crossOrigin="anonymous"
          />
          
          {/* Canvas para renderização segura */}
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto"
            style={{
              pointerEvents: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              userSelect: 'none'
            }}
          />
        </>
      ) : (
        <img
          ref={imgRef}
          src={secureUrl}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleImageLoad}
          onError={() => setHasError(true)}
          draggable={false}
          style={{
            pointerEvents: enableOverlay ? 'none' : undefined,
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none'
          }}
        />
      )}

      {/* Overlay transparente para bloquear interações */}
      {enableOverlay && (
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-transparent cursor-default"
          onContextMenu={preventAction}
          onDragStart={preventAction}
          onSelectStart={preventAction}
          style={{
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
            pointerEvents: 'all'
          }}
        />
      )}

      {/* Marca d'água CSS adicional */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 100px,
            rgba(255,255,255,0.05) 100px,
            rgba(255,255,255,0.05) 101px
          )`,
          mixBlendMode: 'overlay'
        }}
      />
    </div>
  );
};

export default SecureImage;