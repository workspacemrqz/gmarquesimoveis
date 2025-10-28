export interface PropertyExtraction {
  title: string;
  description: string;
  propertyType: "casa" | "apartamento" | "terreno" | "comercial" | "condominio";
  price: string;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  area?: string;
  amenities?: string[];
  neighborhoodName?: string;
  images?: string[];
}