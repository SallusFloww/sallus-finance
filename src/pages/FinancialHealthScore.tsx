import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { useDRE } from "@/hooks/useDRE";
import { useConsistencyCheck } from "@/hooks/useConsistencyCheck";
import { ConsistencyBadge } from "@/components/dashboard/ConsistencyBadge";
import { formatCurrency } from "@/utils/formatters";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Shield,
  Info,
  AlertCircle,
  Target,
  Zap,
  Search,
  ExternalLink,
  Check,
  X,
  Filter,
  Stethoscope,
  History
} from "lucide-react";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  eachMonthOfInterval,
  subMonths,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ExecutiveScoreboard } from "@/components/dashboard/ExecutiveScoreboard";
import { CLevelScoreboard } from "@/components/dashboard/CLevelScoreboard";
import { AnnualScoreboard } from "@/components/dashboard/AnnualScoreboard";
import { HealthProjection } from "@/components/dashboard/HealthProjection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StrategicScenarios, type ScenarioId } from "@/components/dashboard/StrategicScenarios";
import { IntelligentEarlyWarning } from "@/components/dashboard/IntelligentEarlyWarning";
import { SpecialtyRanking } from "@/components/dashboard/SpecialtyRanking";
import { UnitWeightsBreakdown } from "@/components/dashboard/UnitWeightsBreakdown";
import { ScoreHistory } from "@/components/dashboard/ScoreHistory";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useWeightedScore } from "@/hooks/useWeightedScore";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import { useMaturityAlerts } from "@/hooks/useMaturityAlerts";
import { useNextBestAction } from "@/hooks/useNextBestAction";
import { MaturityAlertsSummary } from "@/components/dashboard/MaturityAlerts";
import { NextBestActionsSummary } from "@/components/dashboard/NextBestActionCard";

interface ScoreComponent {
  name: string;
  weight: number;
  value: number;
  score: number;
  maxScore: number;
  description: string;
  status: "positive" | "neutral" | "negative";
}

interface MonthScore {
  month: Date;
  label: string;
  score: number | null;
  isEligible: boolean;
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
}

interface ActiveRisk {
  name: string;
  severity: "high" | "medium" | "low";
  impact: number;
  description: string;
}

export default function FinancialHealthScore() {
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");

  // Get Centro Clínico unit and its active specialties
  const centroClinicoUnit = settings.units.find(u => u.id === "CENTRO_CLINICO");
  const activeSpecialties = centroClinicoUnit?.specialties?.filter(s => s.active) || [];
  const showSpecialtyFilter = selectedUnit === "CENTRO_CLINICO" && activeSpecialties.length > 0;
  const selectedSpecialtyName = activeSpecialties.find(s => s.id === selectedSpecialty)?.name;

  // Calculate weighted global score
  const weightedScoreData = useWeightedScore(transactions, settings);
  
  // Calculate historical score data
  const scoreHistoryData = useScoreHistory(transactions, settings);
  
  // Calculate maturity alerts
  const maturityAlerts = useMaturityAlerts(scoreHistoryData);
  
  // Calculate next best actions
  const nextBestActions = useNextBestAction(
    weightedScoreData.unitScores,
    scoreHistoryData.unitMaturityHistory
  );

  // Get DRE data for consistency check
  const { calculateDRE } = useDRE();
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  
  const dreData = useMemo(() => 
    calculateDRE(currentMonthStart, currentMonthEnd, selectedUnit === "all" ? undefined : selectedUnit),
    [calculateDRE, currentMonthStart, currentMonthEnd, selectedUnit]
  );

  // Consistency check
  const consistencyResult = useConsistencyCheck({
    transactions,
    settings,
    dreData,
    periodStart: currentMonthStart,
    periodEnd: currentMonthEnd,
    unitFilter: selectedUnit
  });

  const scoreData = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const totalDays = currentMonthEnd.getDate();
    const currentPeriodLabel = format(now, "MMMM/yyyy", { locale: ptBR });

    // Filter transactions by unit and specialty if selected
    const baseTransactions = transactions.filter(t => {
      if (selectedUnit !== "all" && t.unit !== selectedUnit) return false;
      if (selectedUnit === "CENTRO_CLINICO" && selectedSpecialty !== "all" && t.specialty !== selectedSpecialty) return false;
      return true;
    });

    // Transações do mês atual
    const currentMonthTransactions = baseTransactions.filter((t) => {
      const tDate = parseISO(t.date);
      return tDate >= currentMonthStart && tDate <= currentMonthEnd;
    });

    // Calcular métricas do mês atual
    const income = currentMonthTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = currentMonthTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    // Dias ativos
    const daysWithMovement = new Set(
      currentMonthTransactions.map((t) => format(parseISO(t.date), "yyyy-MM-dd"))
    ).size;

    // Recorrência
    const recurrenceIndex = totalDays > 0 ? (daysWithMovement / totalDays) * 100 : 0;

    // Concentração
    const dailyIncomes: Record<string, number> = {};
    currentMonthTransactions
      .filter((t) => t.type === "INCOME")
      .forEach((t) => {
        const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
        dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
      });

    const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
    const concentrationPercentage = income > 0 ? (maxDayIncome / income) * 100 : 0;

    // Mix de receitas
    const incomeParticular = currentMonthTransactions
      .filter((t) => t.type === "INCOME" && t.receiptType === "PARTICULAR")
      .reduce((sum, t) => sum + t.amount, 0);

    const incomeConvenio = currentMonthTransactions
      .filter((t) => t.type === "INCOME" && t.receiptType === "CONVENIO")
      .reduce((sum, t) => sum + t.amount, 0);

    const particularPercentage = income > 0 ? (incomeParticular / income) * 100 : 0;
    const convenioPercentage = income > 0 ? (incomeConvenio / income) * 100 : 0;

    // Calcular histórico para tendência
    const monthsInterval = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: subMonths(startOfMonth(now), 1) // Não incluir mês atual
    });

    const historicalData = monthsInterval.map((monthDate) => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const mTotalDays = monthEnd.getDate();

      // Apply same filters for historical data
      const monthTransactions = baseTransactions.filter((t) => {
        const tDate = parseISO(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
      });

      const mIncome = monthTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const mExpense = monthTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      const mDaysActive = new Set(
        monthTransactions.map((t) => format(parseISO(t.date), "yyyy-MM-dd"))
      ).size;

      const mRecurrence = mTotalDays > 0 ? (mDaysActive / mTotalDays) * 100 : 0;
      const hasData = mIncome > 0 || mExpense > 0;
      const isValid = hasData && (mDaysActive >= 5 || mRecurrence >= 20);

      return {
        month: monthDate,
        income: mIncome,
        expense: mExpense,
        balance: mIncome - mExpense,
        daysActive: mDaysActive,
        recurrence: mRecurrence,
        isValid,
        hasData
      };
    });

    // Contar meses válidos
    const validMonths = historicalData.filter(m => m.isValid).length;

    // Verificar elegibilidade do mês atual
    // Score SÓ pode ser calculado se PELO MENOS UM critério for atendido
    const hasData = income > 0 || expense > 0;
    const meetsActivityCriteria = daysWithMovement >= 5 || recurrenceIndex >= 20;
    const isEligible = hasData && meetsActivityCriteria;
    const hasLowConfidence = validMonths < 3;

    // Calcular componentes do score (mesmo sem elegibilidade para mostrar diagnóstico)
    let regularityScore = 0;
    let recurrenceScore = 0;
    let concentrationScore = 0;
    let trendScore = 0;

    // A) REGULARIDADE — peso 30
    if (daysWithMovement >= 15) regularityScore = 30;
    else if (daysWithMovement >= 10) regularityScore = 24;
    else if (daysWithMovement >= 5) regularityScore = 18;
    else if (daysWithMovement >= 3) regularityScore = 10;
    else regularityScore = 0;

    // B) RECORRÊNCIA — peso 25
    if (recurrenceIndex >= 40) recurrenceScore = 25;
    else if (recurrenceIndex >= 30) recurrenceScore = 20;
    else if (recurrenceIndex >= 20) recurrenceScore = 15;
    else if (recurrenceIndex >= 10) recurrenceScore = 5;
    else recurrenceScore = 0;

    // C) CONCENTRAÇÃO — peso 25 (inverso)
    if (concentrationPercentage <= 25) concentrationScore = 25;
    else if (concentrationPercentage <= 40) concentrationScore = 18;
    else if (concentrationPercentage <= 60) concentrationScore = 10;
    else if (concentrationPercentage <= 80) concentrationScore = 5;
    else concentrationScore = 0;

    // D) TENDÊNCIA HISTÓRICA — peso 20
    const recentValidMonths = historicalData.filter(m => m.isValid).slice(-3);
    if (recentValidMonths.length >= 3) {
      // Avaliar tendência nos últimos 3 meses válidos
      const balances = recentValidMonths.map(m => m.balance);
      const improvements = balances.slice(1).filter((b, i) => b > balances[i]).length;
      const declines = balances.slice(1).filter((b, i) => b < balances[i] * 0.9).length;
      
      if (improvements >= 2 || (improvements >= 1 && declines === 0)) {
        trendScore = 20; // Tendência estável ou melhoria
      } else if (declines <= 1 && improvements >= 0) {
        trendScore = 14; // Oscilação controlada
      } else {
        trendScore = 7; // Instabilidade recorrente
      }
    } else if (recentValidMonths.length >= 2) {
      // Base parcial - avaliar com dados disponíveis
      const [prev, curr] = recentValidMonths.slice(-2);
      if (curr.balance >= prev.balance * 0.9) {
        trendScore = 14; // Oscilação controlada
      } else {
        trendScore = 7;
      }
    } else {
      trendScore = 0; // Base histórica insuficiente (<3 meses)
    }

    const totalScore = isEligible 
      ? Math.round(regularityScore + recurrenceScore + concentrationScore + trendScore)
      : 0;

    // Determinar status do score com nova classificação
    let scoreStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
    let scoreLabel: string;
    let scoreColor: string;
    let scoreEmoji: string;

    if (totalScore >= 85) {
      scoreStatus = "excellent";
      scoreLabel = "Excelente";
      scoreColor = "text-green-600";
      scoreEmoji = "🟢";
    } else if (totalScore >= 70) {
      scoreStatus = "healthy";
      scoreLabel = "Saudável";
      scoreColor = "text-green-600";
      scoreEmoji = "🟢";
    } else if (totalScore >= 55) {
      scoreStatus = "attention";
      scoreLabel = "Atenção";
      scoreColor = "text-yellow-600";
      scoreEmoji = "🟡";
    } else if (totalScore >= 40) {
      scoreStatus = "risk";
      scoreLabel = "Risco";
      scoreColor = "text-orange-600";
      scoreEmoji = "🟠";
    } else {
      scoreStatus = "critical";
      scoreLabel = "Crítico";
      scoreColor = "text-red-600";
      scoreEmoji = "🔴";
    }

    // Componentes detalhados
    const components: ScoreComponent[] = [
      {
        name: "Regularidade",
        weight: 30,
        value: daysWithMovement,
        score: regularityScore,
        maxScore: 30,
        description: `${daysWithMovement} dias ativos no mês`,
        status: regularityScore >= 24 ? "positive" : regularityScore >= 18 ? "neutral" : "negative"
      },
      {
        name: "Recorrência",
        weight: 25,
        value: recurrenceIndex,
        score: recurrenceScore,
        maxScore: 25,
        description: `${recurrenceIndex.toFixed(1)}% de recorrência`,
        status: recurrenceScore >= 20 ? "positive" : recurrenceScore >= 15 ? "neutral" : "negative"
      },
      {
        name: "Concentração",
        weight: 25,
        value: concentrationPercentage,
        score: concentrationScore,
        maxScore: 25,
        description: `${concentrationPercentage.toFixed(1)}% concentração máxima`,
        status: concentrationScore >= 18 ? "positive" : concentrationScore >= 10 ? "neutral" : "negative"
      },
      {
        name: "Tendência Histórica",
        weight: 20,
        value: validMonths,
        score: trendScore,
        maxScore: 20,
        description: validMonths >= 3 
          ? `Baseado em ${validMonths} meses válidos` 
          : `Base insuficiente (${validMonths}/3 meses)`,
        status: trendScore >= 14 ? "positive" : trendScore >= 7 ? "neutral" : "negative"
      }
    ];

    // Encontrar o menor pilar para recomendação principal
    const lowestComponent = [...components].sort((a, b) => 
      (a.score / a.maxScore) - (b.score / b.maxScore)
    )[0];

    // Fatores positivos e negativos
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    if (regularityScore >= 22.5) positiveFactors.push("Boa regularidade de movimentações");
    else if (regularityScore < 15) negativeFactors.push("Poucos dias ativos no mês");

    if (recurrenceScore >= 20) positiveFactors.push("Recorrência adequada");
    else if (recurrenceScore < 15) negativeFactors.push("Baixa recorrência de movimentações");

    if (concentrationScore >= 18) positiveFactors.push("Boa distribuição de receitas");
    else if (concentrationScore < 10) negativeFactors.push("Alta concentração em poucos dias");

    if (trendScore >= 14) positiveFactors.push("Tendência histórica positiva");
    else if (trendScore < 7) negativeFactors.push("Base histórica insuficiente");

    if (balance > 0) positiveFactors.push("Resultado positivo no período");
    else if (balance < 0) negativeFactors.push("Resultado deficitário no período");

    // Gerar recomendação principal baseada no menor pilar
    // Linguagem consultiva, objetiva, sem alarmismo
    let primaryRecommendation = "";
    let limitingFactor = "";
    if (lowestComponent.name === "Regularidade") {
      limitingFactor = "Baixa regularidade de movimentações no período analisado.";
      primaryRecommendation = "Aumentar regularidade mensal";
    } else if (lowestComponent.name === "Recorrência") {
      limitingFactor = "Baixa recorrência operacional no período analisado.";
      primaryRecommendation = "Estimular continuidade de faturamento";
    } else if (lowestComponent.name === "Concentração") {
      limitingFactor = "Alta concentração de receitas em poucos dias.";
      primaryRecommendation = "Reduzir oscilações entre períodos";
    } else {
      limitingFactor = "Base histórica em formação.";
      primaryRecommendation = "Manter operação estável para consolidar histórico";
    }

    // Leitura executiva com subtexto explicativo
    let executiveReading: string;
    let executiveSubtext: string = "";
    
    if (!isEligible) {
      executiveReading = "Score em formação";
      executiveSubtext = "Baseado no comportamento operacional do período atual. Resultados consolidados ao final do ciclo mensal.";
    } else {
      // Gerar subtexto explicativo curto
      const mainPositive = positiveFactors[0] || "";
      const mainNegative = negativeFactors[0] || "";
      
      if (scoreStatus === "excellent" || scoreStatus === "healthy") {
        executiveReading = `Score ${totalScore} — ${scoreLabel}`;
        executiveSubtext = mainPositive 
          ? `${mainPositive}${mainNegative ? `, porém ${mainNegative.toLowerCase()}` : ""}.`
          : "Operação com boa previsibilidade e regularidade.";
      } else if (scoreStatus === "attention") {
        executiveReading = `Score ${totalScore} — ${scoreLabel}`;
        executiveSubtext = mainNegative 
          ? `${mainNegative}${mainPositive ? `, apesar de ${mainPositive.toLowerCase()}` : ""}.`
          : "Operação requer atenção em alguns indicadores.";
      } else if (scoreStatus === "risk") {
        executiveReading = `Score ${totalScore} — ${scoreLabel}`;
        executiveSubtext = mainPositive
          ? `${mainPositive}, porém com ${mainNegative ? mainNegative.toLowerCase() : "baixa previsibilidade"}.`
          : `${mainNegative || "Operação com indicadores abaixo do ideal"}.`;
      } else {
        executiveReading = `Score ${totalScore} — ${scoreLabel}`;
        executiveSubtext = `${mainNegative || "Indicadores críticos identificados"}. Ação imediata recomendada.`;
      }
    }

    // Histórico de scores com nova classificação
    const scoreHistory: MonthScore[] = historicalData.slice(-6).map(m => {
      if (!m.isValid) {
        return {
          month: m.month,
          label: format(m.month, "MMM/yy", { locale: ptBR }),
          score: null,
          isEligible: false,
          status: "ineligible" as const
        };
      }

      // Calcular score com novas regras
      const mRegularity = m.daysActive >= 15 ? 30 : m.daysActive >= 10 ? 24 : m.daysActive >= 5 ? 18 : m.daysActive >= 3 ? 10 : 0;
      const mRecurrence = m.recurrence >= 40 ? 25 : m.recurrence >= 30 ? 20 : m.recurrence >= 20 ? 15 : m.recurrence >= 10 ? 5 : 0;
      const mConcentration = 12; // Estimativa média
      const mTrend = 10; // Neutro para simplificar
      const mScore = Math.round(mRegularity + mRecurrence + mConcentration + mTrend);

      let mStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
      if (mScore >= 85) mStatus = "excellent";
      else if (mScore >= 70) mStatus = "healthy";
      else if (mScore >= 55) mStatus = "attention";
      else if (mScore >= 40) mStatus = "risk";
      else mStatus = "critical";

      return {
        month: m.month,
        label: format(m.month, "MMM/yy", { locale: ptBR }),
        score: mScore,
        isEligible: true,
        status: mStatus
      };
    });

    // Dados anuais para o Scoreboard Anual
    const annualMonthsData = historicalData.map(m => {
      if (!m.isValid) {
        return {
          score: null,
          isEligible: false,
          status: "ineligible" as const,
          daysActive: m.daysActive,
          recurrence: m.recurrence,
          concentration: 50 // Valor padrão
        };
      }

      const mRegularity = m.daysActive >= 15 ? 30 : m.daysActive >= 10 ? 24 : m.daysActive >= 5 ? 18 : m.daysActive >= 3 ? 10 : 0;
      const mRecurrenceScore = m.recurrence >= 40 ? 25 : m.recurrence >= 30 ? 20 : m.recurrence >= 20 ? 15 : m.recurrence >= 10 ? 5 : 0;
      const mConcentration = 12;
      const mTrend = 10;
      const mScore = Math.round(mRegularity + mRecurrenceScore + mConcentration + mTrend);

      let mStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
      if (mScore >= 85) mStatus = "excellent";
      else if (mScore >= 70) mStatus = "healthy";
      else if (mScore >= 55) mStatus = "attention";
      else if (mScore >= 40) mStatus = "risk";
      else mStatus = "critical";

      // Estimar concentração (simplificado - baseado na receita)
      const estimatedConcentration = m.income > 0 ? Math.min(100, (m.income / m.daysActive) / m.income * 100 * m.daysActive / 30) : 50;

      return {
        score: mScore,
        isEligible: true,
        status: mStatus,
        daysActive: m.daysActive,
        recurrence: m.recurrence,
        concentration: estimatedConcentration
      };
    });

    // Determinar tendência
    const eligibleScores = scoreHistory.filter(s => s.isEligible && s.score !== null);
    let trend: "improving" | "stable" | "declining" = "stable";
    if (eligibleScores.length >= 2) {
      const recent = eligibleScores.slice(-2);
      if (recent[1].score! > recent[0].score! + 5) trend = "improving";
      else if (recent[1].score! < recent[0].score! - 5) trend = "declining";
    }

    // Riscos ativos
    const activeRisks: ActiveRisk[] = [];
    if (concentrationPercentage > 70) {
      activeRisks.push({
        name: "Concentração Crítica",
        severity: concentrationPercentage > 90 ? "high" : "medium",
        impact: concentrationPercentage > 90 ? 25 : 12.5,
        description: `${concentrationPercentage.toFixed(0)}% da receita concentrada em um único dia`
      });
    }
    if (recurrenceIndex < 30) {
      activeRisks.push({
        name: "Baixa Recorrência",
        severity: recurrenceIndex < 20 ? "high" : "medium",
        impact: recurrenceIndex < 20 ? 20 : 10,
        description: `Apenas ${recurrenceIndex.toFixed(0)}% de recorrência no período`
      });
    }
    if (convenioPercentage > 70) {
      activeRisks.push({
        name: "Dependência de Convênios",
        severity: convenioPercentage > 85 ? "high" : "medium",
        impact: 10,
        description: `${convenioPercentage.toFixed(0)}% da receita vem de convênios`
      });
    }
    if (daysWithMovement < 10) {
      activeRisks.push({
        name: "Irregularidade de Fluxo",
        severity: daysWithMovement < 5 ? "high" : "medium",
        impact: daysWithMovement < 5 ? 22.5 : 15,
        description: `Apenas ${daysWithMovement} dias com movimentação no mês`
      });
    }

    // Próximas ações
    const nextActions: string[] = [];
    if (concentrationPercentage > 70) {
      nextActions.push(`Distribuir faturamento em pelo menos 5 dias no próximo mês para elevar o componente de regularidade do score.`);
    }
    if (recurrenceIndex < 30) {
      nextActions.push(`Aumentar frequência de agendamentos para atingir mínimo de ${Math.ceil(totalDays * 0.4)} dias ativos.`);
    }
    if (daysWithMovement < 10 && !nextActions.some(a => a.includes("dias ativos"))) {
      nextActions.push(`Buscar distribuir movimentações ao longo do mês para melhorar previsibilidade.`);
    }
    if (nextActions.length === 0 && isEligible) {
      nextActions.push("Manter padrão atual e monitorar evolução mensal do Score.");
    }

    // O que falta para elegibilidade
    const eligibilityGaps: string[] = [];
    if (!hasData) {
      eligibilityGaps.push("Registrar movimentações no período");
    }
    if (hasData && daysWithMovement < 5 && recurrenceIndex < 20) {
      eligibilityGaps.push(`Aumentar dias ativos para pelo menos 5 (atual: ${daysWithMovement})`);
      eligibilityGaps.push(`Ou atingir 20% de recorrência (atual: ${recurrenceIndex.toFixed(1)}%)`);
    }
    if (validMonths < 3) {
      eligibilityGaps.push(`Acumular ${3 - validMonths} mês(es) válido(s) adicional(is) no histórico`);
    }

    return {
      isEligible,
      hasData,
      meetsActivityCriteria,
      hasLowConfidence,
      validMonths,
      totalScore,
      scoreStatus,
      scoreLabel,
      scoreColor,
      scoreEmoji,
      components,
      positiveFactors,
      negativeFactors,
      executiveReading,
      executiveSubtext,
      primaryRecommendation,
      lowestComponent,
      scoreHistory,
      annualMonthsData,
      currentYear: format(now, "yyyy"),
      trend,
      activeRisks,
      nextActions,
      eligibilityGaps,
      currentMonth: format(now, "MMMM 'de' yyyy", { locale: ptBR }),
      currentPeriodLabel,
      metrics: {
        income,
        expense,
        balance,
        daysWithMovement,
        recurrenceIndex,
        concentrationPercentage,
        particularPercentage,
        convenioPercentage
      }
    };
  }, [transactions, selectedUnit, selectedSpecialty]);

  const getTrendIcon = () => {
    if (scoreData.trend === "improving") return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (scoreData.trend === "declining") return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendLabel = () => {
    if (scoreData.trend === "improving") return "Melhorando";
    if (scoreData.trend === "declining") return "Piorando";
    return "Estável";
  };

  const getScoreStatusBadge = (status: string) => {
    switch (status) {
      case "excellent":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">🟢 Excelente</Badge>;
      case "healthy":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">🟢 Saudável</Badge>;
      case "attention":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">🟡 Atenção</Badge>;
      case "risk":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">🟠 Risco</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">🔴 Crítico</Badge>;
      default:
        return <Badge variant="outline">⚪ Não elegível</Badge>;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-red-600";
      case "medium": return "text-yellow-600";
      default: return "text-blue-600";
    }
  };

  // Calcular critérios atendidos (agora apenas 2 - elegibilidade simplificada)
  const metCriteriaList = [
    scoreData.metrics.daysWithMovement >= 5 || scoreData.metrics.recurrenceIndex >= 20
  ];
  const eligibilityCriteriaMet = metCriteriaList[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Score Operacional do Mês</h1>
            <p className="text-muted-foreground">
              Avaliação do desempenho financeiro do período atual, considerando recorrência, faturamento e comportamento de caixa.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 italic">
              🧭 Como está a operação este mês?
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <ConsistencyBadge result={consistencyResult} />
            
            <Select value={selectedUnit} onValueChange={(value) => {
              setSelectedUnit(value);
              // Reset specialty when changing unit
              if (value !== "CENTRO_CLINICO") {
                setSelectedSpecialty("all");
              }
            }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {settings.units.filter(u => u.active).map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Specialty filter - only for Centro Clínico */}
            {showSpecialtyFilter && (
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger className="w-[180px]">
                  <Stethoscope className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas especialidades</SelectItem>
                  {activeSpecialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Filter indicator */}
        {(selectedUnit !== "all" || selectedSpecialty !== "all") && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Filter className="h-3 w-3 mr-1" />
              Visão Analítica
            </Badge>
            <span className="text-muted-foreground">
              Score filtrado por: {selectedUnit !== "all" ? settings.units.find(u => u.id === selectedUnit)?.name : "Todas unidades"}
              {selectedSpecialty !== "all" && selectedSpecialtyName && ` → ${selectedSpecialtyName}`}
            </span>
          </div>
        )}

        {/* Tabs para C-Level, Operacional e Histórico */}
        <Tabs defaultValue="c-level" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="c-level" className="flex items-center gap-2">
              <span>👔</span> Visão C-Level
            </TabsTrigger>
            <TabsTrigger value="operacional" className="flex items-center gap-2">
              <span>📊</span> Visão Operacional
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* TAB C-LEVEL: Scoreboard Global para Conselho/Diretoria */}
          <TabsContent value="c-level" className="space-y-6">
            {/* Maturity Alerts Summary */}
            <MaturityAlertsSummary data={maturityAlerts} />
            
            {/* Next Best Actions Summary */}
            <NextBestActionsSummary data={nextBestActions} />
            
            {/* Use weighted global score when viewing all units */}
            {selectedUnit === "all" ? (
              <>
                <CLevelScoreboard
                  isEligible={weightedScoreData.isEligible}
                  hasData={weightedScoreData.unitScores.some(u => u.income > 0)}
                  totalScore={weightedScoreData.globalScore}
                  scoreStatus={weightedScoreData.globalStatus === "ineligible" ? "critical" : weightedScoreData.globalStatus}
                  scoreLabel={weightedScoreData.globalLabel}
                  scoreEmoji={
                    weightedScoreData.globalStatus === "excellent" || weightedScoreData.globalStatus === "healthy" ? "🟢" :
                    weightedScoreData.globalStatus === "attention" ? "🟡" :
                    weightedScoreData.globalStatus === "risk" ? "🟠" : "🔴"
                  }
                  validMonths={scoreData.validMonths}
                  trend={scoreData.trend}
                  scoreHistory={scoreData.scoreHistory}
                  lowestComponent={scoreData.lowestComponent}
                  primaryRecommendation={scoreData.primaryRecommendation}
                  currentPeriod={scoreData.currentPeriodLabel.charAt(0).toUpperCase() + scoreData.currentPeriodLabel.slice(1)}
                  metrics={{
                    daysWithMovement: scoreData.metrics.daysWithMovement,
                    recurrenceIndex: scoreData.metrics.recurrenceIndex,
                    concentrationPercentage: scoreData.metrics.concentrationPercentage
                  }}
                  isWeightedGlobal={true}
                  weightedExplanation={weightedScoreData.explanation}
                />
                
                {/* COMPOSIÇÃO DO SCORE GLOBAL - Only when viewing all units */}
                <UnitWeightsBreakdown
                  globalScore={weightedScoreData.globalScore}
                  globalStatus={weightedScoreData.globalStatus}
                  globalLabel={weightedScoreData.globalLabel}
                  isEligible={weightedScoreData.isEligible}
                  unitScores={weightedScoreData.unitScores}
                  centroClinicoSpecialties={weightedScoreData.centroClinicoSpecialties}
                  explanation={weightedScoreData.explanation}
                  actionsByUnit={nextBestActions.actionsByUnit}
                />
              </>
            ) : (
              <CLevelScoreboard
                isEligible={scoreData.isEligible}
                hasData={scoreData.hasData}
                totalScore={scoreData.totalScore}
                scoreStatus={scoreData.scoreStatus}
                scoreLabel={scoreData.scoreLabel}
                scoreEmoji={scoreData.scoreEmoji}
                validMonths={scoreData.validMonths}
                trend={scoreData.trend}
                scoreHistory={scoreData.scoreHistory}
                lowestComponent={scoreData.lowestComponent}
                primaryRecommendation={scoreData.primaryRecommendation}
                currentPeriod={scoreData.currentPeriodLabel.charAt(0).toUpperCase() + scoreData.currentPeriodLabel.slice(1)}
                metrics={{
                  daysWithMovement: scoreData.metrics.daysWithMovement,
                  recurrenceIndex: scoreData.metrics.recurrenceIndex,
                  concentrationPercentage: scoreData.metrics.concentrationPercentage
                }}
              />
            )}

            {/* RANKING COMPARATIVO DE ESPECIALIDADES - Centro Clínico */}
            {centroClinicoUnit && activeSpecialties.length > 0 && (
              <SpecialtyRanking
                transactions={transactions}
                specialties={activeSpecialties}
              />
            )}

            {/* SCOREBOARD GLOBAL ANUAL */}
            <AnnualScoreboard
              monthsData={scoreData.annualMonthsData}
              currentYear={scoreData.currentYear}
            />

            {/* CENÁRIOS ESTRATÉGICOS */}
            <StrategicScenarios
              lowestComponent={scoreData.lowestComponent}
              primaryRecommendation={scoreData.primaryRecommendation}
              trend={scoreData.trend}
              scoreStatus={scoreData.scoreStatus}
              metrics={{
                daysActive: scoreData.metrics.daysWithMovement,
                recurrence: scoreData.metrics.recurrenceIndex,
                concentration: scoreData.metrics.concentrationPercentage
              }}
              validMonths={scoreData.validMonths}
              currentYear={scoreData.currentYear}
              activeScenario={activeScenario}
              onScenarioChange={setActiveScenario}
            />

            {/* PROJEÇÃO DE SAÚDE FINANCEIRA */}
            <HealthProjection
              monthsData={scoreData.annualMonthsData.map(m => ({
                daysActive: m.daysActive,
                recurrence: m.recurrence,
                concentration: m.concentration,
                isValid: m.isEligible
              }))}
              currentYear={scoreData.currentYear}
              activeScenario={activeScenario}
            />

            {/* EARLY WARNING SYSTEM INTELIGENTE */}
            <IntelligentEarlyWarning
              monthsData={scoreData.annualMonthsData.map(m => ({
                daysActive: m.daysActive,
                recurrence: m.recurrence,
                concentration: m.concentration,
                isValid: m.isEligible
              }))}
              trend={scoreData.trend}
              scoreStatus={scoreData.scoreStatus}
              currentYear={scoreData.currentYear}
            />
          </TabsContent>

          {/* TAB OPERACIONAL: Scoreboard Executivo detalhado */}
          <TabsContent value="operacional" className="space-y-6">
            <ExecutiveScoreboard
              isEligible={scoreData.isEligible}
              hasData={scoreData.hasData}
              totalScore={scoreData.totalScore}
              scoreStatus={scoreData.scoreStatus}
              scoreLabel={scoreData.scoreLabel}
              scoreColor={scoreData.scoreColor}
              scoreEmoji={scoreData.scoreEmoji}
              hasLowConfidence={scoreData.hasLowConfidence}
              validMonths={scoreData.validMonths}
              components={scoreData.components}
              lowestComponent={scoreData.lowestComponent}
              primaryRecommendation={scoreData.primaryRecommendation}
              executiveSubtext={scoreData.executiveSubtext}
              metrics={{
                daysWithMovement: scoreData.metrics.daysWithMovement,
                recurrenceIndex: scoreData.metrics.recurrenceIndex,
                balance: scoreData.metrics.balance
              }}
            />

            {/* Camada Explicativa - Colapsável */}
            <Collapsible defaultOpen={false}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">🔎 O que este score representa?</CardTitle>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-6 pt-0">
                    {/* A) Elegibilidade do Score */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Elegibilidade do Score
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <span className="text-sm">Dias ativos</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {scoreData.metrics.daysWithMovement} / 5
                            </span>
                            {scoreData.metrics.daysWithMovement >= 5 ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <span className="text-sm">Recorrência</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {scoreData.metrics.recurrenceIndex.toFixed(1)}% / 20%
                            </span>
                            {scoreData.metrics.recurrenceIndex >= 20 ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O Score só é calculado quando pelo menos um critério mínimo é atendido.
                      </p>
                    </div>

                    <Separator />

                    {/* B) Pontuação por Pilar */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Pontuação por Pilar
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {scoreData.components.map((component) => (
                          <div key={component.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="text-sm">{component.name}</span>
                            <span className={cn(
                              "text-sm font-medium",
                              component.status === "positive" && "text-green-600",
                              component.status === "neutral" && "text-yellow-600",
                              component.status === "negative" && "text-red-600"
                            )}>
                              {component.score} / {component.maxScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* C) Nota Metodológica */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-foreground leading-relaxed mb-2">
                        Este indicador avalia exclusivamente o <strong>desempenho operacional do período atual</strong>, considerando recorrência, ritmo de faturamento e consistência financeira.
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Ele não representa a saúde financeira total da empresa, que é analisada no <strong>Score Financeiro Geral</strong>. Não substitui relatórios contábeis ou demonstrações oficiais.
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Seções detalhadas - apenas quando elegível */}
            {scoreData.isEligible && (
              <>
                {/* 4. Comparativo Histórico */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Evolução Histórica do Score
                    </CardTitle>
                    <CardDescription>Últimos meses válidos para comparação</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-2 h-32">
                      {scoreData.scoreHistory.map((month, index) => (
                        <div key={index} className="flex flex-col items-center gap-1 flex-1">
                          <div className="relative w-full flex justify-center">
                            {month.isEligible && month.score !== null ? (
                              <div 
                                className={cn(
                                  "w-8 rounded-t transition-all",
                                  (month.status === "excellent" || month.status === "healthy") && "bg-green-500",
                                  month.status === "attention" && "bg-yellow-500",
                                  month.status === "risk" && "bg-orange-500",
                                  month.status === "critical" && "bg-red-500"
                                )}
                                style={{ height: `${(month.score / 100) * 80}px` }}
                              />
                            ) : (
                              <div className="w-8 h-4 bg-muted rounded" />
                            )}
                          </div>
                          <span className="text-xs font-medium">
                            {month.isEligible && month.score !== null ? month.score : "-"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{month.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                      <span className="text-sm text-muted-foreground">Tendência:</span>
                      <div className="flex items-center gap-1">
                        {getTrendIcon()}
                        <span className={cn(
                          "text-sm font-medium",
                          scoreData.trend === "improving" && "text-green-600",
                          scoreData.trend === "declining" && "text-red-600",
                          scoreData.trend === "stable" && "text-muted-foreground"
                        )}>
                          {getTrendLabel()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 5. Riscos e Alertas */}
                {scoreData.activeRisks.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Ações Recomendadas para Evolução do Score
                      </CardTitle>
                      <CardDescription>Fator limitante identificado e próximas ações</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {scoreData.activeRisks.map((risk, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <AlertTriangle className={cn("h-5 w-5 mt-0.5", getSeverityColor(risk.severity))} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{risk.name}</span>
                                <Badge variant="outline" className={cn(
                                  "text-xs",
                                  risk.severity === "high" && "border-red-300 text-red-700",
                                  risk.severity === "medium" && "border-yellow-300 text-yellow-700"
                                )}>
                                  Impacto: -{risk.impact.toFixed(1)} pts
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* TAB HISTÓRICO: Score History and Maturity Trends */}
          <TabsContent value="historico" className="space-y-6">
            <div className="mb-4">
              <p className="text-xs text-muted-foreground/70 italic">
                🧭 Como evoluímos ao longo do tempo?
              </p>
            </div>
            <ScoreHistory data={scoreHistoryData} />
          </TabsContent>
        </Tabs>

        {/* Rodapé - Nota de complementaridade */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                  Este score é complementar ao <strong>Score Financeiro Geral</strong> e não representa, isoladamente, a saúde financeira da organização.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Dados consolidados das abas Relatórios, Tendências e Histórico.
                </p>
              </div>
              <Link 
                to="/trends-history" 
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline whitespace-nowrap"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Histórico de Tendências
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
