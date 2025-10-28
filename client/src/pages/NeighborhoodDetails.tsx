import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, ArrowLeft, Bed, Bath, Maximize2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import type { Neighborhood, Property } from "@shared/schema";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { formatPrice, formatArea } from "@/lib/utils";
import { PropertyImageWithWatermark } from "@/components/PropertyImageWithWatermark";

export default function NeighborhoodDetails() {
  const [, params] = useRoute("/bairros/:slug");
  const slug = params?.slug;

  const { data: neighborhood, isLoading, error } = useQuery<Neighborhood>({
    queryKey: [`/api/neighborhoods/${slug}`],
    enabled: !!slug,
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: [`/api/neighborhoods/${slug}/properties`],
    enabled: !!slug,
  });

  if (!slug) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1">
          <div className="container mx-auto max-w-7xl px-4 py-8">
            <Link href="/bairros">
              <Button className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 mb-4" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para bairros
              </Button>
            </Link>
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Bairro não encontrado</h2>
                <p className="text-muted-foreground">O bairro que você está procurando não foi encontrado.</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading && !neighborhood) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!neighborhood) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1">
          <div className="container mx-auto max-w-7xl px-4 py-8">
            <Link href="/bairros">
              <Button className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 mb-4" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para bairros
              </Button>
            </Link>
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Bairro não encontrado</h2>
                <p className="text-muted-foreground">O bairro que você está procurando não foi encontrado.</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <Link href="/bairros">
            <Button className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para bairros
            </Button>
          </Link>

          <div className="aspect-[21/9] bg-muted rounded-lg overflow-hidden mb-8 relative">
            {neighborhood.imageUrl && (
              <img 
                src={neighborhood.imageUrl} 
                alt={neighborhood.name}
                className="w-full h-full object-cover"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                style={{ userSelect: 'none' }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end">
              <div className="p-8 w-full">
                <h1 className="text-white font-bold text-4xl md:text-5xl drop-shadow-lg" data-testid="text-neighborhood-name">
                  {neighborhood.name}
                </h1>
              </div>
            </div>
          </div>

          {neighborhood.description && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4">Sobre o Bairro</h2>
                <p className="text-muted-foreground whitespace-pre-wrap max-w-prose">
                  {neighborhood.description}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">
              Imóveis em {neighborhood.name}
            </h2>
            <Link href={`/imoveis?neighborhoodId=${neighborhood.id}`}>
              <Button 
                className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0 w-full md:w-auto"
                data-testid="button-view-all-properties"
              >
                Ver Todos os Imóveis
              </Button>
            </Link>
          </div>

          {properties.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.slice(0, 6).map((property) => (
                <Link key={property.id} href={`/imoveis/${property.slug}`}>
                  <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all cursor-pointer h-full" data-testid={`card-property-${property.id}`}>
                    <PropertyImageWithWatermark
                      src={property.images?.[0]}
                      alt={property.title}
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
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
