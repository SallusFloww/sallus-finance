import { useMemo } from "react";
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
  Wallet,
  TrendingUp,
  Receipt,
  ArrowUpDown,
  Layers,
} from "lucide-react";

/**
 * BI v2 — PowerBI-like
 * - Visual limpo e hierarquia clara
 * - KPIs com delta vs período anterior
 * - Mantém useBIData / charts / drilldown existentes (sem quebrar nada)
 */

type BiFiltersPayload = {
  startDate: Date;
  endDate: Date;
  unit: string;
  payerType: "all";
  period?: string;
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

function KpiCard(props: { title: string; value: string; delta: number; icon: React.ReactNode; hint?: string }) {
  const { title, value, delta, icon, hint } = props;
  return (
    <Card className="hover:shadow-sm transition">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-muted-foreground">{title}</CardTitle>
          {icon}
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

function BIV2Content() {
  const { filters, drilldownContext, lastUpdated } = useBIFilters();
  const { transactions: txContext } = useApp();
  const { settings } = txContext;

  // -----------------------------
  // Filtros atuais (padrão já usado no BI v1)
  // -----------------------------
  const currentFilters: BiFiltersPayload = useMemo(
    () => ({
      startDate: filters.startDate,
      endDate: filters.endDate,
      unit: filters.unit,
      payerType: "all" as const,
      period: filters.periodPreset === "custom" ? undefined : filters.periodPreset,
    }),
    [filters],
  );

  const { kpis, chartData, recentTransactions } = useBIData(currentFilters);

  // -----------------------------
  // Período anterior (para delta PowerBI-like)
  // -----------------------------
  const prevFilters: BiFiltersPayload = useMemo(() => {
    const days = differenceInCalendarDays(filters.endDate, filters.startDate) + 1;
    const prevEnd = subDays(filters.startDate, 1);
    const prevStart = subDays(prevEnd, Math.max(days - 1, 0));

    return {
      startDate: prevStart,
      endDate: prevEnd,
      unit: filters.unit,
      payerType: "all" as const,
      period: undefined, // força por data para delta fiel
    };
  }, [filters]);

  const prev = useBIData(prevFilters);

  // -----------------------------
  // Dropdowns (puxados do chartData atual)
  // -----------------------------
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

  // Aging crítico
  const agingCritical = useMemo(() => {
    return chartData.aging
      .filter((a: any) => a.range === "61-90 dias" || a.range === "90+ dias")
      .reduce((sum: number, a: any) => sum + a.value, 0);
  }, [chartData.aging]);

  // Score em formação (mesma regra do v1)
  const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
  const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
  const hasCashData = kpis.entradas > 0 || kpis.saidas > 0;

  const isScoreInFormation = !canCalculateScore(
    hasProductionData,
    hasBillingData,
    hasCashData,
    // se seu useBIData não traz score, a regra usa o globalScore; aqui mantemos compatível:
    // como não temos useWeightedScore no v2, passamos 0 e a regra já trata "em formação"
    0,
  );

  // Drilldown data (reaproveita padrão)
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

  // -----------------------------
  // KPIs (6 cards no máximo, PowerBI-like)
  // -----------------------------
  const deltaSaldo = pctDelta(kpis.saldo ?? 0, prev.kpis?.saldo ?? 0);
  const deltaRecebido = pctDelta(kpis.recebido ?? 0, prev.kpis?.recebido ?? 0);
  const deltaProduzido = pctDelta(kpis.produzido ?? 0, prev.kpis?.produzido ?? 0);
  const deltaFaturado = pctDelta(kpis.faturado ?? 0, prev.kpis?.faturado ?? 0);
  const deltaSaidas = pctDelta(kpis.saidas ?? 0, prev.kpis?.saidas ?? 0);
  const deltaResultado = pctDelta(
    (kpis.entradas ?? 0) - (kpis.saidas ?? 0),
    (prev.kpis?.entradas ?? 0) - (prev.kpis?.saidas ?? 0),
  );

  const fmtBRL = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground">BI v2 — Executivo</h1>
              <Badge variant="secondary" className="text-[10px]">
                BETA
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Power BI-like de verdade: menos ruído, mais leitura • Cross-filter • Read-only
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Somente leitura
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {format(filters.startDate, "dd/MM", { locale: ptBR })} -{" "}
              {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* Filtros globais (mesmo componente do v1) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Filtros
              <span className="text-xs text-muted-foreground font-normal">
                • Última atualização: {lastUpdated || "—"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BIGlobalFilters settings={settings} uniquePayers={uniquePayers} uniqueCategories={uniqueCategories} />
            <Separator />
            <BIActiveFiltersBar />
          </CardContent>
        </Card>

        {/* Alerts compactos (mantém o que já existe) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
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

          <BIAlertsCard kpis={kpis} agingData={chartData.aging} payerData={chartData.receivedByPayer} />
        </div>

        {/* KPIs PowerBI-like (6 cards) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Saldo (Caixa)"
            value={fmtBRL(kpis.saldo ?? 0)}
            delta={deltaSaldo}
            icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            hint="Base Caixa"
          />
          <KpiCard
            title="Receita (Recebido)"
            value={fmtBRL(kpis.recebido ?? 0)}
            delta={deltaRecebido}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            hint="Recebimentos"
          />
          <KpiCard
            title="Produção"
            value={fmtBRL(kpis.produzido ?? 0)}
            delta={deltaProduzido}
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            hint="Competência"
          />
          <KpiCard
            title="Faturado"
            value={fmtBRL(kpis.faturado ?? 0)}
            delta={deltaFaturado}
            icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
            hint="Competência"
          />
          <KpiCard
            title="Saídas (Pagas)"
            value={fmtBRL(kpis.saidas ?? 0)}
            delta={deltaSaidas}
            icon={<ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            hint="Pagamentos"
          />
          <KpiCard
            title="Resultado"
            value={fmtBRL((kpis.entradas ?? 0) - (kpis.saidas ?? 0))}
            delta={deltaResultado}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            hint="Entradas - Saídas"
          />
        </div>

        {/* Gráficos: macro (linha 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Evolução do Caixa</CardTitle>
            </CardHeader>
            <CardContent>
              <CashEvolutionChart data={chartData.cashEvolution} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Funil: Produção → Faturado → Recebido</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversionFunnelChart data={chartData.funnel} />
            </CardContent>
          </Card>
        </div>

        {/* Gráficos: drivers (linha 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Pagadores / Convênios</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceivedByPayerChart data={chartData.receivedByPayer} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Categorias de Saída</CardTitle>
            </CardHeader>
            <CardContent>
              <TopExpenseCategoriesChart data={chartData.topExpenseCategories} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Aging — Recebíveis por Faixa</CardTitle>
            </CardHeader>
            <CardContent>
              <AgingChart data={chartData.aging} />
            </CardContent>
          </Card>
        </div>

        {/* Insights (mantém) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BIInsightsCard kpis={kpis} agingCritical={agingCritical} />
        </div>

        {/* Footer + Drilldown */}
        <BIFooter lastUpdated={lastUpdated} />
        <BIDrilldownDrawer data={drilldownData} />
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
