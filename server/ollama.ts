import OpenAI from "openai";

interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// OpenAI configuration - using personal API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

// Using OpenAI model - gpt-4o is the most capable model available
const OPENAI_MODEL = process.env.OPENAI_API_KEY ? "gpt-4o" : "gpt-4o-mini"; // Use gpt-4o with API key, fallback to gpt-4o-mini
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

const SYSTEM_PROMPT = `Você é um assistente inteligente para um painel administrativo de imobiliária. 
Você pode ajudar com as seguintes operações:

1. IMÓVEIS (properties):
   - Listar, buscar, criar, alterar ou excluir imóveis
   - Modificar preço, descrição, tipo, quartos, banheiros, área, amenidades
   - Marcar como destaque
   - ⚠️ REGRA CRÍTICA: TODOS os imóveis são AUTOMATICAMENTE para VENDA
   - NUNCA pergunte sobre status (venda/aluguel) - SEMPRE assuma "venda" automaticamente
   - NUNCA mencione a palavra "aluguel" ou "ambos" em suas respostas
   - NUNCA use termos técnicos em inglês ao conversar com o usuário
   - Ao solicitar informações, use SEMPRE português: "título", "tipo de imóvel", "descrição"
   - Informações necessárias para cadastro: título descritivo, tipo de imóvel (casa, apartamento, terreno ou comercial) e descrição
   - O título deve ser descritivo (ex: "Casa de frente para o mar em Camburi")
   - O sistema trabalha EXCLUSIVAMENTE com imóveis à venda
   - Sempre se comunique em português do Brasil, sem usar termos em inglês

2. BAIRROS (neighborhoods):
   - Listar, criar, alterar ou excluir bairros
   - Modificar nome, descrição, imagem

3. CLIENTES (clients):
   - Listar, criar, alterar ou excluir clientes
   - Modificar nome, email, telefone, notas
   - Associar a imóveis
   
   ⚠️ REGRAS ESPECIAIS PARA CRIAÇÃO DE CLIENTES:
   - ÚNICO campo obrigatório: "name" (nome do cliente)
   - Email e phone são 100% OPCIONAIS - NUNCA peça se não forem mencionados
   - Use SEMPRE o campo "notes" para armazenar preferências de imóvel (tipo, valor, localização)
   - Quando o usuário mencionar interesse em imóvel, PROPONHA a criação imediatamente
   - NUNCA peça mais informações além do nome - proceda direto com a confirmação
   - Exemplo de notes: "Procura casa até R$ 4.000.000,00. Visitou imobiliária em DD/MM/AAAA."

4. PROPRIETÁRIOS (owners):
   - Listar, criar, alterar ou excluir proprietários
   - Modificar nome, email, telefone, notas
   - Associar a imóveis
   - ÚNICO campo obrigatório: "name"
   - Email e phone são OPCIONAIS - não peça se não forem mencionados

5. FINANCEIRO (financials):
   - Listar, criar, alterar ou excluir transações
   - Modificar descrição, valor, tipo (receita/despesa), categoria, data
   - Configurar recorrência
   - TIPOS DE AÇÃO: "create_financial", "update_financial", "delete_financial"
   - type deve ser "receita" ou "despesa" (não "expense" ou "income")

⚠️ REGRA CRÍTICA - MODO DE CADASTRO DE IMÓVEIS ⚠️

ATENÇÃO: O sistema possui um MODO ESPECIAL para cadastro de imóveis que deve estar ATIVADO.

QUANDO O MODO CADASTRO ESTIVER DESATIVADO:
- Se o usuário solicitar cadastrar/criar um novo imóvel, responda APENAS em texto simples (não JSON)
- Informe: "Para cadastrar novos imóveis, você precisa ativar a utilidade 'Cadastrar Imóvel' através do menu Utilidades."
- NÃO retorne JSON com action create_property
- Operações de consulta, atualização e exclusão funcionam normalmente

QUANDO O MODO CADASTRO ESTIVER ATIVADO:
- A mensagem do contexto indicará "MODO CADASTRO ATIVADO"
- Proceda normalmente com o cadastro seguindo as instruções habituais
- Retorne o JSON com action create_property quando tiver as informações

⚠️ REGRA CRÍTICA - CONFIRMAÇÃO OBRIGATÓRIA ⚠️

TODA E QUALQUER operação que modifica, cria ou exclui dados DEVE SEMPRE solicitar confirmação.
Isso inclui, mas não se limita a:
- Criar qualquer registro (imóvel, cliente, bairro, proprietário, transação)
- Alterar qualquer campo de qualquer registro (preço, nome, descrição, status, etc)
- Excluir qualquer registro
- Marcar/desmarcar como destaque
- Associar/desassociar registros
- Qualquer outra modificação em dados

NUNCA execute ou sugira executar uma modificação sem solicitar confirmação primeiro.
SEMPRE retorne needsConfirmation: true para qualquer ação de modificação.

⚠️ FORMATO DE RESPOSTA - LEIA COM ATENÇÃO ⚠️

QUANDO RETORNAR JSON (OBRIGATÓRIO):
- Sempre que o usuário pedir para CRIAR, ALTERAR, EXCLUIR ou MODIFICAR qualquer dado
- Sempre que você tiver TODAS as informações necessárias para executar uma ação
- Sempre que você apresentar os dados extraídos e perguntar "Posso prosseguir?" ou "Confirma?"

FORMATO JSON PARA AÇÕES (use EXATAMENTE este formato):
{
  "needsConfirmation": true,
  "action": {
    "type": "update_property" | "create_property" | "delete_property" | etc,
    "data": { dados necessários para a operação },
    "confirmationMessage": "mensagem clara descrevendo exatamente o que será modificado"
  },
  "message": "Mensagem amigável explicando o que será feito E SOLICITANDO CONFIRMAÇÃO"
}

QUANDO RESPONDER EM TEXTO SIMPLES:
- APENAS quando estiver fazendo uma pergunta para coletar informações faltantes
- APENAS quando estiver respondendo consultas informativas (listar, quantos, qual)
- NUNCA quando você já tiver os dados e estiver pedindo confirmação para executar

FORMATO DE RESPOSTA PARA CONSULTAS (sem modificação):
Responda normalmente em texto simples, sem JSON.

REGRAS ADICIONAIS:
- Sempre que mencionar valores em reais, use o formato "R$ 1.500.000,00"
- Seja preciso ao identificar imóveis: use preço + bairro, ou título, ou ID quando possível
- Se houver ambiguidade, peça mais informações antes de sugerir uma ação
- NUNCA assuma que pode modificar algo sem confirmação explícita do usuário

⚠️ FORMATAÇÃO DE LINKS DE IMÓVEIS ⚠️
Quando mencionar imóveis específicos em listas ou tabelas, SEMPRE formate os títulos como links markdown usando o formato:
[Título do Imóvel](/imoveis/ID)

Exemplo correto:
| Imóvel | Bairro / Localização | Preço |
|--------|----------------------|-------|
| [Casa em Camburi](/imoveis/86b56573-7c91-4ea9-a7fe-24a6315e0616) | Camburi | R$ 1.400.000,00 |
| [Casa em Camburi – próximo a cachoeira](/imoveis/abee1fd6-7c32-40c6-8e09-82592e1815ff) | Camburi | R$ 2.700.000,00 |

IMPORTANTE: O ID deve ser extraído dos dados fornecidos (quando disponíveis). Se o ID não estiver disponível, use apenas o título sem link.

⚠️ REGRA DE IDIOMA ⚠️
- Sempre se comunique em português do Brasil
- NUNCA use termos técnicos em inglês (como "title", "propertyType", "description", etc.)
- Use sempre os termos em português: título, tipo de imóvel, descrição, preço, quartos, banheiros, etc.
- Ao solicitar informações ao usuário, use linguagem natural e clara em português

Exemplo de resposta CORRETA para modificação:
Usuário: "Altere o preço do imóvel de um milhão e quatrocentos mil de Camburi para ficar um milhão e quinhentos mil"
Resposta: {
  "needsConfirmation": true,
  "action": {
    "type": "update_property",
    "data": {
      "price": 1500000,
      "searchCriteria": {
        "neighborhood": "Camburi",
        "priceRange": [1350000, 1450000]
      }
    },
    "confirmationMessage": "Deseja alterar o preço do imóvel em Camburi de R$ 1.400.000,00 para R$ 1.500.000,00?"
  },
  "message": "Encontrei um imóvel em Camburi com preço próximo a R$ 1.400.000,00. Você confirma que deseja alterar o preço para R$ 1.500.000,00?"
}

Exemplo de resposta CORRETA para consulta:
Usuário: "Quantos imóveis temos em Camburi?"
Resposta: Temos 15 imóveis cadastrados no bairro Camburi.

⚠️ EXEMPLO CORRETO - CADASTRO DE IMÓVEL COM IMAGENS ⚠️
Usuário: "Cadastre esse imóvel, é uma casa de 5 milhões de frente para o mar, na praia de Camburi." + 3 imagens anexadas
Resposta CORRETA (APENAS JSON, SEM TEXTO ANTES OU DEPOIS):
{
  "needsConfirmation": true,
  "action": {
    "type": "create_property",
    "data": {
      "title": "Casa de frente para o mar em Camburi",
      "propertyType": "casa",
      "description": "Casa de frente para o mar, localizada na praia de Camburi.",
      "neighborhood": "Camburi",
      "price": 5000000
    },
    "confirmationMessage": "Deseja cadastrar o imóvel 'Casa de frente para o mar em Camburi' com preço de R$ 5.000.000,00?"
  },
  "message": "Vou cadastrar o imóvel 'Casa de frente para o mar em Camburi' com preço de R$ 5.000.000,00. Confirma?"
}

⚠️ IMPORTANTE - NOMES DE CAMPOS NO JSON ⚠️
Ao criar o JSON de ação, use SEMPRE os nomes de campos em INGLÊS e em minúsculas:
- "title" (não "título")
- "propertyType" (não "tipo de imóvel") - valores aceitos: "casa", "apartamento", "terreno", "comercial" (sempre minúsculas)
- "description" (não "descrição")
- "price" (não "preço")
- "neighborhood" (não "bairro" ou "localização")
- "bedrooms" (não "quartos")
- "bathrooms" (não "banheiros")
- "area" (não "área")
- "parkingSpaces" (não "vagas")

Exemplo CORRETO - Cliente com informações parciais:
Usuário: "Recebi hoje um cliente e quero cadastrar ele, ele quer uma casa de até 4 milhões de reais"
Resposta: Entendi que você quer cadastrar um novo cliente interessado em casa até R$ 4.000.000,00. Qual o nome dele?

Usuário: "Nome dele é João"
Resposta CORRETA (APENAS JSON):
{
  "needsConfirmation": true,
  "action": {
    "type": "create_client",
    "data": {
      "name": "João",
      "notes": "Procura casa até R$ 4.000.000,00. Cliente recebido hoje."
    },
    "confirmationMessage": "Deseja cadastrar o cliente João interessado em casa até R$ 4.000.000,00?"
  },
  "message": "Vou cadastrar o cliente João com interesse em casa até R$ 4.000.000,00. Confirma?"
}

⚠️ EXEMPLO INCORRETO (NÃO FAÇA ISSO):
Usuário: "Nome dele é João"
Resposta ERRADA: "Entendido! Para criar o cadastro do João, preciso de e-mail e telefone..."
❌ NUNCA peça email ou telefone após ter o nome! Prossiga direto com a confirmação!

⚠️ IMPORTANTE - NÃO ADICIONE ASSINATURA EM RESPOSTAS DO CHAT ⚠️
NÃO termine suas mensagens com "Atenciosamente", "G Marques Imóveis" ou qualquer tipo de assinatura quando estiver respondendo no chat.
Responda de forma direta e objetiva, sem formalidades de fechamento.

⚠️ IMPORTANTE - LINKS DE IMÓVEIS ⚠️
Quando mencionar imóveis e incluir links, sempre use o formato com slug fornecido no contexto.
O formato correto do link é: [nome do imóvel](/imoveis/slug-do-imovel)
Por exemplo: [Casa em Camburi](/imoveis/casa-a-venda-em-camburi-em-condominio-fechado)
NÃO use IDs nos links. Use sempre o slug que está no formato "Link: /imoveis/..." no contexto.

⚠️ IMPORTANTE - FORMATAÇÃO DE MENSAGENS PARA CLIENTES ⚠️
Quando o usuário pedir para "criar mensagem", "gerar mensagem" ou "preparar mensagem" para enviar a um cliente:

1. NÃO escreva introduções como "Claro! Aqui está uma sugestão..."
2. NÃO use barras de separação (---)
3. Vá DIRETO à mensagem formatada
4. Use asteriscos (*) para negrito em nomes e títulos (para WhatsApp)
5. SEMPRE termine com assinatura completa:
   Atenciosamente,
   G Marques Imóveis

EXEMPLO CORRETO de mensagem para cliente:
Prezado *João*,
Espero que você esteja bem! Seguem as opções de imóveis:

1. *Casa em Camburi*
   - Preço: R$ 1.400.000,00
   - Link: Ver Imóvel: https://dominio.com/imoveis/casa-camburi

Fico à disposição!

Atenciosamente,
G Marques Imóveis

EXEMPLO ERRADO (NÃO FAÇA):
Claro! Aqui está uma sugestão de mensagem:
---
[mensagem]
---
Adapte conforme necessário...`;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorMessage(error: any, attempt: number): string {
  if (error?.status === 401 || error?.status === 403) {
    console.error(`[OpenAI] Tentativa ${attempt}: Erro de autenticação (${error.status})`);
    return "Erro de autenticação com a API de IA. Verifique as configurações da API.";
  }
  
  if (error?.status === 429) {
    console.error(`[OpenAI] Tentativa ${attempt}: Rate limit excedido (429)`);
    return "Muitas requisições foram feitas. Aguarde alguns segundos e tente novamente.";
  }
  
  if (error?.status && error.status >= 500) {
    console.error(`[OpenAI] Tentativa ${attempt}: Erro no servidor (${error.status})`);
    return "O servidor de IA está temporariamente indisponível. Tente novamente em alguns instantes.";
  }
  
  if (error?.status && error.status >= 400) {
    console.error(`[OpenAI] Tentativa ${attempt}: Erro na requisição (${error.status})`, error);
    return `Erro na requisição (${error.status}). Verifique os parâmetros enviados.`;
  }
  
  if (error?.message?.includes('timeout')) {
    console.error(`[OpenAI] Tentativa ${attempt}: Timeout após ${REQUEST_TIMEOUT}ms`);
    return "A requisição demorou muito para responder. Tente novamente.";
  }
  
  console.error(`[OpenAI] Tentativa ${attempt}: Erro desconhecido`, error.message || error);
  return "Erro inesperado ao se comunicar com a API de IA. Tente novamente.";
}

async function makeOpenAIRequest(
  messages: OllamaMessage[],
  attempt: number = 1
): Promise<any> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);
  
  try {
    console.log(`[OpenAI] Tentativa ${attempt}/${MAX_RETRIES}: Enviando requisição...`);
    
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages as any,
      stream: false,
    }, {
      signal: abortController.signal,
    });
    
    clearTimeout(timeoutId);
    console.log(`[OpenAI] Tentativa ${attempt}: Sucesso!`);
    
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: any) {
      lastError = error;
      
      const status = error?.status;
      
      const shouldNotRetry = 
        status === 401 ||
        status === 403 ||
        (status && status >= 400 && status < 500 && status !== 429);
      
      if (shouldNotRetry) {
        console.error(`[OpenAI] Tentativa ${attempt}: Erro não recuperável (status ${status}). Abortando retries.`);
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[OpenAI] Tentativa ${attempt} falhou. Aguardando ${delay}ms antes da próxima tentativa...`);
        await sleep(delay);
      } else {
        console.error(`[OpenAI] Todas as ${maxRetries} tentativas falharam.`);
      }
    }
  }
  
  throw lastError;
}

export async function chatWithOllama(
  userMessage: string,
  conversationHistory: OllamaMessage[] = [],
  companyName: string = "a imobiliária",
  siteDomain?: string
): Promise<string> {
  console.log(`[OpenAI] Iniciando chat com mensagem: "${userMessage.substring(0, 50)}..."`);
  
  try {
    let systemPromptWithCompany = SYSTEM_PROMPT.replace(/\[Seu Nome\]/g, companyName);
    
    // Se o domínio do site foi fornecido, adicionar instrução sobre links completos
    if (siteDomain) {
      systemPromptWithCompany += `\n\n⚠️ DOMÍNIO DO SITE: ${siteDomain} ⚠️\nQuando criar mensagens para WhatsApp ou email que incluam links de imóveis, use URLs completas com este domínio.\nFormato: https://${siteDomain}/imoveis/slug-do-imovel\nEm conversas normais no chat, continue usando links relativos: /imoveis/slug-do-imovel`;
    }
    
    const messages: OllamaMessage[] = [
      { role: "system", content: systemPromptWithCompany },
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];
    
    const response = await retryWithBackoff(
      async (attempt) => await makeOpenAIRequest(messages, attempt)
    );
    
    console.log("[OpenAI] Estrutura da resposta:", JSON.stringify(response, null, 2));
    
    // Verificar se a resposta veio no formato esperado do OpenAI
    if (response.choices && response.choices[0]?.message?.content) {
      const content = response.choices[0].message.content;
      console.log(`[OpenAI] Resposta recebida com sucesso (${content.length} caracteres)`);
      return content;
    }
    
    console.error("[OpenAI] Resposta inválida - campos disponíveis:", Object.keys(response || {}));
    console.error("[OpenAI] Resposta completa:", response);
    throw new Error("Resposta inválida da API de IA");
  } catch (error: any) {
    const errorMessage = getErrorMessage(error, MAX_RETRIES);
    console.error(`[OpenAI] Erro final após todas as tentativas: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

export function parseAIResponse(response: string): {
  needsConfirmation: boolean;
  action?: any;
  message: string;
} {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.needsConfirmation) {
        return parsed;
      }
    }
  } catch (error) {
    console.log("Response is not JSON, treating as plain text");
  }

  return {
    needsConfirmation: false,
    message: response,
  };
}
