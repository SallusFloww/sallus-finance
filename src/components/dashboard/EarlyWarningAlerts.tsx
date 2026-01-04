import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthData {
  daysActive: number;
  recurrence: number;
  concentration: number;
  isValid: boolean;
}

interface EarlyWarningAlertsProps {
  monthsData: MonthData[];
  projectionStatus: "improving" | "stable" | "declining" | "insufficient";
  currentYear: string;
}

type AlertLevel = "attention" | "warning" | "critical";

interface Alert {
  id: string;
  title: string;
  level: AlertLevel;
  description: string;
}

export function EarlyWarningAlerts({ monthsData, projectionStatus, currentYear }: EarlyWarningAlertsProps) {
  const validMonths = monthsData.filter(m => m.isValid);
  const recentMonths = validMonths.slice(-3);

  const generateAlerts = (): Alert[] => {
    const alerts: Alert[] = [];

    // Verificar últimos 2 meses para padrões consecutivos
    if (recentMonths.length >= 2) {
      const lastTwo = recentMonths.slice(-2);
      
      // Queda de dias ativos por 2 meses consecutivos
      if (lastTwo[1].daysActive < lastTwo[0].daysActive && lastTwo[0].daysActive < (recentMonths[0]?.daysActive || lastTwo[0].daysActive + 1)) {
        alerts.push({
          id: "declining_activity",
          title: "Queda consecutiva de dias ativos",
          level: "warning",
          description: "Redução progressiva de dias ativos pode comprometer regularidade nos próximos ciclos."
        });
      }

      // Recorrência abaixo de 20% por 2 meses
      const lowRecurrenceMonths = lastTwo.filter(m => m.recurrence < 20).length;
      if (lowRecurrenceMonths >= 2) {
        alerts.push({
          id: "low_recurrence",
          title: "Recorrência persistentemente baixa",
          level: "critical",
          description: "Recorrência abaixo de 20% por dois meses consecutivos indica vulnerabilidade estrutural."
        });
      }

      // Concentração acima de 60% em 2 meses
      const highConcentrationMonths = lastTwo.filter(m => m.concentration > 60).length;
      if (highConcentrationMonths >= 2) {
        alerts.push({
          id: "high_concentration",
          title: "Concentração elevada recorrente",
          level: "warning",
          description: "Concentração elevada recorrente pode comprometer previsibilidade nos próximos meses."
        });
      }
    }

    // Projeção marcada como "limitada" por base insuficiente
    if (projectionStatus === "insufficient") {
      alerts.push({
        id: "insufficient_base",
        title: "Base histórica insuficiente",
        level: "attention",
        description: "Dados históricos limitados reduzem a confiabilidade da previsibilidade financeira."
      });
    }

    // Projeção de deterioração (tendência crítica)
    if (projectionStatus === "declining") {
      alerts.push({
        id: "declining_trend",
        title: "Tendência de deterioração identificada",
        level: "critical",
        description: "Padrões atuais indicam risco de impacto negativo na saúde financeira."
      });
    }

    // Verificar média de indicadores nos últimos meses
    if (recentMonths.length >= 2) {
      const avgDaysActive = recentMonths.reduce((sum, m) => sum + m.daysActive, 0) / recentMonths.length;
      const avgRecurrence = recentMonths.reduce((sum, m) => sum + m.recurrence, 0) / recentMonths.length;

      // Média de dias ativos muito baixa (instabilidade)
      if (avgDaysActive < 5 && !alerts.find(a => a.id === "low_recurrence")) {
        alerts.push({
          id: "low_activity_avg",
          title: "Regularidade abaixo do mínimo",
          level: "attention",
          description: "Média de dias ativos inferior ao recomendado para estabilidade operacional."
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
          color: "text-yellow-600 dark:text-yellow-500",
          bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
          borderColor: "border-yellow-300 dark:border-yellow-800",
          badgeVariant: "outline" as const,
          badgeClass: "border-yellow-400 text-yellow-700 dark:text-yellow-400"
        };
      case "warning":
        return {
          emoji: "🟠",
          label: "Alerta",
          color: "text-orange-600 dark:text-orange-500",
          bgColor: "bg-orange-50 dark:bg-orange-950/30",
          borderColor: "border-orange-300 dark:border-orange-800",
          badgeVariant: "outline" as const,
          badgeClass: "border-orange-400 text-orange-700 dark:text-orange-400"
        };
      case "critical":
        return {
          emoji: "🔴",
          label: "Crítico",
          color: "text-red-600 dark:text-red-500",
          bgColor: "bg-red-50 dark:bg-red-950/30",
          borderColor: "border-red-300 dark:border-red-800",
          badgeVariant: "outline" as const,
          badgeClass: "border-red-400 text-red-700 dark:text-red-400"
        };
    }
  };

  // Ordenar alertas por severidade (crítico primeiro)
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, attention: 2 };
    return order[a.level] - order[b.level];
  });

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <CardTitle className="text-lg font-bold">
            🚨 Alertas Antecipados de Saúde Financeira
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Early Warning System — {currentYear}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
          🧭 O que pode dar errado antes de virar problema?
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {sortedAlerts.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
            <CheckCircle className="h-6 w-6 text-slate-500" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Nenhum alerta antecipado identificado
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os indicadores atuais não apresentam sinais de risco iminente.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => {
              const config = getLevelConfig(alert.level);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border-l-4",
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">{config.emoji}</span>
                        <span className={cn("font-semibold text-sm", config.color)}>
                          {alert.title}
                        </span>
                        <Badge 
                          variant={config.badgeVariant}
                          className={cn("text-[10px] px-1.5 py-0", config.badgeClass)}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                        {alert.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Recomendação preventiva: manter regularidade mínima de movimentações pelos próximos 60 dias para consolidar base histórica.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Nota informativa */}
        <p className="text-[10px] text-muted-foreground/70 text-center italic">
          Novos alertas serão ativados automaticamente à medida que padrões recorrentes forem identificados.
        </p>

        {/* Rodapé de Governança */}
        <p className="text-[10px] text-muted-foreground text-center pt-3 border-t">
          Alertas são preventivos e não substituem Score nem Projeção. Atualização automática mensal.
        </p>
      </CardContent>
    </Card>
  );
}
