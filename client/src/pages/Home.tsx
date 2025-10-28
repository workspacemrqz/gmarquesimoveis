import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Building2, Home as HomeIcon, MapPin, Search, TrendingUp, Bed, Bath, Maximize2, Mail, Phone, Clock, ArrowRight, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import type { Property, Neighborhood, AboutContent } from "@shared/schema";
import type { CarouselApi } from "@/components/ui/carousel";
import { formatPrice, formatArea, formatPhone } from "@/lib/utils";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSettings } from "@/hooks/useSettings";
import { PriceInput, PhoneInput } from "@/components/ui/masked-input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { PropertyImageWithWatermark } from "@/components/PropertyImageWithWatermark";
import { TypewriterNeighborhoods } from "@/components/TypewriterNeighborhoods";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchType, setSearchType] = useState("");
  const [searchNeighborhood, setSearchNeighborhood] = useState("");
  const [searchMaxPrice, setSearchMaxPrice] = useState<number | undefined>(undefined);
  const [searchLoading, setSearchLoading] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const { companyName, companyPhone, companyEmail, companyAddress } = useSettings();

  // Query for Settings to get background images
  const { data: settingsData = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const { data: featuredPropertiesData } = useQuery({
    queryKey: ["/api/properties", { limit: '6', isFeatured: 'true' }],
    queryFn: async (): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> => {
      const response = await fetch('/api/properties?limit=6&isFeatured=true', { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch featured properties");
      const data = await response.json();
      console.log('Featured properties loaded:', data.properties.length);
      return data;
    },
  });
  const featuredProperties = featuredPropertiesData?.properties || [];

  const { data: neighborhoods = [] } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  // Query for About content
  const { data: aboutContents = [] } = useQuery<AboutContent[]>({
    queryKey: ["/api/about"],
  });
  const companyAbout = aboutContents.find(c => c.section === 'company');

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    if (!carouselApi) return;

    const intervalId = setInterval(() => {
      carouselApi.scrollNext();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [carouselApi]);

  const handleSearch = useCallback(() => {
    setSearchLoading(true);
    const params = new URLSearchParams();
    if (searchType) params.append("propertyType", searchType);
    if (searchNeighborhood) params.append("neighborhoodId", searchNeighborhood);
    if (searchMaxPrice) params.append("maxPrice", searchMaxPrice.toString());
    
    // Usar setTimeout mínimo para garantir que o estado loading seja aplicado antes do redirecionamento
    setTimeout(() => {
      setLocation(`/imoveis?${params.toString()}`);
    }, 0);
  }, [searchType, searchNeighborhood, searchMaxPrice, setLocation]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);

    try {
      const response = await fetch('/api/contact-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          message: contactMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col">
        <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Imagem de fundo da praia */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: settingsData.heroBackgroundImage ? `url(${settingsData.heroBackgroundImage})` : undefined,
          }}
        ></div>
        <div className="container mx-auto max-w-7xl px-4 relative z-10 text-center">
          <motion.h1 
            className="text-2xl sm:text-3xl md:text-6xl font-bold text-white mb-3 drop-shadow-lg" 
            data-testid="text-hero-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span>IMÓVEIS EM{" "}</span>
            <br className="md:hidden" />
            <TypewriterNeighborhoods 
              neighborhoods={neighborhoods.map(n => n.name.toUpperCase())} 
            />
            <span>{" "}E REGIÃO</span>
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl text-white/90 mb-8 drop-shadow-md"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            As melhores oportunidades do<br className="md:hidden" /> Litoral Norte de SP estão aqui!
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            <Card className="max-w-4xl mx-auto shadow-2xl">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue placeholder="Tipo de imóvel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casa">Casa padrão</SelectItem>
                      <SelectItem value="condominio">Casa em condomínio</SelectItem>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={searchNeighborhood} onValueChange={setSearchNeighborhood}>
                    <SelectTrigger data-testid="select-neighborhood">
                      <SelectValue placeholder="Bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {neighborhoods.map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <PriceInput
                    placeholder="Preço máximo"
                    value={searchMaxPrice}
                    onChange={(value) => setSearchMaxPrice(value)}
                    data-testid="input-max-price"
                  />

                  <Button 
                    className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0"
                    onClick={handleSearch}
                    disabled={searchLoading}
                    data-testid="button-search"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <section className="pt-24 pb-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <motion.div 
            className="flex items-center justify-between mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#060606' }} data-testid="text-featured-title">
                Imóveis em Destaque
              </h2>
              <p className="text-muted-foreground">Confira nossas principais ofertas</p>
            </div>
            <Link href="/imoveis">
              <Button variant="outline" className="hidden md:flex" data-testid="link-view-all-properties">
                Ver Todos
              </Button>
            </Link>
          </motion.div>

          {featuredProperties.length === 0 ? (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Nenhum imóvel em destaque no momento.</p>
            </motion.div>
          ) : (
            <motion.div 
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              <button
                type="button"
                className="absolute -left-20 top-1/2 -translate-y-1/2 z-10 hidden md:flex flex-shrink-0 h-12 w-12 rounded-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 items-center justify-center transition-all shadow-lg"
                onClick={() => carouselApi?.scrollPrev()}
                data-testid="button-carousel-previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <Carousel
                setApi={setCarouselApi}
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {featuredProperties.map((property) => (
                    <CarouselItem key={property.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                      <Link href={`/imoveis/${property.slug}`}>
                        <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all cursor-pointer h-full" data-testid={`card-property-${property.id}`}>
                          <PropertyImageWithWatermark
                            src={property.images?.[0]}
                            alt={property.title}
                            isFeatured={true}
                          />
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-lg mb-2 line-clamp-1">{property.title}</h3>
                            <p className="text-2xl font-bold text-accent mb-3">{formatPrice(property.price)}</p>
                            <div className="flex flex-wrap gap-2">
                              {property.bedrooms !== null && property.bedrooms !== undefined && Number(property.bedrooms) > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                  <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                    <Bed className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                  </div>
                                  <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                    {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
                                  </span>
                                </div>
                              )}
                              {property.bathrooms !== null && property.bathrooms !== undefined && Number(property.bathrooms) > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                  <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                    <Bath className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                  </div>
                                  <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                    {property.bathrooms} {property.bathrooms === 1 ? 'banheiro' : 'banheiros'}
                                  </span>
                                </div>
                              )}
                              {property.area !== null && property.area !== undefined && Number(property.area) > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                  <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                    <Maximize2 className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                  </div>
                                  <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                    {formatArea(property.area)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
              
              <button
                type="button"
                className="absolute -right-20 top-1/2 -translate-y-1/2 z-10 hidden md:flex flex-shrink-0 h-12 w-12 rounded-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 items-center justify-center transition-all shadow-lg"
                onClick={() => carouselApi?.scrollNext()}
                data-testid="button-carousel-next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </motion.div>
          )}

          <div className="text-center mt-8 md:hidden">
            <Link href="/imoveis">
              <Button className="w-full max-w-xs" data-testid="link-mobile-view-all">
                Ver Todos os Imóveis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          {neighborhoods.length === 0 ? (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <MapPin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Nenhum bairro cadastrado.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
              {/* Texto à esquerda */}
              <motion.div 
                className="lg:col-span-1"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#060606' }} data-testid="text-neighborhoods-title">
                  Busque Imóveis Por Praia
                </h2>
                <p className="text-muted-foreground text-sm md:text-base">
                  Encontre aqui, os melhores imóveis do litoral norte de São Paulo
                </p>
              </motion.div>

              {/* Grid de cards à direita */}
              <motion.div 
                className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              >
                {(() => {
                  const beachOrder = ['Camburi', 'Baleia', 'Boiçucanga', 'Barra do Sahy'];
                  const orderedBeaches = beachOrder
                    .map(name => neighborhoods.find(n => n.name === name))
                    .filter(Boolean) as Neighborhood[];
                  return orderedBeaches;
                })().map((neighborhood) => (
                  <Link key={neighborhood.id} href={`/bairros/${neighborhood.slug}`}>
                    <div 
                      className="group relative h-80 overflow-hidden rounded-md cursor-pointer transition-transform hover:scale-[1.02]" 
                      data-testid={`card-neighborhood-${neighborhood.id}`}
                    >
                      {/* Imagem de fundo */}
                      {neighborhood.imageUrl ? (
                        <img 
                          src={neighborhood.imageUrl} 
                          alt={neighborhood.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          draggable="false"
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ userSelect: 'none' }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0xNTAgMTIwTDE0MCAxMzBMMjAwIDE5MEwyODAgMTEwTDI2MCA5MEwyMDAgMTUwTDE1MCAxMjBaIiBmaWxsPSIjOWI5Y2EzIi8+CjxjaXJjbGUgY3g9IjI0MCIgY3k9IjEwMCIgcj0iMjAiIGZpbGw9IiM5YjljYTMiLz4KPHJlY3QgeD0iMTcwIiB5PSIxODAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzliOWNhMyIvPgo8cmVjdCB4PSIxODUiIHk9IjIwMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZTVlN2ViIi8+Cjwvc3ZnPg==';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <MapPin className="h-16 w-16 text-primary/30" />
                        </div>
                      )}
                      
                      {/* Overlay escuro */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60"></div>
                      
                      {/* Conteúdo */}
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        {/* Conteúdo superior */}
                        <div className="space-y-3">
                          <p className="text-white/80 text-xs font-medium tracking-wider uppercase">
                            TODOS OS IMÓVEIS
                          </p>
                          <h3 className="text-white font-bold text-2xl md:text-3xl drop-shadow-lg leading-tight">
                            {neighborhood.name}
                          </h3>
                        </div>
                        
                        {/* Botão VER MAIS na parte inferior */}
                        <div className="flex items-center gap-2 text-white font-medium text-sm group-hover:gap-3 transition-all">
                          <span>VER MAIS</span>
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            </div>
          )}

          {/* Botão mobile */}
          <div className="text-center mt-8 lg:hidden">
            <Link href="/bairros">
              <Button className="w-full max-w-xs" data-testid="link-mobile-view-all-neighborhoods">
                Ver Todos os Bairros
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30 overflow-visible">
        <div className="container mx-auto max-w-7xl overflow-visible">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#060606' }} data-testid="text-about-title">
                  {companyAbout?.title || companyName}
                </h2>
                <div className="h-1 w-24 rounded-full" style={{ backgroundColor: '#004274' }}></div>
              </div>
              
              <div className="text-muted-foreground leading-relaxed prose max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground mb-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {companyAbout?.content || `Com anos de experiência no mercado imobiliário, a ${companyName} se destaca pelo atendimento personalizado e compromisso com a satisfação dos clientes.\n\nNossa equipe especializada está pronta para ajudá-lo a encontrar o imóvel ideal, seja para compra ou investimento. Trabalhamos com os melhores imóveis nas melhores localizações de São Paulo.`}
                </ReactMarkdown>
              </div>
              
              <Link href="/sobre" className="hidden md:inline-block">
                <Button className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0" data-testid="link-about-more">
                  <span>Saiba Mais</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              className="relative group"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              <Card className="aspect-square rounded-2xl overflow-hidden shadow-lg border-0">
                <div className="relative w-full h-full">
                  {settingsData.aboutBackgroundImage && (
                    <img 
                      src={settingsData.aboutBackgroundImage} 
                      alt="Imóvel moderno" 
                      className="w-full h-full object-cover"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ userSelect: 'none' }}
                    />
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#060606' }} data-testid="text-contact-title">
              Entre em Contato
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Estamos prontos para atendê-lo e encontrar o imóvel perfeito para você
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden" data-testid="card-contact-info-phone">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <Phone className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">Telefone</h3>
                      <p className="text-muted-foreground mb-2">Ligue para nós</p>
                      <a href={`tel:${companyPhone.replace(/\D/g, '')}`} className="text-accent font-semibold hover:underline text-base md:text-lg">
                        {formatPhone(companyPhone)}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden" data-testid="card-contact-info-email">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <Mail className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">E-mail</h3>
                      <p className="text-muted-foreground mb-2">Envie uma mensagem</p>
                      <a href={`mailto:${companyEmail}`} className="text-accent font-semibold hover:underline text-sm md:text-lg break-all">
                        {companyEmail}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden" data-testid="card-contact-info-address">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <MapPin className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">Localização</h3>
                      <p className="text-muted-foreground mb-2">Visite nosso escritório</p>
                      <p className="text-accent font-semibold text-base md:text-lg">{companyAddress}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/10 via-primary/10 to-transparent rounded-bl-full"></div>
                <CardContent className="p-8 relative">
                  <h3 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: '#060606' }}>Envie uma Mensagem</h3>
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Nome Completo</Label>
                      <Input
                        id="contact-name"
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Digite seu nome"
                        required
                        data-testid="input-home-contact-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-mail</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        data-testid="input-home-contact-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-phone">Telefone</Label>
                      <PhoneInput
                        id="contact-phone"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        required
                        data-testid="input-home-contact-phone"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-message">Mensagem</Label>
                      <Textarea
                        id="contact-message"
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Como podemos ajudá-lo?"
                        rows={5}
                        required
                        data-testid="input-home-contact-message"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0"
                      disabled={contactLoading}
                      data-testid="button-home-submit-contact"
                    >
                      {contactLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Enviando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Enviar Mensagem
                        </span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
