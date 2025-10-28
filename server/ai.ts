import { z } from "zod";
import OpenAI from "openai";

// OpenAI configuration for local development
// This uses OpenAI API directly with your API key
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-5";

export interface PropertySuggestions {
  title: string;
  description: string;
}

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
}

export interface NeighborhoodExtraction {
  name: string;
  description: string;
  slug?: string;
}

export interface ClientExtraction {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface OwnerExtraction {
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  address?: string;
  notes?: string;
}

export interface FinancialExtraction {
  type: "entrada" | "saida";
  category: string;
  amount: string;
  description: string;
  date?: string;
  frequencyType?: "unico" | "semanal" | "mensal" | "anual";
  dayOfMonth?: number;
  dayOfWeek?: number;
  propertyId?: string;
  clientId?: string;
}

// Validation schema for property data input
export const propertyDataSchema = z.object({
  propertyType: z.enum(["casa", "apartamento", "terreno", "comercial", "condominio"]),
  bedrooms: z.number().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  area: z.string().optional(),
  neighborhoodName: z.string().optional(),
  price: z.string().optional(),
});

export type PropertyData = z.infer<typeof propertyDataSchema>;

// Helper function to call OpenAI API
async function callOpenAI(prompt: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em análise e cadastro de imóveis. IMPORTANTE: Sempre responda APENAS com JSON válido, sem markdown, sem ```json, sem explicações adicionais. Apenas o objeto JSON puro."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    return response.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

export async function generatePropertySuggestions(
  propertyData: PropertyData
): Promise<PropertySuggestions> {
  const propertyTypeMap: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
    comercial: "Imóvel Comercial",
    condominio: "Condomínio",
  };

  const typeName = propertyTypeMap[propertyData.propertyType];
  
  // Build characteristics list with only provided values
  const characteristics = [];
  characteristics.push(`Tipo: ${typeName}`);
  if (propertyData.bedrooms !== undefined) {
    characteristics.push(`Quartos: ${propertyData.bedrooms}`);
  }
  if (propertyData.bathrooms !== undefined) {
    characteristics.push(`Banheiros: ${propertyData.bathrooms}`);
  }
  if (propertyData.area) {
    characteristics.push(`Área: ${propertyData.area}m²`);
  }
  if (propertyData.neighborhoodName) {
    characteristics.push(`Bairro: ${propertyData.neighborhoodName}`);
  }
  if (propertyData.price) {
    characteristics.push(`Preço: R$ ${propertyData.price}`);
  }

  const prompt = `Você é um assistente de redação imobiliária profissional. Crie um título atraente e uma descrição detalhada para um imóvel com as seguintes características:

${characteristics.join('\n')}

IMPORTANTE: 
- O título deve ser direto e incluir informações chave (máximo 80 caracteres)
- A descrição deve ser persuasiva e profissional (3-4 parágrafos)
- Use linguagem acolhedora focada em benefícios
- Destaque características positivas e diferenciais
- Retorne um objeto JSON com campos "title" e "description"`;

  try {
    const responseText = await callOpenAI(prompt);
    
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    const suggestions = JSON.parse(responseText);
    
    return {
      title: suggestions.title || "",
      description: suggestions.description || "",
    };
  } catch (error) {
    console.error("Error generating property suggestions:", error);
    throw new Error("Failed to generate property suggestions");
  }
}

// New function to extract property data from user description  
export async function extractPropertyFromDescription(
  description: string,
  imageUrls?: string[]
): Promise<PropertyExtraction> {
  const prompt = `Analise SOMENTE o texto da descrição do imóvel fornecida e extraia as informações para cadastro.
NÃO se baseie em imagens, apenas no texto descritivo.

Descrição do imóvel:
${description}

Extraia as seguintes informações DO TEXTO ACIMA:
1. Tipo do imóvel (casa, apartamento, terreno, comercial, ou condomínio)
2. Preço de venda (se mencionado)
3. Número de quartos
4. Número de banheiros 
5. Vagas de garagem
6. Área em m²
7. Comodidades e características (piscina, churrasqueira, etc)
8. Bairro ou localização
9. Crie um título atrativo para o anúncio (máximo 80 caracteres)
10. Crie uma descrição completa e vendedora do imóvel

Retorne um JSON no formato:
{
  "title": "título do imóvel",
  "description": "descrição completa",
  "propertyType": "casa|apartamento|terreno|comercial|condominio",
  "price": "valor numérico como string (sem R$ ou formatação)",
  "bedrooms": número ou null,
  "bathrooms": número ou null,
  "parkingSpaces": número ou null,
  "area": "área como string" ou null,
  "amenities": ["lista", "de", "comodidades"] ou [],
  "neighborhoodName": "nome do bairro" ou null
}

Se algum campo não for mencionado na descrição, use valores padrão sensatos ou null.`;

  try {
    const responseText = await callOpenAI(prompt);
    
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7); // Remove ```json
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3); // Remove ```
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }
    cleanedResponse = cleanedResponse.trim();

    const extraction = JSON.parse(cleanedResponse);
    
    // Normalize property type to match enum values
    const validPropertyTypes = ["casa", "apartamento", "terreno", "comercial", "condominio"];
    let normalizedPropertyType = extraction.propertyType?.toLowerCase() || "casa";
    
    // Map common variations to valid enum values
    if (normalizedPropertyType.includes("apart")) {
      normalizedPropertyType = "apartamento";
    } else if (normalizedPropertyType.includes("condo") || normalizedPropertyType.includes("condomínio") || normalizedPropertyType.includes("condominio")) {
      normalizedPropertyType = "condominio";
    } else if (normalizedPropertyType.includes("casa") || normalizedPropertyType.includes("resid")) {
      normalizedPropertyType = "casa";
    } else if (normalizedPropertyType.includes("terr") || normalizedPropertyType.includes("lote")) {
      normalizedPropertyType = "terreno";
    } else if (normalizedPropertyType.includes("comerc") || normalizedPropertyType.includes("loja") || normalizedPropertyType.includes("sala")) {
      normalizedPropertyType = "comercial";
    }
    
    // Ensure it's a valid enum value
    if (!validPropertyTypes.includes(normalizedPropertyType)) {
      normalizedPropertyType = "casa"; // Default fallback
    }
    
    // Ensure amenities is always an array of strings
    const amenities = Array.isArray(extraction.amenities) 
      ? extraction.amenities.filter((a: any) => typeof a === 'string')
      : [];
    
    // Ensure price is a string with numeric value
    const price = extraction.price 
      ? String(extraction.price).replace(/[^\d]/g, '') 
      : "0";
    
    // Validate and clean the extracted data
    return {
      title: extraction.title || "Imóvel para Venda",
      description: extraction.description || description,
      propertyType: normalizedPropertyType as "casa" | "apartamento" | "terreno" | "comercial" | "condominio",
      price,
      bedrooms: typeof extraction.bedrooms === 'number' ? extraction.bedrooms : undefined,
      bathrooms: typeof extraction.bathrooms === 'number' ? extraction.bathrooms : undefined, 
      parkingSpaces: typeof extraction.parkingSpaces === 'number' ? extraction.parkingSpaces : undefined,
      area: extraction.area ? String(extraction.area) : undefined,
      amenities,
      neighborhoodName: extraction.neighborhoodName || undefined,
    };
  } catch (error) {
    console.error("Error extracting property data:", error);
    throw new Error("Failed to extract property information from description");
  }
}

// Function to extract neighborhood data from description
export async function extractNeighborhoodFromDescription(
  description: string,
  imageUrl?: string
): Promise<NeighborhoodExtraction> {
  const prompt = `Analise SOMENTE o texto da descrição do bairro fornecida e extraia as informações para cadastro.

Descrição fornecida pelo usuário:
${description}

Com base no texto acima, extraia:
1. Nome do bairro
2. Crie uma descrição completa e informativa sobre o bairro (características, pontos de referência, infraestrutura, comércio, etc.)
3. Gere um slug (versão URL-friendly do nome, sem acentos, espaços substituídos por hífen, tudo em minúsculas)

IMPORTANTE: Responda APENAS com JSON no formato:
{
  "name": "nome do bairro",
  "description": "descrição completa e detalhada do bairro",
  "slug": "nome-do-bairro"
}`;

  try {
    const responseText = await callOpenAI(prompt);
    
    console.log("AI Response for neighborhood:", responseText);
    
    if (!responseText) {
      console.error("Empty response from OpenAI for neighborhood extraction");
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }
    cleanedResponse = cleanedResponse.trim();

    console.log("Cleaned response for neighborhood:", cleanedResponse);

    const extraction = JSON.parse(cleanedResponse);
    
    console.log("Parsed extraction:", extraction);
    
    // Generate slug if not provided or normalize it
    let slug = extraction.slug || extraction.name || "novo-bairro";
    slug = slug.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
    
    const result = {
      name: extraction.name || "Novo Bairro",
      description: extraction.description || description,
      slug
    };
    
    console.log("Final neighborhood extraction result:", result);
    
    return result;
  } catch (error) {
    console.error("Error extracting neighborhood data:", error);
    throw new Error("Failed to extract neighborhood information from description");
  }
}

// Function to extract client data from description
export async function extractClientFromDescription(
  description: string
): Promise<ClientExtraction> {
  // Get current date and time in Brazil timezone
  const now = new Date();
  const brTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  
  const prompt = `Analise o texto da descrição do cliente e extraia as informações para cadastro.

DATA E HORA ATUAL: ${brTime}

Descrição fornecida pelo usuário:
${description}

REGRAS IMPORTANTES:
1. Para campos de dados pessoais (name, email, phone): extraia APENAS informações EXPLICITAMENTE mencionadas
2. Para o campo "notes" (observações): capture informações contextuais relevantes do texto, como:
   - Quando e como o cliente entrou em contato
   - MUITO IMPORTANTE: Se o texto mencionar "agora", "agora pouco", "hoje", "recentemente", "neste momento", ou qualquer referência temporal:
     * NÃO use palavras vagas como "recentemente" ou "hoje"
     * USE A DATA E HORA EXATA fornecida acima no campo DATA E HORA ATUAL
     * Exemplo: se disser "veio agora", escreva "Compareceu à imobiliária em" seguido da data e hora exata
   - Interesses, preferências ou necessidades mencionadas
   - Qualquer contexto útil para o atendimento
3. Se um campo NÃO for mencionado, use null para esse campo
4. Para nome, email, telefone: seja literal, copie exatamente como aparece no texto
5. Para observações: reescreva de forma profissional, SEMPRE incluindo data/hora exata quando houver qualquer referência temporal

Campos a extrair:
- name: Nome completo do cliente (obrigatório, extrair literalmente)
- email: Email de contato (null se não mencionado, extrair literalmente)
- phone: Telefone/celular (null se não mencionado, extrair literalmente)
- notes: Observações relevantes capturadas do contexto do texto (null se não houver contexto relevante)

Responda APENAS com JSON válido no formato:
{
  "name": "nome do cliente" ou null,
  "email": "email@exemplo.com" ou null,
  "phone": "telefone" ou null,
  "notes": "observações contextuais relevantes" ou null
}`;

  try {
    const responseText = await callOpenAI(prompt);
    
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }
    cleanedResponse = cleanedResponse.trim();

    const extraction = JSON.parse(cleanedResponse);
    
    return {
      name: extraction.name || "Novo Cliente",
      email: extraction.email || undefined,
      phone: extraction.phone || undefined,
      notes: extraction.notes || undefined
    };
  } catch (error) {
    console.error("Error extracting client data:", error);
    throw new Error("Failed to extract client information from description");
  }
}

// Function to extract owner data from description
export async function extractOwnerFromDescription(
  description: string
): Promise<OwnerExtraction> {
  // Get current date and time in Brazil timezone
  const now = new Date();
  const brTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  
  const prompt = `Analise o texto da descrição do proprietário e extraia as informações para cadastro.

DATA E HORA ATUAL: ${brTime}

Descrição fornecida pelo usuário:
${description}

REGRAS IMPORTANTES:
1. Para campos de dados pessoais (name, email, phone, cpfCnpj, address): extraia APENAS informações EXPLICITAMENTE mencionadas
2. Para o campo "notes" (observações): capture informações contextuais relevantes do texto, como:
   - Quando e como o proprietário entrou em contato
   - MUITO IMPORTANTE: Se o texto mencionar "agora", "agora pouco", "hoje", "recentemente", "neste momento", ou qualquer referência temporal:
     * NÃO use palavras vagas como "recentemente" ou "hoje"
     * USE A DATA E HORA EXATA fornecida acima no campo DATA E HORA ATUAL
     * Exemplo: se disser "veio agora", escreva "Compareceu à imobiliária em" seguido da data e hora exata
   - Preferências ou características mencionadas
   - Qualquer contexto útil para o cadastro
3. Se um campo NÃO for mencionado, use null para esse campo
4. Para nome, email, telefone: seja literal, copie exatamente como aparece no texto
5. Para observações: reescreva de forma profissional, SEMPRE incluindo data/hora exata quando houver qualquer referência temporal

Campos a extrair:
- name: Nome completo do proprietário (obrigatório, extrair literalmente)
- email: Email de contato (null se não mencionado, extrair literalmente)
- phone: Telefone/celular (null se não mencionado, extrair literalmente)
- cpfCnpj: CPF ou CNPJ (null se não mencionado, extrair literalmente)
- address: Endereço completo (null se não mencionado, extrair literalmente)
- notes: Observações relevantes capturadas do contexto do texto (null se não houver contexto relevante)

Responda APENAS com JSON válido no formato:
{
  "name": "nome do proprietário" ou null,
  "email": "email@exemplo.com" ou null,
  "phone": "telefone" ou null,
  "cpfCnpj": "CPF/CNPJ" ou null,
  "address": "endereço" ou null,
  "notes": "observações contextuais relevantes" ou null
}`;

  try {
    const responseText = await callOpenAI(prompt);
    
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }
    cleanedResponse = cleanedResponse.trim();

    const extraction = JSON.parse(cleanedResponse);
    
    return {
      name: extraction.name || "Novo Proprietário",
      email: extraction.email || undefined,
      phone: extraction.phone || undefined,
      cpfCnpj: extraction.cpfCnpj || undefined,
      address: extraction.address || undefined,
      notes: extraction.notes || undefined
    };
  } catch (error) {
    console.error("Error extracting owner data:", error);
    throw new Error("Failed to extract owner information from description");
  }
}

// Function to extract financial transaction data from description
export async function extractFinancialFromDescription(
  description: string
): Promise<FinancialExtraction> {
  const prompt = `Analise SOMENTE o texto da descrição da transação financeira fornecida e extraia as informações para cadastro.

Descrição fornecida pelo usuário:
${description}

Com base no texto acima, extraia:
1. Tipo da transação (entrada ou saída de dinheiro)
2. Categoria (ex: venda, aluguel, comissão, manutenção, impostos, etc.)
3. Valor em reais (apenas números)
4. Descrição detalhada da transação
5. Data da transação (se mencionada, no formato YYYY-MM-DD)
6. Frequência: detecte se é recorrente:
   - Se encontrar "toda semana", "toda segunda", "toda terça", "semanal", "semanalmente" → "semanal"
   - Se encontrar "todo mês", "todos os meses", "mensal", "mensalmente" → "mensal"
   - Se encontrar "todo ano", "anual", "anualmente" → "anual"
   - Caso contrário → "unico"
7. Dia da semana (apenas se frequência for semanal): extraia o dia da semana como número (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)
8. Dia do mês (apenas se frequência for mensal): se a transação for recorrente mensal, extraia o dia do mês (1-31). Se não estiver explícito, use o dia atual.

IMPORTANTE: Responda APENAS com JSON no formato:
{
  "type": "entrada" ou "saida",
  "category": "categoria da transação",
  "amount": "valor numérico",
  "description": "descrição detalhada da transação",
  "date": "YYYY-MM-DD",
  "frequencyType": "unico" ou "semanal" ou "mensal" ou "anual",
  "dayOfWeek": número de 0 a 6 (apenas se frequencyType for "semanal"),
  "dayOfMonth": número de 1 a 31 (apenas se frequencyType for "mensal")
}`;

  try {
    const responseText = await callOpenAI(prompt);
    
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.substring(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.substring(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
    }
    cleanedResponse = cleanedResponse.trim();

    const extraction = JSON.parse(cleanedResponse);
    
    // Validate and normalize type
    const validTypes = ["entrada", "saida"];
    let normalizedType = extraction.type?.toLowerCase() || "entrada";
    if (!validTypes.includes(normalizedType)) {
      normalizedType = "entrada";
    }
    
    // Validate and normalize frequency
    const validFrequencies = ["unico", "semanal", "mensal", "anual"];
    let normalizedFrequency = extraction.frequencyType?.toLowerCase() || "unico";
    if (!validFrequencies.includes(normalizedFrequency)) {
      normalizedFrequency = "unico";
    }
    
    // Clean amount to be numeric string only
    const amount = extraction.amount 
      ? String(extraction.amount).replace(/[^\d.]/g, '')
      : "0";
    
    // Get day of week if frequency is semanal
    let dayOfWeek: number | undefined;
    if (normalizedFrequency === "semanal") {
      if (extraction.dayOfWeek !== undefined && typeof extraction.dayOfWeek === 'number') {
        dayOfWeek = Math.min(Math.max(extraction.dayOfWeek, 0), 6);
      } else {
        // If no day specified, use current day of week
        dayOfWeek = new Date().getDay();
      }
    }
    
    // Get day of month if frequency is mensal
    let dayOfMonth: number | undefined;
    if (normalizedFrequency === "mensal") {
      if (extraction.dayOfMonth && typeof extraction.dayOfMonth === 'number') {
        dayOfMonth = Math.min(Math.max(extraction.dayOfMonth, 1), 31);
      } else {
        // If no day specified, use current day
        dayOfMonth = new Date().getDate();
      }
    }
    
    return {
      type: normalizedType as "entrada" | "saida",
      category: extraction.category || "Outras",
      amount,
      description: extraction.description || description,
      date: extraction.date || undefined,
      frequencyType: normalizedFrequency as "unico" | "semanal" | "mensal" | "anual",
      dayOfWeek,
      dayOfMonth,
      propertyId: undefined,
      clientId: undefined
    };
  } catch (error) {
    console.error("Error extracting financial data:", error);
    throw new Error("Failed to extract financial information from description");
  }
}

// Enrich scraped property data with AI to extract amenities and verify property type
export async function enrichScrapedPropertyData(rawData: {
  title: string;
  description: string;
  propertyType: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  area: string | null;
  landArea: string | null;
  amenities: string[];
}): Promise<{
  title: string;
  description: string;
  propertyType: "casa" | "apartamento" | "terreno" | "comercial";
  amenities: string[];
}> {
  try {
    const prompt = `Analise a descrição de um imóvel e extraia as comodidades/características reais mencionadas.

DESCRIÇÃO DO IMÓVEL:
${rawData.description}

TIPO DO IMÓVEL:
${rawData.propertyType}

INSTRUÇÕES:
1. Extraia SOMENTE comodidades/características reais que estão mencionadas na descrição
2. Exemplos de comodidades válidas: "Ar condicionado", "Portão elétrico", "Piscina", "Churrasqueira", "Varanda", "Garagem coberta", "Armários embutidos", "Quintal", "Lavanderia", etc.
3. NÃO crie comodidades genéricas como "Cama:", "Chuveiro:", "Camas:", "Garagens:" - extraia apenas características reais do imóvel
4. Confirme o tipo do imóvel baseado na descrição (casa, apartamento, terreno, ou comercial)

Retorne APENAS um objeto JSON válido no formato:
{
  "amenities": ["Comodidade 1", "Comodidade 2"],
  "propertyType": "casa"
}`;

    const response = await callOpenAI(prompt);
    
    let extraction: any;
    try {
      extraction = typeof response === 'string' ? JSON.parse(response) : response;
    } catch {
      extraction = response;
    }

    const validTypes = ['casa', 'apartamento', 'terreno', 'comercial'];
    const propertyType = validTypes.includes(extraction.propertyType) 
      ? extraction.propertyType 
      : rawData.propertyType;

    // Extract amenities only from AI (scraped amenities are ignored)
    const allAmenities = Array.isArray(extraction.amenities) 
      ? extraction.amenities.filter((a: string) => {
          const lower = a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          // Filter out generic items like "Cama:", "Chuveiro:", "Garagens: 2", "Quartos: 3", etc.
          const isGeneric = lower.match(/^(cama|chuveiro|banheiro|quarto|garagem|suite|vaga)(s|\(s\))?\s*[:;-]?\s*\d*$/i);
          return !isGeneric && a.length > 2 && a.length < 50;
        })
      : [];

    return {
      title: rawData.title, // Keep original title from scraping
      description: rawData.description, // Keep original description
      propertyType: propertyType as "casa" | "apartamento" | "terreno" | "comercial",
      amenities: allAmenities,
    };
  } catch (error) {
    console.error("Error enriching scraped data:", error);
    return {
      title: rawData.title,
      description: rawData.description,
      propertyType: rawData.propertyType as "casa" | "apartamento" | "terreno" | "comercial",
      amenities: rawData.amenities,
    };
  }
}
