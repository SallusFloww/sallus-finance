import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Shield, 
  Target,
  Zap,
  ArrowUp,
  ArrowRight,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ScenarioId = "conservative" | "base" | "optimistic" | null;

interface StrategicScenariosProps {
  lowestComponent: {
    name: string;
    score: number;
    maxScore: number;
  };
  primaryRecommendation: string;
  trend: "improving" | "stable" | "declining";
  scoreStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
  metrics: {
    daysActive: number;
    recurrence: number;
    concentration: number;
  };
  validMonths: number;
  currentYear: string;
  activeScenario?: ScenarioId;
  onScenarioChange?: (scenarioId: ScenarioId) => void;
}

type ProbabilityLevel = "low" | "medium" | "high";

interface Scenario {
  id: ScenarioId;
  title: string;
  emoji: string;
  premise: string;
  description: string;
  impact: string;
  riskOrBenefit: string;
  riskOrBenefitLabel: string;
  trendIndicator?: "up" | "down" | "stable" | "up-strong";
  probability: ProbabilityLevel;
  probabilityContext: string;
  scoreTrend: string;
  punchline: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function StrategicScenarios({
  lowestComponent,
  primaryRecommendation,
  trend,
  scoreStatus,
  metrics,
  validMonths,
  currentYear,
  activeScenario,
  onScenarioChange
}: StrategicScenariosProps) {

  const getProbabilityLabel = (level: ProbabilityLevel) => {
    switch (level) {
      case "low": return "Baixa";
      case "medium": return "Média";
      case "high": return "Alta";
    }
  };

  const getProbabilityColor = (level: ProbabilityLevel) => {
    switch (level) {
      case "low": return "text-slate-500 bg-slate-100 dark:bg-slate-800";
      case "medium": return "text-amber-600 bg-amber-100 dark:bg-amber-900/30";
      case "high": return "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30";
    }
  };

  const getTrendIcon = (trendType?: "up" | "down" | "stable" | "up-strong") => {
    switch (trendType) {
      case "up": return <ArrowUp className="h-4 w-4 text-emerald-600" />;
      case "up-strong": return (
        <div className="flex">
          <ArrowUp className="h-4 w-4 text-emerald-600" />
          <ArrowUp className="h-4 w-4 text-emerald-600 -ml-2" />
        </div>
      );
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable": return <ArrowRight className="h-4 w-4 text-slate-500" />;
      default: return null;
    }
  };

  // Determinar o fator limitante principal
  const getLimitingFactor = () => {
    if (lowestComponent.name === "Regularidade") return "regularidade";
    if (lowestComponent.name === "Recorrência") return "recorrência";
    if (lowestComponent.name === "Concentração") return "concentração";
    return "base histórica";
  };

  const limitingFactor = getLimitingFactor();

  // Determinar probabilidade do cenário conservador baseado na tendência atual
  const conservativeProbability: ProbabilityLevel = 
    trend === "declining" ? "high" : 
    trend === "stable" ? "medium" : "low";

  // Determinar probabilidade do cenário base
  const baseProbability: ProbabilityLevel = 
    validMonths >= 3 && (scoreStatus === "attention" || scoreStatus === "healthy") ? "high" :
    validMonths >= 2 ? "medium" : "low";

  // Determinar probabilidade do cenário otimista
  const optimisticProbability: ProbabilityLevel = 
    trend === "improving" && scoreStatus !== "critical" && scoreStatus !== "risk" ? "medium" : "low";

  // Gerar descrições baseadas no contexto
  const getConservativeImpact = () => {
    if (metrics.concentration > 60) {
      return "Previsibilidade permanece comprometida pela dependência de poucos dias de faturamento.";
    }
    if (metrics.recurrence < 20) {
      return "Vulnerabilidade estrutural mantida por baixa frequência operacional.";
    }
    if (metrics.daysActive < 5) {
      return "Fluxo financeiro continua irregular, limitando capacidade de planejamento.";
    }
    return "Padrão atual não favorece evolução consistente da saúde financeira.";
  };

  const getConservativeRisk = () => {
    if (metrics.concentration > 60) return "Concentração excessiva de receita";
    if (metrics.recurrence < 20) return "Baixa recorrência estrutural";
    if (metrics.daysActive < 5) return "Irregularidade operacional";
    return "Estagnação dos indicadores";
  };

  const getBaseDescription = () => {
    return `Correção gradual de ${limitingFactor} nos próximos ciclos operacionais.`;
  };

  const getBaseImpact = () => {
    if (limitingFactor === "regularidade") {
      return "Aumento de dias ativos fortalece previsibilidade e reduz vulnerabilidade a oscilações.";
    }
    if (limitingFactor === "recorrência") {
      return "Maior frequência operacional consolida base para decisões estratégicas.";
    }
    if (limitingFactor === "concentração") {
      return "Distribuição de receita reduz risco de impacto por eventos isolados.";
    }
    return "Fortalecimento gradual da base analítica para projeções confiáveis.";
  };

  const getOptimisticDescription = () => {
    return "Adoção plena das recomendações com manutenção de regularidade sustentável.";
  };

  const getOptimisticImpact = () => {
    return "Previsibilidade financeira consolidada, com base para planejamento de médio prazo.";
  };

  const getOptimisticBenefit = () => {
    if (scoreStatus === "critical" || scoreStatus === "risk") {
      return "Saída da zona de risco com estabilização dos indicadores";
    }
    if (scoreStatus === "attention") {
      return "Transição para zona saudável com ganho de governança";
    }
    return "Consolidação de excelência operacional e previsibilidade";
  };

  const scenarios: Scenario[] = [
    {
      id: "conservative",
      title: "Cenário Conservador",
      emoji: "🔵",
      premise: "Manutenção do padrão atual",
      description: "Se o padrão atual for mantido sem ajustes nos próximos meses.",
      impact: getConservativeImpact(),
      riskOrBenefit: getConservativeRisk(),
      riskOrBenefitLabel: "Risco predominante",
      trendIndicator: trend === "declining" ? "down" : "stable",
      probability: conservativeProbability,
      probabilityContext: "comportamento atual",
      scoreTrend: "↘ Tendência do Score: risco de permanecer em faixa crítica ou de atenção",
      punchline: "Mantém a operação, mas preserva o risco.",
      color: "text-slate-700 dark:text-slate-300",
      bgColor: "bg-slate-50 dark:bg-slate-900/50",
      borderColor: "border-slate-300 dark:border-slate-700"
    },
    {
      id: "base",
      title: "Cenário Base (Realista)",
      emoji: "🟢",
      premise: "Correção do fator limitante principal",
      description: getBaseDescription(),
      impact: getBaseImpact(),
      riskOrBenefit: `Tendência do Score`,
      riskOrBenefitLabel: "Evolução esperada",
      trendIndicator: "up",
      probability: baseProbability,
      probabilityContext: "depende de execução",
      scoreTrend: "↗ Tendência do Score: evolução gradual para faixa saudável",
      punchline: "Equilibra esforço operacional e ganho de previsibilidade.",
      color: "text-emerald-700 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderColor: "border-emerald-300 dark:border-emerald-800"
    },
    {
      id: "optimistic",
      title: "Cenário Otimista",
      emoji: "🌟",
      premise: "Adoção plena + regularidade sustentável",
      description: getOptimisticDescription(),
      impact: getOptimisticImpact(),
      riskOrBenefit: getOptimisticBenefit(),
      riskOrBenefitLabel: "Benefício estratégico",
      trendIndicator: "up-strong",
      probability: optimisticProbability,
      probabilityContext: "depende de execução",
      scoreTrend: "↗↗ Tendência do Score: estabilidade e alta previsibilidade",
      punchline: "Exige disciplina, mas muda estruturalmente a saúde financeira.",
      color: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-300 dark:border-amber-800"
    }
  ];

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <CardTitle className="text-lg font-bold">
            🎯 Cenários Estratégicos de Saúde Financeira
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          3 Caminhos Prospectivos — {currentYear}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
          🧭 Quais caminhos temos a partir daqui?
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        <div className="grid gap-4">
          {scenarios.map((scenario) => {
            const isActive = activeScenario === scenario.id;
            
            return (
              <div
                key={scenario.id}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all relative",
                  scenario.bgColor,
                  scenario.borderColor,
                  isActive && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {/* Badge de Cenário Ativo */}
                {isActive && (
                  <div className="absolute -top-2 right-3">
                    <Badge className="bg-primary text-primary-foreground text-[9px] px-2 py-0.5 shadow-sm">
                      <Check className="h-3 w-3 mr-1" />
                      Cenário Ativo
                    </Badge>
                  </div>
                )}

                {/* Header do Cenário */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{scenario.emoji}</span>
                    <div>
                      <h4 className={cn("font-semibold text-sm", scenario.color)}>
                        {scenario.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground italic">
                        {scenario.premise}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] px-2 py-0.5", getProbabilityColor(scenario.probability))}>
                    Prob. {getProbabilityLabel(scenario.probability)} ({scenario.probabilityContext})
                  </Badge>
                </div>

                {/* Descrição */}
                <p className="text-sm text-foreground/90 mb-3 leading-relaxed">
                  {scenario.description}
                </p>

                {/* Impacto */}
                <div className="p-2.5 rounded bg-background/60 border border-border/50 mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Impacto na previsibilidade:</p>
                  <p className="text-sm font-medium text-foreground/85">
                    {scenario.impact}
                  </p>
                </div>

                {/* Risco ou Benefício + Tendência */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {scenario.riskOrBenefitLabel}
                    </p>
                    <p className="text-xs font-medium text-foreground/80 mt-0.5">
                      {scenario.riskOrBenefit}
                    </p>
                  </div>
                  {scenario.trendIndicator && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-background/80 border border-border/30">
                      {getTrendIcon(scenario.trendIndicator)}
                      <span className="text-[10px] text-muted-foreground">Score</span>
                    </div>
                  )}
                </div>

                {/* Score Trend */}
                <p className="text-[11px] text-muted-foreground mt-2">
                  {scenario.scoreTrend}
                </p>

                {/* Punchline Executivo */}
                <p className="text-xs text-foreground/70 mt-2 italic border-t border-border/20 pt-2">
                  "{scenario.punchline}"
                </p>

                {/* Botão Marcar como Ativo */}
                {onScenarioChange && (
                  <div className="mt-3 pt-2 border-t border-border/20">
                    <Button
                      variant={isActive ? "secondary" : "outline"}
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => onScenarioChange(isActive ? null : scenario.id)}
                    >
                      {isActive ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Desmarcar cenário
                        </>
                      ) : (
                        "Marcar como Cenário Ativo"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota informativa */}
        <p className="text-[10px] text-muted-foreground/70 text-center italic">
          Cenários atualizados automaticamente conforme evolução dos indicadores mensais.
        </p>

        {/* Rodapé de Governança */}
        <p className="text-[10px] text-muted-foreground text-center pt-3 border-t">
          Cenários estratégicos são leituras prospectivas baseadas em padrões atuais. Não substituem projeções orçamentárias ou demonstrações oficiais.
        </p>
      </CardContent>
    </Card>
  );
}
