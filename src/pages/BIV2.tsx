import React, { useMemo, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { differenceInCalendarDays, subDays } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
  IncomeVsExpenseChart,
  ConversionFunnelChart,
  ReceivedByPayerChart,
  TopExpenseCategoriesChart,
  ProductionByTypeChart,
  DoctorRankingChart,
  BilledByUnitChart,
  AgingChart,
  GlossByPayerChart,
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
  Sparkles,
  Stethoscope,
  Wand2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

type BIAllowedPeriod = "current" | "3m" | "6m" | "12m";

type BIFilters = {
  startDate: Date;
  endDate: Date;
  unit?: string;
  payerType: "all";
  period?: BIAllowedPeriod;

  // ✅ Power BI Mode
  payer?: string;
  category?: string;
  doctorId?: string;
  productionType?: string;
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
 * ✅ KPI CARD - POWER BI PREMIUM (CLEAN)
 * - Cards brancos como Power BI
 * - Hover com ring
 * - Active com ring forte
 * - Clicável (teclado incluso)
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
        "cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-emerald-400/40",
        "border-l-4 border-l-emerald-600/80",
        active && "ring-2 ring-emerald-400/80 shadow-xl bg-white",
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

function MiniStat(props: { label: string; value: string; icon?: React.ReactNode }) {
  const { label, value, icon } = props;
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function BIV2Content() {
  const { filters, drilldownContext, lastUpdated, setFilters, clearFilter, clearAllFilters } = useBIFilters();

  const { transactions: txContext } = useApp();
  const { settings } = txContext;

  const [directorMode, setDirectorMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sallus_bi_director_mode");
      return stored ? stored === "1" : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sallus_bi_director_mode", directorMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [directorMode]);

  const periodAllowed = useMemo(() => mapPeriodPresetToAllowed(filters.periodPreset), [filters.periodPreset]);

  // ✅ mantém compatibilidade com seu hook de dados (useBIData v1/v2)
  const currentFilters: BIFilters = useMemo(
    () => ({
      startDate: filters.startDate,
      endDate: filters.endDate,
      unit: filters.unit,
      payerType: "all",
      period: periodAllowed,

      // ✅ Power BI Mode (Cross-filter real)
      payer: filters.payer,
      category: filters.category,
      doctorId: filters.doctorId,
      productionType: filters.productionType,
    }),
    [
      filters.startDate,
      filters.endDate,
      filters.unit,
      filters.payer,
      filters.category,
      filters.doctorId,
      filters.productionType,
      periodAllowed,
    ],
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

      // 🔥 comparação respeita seleção atual do usuário (Power BI feeling)
      payer: filters.payer,
      category: filters.category,
      doctorId: filters.doctorId,
      productionType: filters.productionType,
    };
  }, [filters.startDate, filters.endDate, filters.unit, filters.payer, filters.category, filters.doctorId, filters.productionType]);

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

  // ✅ KPIs
  const deltaRecebido = pctDelta(kpis.recebido ?? 0, prev.kpis?.recebido ?? 0);
  const deltaProduzido = pctDelta(kpis.produzido ?? 0, prev.kpis?.produzido ?? 0);
  const deltaFaturado = pctDelta(kpis.faturado ?? 0, prev.kpis?.faturado ?? 0);
  const deltaEntradas = pctDelta(kpis.entradas ?? 0, prev.kpis?.entradas ?? 0);
  const deltaSaidas = pctDelta(kpis.saidas ?? 0, prev.kpis?.saidas ?? 0);

  const resultadoAtual = (kpis.entradas ?? 0) - (kpis.saidas ?? 0);
  const resultadoPrev = (prev.kpis?.entradas ?? 0) - (prev.kpis?.saidas ?? 0);
  const deltaResultado = pctDelta(resultadoAtual, resultadoPrev);

  // ✅ KPIs extra (surreal)
  const examesValue = useMemo(() => {
    const row = chartData.productionByType.find((x: any) => String(x.type).toUpperCase() === "EXAME");
    return row?.value ?? 0;
  }, [chartData.productionByType]);

  const examesQty = useMemo(() => {
    const row = chartData.productionByType.find((x: any) => String(x.type).toUpperCase() === "EXAME");
    return row?.quantity ?? 0;
  }, [chartData.productionByType]);

  const totalQty = useMemo(() => {
    return chartData.productionByType.reduce((sum: number, x: any) => sum + (x.quantity || 0), 0);
  }, [chartData.productionByType]);

  const ticketMedio = useMemo(() => {
    const q = totalQty || 0;
    if (!q) return 0;
    return (kpis.produzido || 0) / q;
  }, [kpis.produzido, totalQty]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "—";
    if (typeof lastUpdated === "string") return lastUpdated;
    try {
      return format(lastUpdated, "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "—";
    }
  }, [lastUpdated]);

  // ============================================================
  // ✅ KPI CLICK = CROSS-FILTER REAL (TOGGLE)
  // ============================================================

  const isKpiActive = useCallback(
    (key: "recebido" | "producao" | "faturado" | "entradas" | "saidas" | "resultado") => {
      // KPIs de competência
      if (key === "producao") return filters.viewType === "competencia" && filters.origin === "producao";
      if (key === "faturado") return filters.viewType === "competencia" && filters.origin === "faturamento";
      if (key === "recebido") return filters.viewType === "competencia" && filters.origin === "recebimento";

      // KPIs de caixa
      if (key === "entradas") return filters.viewType === "caixa" && filters.origin === "caixa";
      if (key === "saidas") return filters.viewType === "caixa" && filters.origin === "caixa";
      if (key === "resultado") return filters.viewType === "caixa" && filters.origin === "caixa";

      return false;
    },
    [filters.viewType, filters.origin],
  );

  const toggleKpiFilter = useCallback(
    (key: "recebido" | "producao" | "faturado" | "entradas" | "saidas" | "resultado") => {
      const alreadyActive = isKpiActive(key);

      if (alreadyActive) {
        // ✅ limpa o que o KPI mexeu (mantém o resto dos filtros do usuário)
        clearFilter("origin");
        clearFilter("viewType");
        return;
      }

      // ✅ aplica filtros “Power BI like”
      if (key === "producao") {
        setFilters({ viewType: "competencia", origin: "producao" });
        return;
      }

      if (key === "faturado") {
        setFilters({ viewType: "competencia", origin: "faturamento" });
        return;
      }

      if (key === "recebido") {
        setFilters({ viewType: "competencia", origin: "recebimento" });
        return;
      }

      // Caixa (entradas/saídas/resultado): mesma visão
      if (key === "entradas" || key === "saidas" || key === "resultado") {
        setFilters({ viewType: "caixa", origin: "caixa" });
        return;
      }
    },
    [clearFilter, isKpiActive, setFilters],
  );

  // ✅ barra de "seleção" estilo Power BI
  const selectionTitle = useMemo(() => {
    const parts: string[] = [];
    if (filters.doctorId && filters.doctorId !== "all") parts.push("Médico selecionado");
    if (filters.productionType && filters.productionType !== "all") parts.push(`Tipo: ${filters.productionType}`);
    if (filters.payer && filters.payer !== "all") parts.push(`Pagador: ${filters.payer}`);
    if (filters.category && filters.category !== "all") parts.push(`Categoria: ${filters.category}`);
    if (filters.unit && filters.unit !== "all") parts.push(`Unidade: ${filters.unit}`);
    return parts.length ? parts.join(" • ") : "Sem seleção (modo livre)";
  }, [filters]);

  // Atalho: ESC = limpar seleções rápidas (não zera data!)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // limpa as seleções “visuais” (Power BI feelings)
        clearFilter("doctorId");
        clearFilter("productionType");
        clearFilter("payer");
        clearFilter("category");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearFilter]);

  return (
    <DashboardLayout>
      {/* ✅ FUNDO PREMIUM DO BI (POWER BI CANVAS) */
      <div className="relative min-h-screen bg-background">
        {/* Canvas Power BI (claro, premium, com textura leve) */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
        <div className="absolute inset-0 z-0 opacity-[0.35] [background-image:radial-gradient(rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.12)_0%,transparent_45%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.10)_0%,transparent_40%)]" />

        {/* ✅ CONTEÚDO */}
        <div className="relative z-10 space-y-4 animate-fade-in p-4 md:p-6">
          {/* ✅ Header com faixa premium */}
          <div className="rounded-2xl bg-white border border-border/60 shadow-sm p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-foreground/80" />
                  <h1 className="text-2xl font-bold text-foreground">Sallus Finance — BI Executivo</h1>

                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-3 w-3" />
                    POWER BI MODE
                  </Badge>

                  {directorMode && (
                    <Badge variant="outline" className="text-[10px] bg-muted/30 text-foreground border-border/60">
                      Modo Diretor
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-foreground/70">
                  Clique para filtrar • Cross-filter real • Drilldown • Interface premium
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-muted/30 text-foreground border-border/60 flex items-center gap-2"
                    title="Seleção atual (Power BI)"
                  >
                    <Wand2 className="h-3 w-3" />
                    {selectionTitle}
                    <span className="text-foreground/50">• ESC limpa seleções</span>
                  </Badge>

                  {(filters.doctorId !== "all" || filters.productionType !== "all") && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Stethoscope className="h-3 w-3" />
                      Filtro Médico/Tipo ativo
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs flex items-center gap-2 bg-white/5 text-foreground border-border/60"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {format(filters.startDate, "dd/MM", { locale: ptBR })} -{" "}
                  {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
                </Badge>

                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setDirectorMode((s) => !s)}
                  title="Alternar Modo Diretor"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                  {directorMode ? "Modo Analista" : "Modo Diretor"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-white/5 text-foreground border-border/60 hover:bg-muted/30 hover:text-foreground"
                  onClick={() => {
                    clearFilter("doctorId");
                    clearFilter("productionType");
                    clearFilter("payer");
                    clearFilter("category");
                  }}
                  title="Limpar seleções rápidas (médico/tipo/pagador/categoria)"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Limpar seleção
                </Button>

                <button
                  onClick={clearAllFilters}
                  className="text-xs px-2 py-1 rounded-lg bg-muted/30 hover:bg-muted/40 border border-border/60 text-foreground/85 transition"
                  type="button"
                  title="Reset total (inclui datas)"
                >
                  Limpar tudo
                </button>
              </div>
            </div>
          </div>

          {/* Filtros */}
          {!directorMode && (
            <Card className="bg-white border-border/60 shadow-sm">
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
          )}

          {/* Alerts + leitura executiva */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card className="bg-white border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Leitura executiva do período
                    {isScoreInFormation && (
                      <Badge variant="outline" className="text-[10px] ml-2">
                        Score em formação
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <MiniStat
                    label="Taxa de recebimento"
                    value={isNaN(kpis.taxaRecebimento) ? "0%" : `${kpis.taxaRecebimento.toFixed(0)}%`}
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                  <MiniStat
                    label="Taxa de faturamento"
                    value={isNaN(kpis.taxaFaturamento) ? "0%" : `${kpis.taxaFaturamento.toFixed(0)}%`}
                    icon={<Receipt className="h-4 w-4" />}
                  />
                  <MiniStat
                    label="Em aberto"
                    value={fmtBRL(kpis.emAberto ?? 0)}
                    icon={<ArrowUpDown className="h-4 w-4" />}
                  />
                  <MiniStat
                    label="Aging crítico (61+)"
                    value={fmtBRL(agingCritical)}
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-2xl border border-border/60 shadow-sm">
              <BIAlertsCard kpis={kpis} agingData={chartData.aging} payerData={chartData.receivedByPayer} />
            </div>
          </div>

          {/* KPIs (com cross-filter real) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <KpiCard
              title="Receita (Recebido)"
              value={fmtBRL(kpis.recebido ?? 0)}
              delta={deltaRecebido}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar (Competência)"
              active={isKpiActive("recebido")}
              onClick={() => toggleKpiFilter("recebido")}
            />
            <KpiCard
              title="Produção"
              value={fmtBRL(kpis.produzido ?? 0)}
              delta={deltaProduzido}
              icon={<BarChart3 className="h-4 w-4" />}
              hint="Clique para filtrar (Competência)"
              active={isKpiActive("producao")}
              onClick={() => toggleKpiFilter("producao")}
            />
            <KpiCard
              title="Faturado"
              value={fmtBRL(kpis.faturado ?? 0)}
              delta={deltaFaturado}
              icon={<Receipt className="h-4 w-4" />}
              hint="Clique para filtrar (Competência)"
              active={isKpiActive("faturado")}
              onClick={() => toggleKpiFilter("faturado")}
            />
            <KpiCard
              title="Exames"
              value={`${fmtBRL(examesValue)} • ${examesQty}x`}
              delta={pctDelta(examesValue, 0)} // delta de exames não tem histórico direto aqui
              icon={<Sparkles className="h-4 w-4" />}
              hint="Clique no gráfico p/ filtrar"
              active={filters.productionType === "EXAME"}
              onClick={() => setFilters({ productionType: filters.productionType === "EXAME" ? "all" : "EXAME" })}
            />
            <KpiCard
              title="Ticket médio"
              value={fmtBRL(ticketMedio)}
              delta={pctDelta(ticketMedio, 0)}
              icon={<Wand2 className="h-4 w-4" />}
              hint="Produção ÷ quantidades"
              active={false}
              onClick={() => {}}
            />
            <KpiCard
              title="Entradas (Caixa)"
              value={fmtBRL(kpis.entradas ?? 0)}
              delta={deltaEntradas}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar (Caixa)"
              active={isKpiActive("entradas")}
              onClick={() => toggleKpiFilter("entradas")}
            />
            <KpiCard
              title="Saídas (Caixa)"
              value={fmtBRL(kpis.saidas ?? 0)}
              delta={deltaSaidas}
              icon={<ArrowUpDown className="h-4 w-4" />}
              hint="Clique para filtrar (Caixa)"
              active={isKpiActive("saidas")}
              onClick={() => toggleKpiFilter("saidas")}
            />
            <KpiCard
              title="Resultado"
              value={fmtBRL(resultadoAtual)}
              delta={deltaResultado}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Clique para filtrar (Caixa)"
              active={isKpiActive("resultado")}
              onClick={() => toggleKpiFilter("resultado")}
            />
          </div>

          {/* === POWER BI GRID 1 === */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <CashEvolutionChart data={chartData.cashEvolution} />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <ConversionFunnelChart data={chartData.funnel} />
            </div>
          </div>

          {/* === POWER BI GRID 2 (clicável) === */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <ReceivedByPayerChart data={chartData.receivedByPayer} />
            </div>
            <div className="lg:col-span-4">
              <TopExpenseCategoriesChart data={chartData.topExpenseCategories} />
            </div>
            <div className="lg:col-span-4">
              <AgingChart data={chartData.aging} />
            </div>
          </div>

          {/* === POWER BI GRID 3 (médicos + mix + unidades) === */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <DoctorRankingChart data={chartData.productionByDoctor} />
            </div>
            <div className="lg:col-span-4">
              <ProductionByTypeChart data={chartData.productionByType} />
            </div>
            <div className="lg:col-span-3">
              <BilledByUnitChart data={chartData.billedByUnit} />
            </div>
          </div>

          {/* === POWER BI GRID 4 (caixa + glosa) === */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <IncomeVsExpenseChart data={chartData.incomeVsExpense} />
            </div>
            <div className="lg:col-span-5">
              <GlossByPayerChart data={chartData.glossByPayer} />
            </div>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm">
              <BIInsightsCard kpis={kpis} agingCritical={agingCritical} />
            </div>

            {!directorMode && (
              <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Dicas rápidas de uso (Power BI)
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    PRO
                  </Badge>
                </div>

                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <li>• Clique em qualquer gráfico para aplicar filtro (toggle: clique novamente remove).</li>
                  <li>• Use o filtro de Médico + Tipo para “entrar” na operação e ver o mix real.</li>
                  <li>• Aperte <b>ESC</b> para limpar seleções rápidas sem mexer nas datas.</li>
                  <li>• “Modo Diretor” esconde filtros e deixa 100% foco em leitura executiva.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer + Drilldown */}
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm">
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
