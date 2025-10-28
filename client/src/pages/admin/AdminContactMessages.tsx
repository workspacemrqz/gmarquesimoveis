import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Phone, User, Calendar, Trash2, Check, Eye, Copy, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { ContactMessage } from "@shared/schema";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminContactMessages() {
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: messages = [], isLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contact-messages"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/contact-messages/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/contact-messages/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
      setSelectedMessage(null);
    },
  });

  const handleView = (message: ContactMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const handleCopyMessage = (message: ContactMessage) => {
    const formattedText = `
DETALHES DA MENSAGEM DE CONTATO
═══════════════════════════════════

📋 INFORMAÇÕES DO CONTATO
─────────────────────────────────

Nome: ${message.name}
E-mail: ${message.email}
Telefone: ${message.phone}
Data de Envio: ${message.createdAt ? format(new Date(message.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}

─────────────────────────────────

💬 MENSAGEM
─────────────────────────────────

${message.message}

═══════════════════════════════════
    `.trim();

    navigator.clipboard.writeText(formattedText).then(() => {
      // Content copied successfully
    }).catch(() => {
      // Error copying content
    });
  };

  const handleSort = (column: 'date' | 'name' | 'status') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedMessages = [...messages].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'date') {
      comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    } else if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'status') {
      comparison = (a.isRead === b.isRead) ? 0 : a.isRead ? 1 : -1;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
            Formulários Recebidos
          </h1>
          <p className="text-muted-foreground">
            {messages.length} mensagens • {unreadCount > 0 && `${unreadCount} não lidas`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma mensagem recebida</h3>
            <p className="text-muted-foreground">
              As mensagens enviadas através do formulário de contato aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold text-sm">
                    <button 
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-accent transition-colors"
                      data-testid="button-sort-status"
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 font-semibold text-sm">
                    <button 
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-accent transition-colors"
                      data-testid="button-sort-name"
                    >
                      Nome
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 font-semibold text-sm hidden md:table-cell">
                    E-mail
                  </th>
                  <th className="text-left p-4 font-semibold text-sm hidden lg:table-cell">
                    Telefone
                  </th>
                  <th className="text-left p-4 font-semibold text-sm hidden xl:table-cell max-w-md">
                    Mensagem
                  </th>
                  <th className="text-left p-4 font-semibold text-sm">
                    <button 
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:text-accent transition-colors"
                      data-testid="button-sort-date"
                    >
                      Data
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-right p-4 font-semibold text-sm">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMessages.map((message, index) => (
                  <tr 
                    key={message.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                      !message.isRead ? 'bg-accent/5' : ''
                    }`}
                    data-testid={`row-message-${message.id}`}
                  >
                    <td className="p-4">
                      {!message.isRead ? (
                        <Badge 
                          variant="default" 
                          className="bg-accent text-accent-foreground border-0 text-xs"
                          data-testid={`badge-new-${message.id}`}
                        >
                          Nova
                        </Badge>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          data-testid={`badge-read-${message.id}`}
                        >
                          Lida
                        </Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground hidden sm:block" />
                        <span className="font-medium">{message.name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate max-w-xs">{message.email}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{message.phone}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden xl:table-cell max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2 truncate">
                        {message.message}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0 hidden sm:block" />
                        <span className="whitespace-nowrap">
                          {message.createdAt && format(new Date(message.createdAt), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(message)}
                          data-testid={`button-view-${message.id}`}
                          className="h-8 w-8 p-0"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!message.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(message.id)}
                            data-testid={`button-mark-read-${message.id}`}
                            className="h-8 w-8 p-0"
                            title="Marcar como lida"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMessageToDelete(message.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${message.id}`}
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Mensagem</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{selectedMessage.name}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedMessage.email}`} className="text-accent hover:underline">
                      {selectedMessage.email}
                    </a>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedMessage.phone}`} className="text-accent hover:underline">
                      {selectedMessage.phone}
                    </a>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data de Envio</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">
                      {selectedMessage.createdAt && format(new Date(selectedMessage.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Mensagem</label>
                  <div className="mt-2 p-4 bg-muted/30 rounded-lg">
                    <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMessage(null)}
                  data-testid="button-close-dialog"
                >
                  Fechar
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleCopyMessage(selectedMessage)}
                  data-testid="button-copy-dialog"
                  className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (messageToDelete) {
            deleteMutation.mutate(messageToDelete);
            setMessageToDelete(null);
          }
        }}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
