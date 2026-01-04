import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Building2,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Target,
  ShieldCheck,
  Shield,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  ScoreHistoryData, 
  MonthlyGlobalScoreData, 
  UnitMaturityHistory,
  GlobalScoreStatus,
  UnitMaturityTrend 
} from "@/hooks/useScoreHistory";
import { useState } from "react";
import { MaturityAlerts } from "./MaturityAlerts";
import { useMaturityAlerts } from "@/hooks/useMaturityAlerts";

interface ScoreHistoryProps {
  data: ScoreHistoryData;
}

export function ScoreHistory({ data }: ScoreHistoryProps) {
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const getStatusColor = (status: GlobalScoreStatus) => {
    switch (status) {
      case "released": return "bg-green-500";
      case "partial": return "bg-yellow-500";
      default: return "bg-red-500";
    }
  };

  const getStatusLabel = (status: GlobalScoreStatus) => {
    switch (status) {
      case "released": return "Liberado";
      case "partial": return "Parcial";
      default: return "Indisponível";
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "excellent": return "text-green-600 bg-green-50 border-green-200";
      case "healthy": return "text-green-600 bg-green-50 border-green-200";
      case "attention": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "risk": return "text-orange-600 bg-orange-50 border-orange-200";
      case "critical": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-muted-foreground bg-muted border-muted";
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case "excellent": return "Excelente";
      case "healthy": return "Saudável";
      case "attention": return "Atenção";
      case "risk": return "Risco";
      case "critical": return "Crítico";
      default: return "Indisponível";
    }
  };

  const getTrendIcon = (trend: UnitMaturityTrend) => {
    switch (trend) {
      case "growing": return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "regressive": return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: UnitMaturityTrend) => {
    switch (trend) {
      case "growing": return "🔼 Crescente";
      case "regressive": return "🔻 Regressiva";
      default: return "➖ Estável";
    }
  };

  const getTrendBadgeClass = (trend: UnitMaturityTrend) => {
    switch (trend) {
      case "growing": return "bg-green-100 text-green-800 border-green-300";
      case "regressive": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStateIcon = (state: "not-eligible" | "partial" | "eligible") => {
    switch (state) {
      case "eligible": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial": return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStateLabel = (state: "not-eligible" | "partial" | "eligible") => {
    switch (state) {
      case "eligible": return "Elegível";
      case "partial": return "Parcial";
      default: return "Não elegível";
    }
  };

  const getMaturityColor = (percentage: number) => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 66) return "bg-yellow-500";
    if (percentage >= 33) return "bg-orange-500";
    return "bg-red-500";
  };

  // Get position badge for ranking
  const getPositionBadge = (position: number) => {
    if (position === 1) return <Badge className="bg-yellow-400 text-yellow-900 border-yellow-500">🏆 1º</Badge>;
    if (position === 2) return <Badge variant="outline" className="border-gray-400">🥈 2º</Badge>;
    if (position === 3) return <Badge variant="outline" className="border-orange-400">🥉 3º</Badge>;
    return <Badge variant="outline">{position}º</Badge>;
  };

  // Calculate maturity alerts
  const maturityAlerts = useMaturityAlerts(data);

  return (
    <div className="space-y-6">
      {/* Maturity Alerts */}
      <MaturityAlerts data={maturityAlerts} />

      {/* Timeline Header */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Histórico do Score Global</CardTitle>
          </div>
          <CardDescription>
            Evolução mensal do Score Global nos últimos 12 meses
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Timeline Grid */}
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-2">
              <TooltipProvider>
                {data.monthlyHistory.map((month, index) => (
                  <Tooltip key={month.monthKey}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-pointer group">
                        <div 
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm transition-transform group-hover:scale-110",
                            getStatusColor(month.globalStatus)
                          )}
                        >
                          {month.globalScore !== null ? month.globalScore : "—"}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          {month.monthLabel.split(" ")[0]}
                        </span>
                        {index === data.monthlyHistory.length - 1 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Atual
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold">{month.monthLabel}</p>
                        <div className="flex items-center gap-2">
                          <span>Status:</span>
                          <Badge className={cn("text-xs", getClassificationColor(month.classification))}>
                            {getClassificationLabel(month.classification)}
                          </Badge>
                        </div>
                        {month.globalScore !== null && (
                          <p>Score: <strong>{month.globalScore}</strong></p>
                        )}
                        <p>Unidades elegíveis: {month.eligibleUnitsCount}</p>
                        {month.eligibleUnitNames.length > 0 && (
                          <p className="text-xs text-green-600">
                            ✓ {month.eligibleUnitNames.join(", ")}
                          </p>
                        )}
                        {month.blockingCriterion && (
                          <p className="text-xs text-amber-600">
                            ⚠️ Bloqueio: {month.blockingCriterion}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Liberado</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Indisponível</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maturity Ranking */}
      <Card className="border-2 border-amber-200/50">
        <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg font-bold">Ranking de Maturidade</CardTitle>
          </div>
          <CardDescription>
            Ordenado por média de maturidade (6 meses) e frequência de elegibilidade
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {data.maturityRanking.map((unit, index) => (
              <div 
                key={unit.unitId}
                className={cn(
                  "p-4 rounded-lg border",
                  index === 0 ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 dark:from-yellow-950/30 dark:to-amber-950/30" : "bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getPositionBadge(index + 1)}
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{unit.unitName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getTrendBadgeClass(unit.trend)}>
                      {getTrendLabel(unit.trend)}
                    </Badge>
                    {getStateIcon(unit.currentState)}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                    <p className="text-xs text-muted-foreground mb-1">Maturidade Atual</p>
                    <p className="text-2xl font-bold">{unit.currentMaturity}%</p>
                  </div>
                  <div className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                    <p className="text-xs text-muted-foreground mb-1">Média 6 meses</p>
                    <p className="text-2xl font-bold">{unit.averageMaturity6Months}%</p>
                  </div>
                  <div className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                    <p className="text-xs text-muted-foreground mb-1">Freq. Elegível</p>
                    <p className="text-2xl font-bold">{unit.eligibilityFrequency}%</p>
                  </div>
                  <div className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                    <p className="text-xs text-muted-foreground mb-1">Tendência</p>
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(unit.trend)}
                      <span className="text-sm font-medium">
                        {unit.trend === "growing" ? "Melhora" : unit.trend === "regressive" ? "Piora" : "Estável"}
                      </span>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "text-center p-2 rounded cursor-help",
                          unit.reliabilityLevel === "high" ? "bg-green-50 dark:bg-green-950/30" :
                          unit.reliabilityLevel === "medium" ? "bg-yellow-50 dark:bg-yellow-950/30" :
                          "bg-red-50 dark:bg-red-950/30"
                        )}>
                          <p className="text-xs text-muted-foreground mb-1">Confiabilidade</p>
                          <div className="flex items-center justify-center gap-1">
                            {unit.reliabilityLevel === "high" ? (
                              <ShieldCheck className="h-5 w-5 text-green-600" />
                            ) : unit.reliabilityLevel === "medium" ? (
                              <Shield className="h-5 w-5 text-yellow-600" />
                            ) : (
                              <ShieldAlert className="h-5 w-5 text-red-600" />
                            )}
                            <span className={cn(
                              "text-lg font-bold",
                              unit.reliabilityLevel === "high" ? "text-green-700" :
                              unit.reliabilityLevel === "medium" ? "text-yellow-700" :
                              "text-red-700"
                            )}>
                              {unit.reliabilityScore}%
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3">
                        <p className="font-semibold mb-2">Score de Confiabilidade</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Base Histórica (30%):</span>
                            <span className="font-medium">{unit.reliabilityComponents.historicalBase.contribution} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Elegibilidade (30%):</span>
                            <span className="font-medium">{unit.reliabilityComponents.eligibilityConsistency.contribution} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estabilidade (25%):</span>
                            <span className="font-medium">{unit.reliabilityComponents.criteriaStability.contribution} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Regularidade (15%):</span>
                            <span className="font-medium">{unit.reliabilityComponents.operationalRegularity.contribution} pts</span>
                          </div>
                        </div>
                        {unit.hasCriticalRegressionRecent && (
                          <p className="mt-2 text-xs text-red-600">
                            ⚠️ Regressão crítica detectada nos últimos 3 meses
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unit Details (Expandable) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Detalhamento por Unidade</CardTitle>
          </div>
          <CardDescription>
            Histórico mensal de maturidade e critérios atendidos
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {data.unitMaturityHistory.map(unit => (
            <Collapsible 
              key={unit.unitId}
              open={expandedUnits[unit.unitId]}
              onOpenChange={() => toggleUnit(unit.unitId)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{unit.unitName}</span>
                    <Badge variant="outline" className={getTrendBadgeClass(unit.trend)}>
                      {getTrendLabel(unit.trend)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Atual:</span>
                      <Badge className={cn(
                        "text-xs",
                        unit.currentState === "eligible" ? "bg-green-100 text-green-800" :
                        unit.currentState === "partial" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      )}>
                        {unit.currentMaturity}%
                      </Badge>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 transition-transform",
                      expandedUnits[unit.unitId] && "rotate-180"
                    )} />
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-2 p-4 rounded-lg border bg-background">
                  <div className="overflow-x-auto">
                    <div className="flex gap-3 min-w-max">
                      {unit.monthlyData.map((monthData, idx) => (
                        <div 
                          key={idx}
                          className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 min-w-[80px]"
                        >
                          <span className="text-xs text-muted-foreground capitalize">
                            {monthData.monthLabel.split(" ")[0]}
                          </span>
                          <div className="w-full">
                            <Progress 
                              value={monthData.maturityPercentage} 
                              className={cn(
                                "h-2",
                                monthData.state === "eligible" ? "[&>div]:bg-green-500" :
                                monthData.state === "partial" ? "[&>div]:bg-yellow-500" :
                                "[&>div]:bg-red-500"
                              )}
                            />
                          </div>
                          <span className="text-sm font-bold">
                            {monthData.maturityPercentage}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {monthData.criteriaMetCount}/3
                          </span>
                          {getStateIcon(monthData.state)}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Média 6 meses</p>
                      <p className="text-lg font-bold">{unit.averageMaturity6Months}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Freq. Elegível</p>
                      <p className="text-lg font-bold">{unit.eligibilityFrequency}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tendência</p>
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(unit.trend)}
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
