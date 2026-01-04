import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  Building2,
  Target,
  Zap,
  Clock,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MaturityAlertsData, MaturityAlert, AlertSeverity } from "@/hooks/useMaturityAlerts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface MaturityAlertsProps {
  data: MaturityAlertsData;
}

export function MaturityAlerts({ data }: MaturityAlertsProps) {
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  const toggleAlert = (alertId: string) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "moderate":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "stagnation":
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            🔴 Regressão Crítica
          </Badge>
        );
      case "moderate":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            🟡 Regressão Moderada
          </Badge>
        );
      case "stagnation":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            🔵 Estagnação
          </Badge>
        );
    }
  };

  const getSeverityCardClass = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "border-red-300 bg-gradient-to-r from-red-50 to-transparent dark:from-red-950/30";
      case "moderate":
        return "border-yellow-300 bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/30";
      case "stagnation":
        return "border-blue-300 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30";
    }
  };

  const getStateLabel = (state: "not-eligible" | "partial" | "eligible") => {
    switch (state) {
      case "eligible": return "Elegível";
      case "partial": return "Parcial";
      default: return "Não Elegível";
    }
  };

  const getStateBadgeClass = (state: "not-eligible" | "partial" | "eligible") => {
    switch (state) {
      case "eligible": return "bg-green-100 text-green-800 border-green-300";
      case "partial": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default: return "bg-red-100 text-red-800 border-red-300";
    }
  };

  if (!data.hasActiveAlerts) {
    return (
      <Card className="border-2 border-green-200/50">
        <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-transparent dark:from-green-950/30">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg font-bold">Alertas de Maturidade</CardTitle>
          </div>
          <CardDescription>
            Monitoramento de regressões e estagnações
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                Nenhum alerta ativo
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Todas as unidades mantêm evolução positiva ou estável.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-amber-200/50">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg font-bold">Alertas de Maturidade</CardTitle>
          </div>
          <div className="flex gap-2">
            {data.criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-300">
                🔴 {data.criticalCount}
              </Badge>
            )}
            {data.moderateCount > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                🟡 {data.moderateCount}
              </Badge>
            )}
            {data.stagnationCount > 0 && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                🔵 {data.stagnationCount}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {data.alerts.length} alerta{data.alerts.length !== 1 ? "s" : ""} identificado{data.alerts.length !== 1 ? "s" : ""} no período atual
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Summary Banner */}
        {data.criticalCount > 0 && (
          <Alert className="border-red-300 bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 dark:text-red-200">
              Atenção: {data.criticalCount} regressão crítica identificada
            </AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400">
              Ação imediata recomendada para evitar impacto no Score Global.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert Cards */}
        <div className="space-y-3">
          {data.alerts.map(alert => (
            <Collapsible
              key={alert.id}
              open={expandedAlerts[alert.id]}
              onOpenChange={() => toggleAlert(alert.id)}
            >
              <div className={cn(
                "rounded-lg border p-4",
                getSeverityCardClass(alert.severity)
              )}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(alert.severity)}
                          <Badge variant="outline" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {alert.unitName}
                          </Badge>
                        </div>
                        <p className="font-semibold text-sm">{alert.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform shrink-0 mt-1",
                      expandedAlerts[alert.id] && "rotate-180"
                    )} />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Month Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-xs text-muted-foreground mb-2">
                          {alert.previousMonth.label}
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getStateBadgeClass(alert.previousMonth.state)}>
                            {getStateLabel(alert.previousMonth.state)}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold">
                          {alert.previousMonth.maturityPercentage}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.previousMonth.criteriaMetCount}/3 critérios
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 relative">
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {alert.currentMonth.label}
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getStateBadgeClass(alert.currentMonth.state)}>
                            {getStateLabel(alert.currentMonth.state)}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold">
                          {alert.currentMonth.maturityPercentage}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.currentMonth.criteriaMetCount}/3 critérios
                        </p>
                      </div>
                    </div>

                    {/* Criteria Affected */}
                    {alert.criteriaAffected.length > 0 && (
                      <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-xs text-muted-foreground mb-2">
                          Critério(s) afetado(s)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {alert.criteriaAffected.map(criterion => (
                            <Badge key={criterion} variant="outline" className="border-red-300 text-red-700">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              {criterion}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Action */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Ação sugerida
                          </p>
                          <p className="text-sm font-medium">
                            {alert.suggestedAction}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Global Score Impact */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Impacto no Score Global
                          </p>
                          <p className="text-sm">
                            {alert.globalScoreImpact}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {/* Legend */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Legenda de severidade</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Crítica: Elegível → Não elegível ou perda ≥2 critérios</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Moderada: Perda de 1 critério ou queda ≥33%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Estagnação: Sem evolução por 3 meses</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary component for use in other views
interface MaturityAlertsSummaryProps {
  data: MaturityAlertsData;
}

export function MaturityAlertsSummary({ data }: MaturityAlertsSummaryProps) {
  if (!data.hasActiveAlerts) return null;

  return (
    <Alert className={cn(
      "border",
      data.criticalCount > 0 
        ? "border-red-300 bg-red-50 dark:bg-red-950/30" 
        : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30"
    )}>
      {data.criticalCount > 0 ? (
        <AlertCircle className="h-4 w-4 text-red-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
      )}
      <AlertTitle className={data.criticalCount > 0 ? "text-red-800" : "text-yellow-800"}>
        {data.alerts.length} alerta{data.alerts.length !== 1 ? "s" : ""} de maturidade
      </AlertTitle>
      <AlertDescription className={data.criticalCount > 0 ? "text-red-600" : "text-yellow-600"}>
        {data.criticalCount > 0 && (
          <span className="font-medium">
            {data.criticalCount} crítico{data.criticalCount !== 1 ? "s" : ""}
          </span>
        )}
        {data.criticalCount > 0 && data.moderateCount > 0 && " · "}
        {data.moderateCount > 0 && (
          <span>{data.moderateCount} moderado{data.moderateCount !== 1 ? "s" : ""}</span>
        )}
        {(data.criticalCount > 0 || data.moderateCount > 0) && data.stagnationCount > 0 && " · "}
        {data.stagnationCount > 0 && (
          <span>{data.stagnationCount} estagnação</span>
        )}
        <span className="block mt-1 text-sm">
          Consulte a aba Histórico para detalhes.
        </span>
      </AlertDescription>
    </Alert>
  );
}
