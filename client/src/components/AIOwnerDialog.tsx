import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Sparkles, Loader2 } from "lucide-react";
import type { InsertOwner } from "@shared/schema";

const formSchema = z.object({
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
});

type FormData = z.infer<typeof formSchema>;

interface AIOwnerDialogProps {
  onSuccess: (owner: InsertOwner, propertyIds?: string[]) => void;
  trigger?: React.ReactNode;
}

export function AIOwnerDialog({ onSuccess, trigger }: AIOwnerDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (data: { description: string }) => {
      const response = await apiRequest("POST", "/api/admin/ai/extract-owner", data);
      const result = await response.json();
      return result;
    },
    onSuccess: (data: any) => {
      console.log("AI extraction successful, data:", data);
      
      // Extract propertyIds from response
      const { propertyIds, ...ownerData } = data;
      
      // Close this dialog first
      setOpen(false);
      
      // Reset form
      form.reset();
      
      // Wait a bit for the dialog to close, then pass data to parent
      setTimeout(() => {
        onSuccess(ownerData as InsertOwner, propertyIds);
      }, 100);
    },
    onError: (error: any) => {
      // Error extracting owner data
    },
  });

  const onSubmit = async (values: FormData) => {
    extractMutation.mutate({
      description: values.description,
    });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Cadastro de Proprietário com IA
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Descreva o proprietário em texto livre. Nossa IA irá extrair as informações mencionadas (nome, CPF/CNPJ, email, telefone, endereço) e também capturar contexto relevante para as observações (como quando entrou em contato, preferências, etc).
                </p>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição do Proprietário</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Ex: Maria Santos, CPF 123.456.789-00, mora na Rua das Flores, 123, Centro, São Paulo. Email maria.santos@email.com, telefone (11) 91234-5678. Possui 3 apartamentos para locação na região central, todos quitados. Prefere contratos de longo prazo e inquilinos com fiador."
                        className="min-h-[150px]"
                      />
                    </FormControl>
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