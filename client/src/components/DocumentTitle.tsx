import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";

export function DocumentTitle() {
  const { companyName } = useSettings();

  useEffect(() => {
    document.title = `${companyName} - Seu imóvel ideal está aqui`;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        `Encontre o imóvel perfeito com a ${companyName}. Casas, apartamentos e terrenos para venda e locação com atendimento personalizado.`
      );
    }
  }, [companyName]);

  return null;
}
