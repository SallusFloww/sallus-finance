import * as React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BIChartData } from "@/hooks/useBIData";
import { formatCurrency, formatCompactCurrency } from "@/utils/formatters";
import { useBIFilters } from "@/contexts/BIFilterContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDoctors } from "@/hooks/useDoctors";
import {
  Activity,
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Layers,
  Users,
  Building2,
  Hourglass,
  AlertTriangle,
} from "lucide-react";

/**
 * ✅ BICharts (Premium Power BI Feeling)
 * - Cartões mais "Power BI": fundo branco, borda suave, sombra leve, header com ícone
 * - Interação: hover + badge “Clique para filtrar”
 * - Tooltips consistentes
 * - Estados vazios mais elegantes
 */

// Paleta neutra e elegante (não depende de theme hardcoded do Tailwind)
const COLORS = [
  "hsl(210, 70%, 40%)",
  "hsl(165, 60%, 35%)",
  "hsl(38, 80%, 50%)",
  "hsl(0, 65%, 50%)",
  "hsl(200, 60%, 45%)",
  "hsl(280, 60%, 50%)",
  "hsl(120, 50%, 40%)",
  "hsl(30, 70%, 45%)",
];

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-white shadow-xl px-3 py-2 text-xs">{children}</div>;
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
      <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-muted-foreground/70" />
      </div>
      <p className="text-sm font-semibold text-foreground/80">{title}</p>
      <p className="text-xs mt-1 text-center max-w-[240px]">{subtitle}</p>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  type: "caixa" | "competencia";
  icon?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  interactive?: boolean;
  rightSlot?: React.ReactNode;
}

function ChartCard({ title, type, icon, children, isEmpty, interactive, rightSlot }: ChartCardProps) {
  return (
    <Card
      className={cn(
        "shadow-sm border-border/60 bg-white",
        "transition-all duration-200",
        interactive && "hover:shadow-md hover:border-primary/30",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground">
              {icon}
            </div>

            <div className="flex flex-col">
              <CardTitle className="text-[13px] font-semibold leading-tight">{title}</CardTitle>

              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5 px-2 rounded-full",
                    type === "caixa"
                      ? "border-primary/25 text-primary bg-primary/5"
                      : "border-emerald-500/25 text-emerald-700 bg-emerald-500/5",
                  )}
                >
                  {type === "caixa" ? "Caixa" : "Competência"}
                </Badge>

                {interactive && !isEmpty && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-2 rounded-full border-primary/20 text-primary bg-primary/5"
                  >
                    Clique para filtrar
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {rightSlot ? <div className="pt-1">{rightSlot}</div> : null}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isEmpty ? (
          <EmptyState title="Sem dados suficientes" subtitle="Ajuste filtros ou aguarde consolidação do período." />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Evolução do Caixa (Linha)
// ============================================
export function CashEvolutionChart({ data }: { data: BIChartData["cashEvolution"] }) {
  return (
    <ChartCard
      title="Evolução do Saldo"
      type="caixa"
      icon={<Activity className="h-4 w-4" />}
      isEmpty={data.length === 0}
      rightSlot={
        <Badge variant="secondary" className="text-[10px] rounded-full">
          Saldo
        </Badge>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Saldo</span>
                      <span className="font-semibold">{formatCurrency(p.saldo)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Entradas</span>
                      <span className="font-medium">{formatCurrency(p.entradas)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Saídas</span>
                      <span className="font-medium">{formatCurrency(p.saidas)}</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="hsl(210, 70%, 40%)"
            strokeWidth={2.5}
            dot={false}
            name="Saldo"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Entradas vs Saídas (Barras)
// ============================================
export function IncomeVsExpenseChart({ data }: { data: BIChartData["incomeVsExpense"] }) {
  return (
    <ChartCard
      title="Entradas vs Saídas"
      type="caixa"
      icon={<Wallet className="h-4 w-4" />}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Entradas</span>
                      <span className="font-semibold">{formatCurrency(p.entradas)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Saídas</span>
                      <span className="font-semibold">{formatCurrency(p.saidas)}</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="entradas" fill="hsl(152, 60%, 38%)" name="Entradas" radius={[6, 6, 0, 0]} />
          <Bar dataKey="saidas" fill="hsl(0, 65%, 50%)" name="Saídas" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Funil de Conversão (INTERATIVO)
// ============================================
export function ConversionFunnelChart({ data }: { data: BIChartData["funnel"] }) {
  const { onChartClick, openDrilldown } = useBIFilters();

  const handleClick = (stage: string) => {
    onChartClick("funnel", stage);
    openDrilldown({
      type: "funnel",
      title: `Detalhes: ${stage}`,
      value: stage,
      filters: {
        origin: stage === "Produzido" ? "producao" : stage === "Faturado" ? "faturamento" : "recebimento",
      },
    });
  };

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartCard
      title="Funil: Produção → Recebido"
      type="competencia"
      icon={<TrendingUp className="h-4 w-4" />}
      isEmpty={data.every((d) => d.value === 0)}
      interactive
    >
      <div className="space-y-3 py-2">
        {data.map((item, index) => {
          const width = (item.value / maxValue) * 100;
          const colors = ["hsl(210, 70%, 40%)", "hsl(165, 60%, 35%)", "hsl(38, 80%, 50%)", "hsl(0, 65%, 50%)"];

          return (
            <div key={item.stage} className="group cursor-pointer" onClick={() => handleClick(item.stage)}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold group-hover:text-primary transition-colors">{item.stage}</span>
                <span className="text-muted-foreground">{formatCurrency(item.value)}</span>
              </div>

              <div className="h-9 bg-muted/25 rounded-xl overflow-hidden relative border border-border/50">
                <div
                  className="h-full rounded-xl transition-all group-hover:opacity-85"
                  style={{
                    width: `${width}%`,
                    backgroundColor: colors[index],
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground/70">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

// ============================================
// Recebido por Pagador (Donut INTERATIVO)
// ============================================
export function ReceivedByPayerChart({ data }: { data: BIChartData["receivedByPayer"] }) {
  const { onChartClick, openDrilldown } = useBIFilters();

  const handleClick = (payer: string) => {
    onChartClick("payer", payer);
    openDrilldown({
      type: "payer",
      title: `Recebimentos: ${payer}`,
      value: payer,
      filters: { payer },
    });
  };

  return (
    <ChartCard
      title="Recebido por Pagador"
      type="caixa"
      icon={<CircleDollarSign className="h-4 w-4" />}
      isEmpty={data.length === 0}
      interactive
    >
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="45%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="payer"
            onClick={(entry) => handleClick(entry.payer)}
            style={{ cursor: "pointer" }}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{p.payer}</div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-semibold">{formatCurrency(p.value)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Participação</span>
                    <span className="font-medium">{(p.percentage || 0).toFixed(1)}%</span>
                  </div>
                </TooltipBox>
              );
            }}
          />

          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: "11px" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Top Categorias de Saída (INTERATIVO)
// ============================================
export function TopExpenseCategoriesChart({ data }: { data: BIChartData["topExpenseCategories"] }) {
  const { onChartClick, openDrilldown } = useBIFilters();

  const handleClick = (category: string) => {
    onChartClick("category", category);
    openDrilldown({
      type: "category",
      title: `Despesas: ${category}`,
      value: category,
      filters: { category },
    });
  };

  return (
    <ChartCard
      title="Top Categorias de Saída"
      type="caixa"
      icon={<Layers className="h-4 w-4" />}
      isEmpty={data.length === 0}
      interactive
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data.slice(0, 7)}
          layout="vertical"
          margin={{ top: 8, right: 20, left: 70, bottom: 8 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { category } = e.activePayload[0].payload;
              handleClick(category);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            width={70}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{p.category}</div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-semibold">{formatCurrency(p.value)}</span>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="value" fill="hsl(0, 65%, 50%)" radius={[0, 6, 6, 0]} className="hover:opacity-85" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Produção por Tipo (INTERATIVO)
// ============================================
export function ProductionByTypeChart({ data }: { data: BIChartData["productionByType"] }) {
  const { onChartClick, filters } = useBIFilters();

  return (
    <ChartCard
      title="Produção por Tipo"
      type="competencia"
      icon={<Layers className="h-4 w-4" />}
      isEmpty={data.length === 0}
      interactive
      rightSlot={
        filters.productionType && filters.productionType !== "all" ? (
          <Badge variant="secondary" className="text-[10px] rounded-full">
            Filtrado
          </Badge>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { type } = e.activePayload[0].payload;
              onChartClick("productionType", type);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold">{formatCurrency(p.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Quantidade</span>
                      <span className="font-medium">{p.quantity ?? 0}</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar
            dataKey="value"
            fill="hsl(165, 60%, 35%)"
            name="Valor"
            radius={[6, 6, 0, 0]}
            className="hover:opacity-85"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// ✅ Top Médicos (INTERATIVO)
// ============================================
export function DoctorRankingChart({ data }: { data: BIChartData["productionByDoctor"] }) {
  const { onChartClick, filters } = useBIFilters();
  const { currentCompany } = useAuth();
  const { data: doctors = [] } = useDoctors(currentCompany?.id);

  const doctorName = React.useCallback(
    (id: string) => {
      if (!id || id === "SEM_MEDICO") return "Sem médico";
      const found = (doctors as any[]).find((d) => d?.id === id);
      return found?.name || "Médico";
    },
    [doctors],
  );

  const isEmpty = !data || data.length === 0;

  return (
    <ChartCard
      title="Top Médicos (Produção)"
      type="competencia"
      icon={<Users className="h-4 w-4" />}
      isEmpty={isEmpty}
      interactive
      rightSlot={
        filters.doctorId && filters.doctorId !== "all" ? (
          <Badge variant="secondary" className="text-[10px] rounded-full">
            Selecionado
          </Badge>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { doctorId } = e.activePayload[0].payload;
              onChartClick("doctor", doctorId);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="doctorId"
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => doctorName(String(v))}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{doctorName(String(label))}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Produção</span>
                      <span className="font-semibold">{formatCurrency(p.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Qtde</span>
                      <span className="font-medium">{p.quantity ?? 0}</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />

          <Bar dataKey="value" fill="hsl(210, 70%, 40%)" radius={[6, 6, 0, 0]} className="hover:opacity-90">
            {(data || []).map((row, idx) => {
              const selected = filters.doctorId && filters.doctorId !== "all" && row.doctorId === filters.doctorId;
              const dimOthers = filters.doctorId && filters.doctorId !== "all" && !selected;

              return <Cell key={`cell-doc-${idx}`} fill="hsl(210, 70%, 40%)" opacity={dimOthers ? 0.35 : 1} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Faturado por Unidade (INTERATIVO)
// ============================================
export function BilledByUnitChart({ data }: { data: BIChartData["billedByUnit"] }) {
  const { onChartClick, filters } = useBIFilters();

  return (
    <ChartCard
      title="Faturado por Unidade"
      type="competencia"
      icon={<Building2 className="h-4 w-4" />}
      isEmpty={data.length === 0}
      interactive
      rightSlot={
        filters.unit && filters.unit !== "all" ? (
          <Badge variant="secondary" className="text-[10px] rounded-full">
            Filtrado
          </Badge>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              onChartClick("unit", e.activePayload[0].payload.unit);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="unit" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Faturado</span>
                    <span className="font-semibold">{formatCurrency(p.value)}</span>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="value" fill="hsl(210, 70%, 40%)" radius={[6, 6, 0, 0]} className="hover:opacity-90" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Aging (INTERATIVO)
// ============================================
export function AgingChart({ data }: { data: BIChartData["aging"] }) {
  const { onChartClick, openDrilldown } = useBIFilters();

  const agingColors = ["hsl(152, 60%, 38%)", "hsl(38, 80%, 50%)", "hsl(25, 90%, 50%)", "hsl(0, 65%, 50%)"];

  const handleClick = (range: string) => {
    onChartClick("aging", range);
    openDrilldown({
      type: "aging",
      title: `Aging: ${range}`,
      value: range,
      filters: {
        agingRange:
          range === "0-30 dias" ? "0-30" : range === "31-60 dias" ? "31-60" : range === "61-90 dias" ? "61-90" : "90+",
      },
    });
  };

  return (
    <ChartCard
      title="Aging - Recebíveis por Faixa"
      type="competencia"
      icon={<Hourglass className="h-4 w-4" />}
      isEmpty={data.every((d) => d.value === 0)}
      interactive
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { range } = e.activePayload[0].payload;
              handleClick(range);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{p.range}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold">{formatCurrency(p.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Títulos</span>
                      <span className="font-medium">{p.count ?? 0}</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} className="hover:opacity-90">
            {data.map((_, index) => (
              <Cell key={`cell-aging-${index}`} fill={agingColors[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Glosa por Pagador
// ============================================
export function GlossByPayerChart({ data }: { data: BIChartData["glossByPayer"] }) {
  return (
    <ChartCard
      title="Glosa por Pagador"
      type="competencia"
      icon={<AlertTriangle className="h-4 w-4" />}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="payer" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TooltipBox>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Glosa</span>
                      <span className="font-semibold">{formatCurrency(p.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">%</span>
                      <span className="font-medium">{(p.percentage || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="value" fill="hsl(0, 65%, 50%)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
