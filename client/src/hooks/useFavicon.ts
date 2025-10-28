import { useEffect, useRef } from "react";
import { useSettings } from "./useSettings";

/**
 * Hook que atualiza dinamicamente o favicon do site
 * baseado no campo "Logotipo do Site (PNG)" das configurações
 */
export function useFavicon() {
  const { logoImage } = useSettings();
  const originalFaviconRef = useRef<{ href: string | null; type: string | null } | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Encontra o elemento link do favicon existente
    let faviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    
    // Captura o favicon original na primeira execução
    if (!isInitializedRef.current && faviconLink) {
      originalFaviconRef.current = {
        href: faviconLink.getAttribute("href"),
        type: faviconLink.getAttribute("type"),
      };
      isInitializedRef.current = true;
    } else if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }

    // Se houver um logoImage configurado, usa ele como favicon
    if (logoImage && logoImage.trim() !== "") {
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }
      faviconLink.type = "image/png";
      faviconLink.href = logoImage;
    } else if (originalFaviconRef.current?.href) {
      // Se não houver logo mas havia um favicon original, restaura ele
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = originalFaviconRef.current.href;
      if (originalFaviconRef.current.type) {
        faviconLink.type = originalFaviconRef.current.type;
      } else {
        faviconLink.removeAttribute("type");
      }
    } else {
      // Se não houver logo nem favicon original, remove o elemento completamente
      // para permitir que o navegador use seu fallback padrão
      if (faviconLink) {
        faviconLink.remove();
      }
    }
  }, [logoImage]);
}
