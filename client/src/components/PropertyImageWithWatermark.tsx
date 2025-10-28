import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PropertyImageWithWatermarkProps {
  src?: string;
  alt: string;
  isFeatured?: boolean;
  className?: string;
}

export function PropertyImageWithWatermark({ 
  src, 
  alt, 
  isFeatured,
  className = "aspect-video"
}: PropertyImageWithWatermarkProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [useOptimized, setUseOptimized] = useState(true);
  const imgRef = useRef<HTMLDivElement>(null);

  // Fetch watermark settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    if (useOptimized) {
      setUseOptimized(false);
      setIsLoading(true);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [useOptimized]);

  const isWebP = src?.includes('.webp');
  const shouldOptimize = isWebP && useOptimized;
  const currentSrc = shouldOptimize ? src?.replace(/(\.[^.]+)$/, '_medium$1') : src;
  const thumbnailSrc = shouldOptimize ? src?.replace(/(\.[^.]+)$/, '_thumb$1') : src;

  const watermarkEnabled = settings?.watermarkEnabled === 'true';
  const watermarkImage = settings?.watermarkImage;
  const watermarkSize = settings?.watermarkSize ? parseInt(settings.watermarkSize) : 20;
  const watermarkOpacity = settings?.watermarkOpacity ? parseInt(settings.watermarkOpacity) / 100 : 0.3;

  return (
    <div ref={imgRef} className={`${className} bg-muted relative overflow-hidden`}>
      {/* Skeleton loader */}
      {isLoading && isIntersecting && (
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse" />
      )}
      
      {/* Actual image */}
      {isIntersecting && currentSrc && !hasError && (
        <img
          src={currentSrc}
          srcSet={shouldOptimize ? `${thumbnailSrc} 400w, ${currentSrc} 800w, ${src} 1920w` : undefined}
          sizes={shouldOptimize ? "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" : undefined}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
          decoding="async"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: 'none' }}
        />
      )}
      
      {/* Watermark overlay - positioned relative to CONTAINER, not image */}
      {watermarkEnabled && watermarkImage && isIntersecting && !isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: watermarkOpacity,
          }}
        >
          <img
            src={watermarkImage}
            alt="Marca d'água"
            className="object-contain"
            style={{
              width: `${watermarkSize}%`,
              maxWidth: '100%',
              maxHeight: '100%',
              userSelect: 'none',
            }}
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      )}
      
      {/* Featured badge */}
      {isFeatured && (
        <div className="absolute top-2 right-2 bg-gradient-to-r from-accent to-accent/90 text-white text-xs font-semibold px-3 py-1 rounded-full z-10">
          Destaque
        </div>
      )}
    </div>
  );
}
