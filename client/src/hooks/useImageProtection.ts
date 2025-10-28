import { useEffect } from 'react';

export function useImageProtection() {
  useEffect(() => {
    // Prevenir clique direito em todas as imagens
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('img')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Prevenir arrastar imagens
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Prevenir seleção de imagens
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };

    // Prevenir salvamento via teclado (Ctrl+S, Cmd+S)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Adicionar event listeners com capture para pegar eventos antes de outros handlers
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('keydown', handleKeyDown, true);

    // Estilos CSS para proteção adicional - removido pointer-events: none para não interferir com a UX
    const style = document.createElement('style');
    style.setAttribute('data-image-protection', 'true');
    style.textContent = `
      img {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        -webkit-user-drag: none !important;
        -khtml-user-drag: none !important;
        -moz-user-drag: none !important;
        -o-user-drag: none !important;
        user-drag: none !important;
      }
      
      /* Prevenir seleção de elementos com imagens de fundo */
      [style*="background-image"] {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      const styleElement = document.querySelector('style[data-image-protection="true"]');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);
}
