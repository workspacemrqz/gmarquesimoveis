import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Star } from "lucide-react";

export interface PropertyImage {
  id: string;
  file?: File;
  url?: string;
  preview: string;
  isNew: boolean;
}

interface PropertyImageUploadProps {
  images: PropertyImage[];
  onChange: (images: PropertyImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export default function PropertyImageUpload({
  images,
  onChange,
  maxImages = 20,
  disabled = false,
}: PropertyImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      return;
    }

    // Check max images limit
    const remainingSlots = maxImages - images.length;
    if (files.length > remainingSlots) {
      return;
    }

    // Create new image objects with local preview
    const newImages: PropertyImage[] = files.map(file => ({
      id: `new-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      isNew: true
    }));

    onChange([...images, ...newImages]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove?.isNew && imageToRemove.preview.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onChange(images.filter(img => img.id !== id));
  };

  const setAsFeatured = (id: string) => {
    const imageIndex = images.findIndex(img => img.id === id);
    if (imageIndex === -1 || imageIndex === 0) return; // Already featured or not found
    
    const updatedImages = [...images];
    const [featuredImage] = updatedImages.splice(imageIndex, 1);
    updatedImages.unshift(featuredImage); // Move to first position
    
    onChange(updatedImages);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>Imagens do Imóvel</Label>
      
      <div className="border-2 border-dashed rounded-lg p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          disabled={disabled || images.length >= maxImages}
          className="hidden"
          data-testid="input-property-images"
        />
        
        {images.length === 0 ? (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className="w-full flex flex-col items-center justify-center py-8 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-add-first-image"
          >
          </button>
        ) : (
          <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 mb-3">
              {images.map((img, index) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview || img.url || ''}
                    alt={`Imagem ${index + 1}`}
                    className="w-full h-20 sm:h-24 object-cover rounded-lg"
                    data-testid={`image-preview-${index}`}
                  />
                  
                  {/* Featured Star Indicator */}
                  {index === 0 && images.length > 1 && (
                    <div className="absolute top-1 left-1 bg-yellow-500 text-white rounded-full p-0.5 sm:p-1">
                      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-white" />
                    </div>
                  )}
                  
                  {/* Set as Featured Button */}
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => setAsFeatured(img.id)}
                      className="absolute top-1 left-1 bg-background/80 hover:bg-yellow-500 hover:text-white text-foreground rounded-full p-0.5 sm:p-1 opacity-0 group-hover:opacity-100 transition-all"
                      disabled={disabled}
                      title="Marcar como destaque"
                      data-testid={`button-set-featured-${index}`}
                    >
                      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                  )}
                  
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 sm:p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={disabled}
                    data-testid={`button-remove-image-${index}`}
                  >
                    <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </button>
                  
                  {/* New Badge */}
                  {img.isNew && (
                    <span className="absolute bottom-1 left-1 bg-accent text-accent-foreground text-[10px] sm:text-xs px-1 py-0.5 rounded truncate max-w-[90%]">
                      Nova
                    </span>
                  )}
                  
                  {/* Featured Badge */}
                  {index === 0 && images.length > 1 && (
                    <span className="absolute bottom-1 right-1 bg-yellow-500 text-white text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 rounded font-medium truncate max-w-[90%]">
                      Destaque
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {images.length < maxImages && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClick}
                disabled={disabled}
                data-testid="button-add-more-images"
              >
                <Upload className="h-4 w-4 mr-2" />
                Adicionar mais imagens
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground mt-2">
              {images.length} de {maxImages} imagens adicionadas
              {images.length > 1 && (
                <span className="ml-2 text-yellow-600">
                  • A primeira foto é a de destaque
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}