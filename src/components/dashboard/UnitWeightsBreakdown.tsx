import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Info,
  AlertCircle,
  Scale,
  TrendingUp,
  CheckCircle,
  Circle,
  Target,
  Calendar,
  FileText,
  PieChart,
  Shield,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
// Import master eligibility rules and types - SINGLE SOURCE OF TRUTH
import { ELIGIBILITY_RULES, UnitReliabilityData } from "@/hooks/useWeightedScore";
import { NextBestAction } from "@/hooks/useNextBestAction";
import { NextBestActionCard } from "./NextBestActionCard";

// Consume eligibility rules from the single source of truth
const { MIN_ACTIVE_DAYS, MIN_TOTAL_TRANSACTIONS, MAX_CONCENTRATION_PERCENT } = ELIGIBILITY_RULES;

interface UnitWeight {
  unitId: string;
  unitName: string;
  score: number;
  weight: number;
  income: number;
  isEligible: boolean;
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  daysActive: number;
  transactionCount: number;
  concentration: number;
  reliability?: UnitReliabilityData;
}

interface SpecialtyWeight {
  specialtyId: string;
  specialtyName: string;
  score: number;
  weight: number;
  income: number;
  isEligible: boolean;
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
}

interface UnitWeightsBreakdownProps {
  globalScore: number;
  globalStatus: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  globalLabel: string;
  isEligible: boolean;
  unitScores: UnitWeight[];
  centroClinicoSpecialties: SpecialtyWeight[];
  explanation: string;
  actionsByUnit?: Record<string, NextBestAction>;
}

// Unit eligibility state - derives from criteria count
type UnitEligibilityState = "eligible" | "partial" | "not-eligible";

interface UnitCriteria {
  unitId: string;
  unitName: string;
  daysActive: number;
  transactionCount: number;
  concentration: number;
  state: UnitEligibilityState;
  criteriaMetCount: number;
  daysMet: boolean;
  transactionsMet: boolean;
  concentrationMet: boolean;
}

export function UnitWeightsBreakdown({
  globalScore,
  globalStatus,
  globalLabel,
  isEligible,
  unitScores,
  centroClinicoSpecialties,
  explanation,
  actionsByUnit = {}
}: UnitWeightsBreakdownProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
      case "healthy":
        return "text-green-600 bg-green-50 border-green-200";
      case "attention":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "risk":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-muted-foreground bg-muted border-muted";
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case "excellent":
      case "healthy":
        return "🟢";
      case "attention":
        return "🟡";
      case "risk":
        return "🟠";
      case "critical":
        return "🔴";
      default:
        return "⚪";
    }
  };

  const eligibleUnits = unitScores.filter(u => u.isEligible);
  const ineligibleUnits = unitScores.filter(u => !u.isEligible);
  const eligibleSpecialties = centroClinicoSpecialties.filter(s => s.isEligible);

  // Calculate unit criteria using MASTER ELIGIBILITY RULES (single source of truth)
  // This CONSUMES the rules, never recalculates them
  const unitCriteria: UnitCriteria[] = unitScores.map(unit => {
    const daysActive = unit.daysActive;
    const transactionCount = unit.transactionCount;
    const concentration = unit.concentration;
    
    // Apply master rules
    const daysMet = daysActive >= MIN_ACTIVE_DAYS;
    const transactionsMet = transactionCount >= MIN_TOTAL_TRANSACTIONS;
    const concentrationMet = concentration <= MAX_CONCENTRATION_PERCENT;
    
    const criteriaMetCount = [daysMet, transactionsMet, concentrationMet].filter(Boolean).length;
    
    // Determine state based on criteria met
    let state: UnitEligibilityState;
    if (criteriaMetCount === 3) {
      state = "eligible";
    } else if (criteriaMetCount >= 1) {
      state = "partial"; // Partially eligible (1 or 2 criteria)
    } else {
      state = "not-eligible";
    }
    
    return {
      unitId: unit.unitId,
      unitName: unit.unitName,
      daysActive,
      transactionCount,
      concentration,
      state,
      criteriaMetCount,
      daysMet,
      transactionsMet,
      concentrationMet
    };
  });

  // Get granular progress text with blocking criterion info
  // Uses precomputed criteria from unitCriteria - NO recalculation
  const getProgressText = (unit: UnitCriteria) => {
    const fullyMet = unit.criteriaMetCount;
    
    if (fullyMet === 0) return "Nenhum critério totalmente atendido";
    if (fullyMet === 3) return "Todos os critérios atendidos";
    
    const blockingCount = 3 - fullyMet;
    return `${fullyMet} de 3 critérios atendidos (${blockingCount} bloqueante${blockingCount > 1 ? 's' : ''})`;
  };

  // Identify the main bottleneck for a unit - uses precomputed criteria
  const getMainBottleneckKey = (unit: UnitCriteria): "concentration" | "days" | "transactions" | null => {
    // Priority: concentration > days > transactions (based on typical impact)
    if (!unit.concentrationMet) return "concentration";
    if (!unit.daysMet) return "days";
    if (!unit.transactionsMet) return "transactions";
    return null;
  };

  // Get bottleneck display text
  const getBottleneckText = (key: "concentration" | "days" | "transactions" | null): string => {
    switch (key) {
      case "concentration": return "Concentração excessiva de faturamento";
      case "days": return "Poucos dias com movimentação";
      case "transactions": return "Número insuficiente de movimentações";
      default: return "";
    }
  };

  // Get operational CTA (Call to Action) for each criterion - more direct and actionable
  const getCriterionCTA = (criterion: "days" | "transactions" | "concentration", unitName?: string): string => {
    const unitSuffix = unitName ? ` nesta unidade` : '';
    switch (criterion) {
      case "days":
        return `Ação direta: registrar movimentações em pelo menos ${MIN_ACTIVE_DAYS} dias distintos${unitSuffix} para liberar o Score Global.`;
      case "transactions":
        return `Ação direta: atingir mínimo de ${MIN_TOTAL_TRANSACTIONS} lançamentos válidos${unitSuffix} para liberar o Score Global.`;
      case "concentration":
        return `Ação direta: distribuir faturamento em no mínimo 3 dias distintos${unitSuffix} para reduzir concentração abaixo de ${MAX_CONCENTRATION_PERCENT}% e liberar o Score Global.`;
    }
  };

  // Get didactic explanation for concentration
  const getConcentrationExplanation = (concentration: number): string => {
    const rounded = Math.round(concentration);
    if (rounded >= 100) {
      return `Todo o faturamento concentrado em um único dia`;
    }
    if (rounded > MAX_CONCENTRATION_PERCENT) {
      return `${rounded}% do faturamento concentrado em um único dia`;
    }
    return `${rounded}% de concentração — dentro do limite`;
  };

  // Calculate gap percentage for a unit criterion - uses precomputed values
  const calculateCriterionGap = (unit: UnitCriteria, criterion: "days" | "transactions" | "concentration"): number => {
    switch (criterion) {
      case "days":
        if (unit.daysMet) return 0;
        return ((MIN_ACTIVE_DAYS - unit.daysActive) / MIN_ACTIVE_DAYS) * 100;
      case "transactions":
        if (unit.transactionsMet) return 0;
        return ((MIN_TOTAL_TRANSACTIONS - unit.transactionCount) / MIN_TOTAL_TRANSACTIONS) * 100;
      case "concentration":
        if (unit.concentrationMet) return 0;
        return Math.min(100, unit.concentration - MAX_CONCENTRATION_PERCENT);
    }
  };

  // Calculate total gap for sorting (lower is better - closer to eligibility)
  const calculateTotalGap = (unit: UnitCriteria): number => {
    let totalGap = 0;
    if (!unit.daysMet) totalGap += calculateCriterionGap(unit, "days");
    if (!unit.transactionsMet) totalGap += calculateCriterionGap(unit, "transactions");
    if (!unit.concentrationMet) totalGap += calculateCriterionGap(unit, "concentration");
    
    return totalGap;
  };

  // Sort units by eligibility proximity: more criteria met first, then by smaller gap
  const sortedUnitCriteria = [...unitCriteria].sort((a, b) => {
    // First sort by criteria met count (descending)
    if (b.criteriaMetCount !== a.criteriaMetCount) {
      return b.criteriaMetCount - a.criteriaMetCount;
    }
    // Then by total gap (ascending - smaller gap = closer to eligibility)
    return calculateTotalGap(a) - calculateTotalGap(b);
  });

  // Find the unit closest to eligibility (first non-eligible in sorted list)
  const getClosestUnit = (): UnitCriteria | null => {
    const nonEligible = sortedUnitCriteria.filter(u => u.state !== "eligible");
    return nonEligible.length > 0 ? nonEligible[0] : null;
  };

  const closestUnit = getClosestUnit();

  // Get action message for the closest unit - operational and direct
  // Uses precomputed criteria - no recalculation
  const getClosestUnitActionMessage = (unit: UnitCriteria): string => {
    const unmetCriteria: Array<"days" | "transactions" | "concentration"> = [];
    if (!unit.daysMet) unmetCriteria.push("days");
    if (!unit.transactionsMet) unmetCriteria.push("transactions");
    if (!unit.concentrationMet) unmetCriteria.push("concentration");
    
    if (unmetCriteria.length === 1) {
      switch (unmetCriteria[0]) {
        case "concentration":
          return `Distribuir o faturamento em no mínimo 3 dias distintos nesta unidade para reduzir concentração abaixo de ${MAX_CONCENTRATION_PERCENT}% e liberar o Score Global.`;
        case "days":
          return `Registrar movimentações em mais ${MIN_ACTIVE_DAYS - unit.daysActive} dia${MIN_ACTIVE_DAYS - unit.daysActive > 1 ? 's' : ''} nesta unidade para atingir ${MIN_ACTIVE_DAYS} dias ativos e liberar o Score Global.`;
        case "transactions":
          return `Registrar mais ${MIN_TOTAL_TRANSACTIONS - unit.transactionCount} movimentação${MIN_TOTAL_TRANSACTIONS - unit.transactionCount > 1 ? 'ões' : ''} nesta unidade para atingir ${MIN_TOTAL_TRANSACTIONS} lançamentos e liberar o Score Global.`;
      }
    }
    
    // Multiple criteria - focus on the priority bottleneck with operational language
    const bottleneck = getMainBottleneckKey(unit);
    switch (bottleneck) {
      case "concentration":
        return `Prioridade: distribuir faturamento em pelo menos 3 dias distintos para reduzir concentração abaixo de ${MAX_CONCENTRATION_PERCENT}%.`;
      case "days":
        return `Prioridade: registrar movimentações em pelo menos ${MIN_ACTIVE_DAYS} dias distintos no período.`;
      case "transactions":
        return `Prioridade: atingir mínimo de ${MIN_TOTAL_TRANSACTIONS} lançamentos válidos no período.`;
      default:
        return `Revisar critérios pendentes para acelerar desbloqueio.`;
    }
  };

  // Calculate executive summary for the eligibility block
  const getExecutiveSummary = () => {
    const eligibleCount = unitCriteria.filter(u => u.state === "eligible").length;
    
    if (eligibleCount > 0) {
      return {
        status: `${eligibleCount} unidade${eligibleCount > 1 ? 's' : ''} elegível${eligibleCount > 1 ? 'is' : ''} — Score Global disponível.`,
        shortestPath: null
      };
    }

    // Find the unit closest to eligibility and which criterion is most common bottleneck
    const bottleneckCounts = { concentration: 0, days: 0, transactions: 0 };
    unitCriteria.forEach(unit => {
      const key = getMainBottleneckKey(unit);
      if (key) bottleneckCounts[key]++;
    });

    // Find dominant bottleneck
    let dominantBottleneck: "concentration" | "days" | "transactions" = "concentration";
    let maxCount = bottleneckCounts.concentration;
    if (bottleneckCounts.days > maxCount) {
      dominantBottleneck = "days";
      maxCount = bottleneckCounts.days;
    }
    if (bottleneckCounts.transactions > maxCount) {
      dominantBottleneck = "transactions";
    }

    const shortestPathText = {
      concentration: "corrigir concentração de faturamento",
      days: "aumentar dias ativos com movimentação",
      transactions: "registrar mais movimentações"
    };

    return {
      status: "Aguardando critérios mínimos.",
      shortestPath: `Caminho mais curto: ${shortestPathText[dominantBottleneck]} em qualquer unidade.`
    };
  };

  const executiveSummary = getExecutiveSummary();

  // Calculate real progress percentage (0/3=0%, 1/3=33%, 2/3=66%, 3/3=100%)
  const getRealProgressPercentage = (criteriaMetCount: number): number => {
    switch (criteriaMetCount) {
      case 0: return 0;
      case 1: return 33;
      case 2: return 66;
      case 3: return 100;
      default: return 0;
    }
  };

  const getStateIcon = (state: UnitEligibilityState) => {
    switch (state) {
      case "eligible":
        return <span className="text-green-500">🟢</span>;
      case "partial":
        return <span className="text-yellow-500">🟡</span>;
      default:
        return <span className="text-red-500">🔴</span>;
    }
  };

  const getStateLabel = (state: UnitEligibilityState) => {
    switch (state) {
      case "eligible":
        return "Elegível";
      case "partial":
        return "Parcialmente elegível";
      default:
        return "Não elegível";
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Composição do Score Global</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{explanation}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Média ponderada por participação financeira mensal
        </p>
      </CardHeader>
      
      <CardContent className="pt-4">
        {/* Score Global Summary */}
        <div className="flex items-center justify-center gap-4 mb-6 p-4 rounded-lg bg-muted/30 border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Score Global</p>
            {isEligible ? (
              <span className={cn(
                "text-4xl font-black",
                globalStatus === "excellent" || globalStatus === "healthy" ? "text-green-600" :
                globalStatus === "attention" ? "text-yellow-600" :
                globalStatus === "risk" ? "text-orange-600" : "text-red-600"
              )}>
                {globalScore}
              </span>
            ) : (
              <span className="text-2xl text-muted-foreground">—</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Classificação</p>
            {isEligible ? (
              <Badge className={cn(
                "font-semibold",
                getStatusColor(globalStatus)
              )}>
                {getStatusEmoji(globalStatus)} {globalLabel}
              </Badge>
            ) : (
              <Badge variant="secondary">Indisponível</Badge>
            )}
          </div>
        </div>

        {/* === SUCCESS FEEDBACK - Score Global Unlocked === */}
        {isEligible && (
          <div className="mb-6 p-4 rounded-lg border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                <Sparkles className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-200">
                  ✅ Score Global liberado automaticamente
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Unidade atingiu base mínima confiável para cálculo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === CRITERIA PROGRESS BLOCK - Only shown when Score is unavailable === */}
        {!isEligible && (
          <>
            <div className="p-4 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                  O que falta para liberar o Score Global?
                </h4>
              </div>

              {/* Executive Summary */}
              <div className="mb-4 p-3 rounded-lg bg-white/60 dark:bg-black/20 border border-amber-200 dark:border-amber-700">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    📊 Status geral: {executiveSummary.status}
                  </p>
                  {executiveSummary.shortestPath && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      🚀 {executiveSummary.shortestPath}
                    </p>
                  )}
                </div>
              </div>

              {/* Priority Executive Block - Closest Unit to Eligibility */}
              {closestUnit && (
                <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-full bg-primary/20">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <h5 className="font-bold text-primary">
                      🎯 Unidade mais próxima de liberar o Score Global
                    </h5>
                  </div>

                  {/* Explicit justification */}
                  <p className="text-xs text-muted-foreground mb-3 pl-8">
                    Motivo: unidade com maior número de critérios atendidos no período.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-lg">{closestUnit.unitName}</span>
                      </div>
                      <Badge className="bg-primary/20 text-primary border-primary/30 font-bold">
                        {getRealProgressPercentage(closestUnit.criteriaMetCount)}% completo
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Progress 
                        value={getRealProgressPercentage(closestUnit.criteriaMetCount)} 
                        className="h-3 flex-1 [&>div]:bg-primary"
                      />
                      <span className="text-sm font-medium text-muted-foreground">
                        {getProgressText(closestUnit)}
                      </span>
                    </div>

                    {closestUnit.criteriaMetCount === 2 && (
                      <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30">
                        ⚡ Apenas 1 critério bloqueante!
                      </Badge>
                    )}

                    <div className="p-3 rounded-lg bg-white/80 dark:bg-black/30 border">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Ação direta para desbloqueio:</p>
                      <p className="text-sm font-semibold text-foreground">
                        {getClosestUnitActionMessage(closestUnit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span><strong>Importante:</strong> Basta 1 unidade elegível para liberar o Score Global.</span>
              </p>

              {/* Units ordered by eligibility proximity */}
              <div className="space-y-4">
                {sortedUnitCriteria.map((unit, index) => {
                  const daysMet = unit.daysActive >= MIN_ACTIVE_DAYS;
                  const transactionsMet = unit.transactionCount >= MIN_TOTAL_TRANSACTIONS;
                  const concentrationMet = unit.concentration <= MAX_CONCENTRATION_PERCENT;
                  const isClosest = closestUnit && unit.unitId === closestUnit.unitId;
                  
                  return (
                    <div 
                      key={unit.unitId}
                      className={cn(
                        "p-3 rounded-lg border",
                        isClosest ? "ring-2 ring-primary/50" : "",
                        unit.state === "eligible" 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                          : unit.state === "partial"
                          ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                          : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      )}
                    >
                      {/* Unit Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{unit.unitName}</span>
                          {isClosest && (
                            <Badge variant="outline" className="text-xs border-primary text-primary bg-primary/10">
                              Mais próxima
                            </Badge>
                          )}
                          {index > 0 && !isClosest && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {index + 1}º
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStateIcon(unit.state)}
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              unit.state === "eligible" 
                                ? "border-green-500 text-green-700"
                                : unit.state === "partial"
                                ? "border-yellow-500 text-yellow-700"
                                : "border-red-500 text-red-700"
                            )}
                          >
                            {getStateLabel(unit.state)}
                          </Badge>
                        </div>
                      </div>

                      {/* Main Bottleneck / Priority Criterion - only show if not eligible */}
                      {unit.state !== "eligible" && getMainBottleneckKey(unit) && (
                        <div className="mb-3 p-2 rounded bg-gradient-to-r from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/40">
                              🎯 Critério prioritário para desbloqueio
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            {getBottleneckText(getMainBottleneckKey(unit))}
                          </p>
                        </div>
                      )}

                      {/* Eligible message */}
                      {unit.state === "eligible" && (
                        <div className="mb-3 p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Unidade pronta para compor o Score Global.
                          </p>
                        </div>
                      )}

                      {/* Criteria Checklist */}
                      <div className="space-y-2">
                        {/* Days Active */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {daysMet ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className={daysMet ? "text-green-700" : "text-muted-foreground"}>
                                Dias ativos
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium",
                                daysMet ? "text-green-600" : "text-amber-600"
                              )}>
                                {unit.daysActive}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{MIN_ACTIVE_DAYS}</span>
                            </div>
                          </div>
                          {!daysMet && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 pl-6 italic">
                              💡 {getCriterionCTA("days", unit.unitName)}
                            </p>
                          )}
                        </div>

                        {/* Transaction Count */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {transactionsMet ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className={transactionsMet ? "text-green-700" : "text-muted-foreground"}>
                                Movimentações
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium",
                                transactionsMet ? "text-green-600" : "text-amber-600"
                              )}>
                                {unit.transactionCount}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{MIN_TOTAL_TRANSACTIONS}</span>
                            </div>
                          </div>
                          {!transactionsMet && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 pl-6 italic">
                              💡 {getCriterionCTA("transactions", unit.unitName)}
                            </p>
                          )}
                        </div>

                        {/* Concentration */}
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {concentrationMet ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <PieChart className="h-3 w-3 text-muted-foreground" />
                              <span className={concentrationMet ? "text-green-700" : "text-muted-foreground"}>
                                Concentração
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {concentrationMet ? (
                                <CheckCircle className="h-3 w-3 text-green-600" />
                              ) : (
                                <span className="text-red-600 font-medium">❌</span>
                              )}
                            </div>
                          </div>
                          <p className={cn(
                            "text-xs pl-6",
                            concentrationMet ? "text-green-600" : "text-red-600"
                          )}>
                            {getConcentrationExplanation(unit.concentration)}
                            <span className="text-muted-foreground ml-1">
                              (máx permitido: {MAX_CONCENTRATION_PERCENT}%)
                            </span>
                          </p>
                          {!concentrationMet && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 pl-6 italic">
                              💡 {getCriterionCTA("concentration", unit.unitName)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar - Real percentage */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span className="font-medium">
                            {getRealProgressPercentage(unit.criteriaMetCount)}% — {getProgressText(unit)}
                          </span>
                        </div>
                        <Progress 
                          value={getRealProgressPercentage(unit.criteriaMetCount)} 
                          className={cn(
                            "h-2",
                            unit.state === "eligible" 
                              ? "[&>div]:bg-green-500"
                              : unit.state === "partial"
                              ? "[&>div]:bg-yellow-500"
                              : "[&>div]:bg-red-500"
                          )}
                        />
                      </div>

                      {/* Next Best Action for this unit */}
                      {actionsByUnit[unit.unitId] && (
                        <div className="mt-4">
                          <NextBestActionCard 
                            action={actionsByUnit[unit.unitId]} 
                            compact={true}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expected Effect Note */}
              <div className="mt-4 p-2 rounded bg-muted/30 border border-muted">
                <p className="text-xs text-muted-foreground text-center">
                  <span className="font-medium">Efeito esperado:</span> o Score Global será liberado no próximo ciclo mensal após correção do critério bloqueante.
                </p>
              </div>

              {/* Governance Note */}
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Este controle garante que o Score Global seja calculado apenas com base mínima confiável, evitando decisões com dados incompletos.
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />
          </>
        )}

        {/* Unit Scores with Weights - only when eligible */}
        {isEligible && (
          <>
            <Separator className="my-4" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Scores por Unidade
              </h4>
              
              {eligibleUnits.length > 0 ? (
                <div className="space-y-3">
                  {eligibleUnits.map((unit) => {
                    const unitFromScores = unitScores.find(u => u.unitId === unit.unitId);
                    const reliability = unitFromScores?.reliability;
                    
                    const getReliabilityIcon = () => {
                      if (!reliability) return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />;
                      switch (reliability.level) {
                        case "high": return <ShieldCheck className="h-4 w-4 text-green-600" />;
                        case "medium": return <Shield className="h-4 w-4 text-yellow-600" />;
                        default: return <ShieldAlert className="h-4 w-4 text-red-600" />;
                      }
                    };
                    
                    const getReliabilityBadgeClass = () => {
                      if (!reliability) return "border-muted text-muted-foreground";
                      switch (reliability.level) {
                        case "high": return "border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30";
                        case "medium": return "border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30";
                        default: return "border-red-500 text-red-700 bg-red-50 dark:bg-red-900/30";
                      }
                    };
                    
                    return (
                      <div 
                        key={unit.unitId}
                        className={cn(
                          "p-3 rounded-lg border",
                          getStatusColor(unit.status)
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{unit.unitName}</span>
                            <Badge variant="outline" className="text-xs">
                              Peso: {(unit.weight * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{unit.score}</span>
                            <span className="text-sm">{getStatusEmoji(unit.status)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Receita no período: {formatCurrency(unit.income)}</span>
                          <span>Contribuição: {(unit.score * unit.weight).toFixed(1)} pts</span>
                        </div>
                        
                        {/* Progress bar showing weight */}
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              unit.status === "excellent" || unit.status === "healthy" ? "bg-green-500" :
                              unit.status === "attention" ? "bg-yellow-500" :
                              unit.status === "risk" ? "bg-orange-500" : "bg-red-500"
                            )}
                            style={{ width: `${unit.weight * 100}%` }}
                          />
                        </div>
                        
                        {/* Reliability Score */}
                        {reliability && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="mt-3 p-2 rounded bg-muted/30 border border-muted cursor-help">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {getReliabilityIcon()}
                                      <span className="text-xs font-medium">Confiabilidade do Score</span>
                                    </div>
                                    <Badge variant="outline" className={cn("text-xs", getReliabilityBadgeClass())}>
                                      {reliability.score}% — {reliability.label}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 flex items-center gap-1">
                                    <Progress 
                                      value={reliability.score} 
                                      className={cn(
                                        "h-1.5 flex-1",
                                        reliability.level === "high" ? "[&>div]:bg-green-500" :
                                        reliability.level === "medium" ? "[&>div]:bg-yellow-500" :
                                        "[&>div]:bg-red-500"
                                      )}
                                    />
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs p-3">
                                <p className="font-semibold mb-2">Score de Confiabilidade</p>
                                <p className="text-sm text-muted-foreground mb-2">{reliability.explanation}</p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span>Base Histórica (30%):</span>
                                    <span className="font-medium">{reliability.components.historicalBase.contribution} pts</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Elegibilidade (30%):</span>
                                    <span className="font-medium">{reliability.components.eligibilityConsistency.contribution} pts</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Estabilidade (25%):</span>
                                    <span className="font-medium">{reliability.components.criteriaStability.contribution} pts</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Regularidade (15%):</span>
                                    <span className="font-medium">{reliability.components.operationalRegularity.contribution} pts</span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Next Best Action for eligible unit */}
                        {actionsByUnit[unit.unitId] && (
                          <div className="mt-3">
                            <NextBestActionCard 
                              action={actionsByUnit[unit.unitId]} 
                              compact={true}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 border border-dashed text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma unidade atingiu critérios de elegibilidade no período
                  </p>
                </div>
              )}

              {/* Ineligible units warning */}
              {ineligibleUnits.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Unidade(s) sem base suficiente no período:
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        {ineligibleUnits.map(u => u.unitName).join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Centro Clínico Specialty Breakdown - if applicable */}
        {eligibleSpecialties.length > 0 && isEligible && (
          <>
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Centro Clínico: Composição por Especialidade
              </h4>
              
              <div className="space-y-2">
                {eligibleSpecialties.map((specialty) => (
                  <div 
                    key={specialty.specialtyId}
                    className={cn(
                      "p-2 rounded-lg border text-sm",
                      getStatusColor(specialty.status)
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{specialty.specialtyName}</span>
                        <Badge variant="outline" className="text-xs">
                          {(specialty.weight * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{specialty.score}</span>
                        <span className="text-xs">{getStatusEmoji(specialty.status)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground italic">
                O Score do Centro Clínico é a média ponderada dos scores de suas especialidades ativas.
              </p>
            </div>
          </>
        )}

        {/* Explanation footer */}
        <Separator className="my-4" />
        
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground text-center">
            {explanation}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
