import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numPrice);
}

export function formatArea(area: string | number | null | undefined): string {
  if (!area) return '';
  const numArea = typeof area === 'string' ? parseFloat(area) : area;
  if (numArea <= 0 || isNaN(numArea)) return '';
  return `${numArea.toFixed(0)} m²`;
}

export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function getPropertyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    casa: 'Casa padrão',
    apartamento: 'Apartamento',
    terreno: 'Terreno',
    comercial: 'Comercial',
    condominio: 'Casa em condomínio',
  };
  return labels[type] || type;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    venda: 'Venda',
    aluguel: 'Aluguel',
    ambos: 'Venda/Aluguel',
  };
  return labels[status] || status;
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Formata baseado na quantidade de dígitos
  if (numbers.length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else if (numbers.length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  // Se não tem formatação esperada, retorna o original
  return phone;
}
