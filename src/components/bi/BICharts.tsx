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

interface ChartCardProps {
  title: string;
  type: "caixa" | "competencia";
  children: React.ReactNode;
  isEmpty?: boolean;
  interactive?: boolean;
}

function ChartCard({ title, type, children, isEmpty, interactive }: ChartCardProps) {
  return (
    <Card className={cn("shadow-sm transition-all", interactive && "hover:shadow-md hover:border-primary/30")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {interactive && !isEmpty && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-primary/5 border-primary/20 text-primary">
                Clique para filtrar
              </Badge>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] h-5 px-1.5 ${
              type === "caixa" ? "border-primary/30 text-primary" : "border-secondary/30 text-secondary"
            }`}
          >
            {type === "caixa" ? "Caixa" : "Competência"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">Dados insuficientes para visualização</p>
            <p className="text-xs mt-1 text-center max-w-[200px]">
              Ajuste os filtros ou aguarde consolidação do período
            </p>
          </div>
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
    <ChartCard title="Evolução do Saldo" type="caixa" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line type="monotone" dataKey="saldo" stroke="hsl(210, 70%, 40%)" strokeWidth={2} dot={false} name="Saldo" />
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
    <ChartCard title="Entradas vs Saídas" type="caixa" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="entradas" fill="hsl(152, 60%, 38%)" name="Entradas" radius={[4, 4, 0, 0]} />
          <Bar dataKey="saidas" fill="hsl(0, 65%, 50%)" name="Saídas" radius={[4, 4, 0, 0]} />
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

  const handleClick = (stage: string, value: number) => {
    onChartClick("funnel", stage);
    openDrilldown({
      type: "funnel",
      title: `Detalhes: ${stage}`,
      value: stage,
      filters: { origin: stage === "Produzido" ? "producao" : stage === "Faturado" ? "faturamento" : "recebimento" },
    });
  };

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartCard
      title="Funil: Produção → Recebido"
      type="competencia"
      isEmpty={data.every((d) => d.value === 0)}
      interactive
    >
      <div className="space-y-3 py-2">
        {data.map((item, index) => {
          const width = (item.value / maxValue) * 100;
          const colors = ["hsl(210, 70%, 40%)", "hsl(165, 60%, 35%)", "hsl(38, 80%, 50%)", "hsl(0, 65%, 50%)"];
          return (
            <div key={item.stage} className="group cursor-pointer" onClick={() => handleClick(item.stage, item.value)}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium group-hover:text-primary transition-colors">{item.stage}</span>
                <span className="text-muted-foreground">{formatCurrency(item.value)}</span>
              </div>
              <div className="h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all group-hover:opacity-80"
                  style={{ width: `${width}%`, backgroundColor: colors[index] }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground/70">
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
// Recebido por Pagador (Pizza/Donut INTERATIVO)
// ============================================
export function ReceivedByPayerChart({ data }: { data: BIChartData["receivedByPayer"] }) {
  const { onChartClick, openDrilldown } = useBIFilters();

  const handleClick = (payer: string, value: number) => {
    onChartClick("payer", payer);
    openDrilldown({
      type: "payer",
      title: `Recebimentos: ${payer}`,
      value: payer,
      filters: { payer },
    });
  };

  return (
    <ChartCard title="Recebido por Pagador" type="caixa" isEmpty={data.length === 0} interactive>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            nameKey="payer"
            onClick={(entry) => handleClick(entry.payer, entry.value)}
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
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: "10px" }} />
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

  const handleClick = (category: string, value: number) => {
    onChartClick("category", category);
    openDrilldown({
      type: "category",
      title: `Despesas: ${category}`,
      value: category,
      filters: { category },
    });
  };

  return (
    <ChartCard title="Top 10 Categorias de Saída" type="caixa" isEmpty={data.length === 0} interactive>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data.slice(0, 7)}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { category, value } = e.activePayload[0].payload;
              handleClick(category, value);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 9 }}
            stroke="hsl(var(--muted-foreground))"
            width={55}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="hsl(0, 65%, 50%)" radius={[0, 4, 4, 0]} className="hover:opacity-80" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// Produção por Tipo (INTERATIVO - Power BI)
// ============================================
export function ProductionByTypeChart({ data }: { data: BIChartData["productionByType"] }) {
  const { onChartClick } = useBIFilters();

  return (
    <ChartCard title="Produção por Tipo" type="competencia" isEmpty={data.length === 0} interactive>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { type } = e.activePayload[0].payload;
              onChartClick("productionType", type);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="type" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === "value" ? formatCurrency(value) : value,
              name === "value" ? "Valor" : "Quantidade",
            ]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar
            dataKey="value"
            fill="hsl(165, 60%, 35%)"
            name="Valor"
            radius={[4, 4, 0, 0]}
            className="hover:opacity-80"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================
// ✅ Top Médicos (INTERATIVO - Power BI Click-to-Filter)
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
    <ChartCard title="Top Médicos (Produção)" type="competencia" isEmpty={isEmpty} interactive>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
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
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => doctorName(String(label))}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="hsl(210, 70%, 40%)" radius={[4, 4, 0, 0]} className="hover:opacity-80">
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
  const { onChartClick } = useBIFilters();

  return (
    <ChartCard title="Faturado por Unidade" type="competencia" isEmpty={data.length === 0} interactive>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
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
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="hsl(210, 70%, 40%)" radius={[4, 4, 0, 0]} className="hover:opacity-80" />
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

  const agingColors = [
    "hsl(152, 60%, 38%)", // 0-30 - verde
    "hsl(38, 80%, 50%)", // 31-60 - amarelo
    "hsl(25, 90%, 50%)", // 61-90 - laranja
    "hsl(0, 65%, 50%)", // 90+ - vermelho
  ];

  const handleClick = (range: string, value: number) => {
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
      isEmpty={data.every((d) => d.value === 0)}
      interactive
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const { range, value } = e.activePayload[0].payload;
              handleClick(range, value);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => [
              formatCurrency(value),
              `${props.payload.count} títulos`,
            ]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} className="hover:opacity-80">
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={agingColors[index]} />
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
    <ChartCard title="Glosa por Pagador" type="competencia" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="payer" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => [
              formatCurrency(value),
              `${props.payload.percentage.toFixed(1)}% do total`,
            ]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="hsl(0, 65%, 50%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
