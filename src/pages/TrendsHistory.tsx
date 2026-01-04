import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/utils/formatters";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Target,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  History,
  Lightbulb,
  AlertCircle
} from "lucide-react";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  eachMonthOfInterval,
  subMonths,
  parseISO,
  isSameMonth
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Vocabulário padronizado de riscos
type RiskTerm = "concentração" | "recorrência" | "regularidade" | "dependência" | "vulnerabilidade" | "previsibilidade";

// Status único por mês (3 níveis + base histórica)
type MonthStatus = "healthy" | "attention" | "critical" | "forming";

// Status das ações sugeridas
type ActionStatus = "planned" | "executing" | "executed" | "not_executed" | "pending";

// Flags para preparação do Score (interno, não exibido)
interface ScoreFlags {
  altaConcentracao: boolean;
  baixaRecorrencia: boolean;
  poucosDiasAtivos: boolean;
  predominioConvenios: boolean;
  predominioParticular: boolean;
  deficitario: boolean;
}

interface MonthlyTrendData {
  month: Date;
  label: string;
  labelShort: string;
  income: number;
  expense: number;
  balance: number;
  daysWithMovement: number;
  totalDays: number;
  recurrenceIndex: number;
  concentrationPercentage: number;
  maxDayIncome: number;
  particularPercentage: number;
  convenioPercentage: number;
  status: MonthStatus;
  statusLabel: string;
  statusEmoji: string;
  diagnosis: string;
  impact: string;
  nextBestAction: string;
  isEligibleForScore: boolean;
  scoreFlags: ScoreFlags;
  hasInsufficientData: boolean;
}

export default function TrendsHistory() {
  const { transactions: txContext } = useApp();
  const { transactions } = txContext;
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Calcular dados históricos por mês (últimos 12 meses)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const monthsInterval = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: startOfMonth(now)
    });

    return monthsInterval.map((monthDate): MonthlyTrendData => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const totalDays = monthEnd.getDate();

      // Filtrar transações do mês
      const monthTransactions = transactions.filter((t) => {
        const tDate = parseISO(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
      });

      // Calcular totais
      const income = monthTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = monthTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      const balance = income - expense;

      const incomeParticular = monthTransactions
        .filter((t) => t.type === "INCOME" && t.receiptType === "PARTICULAR")
        .reduce((sum, t) => sum + t.amount, 0);

      const incomeConvenio = monthTransactions
        .filter((t) => t.type === "INCOME" && t.receiptType === "CONVENIO")
        .reduce((sum, t) => sum + t.amount, 0);

      // Calcular dias com movimento
      const daysWithMovement = new Set(
        monthTransactions.map((t) => format(parseISO(t.date), "yyyy-MM-dd"))
      ).size;

      const recurrenceIndex = totalDays > 0 ? (daysWithMovement / totalDays) * 100 : 0;

      // Calcular concentração por dia
      const dailyIncomes: Record<string, number> = {};
      monthTransactions
        .filter((t) => t.type === "INCOME")
        .forEach((t) => {
          const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
          dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
        });

      const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
      const concentrationPercentage = income > 0 ? (maxDayIncome / income) * 100 : 0;

      const particularPercentage = income > 0 ? (incomeParticular / income) * 100 : 0;
      const convenioPercentage = income > 0 ? (incomeConvenio / income) * 100 : 0;

      // Flags para Score (preparação silenciosa - não exibido)
      const scoreFlags: ScoreFlags = {
        altaConcentracao: concentrationPercentage > 70,
        baixaRecorrencia: recurrenceIndex < 20,
        poucosDiasAtivos: daysWithMovement < 5,
        predominioConvenios: convenioPercentage > 70,
        predominioParticular: particularPercentage > 80,
        deficitario: balance < 0
      };

      // Verificar dados insuficientes (base histórica em formação)
      const hasInsufficientData = income === 0 && expense === 0;
      
      // Elegibilidade para Score: ≥5 dias ativos OU recorrência ≥20%
      const isEligibleForScore = !hasInsufficientData && (daysWithMovement >= 5 || recurrenceIndex >= 20);

      // Determinar status único (vocabulário fechado: 3 níveis + base histórica)
      let status: MonthStatus;
      let statusLabel: string;
      let statusEmoji: string;

      if (hasInsufficientData) {
        status = "forming";
        statusLabel = "Base histórica em formação";
        statusEmoji = "⚪";
      } else if (balance < 0 || (concentrationPercentage > 80 && recurrenceIndex < 15)) {
        status = "critical";
        statusLabel = "Crítico";
        statusEmoji = "🔴";
      } else if (concentrationPercentage > 50 || recurrenceIndex < 40 || particularPercentage > 80 || convenioPercentage > 70) {
        status = "attention";
        statusLabel = "Atenção";
        statusEmoji = "🟡";
      } else {
        status = "healthy";
        statusLabel = "Saudável";
        statusEmoji = "🟢";
      }

      // BLOCO A: Diagnóstico do Mês (fato objetivo)
      let diagnosis: string;
      if (hasInsufficientData) {
        diagnosis = "Dados insuficientes para análise do período.";
      } else {
        const diagnosticParts: string[] = [];
        
        if (balance < 0) {
          diagnosticParts.push(`Déficit de ${formatCurrency(Math.abs(balance))} no período`);
        } else {
          diagnosticParts.push(`Resultado positivo de ${formatCurrency(balance)}`);
        }
        
        if (concentrationPercentage >= 100) {
          diagnosticParts.push("100% do resultado concentrado em 1 dia");
        } else if (concentrationPercentage > 70) {
          diagnosticParts.push(`${concentrationPercentage.toFixed(0)}% do resultado concentrado em poucos dias`);
        }
        
        if (recurrenceIndex < 20) {
          diagnosticParts.push(`Baixa recorrência de movimentações (${recurrenceIndex.toFixed(0)}%)`);
        }
        
        if (particularPercentage > 80) {
          diagnosticParts.push(`Predominância de receita particular (${particularPercentage.toFixed(0)}%)`);
        } else if (convenioPercentage > 70) {
          diagnosticParts.push(`Predominância de convênios (${convenioPercentage.toFixed(0)}%)`);
        }
        
        diagnosis = diagnosticParts.join(". ") + ".";
      }

      // BLOCO B: Impacto Potencial (interpretação executiva)
      let impact: string;
      if (hasInsufficientData) {
        impact = "Impossível avaliar vulnerabilidade sem dados suficientes.";
      } else if (status === "critical") {
        impact = "Alta vulnerabilidade a falhas de fluxo. Risco de dependência de eventos pontuais com baixa previsibilidade.";
      } else if (status === "attention") {
        impact = "Atenção necessária para manter previsibilidade. Concentração ou dependência podem afetar estabilidade futura.";
      } else if (status === "forming") {
        impact = "Base histórica em construção. Aguardar mais dados para avaliação completa.";
      } else {
        impact = "Boa previsibilidade e regularidade. Fluxo apresenta estabilidade estrutural adequada.";
      }

      // Gerar próxima melhor ação
      let nextBestAction: string;
      if (hasInsufficientData) {
        nextBestAction = "Iniciar registro de movimentações para análise de tendências.";
      } else if (balance < 0) {
        nextBestAction = "Revisar despesas e buscar aumento de entradas.";
      } else if (concentrationPercentage > 70) {
        nextBestAction = "Diluir entradas ao longo do mês para reduzir dependência de eventos pontuais.";
      } else if (recurrenceIndex < 30) {
        nextBestAction = "Aumentar frequência de agendamentos para melhorar recorrência.";
      } else if (particularPercentage > 80) {
        nextBestAction = "Diversificar fontes de receita (convênios) para maior estabilidade.";
      } else {
        nextBestAction = "Manter padrão atual e monitorar evolução.";
      }

      return {
        month: monthDate,
        label: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        labelShort: format(monthDate, "MMM/yy", { locale: ptBR }),
        income,
        expense,
        balance,
        daysWithMovement,
        totalDays,
        recurrenceIndex,
        concentrationPercentage,
        maxDayIncome,
        particularPercentage,
        convenioPercentage,
        status,
        statusLabel,
        statusEmoji,
        diagnosis,
        impact,
        nextBestAction,
        isEligibleForScore,
        scoreFlags,
        hasInsufficientData
      };
    }).reverse(); // Mais recente primeiro
  }, [transactions]);

  // Comparativo com mês anterior
  const getComparison = (currentIndex: number) => {
    if (currentIndex >= monthlyData.length - 1) return null;
    const current = monthlyData[currentIndex];
    const previous = monthlyData[currentIndex + 1];

    const getDirection = (curr: number, prev: number, lowerIsBetter = false): "up" | "down" | "same" => {
      if (curr === prev) return "same";
      if (lowerIsBetter) {
        return curr < prev ? "up" : "down";
      }
      return curr > prev ? "up" : "down";
    };

    return {
      daysActive: {
        diff: current.daysWithMovement - previous.daysWithMovement,
        direction: getDirection(current.daysWithMovement, previous.daysWithMovement)
      },
      recurrence: {
        diff: current.recurrenceIndex - previous.recurrenceIndex,
        direction: getDirection(current.recurrenceIndex, previous.recurrenceIndex)
      },
      concentration: {
        diff: current.concentrationPercentage - previous.concentrationPercentage,
        direction: getDirection(current.concentrationPercentage, previous.concentrationPercentage, true) // Menor é melhor
      },
      convenios: {
        diff: current.convenioPercentage - previous.convenioPercentage,
        direction: getDirection(current.convenioPercentage, previous.convenioPercentage)
      }
    };
  };

  // Padrões detectados (inteligência histórica)
  const detectedPatterns = useMemo(() => {
    const patterns: string[] = [];
    const validMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0);

    if (validMonths.length < 2) {
      return ["Base histórica em formação."];
    }

    // Concentração recorrente
    const highConcentrationMonths = validMonths.filter(m => m.concentrationPercentage > 70).length;
    if (highConcentrationMonths >= 3) {
      patterns.push(`${highConcentrationMonths} dos últimos ${validMonths.length} meses apresentaram concentração acima de 70%.`);
    }

    // Baixa recorrência persistente
    const lowRecurrenceMonths = validMonths.filter(m => m.recurrenceIndex < 20).length;
    if (lowRecurrenceMonths >= 2) {
      patterns.push(`Recorrência abaixo de 20% por ${lowRecurrenceMonths} meses — padrão preocupante.`);
    }

    // Dependência de convênios
    const highConvenioMonths = validMonths.filter(m => m.convenioPercentage > 70).length;
    if (highConvenioMonths >= 3) {
      patterns.push(`Dependência de convênios identificada em ${highConvenioMonths} meses do período.`);
    }

    // Dependência de particular
    const highParticularMonths = validMonths.filter(m => m.particularPercentage > 80).length;
    if (highParticularMonths >= 3) {
      patterns.push(`Alta dependência de receita Particular em ${highParticularMonths} meses.`);
    }

    // Melhora ou piora consecutiva
    let improving = 0;
    let worsening = 0;
    for (let i = 0; i < validMonths.length - 1; i++) {
      if (validMonths[i].status === "healthy" && validMonths[i + 1].status !== "healthy") improving++;
      if (validMonths[i].status === "critical" && validMonths[i + 1].status !== "critical") worsening++;
    }
    if (improving >= 2) {
      patterns.push("Tendência de melhora identificada nos últimos meses.");
    }
    if (worsening >= 2) {
      patterns.push("Tendência de piora identificada — atenção redobrada necessária.");
    }

    // Meses com déficit
    const deficitMonths = validMonths.filter(m => m.balance < 0).length;
    if (deficitMonths >= 2) {
      patterns.push(`${deficitMonths} meses com déficit no período analisado.`);
    }

    if (patterns.length === 0) {
      patterns.push("Nenhum padrão crítico detectado no período analisado.");
    }

    return patterns;
  }, [monthlyData]);

  // Maturidade da Base Histórica
  type BaseMaturity = "forming" | "partial" | "reliable";
  
  const baseMaturity = useMemo((): { level: BaseMaturity; label: string; emoji: string; description: string } => {
    const validMonths = monthlyData.filter(m => !m.hasInsufficientData);
    const count = validMonths.length;
    
    if (count < 3) {
      return {
        level: "forming",
        label: "Em Formação",
        emoji: "⚪",
        description: "Menos de 3 meses válidos. Aguarde mais dados para análises confiáveis."
      };
    } else if (count <= 5) {
      return {
        level: "partial",
        label: "Parcial",
        emoji: "🟡",
        description: `${count} meses válidos. Base em construção — análises preliminares disponíveis.`
      };
    } else {
      return {
        level: "reliable",
        label: "Confiável",
        emoji: "🟢",
        description: `${count} meses válidos. Base histórica suficiente para análises e Score Mensal.`
      };
    }
  }, [monthlyData]);

  // Leitura Histórica Consolidada (12 meses)
  const consolidatedReading = useMemo(() => {
    const validMonths = monthlyData.filter(m => !m.hasInsufficientData);
    const total = validMonths.length;
    
    if (total === 0) {
      return {
        criticalPercentage: 0,
        attentionPercentage: 0,
        healthyPercentage: 0,
        formingPercentage: 100,
        predominantTrend: "Em formação" as const,
        mainRecurrentRisk: "Risco recorrente ainda não consolidado — base histórica insuficiente para confirmação.",
        hasEnoughData: false
      };
    }

    const criticalCount = validMonths.filter(m => m.status === "critical").length;
    const attentionCount = validMonths.filter(m => m.status === "attention").length;
    const healthyCount = validMonths.filter(m => m.status === "healthy").length;
    const formingCount = monthlyData.filter(m => m.status === "forming").length;

    const criticalPercentage = (criticalCount / total) * 100;
    const attentionPercentage = (attentionCount / total) * 100;
    const healthyPercentage = (healthyCount / total) * 100;
    const formingPercentage = (formingCount / monthlyData.length) * 100;

    // Determinar tendência predominante
    let predominantTrend: "Instável" | "Em amadurecimento" | "Saudável" | "Em formação";
    if (criticalPercentage > 40) {
      predominantTrend = "Instável";
    } else if (healthyPercentage > 60) {
      predominantTrend = "Saudável";
    } else if (formingPercentage > 50) {
      predominantTrend = "Em formação";
    } else {
      predominantTrend = "Em amadurecimento";
    }

    // Identificar principal risco recorrente (apenas se padrão estatístico consistente)
    const riskCounts = {
      "Concentração elevada": validMonths.filter(m => m.scoreFlags.altaConcentracao).length,
      "Baixa recorrência": validMonths.filter(m => m.scoreFlags.baixaRecorrencia).length,
      "Dependência de convênios": validMonths.filter(m => m.scoreFlags.predominioConvenios).length,
      "Dependência de particular": validMonths.filter(m => m.scoreFlags.predominioParticular).length,
      "Déficit recorrente": validMonths.filter(m => m.scoreFlags.deficitario).length
    };

    const mainRisk = Object.entries(riskCounts).reduce((a, b) => a[1] > b[1] ? a : b);
    
    // Exigir pelo menos 3 ocorrências para confirmar padrão recorrente
    const mainRecurrentRisk = mainRisk[1] >= 3 
      ? `${mainRisk[0]} (${mainRisk[1]} meses)`
      : "Risco recorrente ainda não consolidado — base histórica insuficiente para confirmação.";

    return {
      criticalPercentage,
      attentionPercentage,
      healthyPercentage,
      formingPercentage,
      predominantTrend,
      mainRecurrentRisk,
      hasEnoughData: total >= 3
    };
  }, [monthlyData]);

  // Histórico de alertas com contador de recorrência
  const alertsHistory = useMemo(() => {
    const alerts: { month: string; type: string; status: "new" | "recurrent"; recurrenceCount: number }[] = [];
    const validMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0);
    
    // Contar recorrências por tipo
    const recurrenceCounts: Record<string, number> = {};

    validMonths.forEach((month, index) => {
      const previousMonths = validMonths.slice(index + 1);

      if (month.balance < 0) {
        const type = "Déficit no Período";
        const wasRecurrent = previousMonths.some(m => m.balance < 0);
        recurrenceCounts[type] = (recurrenceCounts[type] || 0) + 1;
        alerts.push({
          month: month.labelShort,
          type,
          status: wasRecurrent ? "recurrent" : "new",
          recurrenceCount: recurrenceCounts[type]
        });
      }

      if (month.concentrationPercentage > 70) {
        const type = "Concentração Crítica";
        const wasRecurrent = previousMonths.some(m => m.concentrationPercentage > 70);
        recurrenceCounts[type] = (recurrenceCounts[type] || 0) + 1;
        alerts.push({
          month: month.labelShort,
          type,
          status: wasRecurrent ? "recurrent" : "new",
          recurrenceCount: recurrenceCounts[type]
        });
      }

      if (month.recurrenceIndex < 20 && month.income > 0) {
        const type = "Baixa Recorrência";
        const wasRecurrent = previousMonths.some(m => m.recurrenceIndex < 20);
        recurrenceCounts[type] = (recurrenceCounts[type] || 0) + 1;
        alerts.push({
          month: month.labelShort,
          type,
          status: wasRecurrent ? "recurrent" : "new",
          recurrenceCount: recurrenceCounts[type]
        });
      }

      if (month.particularPercentage > 80 || month.convenioPercentage > 80) {
        const type = "Alta Dependência";
        const wasRecurrent = previousMonths.some(m => m.particularPercentage > 80 || m.convenioPercentage > 80);
        recurrenceCounts[type] = (recurrenceCounts[type] || 0) + 1;
        alerts.push({
          month: month.labelShort,
          type,
          status: wasRecurrent ? "recurrent" : "new",
          recurrenceCount: recurrenceCounts[type]
        });
      }
    });

    return alerts.slice(0, 12);
  }, [monthlyData]);

  // Evolução das ações sugeridas com status
  const actionsEvolution = useMemo(() => {
    const validMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0);
    const evolution: { 
      month: string; 
      action: string; 
      improved: boolean | null;
      status: ActionStatus;
      impactMessage: string;
    }[] = [];

    validMonths.forEach((month, index) => {
      const nextMonth = validMonths[index - 1]; // Mês seguinte (array está invertido)
      let improved: boolean | null = null;
      let status: ActionStatus = "pending";
      let impactMessage = "";

      if (nextMonth) {
        // Verificar se houve melhora baseado na ação sugerida
        if (month.nextBestAction.includes("Diluir entradas")) {
          improved = nextMonth.concentrationPercentage < month.concentrationPercentage;
        } else if (month.nextBestAction.includes("Aumentar frequência")) {
          improved = nextMonth.recurrenceIndex > month.recurrenceIndex;
        } else if (month.nextBestAction.includes("Diversificar")) {
          improved = nextMonth.particularPercentage < month.particularPercentage;
        } else if (month.nextBestAction.includes("Revisar despesas")) {
          improved = nextMonth.balance > month.balance;
        } else if (month.nextBestAction.includes("Manter padrão")) {
          improved = nextMonth.status === "healthy" || nextMonth.status === month.status;
        }

        // Determinar status da ação
        if (improved === true) {
          status = "executed";
          impactMessage = "A execução desta ação contribuiu para redução do risco no mês seguinte.";
        } else if (improved === false) {
          status = "not_executed";
          impactMessage = "A ação não foi executada ou não surtiu efeito no mês seguinte.";
        } else {
          status = "pending";
          impactMessage = "Aguardando dados para avaliação do impacto.";
        }
      } else {
        status = "planned";
        impactMessage = "Ação planejada para execução.";
      }

      evolution.push({
        month: month.labelShort,
        action: month.nextBestAction,
        improved,
        status,
        impactMessage
      });
    });

    return evolution.slice(0, 6); // Últimos 6 meses
  }, [monthlyData]);

  const getStatusIcon = (status: MonthStatus) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "attention":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "forming":
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: MonthStatus) => {
    switch (status) {
      case "healthy":
        return "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400";
      case "attention":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400";
      case "critical":
        return "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400";
      case "forming":
        return "bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusBadgeText = (status: MonthStatus, emoji: string) => {
    switch (status) {
      case "healthy":
        return `${emoji} Saudável`;
      case "attention":
        return `${emoji} Atenção`;
      case "critical":
        return `${emoji} Crítico`;
      case "forming":
        return `${emoji} Base em formação`;
    }
  };

  const getActionStatusBadge = (status: ActionStatus) => {
    switch (status) {
      case "planned":
        return { label: "⏳ Planejada", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
      case "executing":
        return { label: "▶️ Em execução", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" };
      case "executed":
        return { label: "✅ Executada", className: "bg-green-500/10 text-green-600 border-green-500/30" };
      case "not_executed":
        return { label: "❌ Não executada", className: "bg-red-500/10 text-red-600 border-red-500/30" };
      case "pending":
        return { label: "⏳ Aguardando", className: "bg-gray-500/10 text-gray-600 border-gray-500/30" };
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "Saudável":
        return { className: "bg-green-500/10 text-green-700 border-green-500/30", emoji: "🟢" };
      case "Em amadurecimento":
        return { className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30", emoji: "🟡" };
      case "Instável":
        return { className: "bg-red-500/10 text-red-700 border-red-500/30", emoji: "🔴" };
      case "Em formação":
      default:
        return { className: "bg-gray-500/10 text-gray-600 border-gray-500/30", emoji: "⚪" };
    }
  };

  const getDirectionIcon = (direction: "up" | "down" | "same", positive: boolean = true) => {
    if (direction === "same") return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (direction === "up") {
      return positive 
        ? <ArrowUp className="h-4 w-4 text-green-500" />
        : <ArrowUp className="h-4 w-4 text-red-500" />;
    }
    return positive
      ? <ArrowDown className="h-4 w-4 text-red-500" />
      : <ArrowDown className="h-4 w-4 text-green-500" />;
  };

  const getMaturityColor = (level: BaseMaturity) => {
    switch (level) {
      case "reliable":
        return "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400";
      case "partial":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400";
      case "forming":
        return "bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Tendências</h1>
              <p className="text-sm text-muted-foreground">
                Memória financeira inteligente — base para o Score Mensal
              </p>
            </div>
          </div>
        </div>

        {/* Indicador de Maturidade da Base */}
        <Card className={cn("border", getMaturityColor(baseMaturity.level))}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{baseMaturity.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Maturidade da Base Histórica</p>
                  <Badge variant="outline" className={cn("text-xs mt-1", getMaturityColor(baseMaturity.level))}>
                    {baseMaturity.label}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-right">
                {baseMaturity.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Leitura Histórica Consolidada (12 meses) */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Leitura Histórica Consolidada</CardTitle>
            </div>
            <CardDescription>
              Visão estratégica dos últimos 12 meses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Distribuição de Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-muted-foreground">Meses Críticos</p>
                <p className="text-xl font-bold text-red-600">{consolidatedReading.criticalPercentage.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-muted-foreground">Meses em Atenção</p>
                <p className="text-xl font-bold text-yellow-600">{consolidatedReading.attentionPercentage.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-muted-foreground">Meses Saudáveis</p>
                <p className="text-xl font-bold text-green-600">{consolidatedReading.healthyPercentage.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                <p className="text-xs text-muted-foreground">Em Formação</p>
                <p className="text-xl font-bold text-gray-600">{consolidatedReading.formingPercentage.toFixed(0)}%</p>
              </div>
            </div>

            <Separator />

            {/* Tendência e Risco Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-1">Tendência Predominante</p>
                <Badge variant="outline" className={cn("text-sm", getTrendBadge(consolidatedReading.predominantTrend).className)}>
                  {getTrendBadge(consolidatedReading.predominantTrend).emoji} {consolidatedReading.predominantTrend}
                </Badge>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-1">Principal Risco Recorrente</p>
                <p className="text-sm font-medium text-foreground">{consolidatedReading.mainRecurrentRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Padrões Detectados */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Padrões Detectados</CardTitle>
            </div>
            <CardDescription>
              Inteligência histórica baseada nos últimos 12 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {detectedPatterns.map((pattern, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{pattern}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Linha do Tempo Mensal */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Linha do Tempo</CardTitle>
            </div>
            <CardDescription>
              Clique em um mês para ver detalhes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {monthlyData.map((month, index) => {
              const isExpanded = expandedMonth === month.labelShort;
              const comparison = getComparison(index);

              return (
                <Collapsible
                  key={month.labelShort}
                  open={isExpanded}
                  onOpenChange={() => setExpandedMonth(isExpanded ? null : month.labelShort)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                        isExpanded ? "bg-card border-primary/30" : "bg-card/50 border-border/50 hover:bg-card hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(month.status)}
                        <div>
                          <p className="font-medium text-foreground capitalize">{month.label}</p>
                          <p className="text-xs text-muted-foreground">{month.statusLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", getStatusColor(month.status))}>
                          {getStatusBadgeText(month.status, month.statusEmoji)}
                        </Badge>
                        {month.isEligibleForScore ? (
                          <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-600">
                            ✅ Elegível
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-gray-500/10 border-gray-500/30 text-gray-600">
                            ❌ Não elegível
                          </Badge>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
                      {/* Elegibilidade para Score */}
                      <div className={cn(
                        "p-2 rounded text-center border",
                        month.isEligibleForScore 
                          ? "bg-green-500/10 border-green-500/30" 
                          : "bg-gray-500/10 border-gray-500/30"
                      )}>
                        <p className={cn("text-xs", month.isEligibleForScore ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400")}>
                          {month.isEligibleForScore 
                            ? "✅ Elegível para Score — critérios atingidos (≥5 dias ativos ou ≥20% recorrência)"
                            : `⚠️ Mês avaliado, porém não pontuado — ${month.hasInsufficientData ? "base histórica em formação" : "Score não calculado por insuficiência de base (mínimo: 5 dias ativos e 20% de recorrência)"}`}
                        </p>
                      </div>

                      {/* Indicadores Padronizados (sempre os mesmos) */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Indicadores do Mês
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Resultado</p>
                            <p className={cn("font-semibold", month.hasInsufficientData ? "text-muted-foreground" : month.balance >= 0 ? "text-green-600" : "text-red-600")}>
                              {month.hasInsufficientData ? "Dados insuficientes" : month.balance >= 0 ? "Positivo" : "Negativo"}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Dias Ativos</p>
                            <p className="font-semibold text-foreground">
                              {month.hasInsufficientData ? "Dados insuficientes" : `${month.daysWithMovement} de ${month.totalDays}`}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Recorrência</p>
                            <p className="font-semibold text-foreground">
                              {month.hasInsufficientData ? "Dados insuficientes" : `${month.recurrenceIndex.toFixed(0)}%`}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Concentração</p>
                            <p className={cn("font-semibold", month.hasInsufficientData ? "text-muted-foreground" : month.concentrationPercentage > 70 ? "text-red-600" : "text-foreground")}>
                              {month.hasInsufficientData ? "Dados insuficientes" : `${month.concentrationPercentage.toFixed(0)}%`}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Particular</p>
                            <p className="font-semibold text-foreground">
                              {month.hasInsufficientData ? "Dados insuficientes" : `${month.particularPercentage.toFixed(0)}%`}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <p className="text-xs text-muted-foreground">Convênios</p>
                            <p className="font-semibold text-foreground">
                              {month.hasInsufficientData ? "Dados insuficientes" : `${month.convenioPercentage.toFixed(0)}%`}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO A: Diagnóstico do Mês */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                          A. Diagnóstico do Mês
                        </h4>
                        <div className="p-3 rounded-lg border bg-card border-border/50">
                          <p className="text-sm text-foreground">{month.diagnosis}</p>
                        </div>
                      </div>

                      {/* BLOCO B: Impacto Potencial */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                          B. Impacto Potencial
                        </h4>
                        <div className={cn("p-3 rounded-lg border", getStatusColor(month.status))}>
                          <p className="text-sm font-medium">{month.impact}</p>
                        </div>
                      </div>

                      {/* Comparativo com Mês Anterior */}
                      {comparison && !month.hasInsufficientData && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Comparativo com Mês Anterior
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="flex items-center gap-2 p-2 rounded bg-card border border-border/50">
                              {getDirectionIcon(comparison.daysActive.direction)}
                              <div>
                                <p className="text-xs text-muted-foreground">Dias Ativos</p>
                                <p className="text-sm font-medium">
                                  {comparison.daysActive.diff > 0 ? "+" : ""}{comparison.daysActive.diff}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded bg-card border border-border/50">
                              {getDirectionIcon(comparison.recurrence.direction)}
                              <div>
                                <p className="text-xs text-muted-foreground">Recorrência</p>
                                <p className="text-sm font-medium">
                                  {comparison.recurrence.diff > 0 ? "+" : ""}{comparison.recurrence.diff.toFixed(0)}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded bg-card border border-border/50">
                              {getDirectionIcon(comparison.concentration.direction)}
                              <div>
                                <p className="text-xs text-muted-foreground">Concentração</p>
                                <p className="text-sm font-medium">
                                  {comparison.concentration.diff > 0 ? "+" : ""}{comparison.concentration.diff.toFixed(0)}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded bg-card border border-border/50">
                              {getDirectionIcon(comparison.convenios.direction, false)}
                              <div>
                                <p className="text-xs text-muted-foreground">Convênios</p>
                                <p className="text-sm font-medium">
                                  {comparison.convenios.diff > 0 ? "+" : ""}{comparison.convenios.diff.toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        {/* Grid de cards inferiores */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Histórico de Alertas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-lg">Histórico de Alertas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {alertsHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum alerta registrado no período.
                </p>
              ) : (
                <div className="space-y-2">
                  {alertsHistory.map((alert, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded border",
                        alert.recurrenceCount >= 3 
                          ? "bg-red-500/5 border-red-500/30" 
                          : "bg-muted/30 border-border/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-16">{alert.month}</span>
                        <span className={cn("text-sm", alert.recurrenceCount >= 3 ? "text-red-600 font-medium" : "text-foreground")}>
                          {alert.type}
                        </span>
                        {alert.recurrenceCount >= 3 && (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                            {alert.recurrenceCount}x
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          alert.status === "new" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                          "bg-orange-500/10 text-orange-600 border-orange-500/30"
                        )}
                      >
                        {alert.status === "new" ? "Novo" : "Recorrente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evolução das Ações */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Evolução das Ações</CardTitle>
              </div>
              <CardDescription>
                Acompanhamento das recomendações mensais
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionsEvolution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Dados insuficientes para análise.
                </p>
              ) : (
                <div className="space-y-3">
                  {actionsEvolution.map((item, index) => {
                    const statusBadge = getActionStatusBadge(item.status);
                    return (
                      <div key={index} className="p-3 rounded bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">{item.month}</span>
                          <Badge variant="outline" className={cn("text-xs", statusBadge.className)}>
                            {statusBadge.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mb-2">{item.action}</p>
                        <p className={cn(
                          "text-xs italic",
                          item.improved === true ? "text-green-600" : 
                          item.improved === false ? "text-red-600" : 
                          "text-muted-foreground"
                        )}>
                          {item.impactMessage}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Nota de Rodapé - Preparação para Score */}
        <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground text-center italic">
              Este histórico consolida a evolução mensal do fluxo de caixa e serve como base para o Score Mensal de Saúde Financeira. 
              Meses em base em formação não entram na pontuação.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
