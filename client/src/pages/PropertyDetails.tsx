import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Building2, 
  Bed, 
  Bath, 
  Car, 
  Maximize2, 
  Share2, 
  Phone, 
  ArrowLeft,
  MapPin,
  Home,
  Info,
  Check,
  CheckCircle2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Expand
} from "lucide-react";
import { Link, useRoute } from "wouter";
import type { Property, Neighborhood } from "@shared/schema";
import { formatPrice, formatArea, getPropertyTypeLabel, getStatusLabel } from "@/lib/utils";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useState, useEffect } from "react";
import { PropertyImageWithWatermark } from "@/components/PropertyImageWithWatermark";

export default function PropertyDetails() {
  const [, params] = useRoute("/imoveis/:id");
  const propertyId = params?.id;
  const [selectedImage, setSelectedImage] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [slideInterval, setSlideInterval] = useState(5000); // Intervalo padrão de 5 segundos
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: [`/api/properties/${propertyId}`],
    enabled: !!propertyId,
  });

  const { data: similarProperties = [] } = useQuery<Property[]>({
    queryKey: [`/api/properties/${propertyId}/similar`],
    enabled: !!propertyId,
  });

  const { data: neighborhood } = useQuery<Neighborhood>({
    queryKey: [`/api/neighborhoods/id/${property?.neighborhoodId}`],
    enabled: !!property?.neighborhoodId,
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['/api/settings'],
  });

  // Controle do slideshow automático
  useEffect(() => {
    if (!isAutoPlay || !property?.images || property.images.length <= 1) return;

    const interval = setInterval(() => {
      setSelectedImage((prev) => (prev + 1) % property.images!.length);
    }, slideInterval);

    return () => clearInterval(interval);
  }, [isAutoPlay, property?.images, slideInterval]);

  // Controle de navegação com teclado no modal
  useEffect(() => {
    if (!isImageModalOpen || !property?.images) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePreviousImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'Escape') {
        setIsImageModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isImageModalOpen, modalImageIndex, property?.images]);

  const handleOpenImageModal = (index: number) => {
    setModalImageIndex(index);
    setIsImageModalOpen(true);
    setIsAutoPlay(false); // Para o slideshow ao abrir o modal
  };

  const handlePreviousImage = () => {
    if (!property?.images) return;
    setModalImageIndex((prev) => 
      prev === 0 ? property.images!.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (!property?.images) return;
    setModalImageIndex((prev) => 
      (prev + 1) % property.images!.length
    );
  };

  // Funções para swipe gesture no mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextImage();
    }
    if (isRightSwipe) {
      handlePreviousImage();
    }

    // Reset
    setTouchStart(0);
    setTouchEnd(0);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: property?.title,
        text: `Confira este imóvel: ${property?.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copiado para a área de transferência!");
    }
  };

  const images = property?.images && property.images.length > 0 ? property.images : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      {!isLoading && property && (
      <>
      <div className="flex-1">
        {/* Navegação */}
        <div className="border-b">
          <div className="container mx-auto max-w-7xl px-3 md:px-4 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2">
              <Link href="/imoveis">
                <Button 
                  className="bg-gradient-to-r from-accent to-accent/90 text-white border-0 text-sm md:text-base"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
                  Voltar
                </Button>
              </Link>
              
              <Button 
                variant="outline"
                className="lg:hidden text-sm md:text-base"
                onClick={handleShare}
                data-testid="button-share-mobile"
              >
                <Share2 className="h-4 w-4 mr-1 md:mr-2" />
                Compartilhar
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-7xl px-3 md:px-4 py-4 md:py-8">
          {/* Galeria e Sidebar de Ações */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            {/* Galeria de Imagens */}
            <div className="lg:col-span-2">
              {/* Imagem Principal com animação */}
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden relative flex group">
                {images.length > 0 && (
                  <div className="relative w-full h-full">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`absolute inset-0 transition-transform duration-700 ease-in-out ${
                          idx === selectedImage 
                            ? 'translate-x-0' 
                            : idx < selectedImage 
                            ? '-translate-x-full' 
                            : 'translate-x-full'
                        }`}
                      >
                        <button
                          onClick={() => handleOpenImageModal(idx)}
                          className="w-full h-full cursor-pointer"
                          data-testid={`button-main-image-${idx}`}
                        >
                          <img 
                            src={img.includes('.webp') ? img.replace(/(\.[^.]+)$/, '_medium$1') : img}
                            srcSet={img.includes('.webp') ? `${img.replace(/(\.[^.]+)$/, '_thumb$1')} 400w, ${img.replace(/(\.[^.]+)$/, '_medium$1')} 800w, ${img} 1920w` : undefined}
                            sizes={img.includes('.webp') ? "(max-width: 1024px) 100vw, 66vw" : undefined}
                            alt={property.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            draggable="false"
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                            style={{ userSelect: 'none' }}
                            onError={(e) => {
                              // Fallback to original if optimized version fails
                              const target = e.target as HTMLImageElement;
                              if (target.src !== img) {
                                target.src = img;
                                target.srcset = '';
                              }
                            }}
                          />
                        </button>
                      </div>
                    ))}
                    
                    {/* Watermark overlay - positioned relative to CONTAINER, not image */}
                    {settings?.watermarkEnabled === 'true' && settings?.watermarkImage && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                          opacity: settings.watermarkOpacity ? parseInt(settings.watermarkOpacity) / 100 : 0.3,
                        }}
                      >
                        <img
                          src={settings.watermarkImage}
                          alt="Marca d'água"
                          className="object-contain"
                          draggable="false"
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          style={{
                            width: `${settings.watermarkSize ? parseInt(settings.watermarkSize) : 20}%`,
                            maxWidth: '100%',
                            maxHeight: '100%',
                            userSelect: 'none',
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Setas de navegação */}
                    {images.length > 1 && (
                      <>
                        {/* Seta Anterior */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage((prev) => prev === 0 ? images.length - 1 : prev - 1);
                            setIsAutoPlay(false);
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/70 hover:scale-110 z-10"
                          data-testid="button-prev-main-image"
                        >
                          <ChevronLeft className="h-6 w-6 text-white" />
                        </button>

                        {/* Seta Próxima */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage((prev) => (prev + 1) % images.length);
                            setIsAutoPlay(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/70 hover:scale-110 z-10"
                          data-testid="button-next-main-image"
                        >
                          <ChevronRight className="h-6 w-6 text-white" />
                        </button>
                      </>
                    )}
                    
                    {/* Ícone de expandir no canto superior direito */}
                    <button
                      onClick={() => handleOpenImageModal(selectedImage)}
                      className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70 z-10"
                      data-testid="button-expand-image"
                    >
                      <Expand className="h-5 w-5 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar com ações - Desktop apenas */}
            <div className="hidden lg:block space-y-4 md:space-y-6 lg:sticky lg:top-4">
              <Card style={{ backgroundColor: '#FFFFFF' }}>
                <CardHeader>
                  <CardTitle className="text-foreground">Interessado?</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Entre em contato com nossa equipe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full bg-gradient-to-r from-accent to-accent/90 text-white border-0"
                    size="lg"
                    onClick={() => window.open(`https://wa.me/5511999999999?text=Olá, tenho interesse no imóvel: ${property.title}`, '_blank')}
                    data-testid="button-whatsapp"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleShare}
                    data-testid="button-share-card"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                </CardContent>
              </Card>

              {property.neighborhoodId && neighborhood && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Explorar o Bairro</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/imoveis?neighborhoodId=${property.neighborhoodId}`}>
                      <Button variant="outline" className="w-full" data-testid="button-neighborhood-properties">
                        <MapPin className="h-4 w-4 mr-2" />
                        Ver mais imóveis neste bairro
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Controle de Slideshow */}
              {images.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Apresentação de Slides</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant={isAutoPlay ? "secondary" : "outline"}
                      className="w-full"
                      onClick={() => setIsAutoPlay(!isAutoPlay)}
                      data-testid="button-slideshow"
                    >
                      {isAutoPlay ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar Slides
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Slides Automáticos
                        </>
                      )}
                    </Button>
                    
                    {/* Botões de controle de intervalo */}
                    <div className="mt-3">
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                        <Button
                          variant={slideInterval === 5000 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSlideInterval(5000)}
                          data-testid="button-interval-5s"
                        >
                          5s
                        </Button>
                        <Button
                          variant={slideInterval === 10000 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSlideInterval(10000)}
                          data-testid="button-interval-10s"
                        >
                          10s
                        </Button>
                        <Button
                          variant={slideInterval === 20000 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSlideInterval(20000)}
                          data-testid="button-interval-20s"
                        >
                          20s
                        </Button>
                        <Button
                          variant={slideInterval === 60000 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSlideInterval(60000)}
                          data-testid="button-interval-1min"
                        >
                          1min
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Miniaturas - Ocupa toda a largura */}
          {images.length > 1 && (
            <div className="mb-6 md:mb-8">
              <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImage(idx);
                      setIsAutoPlay(false); // Para o slideshow quando o usuário clica manualmente
                    }}
                    className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg overflow-hidden border-2 hover-elevate transition-all ${
                      selectedImage === idx ? 'border-accent' : 'border-transparent'
                    }`}
                    data-testid={`button-thumb-${idx}`}
                  >
                    <img 
                      src={img.includes('.webp') ? img.replace(/(\.[^.]+)$/, '_thumb$1') : img}
                      alt="" 
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ userSelect: 'none' }}
                      onError={(e) => {
                        // Fallback to original if thumbnail fails
                        const target = e.target as HTMLImageElement;
                        if (target.src !== img) {
                          target.src = img;
                        }
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Informações do Imóvel */}
          <div className="space-y-4 md:space-y-6">
              {/* Informações Principais */}
              <Card>
                <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs md:text-sm">
                            {getPropertyTypeLabel(property.propertyType)}
                          </Badge>
                          <Badge className="bg-gradient-to-r from-primary to-primary/90 text-white text-xs md:text-sm">
                            {getStatusLabel(property.status)}
                          </Badge>
                        </div>
                        <CardTitle className="text-2xl md:text-3xl mb-2" data-testid="text-property-title">
                          {property.title}
                        </CardTitle>
                        {neighborhood && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">Bairro: {neighborhood.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl md:text-4xl font-bold text-accent" data-testid="text-property-price">
                        {formatPrice(property.price)}
                      </span>
                      {property.status === 'aluguel' && (
                        <span className="text-muted-foreground text-sm md:text-base">/mês</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <Separator />
                
                <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
                  {/* Características Principais */}
                  <div className="flex flex-wrap gap-3 md:gap-4 mb-6">
                    {property.bedrooms != null && Number(property.bedrooms) > 0 && (
                      <Card className="shadow-none bg-muted/50 border border-border flex-1 min-w-[140px]">
                        <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                          <div className="p-1.5 md:p-2 bg-background rounded-lg flex-shrink-0">
                            <Bed className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl md:text-2xl font-bold truncate">{property.bedrooms}</p>
                            <p className="text-xs text-muted-foreground">Quartos</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {property.bathrooms != null && Number(property.bathrooms) > 0 && (
                      <Card className="shadow-none bg-muted/50 border border-border flex-1 min-w-[140px]">
                        <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                          <div className="p-1.5 md:p-2 bg-background rounded-lg flex-shrink-0">
                            <Bath className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl md:text-2xl font-bold truncate">{property.bathrooms}</p>
                            <p className="text-xs text-muted-foreground">Banheiros</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {property.parkingSpaces != null && Number(property.parkingSpaces) > 0 && (
                      <Card className="shadow-none bg-muted/50 border border-border flex-1 min-w-[140px]">
                        <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                          <div className="p-1.5 md:p-2 bg-background rounded-lg flex-shrink-0">
                            <Car className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl md:text-2xl font-bold truncate">{property.parkingSpaces}</p>
                            <p className="text-xs text-muted-foreground">Vagas</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {property.area && Number(property.area) > 0 && (
                      <Card className="shadow-none bg-muted/50 border border-border flex-1 min-w-[140px]">
                        <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                          <div className="p-1.5 md:p-2 bg-background rounded-lg flex-shrink-0">
                            <Home className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl md:text-2xl font-bold truncate">{formatArea(property.area)}</p>
                            <p className="text-xs text-muted-foreground">Área</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {property.landArea && Number(property.landArea) > 0 && (
                      <Card className="shadow-none bg-muted/50 border border-border flex-1 min-w-[140px]">
                        <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                          <div className="p-1.5 md:p-2 bg-background rounded-lg flex-shrink-0">
                            <Maximize2 className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl md:text-2xl font-bold truncate">{formatArea(property.landArea)}</p>
                            <p className="text-xs text-muted-foreground">Área do Terreno</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Descrição */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Sobre este imóvel</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {property.description}
                  </p>
                </CardContent>
              </Card>

              {/* Comodidades */}
              {property.amenities && property.amenities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Comodidades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      {property.amenities?.map((amenity, idx) => (
                        <div key={idx}>
                          <div
                            className="flex items-center gap-3 py-4 group"
                            data-testid={`amenity-${idx}`}
                          >
                            <div className="p-1.5 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors">
                              <CheckCircle2 className="h-5 w-5 text-accent" />
                            </div>
                            <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                              {amenity}
                            </span>
                          </div>
                          {idx < (property.amenities?.length ?? 0) - 1 && (
                            <Separator className="bg-border/50" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cards de Ação - Mobile apenas */}
              <div className="lg:hidden space-y-4">
                <Card style={{ backgroundColor: '#FFFFFF' }}>
                  <CardHeader>
                    <CardTitle className="text-foreground">Interessado?</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Entre em contato com nossa equipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full bg-gradient-to-r from-accent to-accent/90 text-white border-0"
                      size="lg"
                      onClick={() => window.open(`https://wa.me/5511999999999?text=Olá, tenho interesse no imóvel: ${property.title}`, '_blank')}
                      data-testid="button-whatsapp-mobile"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleShare}
                      data-testid="button-share-card-mobile"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Compartilhar
                    </Button>
                  </CardContent>
                </Card>

                {property.neighborhoodId && neighborhood && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Explorar o Bairro</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/imoveis?neighborhoodId=${property.neighborhoodId}`}>
                        <Button variant="outline" className="w-full" data-testid="button-neighborhood-properties-mobile">
                          <MapPin className="h-4 w-4 mr-2" />
                          Ver mais imóveis neste bairro
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
          </div>

          {/* Imóveis Similares */}
          {similarProperties.length > 0 && (
            <div className="mt-8 md:mt-12">
              <Separator className="mb-6 md:mb-8" />
              
              <div className="space-y-4 md:space-y-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2">Imóveis Similares</h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Outras opções que podem te interessar
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {similarProperties.slice(0, 3).map((similar) => (
                    <Link key={similar.id} href={`/imoveis/${similar.slug}`}>
                      <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all cursor-pointer h-full" data-testid={`card-similar-${similar.id}`}>
                        <PropertyImageWithWatermark 
                          src={similar.images?.[0]} 
                          alt={similar.title}
                          isFeatured={similar.isFeatured || undefined}
                        />
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">{getPropertyTypeLabel(similar.propertyType)}</p>
                          <h3 className="font-semibold text-lg mb-2 line-clamp-1">{similar.title}</h3>
                          <p className="text-2xl font-bold text-accent mb-3">{formatPrice(similar.price)}</p>
                          <div className="flex flex-wrap gap-2">
                            {similar.bedrooms !== null && similar.bedrooms !== undefined && Number(similar.bedrooms) > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                  <Bed className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                </div>
                                <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                  {similar.bedrooms} {similar.bedrooms === 1 ? 'quarto' : 'quartos'}
                                </span>
                              </div>
                            )}
                            {similar.bathrooms !== null && similar.bathrooms !== undefined && Number(similar.bathrooms) > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                  <Bath className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                </div>
                                <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                  {similar.bathrooms} {similar.bathrooms === 1 ? 'banheiro' : 'banheiros'}
                                </span>
                              </div>
                            )}
                            {similar.area !== null && similar.area !== undefined && Number(similar.area) > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                                <div className="p-0.5 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                  <Maximize2 className="h-3 w-3 text-[#bc974e] dark:text-[#d4ae6a]" />
                                </div>
                                <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                  {formatArea(similar.area)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Visualização de Imagens */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-full w-screen h-screen p-0 overflow-hidden bg-black/98 backdrop-blur-sm border-0 rounded-none">
          {/* Título e descrição ocultos para acessibilidade */}
          <DialogTitle className="sr-only">
            Visualização de Imagens - {property?.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Use as setas do teclado ou arraste para navegar entre as imagens. Pressione ESC para fechar.
          </DialogDescription>
          <div className="relative w-full h-full flex flex-col">
            {/* Header com botão fechar - altura fixa */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-16 bg-gradient-to-b from-black/60 to-transparent">
              <div className="text-white/90 text-sm font-medium truncate max-w-[60%]">
                {property?.title}
              </div>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 flex-shrink-0"
                data-testid="button-close-modal"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Área da imagem - altura calculada considerando header (64px) e footer (80px) */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{
                paddingTop: '64px',
                paddingBottom: '80px',
                paddingLeft: '16px',
                paddingRight: '16px'
              }}
            >
              {images.length > 0 && (
                <div 
                  className="relative w-full h-full flex items-center justify-center"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img 
                    src={images[modalImageIndex]} 
                    alt={`${property.title} - Imagem ${modalImageIndex + 1}`}
                    className="w-full h-full object-contain"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                  
                  {/* Watermark overlay in modal */}
                  {settings?.watermarkEnabled === 'true' && settings?.watermarkImage && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{
                        opacity: settings.watermarkOpacity ? parseInt(settings.watermarkOpacity) / 100 : 0.3,
                      }}
                    >
                      <img
                        src={settings.watermarkImage}
                        alt="Marca d'água"
                        className="object-contain"
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        style={{
                          width: `${settings.watermarkSize ? parseInt(settings.watermarkSize) : 20}%`,
                          maxWidth: '100%',
                          maxHeight: '100%',
                          userSelect: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controles de navegação - setas modernas */}
            {images.length > 1 && (
              <>
                {/* Botão Anterior */}
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md border border-white/30 hover:from-white/30 hover:to-white/20 hover:border-white/40 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl z-40 group"
                  data-testid="button-previous-image"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-md group-hover:drop-shadow-lg transition-all" strokeWidth={2.5} />
                </button>

                {/* Botão Próximo */}
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md border border-white/30 hover:from-white/30 hover:to-white/20 hover:border-white/40 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl z-40 group"
                  data-testid="button-next-image"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-md group-hover:drop-shadow-lg transition-all" strokeWidth={2.5} />
                </button>
              </>
            )}

            {/* Footer com contador - altura fixa */}
            <div className="absolute bottom-0 left-0 right-0 z-50 h-20 bg-gradient-to-t from-black/60 to-transparent">
              <div className="px-4 sm:px-6 py-4 sm:py-5">
                {/* Contador centralizado */}
                <div className="flex items-center justify-center">
                  <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                    <span className="text-white text-sm font-medium">
                      {modalImageIndex + 1} de {images.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
      </>
      )}
      <Footer />
    </div>
  );
}