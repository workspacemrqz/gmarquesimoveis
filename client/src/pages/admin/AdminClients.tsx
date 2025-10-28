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
import type { Client, InsertClient, Property } from "@shared/schema";
import { insertClientSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PhoneInput } from "@/components/ui/masked-input";
import { AIClientDialog } from "@/components/AIClientDialog";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";
import DocumentUploadField from "@/components/DocumentUploadField";

export default function AdminClients() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
  });

  const { data: properties = [], isLoading: isLoadingProperties } = useQuery<Property[]>({
    queryKey: ["/api/admin/properties"],
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      documents: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("POST", "/api/admin/clients", data);
      const client = await response.json() as Client;
      
      // Set property associations if any are selected
      if (selectedProperties.length > 0) {
        await apiRequest("POST", `/api/admin/clients/${client.id}/properties`, {
          propertyIds: selectedProperties
        });
      }
      
      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      setSelectedProperties([]);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: InsertClient }) => {
      await apiRequest("PATCH", `/api/admin/clients/${id}`, data);
      
      // Update property associations
      await apiRequest("POST", `/api/admin/clients/${id}/properties`, {
        propertyIds: selectedProperties
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      setDialogOpen(false);
      setEditingClient(null);
      setSelectedProperties([]);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/clients/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const handleEdit = async (client: Client) => {
    setEditingClient(client);
    form.reset({
      ...client,
      email: client.email || "",
      phone: client.phone || "",
      notes: client.notes || "",
      documents: client.documents || [],
    });
    
    // Load client's properties
    try {
      const response = await apiRequest("GET", `/api/admin/clients/${client.id}/properties`, {});
      const propertyIds = await response.json() as string[];
      setSelectedProperties(propertyIds);
    } catch {
      setSelectedProperties([]);
    }
    
    setDialogOpen(true);
  };

  // Handle AI extracted data
  const handleAIExtraction = (extractedData: InsertClient, propertyIds?: string[]) => {
    form.reset({
      name: extractedData.name || "",
      email: extractedData.email || "",
      phone: extractedData.phone || "",
      notes: extractedData.notes || "",
      documents: [],
    });
    if (propertyIds && propertyIds.length > 0) {
      setSelectedProperties(propertyIds);
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: InsertClient) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
                Gerenciar Clientes
              </h1>
              <p className="text-muted-foreground">{clients.length} clientes cadastrados</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AIClientDialog 
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
                  setEditingClient(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-client">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingClient ? "Editar Cliente" : "Novo Cliente"}
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
                              <Input {...field} value={field.value || ""} type="email" placeholder="email@exemplo.com" data-testid="input-email" />
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
                            <Textarea {...field} value={field.value || ""} rows={4} placeholder="Anotações sobre o cliente..." data-testid="textarea-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Property Selection */}
                    <div className="space-y-2">
                      <FormLabel>Imóveis de Interesse</FormLabel>
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
                              : "Selecionar imóveis de interesse..."}
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
                          setEditingClient(null);
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
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum cliente cadastrado</h3>
                <p className="text-muted-foreground">
                  Clique em "Novo Cliente" para adicionar o primeiro
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {clients.map((client) => (
                <Card key={client.id} data-testid={`card-client-${client.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{client.name}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {client.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                          {client.notes && (
                            <p className="mt-2">{client.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(client)}
                          data-testid={`button-edit-${client.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setClientToDelete(client.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${client.id}`}
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
          if (clientToDelete) {
            deleteMutation.mutate(clientToDelete);
            setClientToDelete(null);
          }
        }}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
      />
        </div>
      );
    }
