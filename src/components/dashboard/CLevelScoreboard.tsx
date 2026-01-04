import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Shield,
  AlertCircle,
  Zap,
  CheckCircle,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CLevelScoreboardProps {
  isEligible: boolean;
  hasData: boolean;
  totalScore: number;
  scoreStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
  scoreLabel: string;
  scoreEmoji: string;
  validMonths: number;
  trend: "improving" | "stable" | "declining";
  scoreHistory: Array<{
    status: string;
    isEligible: boolean;
  }>;
  lowestComponent: {
    name: string;
    status: "positive" | "neutral" | "negative";
  };
  primaryRecommendation: string;
  metrics: {
    daysWithMovement: number;
    recurrenceIndex: number;
    concentrationPercentage: number;
  };
  currentPeriod: string;
  onNavigateToOperational?: () => void;
  // New props for weighted global score
  isWeightedGlobal?: boolean;
  weightedExplanation?: string;
}

export function CLevelScoreboard({
  isEligible,
  hasData,
  totalScore,
  scoreStatus,
  scoreLabel,
  scoreEmoji,
  validMonths,
  trend,
  scoreHistory,
  lowestComponent,
  primaryRecommendation,
  metrics,
  currentPeriod,
  onNavigateToOperational,
  isWeightedGlobal = false,
  weightedExplanation
}: CLevelScoreboardProps) {

  // Contexto executivo para score indisponível
  const getExecutiveContext = () => {
    if (metrics.daysWithMovement < 5) {
      return `Score não calculado neste período por baixa regularidade (${metrics.daysWithMovement} dia${metrics.daysWithMovement !== 1 ? 's' : ''} ativo${metrics.daysWithMovement !== 1 ? 's' : ''}).`;
    }
    if (metrics.recurrenceIndex < 20) {
      return `Score não calculado neste período por baixa recorrência (${metrics.recurrenceIndex.toFixed(0)}%).`;
    }
    return "Score não calculado neste período por critérios mínimos não atingidos.";
  };

  // Selo de Confiabilidade
  const getConfidenceSeal = () => {
    if (validMonths >= 6) {
      return { label: "Alta", color: "bg-green-500 text-white", emoji: "🟢" };
    } else if (validMonths >= 3) {
      return { label: "Média", color: "bg-yellow-500 text-white", emoji: "🟡" };
    } else {
      return { label: "Baixa", color: "bg-red-500 text-white", emoji: "🔴" };
    }
  };

  const confidenceSeal = getConfidenceSeal();

  // Tendência Macro
  const getTrendInfo = () => {
    if (trend === "improving") {
      return { icon: TrendingUp, label: "Melhorando", color: "text-green-600", emoji: "⬆️" };
    } else if (trend === "declining") {
      return { icon: TrendingDown, label: "Deteriorando", color: "text-red-600", emoji: "⬇️" };
    }
    return { icon: Minus, label: "Estável", color: "text-muted-foreground", emoji: "➖" };
  };

  const trendInfo = getTrendInfo();

  // Contagem histórica por status
  const getHistorySummary = () => {
    const eligible = scoreHistory.filter(m => m.isEligible);
    const healthy = eligible.filter(m => m.status === "excellent" || m.status === "healthy").length;
    const attention = eligible.filter(m => m.status === "attention").length;
    const critical = eligible.filter(m => m.status === "risk" || m.status === "critical").length;
    return { healthy, attention, critical };
  };

  const historySummary = getHistorySummary();

  // Principal Risco Atual
  const getPrimaryRisk = () => {
    if (metrics.concentrationPercentage > 60) {
      return { 
        emoji: "🔴", 
        text: "Alta concentração de faturamento",
        severity: "high"
      };
    }
    if (metrics.recurrenceIndex < 20) {
      return { 
        emoji: "🟠", 
        text: "Baixa recorrência estrutural",
        severity: "medium"
      };
    }
    if (metrics.daysWithMovement < 5) {
      return { 
        emoji: "🟡", 
        text: "Irregularidade de entradas",
        severity: "low"
      };
    }
    return { 
      emoji: "🟢", 
      text: "Nenhum risco estrutural relevante",
      severity: "none"
    };
  };

  const primaryRisk = getPrimaryRisk();

  // Decisão Executiva Recomendada
  const getExecutiveDecision = () => {
    if (metrics.concentrationPercentage > 60) {
      return `Distribuir faturamento mínimo em 5 dias por mês para reduzir risco de concentração.`;
    }
    if (metrics.recurrenceIndex < 20) {
      return `Aumentar frequência operacional para atingir mínimo de 20% de recorrência mensal.`;
    }
    if (metrics.daysWithMovement < 5) {
      return `Garantir movimentações em pelo menos 5 dias distintos por mês.`;
    }
    return `Manter operação atual e monitorar evolução do Score mensalmente.`;
  };

  // Status de Governança
  const getGovernanceStatus = () => {
    let baseStatus = "Em formação";
    if (validMonths >= 6) baseStatus = "Consolidada";
    else if (validMonths >= 3) baseStatus = "Parcial";
    
    return {
      base: baseStatus,
      eligible: isEligible ? "Sim" : "Não",
      autoUpdate: "Ativa"
    };
  };

  const governance = getGovernanceStatus();

  // Cores do status
  const statusColors = {
    excellent: { 
      bg: "bg-green-50 dark:bg-green-950/40", 
      border: "border-green-400",
      text: "text-green-700 dark:text-green-300",
      badge: "bg-green-500 text-white"
    },
    healthy: { 
      bg: "bg-green-50 dark:bg-green-950/40", 
      border: "border-green-400",
      text: "text-green-700 dark:text-green-300",
      badge: "bg-green-500 text-white"
    },
    attention: { 
      bg: "bg-yellow-50 dark:bg-yellow-950/40", 
      border: "border-yellow-400",
      text: "text-yellow-700 dark:text-yellow-300",
      badge: "bg-yellow-500 text-white"
    },
    risk: { 
      bg: "bg-orange-50 dark:bg-orange-950/40", 
      border: "border-orange-400",
      text: "text-orange-700 dark:text-orange-300",
      badge: "bg-orange-500 text-white"
    },
    critical: { 
      bg: "bg-red-50 dark:bg-red-950/40", 
      border: "border-red-400",
      text: "text-red-700 dark:text-red-300",
      badge: "bg-red-500 text-white"
    }
  };

  const currentColors = isEligible ? statusColors[scoreStatus] : statusColors.attention;

  return (
    <Card className={cn(
      "border-2 shadow-xl",
      isEligible ? currentColors.border : "border-muted-foreground/30"
    )}>
      <CardHeader className={cn(
        "pb-3",
        isEligible ? currentColors.bg : "bg-muted/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Scoreboard Global — Visão C-Level</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Conselho / Diretoria
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Período analisado: {currentPeriod}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
          🧭 O que isso significa para a decisão?
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* 1️⃣ SCORE GLOBAL CONSOLIDADO */}
        <div className="flex flex-col items-center text-center mb-6">
          {isEligible ? (
            <>
              <div className={cn(
                "flex h-36 w-36 items-center justify-center rounded-full border-4 mb-4 shadow-xl",
                currentColors.border,
                currentColors.bg
              )}>
                <span className={cn("text-6xl font-black", currentColors.text)}>
                  {totalScore}
                </span>
              </div>
              <Badge className={cn("text-lg px-6 py-2 font-bold", currentColors.badge)}>
                {scoreEmoji} {scoreLabel}
              </Badge>
            </>
          ) : (
            <>
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-muted-foreground/30 bg-muted/50 mb-4 shadow-inner">
                <AlertCircle className="h-16 w-16 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="text-lg px-6 py-2 font-semibold">
                Score Indisponível
              </Badge>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm text-center">
                {getExecutiveContext()}
              </p>
            </>
          )}
          
          {/* Selo de Confiabilidade */}
          <div className="flex items-center gap-2 mt-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Confiabilidade:</span>
            <Badge className={cn("text-xs", confidenceSeal.color)}>
              {confidenceSeal.emoji} {confidenceSeal.label}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3 max-w-md">
            {isWeightedGlobal && weightedExplanation 
              ? weightedExplanation 
              : "Score consolidado da saúde financeira, baseado em regularidade, recorrência, concentração e tendência histórica."
            }
          </p>
          
          {/* Weighted Global indicator */}
          {isWeightedGlobal && (
            <Badge variant="outline" className="mt-2 text-xs border-primary/30 text-primary">
              📊 Média Ponderada das Unidades
            </Badge>
          )}
        </div>

        <Separator className="my-5" />

        {/* 2️⃣ TENDÊNCIA MACRO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted/30 border">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <trendInfo.icon className={cn("h-4 w-4", trendInfo.color)} />
              Tendência Geral
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{trendInfo.emoji}</span>
              <span className={cn("text-lg font-bold", trendInfo.color)}>
                {trendInfo.label}
              </span>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border">
            <h4 className="text-sm font-semibold mb-3">📊 Resumo Histórico</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Meses Saudáveis:</span>
                <span className="font-bold text-green-600">{historySummary.healthy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Meses em Atenção:</span>
                <span className="font-bold text-yellow-600">{historySummary.attention}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Meses Críticos:</span>
                <span className="font-bold text-red-600">{historySummary.critical}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        {/* 3️⃣ PRINCIPAL RISCO ATUAL */}
        <div className={cn(
          "p-4 rounded-lg mb-6",
          primaryRisk.severity === "high" && "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800",
          primaryRisk.severity === "medium" && "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800",
          primaryRisk.severity === "low" && "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800",
          primaryRisk.severity === "none" && "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
        )}>
          <h4 className="text-sm font-semibold mb-2">Principal Risco Atual</h4>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{primaryRisk.emoji}</span>
            <span className={cn(
              "text-lg font-bold",
              primaryRisk.severity === "high" && "text-red-700 dark:text-red-300",
              primaryRisk.severity === "medium" && "text-orange-700 dark:text-orange-300",
              primaryRisk.severity === "low" && "text-yellow-700 dark:text-yellow-300",
              primaryRisk.severity === "none" && "text-green-700 dark:text-green-300"
            )}>
              {primaryRisk.text}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Este é o fator que mais impacta a previsibilidade financeira no momento.
          </p>
        </div>

        {/* 4️⃣ DECISÃO EXECUTIVA RECOMENDADA */}
        <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-primary mb-2">Decisão recomendada:</p>
              <p className="text-base font-semibold leading-relaxed">
                "{getExecutiveDecision()}"
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        {/* 5️⃣ STATUS DE GOVERNANÇA */}
        <div className="p-4 rounded-lg bg-muted/20 border">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            Status de Governança
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Base histórica</p>
              <Badge variant="outline" className="font-medium">
                {governance.base}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Score elegível</p>
              <Badge variant="outline" className={cn(
                "font-medium",
                governance.eligible === "Sim" ? "border-green-300 text-green-700" : "border-red-300 text-red-700"
              )}>
                {governance.eligible}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Atualização</p>
              <Badge variant="outline" className="font-medium border-green-300 text-green-700">
                {governance.autoUpdate}
              </Badge>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-4">
            Este Score é uma métrica gerencial. Não substitui relatórios contábeis ou demonstrações oficiais.
          </p>
        </div>

        {/* CTA para diagnóstico completo */}
        {onNavigateToOperational && (
          <div className="text-center mt-6">
            <button
              onClick={onNavigateToOperational}
              className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Ver diagnóstico completo → Score Mensal
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
