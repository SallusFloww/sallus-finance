import React, { useMemo, useCallback, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { differenceInCalendarDays, subDays } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { BIFilterProvider, useBIFilters } from "@/contexts/BIFilterContext";
import { BIGlobalFilters } from "@/components/bi/BIGlobalFilters";
import { BIActiveFiltersBar } from "@/components/bi/BIActiveFiltersBar";
import { BIAlertsCard } from "@/components/bi/BIAlertsCard";
import { BIInsightsCard } from "@/components/bi/BIInsightsCard";
import { BIDrilldownDrawer } from "@/components/bi/BIDrilldownDrawer";
import { BIFooter } from "@/components/bi/BIFooter";

import {
  CashEvolutionChart,
  ConversionFunnelChart,
  ReceivedByPayerChart,
  TopExpenseCategoriesChart,
  AgingChart,
} from "@/components/bi/BICharts";

import { useBIData } from "@/hooks/useBIData";
import { useApp } from "@/contexts/AppContext";
import { canCalculateScore } from "@/contracts/bi-rules";

import {
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  ArrowUpDown,
  Layers,
} from "lucide-react";

type BIAllowedPeriod = "current" | "3m" | "6m" | "12m";

type BIFilters = {
  startDate: Date;
  endDate: Date;
  unit: string;
  payerType: "all";
  period?: BIAllowedPeriod;
};

function pctDelta(curr: number, prev: number) {
  if (!isFinite(curr) || !isFinite(prev)) return 0;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function KpiDelta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", up ? "text-emerald-600" : "text-red-600")}>
      {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      <span>{Math.abs(value).toFixed(1)}%</span>
      <span className="text-muted-foreground font-normal">vs período anterior</span>
    </div>
  );
}

/**
 * ✅ KPI CARD - POWER BI PREMIUM
 * - Fundo branco/glass
 * - Borda lateral verde (marca)
 * - Clicável (hover + active + teclado)
 */
function KpiCard(props: {
  title: string;
  value: string;
  delta: number;
  icon: React.ReactNode;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const { title, value, delta, icon, hint, active = false, onClick } = props;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "bg-white/95 backdrop-blur border-white/40 transition-all duration-200",
        "cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-lg",
        "border-l-4 border-l-emerald-600/80",
        active && "ring-2 ring-emerald-400/60 shadow-xl",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-muted-foreground">{title}</CardTitle>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        <div className="text-lg font-semibold tracking-tight">{value}</div>
        <KpiDelta value={delta} />
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function mapPeriodPresetToAllowed(preset: string): BIAllowedPeriod | undefined {
  const normalized = (preset || "").toLowerCase();

  if (normalized === "custom") return undefined;

  if (normalized === "current" || normalized === "mes_atual" || normalized === "month" || normalized === "mês atual") {
    return "current";
  }

  if (normalized === "3m") return "3m";
  if (normalized === "6m") return "6m";
  if (normalized === "12m") return "12m";

  return undefined;
}

function BIV2Content() {
  const { filters, drilldownContext, lastUpdated } = useBIFilters();
  const { transactions: txContext } = useApp();
  const { settings } = txContext;

  const periodAllowed = useMemo(() => mapPeriodPresetToAllowed(filters.periodPreset), [filters.periodPreset]);

  const currentFilters: BIFilters = useMemo(
    () => ({
      startDate: filters.startDate,
      endDate: filters.endDate,
      unit: filters.unit,
      payerType: "all",
      period: periodAllowed,
    }),
    [filters, periodAllowed],
  );

  const { kpis, chartData, recentTransactions } = useBIData(currentFilters);

  // Período anterior para delta (sempre por data)
  const prevFilters: BIFilters = useMemo(() => {
    const days = differenceInCalendarDays(filters.endDate, filters.startDate) + 1;
    const prevEnd = subDays(filters.startDate, 1);
    const prevStart = subDays(prevEnd, Math.max(days - 1, 0));

    return {
      startDate: prevStart,
      endDate: prevEnd,
      unit: filters.unit,
      payerType: "all",
      period: undefined,
    };
  }, [filters]);

  const prev = useBIData(prevFilters);

  const uniquePayers = useMemo(() => {
    const payers = new Set<string>();
    chartData.receivedByPayer.forEach((p: any) => payers.add(p.payer));
    return Array.from(payers);
  }, [chartData.receivedByPayer]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    chartData.topExpenseCategories.forEach((c: any) => cats.add(c.category));
    return Array.from(cats);
  }, [chartData.topExpenseCategories]);

  const agingCritical = useMemo(() => {
    return chartData.aging
      .filter((a: any) => a.range === "61-90 dias" || a.range === "90+ dias")
      .reduce((sum: number, a: any) => sum + a.value, 0);
  }, [chartData.aging]);

  // Regras de score
  const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
  const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
  const hasCashData = kpis.entradas > 0 || kpis.saidas > 0;

  const isScoreInFormation = !canCalculateScore(hasProductionData, hasBillingData, hasCashData, 0);

  const drilldownData = useMemo(() => {
    if (!drilldownContext) return [];
    return recentTransactions.slice(0, 30).map((t: any) => ({
      id: t.id,
      description: t.description,
      value: t.amount,
      date: t.date,
      unit: t.unit,
    }));
  }, [drilldownContext, recentTransactions]);

  const fmtBRL = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // KPIs
  const deltaRecebido = pctDelta(kpis.recebido ?? 0, prev.kpis?.recebido ?? 0);
  const deltaProduzido = pctDelta(kpis.produzido ?? 0, prev.kpis?.produzido ?? 0);
  const deltaFaturado = pctDelta(kpis.faturado ?? 0, prev.kpis?.faturado ?? 0);
  const deltaEntradas = pctDelta(kpis.entradas ?? 0, prev.kpis?.entradas ?? 0);
  const deltaSaidas = pctDelta(kpis.saidas ?? 0, prev.kpis?.saidas ?? 0);

  const resultadoAtual = (kpis.entradas ?? 0) - (kpis.saidas ?? 0);
  const resultadoPrev = (prev.kpis?.entradas ?? 0) - (prev.kpis?.saidas ?? 0);
  const deltaResultado = pctDelta(resultadoAtual, resultadoPrev);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "—";
    if (typeof lastUpdated === "string") return lastUpdated;
    try {
      return format(lastUpdated, "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "—";
    }
  }, [lastUpdated]);

  // ✅ KPI Click (UI pronto; plugar filtro real depois)
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  const onKpiClick = useCallback((key: string) => {
    setActiveKpi((prevKey) => (prevKey === key ? null : key));

    // ✅ Se você tiver no contexto algo tipo setDrilldownContext/applyQuickFilter,
    // é aqui que conecta para cross-filter real.
  }, []);

  return (
    <DashboardLayout>
      {/* ✅ FUNDO PREMIUM - BI EXECUTIVO */}
      <div className="relative min-h-screen">
        {/* base gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10
          bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800/70"
        />

        {/* glow suave no topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[60rem]
          -translate-x-1/2 -z-10 blur-3xl opacity-35
          bg-gradient-to-r from-emerald-500/25 via-emerald-300/15 to-emerald-400/25"
        />

        {/* vinheta leve */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10
          bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.10)_60%,rgba(0,0,0,0.20)_100%)]"
        />

        <div className="space-y-4 animate-fade-in p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-white/80" />
                <h1 className="text-2xl font-bold text-white">BI v2 — Executivo</h1>
                <Badge variant="secondary" className="text-[10px]">
                  BETA
                </Badge>
              </div>
              <p className="text-sm text-white/70">
                Power BI-like: hierarquia, leitura e comparação • Cross-filter • Read-only
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Somente leitura
              </Badge>
              <Badge
                variant="outline"
                className="text-xs flex items-center gap-2 bg-white/5 text-white border-white/15"
              >
                <Calendar className="h-3.5 w-3.5" />
                {format(filters.startDate, "dd/MM", { locale: ptBR })} -{" "}
                {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
              </Badge>
            </div>
          </div>

          {/* Filtros */}
          <Card className="bg-white/95 backdrop-blur border-white/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Filtros
                <span className="text-xs text-muted-foreground font-normal">
                  • Última atualização: {lastUpdatedLabel}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BIGlobalFilters settings={settings} uniquePayers={uniquePayers} uniqueCategories={uniqueCategories} />
              <Separator />
              <BIActiveFiltersBar />
            </CardContent>
          </Card>

          {/* Alerts compactos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card className="bg-white/95 backdrop-blur border-white/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Leitura rápida do período
                    {isScoreInFormation && (
                      <Badge variant="outline" className="text-[10px] ml-2">
                        Score em formação
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Taxa de recebimento</div>
                    <div className="text-lg font-semibold">
                      {isNaN(kpis.taxaRecebimento) ? "0%" : `${kpis.taxaRecebimento.toFixed(0)}%`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Recebido ÷ Faturado</div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Taxa de faturamento</div>
                    <div className="text-lg font-semibold">
                      {isNaN(kpis.taxaFaturamento) ? "0%" : `${kpis.taxaFaturamento.toFixed(0)}%`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Faturado ÷ Produzido</div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Em aberto</div>
                    <div className="text-lg font-semibold">{fmtBRL(kpis.emAberto ?? 0)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(kpis.faturado || 1) > 0
                        ? `${((kpis.emAberto / (kpis.faturado || 1)) * 100).toFixed(0)}% do faturado`
                        : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white/95 backdrop-blur rounded-xl border border-white/30">
              <BIAlertsCard kpis={kpis} agingData={chartData.aging} payerData={chartData.receivedByPayer} />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              title="Receita (Recebido)"
              value={fmtBRL(kpis.recebido ?? 0)}
              delta={deltaRecebido}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "recebido"}
              onClick={() => onKpiClick("recebido")}
            />
            <KpiCard
              title="Produção"
              value={fmtBRL(kpis.produzido ?? 0)}
              delta={deltaProduzido}
              icon={<BarChart3 className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "producao"}
              onClick={() => onKpiClick("producao")}
            />
            <KpiCard
              title="Faturado"
              value={fmtBRL(kpis.faturado ?? 0)}
              delta={deltaFaturado}
              icon={<Receipt className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "faturado"}
              onClick={() => onKpiClick("faturado")}
            />
            <KpiCard
              title="Entradas (Caixa)"
              value={fmtBRL(kpis.entradas ?? 0)}
              delta={deltaEntradas}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "entradas"}
              onClick={() => onKpiClick("entradas")}
            />
            <KpiCard
              title="Saídas (Caixa)"
              value={fmtBRL(kpis.saidas ?? 0)}
              delta={deltaSaidas}
              icon={<ArrowUpDown className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "saidas"}
              onClick={() => onKpiClick("saidas")}
            />
            <KpiCard
              title="Resultado"
              value={fmtBRL(resultadoAtual)}
              delta={deltaResultado}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar"
              active={activeKpi === "resultado"}
              onClick={() => onKpiClick("resultado")}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-white/95 backdrop-blur border-white/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Evolução do Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <CashEvolutionChart data={chartData.cashEvolution} />
              </CardContent>
            </Card>

            <Card className="bg-white/95 backdrop-blur border-white/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Funil: Produção → Faturado → Recebido</CardTitle>
              </CardHeader>
              <CardContent>
                <ConversionFunnelChart data={chartData.funnel} />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-white/95 backdrop-blur border-white/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Pagadores / Convênios</CardTitle>
              </CardHeader>
              <CardContent>
                <ReceivedByPayerChart data={chartData.receivedByPayer} />
              </CardContent>
            </Card>

            <Card className="bg-white/95 backdrop-blur border-white/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Categorias de Saída</CardTitle>
              </CardHeader>
              <CardContent>
                <TopExpenseCategoriesChart data={chartData.topExpenseCategories} />
              </CardContent>
            </Card>

            <Card className="bg-white/95 backdrop-blur border-white/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Aging — Recebíveis por Faixa</CardTitle>
              </CardHeader>
              <CardContent>
                <AgingChart data={chartData.aging} />
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white/95 backdrop-blur rounded-xl border border-white/30">
              <BIInsightsCard kpis={kpis} agingCritical={agingCritical} />
            </div>
          </div>

          {/* Footer + Drilldown */}
          <div className="bg-white/95 backdrop-blur rounded-xl border border-white/30">
            <BIFooter lastUpdated={lastUpdated ?? null} />
          </div>

          <BIDrilldownDrawer data={drilldownData} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function BIV2() {
  return (
    <BIFilterProvider>
      <BIV2Content />
    </BIFilterProvider>
  );
}
