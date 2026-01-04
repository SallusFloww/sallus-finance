import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/utils/formatters";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, DollarSign, PieChart, ArrowRightLeft, AlertTriangle, CheckCircle, Info, Target, Activity, BarChart3, Zap, Shield, Clock, XCircle, AlertCircle } from "lucide-react";
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  format, 
  eachMonthOfInterval,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  differenceInDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type PeriodOption = "today" | "month" | "quarter" | "year" | "custom";

export default function Trends() {
  const { transactions: txContext } = useApp();
  const { transactions } = txContext;
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());

  // Calcular datas baseado no período selecionado
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    
    switch (period) {
      case "today":
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
          periodLabel: format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        };
      case "month":
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          periodLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR })
        };
      case "quarter":
        return {
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now),
          periodLabel: `${format(startOfQuarter(now), "MMM", { locale: ptBR })} - ${format(endOfQuarter(now), "MMM yyyy", { locale: ptBR })}`
        };
      case "year":
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
          periodLabel: format(now, "yyyy")
        };
      case "custom":
        return {
          startDate: customStartDate || startOfMonth(now),
          endDate: customEndDate || endOfMonth(now),
          periodLabel: `${format(customStartDate || now, "dd/MM/yy", { locale: ptBR })} - ${format(customEndDate || now, "dd/MM/yy", { locale: ptBR })}`
        };
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          periodLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR })
        };
    }
  }, [period, customStartDate, customEndDate]);

  // Filtrar transações do período selecionado
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tDate = parseISO(t.date);
      return tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Calcular totais do período
  const periodStats = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    const incomeParticular = filteredTransactions
      .filter((t) => t.type === "INCOME" && t.receiptType === "PARTICULAR")
      .reduce((sum, t) => sum + t.amount, 0);

    const incomeConvenio = filteredTransactions
      .filter((t) => t.type === "INCOME" && t.receiptType === "CONVENIO")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income,
      expense,
      balance,
      incomeParticular,
      incomeConvenio,
      transactionCount: filteredTransactions.length,
      particularPercentage: income > 0 ? (incomeParticular / income) * 100 : 0,
      convenioPercentage: income > 0 ? (incomeConvenio / income) * 100 : 0,
    };
  }, [filteredTransactions]);

  // Dados do gráfico
  const chartData = useMemo(() => {
    // Se período é hoje, mostrar apenas um ponto
    if (period === "today") {
      return [{
        label: format(new Date(), "dd/MM", { locale: ptBR }),
        labelFull: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        income: periodStats.income,
        expense: periodStats.expense,
        balance: periodStats.balance,
        incomeParticular: periodStats.incomeParticular,
        incomeConvenio: periodStats.incomeConvenio,
      }];
    }

    // Para períodos curtos (mês), agrupar por dia
    if (period === "month") {
      const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
      
      return daysInterval.map((day) => {
        const dayTransactions = filteredTransactions.filter((t) => 
          isSameDay(parseISO(t.date), day)
        );

        const income = dayTransactions
          .filter((t) => t.type === "INCOME")
          .reduce((sum, t) => sum + t.amount, 0);

        const expense = dayTransactions
          .filter((t) => t.type === "EXPENSE")
          .reduce((sum, t) => sum + t.amount, 0);

        const incomeParticular = dayTransactions
          .filter((t) => t.type === "INCOME" && t.receiptType === "PARTICULAR")
          .reduce((sum, t) => sum + t.amount, 0);

        const incomeConvenio = dayTransactions
          .filter((t) => t.type === "INCOME" && t.receiptType === "CONVENIO")
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          label: format(day, "dd", { locale: ptBR }),
          labelFull: format(day, "dd 'de' MMMM", { locale: ptBR }),
          income,
          expense,
          balance: income - expense,
          incomeParticular,
          incomeConvenio,
        };
      });
    }

    // Para períodos longos (trimestre, ano, custom), agrupar por mês
    const monthsInterval = eachMonthOfInterval({ start: startDate, end: endDate });

    return monthsInterval.map((monthDate) => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthTransactions = filteredTransactions.filter((t) => {
        const tDate = parseISO(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
      });

      const income = monthTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = monthTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      const incomeParticular = monthTransactions
        .filter((t) => t.type === "INCOME" && t.receiptType === "PARTICULAR")
        .reduce((sum, t) => sum + t.amount, 0);

      const incomeConvenio = monthTransactions
        .filter((t) => t.type === "INCOME" && t.receiptType === "CONVENIO")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        label: format(monthDate, "MMM/yy", { locale: ptBR }),
        labelFull: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        income,
        expense,
        balance: income - expense,
        incomeParticular,
        incomeConvenio,
      };
    });
  }, [period, startDate, endDate, filteredTransactions, periodStats]);

  // Contagem de períodos positivos/negativos
  const positiveCount = chartData.filter(d => d.balance >= 0).length;
  const negativeCount = chartData.filter(d => d.balance < 0).length;

  // ============= ANÁLISES INTELIGENTES =============
  
  // Resumo Inteligente do Período - Foco em comportamento, não totais
  const smartSummary = useMemo(() => {
    const daysWithMovement = chartData.filter(d => d.income > 0 || d.expense > 0).length;
    const totalDays = chartData.length;
    const daysWithoutMovement = totalDays - daysWithMovement;
    
    // Índice de recorrência (% de dias ativos)
    const recurrenceIndex = totalDays > 0 ? (daysWithMovement / totalDays) * 100 : 0;
    
    // Concentração do maior dia
    const maxDayIncome = Math.max(...chartData.map(d => d.income));
    const concentrationPercentage = periodStats.income > 0 
      ? (maxDayIncome / periodStats.income) * 100 
      : 0;
    
    // Média de entrada por dia ativo (não sobre dias zerados)
    const avgIncomePerActiveDay = daysWithMovement > 0 
      ? periodStats.income / daysWithMovement 
      : 0;
    
    // Grau de volatilidade baseado na variância - só conclusivo com ≥5 dias ativos
    const incomeValues = chartData.filter(d => d.income > 0).map(d => d.income);
    let volatilityLevel: "não conclusivo" | "estável" | "variável" | "disperso" = "não conclusivo";
    let volatilityTooltip = "Período com poucos dias ativos para avaliação de dispersão.";
    
    if (incomeValues.length >= 5) {
      const mean = incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length;
      const variance = incomeValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / incomeValues.length;
      const coefficientOfVariation = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;
      if (coefficientOfVariation > 80) {
        volatilityLevel = "disperso";
        volatilityTooltip = "Alta variação entre dias ativos — baixa previsibilidade, risco operacional elevado.";
      } else if (coefficientOfVariation > 40) {
        volatilityLevel = "variável";
        volatilityTooltip = "Variação moderada entre dias — previsibilidade mediana.";
      } else {
        volatilityLevel = "estável";
        volatilityTooltip = "Valores consistentes entre dias ativos — previsibilidade estatística alta.";
      }
    }
    
    // Dias críticos (concentração acima de 30% do período)
    const criticalDays = chartData.filter(d => {
      const dayPercentage = periodStats.income > 0 ? (d.income / periodStats.income) * 100 : 0;
      return dayPercentage > 30;
    }).length;
    
    // Quantos dias sustentaram o resultado
    const sortedByIncome = [...chartData].filter(d => d.income > 0).sort((a, b) => b.income - a.income);
    let accumulatedPercentage = 0;
    let daysSustainingResult = 0;
    for (const day of sortedByIncome) {
      accumulatedPercentage += periodStats.income > 0 ? (day.income / periodStats.income) * 100 : 0;
      daysSustainingResult++;
      if (accumulatedPercentage >= 80) break;
    }
    
    return {
      daysWithMovement,
      daysWithoutMovement,
      totalDays,
      recurrenceIndex,
      concentrationPercentage,
      avgIncomePerActiveDay,
      volatilityLevel,
      volatilityTooltip,
      criticalDays,
      daysSustainingResult,
      maxDayIncome
    };
  }, [chartData, periodStats]);

  // Alerta Principal Consolidado - Evita redundância entre alertas similares
  const consolidatedAlert = useMemo(() => {
    const hasHighConcentration = smartSummary.concentrationPercentage > 70;
    const hasLowRecurrence = smartSummary.recurrenceIndex < 30 && smartSummary.totalDays > 7;
    const hasIrregularFlow = smartSummary.daysWithoutMovement > smartSummary.daysWithMovement && smartSummary.totalDays > 7;
    
    // Consolidar alertas de concentração, baixa recorrência e fluxo irregular em um único alerta crítico
    if (hasHighConcentration || hasLowRecurrence || hasIrregularFlow) {
      const issues: string[] = [];
      if (hasHighConcentration) issues.push(`${smartSummary.concentrationPercentage.toFixed(0)}% do resultado em um único ${period === "month" ? "dia" : "período"}`);
      if (hasLowRecurrence) issues.push(`apenas ${smartSummary.recurrenceIndex.toFixed(0)}% de recorrência`);
      if (hasIrregularFlow) issues.push(`${smartSummary.daysWithoutMovement} ${period === "month" ? "dias" : "períodos"} sem movimento`);
      
      return {
        level: "critical" as const,
        title: "Fluxo de Caixa Frágil",
        detected: issues.join(", "),
        reason: "Resultado positivo pontual não garante sustentabilidade. A concentração elevada e baixa frequência de entradas tornam o caixa vulnerável a qualquer imprevisto.",
        risk: "Se o padrão persistir, o próximo período pode apresentar déficit caso o evento concentrador não se repita."
      };
    }
    
    return null;
  }, [smartSummary, period]);

  // Alertas de Tendência Secundários - Apenas os não-redundantes
  const trendAlerts = useMemo(() => {
    const alerts: { 
      level: "info" | "warning"; 
      category: "dependency" | "volatility";
      title: string;
      message: string;
      impact: string;
      risk: string;
    }[] = [];
    
    // Dependência de tipo de entrada (não relacionado à concentração temporal)
    if (periodStats.particularPercentage > 80) {
      alerts.push({
        level: "warning",
        category: "dependency",
        title: "Dependência de receita Particular",
        message: `${periodStats.particularPercentage.toFixed(0)}% das entradas são Particular.`,
        impact: "Fluxo imediato, mas sensível a sazonalidade.",
        risk: "Diversificar fontes de receita para maior estabilidade."
      });
    } else if (periodStats.convenioPercentage > 80) {
      alerts.push({
        level: "warning",
        category: "dependency",
        title: "Dependência de Convênios",
        message: `${periodStats.convenioPercentage.toFixed(0)}% das entradas são Convênios.`,
        impact: "Receita previsível, mas com prazo de recebimento.",
        risk: "Atenção ao fluxo de curto prazo — entradas podem demorar."
      });
    }
    
    // Alta volatilidade (usando novo tipo)
    if (smartSummary.volatilityLevel === "disperso") {
      alerts.push({
        level: "warning",
        category: "volatility",
        title: "Alta volatilidade de entradas",
        message: "Grande variação nos valores de entrada entre dias ativos.",
        impact: "Difícil prever receita diária média.",
        risk: "Considerar reserva de contingência."
      });
    }
    
    return alerts;
  }, [smartSummary, periodStats]);

  // Diagnóstico Executivo Final - Síntese conclusiva única
  const executiveDiagnosis = useMemo(() => {
    const isSustainable = periodStats.balance > 0 && smartSummary.concentrationPercentage < 50 && smartSummary.recurrenceIndex > 40;
    const isFragile = periodStats.balance > 0 && (smartSummary.concentrationPercentage > 70 || smartSummary.recurrenceIndex < 30);
    const isNegative = periodStats.balance < 0;
    
    // Determinar nível hierárquico: Saudável (🟢), Atenção (🟡), Crítico (🔴)
    if (isNegative) {
      return {
        status: "negative" as const,
        level: "critical" as const,
        badge: "🔴 Crítico",
        text: "Déficit no período. Ação corretiva necessária."
      };
    } else if (isFragile) {
      return {
        status: "warning" as const,
        level: "attention" as const,
        badge: "🟡 Atenção",
        text: "Resultado positivo pontual, com risco estrutural por concentração e baixa recorrência."
      };
    } else if (isSustainable) {
      return {
        status: "positive" as const,
        level: "healthy" as const,
        badge: "🟢 Saudável",
        text: "Fluxo sustentável com boa distribuição e recorrência adequada."
      };
    } else {
      return {
        status: "neutral" as const,
        level: "attention" as const,
        badge: "🟡 Atenção",
        text: "Dados insuficientes para conclusão definitiva. Acompanhar evolução."
      };
    }
  }, [periodStats, smartSummary]);

  // Leitura Executiva da Tendência - Foco em decisão e sustentabilidade
  const executiveReading = useMemo(() => {
    const sections: { 
      title: string; 
      status: "positive" | "warning" | "negative" | "neutral";
      text: string;
    }[] = [];
    
    // 1. Sustentabilidade do resultado
    const isSustainable = periodStats.balance > 0 && smartSummary.concentrationPercentage < 50 && smartSummary.recurrenceIndex > 40;
    const isAtRisk = periodStats.balance > 0 && (smartSummary.concentrationPercentage > 70 || smartSummary.recurrenceIndex < 30);
    
    if (periodStats.balance > 0) {
      if (isSustainable) {
        sections.push({
          title: "Resultado Sustentável",
          status: "positive",
          text: `Caixa positivo de ${formatCurrency(periodStats.balance)} com boa distribuição ao longo do período.`
        });
      } else if (isAtRisk) {
        sections.push({
          title: "Resultado Positivo com Risco",
          status: "warning",
          text: `Caixa positivo de ${formatCurrency(periodStats.balance)}, mas ${smartSummary.concentrationPercentage > 70 ? "altamente concentrado" : "com baixa recorrência"} — vulnerável a imprevistos.`
        });
      } else {
        sections.push({
          title: "Resultado Positivo",
          status: "positive",
          text: `Caixa positivo de ${formatCurrency(periodStats.balance)} no período.`
        });
      }
    } else if (periodStats.balance < 0) {
      sections.push({
        title: "Resultado Negativo",
        status: "negative",
        text: `Déficit de ${formatCurrency(Math.abs(periodStats.balance))} no período. Ação corretiva recomendada.`
      });
    } else {
      sections.push({
        title: "Resultado Neutro",
        status: "neutral",
        text: "Caixa equilibrado, sem variação líquida."
      });
    }
    
    // 2. Análise de distribuição vs concentração
    if (smartSummary.daysSustainingResult <= 2 && periodStats.income > 0) {
      sections.push({
        title: "Alta Dependência",
        status: "warning",
        text: `Apenas ${smartSummary.daysSustainingResult} ${period === "month" ? "dia" : "período"}${smartSummary.daysSustainingResult > 1 ? "s" : ""} ${smartSummary.daysSustainingResult > 1 ? "sustentaram" : "sustentou"} 80% do resultado — concentração elevada.`
      });
    } else if (smartSummary.daysWithMovement > 5 && smartSummary.concentrationPercentage < 40) {
      sections.push({
        title: "Distribuição Saudável",
        status: "positive",
        text: `Movimentação em ${smartSummary.daysWithMovement} ${period === "month" ? "dias" : "períodos"} com boa dispersão — menor risco operacional.`
      });
    }
    
    // 3. Comparativo dias ativos vs inativos (removido para evitar redundância com alerta consolidado)
    
    return sections;
  }, [periodStats, smartSummary, period]);

  // Interpretação do gráfico Entradas vs Saídas - Foco em dependência, margem e recorrência
  const chartInterpretation = useMemo(() => {
    const margin = periodStats.income - periodStats.expense;
    const marginPercentage = periodStats.income > 0 ? (margin / periodStats.income) * 100 : 0;
    
    // Verificar consistência
    const daysWithPositiveMargin = chartData.filter(d => d.income > d.expense).length;
    const daysWithActivity = chartData.filter(d => d.income > 0 || d.expense > 0).length;
    const consistencyRate = daysWithActivity > 0 ? (daysWithPositiveMargin / daysWithActivity) * 100 : 0;
    
    const parts: string[] = [];
    
    // Margem
    if (marginPercentage > 50) {
      parts.push(`Margem saudável de ${marginPercentage.toFixed(0)}%.`);
    } else if (marginPercentage > 20) {
      parts.push(`Margem moderada de ${marginPercentage.toFixed(0)}%.`);
    } else if (marginPercentage > 0) {
      parts.push(`Margem apertada de ${marginPercentage.toFixed(0)}% — pouca folga operacional.`);
    } else {
      parts.push("Margem negativa — saídas superam entradas.");
    }
    
    // Consistência
    if (consistencyRate > 70) {
      parts.push(`Comportamento consistente (${consistencyRate.toFixed(0)}% dos dias ativos positivos).`);
    } else if (consistencyRate > 40) {
      parts.push(`Comportamento variável — ${consistencyRate.toFixed(0)}% dos dias ativos com margem positiva.`);
    } else if (daysWithActivity > 0) {
      parts.push(`Alta dependência de eventos isolados — apenas ${consistencyRate.toFixed(0)}% dos dias ativos positivos.`);
    }
    
    // Recorrência
    if (smartSummary.recurrenceIndex < 30 && smartSummary.totalDays > 7) {
      parts.push("Baixa frequência de movimentação no período.");
    }
    
    return parts.join(" ");
  }, [periodStats, chartData, smartSummary]);

  // Verificar se há poucos dias com movimentação
  const fewDaysWarning = useMemo(() => {
    const movementRate = (smartSummary.daysWithMovement / smartSummary.totalDays) * 100;
    return movementRate < 40 && smartSummary.totalDays > 5;
  }, [smartSummary]);

  // Próxima Melhor Ação - Máximo 2 recomendações práticas e executáveis
  const nextBestActions = useMemo(() => {
    const actions: { icon: "target" | "calendar" | "shield" | "zap"; text: string; priority: number }[] = [];
    
    // Ação para déficit - prioridade máxima
    if (periodStats.balance < 0) {
      actions.push({
        icon: "target",
        text: "Reduzir R$ " + formatCurrency(Math.abs(periodStats.balance)).replace("R$", "").trim() + " em despesas ou ampliar receita equivalente para zerar déficit.",
        priority: 0
      });
    }
    
    // Concentração alta - ação específica
    if (consolidatedAlert && smartSummary.concentrationPercentage > 50) {
      actions.push({
        icon: "calendar",
        text: "Fracionar agendas ou faturamento para pelo menos " + Math.max(5, smartSummary.daysWithMovement + 3) + " dias ativos no próximo período.",
        priority: 1
      });
    }
    
    // Baixa recorrência sem concentração crítica
    if (!consolidatedAlert && smartSummary.recurrenceIndex < 40 && smartSummary.totalDays > 7) {
      actions.push({
        icon: "zap",
        text: "Ampliar dias de atendimento ou faturamento para atingir 50% de recorrência.",
        priority: 2
      });
    }
    
    // Dependência de tipo de receita
    const hasDependencyAlert = trendAlerts.some(a => a.category === "dependency");
    if (hasDependencyAlert && actions.length < 2) {
      actions.push({
        icon: "shield",
        text: periodStats.particularPercentage > 75 
          ? "Incluir ao menos 2 convênios ativos para reduzir exposição a sazonalidade."
          : "Provisionar reserva de 15 dias para cobrir prazo de repasse de convênios.",
        priority: 3
      });
    }
    
    // Ação padrão se fluxo está saudável
    if (actions.length === 0 && periodStats.balance > 0) {
      actions.push({
        icon: "target",
        text: "Manter padrão atual. Considerar reserva de " + formatCurrency(periodStats.income * 0.1) + " para contingência.",
        priority: 4
      });
    }
    
    // Limitar a 2 ações
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 2);
  }, [smartSummary, periodStats, consolidatedAlert, trendAlerts]);

  // Tooltip para gráfico de Fluxo Líquido
  const NetFlowTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold text-foreground capitalize">{data?.labelFull}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-muted-foreground">Entradas: {formatCurrency(data?.income || 0)}</p>
            <p className="text-muted-foreground">Saídas: {formatCurrency(data?.expense || 0)}</p>
            <p className={`font-bold ${data?.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              Saldo Líquido: {formatCurrency(data?.balance || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Tooltip para gráfico de Linhas
  const TrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold text-foreground capitalize">{data?.labelFull}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-emerald-600">Entradas: {formatCurrency(data?.income || 0)}</p>
            <p className="text-rose-600">Saídas: {formatCurrency(data?.expense || 0)}</p>
            <p className="text-muted-foreground">
              Margem: {formatCurrency(data?.income - data?.expense || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Tooltip para gráfico de Composição
  const CompositionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const total = data?.incomeParticular + data?.incomeConvenio;
      const particularPct = total > 0 ? ((data?.incomeParticular / total) * 100).toFixed(1) : 0;
      const convenioPct = total > 0 ? ((data?.incomeConvenio / total) * 100).toFixed(1) : 0;
      
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold text-foreground capitalize">{data?.labelFull}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p style={{ color: "hsl(217.2 91.2% 59.8%)" }}>
              Particular: {formatCurrency(data?.incomeParticular || 0)} ({particularPct}%)
            </p>
            <p style={{ color: "hsl(262.1 83.3% 57.8%)" }}>
              Convênios: {formatCurrency(data?.incomeConvenio || 0)} ({convenioPct}%)
            </p>
            <p className="font-medium text-foreground border-t pt-1 mt-1">
              Total: {formatCurrency(total || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tendências</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Esta aba interpreta o comportamento dos dados consolidados apresentados na aba Relatórios.
            </p>
            <p className="text-muted-foreground mt-2">
              Período: <span className="font-medium capitalize">{periodLabel}</span>
            </p>
          </div>
        </div>

        {/* Period Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant={period === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("today")}
          >
            Hoje
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("month")}
          >
            Mês Atual
          </Button>
          <Button
            variant={period === "quarter" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("quarter")}
          >
            Trimestre
          </Button>
          <Button
            variant={period === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("year")}
          >
            Ano
          </Button>
          
          <div className="flex items-center gap-2 ml-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={period === "custom" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    period !== "custom" && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {customStartDate ? format(customStartDate, "dd/MM/yy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customStartDate}
                  onSelect={(date) => {
                    setCustomStartDate(date);
                    setPeriod("custom");
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={period === "custom" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    period !== "custom" && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {customEndDate ? format(customEndDate, "dd/MM/yy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => {
                    setCustomEndDate(date);
                    setPeriod("custom");
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Summary Cards - Foco estratégico */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Entradas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(periodStats.income)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Saídas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-rose-600">
                {formatCurrency(periodStats.expense)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Saldo Líquido</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${periodStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(periodStats.balance)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                Resultado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {periodStats.balance >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-rose-600" />
                )}
                <p className={`text-2xl font-bold ${periodStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {periodStats.balance >= 0 ? "Positivo" : "Negativo"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Novo card: Dias com movimentação */}
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <Card className="cursor-help">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Dias Ativos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">
                      {smartSummary.daysWithMovement}/{smartSummary.totalDays}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {period === "month" ? "dias" : "períodos"} com movimento
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">Indica quantos {period === "month" ? "dias" : "períodos"} tiveram movimentação financeira. Não é um valor monetário.</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>

          {/* Novo card: Índice de Recorrência */}
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <Card className="cursor-help">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Recorrência
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${smartSummary.recurrenceIndex > 50 ? "text-emerald-600" : smartSummary.recurrenceIndex > 30 ? "text-amber-600" : "text-rose-600"}`}>
                      {smartSummary.recurrenceIndex.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      frequência de movimento
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">Percentual de {period === "month" ? "dias" : "períodos"} com movimentação. Quanto maior, mais regular é o fluxo.</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
        </div>

        {/* ============= BLOCO 1: LEITURA EXECUTIVA DA TENDÊNCIA ============= */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Leitura Executiva da Tendência
            </CardTitle>
            <CardDescription>
              Esse resultado é saudável? Recorrente? Arriscado?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {executiveReading.map((section, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg",
                    section.status === "positive" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500",
                    section.status === "warning" && "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500",
                    section.status === "negative" && "bg-rose-50 dark:bg-rose-950/30 border-l-4 border-l-rose-500",
                    section.status === "neutral" && "bg-muted/50 border-l-4 border-l-muted-foreground"
                  )}
                >
                  {section.status === "positive" && <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
                  {section.status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                  {section.status === "negative" && <XCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />}
                  {section.status === "neutral" && <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{section.title}</p>
                    <p className="text-sm text-muted-foreground">{section.text}</p>
                  </div>
                </div>
              ))}
              {executiveReading.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para análise.</p>
              )}
              
              {/* Diagnóstico Final Único */}
              <div className={cn(
                "mt-4 p-4 rounded-lg border-2",
                executiveDiagnosis.status === "positive" && "bg-emerald-100 dark:bg-emerald-950/50 border-emerald-500",
                executiveDiagnosis.status === "warning" && "bg-amber-100 dark:bg-amber-950/50 border-amber-500",
                executiveDiagnosis.status === "negative" && "bg-rose-100 dark:bg-rose-950/50 border-rose-500",
                executiveDiagnosis.status === "neutral" && "bg-muted border-muted-foreground"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Diagnóstico Executivo
                  </p>
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded",
                    executiveDiagnosis.level === "healthy" && "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
                    executiveDiagnosis.level === "attention" && "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                    executiveDiagnosis.level === "critical" && "bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                  )}>
                    {executiveDiagnosis.badge}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{executiveDiagnosis.text}</p>
                {/* Mini-explicação sobre baixa recorrência */}
                {(executiveDiagnosis.level === "attention" || executiveDiagnosis.level === "critical") && smartSummary.recurrenceIndex < 40 && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    <span className="font-medium">Sobre baixa recorrência:</span> Fluxo financeiro instável pode gerar riscos em períodos futuros. Quanto menor a frequência de movimentação, maior a dependência de eventos isolados.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============= BLOCO 2: RESUMO INTELIGENTE DO PERÍODO ============= */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Resumo Inteligente do Período
            </CardTitle>
            <CardDescription>
              Foco em comportamento e impacto — não apenas totais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Alerta de fluxo concentrado quando aplicável */}
            {smartSummary.concentrationPercentage > 50 && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ Alerta de fluxo concentrado — ponto crítico!
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Esse padrão pode comprometer o resultado se repetido. Considere diluir entradas ao longo do período para reduzir exposição.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Quantos dias sustentaram o resultado */}
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <p className={`text-2xl font-bold ${smartSummary.daysSustainingResult <= 2 ? "text-amber-600" : "text-foreground"}`}>
                  {smartSummary.daysSustainingResult}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{period === "month" ? "dias" : "períodos"} sustentaram</p>
                <p className="text-xs text-muted-foreground">80% do resultado</p>
              </div>
              
              {/* Concentração do maior dia */}
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <p className={`text-2xl font-bold ${smartSummary.concentrationPercentage > 70 ? "text-rose-600" : smartSummary.concentrationPercentage > 50 ? "text-amber-600" : "text-foreground"}`}>
                  {smartSummary.concentrationPercentage.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">do mês concentrado</p>
                <p className="text-xs text-muted-foreground">no maior dia</p>
              </div>
              
              {/* Média dos dias ativos */}
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(smartSummary.avgIncomePerActiveDay)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">média apenas dos</p>
                <p className="text-xs text-muted-foreground">{period === "month" ? "dias" : "períodos"} ativos</p>
              </div>
              
              {/* Dispersão estatística - com lógica de dias mínimos */}
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <div className="text-center p-4 bg-muted/50 rounded-lg border cursor-help">
                      <p className={`text-2xl font-bold capitalize ${
                        smartSummary.volatilityLevel === "disperso" ? "text-amber-600" : 
                        smartSummary.volatilityLevel === "variável" ? "text-muted-foreground" : 
                        smartSummary.volatilityLevel === "estável" ? "text-emerald-600" : "text-muted-foreground"
                      }`}>
                        {smartSummary.volatilityLevel === "não conclusivo" ? "N/D" : 
                         smartSummary.volatilityLevel === "estável" ? "Estável" : 
                         smartSummary.volatilityLevel === "variável" ? "Variável" : "Disperso"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {smartSummary.volatilityLevel === "não conclusivo" ? "estabilidade" : "dispersão"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {smartSummary.volatilityLevel === "não conclusivo" ? "não conclusiva" : "de valores"}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">{smartSummary.volatilityTooltip}</p>
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
              
              {/* Dias críticos */}
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <p className={`text-2xl font-bold ${smartSummary.criticalDays > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {smartSummary.criticalDays}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{period === "month" ? "dias" : "períodos"} críticos</p>
                <p className="text-xs text-muted-foreground">(&gt;30% do total)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============= BLOCO: ALERTAS DE TENDÊNCIA (CONSOLIDADOS) ============= */}
        {(consolidatedAlert || trendAlerts.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Alertas de Tendência
              </CardTitle>
              <CardDescription>
                O que foi detectado, por que importa e qual o risco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Alerta Principal Consolidado */}
                {consolidatedAlert && (
                  <div className="p-4 rounded-lg border-l-4 bg-rose-50 dark:bg-rose-950/30 border-l-rose-500">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{consolidatedAlert.title}</p>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                            🚨 Crítico
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">O que foi detectado:</p>
                            <p className="text-foreground">{consolidatedAlert.detected}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Por que importa:</p>
                            <p className="text-foreground">{consolidatedAlert.reason}</p>
                          </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Risco se persistir:</p>
                          <p className="text-foreground">{consolidatedAlert.risk}</p>
                        </div>
                      </div>
                      {/* Mini-recomendação de ação */}
                      <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-800">
                        <p className="text-xs text-rose-700 dark:text-rose-300">
                          <span className="font-medium">💡 Ação sugerida:</span> Esse risco pode ser controlado com ações de diversificação de entradas ao longo do período, evitando concentração em poucos dias.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                
                {/* Alertas Secundários */}
                {trendAlerts.map((alert, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "p-4 rounded-lg border-l-4",
                      alert.level === "warning" && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                      alert.level === "info" && "bg-blue-50 dark:bg-blue-950/30 border-l-blue-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {alert.level === "warning" && <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />}
                      {alert.level === "info" && <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase",
                            alert.level === "warning" && "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                            alert.level === "info" && "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          )}>
                            {alert.level === "warning" ? "⚠️ Atenção" : "ℹ️ Info"}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{alert.message}</p>
                        <div className="grid md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Por que importa:</p>
                            <p className="text-xs text-foreground">{alert.impact}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Risco se persistir:</p>
                            <p className="text-xs text-foreground">{alert.risk}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* GRÁFICO 1: Fluxo de Caixa Líquido */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Fluxo de Caixa Líquido
            </CardTitle>
            <CardDescription>
              Saldo líquido por período (Entradas - Saídas). 
              <span className="text-emerald-600 font-medium"> Verde = positivo</span>, 
              <span className="text-rose-600 font-medium"> Vermelho = negativo</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-muted-foreground">{positiveCount} {period === "month" ? "dias" : "meses"} com saldo positivo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-muted-foreground">{negativeCount} {period === "month" ? "dias" : "meses"} com saldo negativo</span>
              </div>
              {fewDaysWarning && (
                <TooltipProvider>
                  <TooltipUI>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 ml-auto cursor-help">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-600">Concentrado</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">Movimentação concentrada em poucos {period === "month" ? "dias" : "períodos"} no período analisado.</p>
                    </TooltipContent>
                  </TooltipUI>
                </TooltipProvider>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-8 h-0.5 border-t-2 border-dashed border-emerald-500/50" />
                <span className="text-xs text-muted-foreground">Zona ideal: ≥50% dos dias ativos</span>
              </div>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip content={<NetFlowTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
                  {/* Linha pontilhada indicando zona ideal de fluxo */}
                  {periodStats.income > 0 && (
                    <ReferenceLine 
                      y={periodStats.income * 0.1} 
                      stroke="hsl(142.1 76.2% 36.3%)" 
                      strokeDasharray="5 5" 
                      strokeWidth={1.5}
                      strokeOpacity={0.6}
                      label={{ 
                        value: "Fluxo ideal", 
                        position: "right", 
                        fill: "hsl(142.1 76.2% 36.3%)", 
                        fontSize: 10,
                        opacity: 0.7
                      }}
                    />
                  )}
                  <Bar 
                    dataKey="balance" 
                    name="Saldo Líquido" 
                    radius={[4, 4, 0, 0]}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.balance >= 0 ? "hsl(142.1 76.2% 36.3%)" : "hsl(346.8 77.2% 49.8%)"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO 2: Entradas vs Saídas (Linhas) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Entradas vs. Saídas
            </CardTitle>
            <CardDescription>
              Comparação entre receitas e despesas. 
              Quanto maior a distância entre as linhas, maior a margem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Indicador discreto de concentração */}
            {fewDaysWarning && (
              <div className="mb-3 flex justify-end">
                <TooltipProvider>
                  <TooltipUI>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-600">Concentrado</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">Movimentação concentrada em poucos {period === "month" ? "dias" : "períodos"} no período analisado.</p>
                    </TooltipContent>
                  </TooltipUI>
                </TooltipProvider>
              </div>
            )}
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    name="Entradas" 
                    stroke="hsl(142.1 76.2% 36.3%)"
                    strokeWidth={3}
                    dot={{ fill: "hsl(142.1 76.2% 36.3%)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    name="Saídas" 
                    stroke="hsl(346.8 77.2% 49.8%)"
                    strokeWidth={3}
                    dot={{ fill: "hsl(346.8 77.2% 49.8%)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda interpretativa - texto mais analítico */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Análise: </span>
                {smartSummary.daysWithMovement <= 2 && periodStats.balance > 0 
                  ? `Resultado positivo sustentado por eventos pontuais, com baixa recorrência ao longo do período.`
                  : chartInterpretation}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO 3: Composição das Entradas (Barras Empilhadas) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Composição das Entradas
            </CardTitle>
            <CardDescription>
              Análise de dependência e risco por tipo de receita
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(217.2 91.2% 59.8%)" }} />
                <span className="text-muted-foreground">
                  Particular: {formatCurrency(periodStats.incomeParticular)} ({periodStats.particularPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(262.1 83.3% 57.8%)" }} />
                <span className="text-muted-foreground">
                  Convênios: {formatCurrency(periodStats.incomeConvenio)} ({periodStats.convenioPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip content={<CompositionTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="incomeParticular" 
                    name="Particular" 
                    stackId="income"
                    fill="hsl(217.2 91.2% 59.8%)" 
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="incomeConvenio" 
                    name="Convênios" 
                    stackId="income"
                    fill="hsl(262.1 83.3% 57.8%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Leitura estratégica */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm">
                <span className="font-medium text-foreground">Leitura estratégica: </span>
                {periodStats.particularPercentage > 80 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Alta dependência de Particular ({periodStats.particularPercentage.toFixed(0)}%). Fluxo imediato, mas sensível a sazonalidade e demanda.
                  </span>
                ) : periodStats.convenioPercentage > 80 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Alta dependência de Convênios ({periodStats.convenioPercentage.toFixed(0)}%). Receita previsível, mas com risco de prazo de recebimento.
                  </span>
                ) : periodStats.particularPercentage > 60 ? (
                  <span className="text-muted-foreground">
                    Predominância Particular ({periodStats.particularPercentage.toFixed(0)}%) com diversificação moderada.
                  </span>
                ) : periodStats.convenioPercentage > 60 ? (
                  <span className="text-muted-foreground">
                    Predominância de Convênios ({periodStats.convenioPercentage.toFixed(0)}%) — atenção ao fluxo de curto prazo.
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Boa diversificação entre Particular e Convênios — menor risco de dependência.
                  </span>
                )}
              </p>
              {/* Alerta adicional para dependência de receita particular */}
              {periodStats.particularPercentage > 70 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-medium">Risco de escassez:</span> Se o fluxo particular não seguir conforme previsto, pode haver impacto direto no caixa. Considere diversificar fontes de receita.
                  </p>
                </div>
              )}
              {/* Conexão tipo de receita + risco temporal */}
              <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                <span className="font-medium">Risco temporal: </span>
                {periodStats.convenioPercentage > 50 
                  ? `Convênios representam ${periodStats.convenioPercentage.toFixed(0)}% da receita — prazo médio de recebimento pode impactar fluxo de curto prazo.`
                  : periodStats.particularPercentage > 50 && smartSummary.concentrationPercentage > 50
                  ? `Particular concentrado em poucos ${period === "month" ? "dias" : "períodos"} — risco de gaps de caixa entre eventos.`
                  : "Composição e distribuição temporal equilibradas — baixo risco de gaps."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Comportamento por Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Comportamento por Período
            </CardTitle>
            <CardDescription>
              Visão de regularidade e status — não conferência contábil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 text-left font-medium text-muted-foreground">
                      {period === "month" ? "Dia" : "Mês"}
                    </th>
                    <th className="py-3 text-center font-medium text-muted-foreground w-24">Status</th>
                    <th className="py-3 text-right font-medium text-muted-foreground">Entradas</th>
                    <th className="py-3 text-right font-medium text-muted-foreground">Saldo</th>
                    <th className="py-3 text-center font-medium text-muted-foreground">Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, index) => {
                    const hasMovement = row.income > 0 || row.expense > 0;
                    const dayPercentage = periodStats.income > 0 ? (row.income / periodStats.income) * 100 : 0;
                    const isCritical = dayPercentage > 30;
                    
                    // Status binário: Sem movimento | Regular | Crítico
                    const getStatus = () => {
                      if (!hasMovement) return { label: "Sem movimento", level: "none" as const };
                      if (isCritical) return { label: "🔴 Crítico", level: "critical" as const };
                      return { label: "🟢 Regular", level: "regular" as const };
                    };
                    const status = getStatus();
                    
                    return (
                      <tr 
                        key={index} 
                        className={cn(
                          "border-b last:border-0 transition-colors",
                          status.level === "critical" && "bg-rose-50/50 dark:bg-rose-950/20",
                          status.level === "regular" && "bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/50",
                          status.level === "none" && "opacity-40"
                        )}
                      >
                        <td className="py-3 capitalize font-medium">{row.labelFull}</td>
                        <td className="py-3 text-center">
                          {status.level === "critical" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded-full font-medium">
                              {status.label}
                            </span>
                          ) : status.level === "regular" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-medium">
                              {status.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{status.label}</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-emerald-600">{formatCurrency(row.income)}</td>
                        <td className={`py-3 text-right font-semibold ${row.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="py-3 text-center">
                          {hasMovement ? (
                            <span className={cn(
                              "text-xs font-medium",
                              dayPercentage > 50 ? "text-rose-600" : dayPercentage > 30 ? "text-amber-600" : "text-muted-foreground"
                            )}>
                              {dayPercentage.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="py-3">Total</td>
                    <td className="py-3 text-center">
                      <span className="text-xs text-muted-foreground">{smartSummary.daysWithMovement} ativos</span>
                    </td>
                    <td className="py-3 text-right text-emerald-600">{formatCurrency(periodStats.income)}</td>
                    <td className={`py-3 text-right ${periodStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(periodStats.balance)}
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-xs text-muted-foreground">100%</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Legenda de status com hierarquia visual */}
            <div className="mt-4 pt-3 border-t space-y-3">
              <div className="flex flex-wrap gap-6 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                  🟢 {smartSummary.daysWithMovement - smartSummary.criticalDays} regulares
                </span>
                <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                  🔴 {smartSummary.criticalDays} críticos
                </span>
                <span className="text-muted-foreground">
                  {smartSummary.daysWithoutMovement} sem movimento
                </span>
              </div>
              {/* Explicação adicional sobre dias sem movimento */}
              {smartSummary.daysWithoutMovement > 0 && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  <span className="font-medium">Sobre dias sem movimento:</span> São previsíveis em operações regulares, mas merecem atenção no planejamento para evitar falhas de fluxo. {smartSummary.daysWithoutMovement > smartSummary.daysWithMovement && "Considere expandir dias de faturamento para maior regularidade."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ============= BLOCO: PRÓXIMA MELHOR AÇÃO ============= */}
        {nextBestActions.length > 0 && (
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Próxima Melhor Ação
              </CardTitle>
              <CardDescription>
                Recomendações práticas para redução de risco no próximo período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nextBestActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    {action.icon === "target" && <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    {action.icon === "calendar" && <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    {action.icon === "shield" && <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    {action.icon === "zap" && <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    <p className="text-sm text-foreground">{action.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
