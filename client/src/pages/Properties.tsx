import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Filter, X, Bed, Bath, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import type { Property, Neighborhood } from "@shared/schema";
import { formatPrice, formatArea, getPropertyTypeLabel, getStatusLabel } from "@/lib/utils";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { PropertyImageWithWatermark } from "@/components/PropertyImageWithWatermark";

const ITEMS_PER_PAGE = 12;

interface FilterContentProps {
  filters: {
    propertyType: string;
    neighborhoodId: string;
    minPrice: string;
    maxPrice: string;
    bedrooms: string;
    bathrooms: string;
  };
  tempPriceFilters: {
    minPrice: string;
    maxPrice: string;
  };
  neighborhoods: Neighborhood[];
  updateFilters: (key: string, value: string) => void;
  setTempPriceFilters: React.Dispatch<React.SetStateAction<{ minPrice: string; maxPrice: string }>>;
  applyPriceFilters: () => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  hasPendingPriceFilters: boolean;
  formatCurrency: (value: string) => string;
}

const FilterContent = memo<FilterContentProps>(({
  filters,
  tempPriceFilters,
  neighborhoods,
  updateFilters,
  setTempPriceFilters,
  applyPriceFilters,
  clearFilters,
  hasActiveFilters,
  hasPendingPriceFilters,
  formatCurrency,
}) => {
  if (!filters || !tempPriceFilters) return null;
  
  return (
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium mb-2 block">Tipo de Imóvel</label>
      <Select value={filters.propertyType || "all"} onValueChange={(v) => updateFilters("propertyType", v === "all" ? "" : v)}>
        <SelectTrigger data-testid="filter-type">
          <SelectValue placeholder="Todos os tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          <SelectItem value="casa">Casa padrão</SelectItem>
          <SelectItem value="condominio">Casa em condomínio</SelectItem>
          <SelectItem value="apartamento">Apartamento</SelectItem>
          <SelectItem value="terreno">Terreno</SelectItem>
          <SelectItem value="comercial">Comercial</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="text-sm font-medium mb-2 block">Bairro</label>
      <Select value={filters.neighborhoodId || "all"} onValueChange={(v) => updateFilters("neighborhoodId", v === "all" ? "" : v)}>
        <SelectTrigger data-testid="filter-neighborhood">
          <SelectValue placeholder="Todos os bairros" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os bairros</SelectItem>
          {neighborhoods.map((n) => (
            <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="text-sm font-medium mb-2 block">Preço Mínimo</label>
      <Input
        type="number"
        placeholder="Digite o valor mínimo"
        value={tempPriceFilters.minPrice}
        onChange={(e) => setTempPriceFilters(prev => ({ ...prev, minPrice: e.target.value }))}
        data-testid="filter-min-price"
      />
      {tempPriceFilters.minPrice && (
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(tempPriceFilters.minPrice)}
        </p>
      )}
    </div>

    <div>
      <label className="text-sm font-medium mb-2 block">Preço Máximo</label>
      <Input
        type="number"
        placeholder="Digite o valor máximo"
        value={tempPriceFilters.maxPrice}
        onChange={(e) => setTempPriceFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
        data-testid="filter-max-price"
      />
      {tempPriceFilters.maxPrice && (
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(tempPriceFilters.maxPrice)}
        </p>
      )}
    </div>

    {hasPendingPriceFilters && (
      <Button 
        variant="default" 
        className="w-full" 
        onClick={applyPriceFilters}
        data-testid="button-apply-price-filters"
      >
        Filtrar por Preço
      </Button>
    )}

    <div>
      <label className="text-sm font-medium mb-2 block">Quartos</label>
      <Select value={filters.bedrooms || "all"} onValueChange={(v) => updateFilters("bedrooms", v === "all" ? "" : v)}>
        <SelectTrigger data-testid="filter-bedrooms">
          <SelectValue placeholder="Qualquer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer</SelectItem>
          <SelectItem value="1">1+</SelectItem>
          <SelectItem value="2">2+</SelectItem>
          <SelectItem value="3">3+</SelectItem>
          <SelectItem value="4">4+</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="text-sm font-medium mb-2 block">Banheiros</label>
      <Select value={filters.bathrooms || "all"} onValueChange={(v) => updateFilters("bathrooms", v === "all" ? "" : v)}>
        <SelectTrigger data-testid="filter-bathrooms">
          <SelectValue placeholder="Qualquer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer</SelectItem>
          <SelectItem value="1">1+</SelectItem>
          <SelectItem value="2">2+</SelectItem>
          <SelectItem value="3">3+</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {hasActiveFilters && (
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={clearFilters}
        data-testid="button-clear-filters"
      >
        <X className="h-4 w-4 mr-2" />
        Limpar Filtros
      </Button>
    )}
  </div>
  );
});

export default function Properties() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    propertyType: "",
    neighborhoodId: "",
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
  });
  const [tempPriceFilters, setTempPriceFilters] = useState({
    minPrice: "",
    maxPrice: "",
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const minPrice = params.get("minPrice") || "";
    const maxPrice = params.get("maxPrice") || "";
    const page = params.get("page");
    
    setFilters({
      propertyType: params.get("propertyType") || "",
      neighborhoodId: params.get("neighborhoodId") || "",
      minPrice,
      maxPrice,
      bedrooms: params.get("bedrooms") || "",
      bathrooms: params.get("bathrooms") || "",
    });
    setTempPriceFilters({
      minPrice,
      maxPrice,
    });
    
    if (page) {
      const pageNumber = parseInt(page, 10);
      if (!isNaN(pageNumber) && pageNumber > 0) {
        setCurrentPage(pageNumber);
      }
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/properties", filters, currentPage],
    queryFn: async (): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("page", currentPage.toString());
      params.append("limit", ITEMS_PER_PAGE.toString());
      const url = `/api/properties?${params.toString()}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch properties");
      return response.json();
    },
    placeholderData: (previousData) => previousData, // Mantém dados anteriores enquanto carrega novos no v5
    staleTime: 1000 * 60 * 2, // Propriedades ficam "frescas" por 2 minutos
    gcTime: 1000 * 60 * 10, // Mantém em cache por 10 minutos
  });

  const properties = data?.properties || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  const { data: neighborhoods = [] } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  const updateFilters = useCallback((key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
    
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    setLocation(`/imoveis?${params.toString()}`, { replace: true });
  }, [filters, setLocation]);

  const clearFilters = useCallback(() => {
    setFilters({
      propertyType: "",
      neighborhoodId: "",
      minPrice: "",
      maxPrice: "",
      bedrooms: "",
      bathrooms: "",
    });
    setTempPriceFilters({
      minPrice: "",
      maxPrice: "",
    });
    setCurrentPage(1); // Reset to first page when clearing filters
    setLocation("/imoveis", { replace: true });
  }, [setLocation]);

  const applyPriceFilters = useCallback(() => {
    const newFilters = { 
      ...filters, 
      minPrice: tempPriceFilters.minPrice,
      maxPrice: tempPriceFilters.maxPrice
    };
    setFilters(newFilters);
    setCurrentPage(1);
    
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    setLocation(`/imoveis?${params.toString()}`, { replace: true });
  }, [filters, tempPriceFilters, setLocation]);

  const updatePage = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    if (newPage > 1) {
      params.append("page", newPage.toString());
    }
    setLocation(`/imoveis?${params.toString()}`, { replace: true });
  }, [filters, setLocation]);

  const formatCurrency = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const amount = parseInt(numbers, 10);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const parseCurrency = (value: string): string => {
    return value.replace(/\D/g, '');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");
  const hasPendingPriceFilters = tempPriceFilters.minPrice !== filters.minPrice || tempPriceFilters.maxPrice !== filters.maxPrice;

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#060606' }} data-testid="text-page-title">
              Nossos Imóveis
            </h1>
          </motion.div>

          <div className="flex gap-6">
            <motion.aside 
              className="hidden lg:block w-64 flex-shrink-0"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
              <Card className="sticky top-20">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros
                  </h2>
                  <FilterContent
                    filters={filters}
                    tempPriceFilters={tempPriceFilters}
                    neighborhoods={neighborhoods}
                    updateFilters={updateFilters}
                    setTempPriceFilters={setTempPriceFilters}
                    applyPriceFilters={applyPriceFilters}
                    clearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    hasPendingPriceFilters={hasPendingPriceFilters}
                    formatCurrency={formatCurrency}
                  />
                </CardContent>
              </Card>
            </motion.aside>

            <div className="flex-1">
              <div className="lg:hidden mb-4">
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-open-filters">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros {hasActiveFilters && `(${Object.values(filters).filter(v => v).length})`}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>Filtros</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterContent
                        filters={filters}
                        tempPriceFilters={tempPriceFilters}
                        neighborhoods={neighborhoods}
                        updateFilters={updateFilters}
                        setTempPriceFilters={setTempPriceFilters}
                        applyPriceFilters={applyPriceFilters}
                        clearFilters={clearFilters}
                        hasActiveFilters={hasActiveFilters}
                        hasPendingPriceFilters={hasPendingPriceFilters}
                        formatCurrency={formatCurrency}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {!isLoading && properties.length > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property, index) => (
                      <motion.div
                        key={property.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
                      >
                        <Link href={`/imoveis/${property.slug}`}>
                          <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all cursor-pointer h-full" data-testid={`card-property-${property.id}`}>
                            <PropertyImageWithWatermark 
                              src={property.images?.[0]} 
                              alt={property.title}
                              isFeatured={property.isFeatured || undefined}
                            />
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground mb-1">{getPropertyTypeLabel(property.propertyType)}</p>
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
                      </motion.div>
                    ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Info text */}
                    <p className="text-sm text-muted-foreground">
                      Mostrando {properties.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, total)} de {total} imóveis
                    </p>
                    
                    {/* Pagination controls */}
                    <div className="flex items-center gap-2">
                      {/* Previous button */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updatePage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Page numbers - desktop */}
                      <div className="hidden sm:flex items-center gap-1">
                        {getPageNumbers().map((page, index) => (
                          <div key={index}>
                            {page === '...' ? (
                              <span className="px-3 py-2">...</span>
                            ) : (
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => updatePage(page as number)}
                                className="min-w-[40px]"
                                data-testid={`button-page-${page}`}
                              >
                                {page}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Page numbers - mobile */}
                      <div className="flex sm:hidden items-center gap-2">
                        <span className="text-sm">
                          Página {currentPage} de {totalPages}
                        </span>
                      </div>
                      
                      {/* Next button */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updatePage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
