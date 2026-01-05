import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Banknote,
  FileX2,
  Target
} from "lucide-react";
import { formatCurrency, formatConvenioDisplayName } from "@/utils/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList } from "recharts";
import type { ConciliationItem, Divergence } from "@/hooks/useConciliation";

interface ConciliationOverviewProps {
  stats: {
    totalBilled: number;
    totalReceived: number;
    totalGlossed: number;
    totalOpen: number;
    conciliationRate: number;
    pendingCount: number;
    avgAge: number;
    criticalCount15: number;
    criticalCount30: number;
    divergenceCount: number;
  };
  paretoByConvenio: Array<{ convenio: string; openAmount: number; count: number }>;
  pendingItems: ConciliationItem[];
}

export function ConciliationOverview({ stats, paretoByConvenio, pendingItems }: ConciliationOverviewProps) {
  // Funnel data
  const funnelData = [
    { name: "Faturado", value: stats.totalBilled, fill: "hsl(var(--primary))" },
    { name: "Conciliado", value: stats.totalReceived, fill: "hsl(var(--success))" },
    { name: "Parcial", value: stats.totalOpen > 0 ? stats.totalOpen * 0.3 : 0, fill: "hsl(var(--warning))" },
    { name: "Em Aberto", value: stats.totalOpen, fill: "hsl(var(--muted-foreground))" },
    { name: "Glosado", value: stats.totalGlossed, fill: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  // Pareto chart data (top 10)
  const paretoChartData = paretoByConvenio.slice(0, 10).map(p => ({
    name: formatConvenioDisplayName(p.convenio).substring(0, 12),
    value: p.openAmount,
  }));

  // Executive reading
  const topConvenio = paretoByConvenio[0];
  const criticalPriority = stats.criticalCount30 > 0 
    ? `${stats.criticalCount30} itens críticos (>30 dias)` 
    : stats.criticalCount15 > 0 
    ? `${stats.criticalCount15} itens críticos (>15 dias)`
    : "Sem itens críticos";

  const nextBestAction = stats.criticalCount30 > 0
    ? `Priorizar cobrança dos ${stats.criticalCount30} itens com mais de 30 dias em aberto${topConvenio ? ` do convênio ${formatConvenioDisplayName(topConvenio.convenio)}` : ""}`
    : stats.totalGlossed > 1000
    ? `Revisar ${formatCurrency(stats.totalGlossed)} em glosas para possível recurso`
    : stats.pendingCount > 0
    ? `Acompanhar ${stats.pendingCount} pendências com idade média de ${stats.avgAge} dias`
    : "Conciliação em dia — manter monitoramento regular";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBilled)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats.totalReceived)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Glosado</CardTitle>
            <FileX2 className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalGlossed)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
            <Banknote className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(stats.totalOpen)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Conciliação</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conciliationRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Idade média: {stats.avgAge} dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pareto Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendências por Convênio (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {paretoChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={paretoChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Convênio: ${label}`}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                Sem pendências para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Executive Reading */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Leitura Executiva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  {stats.conciliationRate >= 90 
                    ? "Excelente taxa de conciliação — acima de 90%"
                    : stats.conciliationRate >= 70
                    ? "Taxa de conciliação moderada — atenção às pendências"
                    : "Taxa de conciliação baixa — priorizar revisão"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{criticalPriority}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  {stats.divergenceCount > 0 
                    ? `${stats.divergenceCount} divergências detectadas para investigação`
                    : "Nenhuma divergência detectada"}
                </span>
              </li>
            </ul>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <AlertTriangle className="h-4 w-4" />
                Próxima Melhor Ação
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextBestAction}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert badges */}
      {(stats.criticalCount15 > 0 || stats.criticalCount30 > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.criticalCount30 > 0 && (
            <Badge variant="destructive" className="text-sm">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {stats.criticalCount30} críticos &gt; 30 dias
            </Badge>
          )}
          {stats.criticalCount15 > 0 && stats.criticalCount30 === 0 && (
            <Badge variant="outline" className="border-warning text-warning text-sm">
              <Clock className="mr-1 h-3 w-3" />
              {stats.criticalCount15} críticos &gt; 15 dias
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
