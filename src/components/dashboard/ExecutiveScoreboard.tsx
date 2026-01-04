import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  Target,
  Zap,
  Shield,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreComponent {
  name: string;
  weight: number;
  value: number;
  score: number;
  maxScore: number;
  description: string;
  status: "positive" | "neutral" | "negative";
}

interface ExecutiveScoreboardProps {
  isEligible: boolean;
  hasData: boolean;
  totalScore: number;
  scoreStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
  scoreLabel: string;
  scoreColor: string;
  scoreEmoji: string;
  hasLowConfidence: boolean;
  validMonths: number;
  components: ScoreComponent[];
  lowestComponent: ScoreComponent;
  primaryRecommendation: string;
  executiveSubtext: string;
  metrics: {
    daysWithMovement: number;
    recurrenceIndex: number;
    balance: number;
  };
}

export function ExecutiveScoreboard({
  isEligible,
  hasData,
  totalScore,
  scoreStatus,
  scoreLabel,
  scoreColor,
  scoreEmoji,
  hasLowConfidence,
  validMonths,
  components,
  lowestComponent,
  primaryRecommendation,
  executiveSubtext,
  metrics
}: ExecutiveScoreboardProps) {

  // Determinar selo de confiança
  const getConfidenceSeal = () => {
    if (validMonths >= 6) {
      return { label: "Confiança Alta", color: "bg-green-100 text-green-800 border-green-300" };
    } else if (validMonths >= 3) {
      return { label: "Confiança Média", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
    } else {
      return { label: "Confiança Baixa — base em formação", color: "bg-amber-100 text-amber-800 border-amber-300" };
    }
  };

  const confidenceSeal = getConfidenceSeal();

  // Gerar frase executiva única
  const getExecutivePhrase = () => {
    if (!isEligible) {
      return null;
    }

    const statusDescriptions: Record<string, string> = {
      excellent: "Operação com excelente previsibilidade e regularidade.",
      healthy: "Boa regularidade e recorrência, com risco controlado.",
      attention: "Operação requer atenção em indicadores de regularidade.",
      risk: "Resultado positivo pontual, com alta concentração e baixa previsibilidade.",
      critical: "Indicadores críticos identificados. Ação imediata recomendada."
    };

    return executiveSubtext || statusDescriptions[scoreStatus];
  };

  // Identificar principal gargalo
  const getBottleneckMessage = () => {
    const bottleneckNames: Record<string, string> = {
      "Regularidade": "Baixa regularidade de movimentações",
      "Recorrência": "Baixa recorrência operacional",
      "Concentração": "Concentração elevada",
      "Tendência Histórica": "Base histórica insuficiente"
    };
    return bottleneckNames[lowestComponent.name] || lowestComponent.name;
  };

  // Gerar ação única baseada no menor pilar
  const getPrimaryAction = () => {
    const actions: Record<string, string> = {
      "Regularidade": "Distribuir faturamento em pelo menos 5 dias distintos no próximo mês.",
      "Recorrência": "Aumentar recorrência para pelo menos 20% do total do mês.",
      "Concentração": "Reduzir concentração do maior dia para abaixo de 40% do total mensal.",
      "Tendência Histórica": "Manter operação estável para consolidar histórico financeiro."
    };
    return actions[lowestComponent.name] || primaryRecommendation;
  };

  const getComponentColor = (status: "positive" | "neutral" | "negative") => {
    switch (status) {
      case "positive": return "bg-green-500";
      case "neutral": return "bg-yellow-500";
      case "negative": return "bg-red-500";
    }
  };

  const getComponentTextColor = (status: "positive" | "neutral" | "negative") => {
    switch (status) {
      case "positive": return "text-green-600";
      case "neutral": return "text-yellow-600";
      case "negative": return "text-red-600";
    }
  };

  // Gerar metas mensuráveis para próximo mês
  const getTargetGoals = () => {
    const goals = [];
    
    if (lowestComponent.name === "Regularidade" || metrics.daysWithMovement < 5) {
      goals.push({ label: "Dias ativos alvo", value: "≥ 5", icon: "✔️" });
    }
    if (lowestComponent.name === "Recorrência" || metrics.recurrenceIndex < 20) {
      goals.push({ label: "Recorrência alvo", value: "≥ 20%", icon: "✔️" });
    }
    if (lowestComponent.name === "Concentração") {
      goals.push({ label: "Concentração máxima", value: "≤ 40%", icon: "🎯" });
    }
    
    // Garantir pelo menos uma meta
    if (goals.length === 0) {
      goals.push({ label: "Dias ativos alvo", value: "≥ 5", icon: "✔️" });
      goals.push({ label: "Recorrência alvo", value: "≥ 20%", icon: "✔️" });
    }
    
    return goals;
  };

  // Estimar impacto no score
  const getEstimatedImpact = () => {
    const lowestRatio = lowestComponent.score / lowestComponent.maxScore;
    if (lowestRatio < 0.3) return "+18 a +30 pontos";
    if (lowestRatio < 0.5) return "+12 a +20 pontos";
    if (lowestRatio < 0.7) return "+6 a +12 pontos";
    return "+3 a +8 pontos";
  };

  // Estado não elegível - Layout limpo e focado
  if (!isEligible) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Scoreboard Executivo — Visão Rápida</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Status Central - Grande e Claro */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted border-4 border-muted-foreground/20 mb-4 shadow-inner">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="text-base px-5 py-1.5 font-semibold">
              Score Indisponível
            </Badge>
            <p className="text-sm text-muted-foreground mt-3 max-w-sm">
              Base em formação — aguardando critérios mínimos
            </p>
          </div>

          <Separator className="my-5" />

          {/* Fator Limitante - Destaque */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Principal fator limitante: {getBottleneckMessage()}
            </p>
          </div>

          {/* Ação Recomendada + Meta Gerencial */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-primary mb-1">Para melhorar o Score:</p>
                <p className="text-sm font-medium">{getPrimaryAction()}</p>
              </div>
            </div>
            
            {/* Meta do Próximo Mês */}
            <div className="border-t border-primary/20 pt-3 mt-3">
              <p className="text-xs font-semibold text-primary mb-2">Meta do próximo mês:</p>
              <div className="space-y-1">
                {getTargetGoals().map((goal, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span>{goal.icon}</span>
                    <span className="text-muted-foreground">{goal.label}:</span>
                    <span className="font-semibold">{goal.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-primary/10">
                  <Target className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">Impacto estimado:</span>
                  <span className="font-semibold text-primary">{getEstimatedImpact()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selo de Confiabilidade */}
          <div className="flex flex-col items-center gap-2">
            <Badge variant="outline" className={cn("text-xs px-3 py-1", confidenceSeal.color)}>
              <Shield className="h-3 w-3 mr-1.5" />
              {confidenceSeal.label}
            </Badge>
            <p className="text-[10px] text-muted-foreground text-center max-w-xs">
              Confiabilidade do Score baseada na maturidade do histórico financeiro.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado elegível - Score visível com clareza máxima
  const statusBorderColor = {
    excellent: "border-green-400",
    healthy: "border-green-400",
    attention: "border-yellow-400",
    risk: "border-orange-400",
    critical: "border-red-400"
  };

  const statusBgColor = {
    excellent: "bg-green-50 dark:bg-green-950/30",
    healthy: "bg-green-50 dark:bg-green-950/30",
    attention: "bg-yellow-50 dark:bg-yellow-950/30",
    risk: "bg-orange-50 dark:bg-orange-950/30",
    critical: "bg-red-50 dark:bg-red-950/30"
  };

  const statusCircleBg = {
    excellent: "border-green-500 bg-green-50 dark:bg-green-950",
    healthy: "border-green-500 bg-green-50 dark:bg-green-950",
    attention: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
    risk: "border-orange-500 bg-orange-50 dark:bg-orange-950",
    critical: "border-red-500 bg-red-50 dark:bg-red-950"
  };

  // Gerar metas mensuráveis para próximo mês (estado elegível)
  const getTargetGoalsEligible = () => {
    const goals = [];
    
    if (lowestComponent.name === "Regularidade" || metrics.daysWithMovement < 5) {
      goals.push({ label: "Dias ativos alvo", value: "≥ 5", icon: "✔️" });
    }
    if (lowestComponent.name === "Recorrência" || metrics.recurrenceIndex < 20) {
      goals.push({ label: "Recorrência alvo", value: "≥ 20%", icon: "✔️" });
    }
    if (lowestComponent.name === "Concentração") {
      goals.push({ label: "Concentração máxima", value: "≤ 40%", icon: "🎯" });
    }
    
    if (goals.length === 0) {
      goals.push({ label: "Dias ativos alvo", value: "≥ 5", icon: "✔️" });
      goals.push({ label: "Recorrência alvo", value: "≥ 20%", icon: "✔️" });
    }
    
    return goals;
  };

  const getEstimatedImpactEligible = () => {
    const lowestRatio = lowestComponent.score / lowestComponent.maxScore;
    if (lowestRatio < 0.3) return "+18 a +30 pontos";
    if (lowestRatio < 0.5) return "+12 a +20 pontos";
    if (lowestRatio < 0.7) return "+6 a +12 pontos";
    return "+3 a +8 pontos";
  };

  return (
    <Card className={cn(
      "border-2 shadow-lg",
      statusBorderColor[scoreStatus]
    )}>
      <CardHeader className={cn("pb-2", statusBgColor[scoreStatus])}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-bold">Scoreboard Executivo — Visão Rápida</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Score Central - GRANDE e Impactante */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className={cn(
            "flex h-32 w-32 items-center justify-center rounded-full border-4 mb-4 shadow-lg",
            statusCircleBg[scoreStatus]
          )}>
            <span className={cn("text-5xl font-black", scoreColor)}>
              {totalScore}
            </span>
          </div>
          <Badge className={cn(
            "text-base px-5 py-1.5 font-bold",
            (scoreStatus === "excellent" || scoreStatus === "healthy") && "bg-green-500 text-white hover:bg-green-500",
            scoreStatus === "attention" && "bg-yellow-500 text-white hover:bg-yellow-500",
            scoreStatus === "risk" && "bg-orange-500 text-white hover:bg-orange-500",
            scoreStatus === "critical" && "bg-red-500 text-white hover:bg-red-500"
          )}>
            {scoreEmoji} {scoreLabel}
          </Badge>
          
          {/* Frase Executiva - Uma linha clara */}
          <p className="text-sm font-medium mt-4 max-w-md leading-relaxed text-muted-foreground">
            {getExecutivePhrase()}
          </p>
        </div>

        <Separator className="my-5" />

        {/* Pilares - Barras Coloridas Visuais */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            Pilares do Score
          </h3>
          {components.map((component, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{component.name}</span>
                <span className={cn("font-bold", getComponentTextColor(component.status))}>
                  {component.score}/{component.maxScore}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", getComponentColor(component.status))}
                  style={{ width: `${(component.score / component.maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-5" />

        {/* Fator Limitante */}
        <div className={cn(
          "rounded-lg p-4 mb-4",
          lowestComponent.status === "negative" && "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800",
          lowestComponent.status === "neutral" && "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800",
          lowestComponent.status === "positive" && "bg-muted border border-muted-foreground/20"
        )}>
          <p className={cn(
            "text-sm font-semibold",
            lowestComponent.status === "negative" && "text-red-800 dark:text-red-200",
            lowestComponent.status === "neutral" && "text-yellow-800 dark:text-yellow-200",
            lowestComponent.status === "positive" && "text-muted-foreground"
          )}>
            Principal fator limitante: {getBottleneckMessage()}
          </p>
        </div>

        {/* Ação Recomendada + Meta Gerencial */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-primary mb-1">Para melhorar o Score:</p>
              <p className="text-sm font-medium">{getPrimaryAction()}</p>
            </div>
          </div>
          
          {/* Meta do Próximo Mês */}
          <div className="border-t border-primary/20 pt-3 mt-3">
            <p className="text-xs font-semibold text-primary mb-2">Meta do próximo mês:</p>
            <div className="space-y-1">
              {getTargetGoalsEligible().map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span>{goal.icon}</span>
                  <span className="text-muted-foreground">{goal.label}:</span>
                  <span className="font-semibold">{goal.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-primary/10">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-muted-foreground">Impacto estimado:</span>
                <span className="font-semibold text-primary">{getEstimatedImpactEligible()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selo de Confiabilidade */}
        <div className="flex flex-col items-center gap-2">
          <Badge variant="outline" className={cn("text-xs px-3 py-1", confidenceSeal.color)}>
            <Shield className="h-3 w-3 mr-1.5" />
            {confidenceSeal.label}
          </Badge>
          <p className="text-[10px] text-muted-foreground text-center max-w-xs">
            Confiabilidade do Score baseada na maturidade do histórico financeiro.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
