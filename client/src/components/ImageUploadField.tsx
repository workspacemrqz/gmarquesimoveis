import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploadFieldProps {
  value?: string;
  onChange: (url: string) => void;
  label: string;
  disabled?: boolean;
  uploadEndpoint?: string;
  uploadExtraData?: Record<string, any>;
}

export default function ImageUploadField({
  value,
  onChange,
  label,
  disabled = false,
  uploadEndpoint = "/api/admin/upload-image",
  uploadExtraData = {},
}: ImageUploadFieldProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string>(value && value.trim() !== '' ? value : "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with value prop changes
  useEffect(() => {
    setPreview(value && value.trim() !== '' ? value : "");
  }, [value]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      return;
    }

    setLoading(true);
    try {
      const base64Data = await fileToBase64(file);
      
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          base64Data,
          filename: file.name,
          ...uploadExtraData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload image");
      }

      const { url } = await response.json();
      setPreview(url);
      onChange(url);
    } catch (error: any) {
      console.error("Error uploading image:", error);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreview("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2" data-testid="image-upload-field">
      {label && (
        <Label data-testid="label-image-upload">{label}</Label>
      )}
      
      <div className="border-2 border-dashed rounded-lg">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={disabled || loading}
          className="hidden"
          data-testid="input-file-upload"
        />
        
        {preview && preview.trim() !== '' ? (
          <div className="relative group w-full aspect-square flex items-center justify-center bg-muted/10 rounded-lg overflow-hidden" data-testid="image-preview-container">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
              data-testid="image-preview"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleClick}
                disabled={disabled || loading}
                data-testid="button-change-image"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Alterar
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                disabled={disabled || loading}
                data-testid="button-remove-image"
              >
                <X className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || loading}
            className="w-full flex flex-col items-center justify-center py-12 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-upload-image"
          >
          </button>
        )}
      </div>
    </div>
  );
}
