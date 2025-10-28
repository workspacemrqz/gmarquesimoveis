import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, FileText, ExternalLink, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadFieldProps {
  value?: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  disabled?: boolean;
}

interface UploadedDocument {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export default function DocumentUploadField({
  value = [],
  onChange,
  label,
  disabled = false,
}: DocumentUploadFieldProps) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<string[]>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync internal state with external value when it changes
  useEffect(() => {
    setDocuments(value);
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('documents', file);
      });

      const response = await fetch("/api/uploads/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Falha ao fazer upload dos documentos");
      }

      const uploadedFiles: UploadedDocument[] = await response.json();
      const newUrls = uploadedFiles.map(f => f.url);
      const updatedDocuments = [...documents, ...newUrls];
      
      setDocuments(updatedDocuments);
      onChange(updatedDocuments);
      
      toast({
        title: "Sucesso",
        description: `${uploadedFiles.length} documento(s) enviado(s) com sucesso`,
      });
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao fazer upload dos documentos",
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (urlToRemove: string) => {
    const updatedDocuments = documents.filter(url => url !== urlToRemove);
    setDocuments(updatedDocuments);
    onChange(updatedDocuments);
    
    toast({
      title: "Documento removido",
      description: "O documento foi removido da lista",
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  const getFileIcon = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return FileText;
    }
    
    return File;
  };

  return (
    <div className="space-y-2" data-testid="document-upload-field">
      {label && (
        <Label data-testid="label-document-upload">{label}</Label>
      )}
      
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileChange}
          disabled={disabled || loading}
          multiple
          className="hidden"
          data-testid="input-file-upload"
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={disabled || loading}
          className="w-full"
          data-testid="button-upload-document"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Adicionar Documentos
            </>
          )}
        </Button>
        
        {documents.length > 0 && (
          <div className="space-y-2 mt-4" data-testid="documents-list">
            <p className="text-sm text-muted-foreground">
              {documents.length} documento(s) anexado(s)
            </p>
            {documents.map((url, index) => {
              const FileIcon = getFileIcon(url);
              const fileName = getFileName(url);
              
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/10"
                  data-testid={`document-item-${index}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate" title={fileName}>
                      {fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(url, '_blank')}
                      disabled={disabled}
                      data-testid={`button-view-document-${index}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(url)}
                      disabled={disabled}
                      data-testid={`button-remove-document-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <p className="text-xs text-muted-foreground">
          Tipos aceitos: PDF, imagens (JPG, PNG), documentos Word (DOC, DOCX). Máximo 10MB por arquivo.
        </p>
      </div>
    </div>
  );
}
