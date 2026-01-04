import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScenarioId } from "./StrategicScenarios";

interface MonthData {
  daysActive: number;
  recurrence: number;
  concentration: number;
  isValid: boolean;
}

interface HealthProjectionProps {
  monthsData: MonthData[];
  currentYear: string;
  activeScenario?: ScenarioId;
}

type TrendDirection = "up" | "down" | "stable";

interface ScenarioProjection {
  id: string;
  title: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  regularidade: { trend: TrendDirection; text: string };
  concentracao: { trend: TrendDirection; text: string };
  previsibilidade: { trend: TrendDirection; text: string };
  executiveReading: string;
}

export function HealthProjection({ monthsData, currentYear, activeScenario }: HealthProjectionProps) {
  const validMonths = monthsData.filter(m => m.isValid);
  const hasEnoughData = validMonths.length >= 3;

  const confidenceLevel = hasEnoughData ? "moderada" : "limitada";
  const confidenceBadgeColor = hasEnoughData 
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  const getTrendIcon = (trend: TrendDirection) => {
    switch (trend) {
      case "up": return <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />;
      case "down": return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
      case "stable": return <ArrowRight className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  const getTrendSymbol = (trend: TrendDirection) => {
    switch (trend) {
      case "up": return "↗";
      case "down": return "↘";
      case "stable": return "→";
    }
  };

  const scenarioProjections: ScenarioProjection[] = [
    {
      id: "conservative",
      title: "Cenário Conservador",
      emoji: "🔵",
      color: "text-slate-700 dark:text-slate-300",
      bgColor: "bg-slate-50 dark:bg-slate-900/50",
      borderColor: "border-slate-300 dark:border-slate-700",
      regularidade: { 
        trend: "stable", 
        text: "tende a permanecer baixa" 
      },
      concentracao: { 
        trend: "stable", 
        text: "risco de manter níveis elevados" 
      },
      previsibilidade: { 
        trend: "down", 
        text: "comprometida" 
      },
      executiveReading: "Sem ajustes, a saúde financeira tende a permanecer vulnerável a eventos pontuais."
    },
    {
      id: "base",
      title: "Cenário Base (Realista)",
      emoji: "🟢",
      color: "text-emerald-700 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderColor: "border-emerald-300 dark:border-emerald-800",
      regularidade: { 
        trend: "up", 
        text: "tendência de melhoria gradual" 
      },
      concentracao: { 
        trend: "up", 
        text: "redução progressiva" 
      },
      previsibilidade: { 
        trend: "stable", 
        text: "moderada" 
      },
      executiveReading: "Com execução consistente, a previsibilidade financeira tende a se estabilizar."
    },
    {
      id: "optimistic",
      title: "Cenário Otimista",
      emoji: "🌟",
      color: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-300 dark:border-amber-800",
      regularidade: { 
        trend: "up", 
        text: "sustentada" 
      },
      concentracao: { 
        trend: "up", 
        text: "sob controle" 
      },
      previsibilidade: { 
        trend: "up", 
        text: "alta" 
      },
      executiveReading: "Adoção plena das recomendações tende a consolidar saúde financeira e capacidade de planejamento."
    }
  ];

  // Determinar cenário ativo para exibição
  const getActiveScenarioLabel = () => {
    if (!activeScenario) return null;
    switch (activeScenario) {
      case "conservative": return "Cenário Conservador";
      case "base": return "Cenário Base (Realista)";
      case "optimistic": return "Cenário Otimista";
      default: return null;
    }
  };

  const activeScenarioLabel = getActiveScenarioLabel();

  // Filtrar cenários se houver um ativo
  const displayScenarios = activeScenario 
    ? scenarioProjections.filter(s => s.id === activeScenario)
    : scenarioProjections;

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">
              🔮 Projeção de Saúde Financeira (3–6 meses)
            </CardTitle>
          </div>
          <Badge className={cn("text-[10px] px-2 py-0.5", confidenceBadgeColor)}>
            Confiança {confidenceLevel}
          </Badge>
        </div>

        {/* Indicador de Cenário Ativo */}
        {activeScenarioLabel ? (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-primary">
              Projeção baseada no {activeScenarioLabel}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Horizonte prospectivo: {currentYear}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
          🧭 Se escolhermos um caminho, o que tende a acontecer?
        </p>
        {!hasEnoughData && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
            Projeção com confiança limitada — base em formação ({validMonths.length}/3 meses válidos)
          </p>
        )}

        {!activeScenario && (
          <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
            💡 Selecione um cenário ativo acima para ver a projeção específica
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        <div className="grid gap-3">
          {displayScenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                scenario.bgColor,
                scenario.borderColor
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{scenario.emoji}</span>
                <h4 className={cn("font-semibold text-sm", scenario.color)}>
                  {scenario.title}
                </h4>
              </div>

              {/* Indicadores de Projeção */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 rounded bg-background/60 border border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    {getTrendIcon(scenario.regularidade.trend)}
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Regularidade
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80">
                    {getTrendSymbol(scenario.regularidade.trend)} {scenario.regularidade.text}
                  </p>
                </div>

                <div className="p-2 rounded bg-background/60 border border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    {getTrendIcon(scenario.concentracao.trend)}
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Concentração
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80">
                    {getTrendSymbol(scenario.concentracao.trend)} {scenario.concentracao.text}
                  </p>
                </div>

                <div className="p-2 rounded bg-background/60 border border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    {getTrendIcon(scenario.previsibilidade.trend)}
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Previsibilidade
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80">
                    {getTrendSymbol(scenario.previsibilidade.trend)} {scenario.previsibilidade.text}
                  </p>
                </div>
              </div>

              {/* Leitura Executiva */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-foreground/80 italic leading-relaxed">
                  "{scenario.executiveReading}"
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Nota informativa */}
        <p className="text-[10px] text-muted-foreground/70 text-center italic">
          Projeções atualizadas automaticamente conforme evolução do Score e classificação de cenários.
        </p>

        {/* Rodapé de Governança */}
        <p className="text-[10px] text-muted-foreground text-center pt-3 border-t">
          Esta projeção é uma estimativa gerencial baseada em padrões históricos e cenários estratégicos. Não substitui projeções orçamentárias, análises contábeis ou demonstrações oficiais.
        </p>
      </CardContent>
    </Card>
  );
}
