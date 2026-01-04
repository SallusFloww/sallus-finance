import { useMemo } from "react";
import { UnitScoreData, ELIGIBILITY_RULES } from "./useWeightedScore";
import { UnitMaturityHistory } from "./useScoreHistory";

const { MIN_ACTIVE_DAYS, MIN_TOTAL_TRANSACTIONS, MAX_CONCENTRATION_PERCENT } = ELIGIBILITY_RULES;

export type PMAImpactLevel = "high" | "medium" | "preventive";
export type PMACriterion = "concentration" | "days" | "transactions" | "stability" | "frequency";
export type PMACategory = "principal" | "complementar" | "estrategica";

export interface NextBestAction {
  unitId: string;
  unitName: string;
  title: string;
  description: string;
  criterion: PMACriterion;
  criterionLabel: string;
  impactLevel: PMAImpactLevel;
  impactLevelLabel: string;
  impactLevelEmoji: string;
  unitScoreImpact: string;
  globalScoreImpact: string | null;
  isUnlockAction: boolean;
  progress: {
    current: number;
    target: number;
    percentage: number;
    label: string;
  } | null;
  actionKey: string;
  completionEffect?: string; // CTA explaining what happens when action is completed
  // Consolidation fields
  affectedUnits?: string[];
  consolidatedCount?: number;
  category?: PMACategory;
}

export interface ConsolidatedAction extends NextBestAction {
  affectedUnits: string[];
  consolidatedCount: number;
  category: PMACategory;
}

export interface NextBestActionsData {
  actions: NextBestAction[];
  consolidatedActions: ConsolidatedAction[];
  actionsByUnit: Record<string, NextBestAction>;
  hasHighImpactActions: boolean;
  highImpactCount: number;
  principalAction: ConsolidatedAction | null;
}

// Generate PMA for ineligible unit - prioritize by impact/effort ratio
function generateIneligibleUnitPMA(
  unit: UnitScoreData,
  anyUnitEligible: boolean
): NextBestAction {
  const { eligibilityCheck, daysActive, transactionCount, concentration } = unit;
  
  // Priority order: Concentration > Days > Transactions
  // (Concentration typically requires distribution, not new activity)
  
  let criterion: PMACriterion;
  let title: string;
  let description: string;
  let criterionLabel: string;
  let progress: NextBestAction["progress"] = null;
  
  // Determine which criterion to prioritize based on unmet criteria and effort
  if (!eligibilityCheck.concentrationMet) {
    criterion = "concentration";
    criterionLabel = "Concentração de faturamento";
    title = "Distribuir faturamento";
    description = `Distribuir faturamento em pelo menos 3 dias distintos para reduzir concentração abaixo de ${MAX_CONCENTRATION_PERCENT}%.`;
    
    // Progress for concentration (inverse - lower is better)
    const targetConcentration = MAX_CONCENTRATION_PERCENT;
    const currentConcentration = Math.round(concentration);
    const excess = Math.max(0, currentConcentration - targetConcentration);
    progress = {
      current: currentConcentration,
      target: targetConcentration,
      percentage: Math.max(0, Math.min(100, 100 - excess)),
      label: `${currentConcentration}% → ≤${targetConcentration}%`
    };
  } else if (!eligibilityCheck.daysMet) {
    criterion = "days";
    criterionLabel = "Dias ativos";
    const daysNeeded = MIN_ACTIVE_DAYS - daysActive;
    title = "Aumentar dias ativos";
    description = `Registrar movimentações em mais ${daysNeeded} dia${daysNeeded > 1 ? 's' : ''} para atingir ${MIN_ACTIVE_DAYS} dias ativos.`;
    
    progress = {
      current: daysActive,
      target: MIN_ACTIVE_DAYS,
      percentage: Math.round((daysActive / MIN_ACTIVE_DAYS) * 100),
      label: `${daysActive} / ${MIN_ACTIVE_DAYS} dias`
    };
  } else if (!eligibilityCheck.transactionsMet) {
    criterion = "transactions";
    criterionLabel = "Movimentações";
    const txNeeded = MIN_TOTAL_TRANSACTIONS - transactionCount;
    title = "Registrar movimentações";
    description = `Registrar mais ${txNeeded} movimentação${txNeeded > 1 ? 'ões' : ''} para atingir ${MIN_TOTAL_TRANSACTIONS} lançamentos.`;
    
    progress = {
      current: transactionCount,
      target: MIN_TOTAL_TRANSACTIONS,
      percentage: Math.round((transactionCount / MIN_TOTAL_TRANSACTIONS) * 100),
      label: `${transactionCount} / ${MIN_TOTAL_TRANSACTIONS} mov.`
    };
  } else {
    // Fallback - should not happen if eligibility check is correct
    criterion = "days";
    criterionLabel = "Critérios gerais";
    title = "Revisar critérios";
    description = "Revisar critérios de elegibilidade para identificar pendências.";
  }
  
  // Determine impact level
  // If no unit is eligible yet, this action could unlock Global Score = HIGH
  const isUnlockAction = !anyUnitEligible && eligibilityCheck.criteriaMetCount >= 2;
  const impactLevel: PMAImpactLevel = isUnlockAction ? "high" : "medium";
  
  // Executive-friendly impact messages
  const executiveUnitImpact = "Unidade passa a contribuir para o Score Global";
  const executiveGlobalImpact = isUnlockAction 
    ? "Libera o Score Global do grupo imediatamente" 
    : "Melhora direta no Score Global consolidado";
  
  // Completion effect message for CTA
  const completionEffect = criterion === "concentration" 
    ? `Ao reduzir concentração para ≤${MAX_CONCENTRATION_PERCENT}%, o critério é atendido automaticamente.`
    : criterion === "days"
    ? `Ao atingir ${MIN_ACTIVE_DAYS} dias ativos, o Score é recalculado automaticamente.`
    : `Ao registrar ${MIN_TOTAL_TRANSACTIONS} movimentações, a unidade torna-se elegível.`;
  
  return {
    unitId: unit.unitId,
    unitName: unit.unitName,
    title,
    description,
    criterion,
    criterionLabel,
    impactLevel,
    impactLevelLabel: impactLevel === "high" ? "Alto impacto" : "Médio impacto",
    impactLevelEmoji: impactLevel === "high" ? "🔥" : "⚠️",
    unitScoreImpact: executiveUnitImpact,
    globalScoreImpact: executiveGlobalImpact,
    isUnlockAction,
    progress,
    actionKey: `${unit.unitId}-${criterion}-ineligible`,
    completionEffect
  };
}

// Generate PMA for eligible unit - focus on stability and improvement
function generateEligibleUnitPMA(
  unit: UnitScoreData,
  maturityHistory: UnitMaturityHistory | undefined
): NextBestAction {
  const { daysActive, concentration, reliability } = unit;
  
  let criterion: PMACriterion;
  let title: string;
  let description: string;
  let criterionLabel: string;
  let progress: NextBestAction["progress"] = null;
  
  // Priority for eligible units:
  // 1. If criteria stability is low (recent regressions) → stabilize
  // 2. If days active is borderline → increase buffer
  // 3. If concentration is borderline → improve distribution
  
  const hasRecentRegression = maturityHistory?.hasCriticalRegressionRecent ?? false;
  const stabilityScore = reliability?.components.criteriaStability?.score ?? 100;
  const hasLowStability = stabilityScore < 100 || hasRecentRegression;
  const isDaysBorderline = daysActive < MIN_ACTIVE_DAYS + 3; // Less than 3-day buffer
  const isConcentrationBorderline = concentration > MAX_CONCENTRATION_PERCENT - 15; // Within 15% of limit
  
  if (hasLowStability) {
    criterion = "stability";
    criterionLabel = "Estabilidade";
    title = "Estabilizar operação";
    description = "Manter critérios de elegibilidade consistentes por 3 meses consecutivos para recuperar confiabilidade.";
    
    const regressionCount = reliability?.components.criteriaStability?.regressionCount ?? 0;
    const monthsWithoutRegression = Math.max(0, 3 - regressionCount);
    progress = {
      current: monthsWithoutRegression,
      target: 3,
      percentage: Math.round((monthsWithoutRegression / 3) * 100),
      label: `${monthsWithoutRegression}/3 meses sem regressão`
    };
  } else if (isDaysBorderline) {
    criterion = "days";
    criterionLabel = "Margem de dias ativos";
    const bufferNeeded = MIN_ACTIVE_DAYS + 5 - daysActive;
    title = "Ampliar margem de segurança";
    description = `Aumentar para ${MIN_ACTIVE_DAYS + 5} dias ativos para evitar risco de perda de elegibilidade.`;
    
    progress = {
      current: daysActive,
      target: MIN_ACTIVE_DAYS + 5,
      percentage: Math.round((daysActive / (MIN_ACTIVE_DAYS + 5)) * 100),
      label: `${daysActive} / ${MIN_ACTIVE_DAYS + 5} dias`
    };
  } else if (isConcentrationBorderline) {
    criterion = "concentration";
    criterionLabel = "Distribuição de receita";
    title = "Melhorar distribuição";
    description = `Reduzir concentração para abaixo de ${MAX_CONCENTRATION_PERCENT - 20}% para maior segurança.`;
    
    const targetConcentration = MAX_CONCENTRATION_PERCENT - 20;
    progress = {
      current: Math.round(concentration),
      target: targetConcentration,
      percentage: Math.max(0, Math.min(100, ((MAX_CONCENTRATION_PERCENT - concentration) / (MAX_CONCENTRATION_PERCENT - targetConcentration)) * 100)),
      label: `${Math.round(concentration)}% → ≤${targetConcentration}%`
    };
  } else {
    // Unit is healthy - focus on frequency
    criterion = "frequency";
    criterionLabel = "Frequência de elegibilidade";
    title = "Manter consistência";
    description = "Manter todos os critérios atendidos para consolidar histórico de elegibilidade.";
    
    const eligibilityFreq = maturityHistory?.eligibilityFrequency ?? 0;
    progress = {
      current: eligibilityFreq,
      target: 100,
      percentage: eligibilityFreq,
      label: `${eligibilityFreq}% dos últimos 6 meses`
    };
  }
  
  // Executive-friendly impact messages for eligible units
  const executiveImpact = criterion === "stability" 
    ? "Consolida confiabilidade do Score da unidade"
    : criterion === "days"
    ? "Amplia margem de segurança contra perda de elegibilidade"
    : criterion === "concentration"
    ? "Reduz vulnerabilidade a oscilações de faturamento"
    : "Fortalece histórico de elegibilidade consistente";
    
  const completionEffect = criterion === "stability"
    ? "Após 3 meses sem regressão, a unidade atinge confiabilidade máxima."
    : criterion === "days"
    ? "Com margem ampliada, variações mensais não afetam elegibilidade."
    : criterion === "concentration"
    ? "Distribuição saudável protege contra dependência de clientes."
    : "Consistência histórica eleva peso da unidade no Score Global.";
  
  return {
    unitId: unit.unitId,
    unitName: unit.unitName,
    title,
    description,
    criterion,
    criterionLabel,
    impactLevel: "preventive",
    impactLevelLabel: "Preventivo",
    impactLevelEmoji: "🛡️",
    unitScoreImpact: executiveImpact,
    globalScoreImpact: null,
    isUnlockAction: false,
    progress,
    actionKey: `${unit.unitId}-${criterion}-eligible`,
    completionEffect
  };
}

// Consolidate actions by semantic similarity (same criterion + title)
function consolidateActions(actions: NextBestAction[]): ConsolidatedAction[] {
  const grouped = new Map<string, NextBestAction[]>();
  
  // Group by criterion + title (semantic key)
  actions.forEach(action => {
    const semanticKey = `${action.criterion}-${action.title}`;
    if (!grouped.has(semanticKey)) {
      grouped.set(semanticKey, []);
    }
    grouped.get(semanticKey)!.push(action);
  });
  
  // Consolidate each group into single action
  const consolidated: ConsolidatedAction[] = [];
  
  grouped.forEach((groupActions) => {
    // Pick the highest impact action from the group
    const sortedGroup = [...groupActions].sort((a, b) => {
      const impactOrder: Record<PMAImpactLevel, number> = { high: 0, medium: 1, preventive: 2 };
      return impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
    });
    
    const representative = sortedGroup[0];
    const affectedUnits = groupActions.map(a => a.unitName);
    
    // Create consolidated description if multiple units affected
    let consolidatedDescription = representative.description;
    if (groupActions.length > 1) {
      consolidatedDescription = `${representative.description} Ação aplicável a ${affectedUnits.join(", ")}.`;
    }
    
    consolidated.push({
      ...representative,
      description: consolidatedDescription,
      affectedUnits,
      consolidatedCount: groupActions.length,
      category: "principal" // Will be assigned later
    });
  });
  
  return consolidated;
}

// Assign categories (principal, complementar, estrategica) based on priority
function assignCategories(actions: ConsolidatedAction[]): ConsolidatedAction[] {
  const impactOrder: Record<PMAImpactLevel, number> = { high: 0, medium: 1, preventive: 2 };
  const criterionUrgency: Record<PMACriterion, number> = {
    concentration: 0, // Most urgent - blocks eligibility
    days: 1,
    transactions: 2,
    stability: 3,
    frequency: 4 // Least urgent - maintenance
  };
  
  // Sort by: impact > urgency (criterion) > ease (progress percentage)
  const sorted = [...actions].sort((a, b) => {
    // 1. Impact level
    const impactDiff = impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
    if (impactDiff !== 0) return impactDiff;
    
    // 2. Urgency (criterion type)
    const urgencyDiff = criterionUrgency[a.criterion] - criterionUrgency[b.criterion];
    if (urgencyDiff !== 0) return urgencyDiff;
    
    // 3. Ease of execution (higher progress = easier)
    const aProgress = a.progress?.percentage ?? 0;
    const bProgress = b.progress?.percentage ?? 0;
    return bProgress - aProgress; // Higher progress first (easier to complete)
  });
  
  // Assign categories - max 3 actions
  return sorted.slice(0, 3).map((action, index) => ({
    ...action,
    category: index === 0 ? "principal" as PMACategory : 
              index === 1 ? "complementar" as PMACategory : 
              "estrategica" as PMACategory
  }));
}

export function useNextBestAction(
  unitScores: UnitScoreData[],
  unitMaturityHistory: UnitMaturityHistory[]
): NextBestActionsData {
  return useMemo(() => {
    const anyUnitEligible = unitScores.some(u => u.isEligible);
    
    // Generate raw actions per unit
    const rawActions: NextBestAction[] = unitScores.map(unit => {
      const maturityHistory = unitMaturityHistory.find(h => h.unitId === unit.unitId);
      
      if (!unit.isEligible) {
        return generateIneligibleUnitPMA(unit, anyUnitEligible);
      } else {
        return generateEligibleUnitPMA(unit, maturityHistory);
      }
    });
    
    // Consolidate semantically similar actions
    const consolidated = consolidateActions(rawActions);
    
    // Assign categories and limit to 3
    const categorized = assignCategories(consolidated);
    
    // Create lookup by unit (original actions)
    const actionsByUnit: Record<string, NextBestAction> = {};
    rawActions.forEach(action => {
      actionsByUnit[action.unitId] = action;
    });
    
    const highImpactCount = categorized.filter(a => a.impactLevel === "high").length;
    const principalAction = categorized.find(a => a.category === "principal") ?? null;
    
    return {
      actions: rawActions,
      consolidatedActions: categorized,
      actionsByUnit,
      hasHighImpactActions: highImpactCount > 0,
      highImpactCount,
      principalAction
    };
  }, [unitScores, unitMaturityHistory]);
}
