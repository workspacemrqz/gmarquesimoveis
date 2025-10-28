import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Plus, Edit, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Neighborhood, InsertNeighborhood } from "@shared/schema";
import { insertNeighborhoodSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AINeighborhoodDialog } from "@/components/AINeighborhoodDialog";
import ImageUploadField from "@/components/ImageUploadField";

export default function AdminNeighborhoods() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNeighborhood, setEditingNeighborhood] = useState<Neighborhood | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [neighborhoodToDelete, setNeighborhoodToDelete] = useState<string | null>(null);

  const { data: neighborhoods = [], isLoading } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  const form = useForm<InsertNeighborhood>({
    resolver: zodResolver(insertNeighborhoodSchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertNeighborhood) => {
      await apiRequest("POST", "/api/admin/neighborhoods", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhoods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      // Error creating neighborhood
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: InsertNeighborhood }) => {
      await apiRequest("PATCH", `/api/admin/neighborhoods/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhoods"] });
      setDialogOpen(false);
      setEditingNeighborhood(null);
      form.reset();
    },
    onError: () => {
      // Error updating neighborhood
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/neighborhoods/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhoods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => {
      // Error deleting neighborhood
    },
  });

  const handleEdit = (neighborhood: Neighborhood) => {
    setEditingNeighborhood(neighborhood);
    form.reset({
      name: neighborhood.name,
      description: neighborhood.description || "",
      imageUrl: neighborhood.imageUrl || "",
    });
    setDialogOpen(true);
  };

  // Handle AI extracted data
  const handleAIExtraction = (extractedData: InsertNeighborhood) => {
    // Save directly to database
    createMutation.mutate(extractedData);
  };

  const onSubmit = (data: InsertNeighborhood) => {
    // Slug will be generated automatically on the backend
    if (editingNeighborhood) {
      updateMutation.mutate({ id: editingNeighborhood.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
                Gerenciar Bairros
              </h1>
              <p className="text-muted-foreground">{neighborhoods.length} bairros cadastrados</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AINeighborhoodDialog 
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
                  setEditingNeighborhood(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-neighborhood">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Bairro
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingNeighborhood ? "Editar Bairro" : "Novo Bairro"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Bairro *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Centro" data-testid="input-name" />
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
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} rows={4} placeholder="Descrição do bairro..." data-testid="textarea-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              value={field.value || ""}
                              onChange={field.onChange}
                              label="Imagem do Bairro"
                              disabled={createMutation.isPending || updateMutation.isPending}
                              uploadEndpoint="/api/admin/upload/neighborhood-image"
                            />
                          </FormControl>
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
                          setEditingNeighborhood(null);
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
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-40 h-32 bg-muted animate-pulse rounded-md flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-6 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : neighborhoods.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum bairro cadastrado</h3>
                <p className="text-muted-foreground">
                  Clique em "Novo Bairro" para adicionar o primeiro
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {neighborhoods.map((neighborhood) => (
                <Card key={neighborhood.id} data-testid={`card-neighborhood-${neighborhood.id}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Imagem do bairro no lado esquerdo */}
                      <div className="w-40 h-32 flex-shrink-0 rounded-md overflow-hidden">
                        {neighborhood.imageUrl ? (
                          <img
                            src={neighborhood.imageUrl}
                            alt={neighborhood.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* Conteúdo do bairro */}
                      <div className="flex-1 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{neighborhood.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">/{neighborhood.slug}</p>
                          {neighborhood.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{neighborhood.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(neighborhood)}
                            data-testid={`button-edit-${neighborhood.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setNeighborhoodToDelete(neighborhood.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${neighborhood.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
          if (neighborhoodToDelete) {
            deleteMutation.mutate(neighborhoodToDelete);
            setNeighborhoodToDelete(null);
          }
        }}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este bairro? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
