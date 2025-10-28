import { 
  Shield,
  Trees,
  Dumbbell,
  Wifi,
  Wind,
  Sun,
  Utensils,
  Waves,
  Dog,
  ShoppingBag,
  Baby,
  Gamepad2,
  Sofa,
  Tv,
  Zap,
  Droplets,
  Flame,
  Package,
  Phone,
  MapPin,
  CheckCircle,
  Sparkles,
  Fence,
  Car,
  Home,
  LucideIcon
} from "lucide-react";

// Mapa de ícones para comodidades
const amenityIcons: Record<string, LucideIcon> = {
  // Segurança
  "portaria": Shield,
  "portaria 24h": Shield,
  "segurança": Shield,
  "cerca elétrica": Zap,
  "interfone": Phone,
  "câmeras": Shield,
  "vigilância": Shield,
  "alarme": Shield,
  "portão eletrônico": Fence,
  
  // Lazer e Esportes
  "piscina": Waves,
  "churrasqueira": Flame,
  "área gourmet": Utensils,
  "salão de festas": Home,
  "salão de jogos": Gamepad2,
  "academia": Dumbbell,
  "quadra": Gamepad2,
  "quadra poliesportiva": Gamepad2,
  "playground": Baby,
  "brinquedoteca": Baby,
  "jardim": Trees,
  "área verde": Trees,
  "spa": Sparkles,
  "sauna": Flame,
  
  // Conforto e Comodidades
  "ar condicionado": Wind,
  "aquecimento": Flame,
  "aquecimento solar": Sun,
  "varanda": Sun,
  "sacada": Sun,
  "terraço": Sun,
  "closet": Package,
  "despensa": Package,
  "mobiliado": Sofa,
  "semi mobiliado": Sofa,
  "lavanderia": Droplets,
  "área de serviço": Home,
  
  // Tecnologia e Serviços
  "wifi": Wifi,
  "internet": Wifi,
  "tv a cabo": Tv,
  "água inclusa": Droplets,
  "gás encanado": Flame,
  "energia solar": Sun,
  "automação": Zap,
  
  // Pets
  "aceita pet": Dog,
  "pet friendly": Dog,
  "permite animais": Dog,
  "espaço pet": Dog,
  
  // Localização e Acesso
  "próximo ao metrô": MapPin,
  "próximo ao shopping": ShoppingBag,
  "próximo a escolas": Baby,
  "próximo ao centro": MapPin,
  "vista mar": Waves,
  "vista montanha": Trees,
  
  // Estacionamento
  "garagem": Car,
  "vaga coberta": Car,
  "estacionamento": Car,
  "manobrista": Car,
};

// Categorias de amenidades
export const amenityCategories: Record<string, string[]> = {
  "Segurança": ["portaria", "segurança", "cerca", "câmera", "vigilância", "alarme", "interfone", "portão"],
  "Lazer": ["piscina", "churrasqueira", "festas", "gourmet", "academia", "quadra", "playground", "brinquedoteca", "spa", "sauna", "jogos"],
  "Conforto": ["ar condicionado", "aquecimento", "varanda", "sacada", "terraço", "closet", "mobiliado", "lavanderia"],
  "Serviços": ["wifi", "internet", "tv", "água", "gás", "energia solar", "automação"],
  "Pets": ["pet", "animais"],
  "Localização": ["metrô", "shopping", "escola", "centro", "vista"],
  "Estacionamento": ["garagem", "vaga", "estacionamento", "manobrista"],
};

// Função para obter ícone da comodidade
export function getAmenityIcon(amenity: string): LucideIcon {
  const lowerAmenity = amenity.toLowerCase();
  
  // Busca exata primeiro
  if (amenityIcons[lowerAmenity]) {
    return amenityIcons[lowerAmenity];
  }
  
  // Busca parcial
  for (const [key, icon] of Object.entries(amenityIcons)) {
    if (lowerAmenity.includes(key) || key.includes(lowerAmenity)) {
      return icon;
    }
  }
  
  return CheckCircle; // Ícone padrão
}

// Função para categorizar amenidade
export function getAmenityCategory(amenity: string): string {
  const lowerAmenity = amenity.toLowerCase();
  
  for (const [category, keywords] of Object.entries(amenityCategories)) {
    for (const keyword of keywords) {
      if (lowerAmenity.includes(keyword)) {
        return category;
      }
    }
  }
  
  return "Outros";
}

// Função para agrupar amenidades por categoria
export function groupAmenitiesByCategory(amenities: string[]): Record<string, string[]> {
  return amenities.reduce((acc, amenity) => {
    const category = getAmenityCategory(amenity);
    if (!acc[category]) acc[category] = [];
    acc[category].push(amenity);
    return acc;
  }, {} as Record<string, string[]>);
}

interface AmenityIconProps {
  amenity: string;
  className?: string;
}

export function AmenityIcon({ amenity, className = "h-4 w-4" }: AmenityIconProps) {
  const Icon = getAmenityIcon(amenity);
  return <Icon className={className} />;
}

export default AmenityIcon;