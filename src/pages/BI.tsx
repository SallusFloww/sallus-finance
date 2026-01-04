// ============================================
// BI PAGE - BUSINESS INTELLIGENCE
// Release freeze: only bugfixes allowed
// 
// VERSÃO 1.0.0 - CONGELADO PARA PRODUÇÃO
// Qualquer mudança que altere métrica/layout exige incremento de versão
// 
// LAYOUT TRAVADO:
// 1. Barra de filtros (BIGlobalFilters)
// 2. Filtros ativos (BIActiveFiltersBar)
// 3. Score Hero + Alertas
// 4. KPIs Grid
// 5. Gráficos Row 1: Tendência + Funil
// 6. Gráficos Row 2: Composição + Análises
// 7. Insights
// 8. Footer
// 
// AJUSTES PERMITIDOS: espaçamento, alinhamento, tipografia
// AJUSTES PROIBIDOS: adicionar/remover blocos, novas métricas
// ============================================

import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { BIFilterProvider, useBIFilters } from "@/contexts/BIFilterContext";
import { BIGlobalFilters } from "@/components/bi/BIGlobalFilters";
import { BIActiveFiltersBar } from "@/components/bi/BIActiveFiltersBar";
import { BIScoreHero, BIKPIGrid } from "@/components/bi/BIScoreHero";
import { BIInsightsCard } from "@/components/bi/BIInsightsCard";
import { BIAlertsCard } from "@/components/bi/BIAlertsCard";
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
import { useWeightedScore } from "@/hooks/useWeightedScore";
import { useApp } from "@/contexts/AppContext";
import { APP_VERSION } from "@/contracts/version";
import { canCalculateScore } from "@/contracts/bi-rules";

function BIContent() {
  const { filters, drilldownContext, lastUpdated } = useBIFilters();
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;

  // Convert context filters to useBIData format
  const biFilters = useMemo(() => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    unit: filters.unit,
    payerType: "all" as const,
    period: filters.periodPreset === "custom" ? undefined : filters.periodPreset,
  }), [filters]);

  const { kpis, chartData, recentTransactions } = useBIData(biFilters);
  const globalScore = useWeightedScore(transactions, settings);

  // Extract unique payers and categories for filter dropdowns
  const uniquePayers = useMemo(() => {
    const payers = new Set<string>();
    chartData.receivedByPayer.forEach(p => payers.add(p.payer));
    return Array.from(payers);
  }, [chartData.receivedByPayer]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    chartData.topExpenseCategories.forEach(c => cats.add(c.category));
    return Array.from(cats);
  }, [chartData.topExpenseCategories]);

  // Calculate aging critical value
  const agingCritical = useMemo(() => {
    return chartData.aging
      .filter(a => a.range === "61-90 dias" || a.range === "90+ dias")
      .reduce((sum, a) => sum + a.value, 0);
  }, [chartData.aging]);

  // Verificar dados para cálculo do score usando regras centralizadas
  const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
  const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
  const hasCashData = kpis.entradas > 0 || kpis.saidas > 0;
  
  // REGRA CENTRALIZADA: Score em formação quando não há dados suficientes
  const isScoreInFormation = !canCalculateScore(
    hasProductionData,
    hasBillingData,
    hasCashData,
    globalScore.globalScore
  );

  // Drilldown data
  const drilldownData = useMemo(() => {
    if (!drilldownContext) return [];
    return recentTransactions.slice(0, 30).map(t => ({
      id: t.id,
      description: t.description,
      value: t.amount,
      date: t.date,
      unit: t.unit,
    }));
  }, [drilldownContext, recentTransactions]);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              📊 BI - Business Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
              Painel analítico interativo com cross-filter • Power BI-like • Read-only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Somente leitura
            </Badge>
            <Badge variant="outline" className="text-xs">
              {format(filters.startDate, "dd/MM", { locale: ptBR })} - {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* Global Filters */}
        <BIGlobalFilters 
          settings={settings}
          uniquePayers={uniquePayers}
          uniqueCategories={uniqueCategories}
        />

        {/* Active Filters Bar */}
        <BIActiveFiltersBar />

        {/* Score Hero + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BIScoreHero
              score={globalScore.globalScore}
              label={globalScore.globalScore >= 70 ? "Saudável" : globalScore.globalScore >= 55 ? "Atenção" : "Crítico"}
              factors={[
                `Recebimento: ${(isNaN(kpis.taxaRecebimento) ? 0 : kpis.taxaRecebimento).toFixed(0)}%`,
                `Faturamento: ${(isNaN(kpis.taxaFaturamento) ? 0 : kpis.taxaFaturamento).toFixed(0)}%`,
                `Em aberto: ${(kpis.emAberto / (kpis.faturado || 1) * 100).toFixed(0)}%`
              ]}
              isInFormation={isScoreInFormation}
            />
          </div>
          <BIAlertsCard 
            kpis={kpis} 
            agingData={chartData.aging} 
            payerData={chartData.receivedByPayer} 
          />
        </div>

        {/* KPI Grid */}
        <BIKPIGrid kpis={kpis} />

        {/* Charts Grid - Row 1: Tendência + Funil */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CashEvolutionChart data={chartData.cashEvolution} />
          <ConversionFunnelChart data={chartData.funnel} />
        </div>

        {/* Charts Grid - Row 2: Composição + Análises */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ReceivedByPayerChart data={chartData.receivedByPayer} />
          <TopExpenseCategoriesChart data={chartData.topExpenseCategories} />
          <AgingChart data={chartData.aging} />
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BIInsightsCard kpis={kpis} agingCritical={agingCritical} />
        </div>

        {/* Footer */}
        <BIFooter lastUpdated={lastUpdated} />

        {/* Drilldown Drawer */}
        <BIDrilldownDrawer data={drilldownData} />
      </div>
    </DashboardLayout>
  );
}

export default function BI() {
  return (
    <BIFilterProvider>
      <BIContent />
    </BIFilterProvider>
  );
}
