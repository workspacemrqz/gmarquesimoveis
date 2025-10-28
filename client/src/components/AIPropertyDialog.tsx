import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import type { PropertyExtraction } from "./types";

interface AIPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtractSuccess: (data: PropertyExtraction) => void;
}

export default function AIPropertyDialog({ 
  open, 
  onOpenChange, 
  onExtractSuccess 
}: AIPropertyDialogProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/ai/extract-property", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to extract property data");
      }

      const extractedData = await response.json();

      onExtractSuccess(extractedData);
      handleClose();
    } catch (error: any) {
      console.error("Error extracting property data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto popup-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Cadastro com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Descreva o imóvel com o máximo de detalhes possível. A IA analisará as informações 
              e preencherá automaticamente todos os campos do formulário. Você poderá adicionar 
              as fotos posteriormente no formulário de edição.
            </p>
          </div>

          <div>
            <Label htmlFor="property-description" className="mb-2 block">
              Descrição do Imóvel *
            </Label>
            <Textarea
              id="property-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o imóvel com o máximo de detalhes possível. Por exemplo: 'Casa com 3 quartos sendo 1 suíte, 2 banheiros, sala ampla, cozinha americana, área de serviço, garagem para 2 carros. Área total de 200m², área construída de 150m². Localizada no bairro Jardim das Flores, próximo ao supermercado e escola. Valor R$ 450.000. Casa possui piscina, churrasqueira e jardim.'"
              rows={8}
              disabled={loading}
              className="resize-none"
              data-testid="textarea-ai-description"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quanto mais detalhes você fornecer, melhor será o resultado da IA
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              data-testid="button-cancel-ai"
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !description.trim()}
              className="bg-gradient-to-r from-accent to-accent/90 border-0 w-full sm:w-auto"
              data-testid="button-process-ai"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando com IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Processar com IA
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}