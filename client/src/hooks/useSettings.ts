import { useQuery } from "@tanstack/react-query";

export function useSettings() {
  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  return {
    companyName: settings.companyName || "G Marques Imóveis",
    footerText: settings.footerText || "Seu imóvel ideal está aqui. Atendimento personalizado e os melhores imóveis da região.",
    companyPhone: settings.companyPhone || "(11) 99999-9999",
    companyEmail: settings.companyEmail || "contato@gmarquesimoveis.com.br",
    companyAddress: settings.companyAddress || "São Paulo, SP",
    whatsapp: settings.whatsapp,
    instagram: settings.instagram,
    mapUrl: settings.mapUrl,
    logoImage: settings.logoImage || "",
    showCompanyNameInLogo: settings.showCompanyNameInLogo === "false" ? false : true,
  };
}
