import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DREData } from "@/hooks/useDRE";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Target,
  Lightbulb,
  BarChart3,
  Building2,
  Percent,
  ArrowRight,
  Sparkles
} from "lucide-react";

type HealthStatus = "saudavel" | "atencao" | "critico";

interface DiagnosticResult {
  status: HealthStatus;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

interface MarginAnalysis {
  label: string;
  value: number;
  status: HealthStatus;
  explanation: string;
}

interface StructuralRisk {
  id: string;
  label: string;
  description: string;
  severity: "alta" | "media" | "baixa";
  icon: React.ElementType;
}

function getStatusConfig(status: HealthStatus): DiagnosticResult {
  switch (status) {
    case "saudavel":
      return {
        status,
        label: "Saudável",
        icon: CheckCircle2,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
        borderClass: "border-emerald-500",
      };
    case "atencao":
      return {
        status,
        label: "Atenção",
        icon: AlertCircle,
        colorClass: "text-amber-600 dark:text-amber-400",
        bgClass: "bg-amber-100 dark:bg-amber-900/30",
        borderClass: "border-amber-500",
      };
    case "critico":
      return {
        status,
        label: "Crítico",
        icon: AlertTriangle,
        colorClass: "text-red-600 dark:text-red-400",
        bgClass: "bg-red-100 dark:bg-red-900/30",
        borderClass: "border-red-500",
      };
  }
}

function classifyResult(value: number): HealthStatus {
  if (value > 0) return "saudavel";
  if (value >= -5000) return "atencao"; // Pequeno déficit
  return "critico";
}

function classifyMargin(margin: number, type: "assistencial" | "operacional" | "gerencial"): HealthStatus {
  const thresholds = {
    assistencial: { healthy: 20, warning: 10 },
    operacional: { healthy: 15, warning: 5 },
    gerencial: { healthy: 10, warning: 0 },
  };
  
  const t = thresholds[type];
  if (margin >= t.healthy) return "saudavel";
  if (margin >= t.warning) return "atencao";
  return "critico";
}

function getMarginExplanation(margin: number, type: "assistencial" | "operacional" | "gerencial"): string {
  if (type === "assistencial") {
    if (margin >= 30) return "Excelente rentabilidade assistencial. A operação de saúde gera valor significativo.";
    if (margin >= 20) return "Margem assistencial saudável. Operação sustentável com boa geração de valor.";
    if (margin >= 10) return "Margem assistencial moderada. Há espaço para otimização de custos diretos.";
    if (margin >= 0) return "Margem assistencial apertada. Revisar precificação e eficiência operacional.";
    return "Margem assistencial negativa. Custos diretos superam receitas — ação urgente necessária.";
  }
  
  if (type === "operacional") {
    if (margin >= 20) return "Resultado operacional robusto mesmo após custos estruturais.";
    if (margin >= 10) return "Resultado operacional positivo. Estrutura de custos compartilhados adequada.";
    if (margin >= 5) return "Margem operacional apertada. Custos compartilhados consomem parte significativa.";
    if (margin >= 0) return "Margem operacional mínima. Pouca folga para investimentos ou imprevistos.";
    return "Resultado operacional negativo. Custos estruturais superam capacidade de absorção.";
  }
  
  // gerencial
  if (margin >= 15) return "Resultado gerencial excelente. Empresa financeiramente sólida.";
  if (margin >= 8) return "Resultado gerencial positivo. Boa gestão global de receitas e despesas.";
  if (margin >= 0) return "Resultado gerencial neutro. Empresa opera no limite da sustentabilidade.";
  return "Resultado gerencial negativo. Dependência estrutural de receitas não operacionais ou ajustes.";
}

interface DREManagerialReadingProps {
  dre: DREData;
}

export function DREManagerialReading({ dre }: DREManagerialReadingProps) {
  // === ANÁLISE DIAGNÓSTICA ===
  const diagnostics = useMemo(() => {
    return {
      assistencial: {
        value: dre.resultadoOperacionalAssistencial,
        status: classifyResult(dre.resultadoOperacionalAssistencial),
        label: "Resultado Operacional Assistencial",
      },
      operacional: {
        value: dre.resultadoOperacionalTotal,
        status: classifyResult(dre.resultadoOperacionalTotal),
        label: "Resultado Operacional Total",
      },
      gerencial: {
        value: dre.resultadoGerencial,
        status: classifyResult(dre.resultadoGerencial),
        label: "Resultado Gerencial",
      },
    };
  }, [dre]);

  // === ANÁLISE DE MARGENS ===
  const marginAnalysis = useMemo((): MarginAnalysis[] => {
    return [
      {
        label: "Margem Assistencial",
        value: dre.margemOperacionalAssistencial,
        status: classifyMargin(dre.margemOperacionalAssistencial, "assistencial"),
        explanation: getMarginExplanation(dre.margemOperacionalAssistencial, "assistencial"),
      },
      {
        label: "Margem Operacional",
        value: dre.margemOperacionalTotal,
        status: classifyMargin(dre.margemOperacionalTotal, "operacional"),
        explanation: getMarginExplanation(dre.margemOperacionalTotal, "operacional"),
      },
      {
        label: "Margem Gerencial",
        value: dre.margemGerencial,
        status: classifyMargin(dre.margemGerencial, "gerencial"),
        explanation: getMarginExplanation(dre.margemGerencial, "gerencial"),
      },
    ];
  }, [dre]);

  // === ANÁLISE ESTRUTURAL ===
  const structuralAnalysis = useMemo(() => {
    const pesoCompartilhados = dre.receitaBrutaOperacional > 0
      ? (dre.custosCompartilhados / dre.receitaBrutaOperacional) * 100
      : 0;
    
    const dependenciaNaoOperacional = dre.resultadoOperacionalTotal < 0 && dre.resultadoGerencial > 0;
    const receitaNaoOpPeso = dre.receitaBrutaOperacional > 0
      ? (dre.receitasNaoOperacionais / dre.receitaBrutaOperacional) * 100
      : 0;

    const risks: StructuralRisk[] = [];

    // Peso de custos compartilhados
    if (pesoCompartilhados > 30) {
      risks.push({
        id: "compartilhados_alto",
        label: "Custos Compartilhados Elevados",
        description: `Custos estruturais representam ${pesoCompartilhados.toFixed(1)}% da receita operacional.`,
        severity: pesoCompartilhados > 40 ? "alta" : "media",
        icon: Building2,
      });
    }

    // Dependência de receitas não operacionais
    if (dependenciaNaoOperacional) {
      risks.push({
        id: "dependencia_nao_op",
        label: "Dependência de Receitas Não Operacionais",
        description: "O resultado positivo depende de receitas financeiras, não da operação assistencial.",
        severity: "alta",
        icon: AlertTriangle,
      });
    } else if (receitaNaoOpPeso > 20) {
      risks.push({
        id: "peso_nao_op",
        label: "Alto Peso de Receitas Não Operacionais",
        description: `Receitas não operacionais representam ${receitaNaoOpPeso.toFixed(1)}% da receita total.`,
        severity: "media",
        icon: BarChart3,
      });
    }

    // Previsibilidade (eventos extraordinários)
    if (Math.abs(dre.eventosExtraordinarios) > dre.receitaBrutaOperacional * 0.1) {
      risks.push({
        id: "eventos_extraordinarios",
        label: "Impacto de Eventos Extraordinários",
        description: "Eventos não recorrentes têm impacto significativo no resultado do período.",
        severity: "media",
        icon: Sparkles,
      });
    }

    return {
      pesoCompartilhados,
      dependenciaNaoOperacional,
      receitaNaoOpPeso,
      risks,
    };
  }, [dre]);

  // === TEXTO EXPLICATIVO AUTOMÁTICO ===
  const executiveReading = useMemo(() => {
    const parts: string[] = [];

    // Análise do resultado assistencial
    if (dre.resultadoOperacionalAssistencial > 0) {
      parts.push(`A operação assistencial gerou resultado positivo de ${formatCurrency(dre.resultadoOperacionalAssistencial)}, demonstrando que as unidades operam de forma sustentável.`);
    } else {
      parts.push(`A operação assistencial apresenta déficit de ${formatCurrency(Math.abs(dre.resultadoOperacionalAssistencial))}, indicando que os custos diretos superam a receita — situação que exige atenção imediata.`);
    }

    // Análise dos custos compartilhados
    if (structuralAnalysis.pesoCompartilhados > 25) {
      parts.push(`Os custos estruturais compartilhados (${structuralAnalysis.pesoCompartilhados.toFixed(0)}% da receita) pressionam a margem operacional.`);
    }

    // Análise de dependência não operacional
    if (structuralAnalysis.dependenciaNaoOperacional) {
      parts.push(`O resultado gerencial positivo depende de receitas não operacionais, o que representa fragilidade estrutural da empresa.`);
    }

    // Conclusão
    if (dre.resultadoGerencial > 0) {
      const marginQuality = dre.margemGerencial >= 10 ? "com margem confortável" : "com margem apertada";
      parts.push(`O período encerrou positivo ${marginQuality}.`);
    } else {
      parts.push(`O período encerrou com déficit de ${formatCurrency(Math.abs(dre.resultadoGerencial))}, exigindo revisão de custos ou ampliação de receitas.`);
    }

    return parts.join(" ");
  }, [dre, structuralAnalysis]);

  // === DECISÃO RECOMENDADA ===
  const recommendedAction = useMemo(() => {
    // Priorizar por criticidade
    if (dre.resultadoOperacionalAssistencial < 0) {
      return {
        title: "Revisar Custos Diretos",
        description: "Reduzir custos operacionais diretos ou aumentar preços para equilibrar operação assistencial.",
        urgency: "alta" as const,
      };
    }

    if (structuralAnalysis.dependenciaNaoOperacional) {
      return {
        title: "Fortalecer Operação Assistencial",
        description: "Ampliar receita operacional para reduzir dependência de receitas financeiras.",
        urgency: "alta" as const,
      };
    }

    if (structuralAnalysis.pesoCompartilhados > 35) {
      return {
        title: "Otimizar Custos Estruturais",
        description: "Renegociar contratos de serviços compartilhados ou buscar eficiência operacional.",
        urgency: "media" as const,
      };
    }

    if (dre.margemOperacionalTotal < 10 && dre.margemOperacionalTotal >= 0) {
      return {
        title: "Ampliar Margem de Segurança",
        description: "Margem operacional apertada — buscar incremento de receita ou redução de custos.",
        urgency: "media" as const,
      };
    }

    if (dre.resultadoGerencial > 0 && dre.margemGerencial >= 10) {
      return {
        title: "Manter Disciplina Operacional",
        description: "Resultados saudáveis — preservar padrão de gestão e avaliar reinvestimento.",
        urgency: "baixa" as const,
      };
    }

    return {
      title: "Monitorar Evolução",
      description: "Acompanhar indicadores mensalmente para identificar tendências.",
      urgency: "baixa" as const,
    };
  }, [dre, structuralAnalysis]);

  // Determinar status geral
  const overallStatus = useMemo(() => {
    const statuses = [diagnostics.assistencial.status, diagnostics.operacional.status, diagnostics.gerencial.status];
    if (statuses.includes("critico")) return "critico";
    if (statuses.includes("atencao")) return "atencao";
    return "saudavel";
  }, [diagnostics]);

  const overallConfig = getStatusConfig(overallStatus);
  const OverallIcon = overallConfig.icon;

  return (
    <Card className="border-0 shadow-soft overflow-hidden animate-fade-in">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Leitura Gerencial Automática</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Diagnóstico executivo do período</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1.5 px-3 py-1 font-semibold border-2",
              overallConfig.colorClass,
              overallConfig.borderClass
            )}
          >
            <OverallIcon className="h-3.5 w-3.5" />
            {overallConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* DIAGNÓSTICO DOS RESULTADOS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Target className="h-4 w-4" />
            Diagnóstico dos Resultados
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(diagnostics).map((d) => {
              const config = getStatusConfig(d.status);
              const Icon = config.icon;
              return (
                <div
                  key={d.label}
                  className={cn(
                    "p-4 rounded-xl border-l-4 transition-all",
                    "bg-gradient-to-r from-muted/30 to-transparent",
                    config.borderClass
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
                    <Badge variant="secondary" className={cn("text-xs gap-1", config.bgClass, config.colorClass)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-xl font-bold font-mono tabular-nums",
                    d.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  )}>
                    {d.value >= 0 ? "+" : ""}{formatCurrency(d.value)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ANÁLISE DE MARGENS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Percent className="h-4 w-4" />
            Análise de Margens
          </div>
          <div className="space-y-2">
            {marginAnalysis.map((m) => {
              const config = getStatusConfig(m.status);
              return (
                <div
                  key={m.label}
                  className="p-4 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{m.label}</span>
                      <Badge variant="outline" className={cn("text-xs font-mono", config.colorClass, config.borderClass)}>
                        {m.value.toFixed(1)}%
                      </Badge>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs", config.bgClass, config.colorClass)}>
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.explanation}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* RISCOS ESTRUTURAIS */}
        {structuralAnalysis.risks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4" />
              Riscos Estruturais Identificados
            </div>
            <div className="space-y-2">
              {structuralAnalysis.risks.map((risk) => {
                const Icon = risk.icon;
                return (
                  <Alert
                    key={risk.id}
                    variant={risk.severity === "alta" ? "destructive" : "default"}
                    className={cn(
                      risk.severity === "alta" && "border-destructive/50 bg-destructive/5",
                      risk.severity === "media" && "border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-1">
                      <span className="font-semibold">{risk.label}</span>
                      <span className="text-sm">{risk.description}</span>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          </div>
        )}

        {/* LEITURA EXECUTIVA */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Brain className="h-4 w-4" />
            Leitura Executiva
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
            <p className="text-sm leading-relaxed text-foreground/90">{executiveReading}</p>
          </div>
        </div>

        {/* DECISÃO RECOMENDADA */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Lightbulb className="h-4 w-4" />
            Decisão Recomendada
          </div>
          <div className={cn(
            "p-5 rounded-xl border-l-4 transition-all",
            recommendedAction.urgency === "alta" && "bg-red-50 dark:bg-red-900/10 border-l-red-500",
            recommendedAction.urgency === "media" && "bg-amber-50 dark:bg-amber-900/10 border-l-amber-500",
            recommendedAction.urgency === "baixa" && "bg-emerald-50 dark:bg-emerald-900/10 border-l-emerald-500"
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                recommendedAction.urgency === "alta" && "bg-red-100 dark:bg-red-900/30",
                recommendedAction.urgency === "media" && "bg-amber-100 dark:bg-amber-900/30",
                recommendedAction.urgency === "baixa" && "bg-emerald-100 dark:bg-emerald-900/30"
              )}>
                <ArrowRight className={cn(
                  "h-5 w-5",
                  recommendedAction.urgency === "alta" && "text-red-600 dark:text-red-400",
                  recommendedAction.urgency === "media" && "text-amber-600 dark:text-amber-400",
                  recommendedAction.urgency === "baixa" && "text-emerald-600 dark:text-emerald-400"
                )} />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{recommendedAction.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{recommendedAction.description}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
