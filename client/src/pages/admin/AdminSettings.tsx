import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings, FileText, Phone, Globe, Loader2, Droplet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { AboutContent, InsertAboutContent } from "@shared/schema";
import { insertAboutContentSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import ImageUploadField from "@/components/ImageUploadField";
import { PhoneInput } from "@/components/ui/masked-input";

// Schema for general settings
const generalSettingsSchema = z.object({
  footerText: z.string().min(1, "Texto do rodapé é obrigatório"),
  companyName: z.string().min(1, "Nome da empresa é obrigatório"),
  showCompanyNameInLogo: z.boolean().optional(),
  heroBackgroundImage: z.string().optional(),
  aboutBackgroundImage: z.string().optional(),
  logoImage: z.string().optional(),
});

// Schema for contact settings
const contactSettingsSchema = z.object({
  companyPhone: z.string().min(1, "Telefone é obrigatório"),
  companyEmail: z.string().email("E-mail inválido"),
  companyAddress: z.string().min(1, "Endereço é obrigatório"),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  mapUrl: z.string().optional(),
});

// Schema for watermark settings
const watermarkSettingsSchema = z.object({
  watermarkEnabled: z.boolean().optional(),
  watermarkImage: z.string().optional(),
  watermarkSize: z.number().min(5).max(100),
  watermarkOpacity: z.number().min(0).max(100),
});

type GeneralSettings = z.infer<typeof generalSettingsSchema>;
type ContactSettings = z.infer<typeof contactSettingsSchema>;
type WatermarkSettings = z.infer<typeof watermarkSettingsSchema>;

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");

  // Query for About content
  const { data: aboutContents = [], isLoading: isLoadingAbout } = useQuery<AboutContent[]>({
    queryKey: ["/api/about"],
  });

  // Query for Settings
  const { data: settingsData = {}, isLoading: isLoadingSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const companySection = aboutContents.find(c => c.section === 'company');
  const realtorSection = aboutContents.find(c => c.section === 'realtor');

  // General settings form
  const generalForm = useForm<GeneralSettings>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      footerText: settingsData.footerText || "Seu imóvel ideal está aqui. Atendimento personalizado e os melhores imóveis da região.",
      companyName: settingsData.companyName || "G Marques Imóveis",
      showCompanyNameInLogo: settingsData.showCompanyNameInLogo === "false" ? false : true,
      heroBackgroundImage: settingsData.heroBackgroundImage || "",
      aboutBackgroundImage: settingsData.aboutBackgroundImage || "",
      logoImage: settingsData.logoImage || "",
    },
  });

  // Contact settings form
  const contactForm = useForm<ContactSettings>({
    resolver: zodResolver(contactSettingsSchema),
    defaultValues: {
      companyPhone: settingsData.companyPhone || "(11) 99999-9999",
      companyEmail: settingsData.companyEmail || "contato@gmarquesimoveis.com.br",
      companyAddress: settingsData.companyAddress || "São Paulo, SP",
      whatsapp: settingsData.whatsapp || "(11) 99999-9999",
      instagram: settingsData.instagram || "https://instagram.com/gmarquesimoveis",
      mapUrl: settingsData.mapUrl || "",
    },
  });

  // Watermark settings form
  const watermarkForm = useForm<WatermarkSettings>({
    resolver: zodResolver(watermarkSettingsSchema),
    defaultValues: {
      watermarkEnabled: settingsData.watermarkEnabled === "true",
      watermarkImage: settingsData.watermarkImage || "",
      watermarkSize: Number(settingsData.watermarkSize) || 20,
      watermarkOpacity: Number(settingsData.watermarkOpacity) || 50,
    },
  });

  // About forms (Company and Realtor)
  const companyForm = useForm<InsertAboutContent>({
    resolver: zodResolver(insertAboutContentSchema),
    defaultValues: {
      section: "company",
      title: companySection?.title || "Sobre a Empresa",
      content: companySection?.content || "",
      imageUrl: companySection?.imageUrl || "",
    },
  });

  const realtorForm = useForm<InsertAboutContent>({
    resolver: zodResolver(insertAboutContentSchema),
    defaultValues: {
      section: "realtor",
      title: realtorSection?.title || "Sobre o Corretor",
      content: realtorSection?.content || "",
      imageUrl: realtorSection?.imageUrl || "",
    },
  });

  // Hydrate general form when settings data loads
  useEffect(() => {
    if (!isLoadingSettings && settingsData) {
      generalForm.reset({
        footerText: settingsData.footerText || "Seu imóvel ideal está aqui. Atendimento personalizado e os melhores imóveis da região.",
        companyName: settingsData.companyName || "G Marques Imóveis",
        showCompanyNameInLogo: settingsData.showCompanyNameInLogo === "false" ? false : true,
        heroBackgroundImage: settingsData.heroBackgroundImage || "",
        aboutBackgroundImage: settingsData.aboutBackgroundImage || "",
        logoImage: settingsData.logoImage || "",
      });
    }
  }, [isLoadingSettings, settingsData]);

  // Hydrate contact form when settings data loads
  useEffect(() => {
    if (!isLoadingSettings && settingsData) {
      contactForm.reset({
        companyPhone: settingsData.companyPhone || "(11) 99999-9999",
        companyEmail: settingsData.companyEmail || "contato@gmarquesimoveis.com.br",
        companyAddress: settingsData.companyAddress || "São Paulo, SP",
        whatsapp: settingsData.whatsapp || "(11) 99999-9999",
        instagram: settingsData.instagram || "https://instagram.com/gmarquesimoveis",
        mapUrl: settingsData.mapUrl || "",
      });
    }
  }, [isLoadingSettings, settingsData]);

  // Hydrate watermark form when settings data loads
  useEffect(() => {
    if (!isLoadingSettings && settingsData) {
      watermarkForm.reset({
        watermarkEnabled: settingsData.watermarkEnabled === "true",
        watermarkImage: settingsData.watermarkImage || "",
        watermarkSize: Number(settingsData.watermarkSize) || 20,
        watermarkOpacity: Number(settingsData.watermarkOpacity) || 50,
      });
    }
  }, [isLoadingSettings, settingsData]);

  // Hydrate company form when about contents load
  useEffect(() => {
    if (!isLoadingAbout && companySection) {
      companyForm.reset({
        section: "company",
        title: companySection.title || "Sobre a Empresa",
        content: companySection.content || "",
        imageUrl: companySection.imageUrl || "",
      });
    }
  }, [isLoadingAbout, companySection]);

  // Hydrate realtor form when about contents load
  useEffect(() => {
    if (!isLoadingAbout && realtorSection) {
      realtorForm.reset({
        section: "realtor",
        title: realtorSection.title || "Sobre o Corretor",
        content: realtorSection.content || "",
        imageUrl: realtorSection.imageUrl || "",
      });
    }
  }, [isLoadingAbout, realtorSection]);

  // Mutation for updating About content
  const updateAboutMutation = useMutation({
    mutationFn: async (data: InsertAboutContent) => {
      await apiRequest("POST", "/api/admin/about", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/about"] });
    },
    onError: () => {
      // Error updating content
    },
  });

  // Mutation for general settings
  const updateGeneralSettingsMutation = useMutation({
    mutationFn: async (data: GeneralSettings) => {
      const settings = Object.entries(data).map(([key, value]) => ({
        key,
        value: typeof value === 'boolean' ? String(value) : value,
        description: `Configuração geral: ${key}`,
      }));
      await apiRequest("POST", "/api/admin/settings", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      // Error saving general settings
    },
  });

  // Mutation for contact settings  
  const updateContactSettingsMutation = useMutation({
    mutationFn: async (data: ContactSettings) => {
      const settings = Object.entries(data)
        .filter(([_, value]) => value) // Only save non-empty values
        .map(([key, value]) => ({
          key,
          value,
          description: `Configuração de contato: ${key}`,
        }));
      await apiRequest("POST", "/api/admin/settings", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      // Error saving contact settings
    },
  });

  // Mutation for watermark settings
  const updateWatermarkSettingsMutation = useMutation({
    mutationFn: async (data: WatermarkSettings) => {
      const settings = Object.entries(data).map(([key, value]) => ({
        key,
        value: typeof value === 'boolean' ? String(value) : String(value),
        description: `Configuração de marca d'água: ${key}`,
      }));
      await apiRequest("POST", "/api/admin/settings", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      // Error saving watermark settings
    },
  });

  const onSubmitGeneral = (data: GeneralSettings) => {
    updateGeneralSettingsMutation.mutate(data);
  };

  const onSubmitContact = (data: ContactSettings) => {
    updateContactSettingsMutation.mutate(data);
  };

  const onSubmitWatermark = (data: WatermarkSettings) => {
    updateWatermarkSettingsMutation.mutate(data);
  };

  const onSubmitCompany = async (data: InsertAboutContent) => {
    // Salvar conteúdo do About
    await updateAboutMutation.mutateAsync(data);
    
    // Salvar imagem de fundo se houver
    const aboutBackgroundImage = generalForm.getValues('aboutBackgroundImage');
    if (aboutBackgroundImage) {
      await updateGeneralSettingsMutation.mutateAsync({ 
        ...generalForm.getValues(),
      });
    }
  };

  const onSubmitRealtor = (data: InsertAboutContent) => {
    updateAboutMutation.mutate(data);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie as configurações globais do site
        </p>
      </div>

      <div className="space-y-6">
        <div className="w-full max-w-xs">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger data-testid="select-section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Geral
                </div>
              </SelectItem>
              <SelectItem value="about">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sobre
                </div>
              </SelectItem>
              <SelectItem value="contact">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contato
                </div>
              </SelectItem>
              <SelectItem value="watermark">
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4" />
                  Marca d'água
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab Geral */}
        {activeTab === "general" && (
          <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Configurações Gerais</h2>
                <p className="text-muted-foreground">
                  Informações básicas exibidas em todo o site
                </p>
              </div>

              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(onSubmitGeneral)} className="space-y-4">
                  <FormField
                    control={generalForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome da imobiliária" data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={generalForm.control}
                    name="showCompanyNameInLogo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Adicionar nome ao logo
                          </FormLabel>
                          <FormDescription>
                            Quando ativado, o nome da empresa será exibido ao lado do logo no cabeçalho, rodapé e menu
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-show-company-name"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={generalForm.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Rodapé *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3} 
                            placeholder="Texto exibido no rodapé do site" 
                            data-testid="textarea-footer-text" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={generalForm.control}
                      name="logoImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              value={field.value || ""}
                              onChange={field.onChange}
                              label="Logotipo do Site (PNG)"
                              disabled={updateGeneralSettingsMutation.isPending}
                              uploadEndpoint="/api/admin/upload/background-image"
                              uploadExtraData={{ type: 'logo' }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={generalForm.control}
                      name="heroBackgroundImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              value={field.value || ""}
                              onChange={field.onChange}
                              label="Imagem de Fundo da Página Inicial"
                              disabled={updateGeneralSettingsMutation.isPending}
                              uploadEndpoint="/api/admin/upload/background-image"
                              uploadExtraData={{ type: 'hero' }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateGeneralSettingsMutation.isPending} data-testid="button-save-general">
                      {updateGeneralSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          </div>
        )}

        {/* Tab Sobre */}
        {activeTab === "about" && (
          <div className="space-y-6">
          {isLoadingAbout ? (
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted animate-pulse rounded mb-4" />
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Sobre a Empresa</h2>
                    <p className="text-muted-foreground">
                      Informações exibidas na página "Sobre"
                    </p>
                  </div>
                  
                  <Form {...companyForm}>
                    <form onSubmit={companyForm.handleSubmit(onSubmitCompany)} className="space-y-4">
                      <FormField
                        control={companyForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sobre a Empresa" data-testid="input-about-company-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={companyForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conteúdo *</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={8} placeholder="Conte a história da empresa..." data-testid="textarea-about-company-content" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={generalForm.control}
                          name="aboutBackgroundImage"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <ImageUploadField
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  label="Imagem de Fundo da Seção 'Sobre'"
                                  disabled={updateGeneralSettingsMutation.isPending}
                                  uploadEndpoint="/api/admin/upload/background-image"
                                  uploadExtraData={{ type: 'about' }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={updateAboutMutation.isPending || updateGeneralSettingsMutation.isPending}
                          data-testid="button-save-about-company"
                        >
                          {(updateAboutMutation.isPending || updateGeneralSettingsMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </>
          )}
          </div>
        )}

        {/* Tab Contato */}
        {activeTab === "contact" && (
          <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Configurações de Contato</h2>
                <p className="text-muted-foreground">
                  Informações de contato e redes sociais
                </p>
              </div>

              <Form {...contactForm}>
                <form onSubmit={contactForm.handleSubmit(onSubmitContact)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={contactForm.control}
                      name="companyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <PhoneInput
                              value={field.value || ""}
                              onChange={field.onChange}
                              data-testid="input-company-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contactForm.control}
                      name="companyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="contato@empresa.com.br" data-testid="input-company-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={contactForm.control}
                    name="companyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cidade, Estado" data-testid="input-company-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={contactForm.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp</FormLabel>
                          <FormControl>
                            <PhoneInput
                              value={field.value || ""}
                              onChange={field.onChange}
                              data-testid="input-contact-whatsapp"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>

                  <FormField
                    control={contactForm.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://instagram.com/..." data-testid="input-contact-instagram" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="mapUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Google Maps</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://maps.google.com/..." data-testid="input-contact-map" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateContactSettingsMutation.isPending} data-testid="button-save-contact">
                      {updateContactSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          </div>
        )}

        {/* Tab Marca d'água */}
        {activeTab === "watermark" && (
          <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Configurações de Marca d'água</h2>
                <p className="text-muted-foreground">
                  Configure a marca d'água aplicada nas imagens dos imóveis
                </p>
              </div>

              <Form {...watermarkForm}>
                <form onSubmit={watermarkForm.handleSubmit(onSubmitWatermark)} className="space-y-6">
                  <FormField
                    control={watermarkForm.control}
                    name="watermarkEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Ativar Marca d'água
                          </FormLabel>
                          <FormDescription>
                            Quando ativado, todas as imagens de imóveis terão a marca d'água aplicada
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-watermark-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={watermarkForm.control}
                      name="watermarkImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              value={field.value || ""}
                              onChange={field.onChange}
                              label="Imagem da Marca d'água (PNG com fundo transparente recomendado)"
                              disabled={updateWatermarkSettingsMutation.isPending}
                              uploadEndpoint="/api/admin/upload/watermark-image"
                            />
                          </FormControl>
                          <FormDescription>
                            Envie uma imagem PNG com fundo transparente para melhores resultados
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={watermarkForm.control}
                    name="watermarkSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tamanho da Marca d'água: {field.value}%</FormLabel>
                        <FormControl>
                          <Slider
                            min={5}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            data-testid="slider-watermark-size"
                          />
                        </FormControl>
                        <FormDescription>
                          Ajuste o tamanho da marca d'água em relação à imagem (5% a 100%)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={watermarkForm.control}
                    name="watermarkOpacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opacidade da Marca d'água: {field.value}%</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            data-testid="slider-watermark-opacity"
                          />
                        </FormControl>
                        <FormDescription>
                          Ajuste a opacidade da marca d'água (0% = invisível, 100% = opaco)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateWatermarkSettingsMutation.isPending} data-testid="button-save-watermark">
                      {updateWatermarkSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}