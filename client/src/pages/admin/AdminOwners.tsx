import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Users, Plus, Edit, Trash2, Phone, Mail, Sparkles, Home, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Owner, InsertOwner, Property } from "@shared/schema";
import { insertOwnerSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PhoneInput } from "@/components/ui/masked-input";
import { AIOwnerDialog } from "@/components/AIOwnerDialog";
import { formatPhone } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";
import DocumentUploadField from "@/components/DocumentUploadField";

export default function AdminOwners() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ownerToDelete, setOwnerToDelete] = useState<string | null>(null);

  const { data: owners = [], isLoading } = useQuery<Owner[]>({
    queryKey: ["/api/admin/owners"],
  });

  const { data: properties = [], isLoading: isLoadingProperties } = useQuery<Property[]>({
    queryKey: ["/api/admin/properties"],
  });

  const form = useForm<InsertOwner>({
    resolver: zodResolver(insertOwnerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      documents: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertOwner) => {
      const response = await apiRequest("POST", "/api/admin/owners", data);
      const owner = await response.json() as Owner;
      
      // Set property associations if any are selected
      if (selectedProperties.length > 0) {
        await apiRequest("POST", `/api/admin/owners/${owner.id}/properties`, {
          propertyIds: selectedProperties
        });
      }
      
      return owner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/owners"] });
      setDialogOpen(false);
      setSelectedProperties([]);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: InsertOwner }) => {
      await apiRequest("PATCH", `/api/admin/owners/${id}`, data);
      
      // Update property associations
      await apiRequest("POST", `/api/admin/owners/${id}/properties`, {
        propertyIds: selectedProperties
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/owners"] });
      setDialogOpen(false);
      setEditingOwner(null);
      setSelectedProperties([]);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/owners/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/owners"] });
    },
  });

  const handleEdit = async (owner: Owner) => {
    setEditingOwner(owner);
    form.reset({
      ...owner,
      email: owner.email || "",
      phone: owner.phone || "",
      notes: owner.notes || "",
      documents: owner.documents || [],
    });
    
    // Load owner's properties
    try {
      const response = await apiRequest("GET", `/api/admin/owners/${owner.id}/properties`, {});
      const propertyIds = await response.json() as string[];
      setSelectedProperties(propertyIds);
    } catch {
      setSelectedProperties([]);
    }
    
    setDialogOpen(true);
  };

  // Handle AI extracted data
  const handleAIExtraction = (extractedData: InsertOwner, propertyIds?: string[]) => {
    console.log("AI Extraction Data received:", extractedData, "Property IDs:", propertyIds);
    
    // Clear any existing editing state
    setEditingOwner(null);
    
    // Reset form with extracted data
    const formData = {
      name: extractedData.name || "",
      email: extractedData.email || "",
      phone: extractedData.phone || "",
      notes: extractedData.notes || "",
      documents: [],
    };
    
    console.log("Setting form data:", formData);
    
    // Reset form with the extracted data
    form.reset(formData);
    
    // Set selected properties if provided
    if (propertyIds && propertyIds.length > 0) {
      setSelectedProperties(propertyIds);
    } else {
      setSelectedProperties([]);
    }
    
    // Open the dialog to show the form with pre-filled data
    setDialogOpen(true);
  };

  const onSubmit = (data: InsertOwner) => {
    if (editingOwner) {
      updateMutation.mutate({ id: editingOwner.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
                Gerenciar Proprietários
              </h1>
              <p className="text-muted-foreground">{owners.length} proprietários cadastrados</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AIOwnerDialog 
                onSuccess={handleAIExtraction}
                trigger={
                  <Button 
                    className="bg-gradient-to-r from-accent to-accent/90 border-0" 
                    data-testid="button-ai-registration"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Cadastro com IA
                  </Button>
                }
              />
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setEditingOwner(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-owner">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Proprietário
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingOwner ? "Editar Proprietário" : "Novo Proprietário"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome completo" data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                type="email" 
                                placeholder="email@exemplo.com" 
                                data-testid="input-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <PhoneInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                data-testid="input-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              value={field.value || ""} 
                              rows={4} 
                              placeholder="Anotações sobre o proprietário..." 
                              data-testid="textarea-notes" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Property Selection */}
                    <div className="space-y-2">
                      <FormLabel>Imóveis do Proprietário</FormLabel>
                      <Popover open={propertySearchOpen} onOpenChange={setPropertySearchOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant="outline" 
                            role="combobox"
                            aria-expanded={propertySearchOpen}
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-select-properties"
                          >
                            <Home className="mr-2 h-4 w-4" />
                            {selectedProperties.length > 0 
                              ? `${selectedProperties.length} imóvel(is) selecionado(s)` 
                              : "Selecionar imóveis..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Pesquisar imóveis..." />
                            <CommandList>
                              <CommandEmpty>Nenhum imóvel encontrado.</CommandEmpty>
                              <CommandGroup>
                                {properties.map((property) => {
                                  const isSelected = selectedProperties.includes(property.id);
                                  return (
                                    <CommandItem
                                      key={property.id}
                                      onSelect={() => {
                                        setSelectedProperties(
                                          isSelected
                                            ? selectedProperties.filter((id) => id !== property.id)
                                            : [...selectedProperties, property.id]
                                        );
                                      }}
                                      data-testid={`option-property-${property.id}`}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          isSelected ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium">{property.title}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {property.propertyType}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      {/* Selected Properties Display */}
                      {selectedProperties.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedProperties.map((id) => {
                            const property = properties.find((p) => p.id === id);
                            if (!property) return null;
                            return (
                              <Badge 
                                key={id} 
                                variant="secondary"
                                className="pl-2 pr-1"
                                data-testid={`badge-property-${id}`}
                              >
                                {property.title}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 hover-elevate"
                                  onClick={() => setSelectedProperties(selectedProperties.filter((pid) => pid !== id))}
                                  data-testid={`button-remove-property-${id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="documents"
                      render={({ field }) => (
                        <FormItem>
                          <DocumentUploadField
                            value={field.value || []}
                            onChange={field.onChange}
                            label="Documentos"
                            disabled={createMutation.isPending || updateMutation.isPending}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingOwner(null);
                          setSelectedProperties([]);
                          form.reset();
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

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted animate-pulse rounded mb-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : owners.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum proprietário cadastrado</h3>
                <p className="text-muted-foreground">
                  Clique em "Novo Proprietário" para adicionar o primeiro
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {owners.map((owner) => (
                <Card key={owner.id} data-testid={`card-owner-${owner.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{owner.name}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {owner.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>{owner.email}</span>
                            </div>
                          )}
                          {owner.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span>{formatPhone(owner.phone)}</span>
                            </div>
                          )}
                          {owner.notes && (
                            <p className="mt-2">{owner.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(owner)}
                          data-testid={`button-edit-${owner.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setOwnerToDelete(owner.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${owner.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (ownerToDelete) {
            deleteMutation.mutate(ownerToDelete);
            setOwnerToDelete(null);
          }
        }}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este proprietário? Esta ação não pode ser desfeita."
      />
        </div>
      );
    }
