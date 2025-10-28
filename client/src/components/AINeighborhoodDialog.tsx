import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Upload, X, Loader2 } from "lucide-react";
import type { InsertNeighborhood } from "@shared/schema";

const formSchema = z.object({
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  imageFile: z.any().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AINeighborhoodDialogProps {
  onSuccess: (neighborhood: InsertNeighborhood) => void;
  trigger?: React.ReactNode;
}

export function AINeighborhoodDialog({ onSuccess, trigger }: AINeighborhoodDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (data: { description: string; imageBase64?: string; imageFilename?: string }) => {
      const result = await apiRequest("POST", "/api/admin/ai/extract-neighborhood", data);
      return await result.json();
    },
    onSuccess: (data: any) => {
      console.log("AI extraction successful, data:", data);
      
      // Close this dialog first
      setOpen(false);
      
      // Reset form and clear image
      form.reset();
      setImagePreview(null);
      
      // Wait a bit for the dialog to close, then pass data to parent
      setTimeout(() => {
        onSuccess(data as InsertNeighborhood);
      }, 100);
    },
    onError: (error: any) => {
      // Error extracting neighborhood data
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    form.setValue("imageFile", undefined);
  };

  const onSubmit = async (values: FormData) => {
    const requestData: any = {
      description: values.description,
    };

    // Add image if provided
    if (imagePreview) {
      requestData.imageBase64 = imagePreview.split(',')[1];
      requestData.imageFilename = `neighborhood-${Date.now()}.jpg`;
    }

    extractMutation.mutate(requestData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            Cadastro com IA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto popup-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Cadastro de Bairro com IA
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Descreva o bairro em texto livre. Nossa IA irá extrair automaticamente o nome, criar uma descrição completa e gerar um slug para o cadastro. A imagem é opcional e será usada apenas para exibição.
                </p>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição do Bairro</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Ex: Bairro Vila Nova, localizado na zona norte da cidade, com excelente infraestrutura comercial, escolas próximas, posto de saúde, supermercados, padarias. Área residencial tranquila com ruas arborizadas e praças. Fácil acesso ao centro e principais vias. Transporte público disponível com várias linhas de ônibus."
                        className="min-h-[150px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageFile"
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Imagem do Bairro (Opcional)</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Input
                          {...field}
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            handleImageChange(e);
                            onChange(e.target.files?.[0]);
                          }}
                          className="hidden"
                        />
                        
                        {!imagePreview ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Selecionar Imagem
                          </Button>
                        ) : (
                          <Card className="relative p-4">
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              data-testid="button-remove-image"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-md"
                            />
                          </Card>
                        )}
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      A imagem é opcional e será usada apenas para visualização
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={extractMutation.isPending}
                data-testid="button-cancel"
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={extractMutation.isPending}
                className="bg-gradient-to-r from-accent to-accent/90 border-0 w-full sm:w-auto"
                data-testid="button-submit"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Processar com IA
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}