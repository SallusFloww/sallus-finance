import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Radar, CheckCircle, Shield, Circle, Eye, CheckCheck, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthData {
  daysActive: number;
  recurrence: number;
  concentration: number;
  isValid: boolean;
}

interface IntelligentEarlyWarningProps {
  monthsData: MonthData[];
  trend: "improving" | "stable" | "declining";
  scoreStatus: "excellent" | "healthy" | "attention" | "risk" | "critical";
  currentYear: string;
}

type AlertLevel = "attention" | "warning" | "critical";
type RiskNature = "structural" | "transitory";
type AlertStatus = "novo" | "acompanhamento" | "mitigado" | "reincidente";

interface IntelligentAlert {
  id: string;
  riskType: string;
  level: AlertLevel;
  nature: RiskNature;
  trigger: string;
  impact: string;
  preventiveAction: string;
  ifNoAction: string;
  ifAction: string;
}

export function IntelligentEarlyWarning({ 
  monthsData, 
  trend, 
  scoreStatus,
  currentYear 
}: IntelligentEarlyWarningProps) {
  const [alertStatuses, setAlertStatuses] = useState<Record<string, AlertStatus>>({});
  
  const validMonths = monthsData.filter(m => m.isValid);
  const recentMonths = validMonths.slice(-3);
  const invalidMonthsStreak = monthsData.slice(-3).filter(m => !m.isValid).length;

  const getAlertStatus = (alertId: string): AlertStatus => {
    return alertStatuses[alertId] || "novo";
  };

  const setAlertStatus = (alertId: string, status: AlertStatus) => {
    setAlertStatuses(prev => ({ ...prev, [alertId]: status }));
  };

  const statusOptions: { value: AlertStatus; label: string; icon: typeof Circle }[] = [
    { value: "novo", label: "Novo", icon: Circle },
    { value: "acompanhamento", label: "Em acompanhamento", icon: Eye },
    { value: "mitigado", label: "Mitigado", icon: CheckCheck },
    { value: "reincidente", label: "Reincidente", icon: RefreshCw },
  ];

  const generateAlerts = (): IntelligentAlert[] => {
    const alerts: IntelligentAlert[] = [];

    if (recentMonths.length >= 2) {
      const lastTwo = recentMonths.slice(-2);
      
      // Queda de dias ativos por 2 meses consecutivos
      if (lastTwo.length === 2 && lastTwo[1].daysActive < lastTwo[0].daysActive) {
        const previousMonth = recentMonths.length >= 3 ? recentMonths[recentMonths.length - 3] : null;
        if (previousMonth && lastTwo[0].daysActive < previousMonth.daysActive) {
          alerts.push({
            id: "declining_activity_consecutive",
            riskType: "Queda consecutiva de regularidade",
            level: "warning",
            nature: "structural",
            trigger: "Dias ativos em declínio por 2 ciclos consecutivos.",
            impact: "Redução progressiva pode comprometer capacidade de planejamento e previsibilidade.",
            preventiveAction: "Garantir mínimo de 5 dias ativos no próximo ciclo para reverter tendência.",
            ifNoAction: "Risco de deterioração do Score nos próximos 2 ciclos.",
            ifAction: "Reversão esperada da tendência e convergência para o Cenário Base."
          });
        }
      }

      // Recorrência abaixo de 20% por 2 ciclos
      const lowRecurrenceCount = lastTwo.filter(m => m.recurrence < 20).length;
      if (lowRecurrenceCount >= 2) {
        alerts.push({
          id: "low_recurrence_persistent",
          riskType: "Recorrência estruturalmente baixa",
          level: "critical",
          nature: "structural",
          trigger: "Recorrência abaixo de 20% por 2 ciclos consecutivos.",
          impact: "Baixa frequência operacional compromete base analítica e decisões estratégicas.",
          preventiveAction: "Estruturar fluxo para atingir 20% de recorrência mínima nos próximos 60 dias.",
          ifNoAction: "Score permanece em faixa crítica com projeções comprometidas.",
          ifAction: "Melhoria gradual da confiabilidade analítica e estabilização do Score."
        });
      }

      // Concentração acima de 60% em ciclos consecutivos
      const highConcentrationCount = lastTwo.filter(m => m.concentration > 60).length;
      if (highConcentrationCount >= 2) {
        alerts.push({
          id: "high_concentration_persistent",
          riskType: "Concentração elevada recorrente",
          level: "warning",
          nature: "structural",
          trigger: "Concentração acima de 60% em ciclos consecutivos.",
          impact: "Concentração elevada recorrente pode comprometer a previsibilidade financeira nos próximos ciclos.",
          preventiveAction: "Distribuir faturamento em pelo menos 5 dias distintos no próximo mês.",
          ifNoAction: "Vulnerabilidade persistente a eventos pontuais e baixa previsibilidade.",
          ifAction: "Maior resiliência operacional e previsibilidade estabilizada."
        });
      }
    }

    // Base histórica insuficiente por mais de 2 meses
    if (invalidMonthsStreak >= 2) {
      alerts.push({
        id: "insufficient_base_extended",
        riskType: "Base histórica insuficiente prolongada",
        level: "attention",
        nature: "transitory",
        trigger: "Base histórica válida inferior a 3 meses por período prolongado.",
        impact: "Ausência de dados válidos limita confiabilidade de projeções e diagnósticos.",
        preventiveAction: "Manter regularidade mínima para consolidar base analítica confiável.",
        ifNoAction: "Projeções e Score permanecem com baixa confiabilidade.",
        ifAction: "Base matura naturalmente e confiabilidade analítica aumenta."
      });
    }

    // Divergência entre Cenário Base e comportamento real
    // Se o Score está em risco/crítico mas a tendência não é de melhora
    if ((scoreStatus === "risk" || scoreStatus === "critical") && trend !== "improving") {
      alerts.push({
        id: "scenario_divergence",
        riskType: "Divergência entre cenário e comportamento",
        level: "critical",
        nature: "structural",
        trigger: "Regularidade abaixo do cenário base por 2 ciclos consecutivos.",
        impact: "Comportamento atual não converge com o Cenário Base esperado — risco de deterioração.",
        preventiveAction: "Priorizar ação corretiva imediata no fator limitante principal.",
        ifNoAction: "Deterioração progressiva do Score e distanciamento do Cenário Base.",
        ifAction: "Convergência esperada para o Cenário Base em 2-3 ciclos."
      });
    }

    // Verificar padrão de instabilidade geral
    if (recentMonths.length >= 3) {
      const avgDaysActive = recentMonths.reduce((sum, m) => sum + m.daysActive, 0) / recentMonths.length;
      const avgRecurrence = recentMonths.reduce((sum, m) => sum + m.recurrence, 0) / recentMonths.length;
      
      if (avgDaysActive < 5 && avgRecurrence < 20 && !alerts.find(a => a.id === "low_recurrence_persistent")) {
        alerts.push({
          id: "structural_fragility",
          riskType: "Fragilidade estrutural identificada",
          level: "attention",
          nature: "structural",
          trigger: "Média de dias ativos e recorrência abaixo do mínimo por 3 ciclos.",
          impact: "Indicadores médios abaixo do mínimo indicam vulnerabilidade operacional persistente.",
          preventiveAction: "Revisar padrão operacional para garantir frequência e regularidade mínimas.",
          ifNoAction: "Vulnerabilidade operacional crônica e Score instável.",
          ifAction: "Fortalecimento gradual da base analítica e estabilização dos indicadores."
        });
      }
    }

    return alerts;
  };

  const alerts = generateAlerts();

  const getLevelConfig = (level: AlertLevel) => {
    switch (level) {
      case "attention":
        return {
          emoji: "🟡",
          label: "Atenção",
          sublabel: "padrão de risco em formação",
          color: "text-yellow-600 dark:text-yellow-500",
          bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
          borderColor: "border-yellow-300 dark:border-yellow-800",
          badgeClass: "border-yellow-400 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30"
        };
      case "warning":
        return {
          emoji: "🟠",
          label: "Alerta",
          sublabel: "risco provável nos próximos ciclos",
          color: "text-orange-600 dark:text-orange-500",
          bgColor: "bg-orange-50 dark:bg-orange-950/30",
          borderColor: "border-orange-300 dark:border-orange-800",
          badgeClass: "border-orange-400 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30"
        };
      case "critical":
        return {
          emoji: "🔴",
          label: "Crítico",
          sublabel: "impacto esperado se padrão persistir",
          color: "text-red-600 dark:text-red-500",
          bgColor: "bg-red-50 dark:bg-red-950/30",
          borderColor: "border-red-300 dark:border-red-800",
          badgeClass: "border-red-400 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
        };
    }
  };

  const getNatureConfig = (nature: RiskNature) => {
    switch (nature) {
      case "structural":
        return {
          emoji: "🔴",
          label: "Estrutural",
          description: "tende a se agravar se não houver ação",
          badgeClass: "border-red-300 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20"
        };
      case "transitory":
        return {
          emoji: "🟡",
          label: "Transitório",
          description: "tende a se resolver com maturação da base",
          badgeClass: "border-yellow-300 text-yellow-600 dark:text-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20"
        };
    }
  };

  // Ordenar alertas por severidade
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, attention: 2 };
    return order[a.level] - order[b.level];
  });

  return (
    <Card className="border-2 border-indigo-200 dark:border-indigo-800">
      <CardHeader className="pb-3 bg-indigo-50 dark:bg-indigo-950/30">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <CardTitle className="text-lg font-bold">
            🛡️ Early Warning System Inteligente
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Sensor preventivo de riscos latentes — {currentYear}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
          🧭 Quais riscos podem surgir antes de impactar o Score?
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {sortedAlerts.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Nenhum sinal antecipado relevante identificado
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os padrões atuais não indicam riscos latentes no período analisado.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => {
              const config = getLevelConfig(alert.level);
              const natureConfig = getNatureConfig(alert.nature);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border-l-4",
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  {/* Header do Alerta */}
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm">{config.emoji}</span>
                        <span className={cn("font-semibold text-sm", config.color)}>
                          {alert.riskType}
                        </span>
                        <Badge 
                          variant="outline"
                          className={cn("text-[9px] px-1.5 py-0 ml-1", natureConfig.badgeClass)}
                        >
                          {natureConfig.emoji} {natureConfig.label}
                        </Badge>
                      </div>
                      <Badge 
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", config.badgeClass)}
                      >
                        {config.label} — {config.sublabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Gatilho Identificado */}
                  <div className="mb-3 px-2 py-1.5 rounded bg-background/40 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Gatilho identificado:</span>{" "}
                      <span className="text-foreground/80">{alert.trigger}</span>
                    </p>
                  </div>

                  {/* Impacto na Previsibilidade */}
                  <div className="p-2.5 rounded bg-background/60 border border-border/30 mb-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      Impacto na previsibilidade
                    </p>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {alert.impact}
                    </p>
                  </div>

                  {/* Consequência Decisória */}
                  <div className="p-2.5 rounded bg-background/40 border border-border/20 mb-3 space-y-1">
                    <p className="text-[10px] text-red-600 dark:text-red-400">
                      <span className="font-medium">Se não agir:</span>{" "}
                      <span className="text-foreground/80">{alert.ifNoAction}</span>
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">Se agir:</span>{" "}
                      <span className="text-foreground/80">{alert.ifAction}</span>
                    </p>
                  </div>

                  {/* Ação Preventiva */}
                  <div className="flex items-start gap-2 pt-2 border-t border-border/30">
                    <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/80 font-medium">
                      {alert.preventiveAction}
                    </p>
                  </div>

                  {/* Status do Alerta */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        Status do Alerta
                      </p>
                      {getAlertStatus(alert.id) === "reincidente" && (
                        <Badge 
                          variant="outline" 
                          className="text-[9px] px-1.5 py-0 border-red-300 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20"
                        >
                          ⚠️ Risco recorrente
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {statusOptions.map((option) => {
                        const isActive = getAlertStatus(alert.id) === option.value;
                        const IconComponent = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setAlertStatus(alert.id, option.value)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-all",
                              isActive
                                ? "bg-primary/10 border-primary text-primary font-medium"
                                : "bg-background/60 border-border/40 text-muted-foreground hover:border-border hover:bg-background/80"
                            )}
                          >
                            <IconComponent className={cn("h-3 w-3", isActive && "text-primary")} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Micro-bloco de Governança */}
                    <div className="mt-2 pt-2 border-t border-border/20 flex items-center gap-3 text-[9px] text-muted-foreground/70">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>
                        Última avaliação: {format(new Date(), "MMM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-muted-foreground/40">•</span>
                      <span>
                        Próxima reavaliação: {format(addMonths(new Date(), 1), "MMM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Nota informativa */}
        <p className="text-[10px] text-muted-foreground/70 text-center italic">
          Sinais monitorados automaticamente conforme evolução dos indicadores mensais.
        </p>

        {/* Rodapé de Governança */}
        <p className="text-[10px] text-muted-foreground text-center pt-3 border-t">
          Alertas são preventivos e gerenciais. Não substituem Score, Projeção ou relatórios oficiais. Atualização automática mensal.
        </p>
      </CardContent>
    </Card>
  );
}
