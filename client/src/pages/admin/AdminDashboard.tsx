import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  MapPin, 
  Users, 
  DollarSign, 
  FileText,
  TrendingUp,
  TrendingDown,
  Home,
  Key,
  UserCheck,
  Wallet
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { formatPrice, cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// Color palette for charts
const COLORS = {
  primary: "#004A77",
  primaryLight: "#0a5f91",
  accent: "#916643",
  accentLight: "#E4D27C",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const STATUS_COLORS = {
  "Disponível": COLORS.success,
  "Vendido": COLORS.danger,
  "Alugado": COLORS.warning,
  "Para Venda": COLORS.success,
  "Para Aluguel": COLORS.info,
  "Venda/Aluguel": COLORS.accent,
  "Inativo": "#94a3b8",
};

const TYPE_COLORS = {
  "Casa padrão": COLORS.primary,
  "Casa em condomínio": COLORS.primaryLight,
  "Apartamento": COLORS.accent,
  "Terreno": COLORS.accentLight,
  "Comercial": COLORS.success,
  "Outro": "#94a3b8",
};

interface AnalyticsData {
  propertyStats: {
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    byNeighborhood: { neighborhood: string; count: number }[];
    priceRange: { min: number; max: number; avg: number };
    recent: { month: string; count: number }[];
  };
  financialStats: {
    byMonth: { month: string; revenue: number; expense: number }[];
    totals: { revenue: number; expense: number; balance: number };
    byCategory: { category: string; amount: number }[];
  };
  clientStats: {
    total: number;
    recent: number;
    growth: number;
  };
  ownerStats: {
    total: number;
    withProperties: number;
  };
}

export default function AdminDashboard() {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();

  // Invalidate analytics cache on mount to force fresh data
  useEffect(() => {
    if (isAdmin) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }, [isAdmin, isLoading, isAuthenticated]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    enabled: isAdmin,
  });

  const totalProperties = analytics?.propertyStats.byStatus.reduce(
    (acc, item) => acc + item.count,
    0
  ) || 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{label || payload[0]?.payload?.status || ''}</p>
          {payload.map((entry: any, index: number) => {
            const name = entry.name || entry.payload?.status || '';
            const shouldFormatPrice = 
              (typeof name === 'string' && (name.includes("R$") || name === "Receita" || name === "Despesa"));
            
            return (
              <p key={index} style={{ color: entry.color }}>
                {shouldFormatPrice ? formatPrice(entry.value) : `Total: ${entry.value}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {!isLoading && isAdmin && analytics && (
      <>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
          Painel Analítico
        </h1>
        <p className="text-muted-foreground">
          Visualização completa dos dados do sistema
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Imóveis</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProperties}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(analytics.propertyStats.byStatus.find(s => s.status === "Para Venda")?.count || 0) +
               (analytics.propertyStats.byStatus.find(s => s.status === "Para Aluguel")?.count || 0) +
               (analytics.propertyStats.byStatus.find(s => s.status === "Venda/Aluguel")?.count || 0)} disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatPrice(analytics.financialStats.totals.revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 6 meses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatPrice(analytics.financialStats.totals.expense)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 6 meses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              analytics.financialStats.totals.balance >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatPrice(analytics.financialStats.totals.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Property Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analytics.propertyStats.byStatus}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  label={({ value, percent }) => 
                    `${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="status"
                >
                  {analytics.propertyStats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Property Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.propertyStats.byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  type="category" 
                  dataKey="type" 
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Quantidade" radius={[0, 4, 4, 0]}>
                  {analytics.propertyStats.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type as keyof typeof TYPE_COLORS] || TYPE_COLORS["Outro"]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Financial Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo Financeiro Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={analytics.financialStats.byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => formatPrice(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke={COLORS.success}
                fill={COLORS.success}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesa"
                stroke={COLORS.danger}
                fill={COLORS.danger}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Properties by Neighborhood */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Bairros por Imóveis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={analytics.propertyStats.byNeighborhood}
                layout="vertical"
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis 
                  dataKey="neighborhood" 
                  type="category" 
                  width={85}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={COLORS.primary} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.financialStats.byCategory && analytics.financialStats.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.financialStats.byCategory.map((item) => ({
                      category: item.category,
                      value: Number(item.amount) || 0
                    }))}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ value, percent }) => 
                      `${formatPrice(value)} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="category"
                  >
                    {analytics.financialStats.byCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length] || "#8884d8"} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                <p className="text-sm">Nenhum dado de receita por categoria disponível</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.clientStats.total}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>+{analytics.clientStats.recent} novos (30 dias)</span>
              {analytics.clientStats.growth > 0 && (
                <span className="text-success">+{analytics.clientStats.growth.toFixed(1)}%</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proprietários</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.ownerStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(analytics.propertyStats.priceRange.avg)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Min: {formatPrice(analytics.propertyStats.priceRange.min)}
            </p>
            <p className="text-xs text-muted-foreground">
              Max: {formatPrice(analytics.propertyStats.priceRange.max)}
            </p>
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}