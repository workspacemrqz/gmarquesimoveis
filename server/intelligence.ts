import { storage } from "./storage";
import { chatWithOllama, parseAIResponse } from "./ollama";
import type { Property, Neighborhood, Client, Owner, FinancialTransaction, InsertIntelligenceAuditLog } from "@shared/schema";
import { z } from "zod";

interface PendingAction {
  type: string;
  data: any;
  confirmationMessage: string;
  itemDetails?: any;
  images?: Array<{ base64Data: string; filename: string }>;
  selectedItemId?: string; // ID do item selecionado quando há múltiplos candidatos
}

interface PendingCandidates {
  type: string; // update_property, delete_property, etc.
  action: string; // O que será feito (ex: "atualizar preço")
  candidates: Array<{ id: string; title: string; details: string; confidence: number }>;
  data: any; // Dados originais da ação
  images?: Array<{ base64Data: string; filename: string }>;
}

interface MatchResult<T> {
  item: T;
  confidence: number;
}

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  actionResult?: string;
}

interface ConversationContext {
  sessionId: string;
  messages: ConversationMessage[];
  lastActivity: Date;
  entityReferences: {
    properties: Set<string>;
    neighborhoods: Set<string>;
    clients: Set<string>;
    owners: Set<string>;
    financials: Set<string>;
  };
}

const pendingActions = new Map<string, PendingAction>();
const pendingActionMessages = new Map<string, { userMessage: string; aiResponse: string }>();
const pendingCandidates = new Map<string, PendingCandidates>(); // Armazena candidatos quando há múltiplas opções
const conversationContexts = new Map<string, ConversationContext>();

const MAX_CONTEXT_MESSAGES = 10;
const CONTEXT_EXPIRY_MS = 30 * 60 * 1000;
const MAX_TOKENS_ESTIMATE = 10000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const chatMessageSchema = z.object({
  message: z.string()
    .min(1, "A mensagem não pode estar vazia")
    .max(5000, "A mensagem não pode exceder 5000 caracteres")
    .transform((val) => sanitizeInput(val)),
  images: z.array(z.object({
    base64Data: z.string(),
    filename: z.string(),
  })).optional(),
});

const executeActionSchema = z.object({
  messageId: z.string()
    .min(1, "O ID da mensagem é obrigatório"),
  confirmed: z.boolean({
    required_error: "A confirmação é obrigatória",
    invalid_type_error: "A confirmação deve ser verdadeiro ou falso"
  }),
});

const priceSchema = z.number()
  .positive("O preço deve ser um valor positivo")
  .max(1000000000, "O preço é muito alto (máximo: R$ 1.000.000.000)");

const emailSchema = z.string()
  .email("Formato de email inválido")
  .optional();

const idSchema = z.string()
  .min(1, "ID inválido")
  .regex(/^[a-zA-Z0-9_-]+$/, "ID contém caracteres inválidos");

async function fetchRelevantDataForQuery(message: string): Promise<string | null> {
  const lowerMessage = normalizeText(message);
  
  const isClientQuery = /\b(cliente|clientes|interessado|interesse|procura|quer|queria|querendo|busca|comprando)\b/i.test(lowerMessage);
  const isPropertyQuery = /\b(im[oó]vel|im[oó]veis|casa|casas|apartamento|terreno|propriedade)\b/i.test(lowerMessage);
  const isNeighborhoodQuery = /\b(bairro|bairros|regi[aã]o|localiza[cç][aã]o)\b/i.test(lowerMessage);
  const isOwnerQuery = /\b(propriet[aá]rio|propriet[aá]rios|dono|donos)\b/i.test(lowerMessage);
  const isFinancialQuery = /\b(financeiro|finan[cç]a|transa[cç][aã]o|receita|despesa|gastos)\b/i.test(lowerMessage);
  
  const isListingOrSearchQuery = /\b(tenho|tem|h[aá]|existe|lista|listar|mostra|mostrar|quantos|quantas|qual|quais)\b/i.test(lowerMessage);
  
  if (!isListingOrSearchQuery) {
    return null;
  }
  
  const contextParts: string[] = [];
  
  if (isClientQuery) {
    const clients = await storage.getClients();
    if (clients && clients.length > 0) {
      const clientList = clients.map((c: Client) => {
        const parts = [`- ${c.name}`];
        if (c.notes) parts.push(`(${c.notes})`);
        if (c.email) parts.push(`- Email: ${c.email}`);
        if (c.phone) parts.push(`- Tel: ${c.phone}`);
        return parts.join(' ');
      }).join('\n');
      contextParts.push(`CLIENTES CADASTRADOS:\n${clientList}`);
    } else {
      contextParts.push(`CLIENTES CADASTRADOS: Nenhum cliente cadastrado no momento.`);
    }
  }
  
  if (isPropertyQuery && !isClientQuery) {
    const propertiesData = await storage.getProperties();
    const properties = propertiesData.properties || [];
    if (properties && properties.length > 0) {
      const propList = properties.slice(0, 20).map((p: Property) => {
        const parts = [`- ${p.title}`];
        // Incluir o link com slug se disponível
        if (p.slug) {
          parts.push(`(Link: /imoveis/${p.slug})`);
        }
        if (p.price) parts.push(`R$ ${parseFloat(p.price).toLocaleString('pt-BR')}`);
        if (p.propertyType) parts.push(`(${p.propertyType})`);
        if (p.status) parts.push(`[${p.status}]`);
        return parts.join(' ');
      }).join('\n');
      contextParts.push(`IMÓVEIS CADASTRADOS (primeiros 20):\n${propList}`);
    } else {
      contextParts.push(`IMÓVEIS CADASTRADOS: Nenhum imóvel cadastrado no momento.`);
    }
  }
  
  if (isNeighborhoodQuery && !isClientQuery && !isPropertyQuery) {
    const neighborhoods = await storage.getNeighborhoods();
    if (neighborhoods && neighborhoods.length > 0) {
      const neighborhoodList = neighborhoods.map((n: Neighborhood) => `- ${n.name}`).join('\n');
      contextParts.push(`BAIRROS CADASTRADOS:\n${neighborhoodList}`);
    }
  }
  
  if (isOwnerQuery && !isClientQuery) {
    const owners = await storage.getOwners();
    if (owners && owners.length > 0) {
      const ownerList = owners.slice(0, 20).map((o: Owner) => {
        const parts = [`- ${o.name}`];
        if (o.email) parts.push(`(${o.email})`);
        if (o.phone) parts.push(`- Tel: ${o.phone}`);
        return parts.join(' ');
      }).join('\n');
      contextParts.push(`PROPRIETÁRIOS CADASTRADOS (primeiros 20):\n${ownerList}`);
    }
  }
  
  if (isFinancialQuery) {
    const financials = await storage.getFinancialTransactions();
    if (financials && financials.length > 0) {
      const financialList = financials.slice(0, 15).map(f => {
        const amount = parseFloat(f.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `- ${f.description}: ${amount} (${f.type}) - ${new Date(f.date).toLocaleDateString('pt-BR')}`;
      }).join('\n');
      contextParts.push(`TRANSAÇÕES FINANCEIRAS (últimas 15):\n${financialList}`);
    }
  }
  
  if (contextParts.length === 0) {
    return null;
  }
  
  return `[DADOS DO BANCO DE DADOS PARA CONSULTA]\n${contextParts.join('\n\n')}`;
}

function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const sanitized = email.toLowerCase().trim();
  try {
    emailSchema.parse(sanitized);
    return sanitized;
  } catch {
    return null;
  }
}

function validatePositiveNumber(value: any, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`${fieldName} deve ser um número válido`);
  }
  if (num < 0) {
    throw new Error(`${fieldName} deve ser um valor positivo`);
  }
  return num;
}

function validateId(id: any, entityName: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error(`ID de ${entityName} inválido`);
  }
  try {
    return idSchema.parse(id);
  } catch (error: any) {
    throw new Error(`ID de ${entityName} inválido: ${error.message}`);
  }
}

export class IntelligenceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public userMessage?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IntelligenceError';
  }
}

export class ValidationError extends IntelligenceError {
  constructor(message: string, details?: any) {
    super(
      message,
      400,
      `Erro de validação: ${message}. Por favor, verifique os dados e tente novamente.`,
      details
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends IntelligenceError {
  constructor(entityName: string) {
    super(
      `${entityName} não encontrado`,
      404,
      `${entityName} não encontrado. Por favor, verifique os dados e tente novamente.`
    );
    this.name = 'NotFoundError';
  }
}

export class TimeoutError extends IntelligenceError {
  constructor() {
    super(
      'Timeout ao processar requisição',
      503,
      'A requisição demorou muito para processar. Por favor, tente novamente em alguns instantes.'
    );
    this.name = 'TimeoutError';
  }
}

function getOrCreateContext(sessionId: string): ConversationContext {
  let context = conversationContexts.get(sessionId);
  
  if (!context) {
    context = {
      sessionId,
      messages: [],
      lastActivity: new Date(),
      entityReferences: {
        properties: new Set(),
        neighborhoods: new Set(),
        clients: new Set(),
        owners: new Set(),
        financials: new Set(),
      },
    };
    conversationContexts.set(sessionId, context);
    console.log('[Intelligence] Nova conversa criada para sessão:', sessionId);
  }
  
  context.lastActivity = new Date();
  return context;
}

function addMessageToContext(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  actionResult?: string
): void {
  const context = getOrCreateContext(sessionId);
  
  context.messages.push({
    role,
    content,
    timestamp: new Date(),
    actionResult,
  });
  
  if (context.messages.length > MAX_CONTEXT_MESSAGES) {
    context.messages = context.messages.slice(-MAX_CONTEXT_MESSAGES);
  }
  
  context.lastActivity = new Date();
}

function addEntityReference(
  sessionId: string,
  entityType: 'properties' | 'neighborhoods' | 'clients' | 'owners' | 'financials',
  entityId: string
): void {
  const context = getOrCreateContext(sessionId);
  context.entityReferences[entityType].add(entityId);
}

function getContextForOllama(sessionId: string): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const context = conversationContexts.get(sessionId);
  
  if (!context || context.messages.length === 0) {
    return [];
  }
  
  let messages = [...context.messages];
  
  let totalChars = 0;
  const maxChars = MAX_TOKENS_ESTIMATE * CHARS_PER_TOKEN_ESTIMATE;
  
  const recentMessages: ConversationMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgChars = msg.content.length + (msg.actionResult?.length || 0);
    
    if (totalChars + msgChars > maxChars && recentMessages.length >= 4) {
      break;
    }
    
    recentMessages.unshift(msg);
    totalChars += msgChars;
  }
  
  return recentMessages.map(msg => {
    let content = msg.content;
    if (msg.actionResult) {
      content += `\n[Ação executada: ${msg.actionResult}]`;
    }
    return {
      role: msg.role,
      content,
    };
  });
}

export function clearContext(sessionId: string): void {
  conversationContexts.delete(sessionId);
  console.log('[Intelligence] Contexto limpo para sessão:', sessionId);
}

export function getContextInfo(sessionId: string): { messageCount: number; hasContext: boolean } {
  const context = conversationContexts.get(sessionId);
  return {
    hasContext: !!context && context.messages.length > 0,
    messageCount: context?.messages.length || 0,
  };
}

function cleanExpiredContexts(): void {
  const now = new Date();
  let cleanedCount = 0;
  
  const entries = Array.from(conversationContexts.entries());
  for (const [sessionId, context] of entries) {
    const timeSinceLastActivity = now.getTime() - context.lastActivity.getTime();
    
    if (timeSinceLastActivity > CONTEXT_EXPIRY_MS) {
      conversationContexts.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log('[Intelligence] Limpeza automática: removidos', cleanedCount, 'contextos expirados');
  }
}

setInterval(cleanExpiredContexts, 5 * 60 * 1000);

async function logAuditAction(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  userMessage?: string;
  aiResponse?: string;
  status: 'success' | 'failed' | 'cancelled';
  errorMessage?: string;
}): Promise<void> {
  try {
    const logData: InsertIntelligenceAuditLog = {
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      details: params.details || null,
      userMessage: params.userMessage || null,
      aiResponse: params.aiResponse || null,
      status: params.status,
      errorMessage: params.errorMessage || null,
    };
    
    await storage.createIntelligenceAuditLog(logData);
    console.log('[Intelligence] Log de auditoria criado:', params.action, params.status);
  } catch (error) {
    console.error('[Intelligence] Erro ao criar log de auditoria:', error);
  }
}

export function validateChatMessage(data: any): { message: string; images?: Array<{ base64Data: string; filename: string }> } {
  try {
    return chatMessageSchema.parse(data);
  } catch (error: any) {
    console.error('[Intelligence] Erro de validação na mensagem de chat:', error.errors || error.message);
    throw new ValidationError(
      error.errors?.[0]?.message || 'Mensagem inválida',
      error.errors
    );
  }
}

export function validateExecuteAction(data: any): { messageId: string; confirmed: boolean } {
  try {
    return executeActionSchema.parse(data);
  } catch (error: any) {
    console.error('[Intelligence] Erro de validação na execução de ação:', error.errors || error.message);
    throw new ValidationError(
      error.errors?.[0]?.message || 'Dados de ação inválidos',
      error.errors
    );
  }
}

function parseUserSelection(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  
  const ordinalMap: Record<string, number> = {
    'primeiro': 1, 'primeira': 1,
    'segundo': 2, 'segunda': 2,
    'terceiro': 3, 'terceira': 3,
    'quarto': 4, 'quarta': 4,
    'quinto': 5, 'quinta': 5,
  };
  
  for (const [ordinal, num] of Object.entries(ordinalMap)) {
    if (normalized.includes(ordinal)) {
      console.log(`[Intelligence] Detectado ordinal "${ordinal}" → número ${num}`);
      return num;
    }
  }
  
  const numberMatch = normalized.match(/(?:opção|número|escolho|item|o)?\s*(\d+)/i);
  if (numberMatch && numberMatch[1]) {
    const num = parseInt(numberMatch[1], 10);
    console.log(`[Intelligence] Número extraído da entrada "${input}" → ${num}`);
    return num;
  }
  
  console.log(`[Intelligence] Nenhum número ou ordinal detectado em "${input}"`);
  return null;
}

export async function processUserMessage(
  message: string,
  sessionId?: string,
  images?: Array<{ base64Data: string; filename: string }>
): Promise<{
  message: string;
  action?: PendingAction;
  messageId?: string;
  propertyImages?: Array<{
    id: string;
    title: string;
    images: string[];
  }>;
}> {
  const actualSessionId = sessionId || 'default';
  console.log('[Intelligence] Processando mensagem do usuário (sessão:', actualSessionId, '):', message.substring(0, 100));
  
  if (images && images.length > 0) {
    console.log('[Intelligence] ✅ Recebeu', images.length, 'imagens no backend');
    images.forEach((img, idx) => {
      console.log(`[Intelligence] Imagem ${idx + 1}:`, img.filename, '- Tamanho base64:', img.base64Data.length);
    });
  } else {
    console.log('[Intelligence] ⚠️ Nenhuma imagem recebida no backend');
  }
  
  try {
    if (!message || typeof message !== 'string') {
      console.error('[Intelligence] Mensagem inválida recebida:', typeof message);
      throw new ValidationError('Mensagem deve ser uma string não vazia');
    }

    const sanitizedMessage = sanitizeInput(message);
    
    if (!sanitizedMessage || sanitizedMessage.trim().length === 0) {
      console.error('[Intelligence] Mensagem vazia após sanitização');
      throw new ValidationError('Mensagem não pode estar vazia');
    }

    if (sanitizedMessage.length > 5000) {
      console.error('[Intelligence] Mensagem muito longa:', sanitizedMessage.length);
      throw new ValidationError('Mensagem muito longa (máximo: 5000 caracteres)');
    }

    const selection = parseUserSelection(sanitizedMessage);
    
    if (selection !== null) {
      console.log(`[Intelligence] Detectada tentativa de seleção: ${selection}`);
      console.log(`[Intelligence] ${pendingCandidates.size} grupos de candidatos pendentes`);
      
      Array.from(pendingCandidates.entries()).forEach(([id, data]) => {
        console.log(`  - Grupo ${id}: ${data.candidates.length} candidatos (${data.action})`);
      });
      
      if (pendingCandidates.size === 0) {
        console.log('[Intelligence] Número detectado mas sem candidatos pendentes');
        addMessageToContext(actualSessionId, 'user', sanitizedMessage);
      } else {
        for (const [candidateId, candidateData] of Array.from(pendingCandidates.entries())) {
          if (selection < 1 || selection > candidateData.candidates.length) {
            console.warn(`[Intelligence] Seleção ${selection} fora do range (1-${candidateData.candidates.length})`);
            continue;
          }
          
          console.log(`[Intelligence] ✅ Usuário selecionou opção ${selection} de ${candidateData.candidates.length} candidatos`);
          
          const selectedCandidate = candidateData.candidates[selection - 1];
          console.log(`[Intelligence] Candidato selecionado: "${selectedCandidate.title}" (ID: ${selectedCandidate.id}, Confiança: ${selectedCandidate.confidence})`);
          
          const confirmedAction: PendingAction = {
            type: candidateData.type,
            data: { ...candidateData.data, id: selectedCandidate.id },
            selectedItemId: selectedCandidate.id,
            confirmationMessage: `Confirmar ${candidateData.action} "${selectedCandidate.title}"?`,
            images: candidateData.images
          };
          
          const messageId = Date.now().toString();
          pendingActions.set(messageId, confirmedAction);
          pendingActionMessages.set(messageId, {
            userMessage: sanitizedMessage,
            aiResponse: `Perfeito! Vou ${candidateData.action} o item "${selectedCandidate.title}". Confirma?`
          });
          
          pendingCandidates.delete(candidateId);
          console.log(`[Intelligence] Candidatos pendentes removidos. Ação criada com ID: ${messageId}`);
          
          addMessageToContext(actualSessionId, 'user', sanitizedMessage);
          addMessageToContext(actualSessionId, 'assistant', `Perfeito! Vou ${candidateData.action} "${selectedCandidate.title}". Confirma?`);
          
          setTimeout(() => {
            pendingActions.delete(messageId);
            pendingActionMessages.delete(messageId);
            console.log(`[Intelligence] Ação ${messageId} expirada e removida`);
          }, 5 * 60 * 1000);
          
          return {
            message: `Você selecionou: **${selectedCandidate.title}**\n${selectedCandidate.details}\n\nDeseja confirmar esta ${candidateData.action}?`,
            action: confirmedAction,
            messageId
          };
        }
        
        if (pendingCandidates.size > 0) {
          const candidateData = Array.from(pendingCandidates.values())[0];
          const feedbackMessage = `Seleção inválida. Por favor, escolha um número entre 1 e ${candidateData.candidates.length}.`;
          console.log(`[Intelligence] ${feedbackMessage}`);
          
          addMessageToContext(actualSessionId, 'user', sanitizedMessage);
          addMessageToContext(actualSessionId, 'assistant', feedbackMessage);
          
          return {
            message: feedbackMessage
          };
        }
      }
    }

    addMessageToContext(actualSessionId, 'user', sanitizedMessage);

    const conversationHistory = getContextForOllama(actualSessionId);
    console.log('[Intelligence] Contexto de conversa:', conversationHistory.length, 'mensagens');

    const contextData = await fetchRelevantDataForQuery(sanitizedMessage);
    
    let enrichedMessage = sanitizedMessage;
    if (contextData) {
      enrichedMessage = `${sanitizedMessage}\n\n${contextData}`;
      console.log('[Intelligence] Mensagem enriquecida com dados do banco');
    }

    console.log('[Intelligence] Mensagem sanitizada, enviando para Ollama com contexto...');
    
    const settings = await storage.getSettings();
    const companySetting = settings.find((s) => s.key === 'companyName');
    const companyName = companySetting?.value || 'G Marques Imóveis';
    
    // Obter o domínio do site para usar nos links
    const siteDomain = process.env.DOMAIN || 'localhost:3000';
    
    let aiResponse: string;
    try {
      aiResponse = await chatWithOllama(enrichedMessage, conversationHistory, companyName, siteDomain);
    } catch (error: any) {
      console.error('[Intelligence] Erro ao chamar Ollama:', error.message, error.stack);
      
      if (error.message?.includes('timeout') || error.message?.includes('demorou')) {
        throw new TimeoutError();
      }
      
      if (error.message?.includes('indisponível') || error.message?.includes('servidor')) {
        throw new IntelligenceError(
          'Serviço de IA indisponível',
          503,
          'O serviço de inteligência artificial está temporariamente indisponível. Por favor, tente novamente em alguns instantes.'
        );
      }
      
      throw new IntelligenceError(
        `Erro ao processar mensagem: ${error.message}`,
        500,
        'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
      );
    }

    console.log('[Intelligence] Resposta recebida do Ollama, parseando...');
    const parsed = parseAIResponse(aiResponse);

    validateConfirmationRequirement(sanitizedMessage, parsed);

    addMessageToContext(actualSessionId, 'assistant', parsed.message);

    if (parsed.needsConfirmation && parsed.action) {
      console.log('[Intelligence] Ação requer confirmação:', parsed.action.type);
      
      const messageId = Date.now().toString();
      
      try {
        const enrichedAction = await enrichActionWithDetails(parsed.action);
        
        if (images && images.length > 0) {
          enrichedAction.images = images;
          console.log('[Intelligence] Imagens anexadas à ação:', images.length);
        }
        
        pendingActions.set(messageId, enrichedAction);
        pendingActionMessages.set(messageId, {
          userMessage: sanitizedMessage,
          aiResponse: parsed.message,
        });
        console.log('[Intelligence] Ação pendente armazenada com ID:', messageId);

        setTimeout(() => {
          pendingActions.delete(messageId);
          pendingActionMessages.delete(messageId);
          console.log('[Intelligence] Ação pendente expirada:', messageId);
        }, 5 * 60 * 1000);

        return {
          message: parsed.message,
          action: enrichedAction,
          messageId,
        };
      } catch (error: any) {
        console.error('[Intelligence] Erro ao enriquecer ação:', error.message, error.stack);
        throw new IntelligenceError(
          `Erro ao processar ação: ${error.message}`,
          500,
          'Erro ao processar a ação solicitada. Por favor, tente reformular sua pergunta.'
        );
      }
    }

    console.log('[Intelligence] Resposta de consulta processada com sucesso');
    
    // Detectar e enriquecer menções de propriedades
    const propertyImages = await extractPropertyImages(parsed.message);
    
    return {
      message: parsed.message,
      propertyImages: propertyImages.length > 0 ? propertyImages : undefined,
    };
  } catch (error: any) {
    if (error instanceof IntelligenceError) {
      throw error;
    }
    
    console.error('[Intelligence] Erro inesperado ao processar mensagem:', error.message, error.stack);
    throw new IntelligenceError(
      `Erro inesperado: ${error.message}`,
      500,
      'Ocorreu um erro inesperado. Por favor, tente novamente.'
    );
  }
}

const MODIFICATION_KEYWORDS = [
  'altere', 'alterar', 'mude', 'mudar', 'modifique', 'modificar',
  'atualize', 'atualizar', 'edite', 'editar', 'corrija', 'corrigir',
  'crie', 'criar', 'cadastre', 'cadastrar', 'adicione', 'adicionar', 'insira', 'inserir',
  'exclua', 'excluir', 'delete', 'deletar', 'remova', 'remover', 'apague', 'apagar',
  'marque', 'marcar', 'desmarque', 'desmarcar',
  'associe', 'associar', 'desassocie', 'desassociar', 'vincule', 'vincular',
  'configure', 'configurar', 'defina', 'definir', 'estabeleça', 'estabelecer',
  'aumente', 'aumentar', 'diminua', 'diminuir', 'reduza', 'reduzir',
  'troque', 'trocar', 'substitua', 'substituir', 'renomeie', 'renomear'
];

const MUTATION_ACTION_TYPES = [
  'update_property', 'create_property', 'delete_property',
  'update_neighborhood', 'create_neighborhood', 'delete_neighborhood',
  'update_client', 'create_client', 'delete_client',
  'update_owner', 'create_owner', 'delete_owner',
  'update_financial', 'create_financial', 'delete_financial'
];

function detectsModificationIntent(message: string): boolean {
  const normalized = normalizeText(message);
  
  return MODIFICATION_KEYWORDS.some(keyword => 
    normalized.includes(keyword.toLowerCase())
  );
}

function validateConfirmationRequirement(
  userMessage: string,
  parsedResponse: { needsConfirmation: boolean; action?: any; message: string }
): void {
  const hasModificationIntent = detectsModificationIntent(userMessage);
  
  if (hasModificationIntent && !parsedResponse.needsConfirmation) {
    console.warn('[Intelligence] ⚠️ ALERTA DE SEGURANÇA: Mensagem do usuário parece solicitar modificação mas IA não retornou needsConfirmation!');
    console.warn('[Intelligence] Mensagem do usuário:', userMessage);
    console.warn('[Intelligence] Resposta da IA:', parsedResponse.message);
    console.warn('[Intelligence] A IA deveria ter solicitado confirmação mas não o fez.');
  }
  
  if (parsedResponse.action && MUTATION_ACTION_TYPES.includes(parsedResponse.action.type)) {
    if (!parsedResponse.needsConfirmation) {
      console.error('[Intelligence] ❌ ERRO CRÍTICO: Ação de modificação retornada sem needsConfirmation!');
      console.error('[Intelligence] Tipo de ação:', parsedResponse.action.type);
      console.error('[Intelligence] Forçando needsConfirmation = true para segurança');
      
      parsedResponse.needsConfirmation = true;
      
      if (!parsedResponse.action.confirmationMessage) {
        parsedResponse.action.confirmationMessage = 'Confirma que deseja executar esta modificação?';
      }
    }
  }
}

function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function levenshteinDistance(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[len1][len2];
}

function fuzzyMatch(str1: string, str2: string, threshold: number = 0.6): number {
  if (!str1 || !str2) return 0;
  
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return 0.9 * (shorter / longer);
  }
  
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(s1.length, s2.length);
  
  if (maxLen === 0) return 1;
  
  const similarity = 1 - (distance / maxLen);
  
  return similarity >= threshold ? similarity : 0;
}

function parsePriceRange(priceInput: string | number | [number, number]): [number, number] | null {
  if (Array.isArray(priceInput)) {
    return priceInput;
  }
  
  if (typeof priceInput === 'number') {
    const variance = priceInput * 0.1;
    return [priceInput - variance, priceInput + variance];
  }
  
  if (typeof priceInput === 'string') {
    const normalized = normalizeText(priceInput);
    
    const aroundMatch = normalized.match(/em\s*torno\s*de\s*([\d.,]+)/);
    if (aroundMatch) {
      const value = parseFloat(aroundMatch[1].replace(/\./g, '').replace(',', '.'));
      const variance = value * 0.1;
      return [value - variance, value + variance];
    }
    
    const numericValue = parseFloat(priceInput.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(numericValue)) {
      const variance = numericValue * 0.1;
      return [numericValue - variance, numericValue + variance];
    }
  }
  
  return null;
}

function scoreAmenityMatch(propertyAmenities: string[], searchAmenity: string): number {
  if (!propertyAmenities || !searchAmenity) return 0;
  
  const normalized = normalizeText(searchAmenity);
  let bestScore = 0;
  
  for (const amenity of propertyAmenities) {
    const amenityNormalized = normalizeText(amenity);
    
    if (amenityNormalized.includes(normalized) || normalized.includes(amenityNormalized)) {
      bestScore = Math.max(bestScore, 0.9);
    }
    
    const fuzzyScore = fuzzyMatch(amenity, searchAmenity, 0.5);
    bestScore = Math.max(bestScore, fuzzyScore);
  }
  
  return bestScore;
}

async function enrichActionWithDetails(action: PendingAction): Promise<PendingAction> {
  try {
    const enriched = { ...action };

    if (action.type.includes('property')) {
      const results = await findProperty(action.data);
      if (results.length > 0) {
        if (results.length === 1) {
          enriched.itemDetails = {
            property: results[0].item,
            confidence: results[0].confidence,
            changes: extractChanges(action.data, results[0].item),
          };
        } else {
          enriched.itemDetails = {
            multipleMatches: results,
            message: `Encontrados ${results.length} imóveis que correspondem à busca. Por favor, especifique melhor.`,
          };
        }
      }
    } else if (action.type.includes('neighborhood')) {
      const results = await findNeighborhood(action.data);
      if (results.length > 0) {
        if (results.length === 1) {
          enriched.itemDetails = {
            neighborhood: results[0].item,
            confidence: results[0].confidence,
          };
        } else {
          enriched.itemDetails = {
            multipleMatches: results,
            message: `Encontrados ${results.length} bairros que correspondem à busca.`,
          };
        }
      }
    } else if (action.type.includes('client')) {
      const results = await findClient(action.data);
      if (results.length > 0) {
        if (results.length === 1) {
          enriched.itemDetails = {
            client: results[0].item,
            confidence: results[0].confidence,
          };
        } else {
          enriched.itemDetails = {
            multipleMatches: results,
            message: `Encontrados ${results.length} clientes que correspondem à busca.`,
          };
        }
      }
    } else if (action.type.includes('owner')) {
      const results = await findOwner(action.data);
      if (results.length > 0) {
        if (results.length === 1) {
          enriched.itemDetails = {
            owner: results[0].item,
            confidence: results[0].confidence,
          };
        } else {
          enriched.itemDetails = {
            multipleMatches: results,
            message: `Encontrados ${results.length} proprietários que correspondem à busca.`,
          };
        }
      }
    } else if (action.type.includes('financial')) {
      const results = await findFinancialTransaction(action.data);
      if (results.length > 0) {
        if (results.length === 1) {
          enriched.itemDetails = {
            transaction: results[0].item,
            confidence: results[0].confidence,
          };
        } else {
          enriched.itemDetails = {
            multipleMatches: results,
            message: `Encontradas ${results.length} transações que correspondem à busca.`,
          };
        }
      }
    }

    return enriched;
  } catch (error) {
    console.error("Erro ao enriquecer ação:", error);
    return action;
  }
}

function extractChanges(data: any, current: any): Record<string, any> {
  const changes: Record<string, any> = {};
  
  for (const key in data) {
    if (key !== 'searchCriteria' && key !== 'id' && data[key] !== undefined && data[key] !== current[key]) {
      changes[key] = data[key];
    }
  }
  
  return changes;
}

async function extractPropertyImages(message: string): Promise<Array<{
  id: string;
  title: string;
  images: string[];
}>> {
  try {
    const propertyImages: Array<{
      id: string;
      title: string;
      images: string[];
    }> = [];
    
    // Detectar padrões de ID de imóvel na mensagem (ex: "#114", "Imóvel #114")
    const propertyIdPattern = /#(\d+)/g;
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = propertyIdPattern.exec(message)) !== null) {
      matches.push(match);
    }
    
    if (matches.length > 0) {
      const properties = await storage.getPropertiesLegacy({});
      
      for (const match of matches) {
        const propertyNumber = match[1];
        // Buscar propriedade pelo número no título
        const property = properties.find(p => 
          p.title.includes(`#${propertyNumber}`)
        );
        
        if (property && property.images && property.images.length > 0) {
          // Se for apenas uma propriedade, mostrar até 3 imagens
          // Se forem múltiplas propriedades (lista), mostrar apenas a primeira (featured)
          const imagesToShow = matches.length === 1 
            ? property.images.slice(0, 3) 
            : [property.images[0]];
            
          propertyImages.push({
            id: property.id,
            title: property.title,
            images: imagesToShow
          });
        }
      }
    }
    
    // Detectar se a mensagem menciona propriedades específicas em Camburi, Casa Branca, etc
    const neighborhoodMentions = [
      'Camburi', 'Casa Branca', 'Maresias', 'Juquehy', 'Boiçucanga', 
      'Toque Toque', 'Paúba', 'Santiago', 'Guaecá', 'Barequeçaba'
    ];
    
    for (const neighborhood of neighborhoodMentions) {
      if (message.includes(neighborhood)) {
        // Se a mensagem lista propriedades em um bairro específico e inclui IDs
        // as imagens já foram capturadas acima
        break;
      }
    }
    
    console.log('[Intelligence] Imagens de propriedades extraídas:', propertyImages.length);
    return propertyImages;
    
  } catch (error) {
    console.error('[Intelligence] Erro ao extrair imagens de propriedades:', error);
    return [];
  }
}

async function findProperty(data: any): Promise<MatchResult<Property>[]> {
  try {
    if (data.id) {
      const property = await storage.getProperty(data.id);
      return property ? [{ item: property, confidence: 1.0 }] : [];
    }

    if (data.searchCriteria) {
      const { neighborhood, priceRange, title, amenities } = data.searchCriteria;
      
      console.log('[Intelligence] Buscando imóvel com critérios:', { 
        neighborhood, 
        priceRange, 
        title, 
        amenities 
      });
      
      const properties = await storage.getPropertiesLegacy({});
      console.log('[Intelligence] Total de imóveis no banco:', properties.length);
      const scoredMatches: Array<{ property: Property; score: number }> = [];
      
      for (const property of properties) {
        let totalScore = 0;
        let criteriaCount = 0;
        
        if (neighborhood && neighborhood.trim()) {
          criteriaCount++;
          const neighborhoodsData = await storage.getNeighborhoods();
          const propertyNeighborhood = neighborhoodsData.find((n: any) => n.id === property.neighborhoodId);
          
          if (propertyNeighborhood) {
            const neighborhoodScore = fuzzyMatch(propertyNeighborhood.name, neighborhood, 0.5);
            totalScore += neighborhoodScore;
          }
        }
        
        if (priceRange) {
          criteriaCount++;
          let range = parsePriceRange(priceRange);
          if (range) {
            // Se a faixa for exata (min == max), expandir com margem de ±15%
            if (range[0] === range[1]) {
              const margin = range[0] * 0.15;
              range = [range[0] - margin, range[1] + margin];
            }
            
            const price = parseFloat(property.price.toString());
            const mid = (range[0] + range[1]) / 2;
            const diff = Math.abs(price - mid);
            const maxRange = range[1] - range[0];
            
            // Score dentro da faixa: 1.0 a 0.7
            if (price >= range[0] && price <= range[1]) {
              totalScore += 1 - (diff / mid) * 0.3;
            } 
            // Score fora da faixa mas próximo (até 30% de distância): 0.6 a 0.3
            else if (diff <= mid * 0.3) {
              totalScore += 0.6 - (diff / mid) * 0.3;
            }
          }
        }
        
        if (title && title.trim()) {
          criteriaCount++;
          const titleScore = fuzzyMatch(property.title, title, 0.3); // Reduzido threshold de 0.4 para 0.3
          if (titleScore > 0) {
            totalScore += titleScore;
          }
          
          const descScore = fuzzyMatch(property.description || '', title, 0.3);
          if (descScore > 0) {
            totalScore += descScore * 0.5; // Reduzido peso da descrição
          }
        }
        
        if (amenities && Array.isArray(amenities) && property.amenities) {
          criteriaCount++;
          let amenityScore = 0;
          for (const searchAmenity of amenities) {
            const score = scoreAmenityMatch(property.amenities, searchAmenity);
            amenityScore = Math.max(amenityScore, score);
          }
          totalScore += amenityScore;
        }
        
        if (criteriaCount > 0) {
          const avgScore = totalScore / criteriaCount;
          if (avgScore >= 0.3) { // Reduzido threshold de 0.4 para 0.3
            scoredMatches.push({ property, score: avgScore });
          }
        }
      }
      
      scoredMatches.sort((a, b) => b.score - a.score);
      
      console.log('[Intelligence] Imóveis encontrados:', scoredMatches.length);
      if (scoredMatches.length > 0) {
        console.log('[Intelligence] Top 3 matches:', scoredMatches.slice(0, 3).map(m => ({
          title: m.property.title,
          price: m.property.price,
          score: m.score.toFixed(3)
        })));
      }
      
      return scoredMatches.slice(0, 10).map(({ property, score }) => ({
        item: property,
        confidence: score,
      }));
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar imóvel:", error);
    return [];
  }
}

async function findNeighborhood(data: any): Promise<MatchResult<Neighborhood>[]> {
  try {
    if (data.id) {
      const neighborhood = await storage.getNeighborhood(data.id);
      return neighborhood ? [{ item: neighborhood, confidence: 1.0 }] : [];
    }

    if (data.name) {
      const neighborhoods = await storage.getNeighborhoods();
      const scoredMatches: Array<{ neighborhood: Neighborhood; score: number }> = [];
      
      for (const neighborhood of neighborhoods) {
        const nameScore = fuzzyMatch(neighborhood.name, data.name, 0.4);
        if (nameScore > 0) {
          scoredMatches.push({ neighborhood, score: nameScore });
        }
      }
      
      scoredMatches.sort((a, b) => b.score - a.score);
      
      return scoredMatches.slice(0, 10).map(({ neighborhood, score }) => ({
        item: neighborhood,
        confidence: score,
      }));
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar bairro:", error);
    return [];
  }
}

async function findClient(data: any): Promise<MatchResult<Client>[]> {
  try {
    if (data.id) {
      const client = await storage.getClient(data.id);
      return client ? [{ item: client, confidence: 1.0 }] : [];
    }

    if (data.name || data.email) {
      const clients = await storage.getClients();
      const scoredMatches: Array<{ client: Client; score: number }> = [];
      
      for (const client of clients) {
        let totalScore = 0;
        let criteriaCount = 0;
        
        if (data.name) {
          criteriaCount++;
          const nameScore = fuzzyMatch(client.name, data.name, 0.5);
          totalScore += nameScore;
        }
        
        if (data.email && client.email) {
          criteriaCount++;
          const emailScore = normalizeText(client.email) === normalizeText(data.email) ? 1.0 : 0;
          totalScore += emailScore;
        }
        
        if (criteriaCount > 0) {
          const avgScore = totalScore / criteriaCount;
          if (avgScore >= 0.4) {
            scoredMatches.push({ client, score: avgScore });
          }
        }
      }
      
      scoredMatches.sort((a, b) => b.score - a.score);
      
      return scoredMatches.slice(0, 10).map(({ client, score }) => ({
        item: client,
        confidence: score,
      }));
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    return [];
  }
}

async function findOwner(data: any): Promise<MatchResult<Owner>[]> {
  try {
    if (data.id) {
      const owner = await storage.getOwner(data.id);
      return owner ? [{ item: owner, confidence: 1.0 }] : [];
    }

    if (data.name || data.email) {
      const owners = await storage.getOwners();
      const scoredMatches: Array<{ owner: Owner; score: number }> = [];
      
      for (const owner of owners) {
        let totalScore = 0;
        let criteriaCount = 0;
        
        if (data.name) {
          criteriaCount++;
          const nameScore = fuzzyMatch(owner.name, data.name, 0.5);
          totalScore += nameScore;
        }
        
        if (data.email && owner.email) {
          criteriaCount++;
          const emailScore = normalizeText(owner.email) === normalizeText(data.email) ? 1.0 : 0;
          totalScore += emailScore;
        }
        
        if (criteriaCount > 0) {
          const avgScore = totalScore / criteriaCount;
          if (avgScore >= 0.4) {
            scoredMatches.push({ owner, score: avgScore });
          }
        }
      }
      
      scoredMatches.sort((a, b) => b.score - a.score);
      
      return scoredMatches.slice(0, 10).map(({ owner, score }) => ({
        item: owner,
        confidence: score,
      }));
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar proprietário:", error);
    return [];
  }
}

async function findFinancialTransaction(data: any): Promise<MatchResult<FinancialTransaction>[]> {
  try {
    if (data.id) {
      const transaction = await storage.getFinancialTransaction(data.id);
      return transaction ? [{ item: transaction, confidence: 1.0 }] : [];
    }

    if (data.description) {
      const transactions = await storage.getFinancialTransactions();
      const scoredMatches: Array<{ transaction: FinancialTransaction; score: number }> = [];
      
      for (const transaction of transactions) {
        const descScore = fuzzyMatch(transaction.description, data.description, 0.4);
        if (descScore > 0) {
          scoredMatches.push({ transaction, score: descScore });
        }
      }
      
      scoredMatches.sort((a, b) => b.score - a.score);
      
      return scoredMatches.slice(0, 10).map(({ transaction, score }) => ({
        item: transaction,
        confidence: score,
      }));
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar transação financeira:", error);
    return [];
  }
}

export async function executeAction(
  messageId: string,
  confirmed: boolean,
  userId?: string,
  sessionId?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  const actualSessionId = sessionId || 'default';
  console.log('[Intelligence] Executando ação - messageId:', messageId, 'confirmed:', confirmed, 'sessão:', actualSessionId);
  
  try {
    if (!messageId || typeof messageId !== 'string') {
      console.error('[Intelligence] ID de mensagem inválido:', messageId);
      throw new ValidationError('ID de mensagem inválido');
    }

    if (typeof confirmed !== 'boolean') {
      console.error('[Intelligence] Valor de confirmação inválido:', typeof confirmed);
      throw new ValidationError('Confirmação deve ser verdadeiro ou falso');
    }

    const action = pendingActions.get(messageId);
    const messages = pendingActionMessages.get(messageId);
    
    if (!action) {
      console.warn('[Intelligence] Ação não encontrada ou expirada:', messageId);
      throw new NotFoundError('Ação');
    }

    if (!confirmed) {
      console.log('[Intelligence] Ação cancelada pelo usuário:', messageId);
      
      const entityType = action.type.split('_').slice(1).join('_');
      await logAuditAction({
        userId,
        action: action.type,
        entityType: entityType,
        details: { data: action.data },
        userMessage: messages?.userMessage,
        aiResponse: messages?.aiResponse,
        status: 'cancelled',
      });
      
      addMessageToContext(actualSessionId, 'assistant', 'Ação cancelada.', 'Ação cancelada pelo usuário');
      
      pendingActions.delete(messageId);
      pendingActionMessages.delete(messageId);
      return {
        success: false,
        message: "Ação cancelada pelo usuário.",
      };
    }

    console.log('[Intelligence] Executando ação confirmada:', action.type);
    
    try {
      const result = await performAction(action, userId, messages);
      
      addMessageToContext(actualSessionId, 'assistant', result.message, `Ação executada: ${action.type}`);
      
      pendingActions.delete(messageId);
      pendingActionMessages.delete(messageId);
      console.log('[Intelligence] Ação executada com sucesso:', action.type);
      return result;
    } catch (error: any) {
      console.error('[Intelligence] Erro ao executar ação:', action.type, error.message, error.stack);
      
      const entityType = action.type.split('_').slice(1).join('_');
      await logAuditAction({
        userId,
        action: action.type,
        entityType: entityType,
        details: { data: action.data, error: error.message },
        userMessage: messages?.userMessage,
        aiResponse: messages?.aiResponse,
        status: 'failed',
        errorMessage: error.message,
      });
      
      addMessageToContext(actualSessionId, 'assistant', `Erro: ${error.message}`, `Ação falhou: ${action.type}`);
      
      pendingActions.delete(messageId);
      pendingActionMessages.delete(messageId);
      
      if (error instanceof IntelligenceError) {
        throw error;
      }
      
      throw new IntelligenceError(
        `Erro ao executar ação: ${error.message}`,
        500,
        `Erro ao executar a ação solicitada: ${error.message}. Por favor, tente novamente.`
      );
    }
  } catch (error: any) {
    if (error instanceof IntelligenceError) {
      return {
        success: false,
        message: error.userMessage || error.message,
      };
    }
    
    console.error('[Intelligence] Erro inesperado ao executar ação:', error.message, error.stack);
    return {
      success: false,
      message: `Erro inesperado ao executar ação: ${error.message}`,
    };
  }
}

async function performAction(
  action: PendingAction, 
  userId?: string,
  messages?: { userMessage: string; aiResponse: string }
): Promise<{
  success: boolean;
  message: string;
}> {
  // Mapear tipos alternativos para os tipos corretos
  const actionTypeMap: Record<string, string> = {
    'create_transaction': 'create_financial',
    'update_transaction': 'update_financial',
    'delete_transaction': 'delete_financial',
  };
  
  const normalizedType = actionTypeMap[action.type] || action.type;
  
  switch (normalizedType) {
    case "update_property":
      return await updateProperty(action, userId, messages);
    case "create_property":
      return await createProperty(action, userId, messages);
    case "delete_property":
      return await deleteProperty(action, userId, messages);
    case "update_neighborhood":
      return await updateNeighborhood(action, userId, messages);
    case "create_neighborhood":
      return await createNeighborhood(action, userId, messages);
    case "delete_neighborhood":
      return await deleteNeighborhood(action, userId, messages);
    case "update_client":
      return await updateClient(action, userId, messages);
    case "create_client":
      return await createClient(action, userId, messages);
    case "delete_client":
      return await deleteClient(action, userId, messages);
    case "update_owner":
      return await updateOwner(action, userId, messages);
    case "create_owner":
      return await createOwner(action, userId, messages);
    case "delete_owner":
      return await deleteOwner(action, userId, messages);
    case "update_financial":
      return await updateFinancialTransaction(action, userId, messages);
    case "create_financial":
      return await createFinancialTransaction(action, userId, messages);
    case "delete_financial":
      return await deleteFinancialTransaction(action, userId, messages);
    default:
      return {
        success: false,
        message: `Tipo de ação desconhecido: ${action.type}`,
      };
  }
}

async function updateProperty(
  action: PendingAction, 
  userId?: string,
  messages?: { userMessage: string; aiResponse: string }
): Promise<{ success: boolean; message: string }> {
  console.log('[Intelligence] Atualizando imóvel:', action.data);
  
  try {
    const results = await findProperty(action.data);
    if (results.length === 0) {
      console.warn('[Intelligence] Imóvel não encontrado para atualização');
      throw new NotFoundError('Imóvel');
    }
    
    if (results.length > 1) {
      console.warn('[Intelligence] Múltiplos imóveis encontrados:', results.length);
      
      // Armazenar candidatos para seleção posterior
      const candidateId = Date.now().toString();
      const neighborhoods = await storage.getNeighborhoods();
      
      const candidates = results.slice(0, 5).map((r, i) => {
        const neighborhood = neighborhoods.find(n => n.id === r.item.neighborhoodId);
        const detailsParts = [
          `Preço: R$ ${parseFloat(r.item.price.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
        
        if (neighborhood) detailsParts.push(`Bairro: ${neighborhood.name}`);
        if (r.item.bedrooms) detailsParts.push(`${r.item.bedrooms} quartos`);
        if (r.item.bathrooms) detailsParts.push(`${r.item.bathrooms} banheiros`);
        if (r.item.area) detailsParts.push(`Área: ${r.item.area}m²`);
        
        return {
          id: r.item.id,
          title: r.item.title,
          details: detailsParts.join(' | '),
          confidence: r.confidence
        };
      });
      
      pendingCandidates.set(candidateId, {
        type: action.type,
        action: 'atualizar',
        candidates,
        data: action.data,
        images: action.images
      });
      
      const options = candidates.map((c, i) => 
        `${i + 1}. ${c.title}\n   ${c.details}`
      ).join('\n\n');
      
      throw new ValidationError(
        `Encontrei ${results.length} imóveis que correspondem à busca. Por favor, responda com o número do imóvel correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual imóvel deseja atualizar.`,
        { candidateId }
      );
    }
    
    const property = results[0].item;
    const before = { ...property };

    const updateData: any = {};
    
    if (action.data.price !== undefined) {
      const price = validatePositiveNumber(action.data.price, 'Preço');
      if (price > 1000000000) {
        throw new ValidationError('Preço muito alto (máximo: R$ 1.000.000.000)');
      }
      updateData.price = price.toString();
    }
    
    if (action.data.title !== undefined) {
      updateData.title = sanitizeInput(action.data.title);
      if (!updateData.title) {
        throw new ValidationError('Título não pode estar vazio');
      }
    }
    
    if (action.data.description !== undefined) {
      updateData.description = sanitizeInput(action.data.description);
    }
    
    if (action.data.propertyType !== undefined) {
      updateData.propertyType = sanitizeInput(action.data.propertyType);
    }
    
    if (action.data.status !== undefined) {
      updateData.status = sanitizeInput(action.data.status);
    }
    
    if (action.data.bedrooms !== undefined) {
      updateData.bedrooms = validatePositiveNumber(action.data.bedrooms, 'Quartos');
    }
    
    if (action.data.bathrooms !== undefined) {
      updateData.bathrooms = validatePositiveNumber(action.data.bathrooms, 'Banheiros');
    }
    
    if (action.data.parkingSpaces !== undefined) {
      updateData.parkingSpaces = validatePositiveNumber(action.data.parkingSpaces, 'Vagas');
    }
    
    if (action.data.area !== undefined) {
      const area = validatePositiveNumber(action.data.area, 'Área');
      updateData.area = area.toString();
    }
    
    if (action.data.landArea !== undefined) {
      const landArea = validatePositiveNumber(action.data.landArea, 'Área do terreno');
      updateData.landArea = landArea.toString();
    }
    
    if (action.data.isFeatured !== undefined) {
      updateData.isFeatured = Boolean(action.data.isFeatured);
    }
    
    if (action.data.amenities !== undefined) {
      if (Array.isArray(action.data.amenities)) {
        updateData.amenities = action.data.amenities.map((a: string) => sanitizeInput(a)).filter(Boolean);
      }
    }

    console.log('[Intelligence] Dados validados, atualizando imóvel:', property.id);
    const updated = await storage.updateProperty(property.id, updateData);
    console.log('[Intelligence] Imóvel atualizado com sucesso:', property.id);
    
    await logAuditAction({
      userId,
      action: 'update_property',
      entityType: 'property',
      entityId: property.id,
      details: { before, after: updated, changes: updateData },
      userMessage: messages?.userMessage,
      aiResponse: messages?.aiResponse,
      status: 'success',
    });
    
    return { success: true, message: "Imóvel atualizado com sucesso!" };
  } catch (error: any) {
    console.error('[Intelligence] Erro ao atualizar imóvel:', error.message, error.stack);
    
    if (error instanceof IntelligenceError) {
      throw error;
    }
    
    throw new IntelligenceError(
      `Erro ao atualizar imóvel: ${error.message}`,
      500,
      `Não foi possível atualizar o imóvel: ${error.message}`
    );
  }
}

async function createProperty(
  action: PendingAction,
  userId?: string,
  messages?: { userMessage: string; aiResponse: string }
): Promise<{ success: boolean; message: string }> {
  if (!action.images || action.images.length < 3) {
    throw new ValidationError('Para cadastrar um imóvel, é necessário anexar no mínimo 3 imagens.');
  }
  
  if (action.images.length > 20) {
    console.log(`[Intelligence] Limitando imagens de ${action.images.length} para 20`);
    action.images = action.images.slice(0, 20);
  }
  
  // Normalizar e validar que apenas imóveis para venda são permitidos
  if (action.data.status) {
    const normalizedStatus = action.data.status.toLowerCase().trim();
    if (normalizedStatus !== 'venda') {
      throw new ValidationError('Apenas imóveis para venda podem ser cadastrados. Imóveis para aluguel não são permitidos no momento.');
    }
  }
  
  // Garantir que o status seja sempre "venda"
  action.data.status = 'venda';
  console.log('[Intelligence] Status definido como "venda" (apenas imóveis para venda são permitidos)');
  
  const { uploadPropertyImage } = await import("./upload");
  const uploadedImageUrls: string[] = [];
  
  const propertyFolder = action.data.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50) || `property-${Date.now()}`;
  
  for (let i = 0; i < action.images.length; i++) {
    const img = action.images[i];
    try {
      const uploaded = await uploadPropertyImage(img.base64Data, img.filename, propertyFolder);
      uploadedImageUrls.push(uploaded.url);
      console.log(`[Intelligence] Imagem ${i + 1}/${action.images.length} carregada com sucesso: ${uploaded.url}`);
    } catch (error) {
      console.error(`[Intelligence] Erro ao fazer upload da imagem ${i + 1}:`, error);
    }
  }
  
  if (uploadedImageUrls.length < 3) {
    throw new ValidationError(`Falha no upload das imagens. Apenas ${uploadedImageUrls.length} imagem(ns) foram carregadas com sucesso. Mínimo: 3.`);
  }
  
  console.log(`[Intelligence] Total de ${uploadedImageUrls.length} imagens carregadas com sucesso`);
  
  // Gerar título automaticamente se não especificado
  if (!action.data.title || !action.data.title.trim()) {
    const propertyType = action.data.propertyType || 'imóvel';
    const location = action.data.neighborhoodId ? 'em localização privilegiada' : '';
    const priceInfo = action.data.price ? `R$ ${parseFloat(action.data.price).toLocaleString('pt-BR')}` : '';
    action.data.title = `${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} ${location} ${priceInfo}`.trim();
    console.log(`[Intelligence] Título gerado automaticamente: ${action.data.title}`);
  }
  
  // Inferir propertyType se não especificado
  if (!action.data.propertyType) {
    const titleAndDesc = `${action.data.title || ''} ${action.data.description || ''}`.toLowerCase();
    if (titleAndDesc.includes('casa')) {
      action.data.propertyType = 'casa';
    } else if (titleAndDesc.includes('apartamento') || titleAndDesc.includes('apto')) {
      action.data.propertyType = 'apartamento';
    } else if (titleAndDesc.includes('terreno')) {
      action.data.propertyType = 'terreno';
    } else if (titleAndDesc.includes('comercial') || titleAndDesc.includes('loja') || titleAndDesc.includes('sala')) {
      action.data.propertyType = 'comercial';
    } else {
      action.data.propertyType = 'casa'; // Tipo padrão: casa
    }
    console.log(`[Intelligence] Tipo de imóvel inferido: ${action.data.propertyType}`);
  }
  
  const propertyWithImages = {
    ...action.data,
    images: uploadedImageUrls
  };
  
  const created = await storage.createProperty(propertyWithImages);
  
  await logAuditAction({
    userId,
    action: 'create_property',
    entityType: 'property',
    entityId: created.id,
    details: { created },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: `Imóvel criado com sucesso com ${uploadedImageUrls.length} imagem(ns)!` };
}

async function deleteProperty(
  action: PendingAction,
  userId?: string,
  messages?: { userMessage: string; aiResponse: string }
): Promise<{ success: boolean; message: string }> {
  const results = await findProperty(action.data);
  if (results.length === 0) {
    return { success: false, message: "Imóvel não encontrado." };
  }
  
  if (results.length > 1) {
    const candidateId = Date.now().toString();
    const neighborhoods = await storage.getNeighborhoods();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const neighborhood = neighborhoods.find(n => n.id === r.item.neighborhoodId);
      const detailsParts = [
        `Preço: R$ ${parseFloat(r.item.price.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ];
      
      if (neighborhood) detailsParts.push(`Bairro: ${neighborhood.name}`);
      if (r.item.bedrooms) detailsParts.push(`${r.item.bedrooms} quartos`);
      
      return {
        id: r.item.id,
        title: r.item.title,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'excluir',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} imóveis que correspondem à busca. Por favor, responda com o número do imóvel correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual imóvel deseja excluir.`,
      { candidateId }
    );
  }
  
  const property = results[0].item;
  await storage.deleteProperty(property.id);
  
  await logAuditAction({
    userId,
    action: 'delete_property',
    entityType: 'property',
    entityId: property.id,
    details: { deleted: property },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Imóvel excluído com sucesso!" };
}

async function updateNeighborhood(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const results = await findNeighborhood(action.data);
  if (results.length === 0) {
    return { success: false, message: "Bairro não encontrado." };
  }
  
  if (results.length > 1) {
    console.warn('[Intelligence] Múltiplos bairros encontrados:', results.length);
    
    const candidateId = Date.now().toString();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const detailsParts = [r.item.name];
      
      return {
        id: r.item.id,
        title: r.item.name,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'atualizar',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} bairros que correspondem à busca. Por favor, responda com o número do bairro correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual bairro deseja atualizar.`,
      { candidateId }
    );
  }
  
  const neighborhood = results[0].item;
  const before = { ...neighborhood };
  
  await storage.updateNeighborhood(neighborhood.id, action.data);
  const updated = await storage.getNeighborhood(neighborhood.id);
  
  await logAuditAction({
    userId,
    action: 'update_neighborhood',
    entityType: 'neighborhood',
    entityId: neighborhood.id,
    details: { before, after: updated, changes: action.data },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Bairro atualizado com sucesso!" };
}

async function createNeighborhood(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const created = await storage.createNeighborhood(action.data);
  
  await logAuditAction({
    userId,
    action: 'create_neighborhood',
    entityType: 'neighborhood',
    entityId: created.id,
    details: { created },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Bairro criado com sucesso!" };
}

async function deleteNeighborhood(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const results = await findNeighborhood(action.data);
  if (results.length === 0) {
    return { success: false, message: "Bairro não encontrado." };
  }
  
  if (results.length > 1) {
    console.warn('[Intelligence] Múltiplos bairros encontrados:', results.length);
    
    const candidateId = Date.now().toString();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const detailsParts = [r.item.name];
      
      return {
        id: r.item.id,
        title: r.item.name,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'excluir',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} bairros que correspondem à busca. Por favor, responda com o número do bairro correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual bairro deseja excluir.`,
      { candidateId }
    );
  }
  
  const neighborhood = results[0].item;
  await storage.deleteNeighborhood(neighborhood.id);
  
  await logAuditAction({
    userId,
    action: 'delete_neighborhood',
    entityType: 'neighborhood',
    entityId: neighborhood.id,
    details: { deleted: neighborhood },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Bairro excluído com sucesso!" };
}

async function updateClient(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  console.log('[Intelligence] Atualizando cliente:', action.data);
  
  try {
    const results = await findClient(action.data);
    if (results.length === 0) {
      console.warn('[Intelligence] Cliente não encontrado para atualização');
      throw new NotFoundError('Cliente');
    }
    
    if (results.length > 1) {
      console.warn('[Intelligence] Múltiplos clientes encontrados:', results.length);
      
      const candidateId = Date.now().toString();
      
      const candidates = results.slice(0, 5).map((r, i) => {
        const detailsParts = [r.item.name];
        
        if (r.item.email) detailsParts.push(`Email: ${r.item.email}`);
        if (r.item.phone) detailsParts.push(`Tel: ${r.item.phone}`);
        
        return {
          id: r.item.id,
          title: r.item.name,
          details: detailsParts.join(' | '),
          confidence: r.confidence
        };
      });
      
      pendingCandidates.set(candidateId, {
        type: action.type,
        action: 'atualizar',
        candidates,
        data: action.data
      });
      
      const options = candidates.map((c, i) => 
        `${i + 1}. ${c.title}\n   ${c.details}`
      ).join('\n\n');
      
      throw new ValidationError(
        `Encontrei ${results.length} clientes que correspondem à busca. Por favor, responda com o número do cliente correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual cliente deseja atualizar.`,
        { candidateId }
      );
    }
    
    const client = results[0].item;
    const before = { ...client };
    const updateData: any = {};
    
    if (action.data.name !== undefined) {
      updateData.name = sanitizeInput(action.data.name);
      if (!updateData.name) {
        throw new ValidationError('Nome do cliente não pode estar vazio');
      }
    }
    
    if (action.data.email !== undefined) {
      const sanitizedEmail = sanitizeEmail(action.data.email);
      if (action.data.email && !sanitizedEmail) {
        throw new ValidationError('Email inválido. Use um formato válido como exemplo@email.com');
      }
      updateData.email = sanitizedEmail;
    }
    
    if (action.data.phone !== undefined) {
      updateData.phone = sanitizeInput(action.data.phone);
    }
    
    if (action.data.notes !== undefined) {
      updateData.notes = sanitizeInput(action.data.notes);
    }
    
    if (action.data.propertyIds !== undefined && Array.isArray(action.data.propertyIds)) {
      updateData.propertyIds = action.data.propertyIds.map((id: string) => {
        try {
          return validateId(id, 'Imóvel');
        } catch (error: any) {
          console.warn('[Intelligence] ID de imóvel inválido ignorado:', id);
          return null;
        }
      }).filter(Boolean);
    }
    
    console.log('[Intelligence] Dados validados, atualizando cliente:', client.id);
    await storage.updateClient(client.id, updateData);
    const updated = await storage.getClient(client.id);
    console.log('[Intelligence] Cliente atualizado com sucesso:', client.id);
    
    await logAuditAction({
      userId,
      action: 'update_client',
      entityType: 'client',
      entityId: client.id,
      details: { before, after: updated, changes: updateData },
      userMessage: messages?.userMessage,
      aiResponse: messages?.aiResponse,
      status: 'success',
    });
    
    return { success: true, message: "Cliente atualizado com sucesso!" };
  } catch (error: any) {
    console.error('[Intelligence] Erro ao atualizar cliente:', error.message, error.stack);
    
    if (error instanceof IntelligenceError) {
      throw error;
    }
    
    throw new IntelligenceError(
      `Erro ao atualizar cliente: ${error.message}`,
      500,
      `Não foi possível atualizar o cliente: ${error.message}`
    );
  }
}

async function createClient(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const created = await storage.createClient(action.data);
  
  await logAuditAction({
    userId,
    action: 'create_client',
    entityType: 'client',
    entityId: created.id,
    details: { created },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Cliente criado com sucesso!" };
}

async function deleteClient(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const results = await findClient(action.data);
  if (results.length === 0) {
    return { success: false, message: "Cliente não encontrado." };
  }
  
  if (results.length > 1) {
    console.warn('[Intelligence] Múltiplos clientes encontrados:', results.length);
    
    const candidateId = Date.now().toString();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const detailsParts = [r.item.name];
      
      if (r.item.email) detailsParts.push(`Email: ${r.item.email}`);
      if (r.item.phone) detailsParts.push(`Tel: ${r.item.phone}`);
      
      return {
        id: r.item.id,
        title: r.item.name,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'excluir',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} clientes que correspondem à busca. Por favor, responda com o número do cliente correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual cliente deseja excluir.`,
      { candidateId }
    );
  }
  
  const client = results[0].item;
  await storage.deleteClient(client.id);
  
  await logAuditAction({
    userId,
    action: 'delete_client',
    entityType: 'client',
    entityId: client.id,
    details: { deleted: client },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Cliente excluído com sucesso!" };
}

async function updateOwner(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  console.log('[Intelligence] Atualizando proprietário:', action.data);
  
  try {
    const results = await findOwner(action.data);
    if (results.length === 0) {
      console.warn('[Intelligence] Proprietário não encontrado para atualização');
      throw new NotFoundError('Proprietário');
    }
    
    if (results.length > 1) {
      console.warn('[Intelligence] Múltiplos proprietários encontrados:', results.length);
      
      const candidateId = Date.now().toString();
      
      const candidates = results.slice(0, 5).map((r, i) => {
        const detailsParts = [r.item.name];
        
        if (r.item.email) detailsParts.push(`Email: ${r.item.email}`);
        if (r.item.phone) detailsParts.push(`Tel: ${r.item.phone}`);
        
        return {
          id: r.item.id,
          title: r.item.name,
          details: detailsParts.join(' | '),
          confidence: r.confidence
        };
      });
      
      pendingCandidates.set(candidateId, {
        type: action.type,
        action: 'atualizar',
        candidates,
        data: action.data
      });
      
      const options = candidates.map((c, i) => 
        `${i + 1}. ${c.title}\n   ${c.details}`
      ).join('\n\n');
      
      throw new ValidationError(
        `Encontrei ${results.length} proprietários que correspondem à busca. Por favor, responda com o número do proprietário correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual proprietário deseja atualizar.`,
        { candidateId }
      );
    }
    
    const owner = results[0].item;
    const before = { ...owner };
    const updateData: any = {};
    
    if (action.data.name !== undefined) {
      updateData.name = sanitizeInput(action.data.name);
      if (!updateData.name) {
        throw new ValidationError('Nome do proprietário não pode estar vazio');
      }
    }
    
    if (action.data.email !== undefined) {
      const sanitizedEmail = sanitizeEmail(action.data.email);
      if (action.data.email && !sanitizedEmail) {
        throw new ValidationError('Email inválido. Use um formato válido como exemplo@email.com');
      }
      updateData.email = sanitizedEmail;
    }
    
    if (action.data.phone !== undefined) {
      updateData.phone = sanitizeInput(action.data.phone);
    }
    
    if (action.data.notes !== undefined) {
      updateData.notes = sanitizeInput(action.data.notes);
    }
    
    if (action.data.propertyIds !== undefined && Array.isArray(action.data.propertyIds)) {
      updateData.propertyIds = action.data.propertyIds.map((id: string) => {
        try {
          return validateId(id, 'Imóvel');
        } catch (error: any) {
          console.warn('[Intelligence] ID de imóvel inválido ignorado:', id);
          return null;
        }
      }).filter(Boolean);
    }
    
    console.log('[Intelligence] Dados validados, atualizando proprietário:', owner.id);
    await storage.updateOwner(owner.id, updateData);
    const updated = await storage.getOwner(owner.id);
    console.log('[Intelligence] Proprietário atualizado com sucesso:', owner.id);
    
    await logAuditAction({
      userId,
      action: 'update_owner',
      entityType: 'owner',
      entityId: owner.id,
      details: { before, after: updated, changes: updateData },
      userMessage: messages?.userMessage,
      aiResponse: messages?.aiResponse,
      status: 'success',
    });
    
    return { success: true, message: "Proprietário atualizado com sucesso!" };
  } catch (error: any) {
    console.error('[Intelligence] Erro ao atualizar proprietário:', error.message, error.stack);
    
    if (error instanceof IntelligenceError) {
      throw error;
    }
    
    throw new IntelligenceError(
      `Erro ao atualizar proprietário: ${error.message}`,
      500,
      `Não foi possível atualizar o proprietário: ${error.message}`
    );
  }
}

async function createOwner(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const created = await storage.createOwner(action.data);
  
  await logAuditAction({
    userId,
    action: 'create_owner',
    entityType: 'owner',
    entityId: created.id,
    details: { created },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Proprietário criado com sucesso!" };
}

async function deleteOwner(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const results = await findOwner(action.data);
  if (results.length === 0) {
    return { success: false, message: "Proprietário não encontrado." };
  }
  
  if (results.length > 1) {
    console.warn('[Intelligence] Múltiplos proprietários encontrados:', results.length);
    
    const candidateId = Date.now().toString();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const detailsParts = [r.item.name];
      
      if (r.item.email) detailsParts.push(`Email: ${r.item.email}`);
      if (r.item.phone) detailsParts.push(`Tel: ${r.item.phone}`);
      
      return {
        id: r.item.id,
        title: r.item.name,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'excluir',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} proprietários que correspondem à busca. Por favor, responda com o número do proprietário correto:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual proprietário deseja excluir.`,
      { candidateId }
    );
  }
  
  const owner = results[0].item;
  await storage.deleteOwner(owner.id);
  
  await logAuditAction({
    userId,
    action: 'delete_owner',
    entityType: 'owner',
    entityId: owner.id,
    details: { deleted: owner },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Proprietário excluído com sucesso!" };
}

async function updateFinancialTransaction(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  console.log('[Intelligence] Atualizando transação financeira:', action.data);
  
  try {
    const results = await findFinancialTransaction(action.data);
    if (results.length === 0) {
      console.warn('[Intelligence] Transação não encontrada para atualização');
      throw new NotFoundError('Transação financeira');
    }
    
    if (results.length > 1) {
      console.warn('[Intelligence] Múltiplas transações encontradas:', results.length);
      
      const candidateId = Date.now().toString();
      
      const candidates = results.slice(0, 5).map((r, i) => {
        const detailsParts = [r.item.description];
        
        const amount = parseFloat(r.item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        detailsParts.push(`Valor: ${amount}`);
        detailsParts.push(`Tipo: ${r.item.type}`);
        
        if (r.item.date) {
          const date = new Date(r.item.date).toLocaleDateString('pt-BR');
          detailsParts.push(`Data: ${date}`);
        }
        
        return {
          id: r.item.id,
          title: r.item.description,
          details: detailsParts.join(' | '),
          confidence: r.confidence
        };
      });
      
      pendingCandidates.set(candidateId, {
        type: action.type,
        action: 'atualizar',
        candidates,
        data: action.data
      });
      
      const options = candidates.map((c, i) => 
        `${i + 1}. ${c.title}\n   ${c.details}`
      ).join('\n\n');
      
      throw new ValidationError(
        `Encontrei ${results.length} transações que correspondem à busca. Por favor, responda com o número da transação correta:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual transação deseja atualizar.`,
        { candidateId }
      );
    }
    
    const transaction = results[0].item;
    const before = { ...transaction };
    const updateData: any = {};
    
    if (action.data.description !== undefined) {
      updateData.description = sanitizeInput(action.data.description);
      if (!updateData.description) {
        throw new ValidationError('Descrição da transação não pode estar vazia');
      }
    }
    
    if (action.data.amount !== undefined) {
      const amount = validatePositiveNumber(action.data.amount, 'Valor');
      if (amount > 1000000000) {
        throw new ValidationError('Valor muito alto (máximo: R$ 1.000.000.000)');
      }
      updateData.amount = amount.toString();
    }
    
    if (action.data.type !== undefined) {
      const validTypes = ['receita', 'despesa', 'income', 'expense'];
      const sanitizedType = sanitizeInput(action.data.type.toLowerCase());
      if (!validTypes.includes(sanitizedType)) {
        throw new ValidationError('Tipo de transação inválido. Use "receita" ou "despesa"');
      }
      updateData.type = sanitizedType;
    }
    
    if (action.data.category !== undefined) {
      updateData.category = sanitizeInput(action.data.category);
    }
    
    if (action.data.date !== undefined) {
      updateData.date = action.data.date;
    }
    
    if (action.data.isRecurring !== undefined) {
      updateData.isRecurring = Boolean(action.data.isRecurring);
    }
    
    if (action.data.recurringFrequency !== undefined) {
      updateData.recurringFrequency = sanitizeInput(action.data.recurringFrequency);
    }
    
    console.log('[Intelligence] Dados validados, atualizando transação:', transaction.id);
    await storage.updateFinancialTransaction(transaction.id, updateData);
    const updated = await storage.getFinancialTransaction(transaction.id);
    console.log('[Intelligence] Transação atualizada com sucesso:', transaction.id);
    
    await logAuditAction({
      userId,
      action: 'update_financial',
      entityType: 'financial',
      entityId: transaction.id,
      details: { before, after: updated, changes: updateData },
      userMessage: messages?.userMessage,
      aiResponse: messages?.aiResponse,
      status: 'success',
    });
    
    return { success: true, message: "Transação financeira atualizada com sucesso!" };
  } catch (error: any) {
    console.error('[Intelligence] Erro ao atualizar transação:', error.message, error.stack);
    
    if (error instanceof IntelligenceError) {
      throw error;
    }
    
    throw new IntelligenceError(
      `Erro ao atualizar transação: ${error.message}`,
      500,
      `Não foi possível atualizar a transação: ${error.message}`
    );
  }
}

async function createFinancialTransaction(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const transactionData = {
    ...action.data,
    amount: action.data.value || action.data.amount,
    frequencyType: action.data.frequencyType || 'unico'
  };
  
  if (transactionData.value !== undefined) {
    delete transactionData.value;
  }
  
  const created = await storage.createFinancialTransaction(transactionData);
  
  await logAuditAction({
    userId,
    action: 'create_financial',
    entityType: 'financial',
    entityId: created.id,
    details: { created },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Transação financeira criada com sucesso!" };
}

async function deleteFinancialTransaction(action: PendingAction, userId?: string, messages?: { userMessage: string; aiResponse: string }): Promise<{ success: boolean; message: string }> {
  const results = await findFinancialTransaction(action.data);
  if (results.length === 0) {
    return { success: false, message: "Transação não encontrada." };
  }
  
  if (results.length > 1) {
    console.warn('[Intelligence] Múltiplas transações encontradas:', results.length);
    
    const candidateId = Date.now().toString();
    
    const candidates = results.slice(0, 5).map((r, i) => {
      const detailsParts = [r.item.description];
      
      const amount = parseFloat(r.item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      detailsParts.push(`Valor: ${amount}`);
      detailsParts.push(`Tipo: ${r.item.type}`);
      
      if (r.item.date) {
        const date = new Date(r.item.date).toLocaleDateString('pt-BR');
        detailsParts.push(`Data: ${date}`);
      }
      
      return {
        id: r.item.id,
        title: r.item.description,
        details: detailsParts.join(' | '),
        confidence: r.confidence
      };
    });
    
    pendingCandidates.set(candidateId, {
      type: action.type,
      action: 'excluir',
      candidates,
      data: action.data
    });
    
    const options = candidates.map((c, i) => 
      `${i + 1}. ${c.title}\n   ${c.details}`
    ).join('\n\n');
    
    throw new ValidationError(
      `Encontrei ${results.length} transações que correspondem à busca. Por favor, responda com o número da transação correta:\n\n${options}\n\nDigite apenas o número (1, 2, 3, etc.) para confirmar qual transação deseja excluir.`,
      { candidateId }
    );
  }
  
  const transaction = results[0].item;
  await storage.deleteFinancialTransaction(transaction.id);
  
  await logAuditAction({
    userId,
    action: 'delete_financial',
    entityType: 'financial',
    entityId: transaction.id,
    details: { deleted: transaction },
    userMessage: messages?.userMessage,
    aiResponse: messages?.aiResponse,
    status: 'success',
  });
  
  return { success: true, message: "Transação financeira excluída com sucesso!" };
}
