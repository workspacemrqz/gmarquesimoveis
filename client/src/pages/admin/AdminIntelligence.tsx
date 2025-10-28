import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles, CheckCircle2, XCircle, RefreshCw, User, Upload, X, Image as ImageIcon, Copy, Check, Settings, Mic, Square, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PropertyImage } from "@/components/PropertyImageUpload";
import logoEmpresa from "@/assets/logo-perfil.jpg";
import logoEvolutIA from "@/assets/logo-evolut-ia.png";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  action?: PendingAction;
  error?: boolean;
  retryPayload?: string;
  propertyImages?: Array<{
    id: string;
    title: string;
    images: string[];
  }>;
  attachedImages?: PropertyImage[];
}

interface PendingAction {
  type: string;
  data: any;
  confirmationMessage: string;
  itemDetails?: any;
}

interface AdminIntelligenceProps {
  isDarkMode?: boolean;
}

export default function AdminIntelligence({ isDarkMode = false }: AdminIntelligenceProps) {
  const { isAdmin, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"searching" | "typing" | null>(null);
  const [attachedImages, setAttachedImages] = useState<PropertyImage[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPropertySearchMode, setIsPropertySearchMode] = useState(false);
  const [isPropertyRegistrationMode, setIsPropertyRegistrationMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || isAdmin === false)) {
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }, [isAdmin, isAuthLoading, isAuthenticated]);

  const chatMutation = useMutation<any, Error, { message: string; images?: PropertyImage[] }>({
    mutationFn: async ({ message, images }) => {
      const payload: any = { message };
      
      if (images && images.length > 0) {
        console.log('[Frontend] Processando', images.length, 'imagens para upload');
        payload.images = await Promise.all(
          images.slice(0, 20).map(async (img) => {
            if (img.file) {
              const base64 = await fileToBase64(img.file);
              console.log('[Frontend] Imagem processada:', img.file.name, '- Tamanho base64:', base64.length);
              return {
                base64Data: base64,
                filename: img.file.name,
              };
            }
            return null;
          })
        ).then(results => results.filter(Boolean));
        console.log('[Frontend] Total de imagens processadas:', payload.images.length);
      } else {
        console.log('[Frontend] Nenhuma imagem para enviar');
      }
      
      console.log('[Frontend] Enviando payload com', payload.images?.length || 0, 'imagens');
      const response = await apiRequest("POST", "/api/admin/intelligence/chat", payload);
      return await response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (response: any) => {
      setIsTyping(false);
      console.log("[Frontend] Resposta recebida:", response);
      console.log("[Frontend] Mensagem:", response.message);
      const assistantMessage: ChatMessage = {
        id: response.messageId || Date.now().toString(),
        role: "assistant",
        content: response.message || "",
        timestamp: new Date(),
        action: response.action,
        propertyImages: response.propertyImages,
      };
      console.log("[Frontend] Mensagem do assistente criada:", assistantMessage);
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        console.log("[Frontend] Total de mensagens:", newMessages.length);
        return newMessages;
      });
    },
    onError: (error: any, variables) => {
      setIsTyping(false);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "error",
        content: error.message || "Não foi possível processar a mensagem. Tente novamente.",
        timestamp: new Date(),
        error: true,
        retryPayload: variables.message,
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const executeActionMutation = useMutation({
    mutationFn: async ({ messageId, confirmed }: { messageId: string; confirmed: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/intelligence/execute", { 
        messageId, 
        confirmed 
      });
      return await response.json();
    },
    onSuccess: (response: any) => {
      // Invalidar caches relevantes para garantir que os dados sejam atualizados em todas as páginas
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/neighborhoods"] });
      
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "error",
        content: error.message || "Erro ao executar a ação",
        timestamp: new Date(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const clearContextMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/intelligence/clear-context", {});
      return await response.json();
    },
    onSuccess: () => {
      // Contexto limpo silenciosamente
    },
    onError: (error: any) => {
      // Error clearing context
    },
  });

  const searchPropertiesMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/admin/intelligence/search-properties", { query });
      return await response.json();
    },
    onMutate: () => {
      setSearchStatus("searching");
      setIsTyping(true);
      
      // After 5 seconds, change to "typing" (estimating Perplexity search completes)
      setTimeout(() => {
        setSearchStatus("typing");
      }, 5000);
    },
    onSuccess: (data: any) => {
      setSearchStatus(null);
      setIsTyping(false);
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.results || "Nenhum resultado encontrado.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      setSearchStatus(null);
      setIsTyping(false);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "error",
        content: error.message || "Erro ao Pesquisar Imóveis. Por favor, tente novamente.",
        timestamp: new Date(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        title: "Erro na busca",
        description: "Não foi possível Pesquisar Imóveis. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const isAffirmativeResponse = (text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    const affirmativeWords = [
      'sim', 'confirmo', 'confirmar', 'ok', 'okay', 'pode', 'claro', 
      'concordo', 'aceito', 'positivo', 'yes', 'é isso', 'isso mesmo',
      'correto', 'certo', 'exato', 'perfeito', 'vai'
    ];
    return affirmativeWords.some(word => normalized === word || normalized.startsWith(word + ' '));
  };

  const isNegativeResponse = (text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    const negativeWords = [
      'não', 'nao', 'cancela', 'cancelar', 'não quero', 'nao quero',
      'negativo', 'no', 'nunca', 'jamais', 'errado', 'incorreto'
    ];
    return negativeWords.some(word => normalized === word || normalized.startsWith(word + ' '));
  };

  const findPendingActionMessage = (): ChatMessage | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.action) {
        return msg;
      }
      if (msg.role === 'user') {
        return null;
      }
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      return;
    }

    const maxImages = 20;
    const remainingSlots = maxImages - attachedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      // Too many images selected
    }

    const newImages: PropertyImage[] = filesToAdd.map(file => ({
      id: `new-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      isNew: true
    }));

    setAttachedImages(prev => [...prev, ...newImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachedImage = (id: string) => {
    const imageToRemove = attachedImages.find(img => img.id === id);
    if (imageToRemove?.preview.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSend = async () => {
    // Permitir envio se houver texto OU imagens
    if ((!input.trim() && attachedImages.length === 0) || chatMutation.isPending || searchPropertiesMutation.isPending) return;

    // Preparar mensagem do usuário
    const displayMessage = input.trim() || `Enviando ${attachedImages.length} ${attachedImages.length === 1 ? 'imagem' : 'imagens'}`;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayMessage,
      timestamp: new Date(),
      attachedImages: attachedImages.length > 0 ? [...attachedImages] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim() || `Estou enviando ${attachedImages.length} ${attachedImages.length === 1 ? 'imagem' : 'imagens'} do imóvel.`;
    const currentImages = [...attachedImages];
    setInput("");
    setAttachedImages([]);

    // If property search mode is active, use the search endpoint
    if (isPropertySearchMode) {
      searchPropertiesMutation.mutate(currentInput);
      return;
    }

    // If property registration mode is active, add context to the message
    let messageToSend = currentInput;
    if (isPropertyRegistrationMode) {
      if (currentImages.length > 0) {
        messageToSend = `[CONTEXTO: MODO CADASTRO ATIVADO. O usuário está cadastrando um novo imóvel e JÁ ENVIOU ${currentImages.length} IMAGENS. Use as informações fornecidas pelo usuário para extrair: título, tipo de imóvel, descrição, localização, preço se mencionado. NÃO peça informações que o usuário já forneceu na mensagem. Se faltarem informações importantes, pergunte apenas o que está faltando. As imagens já foram anexadas.]\n\nMensagem do usuário: ${currentInput}`;
      } else {
        messageToSend = `[CONTEXTO: MODO CADASTRO ATIVADO. Estou ajudando o usuário a cadastrar um novo imóvel. Guie-o através das etapas de cadastro solicitando informações relevantes como tipo, localização, características, preço e imagens. Seja objetivo e direto.]\n\nUsuário: ${currentInput}`;
      }
    } else {
      // Adicionar contexto informando que o modo de cadastro NÃO está ativo
      messageToSend = `[CONTEXTO: MODO CADASTRO DESATIVADO. Se o usuário solicitar cadastrar um imóvel, informe que é necessário ativar a utilidade 'Cadastrar Imóvel' primeiro através do menu Utilidades. Outras operações (consultar, atualizar, deletar) funcionam normalmente.]\n\nMensagem do usuário: ${currentInput}`;
    }

    const pendingMessage = findPendingActionMessage();
    
    if (pendingMessage && pendingMessage.action) {
      if (isAffirmativeResponse(currentInput)) {
        handleConfirmAction(pendingMessage.id, true);
        return;
      } else if (isNegativeResponse(currentInput)) {
        handleConfirmAction(pendingMessage.id, false);
        return;
      }
    }

    chatMutation.mutate({ 
      message: messageToSend,
      images: currentImages.length > 0 ? currentImages : undefined
    });
  };

  const handleRetry = (retryPayload: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: retryPayload,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate({ message: retryPayload });
  };

  const handleConfirmAction = (messageId: string, confirmed: boolean) => {
    executeActionMutation.mutate({ messageId, confirmed });
  };

  const handleNewConversation = () => {
    // Limpar contexto no backend
    clearContextMutation.mutate();
    
    // Desativar ambos os modos
    setIsPropertySearchMode(false);
    setIsPropertyRegistrationMode(false);
    
    // Limpar mensagens no frontend
    setMessages([]);
    
    // Limpar imagens anexadas
    attachedImages.forEach(img => {
      if (img.preview.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      }
    });
    setAttachedImages([]);
  };

  const handleTogglePropertySearch = () => {
    const newMode = !isPropertySearchMode;
    setIsPropertySearchMode(newMode);
    
    if (newMode) {
      // Desativar modo de cadastro se estiver ativo
      if (isPropertyRegistrationMode) {
        setIsPropertyRegistrationMode(false);
      }
      toast({
        title: "Modo de busca ativado",
        description: "Digite os critérios para Pesquisar Imóveis",
      });
    } else {
      toast({
        title: "Modo de busca desativado",
        description: "Voltando ao modo normal",
      });
    }
  };

  const handleTogglePropertyRegistration = () => {
    const newMode = !isPropertyRegistrationMode;
    setIsPropertyRegistrationMode(newMode);
    
    if (newMode) {
      // Desativar modo de busca se estiver ativo
      if (isPropertySearchMode) {
        setIsPropertySearchMode(false);
      }
      
      toast({
        title: "Modo de cadastro ativado",
        description: "Vou guiá-lo no cadastro do imóvel",
      });
    } else {
      // Limpar imagens anexadas ao desativar o modo
      attachedImages.forEach(img => {
        if (img.preview.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview);
        }
      });
      setAttachedImages([]);
      
      toast({
        title: "Modo de cadastro desativado",
        description: "Voltando ao modo normal",
      });
    }
  };

  const convertMarkdownToFormattedText = (markdown: string): string => {
    let text = markdown;
    
    // Preservar links de imóveis com URL relativa (/imoveis/...)
    text = text.replace(/\[([^\]]+)\]\((\/imoveis\/[^\)]+)\)/g, (match, linkText, url) => {
      const fullUrl = `${window.location.origin}${url}`;
      return `${linkText}: ${fullUrl}`;
    });
    
    // Preservar links de imóveis com URL completa (https://...imoveis/...)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]*\/imoveis\/[^\)]+)\)/g, (match, linkText, url) => {
      return `${linkText}: ${url}`;
    });
    
    // Para outros links, manter apenas o texto
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    // Manter asteriscos únicos para formatação do WhatsApp, mas remover múltiplos asteriscos
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '*$1*'); // ***text*** -> *text*
    text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*'); // **text** -> *text*
    // Manter asteriscos únicos para negrito do WhatsApp: *text*
    text = text.replace(/_([^_]+)_/g, '$1'); // _text_ -> text
    
    // Remove code blocks markers
    text = text.replace(/```[a-z]*\n/g, '');
    text = text.replace(/```/g, '');
    text = text.replace(/`([^`]+)`/g, '$1');
    
    // Convert headers to text with proper spacing
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n');
    
    // Convert bullet lists
    text = text.replace(/^[-*+]\s+(.+)$/gm, '  • $1');
    
    // Convert numbered lists (preserve original numbering)
    text = text.replace(/^(\d+)\.\s+(.+)$/gm, '  $1. $2');
    
    // Clean up excessive line breaks (more than 2)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim and return
    return text.trim();
  };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      const formattedText = convertMarkdownToFormattedText(content);
      await navigator.clipboard.writeText(formattedText);
      setCopiedMessageId(messageId);
      
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      // Error copying message
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      const response = await apiRequest('POST', '/api/admin/intelligence/transcribe', formData);
      const data = await response.json();
      
      if (data.text) {
        setInput(data.text);
        textareaRef.current?.focus();
        toast({
          title: "Transcrição concluída",
          description: "Áudio transcrito com sucesso!",
        });
      }
    } catch (error) {
      console.error('Erro ao transcrever áudio:', error);
      toast({
        title: "Erro na transcrição",
        description: "Não foi possível transcrever o áudio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };


  if (isAuthLoading || (isAuthenticated && isAdmin === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: isDarkMode ? '#060606' : undefined,
        color: isDarkMode ? '#FFFFFF' : undefined
      }}
    >
      <div className="container mx-auto max-w-5xl p-4 h-full flex flex-col">
      {/* Chat Area */}
      <Card 
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? '#1a1a1a' : undefined,
          borderColor: isDarkMode ? '#333333' : undefined
        }}
      >
        <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
          <ScrollArea ref={scrollAreaRef} className="h-full p-4">
            <div className="space-y-4">
              {/* Empty state title */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                  <div className="text-center space-y-3">
                    <img 
                      src={logoEvolutIA} 
                      alt="Evolut IA"
                      className="w-40 mx-auto"
                    />
                    <p 
                      className="text-sm"
                      style={{ color: isDarkMode ? '#FFFFFF' : undefined }}
                    >
                      Seu Agente de Inteligência
                    </p>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.role}`}
                >
                  <div className={cn(
                    "max-w-[80%] space-y-2",
                    message.role === "user" && "text-right"
                  )}>
                    <div 
                      className={cn(
                        "rounded-lg px-4 py-2.5 text-sm",
                        message.role === "user" 
                          ? "bg-gradient-to-r from-[#387DF3] to-[#2054DB] text-white ml-auto"
                          : message.error
                          ? "bg-destructive/10 text-destructive-foreground border border-destructive/20"
                          : "bg-card border border-border text-foreground"
                      )}
                      style={{
                        backgroundColor: message.role !== "user" && !message.error && isDarkMode ? '#1a1a1a' : undefined,
                        color: message.role !== "user" && !message.error && isDarkMode ? '#FFFFFF' : undefined,
                        borderColor: message.role !== "user" && !message.error && isDarkMode ? '#333333' : undefined
                      }}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div 
                          className="prose prose-sm max-w-none"
                          style={{
                            color: isDarkMode ? '#FFFFFF' : undefined
                          }}
                        >
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold" style={{ color: isDarkMode ? '#FFFFFF' : undefined }} {...props} />,
                              em: ({node, ...props}) => <em className="italic" style={{ color: isDarkMode ? '#FFFFFF' : undefined }} {...props} />,
                              code: ({node, ...props}) => <code className="bg-background/50 px-1 py-0.5 rounded text-xs" style={{ backgroundColor: isDarkMode ? '#333333' : undefined, color: isDarkMode ? '#FFFFFF' : undefined }} {...props} />,
                              a: ({node, href, children, ...props}) => {
                                if (href && href.startsWith('/imoveis/')) {
                                  return (
                                    <a 
                                      href={href} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-accent hover:text-accent/80 underline font-medium"
                                      style={{ color: isDarkMode ? '#FFFFFF' : undefined }}
                                      data-testid="link-property"
                                      {...props}
                                    >
                                      {children}
                                    </a>
                                  );
                                }
                                return <a href={href} className="text-accent hover:text-accent/80 underline" style={{ color: isDarkMode ? '#FFFFFF' : undefined }} {...props}>{children}</a>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    
                    {/* Miniaturas de imagens anexadas - embaixo do balão */}
                    {message.role === "user" && message.attachedImages && message.attachedImages.length > 0 && (
                      <div className="flex gap-1 flex-wrap justify-end mt-1">
                        {message.attachedImages.map((img, idx) => (
                          <div 
                            key={img.id} 
                            className="relative w-12 h-12 rounded-md overflow-hidden bg-white/10 border border-white/20"
                          >
                            <img
                              src={img.preview}
                              alt={`Anexo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(message.role === "assistant" && !message.error && !message.action) || message.action ? (
                      <div className={cn(
                        "flex items-center gap-2",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}>
                        {message.role === "assistant" && !message.error && !message.action && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMessage(message.id, message.content)}
                            className="h-6 px-2 text-xs"
                            style={{ color: isDarkMode ? '#FFFFFF' : undefined }}
                            data-testid={`button-copy-${message.id}`}
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        
                        {message.action && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmAction(message.id, true)}
                            disabled={executeActionMutation.isPending}
                            data-testid="button-confirm-action"
                            className="bg-gradient-to-r from-[#387DF3] to-[#2054DB] hover:from-[#2f6dd9] hover:to-[#1a46c4] text-white border-0 h-6 px-3 text-xs"
                          >
                            {executeActionMutation.isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Confirmando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Confirmar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {/* Renderizar imagens de propriedades se disponíveis */}
                    {message.propertyImages && message.propertyImages.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {message.propertyImages.map(property => (
                          <div key={property.id} className="space-y-2">
                            <p 
                              className="text-sm font-medium"
                              style={{ color: isDarkMode ? '#FFFFFF' : undefined }}
                            >
                              {property.title}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {property.images.map((image, idx) => (
                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                  <img 
                                    src={image} 
                                    alt={`${property.title} - Foto ${idx + 1}`}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.error && message.retryPayload && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(message.retryPayload!)}
                        disabled={chatMutation.isPending}
                        className="mt-2"
                        style={{
                          color: isDarkMode ? '#FFFFFF' : undefined,
                          borderColor: isDarkMode ? '#333333' : undefined
                        }}
                        data-testid="button-retry"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Tentar Novamente
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div 
                    className="bg-muted rounded-lg px-4 py-2.5"
                    style={{
                      backgroundColor: isDarkMode ? '#1a1a1a' : undefined
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-sm"
                        style={{ color: isDarkMode ? '#FFFFFF' : undefined }}
                      >
                        {searchStatus === "searching" ? "IA está pesquisando" : "IA está digitando"}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <CardFooter 
          className="border-t p-3 flex-shrink-0"
          style={{
            borderColor: isDarkMode ? '#333333' : undefined
          }}
        >
          <div className="flex flex-col gap-2 w-full">
            
            {/* Property Search Mode Indicator */}
            {isPropertySearchMode && (
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#387DF3] to-[#2054DB] shadow-md flex items-center">
                <button
                  onClick={() => {}}
                  className="h-full px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors border-r border-white/20 flex items-center justify-center cursor-default"
                  data-testid="button-search-icon"
                >
                  <Search className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center flex-1 px-4">
                  <span className="text-sm font-medium text-white">Pesquisar Imóveis</span>
                </div>
              </div>
            )}
            
            {/* Property Registration Mode Indicator */}
            {isPropertyRegistrationMode && (
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#387DF3] to-[#2054DB] shadow-md flex items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-full px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors border-r border-white/20 flex items-center justify-center"
                  data-testid="button-upload-photos"
                >
                  <Upload className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center flex-1 px-4">
                  <span className="text-sm font-medium text-white">
                    {attachedImages.length > 0 
                      ? `${attachedImages.length} ${attachedImages.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`
                      : 'Envie as fotos do imóvel'
                    }
                  </span>
                </div>
              </div>
            )}
            
            {/* Image Preview */}
            {attachedImages.length > 0 && (
              <div className="flex gap-2 flex-wrap p-2 rounded-lg border"
                style={{
                  backgroundColor: isDarkMode ? '#1a1a1a' : undefined,
                  borderColor: isDarkMode ? '#333333' : undefined
                }}
              >
                {attachedImages.map((image) => (
                  <div 
                    key={image.id} 
                    className="relative w-20 h-20 rounded-lg overflow-hidden group"
                  >
                    <img
                      src={image.preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeAttachedImage(image.id)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-image-${image.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Message Input */}
            <div className="relative w-full">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="min-h-[40px] resize-none w-full"
                style={{
                  backgroundColor: isDarkMode ? '#1a1a1a' : undefined,
                  color: isDarkMode ? '#FFFFFF' : undefined,
                  borderColor: isDarkMode ? '#333333' : undefined,
                  ...(isDarkMode && {
                    '--tw-ring-color': '#333333',
                  } as React.CSSProperties)
                }}
                disabled={chatMutation.isPending || searchPropertiesMutation.isPending}
                data-testid="input-message"
                rows={1}
              />
              {isDarkMode && (
                <style>{`
                  textarea[data-testid="input-message"] {
                    background-color: #1a1a1a !important;
                    color: #FFFFFF !important;
                    border-color: #333333 !important;
                  }
                  textarea[data-testid="input-message"]::placeholder {
                    color: #888888 !important;
                    opacity: 1 !important;
                  }
                  textarea[data-testid="input-message"]:focus {
                    background-color: #1a1a1a !important;
                    color: #FFFFFF !important;
                    border-color: #333333 !important;
                  }
                `}</style>
              )}
            </div>
            
            {/* Utilities and Send Button */}
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleNewConversation}
                disabled={clearContextMutation.isPending}
                variant="outline"
                className="w-10 h-10"
                style={{
                  color: isDarkMode ? '#FFFFFF' : undefined,
                  borderColor: isDarkMode ? '#333333' : undefined
                }}
                data-testid="button-new-conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              
              {isPropertySearchMode || isPropertyRegistrationMode ? (
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  disabled={chatMutation.isPending}
                  style={{
                    color: isDarkMode ? '#FFFFFF' : undefined,
                    borderColor: isDarkMode ? '#333333' : undefined
                  }}
                  onClick={() => {
                    if (isPropertySearchMode) handleTogglePropertySearch();
                    if (isPropertyRegistrationMode) handleTogglePropertyRegistration();
                  }}
                  data-testid="button-deactivate"
                >
                  <X className="w-4 h-4 mr-2" />
                  Desativar
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 h-10"
                      disabled={chatMutation.isPending}
                      style={{
                        color: isDarkMode ? '#FFFFFF' : undefined,
                        borderColor: isDarkMode ? '#333333' : undefined
                      }}
                      data-testid="button-utilities"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Utilidades
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56"
                    style={{
                      backgroundColor: isDarkMode ? '#1a1a1a' : undefined,
                      borderColor: isDarkMode ? '#333333' : undefined
                    }}
                  >
                    <DropdownMenuItem
                      onClick={handleTogglePropertyRegistration}
                      disabled={chatMutation.isPending || searchPropertiesMutation.isPending}
                      data-testid="menu-register-property"
                      style={{
                        color: isDarkMode ? '#FFFFFF' : undefined
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Cadastrar Imóvel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleTogglePropertySearch}
                      disabled={chatMutation.isPending || searchPropertiesMutation.isPending}
                      data-testid="menu-search-properties"
                      style={{
                        color: isDarkMode ? '#FFFFFF' : undefined
                      }}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Pesquisar Imóveis
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={chatMutation.isPending || isTranscribing}
                className="w-10 h-10"
                variant={isRecording ? "destructive" : "outline"}
                style={{
                  color: !isRecording && isDarkMode ? '#FFFFFF' : undefined,
                  borderColor: !isRecording && isDarkMode ? '#333333' : undefined
                }}
                data-testid="button-audio"
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && attachedImages.length === 0) || chatMutation.isPending || searchPropertiesMutation.isPending}
                className="w-10 h-10 bg-gradient-to-r from-[#387DF3] to-[#2054DB] hover:from-[#2f6dd9] hover:to-[#1a46c4] text-white border-0"
                data-testid="button-send"
              >
                {(chatMutation.isPending || searchPropertiesMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
      
      {/* Hidden file input for property photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      </div>
    </div>
  );
}