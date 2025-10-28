import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Download,
  MousePointer,
  Copy,
  Image as ImageIcon,
  Settings,
  Clock,
  MapPin,
  User
} from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ImageAccessLog {
  id: string;
  imageUrl: string;
  ipAddress: string | null;
  userAgent: string | null;
  accessType: string;
  success: boolean;
  blockReason: string | null;
  createdAt: string;
}

interface ImageSecuritySettings {
  id?: string;
  enableTokenAuth: boolean;
  enableRefererCheck: boolean;
  enableIpRestriction: boolean;
  allowedReferers: string[];
  allowedIps: string[];
  tokenExpirationMinutes: number;
  maxViewsPerToken: number;
  enableWatermark: boolean;
  enableCanvasRendering: boolean;
  enableContextMenuBlock: boolean;
  enableDragBlock: boolean;
  enableSelectBlock: boolean;
  alertThreshold: number;
}

export default function AdminImageSecurity() {
  const [page, setPage] = useState(1);
  const [filterSuccess, setFilterSuccess] = useState<boolean | undefined>(undefined);
  const [filterAccessType, setFilterAccessType] = useState<string>("");
  
  // Buscar logs de acesso
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{
    logs: ImageAccessLog[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/secure-image/access-logs", { page, success: filterSuccess, accessType: filterAccessType }],
  });

  // Buscar configurações
  const { data: settings, isLoading: settingsLoading } = useQuery<ImageSecuritySettings>({
    queryKey: ["/api/admin/secure-image/settings"],
  });

  // Mutation para atualizar configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<ImageSecuritySettings>) => {
      return await apiRequest("POST", "/api/admin/secure-image/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/secure-image/settings"] });
    },
  });

  const handleToggleSetting = (key: keyof ImageSecuritySettings, value: boolean) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleUpdateNumberSetting = (key: keyof ImageSecuritySettings, value: number) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ [key]: value });
  };

  // Estatísticas dos logs
  const stats = {
    total: logsData?.total || 0,
    successful: logsData?.logs?.filter(log => log.success).length || 0,
    blocked: logsData?.logs?.filter(log => !log.success).length || 0,
  };

  const getAccessTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'right_click_attempt':
      case 'context_menu':
        return <MousePointer className="w-4 h-4" />;
      case 'download_attempt':
      case 'save_attempt':
        return <Download className="w-4 h-4" />;
      case 'copy_attempt':
        return <Copy className="w-4 h-4" />;
      case 'drag_attempt':
        return <ImageIcon className="w-4 h-4" />;
      case 'view':
        return <Eye className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getAccessTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'view': 'Visualização',
      'right_click_attempt': 'Tentativa de Clique Direito',
      'download_attempt': 'Tentativa de Download',
      'drag_attempt': 'Tentativa de Arrastar',
      'copy_attempt': 'Tentativa de Copiar',
      'save_attempt': 'Tentativa de Salvar',
      'devtools_opened': 'DevTools Aberto',
      'print_screen_attempt': 'Tentativa de Print Screen',
      'f12_pressed': 'Tecla F12 Pressionada',
      'hotlink_attempt': 'Tentativa de Hotlink',
      'ip_blocked': 'IP Bloqueado',
      'multiple_suspicious_attempts': 'Múltiplas Tentativas Suspeitas',
    };
    return labels[type] || type;
  };

  if (settingsLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Carregando configurações de segurança...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2" data-testid="text-title">
          <Shield className="w-8 h-8 text-primary" />
          Segurança de Imagens
        </h1>
        <p className="text-muted-foreground">
          Configure a proteção de imagens e monitore tentativas de acesso suspeitas
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Acessos</p>
                <p className="text-2xl font-bold" data-testid="text-total-access">{stats.total}</p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acessos Permitidos</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-successful-access">{stats.successful}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tentativas Bloqueadas</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-blocked-access">{stats.blocked}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="logs" data-testid="tab-logs">Logs de Acesso</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Logs de Acesso */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Acesso às Imagens</CardTitle>
              <CardDescription>
                Histórico de todas as tentativas de acesso às imagens protegidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label>Filtrar por status:</Label>
                  <select
                    className="border rounded px-3 py-1"
                    value={filterSuccess === undefined ? "" : filterSuccess ? "true" : "false"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterSuccess(value === "" ? undefined : value === "true");
                      setPage(1);
                    }}
                    data-testid="filter-success"
                  >
                    <option value="">Todos</option>
                    <option value="true">Permitidos</option>
                    <option value="false">Bloqueados</option>
                  </select>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  data-testid="button-refresh"
                >
                  Atualizar
                </Button>
              </div>

              {/* Lista de Logs */}
              <div className="space-y-2">
                {logsData?.logs && logsData.logs.length > 0 ? (
                  logsData.logs.map((log) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-4 ${
                        log.success 
                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                          : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      }`}
                      data-testid={`log-item-${log.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getAccessTypeIcon(log.accessType)}
                            <span className="font-medium">
                              {getAccessTypeLabel(log.accessType)}
                            </span>
                            <Badge variant={log.success ? "default" : "destructive"}>
                              {log.success ? "Permitido" : "Bloqueado"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3" />
                              <span>IP: {log.ipAddress || 'Desconhecido'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDistanceToNow(new Date(log.createdAt), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          </div>

                          {log.blockReason && (
                            <div className="mt-2">
                              <Alert variant="destructive" className="py-2">
                                <AlertDescription className="text-xs">
                                  Motivo: {log.blockReason}
                                </AlertDescription>
                              </Alert>
                            </div>
                          )}

                          {log.userAgent && (
                            <div className="mt-2 text-xs text-muted-foreground truncate">
                              User Agent: {log.userAgent}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum log de acesso encontrado</p>
                  </div>
                )}
              </div>

              {/* Paginação */}
              {logsData && logsData.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-4">
                    Página {page} de {logsData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(logsData.totalPages, page + 1))}
                    disabled={page === logsData.totalPages}
                    data-testid="button-next-page"
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configurações de Segurança */}
        <TabsContent value="settings" className="space-y-4">
          {settings && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Autenticação e Tokens</CardTitle>
                  <CardDescription>
                    Configure o sistema de tokens temporários para acesso às imagens
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableTokenAuth">Habilitar autenticação por token</Label>
                      <p className="text-sm text-muted-foreground">
                        Exigir token válido para acessar imagens protegidas
                      </p>
                    </div>
                    <Switch
                      id="enableTokenAuth"
                      checked={settings.enableTokenAuth}
                      onCheckedChange={(checked) => handleToggleSetting('enableTokenAuth', checked)}
                      data-testid="switch-token-auth"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tokenExpiration">Tempo de expiração do token (minutos)</Label>
                    <Input
                      id="tokenExpiration"
                      type="number"
                      value={settings.tokenExpirationMinutes}
                      onChange={(e) => handleUpdateNumberSetting('tokenExpirationMinutes', parseInt(e.target.value))}
                      min={1}
                      max={1440}
                      data-testid="input-token-expiration"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxViews">Máximo de visualizações por token</Label>
                    <Input
                      id="maxViews"
                      type="number"
                      value={settings.maxViewsPerToken}
                      onChange={(e) => handleUpdateNumberSetting('maxViewsPerToken', parseInt(e.target.value))}
                      min={1}
                      max={100}
                      data-testid="input-max-views"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Proteção contra Hotlinking</CardTitle>
                  <CardDescription>
                    Configure verificações de origem para prevenir uso não autorizado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableRefererCheck">Verificar referer</Label>
                      <p className="text-sm text-muted-foreground">
                        Bloquear acesso de origens não autorizadas
                      </p>
                    </div>
                    <Switch
                      id="enableRefererCheck"
                      checked={settings.enableRefererCheck}
                      onCheckedChange={(checked) => handleToggleSetting('enableRefererCheck', checked)}
                      data-testid="switch-referer-check"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Restrição de IP</CardTitle>
                  <CardDescription>
                    Limitar acesso apenas a IPs específicos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableIpRestriction">Habilitar restrição de IP</Label>
                      <p className="text-sm text-muted-foreground">
                        Permitir acesso apenas de IPs autorizados
                      </p>
                    </div>
                    <Switch
                      id="enableIpRestriction"
                      checked={settings.enableIpRestriction}
                      onCheckedChange={(checked) => handleToggleSetting('enableIpRestriction', checked)}
                      data-testid="switch-ip-restriction"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Proteções no Frontend</CardTitle>
                  <CardDescription>
                    Configure recursos de proteção na interface do usuário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableWatermark">Marca d'água</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicionar marca d'água visível nas imagens
                      </p>
                    </div>
                    <Switch
                      id="enableWatermark"
                      checked={settings.enableWatermark}
                      onCheckedChange={(checked) => handleToggleSetting('enableWatermark', checked)}
                      data-testid="switch-watermark"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableCanvasRendering">Renderização via Canvas</Label>
                      <p className="text-sm text-muted-foreground">
                        Renderizar imagens usando canvas para dificultar downloads
                      </p>
                    </div>
                    <Switch
                      id="enableCanvasRendering"
                      checked={settings.enableCanvasRendering}
                      onCheckedChange={(checked) => handleToggleSetting('enableCanvasRendering', checked)}
                      data-testid="switch-canvas"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableContextMenuBlock">Bloquear menu de contexto</Label>
                      <p className="text-sm text-muted-foreground">
                        Desabilitar clique direito nas imagens
                      </p>
                    </div>
                    <Switch
                      id="enableContextMenuBlock"
                      checked={settings.enableContextMenuBlock}
                      onCheckedChange={(checked) => handleToggleSetting('enableContextMenuBlock', checked)}
                      data-testid="switch-context-menu"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableDragBlock">Bloquear arrastar</Label>
                      <p className="text-sm text-muted-foreground">
                        Prevenir que usuários arrastem as imagens
                      </p>
                    </div>
                    <Switch
                      id="enableDragBlock"
                      checked={settings.enableDragBlock}
                      onCheckedChange={(checked) => handleToggleSetting('enableDragBlock', checked)}
                      data-testid="switch-drag"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableSelectBlock">Bloquear seleção</Label>
                      <p className="text-sm text-muted-foreground">
                        Prevenir seleção de texto e imagens
                      </p>
                    </div>
                    <Switch
                      id="enableSelectBlock"
                      checked={settings.enableSelectBlock}
                      onCheckedChange={(checked) => handleToggleSetting('enableSelectBlock', checked)}
                      data-testid="switch-select"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alertas de Segurança</CardTitle>
                  <CardDescription>
                    Configure limites para detecção de atividades suspeitas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="alertThreshold">Limite para alertas</Label>
                    <Input
                      id="alertThreshold"
                      type="number"
                      value={settings.alertThreshold}
                      onChange={(e) => handleUpdateNumberSetting('alertThreshold', parseInt(e.target.value))}
                      min={1}
                      max={50}
                      data-testid="input-alert-threshold"
                    />
                    <p className="text-sm text-muted-foreground">
                      Número de tentativas falhas antes de gerar alerta
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
