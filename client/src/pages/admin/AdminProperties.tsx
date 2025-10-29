import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Edit, Trash2, X, Sparkles, Image as ImageIcon, Filter, ChevronLeft, ChevronRight, Loader2, ArrowUp, ArrowDown, GripVertical, Save, Bed, Bath, Maximize2 } from "lucide-react";
import { useState, useEffect, useCallback, memo, useRef } from "react";
import PropertyImageUpload, { PropertyImage } from "@/components/PropertyImageUpload";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Property, Neighborhood, InsertProperty } from "@shared/schema";
import { insertPropertySchema } from "@shared/schema";
import { formatPrice, formatArea, getPropertyTypeLabel } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PriceInput, AreaInput } from "@/components/ui/masked-input";
import AIPropertyDialog from "@/components/AIPropertyDialog";
import type { PropertyExtraction } from "@/components/types";
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

export default function AdminProperties() {
  const titleRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [newAmenity, setNewAmenity] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [propertyImages, setPropertyImages] = useState<PropertyImage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [orderedProperties, setOrderedProperties] = useState<Property[]>([]);
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

  const { data, isLoading, isFetching } = useQuery({
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
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const properties = data?.properties || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  const { data: neighborhoods = [] } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  // Fetch all properties without filters to calculate global position
  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties", "all"],
    queryFn: async () => {
      const response = await fetch("/api/properties?paginated=false");
      if (!response.ok) throw new Error("Failed to fetch all properties");
      return response.json();
    },
  });

  const updateFilters = useCallback((key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setCurrentPage(1);
  }, [filters]);

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
    setCurrentPage(1);
  }, []);

  const applyPriceFilters = useCallback(() => {
    const newFilters = { 
      ...filters, 
      minPrice: tempPriceFilters.minPrice,
      maxPrice: tempPriceFilters.maxPrice
    };
    setFilters(newFilters);
    setCurrentPage(1);
  }, [filters, tempPriceFilters]);

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

  const hasActiveFilters = Object.values(filters).some(v => v !== "");
  const hasPendingPriceFilters = tempPriceFilters.minPrice !== filters.minPrice || tempPriceFilters.maxPrice !== filters.maxPrice;

  // Initialize orderedProperties when entering order mode
  useEffect(() => {
    if (isOrderMode && properties.length > 0) {
      setOrderedProperties([...properties]);
    }
  }, [isOrderMode, properties]);

  useEffect(() => {
    // Skip scroll on first render, only scroll when page actually changes
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Scroll to title when page changes
    if (titleRef.current) {
      titleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

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

  const form = useForm<InsertProperty>({
    resolver: zodResolver(insertPropertySchema.omit({ images: true })),
    defaultValues: {
      title: "",
      description: "",
      propertyType: "casa",
      status: "venda",
      price: "",
      bedrooms: 0,
      bathrooms: 0,
      parkingSpaces: 0,
      area: "",
      landArea: "",
      neighborhoodId: "",
      isFeatured: false,
      amenities: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/properties", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      form.reset();
      setPropertyImages([]);
    },
    onError: () => {
      // Error creating property
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      await apiRequest("PATCH", `/api/admin/properties/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setDialogOpen(false);
      setEditingProperty(null);
      form.reset();
      setPropertyImages([]);
    },
    onError: () => {
      // Error updating property
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      const updates = orderedProperties.map((property, index) => ({
        id: property.id,
        displayOrder: orderedProperties.length - index - 1
      }));
      await apiRequest("POST", "/api/admin/properties/bulk-order", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setIsOrderMode(false);
    },
    onError: () => {
      // Error updating property order
    },
  });

  const moveProperty = (index: number, direction: "up" | "down") => {
    const newProperties = [...orderedProperties];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newProperties.length) return;
    
    [newProperties[index], newProperties[newIndex]] = [newProperties[newIndex], newProperties[index]];
    setOrderedProperties(newProperties);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/properties/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => {
      // Error deleting property
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/properties/${id}/toggle-active`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    },
    onError: () => {
      // Error toggling property active status
    },
  });

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    
    // Convert existing images to PropertyImage format
    const existingImages: PropertyImage[] = (property.images || []).map((url, index) => ({
      id: `existing-${index}`,
      url,
      preview: url,
      isNew: false
    }));
    setPropertyImages(existingImages);
    
    form.reset({
      title: property.title,
      description: property.description,
      propertyType: property.propertyType,
      status: property.status,
      price: property.price,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      parkingSpaces: property.parkingSpaces || 0,
      area: property.area || "",
      landArea: property.landArea || "",
      neighborhoodId: property.neighborhoodId || "",
      isFeatured: property.isFeatured || false,
      amenities: property.amenities || [],
    });
    setDialogOpen(true);
  };

  const handleAIExtractSuccess = (extractedData: PropertyExtraction) => {
    // Find neighborhood by name if provided
    let neighborhoodId = "";
    if (extractedData.neighborhoodName) {
      const matchedNeighborhood = neighborhoods.find(
        n => n.name.toLowerCase().includes(extractedData.neighborhoodName!.toLowerCase())
      );
      if (matchedNeighborhood) {
        neighborhoodId = matchedNeighborhood.id;
      }
    }

    // Initialize with empty images - user will add them manually in the form
    setPropertyImages([]);

    // Populate form with extracted data
    form.reset({
      title: extractedData.title,
      description: extractedData.description,
      propertyType: extractedData.propertyType,
      status: "venda",
      price: extractedData.price,
      bedrooms: extractedData.bedrooms || 0,
      bathrooms: extractedData.bathrooms || 0,
      parkingSpaces: extractedData.parkingSpaces || 0,
      area: extractedData.area || "",
      neighborhoodId,
      isFeatured: false,
      amenities: extractedData.amenities || [],
    });

    // Close AI dialog and open regular dialog
    setAiDialogOpen(false);
    setDialogOpen(true);
  };

  const handleAddAmenity = () => {
    if (newAmenity.trim()) {
      const currentAmenities = form.getValues("amenities") || [];
      form.setValue("amenities", [...currentAmenities, newAmenity.trim()]);
      setNewAmenity("");
    }
  };

  const handleRemoveAmenity = (index: number) => {
    const currentAmenities = form.getValues("amenities") || [];
    form.setValue("amenities", currentAmenities.filter((_, i) => i !== index));
  };


  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sanitizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with dashes
      .replace(/-+/g, '-') // Remove consecutive dashes
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .slice(0, 50); // Limit length
  };

  const onSubmit = async (data: any) => {
    // Convert empty strings to null for all fields
    const baseData = { 
      ...data, 
      status: 'venda' as const,
      neighborhoodId: data.neighborhoodId && data.neighborhoodId.trim() !== '' ? data.neighborhoodId : null,
      // Convert empty numeric fields to null
      price: data.price && data.price.toString().trim() !== '' ? data.price : null,
      area: data.area && data.area.toString().trim() !== '' ? data.area : null,
      landArea: data.landArea && data.landArea.toString().trim() !== '' ? data.landArea : null,
      bedrooms: data.bedrooms !== '' && data.bedrooms !== null && data.bedrooms !== undefined ? data.bedrooms : 0,
      bathrooms: data.bathrooms !== '' && data.bathrooms !== null && data.bathrooms !== undefined ? data.bathrooms : 0,
      parkingSpaces: data.parkingSpaces !== '' && data.parkingSpaces !== null && data.parkingSpaces !== undefined ? data.parkingSpaces : 0,
    };
    
    // Prepare images for upload with property title as folder name
    const propertyFolder = sanitizeTitle(data.title);
    const imagesToUpload: any[] = [];
    
    for (const img of propertyImages) {
      if (img.isNew && img.file) {
        // New image to upload
        const base64Data = await fileToBase64(img.file);
        imagesToUpload.push({
          base64Data,
          filename: img.file.name
        });
      } else if (!img.isNew && img.url) {
        // Existing image URL
        imagesToUpload.push(img.url);
      }
    }
    
    const propertyData = {
      ...baseData,
      images: imagesToUpload,
      propertyFolder
    };
    
    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, data: propertyData });
    } else {
      createMutation.mutate(propertyData);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8" ref={titleRef}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
              Gerenciar Imóveis
            </h1>
            <p className="text-muted-foreground">{total} imóveis</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto lg:hidden" data-testid="button-open-filters">
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
            {!isOrderMode ? (
              <Button 
                onClick={() => setIsOrderMode(true)}
                disabled={properties.length === 0}
                className="w-full sm:w-auto"
                data-testid="button-order-mode"
              >
                <GripVertical className="h-4 w-4 mr-2" />
                Definir Ordem
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => saveOrderMutation.mutate()}
                  disabled={saveOrderMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-save-order"
                >
                  {saveOrderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Ordem
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsOrderMode(false);
                    setOrderedProperties([]);
                  }}
                  disabled={saveOrderMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-order"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
            <Button 
              onClick={() => setAiDialogOpen(true)}
              className="bg-gradient-to-r from-accent to-accent/90 border-0 w-full sm:w-auto" 
              data-testid="button-ai-registration"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Cadastro com IA
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingProperty(null);
                form.reset();
                setPropertyImages([]);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto" data-testid="button-add-property">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Imóvel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProperty ? "Editar Imóvel" : "Novo Imóvel"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="propertyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Imóvel *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-property-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="casa">Casa padrão</SelectItem>
                                <SelectItem value="condominio">Casa em condomínio</SelectItem>
                                <SelectItem value="apartamento">Apartamento</SelectItem>
                                <SelectItem value="terreno">Terreno</SelectItem>
                                <SelectItem value="comercial">Comercial</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      </div>

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Casa com 3 quartos no Centro" data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição *</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={5} placeholder="Descrição completa do imóvel..." data-testid="textarea-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço (R$) *</FormLabel>
                          <FormControl>
                            <PriceInput 
                              value={field.value}
                              onChange={(value) => field.onChange(value || "")}
                              data-testid="input-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="area"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Área Construída (m²)</FormLabel>
                            <FormControl>
                              <AreaInput
                                value={field.value ?? ""}
                                onChange={(value) => field.onChange(value?.toString() || "")}
                                data-testid="input-area"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="landArea"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lote / Terreno (m²)</FormLabel>
                            <FormControl>
                              <AreaInput
                                value={field.value ?? ""}
                                onChange={(value) => field.onChange(value?.toString() || "")}
                                data-testid="input-land-area"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="bedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quartos</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? 0} type="number" min="0" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-bedrooms" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bathrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banheiros</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? 0} type="number" min="0" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-bathrooms" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="parkingSpaces"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vagas</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? 0} type="number" min="0" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-parking" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="neighborhoodId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-neighborhood">
                                <SelectValue placeholder="Selecione um bairro" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {neighborhoods.map((n) => (
                                <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isFeatured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Imóvel em Destaque</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Exibir este imóvel na página inicial
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                              data-testid="switch-featured"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div>
                      <FormLabel>Comodidades</FormLabel>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newAmenity}
                          onChange={(e) => setNewAmenity(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAmenity())}
                          placeholder="Ex: Piscina, Academia..."
                          data-testid="input-amenity"
                        />
                        <Button type="button" onClick={handleAddAmenity} data-testid="button-add-amenity">
                          Adicionar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {form.watch("amenities")?.map((amenity, index) => (
                          <Badge key={index} variant="secondary" className="rounded-full">
                            {amenity}
                            <button
                              type="button"
                              onClick={() => handleRemoveAmenity(index)}
                              className="ml-2 hover:text-destructive"
                              data-testid={`button-remove-amenity-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <PropertyImageUpload
                      images={propertyImages}
                      onChange={setPropertyImages}
                      maxImages={20}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingProperty(null);
                          form.reset();
                          setPropertyImages([]);
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save"
                      >
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  </form>
                </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="hidden lg:block lg:w-64 flex-shrink-0">
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
      </aside>

      <div className="flex-1 min-w-0">
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-video bg-muted animate-pulse" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded" />
                    <div className="h-6 bg-muted animate-pulse rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum imóvel encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? "Tente ajustar os filtros para ver mais resultados"
                  : "Clique em 'Novo Imóvel' para adicionar o primeiro"
                }
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} data-testid="button-clear-filters-empty">
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {isOrderMode ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left p-4 font-medium text-sm w-16">#</th>
                          <th className="text-center p-4 font-medium text-sm w-24">Ações</th>
                          <th className="text-left p-4 font-medium text-sm">Imagem</th>
                          <th className="text-left p-4 font-medium text-sm">Título</th>
                          <th className="text-left p-4 font-medium text-sm">Tipo</th>
                          <th className="text-left p-4 font-medium text-sm">Preço</th>
                          <th className="text-left p-4 font-medium text-sm">Bairro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedProperties.map((property, index) => {
                          const neighborhood = neighborhoods.find(n => n.id === property.neighborhoodId);
                          // Calculate global position based on all properties (most recent first)
                          const globalPosition = allProperties.findIndex(p => p.id === property.id) + 1;
                          const itemNumber = globalPosition > 0 ? globalPosition : ((currentPage - 1) * ITEMS_PER_PAGE + index + 1);
                          return (
                            <tr key={property.id} className="border-b hover:bg-muted/20 transition-colors" data-testid={`row-property-${property.id}`}>
                              <td className="p-4 font-medium">{itemNumber}</td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => moveProperty(index, "up")}
                                    disabled={index === 0}
                                    data-testid={`button-move-up-${property.id}`}
                                    className="h-8 w-8"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => moveProperty(index, "down")}
                                    disabled={index === orderedProperties.length - 1}
                                    data-testid={`button-move-down-${property.id}`}
                                    className="h-8 w-8"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="w-20 h-14 rounded overflow-hidden bg-muted">
                                  {property.images && property.images.length > 0 ? (
                                    <img 
                                      src={property.images[0]} 
                                      alt={property.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML = '<div class="w-full h-full bg-muted flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></div>';
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="max-w-xs">
                                  <p className="font-medium line-clamp-2">{property.title}</p>
                                  {property.isFeatured && (
                                    <Badge className="mt-1 bg-gradient-to-r from-accent to-accent/90 text-white border-0">
                                      Destaque
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 capitalize">{property.propertyType}</td>
                              <td className="p-4 font-semibold text-accent">{formatPrice(property.price)}</td>
                              <td className="p-4">{neighborhood?.name || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property, index) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
                  >
                    <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all h-full" data-testid={`card-property-${property.id}`}>
                      <PropertyImageWithWatermark 
                        src={property.images?.[0]} 
                        alt={property.title}
                        isFeatured={property.isFeatured || undefined}
                      />
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{getPropertyTypeLabel(property.propertyType)}</p>
                        <h3 className="font-semibold text-lg mb-2 line-clamp-1">{property.title}</h3>
                        <p className="text-2xl font-bold text-accent mb-3">{formatPrice(property.price)}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {property.bedrooms && property.bedrooms > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                              <div className="p-1 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                <Bed className="h-3.5 w-3.5 text-[#bc974e] dark:text-[#d4ae6a]" />
                              </div>
                              <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
                              </span>
                            </div>
                          )}
                          {property.bathrooms && property.bathrooms > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                              <div className="p-1 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                <Bath className="h-3.5 w-3.5 text-[#bc974e] dark:text-[#d4ae6a]" />
                              </div>
                              <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                {property.bathrooms} {property.bathrooms === 1 ? 'banheiro' : 'banheiros'}
                              </span>
                            </div>
                          )}
                          {property.area && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#bc974e]/5 dark:bg-[#bc974e]/10 rounded-lg border border-[#bc974e]/30 dark:border-[#bc974e]/40 transition-all hover:scale-105">
                              <div className="p-1 bg-[#bc974e]/10 dark:bg-[#bc974e]/20 rounded">
                                <Maximize2 className="h-3.5 w-3.5 text-[#bc974e] dark:text-[#d4ae6a]" />
                              </div>
                              <span className="text-xs font-medium text-[#bc974e] dark:text-[#d4ae6a]">
                                {formatArea(property.area)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-3 border-t mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              Status:
                            </span>
                            <span className={`text-sm font-medium ${property.isActive ? "text-primary" : "text-muted-foreground"}`}>
                              {property.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={property.isActive || false}
                              onCheckedChange={() => toggleActiveMutation.mutate(property.id)}
                              disabled={toggleActiveMutation.isPending}
                              data-testid={`switch-toggle-active-${property.id}`}
                              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300 scale-110"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(property)}
                            data-testid={`button-edit-${property.id}`}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPropertyToDelete(property.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${property.id}`}
                            className="flex-1"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, total)} de {total} imóveis
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isFetching}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="hidden sm:flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      <div key={index}>
                        {page === '...' ? (
                          <span className="px-3 py-2">...</span>
                        ) : (
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page as number)}
                            disabled={isFetching}
                            className="min-w-[40px]"
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex sm:hidden items-center gap-2">
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isFetching}
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

    <AIPropertyDialog
      open={aiDialogOpen}
      onOpenChange={setAiDialogOpen}
      onExtractSuccess={handleAIExtractSuccess}
    />

    <DeleteConfirmDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      onConfirm={() => {
        if (propertyToDelete) {
          deleteMutation.mutate(propertyToDelete);
          setPropertyToDelete(null);
        }
      }}
      title="Confirmar exclusão"
      description="Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita."
    />
    </div>
  );
}
