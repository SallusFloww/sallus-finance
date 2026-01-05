import { useMemo } from "react";
import { Transaction, Settings } from "@/types";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  eachMonthOfInterval,
  subMonths,
  parseISO
} from "date-fns";
import { isCancelled, isRealized } from "@/utils/statusHelpers";

// ============================================
// MASTER ELIGIBILITY RULES - SINGLE SOURCE OF TRUTH
// All other components MUST consume these values, never recalculate
// ============================================
export const ELIGIBILITY_RULES = {
  MIN_ACTIVE_DAYS: 5,
  MIN_TOTAL_TRANSACTIONS: 10,
  MAX_CONCENTRATION_PERCENT: 80
} as const;

// Check if a unit meets all eligibility criteria
export function checkUnitEligibility(
  daysActive: number,
  transactionCount: number,
  concentration: number
): { isEligible: boolean; criteriaMetCount: number; daysMet: boolean; transactionsMet: boolean; concentrationMet: boolean } {
  const daysMet = daysActive >= ELIGIBILITY_RULES.MIN_ACTIVE_DAYS;
  const transactionsMet = transactionCount >= ELIGIBILITY_RULES.MIN_TOTAL_TRANSACTIONS;
  const concentrationMet = concentration <= ELIGIBILITY_RULES.MAX_CONCENTRATION_PERCENT;
  
  const criteriaMetCount = [daysMet, transactionsMet, concentrationMet].filter(Boolean).length;
  const isEligible = criteriaMetCount === 3;
  
  return { isEligible, criteriaMetCount, daysMet, transactionsMet, concentrationMet };
}

// Unit Reliability Score calculation (0-100%)
// Measures data quality, stability, and maturity - NOT financial performance
export interface UnitReliabilityData {
  score: number; // 0-100%
  level: "high" | "medium" | "low";
  label: string;
  components: {
    // 1️⃣ Base Histórica Válida (30%)
    historicalBase: {
      score: number; // 0-100%
      validMonths: number;
      contribution: number; // weighted contribution
    };
    // 2️⃣ Consistência de Elegibilidade (30%)
    eligibilityConsistency: {
      score: number; // 0-100%
      eligibleMonths: number;
      totalMonths: number;
      contribution: number;
    };
    // 3️⃣ Estabilidade de Critérios (25%)
    criteriaStability: {
      score: number; // 0-100%
      regressionCount: number;
      contribution: number;
    };
    // 4️⃣ Regularidade Operacional (15%)
    operationalRegularity: {
      score: number; // 0-100%
      oscillationLevel: "low" | "moderate" | "high";
      contribution: number;
    };
  };
  explanation: string;
  // Used for Global Score weight adjustment
  weightMultiplier: number; // 0.4 to 1.0 based on reliability
}

export interface UnitScoreData {
  unitId: string;
  unitName: string;
  score: number;
  isEligible: boolean;
  weight: number; // Proporção da receita
  income: number;
  daysActive: number;
  recurrence: number;
  concentration: number;
  transactionCount: number; // Added for eligibility criteria display
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  components: {
    regularity: number;
    recurrence: number;
    concentration: number;
    trend: number;
  };
  // Eligibility breakdown for UI consumption
  eligibilityCheck: {
    daysMet: boolean;
    transactionsMet: boolean;
    concentrationMet: boolean;
    criteriaMetCount: number;
  };
  // Unit Reliability Score
  reliability: UnitReliabilityData;
}

export interface SpecialtyScoreData {
  specialtyId: string;
  specialtyName: string;
  score: number;
  isEligible: boolean;
  weight: number;
  income: number;
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
}

export interface GlobalScoreData {
  globalScore: number;
  globalStatus: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  globalLabel: string;
  isEligible: boolean;
  unitScores: UnitScoreData[];
  centroClinicoSpecialties: SpecialtyScoreData[];
  explanation: string;
  unitWeightsExplanation: { unitName: string; weight: number; income: number }[];
}

// Calculate individual score based on the 4 pillars
function calculateScore(
  daysActive: number,
  recurrenceIndex: number,
  concentrationPercentage: number,
  trendScore: number
): { score: number; components: { regularity: number; recurrence: number; concentration: number; trend: number } } {
  // A) REGULARIDADE — peso 30
  let regularityScore = 0;
  if (daysActive >= 15) regularityScore = 30;
  else if (daysActive >= 10) regularityScore = 24;
  else if (daysActive >= 5) regularityScore = 18;
  else if (daysActive >= 3) regularityScore = 10;
  else regularityScore = 0;

  // B) RECORRÊNCIA — peso 25
  let recurrenceScore = 0;
  if (recurrenceIndex >= 40) recurrenceScore = 25;
  else if (recurrenceIndex >= 30) recurrenceScore = 20;
  else if (recurrenceIndex >= 20) recurrenceScore = 15;
  else if (recurrenceIndex >= 10) recurrenceScore = 5;
  else recurrenceScore = 0;

  // C) CONCENTRAÇÃO — peso 25 (inverso)
  let concentrationScore = 0;
  if (concentrationPercentage <= 25) concentrationScore = 25;
  else if (concentrationPercentage <= 40) concentrationScore = 18;
  else if (concentrationPercentage <= 60) concentrationScore = 10;
  else if (concentrationPercentage <= 80) concentrationScore = 5;
  else concentrationScore = 0;

  const total = Math.round(regularityScore + recurrenceScore + concentrationScore + trendScore);

  return {
    score: total,
    components: {
      regularity: regularityScore,
      recurrence: recurrenceScore,
      concentration: concentrationScore,
      trend: trendScore
    }
  };
}

function getScoreStatus(score: number): "excellent" | "healthy" | "attention" | "risk" | "critical" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 55) return "attention";
  if (score >= 40) return "risk";
  return "critical";
}

function getScoreLabel(status: string): string {
  switch (status) {
    case "excellent": return "Excelente";
    case "healthy": return "Saudável";
    case "attention": return "Atenção";
    case "risk": return "Risco";
    case "critical": return "Crítico";
    default: return "Indisponível";
  }
}

export function useWeightedScore(
  transactions: Transaction[],
  settings: Settings
): GlobalScoreData {
  return useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const totalDays = currentMonthEnd.getDate();

    // Get active units
    const activeUnits = settings.units.filter(u => u.active);

    // Calculate historical trend score (simplified - same for all units)
    const monthsInterval = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: subMonths(startOfMonth(now), 1)
    });

    const calculateTrendScore = (unitTransactions: Transaction[]): number => {
      const historicalData = monthsInterval.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // Excluir cancelados do cálculo de score
        const monthTransactions = unitTransactions.filter((t) => {
          const tDate = parseISO(t.date);
          const inPeriod = tDate >= monthStart && tDate <= monthEnd;
          return inPeriod && !isCancelled(t.status);
        });

        // Apenas realizados impactam o cálculo
        const realizedMonthTx = monthTransactions.filter(t => isRealized(t.status));

        const mIncome = realizedMonthTx
          .filter((t) => t.type === "INCOME")
          .reduce((sum, t) => sum + t.amount, 0);

        const mExpense = realizedMonthTx
          .filter((t) => t.type === "EXPENSE")
          .reduce((sum, t) => sum + t.amount, 0);

        const mDaysActive = new Set(
          monthTransactions.map((t) => format(parseISO(t.date), "yyyy-MM-dd"))
        ).size;

        const mRecurrence = totalDays > 0 ? (mDaysActive / totalDays) * 100 : 0;
        const hasData = mIncome > 0 || mExpense > 0;
        const isValid = hasData && (mDaysActive >= 5 || mRecurrence >= 20);

        return {
          balance: mIncome - mExpense,
          isValid
        };
      });

      const recentValidMonths = historicalData.filter(m => m.isValid).slice(-3);
      
      if (recentValidMonths.length >= 3) {
        const balances = recentValidMonths.map(m => m.balance);
        const improvements = balances.slice(1).filter((b, i) => b > balances[i]).length;
        const declines = balances.slice(1).filter((b, i) => b < balances[i] * 0.9).length;
        
        if (improvements >= 2 || (improvements >= 1 && declines === 0)) return 20;
        if (declines <= 1 && improvements >= 0) return 14;
        return 7;
      } else if (recentValidMonths.length >= 2) {
        const [prev, curr] = recentValidMonths.slice(-2);
        if (curr.balance >= prev.balance * 0.9) return 14;
        return 7;
      }
      return 0;
    };

    // Calculate metrics for a set of transactions (excluindo cancelados)
    const calculateMetrics = (txns: Transaction[]) => {
      // Filtrar cancelados antes de calcular métricas
      const activeTxns = txns.filter(t => !isCancelled(t.status));
      const realizedTxns = activeTxns.filter(t => isRealized(t.status));
      
      const income = realizedTxns
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const daysActive = new Set(
        activeTxns.map((t) => format(parseISO(t.date), "yyyy-MM-dd"))
      ).size;

      const recurrenceIndex = totalDays > 0 ? (daysActive / totalDays) * 100 : 0;

      const dailyIncomes: Record<string, number> = {};
      realizedTxns
        .filter((t) => t.type === "INCOME")
        .forEach((t) => {
          const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
          dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
        });

      const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
      const concentrationPercentage = income > 0 ? (maxDayIncome / income) * 100 : 0;

      const hasData = income > 0 || realizedTxns.some(t => t.type === "EXPENSE");
      const meetsActivityCriteria = daysActive >= 5 || recurrenceIndex >= 20;
      const isEligible = hasData && meetsActivityCriteria;

      return {
        income,
        daysActive,
        recurrenceIndex,
        concentrationPercentage,
        isEligible,
        hasData
      };
    };

    // Calculate Centro Clínico score from specialties
    // IMPORTANT: Only OPERACIONAL transactions count for Score calculation
    const centroClinicoUnit = settings.units.find(u => u.id === "CENTRO_CLINICO");
    const activeSpecialties = centroClinicoUnit?.specialties?.filter(s => s.active) || [];
    
    // Filter only OPERACIONAL transactions for Score calculation
    const centroClinicoTransactions = transactions.filter((t) => {
      const tDate = parseISO(t.date);
      const isOperacional = !t.financialCategory || t.financialCategory === "OPERACIONAL";
      return t.unit === "CENTRO_CLINICO" && tDate >= currentMonthStart && tDate <= currentMonthEnd && isOperacional;
    });

    // Calculate specialty scores for Centro Clínico (only OPERACIONAL)
    const specialtyScores: SpecialtyScoreData[] = activeSpecialties.map(specialty => {
      const specialtyTxns = centroClinicoTransactions.filter(t => t.specialty === specialty.id);
      const metrics = calculateMetrics(specialtyTxns);
      
      // Historical data also filters only OPERACIONAL
      const allSpecialtyTxns = transactions.filter(t => {
        const isOperacional = !t.financialCategory || t.financialCategory === "OPERACIONAL";
        return t.unit === "CENTRO_CLINICO" && t.specialty === specialty.id && isOperacional;
      });
      const trendScore = calculateTrendScore(allSpecialtyTxns);
      
      const { score, components } = calculateScore(
        metrics.daysActive,
        metrics.recurrenceIndex,
        metrics.concentrationPercentage,
        trendScore
      );

      const status = metrics.isEligible ? getScoreStatus(score) : "ineligible";

      return {
        specialtyId: specialty.id,
        specialtyName: specialty.name,
        score: metrics.isEligible ? score : 0,
        isEligible: metrics.isEligible,
        weight: 0, // Will be calculated after we have all incomes
        income: metrics.income,
        status
      };
    });

    // Calculate specialty weights based on income proportion
    const totalSpecialtyIncome = specialtyScores.reduce((sum, s) => sum + s.income, 0);
    specialtyScores.forEach(s => {
      s.weight = totalSpecialtyIncome > 0 ? s.income / totalSpecialtyIncome : 0;
    });

    // Calculate Centro Clínico weighted score from specialties
    let centroClinicoWeightedScore = 0;
    const eligibleSpecialties = specialtyScores.filter(s => s.isEligible);
    
    if (eligibleSpecialties.length > 0) {
      const eligibleSpecialtyIncome = eligibleSpecialties.reduce((sum, s) => sum + s.income, 0);
      eligibleSpecialties.forEach(s => {
        const eligibleWeight = eligibleSpecialtyIncome > 0 ? s.income / eligibleSpecialtyIncome : 0;
        centroClinicoWeightedScore += s.score * eligibleWeight;
      });
      centroClinicoWeightedScore = Math.round(centroClinicoWeightedScore);
    }

    // Helper to calculate reliability score for a unit
    // Score de Confiabilidade = qualidade, estabilidade e maturidade da base de dados
    const calculateUnitReliability = (
      isCurrentlyEligible: boolean,
      unitId: string
    ): UnitReliabilityData => {
      // Get historical data for this unit (last 12 months)
      const unitHistoricalData = monthsInterval.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthTxns = transactions.filter(t => {
          const tDate = parseISO(t.date);
          return t.unit === unitId && tDate >= monthStart && tDate <= monthEnd;
        });
        
        const daysActive = new Set(
          monthTxns.map(t => format(parseISO(t.date), "yyyy-MM-dd"))
        ).size;
        
        const hasData = monthTxns.length > 0;
        
        // Calculate concentration
        const dailyIncomes: Record<string, number> = {};
        monthTxns.filter(t => t.type === "INCOME").forEach(t => {
          const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
          dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
        });
        const totalIncome = Object.values(dailyIncomes).reduce((sum, v) => sum + v, 0);
        const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
        const concentration = totalIncome > 0 ? (maxDayIncome / totalIncome) * 100 : 0;
        
        const eligibility = checkUnitEligibility(daysActive, monthTxns.length, concentration);
        
        return {
          hasData,
          isEligible: eligibility.isEligible,
          criteriaMetCount: eligibility.criteriaMetCount,
          daysActive
        };
      });
      
      // Get last 6 months for calculations
      const last6Months = unitHistoricalData.slice(-6);
      const last3Months = unitHistoricalData.slice(-3);
      
      // === 1️⃣ BASE HISTÓRICA VÁLIDA (peso 30%) ===
      const validMonths = unitHistoricalData.filter(m => m.hasData).length;
      let historicalBaseScore: number;
      if (validMonths >= 6) historicalBaseScore = 100;
      else if (validMonths >= 3) historicalBaseScore = 60;
      else historicalBaseScore = 20;
      const historicalBaseContribution = Math.round(historicalBaseScore * 0.30);

      // === 2️⃣ CONSISTÊNCIA DE ELEGIBILIDADE (peso 30%) ===
      const last6MonthsWithData = last6Months.filter(m => m.hasData);
      const eligibleMonthsCount = last6MonthsWithData.filter(m => m.isEligible).length;
      const eligibilityConsistencyScore = last6MonthsWithData.length > 0 
        ? Math.round((eligibleMonthsCount / last6MonthsWithData.length) * 100)
        : 0;
      const eligibilityContribution = Math.round(eligibilityConsistencyScore * 0.30);

      // === 3️⃣ ESTABILIDADE DE CRITÉRIOS (peso 25%) ===
      // Contar regressões nos últimos 3 meses (perda de critério já atendido)
      let regressionCount = 0;
      for (let i = 1; i < last3Months.length; i++) {
        const prev = last3Months[i - 1];
        const curr = last3Months[i];
        if (prev.hasData && curr.hasData && prev.criteriaMetCount > curr.criteriaMetCount) {
          regressionCount++;
        }
      }
      let criteriaStabilityScore: number;
      if (regressionCount === 0) criteriaStabilityScore = 100;
      else if (regressionCount === 1) criteriaStabilityScore = 60;
      else criteriaStabilityScore = 20;
      const criteriaContribution = Math.round(criteriaStabilityScore * 0.25);

      // === 4️⃣ REGULARIDADE OPERACIONAL (peso 15%) ===
      // Verificar oscilação nos dias ativos nos últimos 3 meses
      const activeDaysLast3 = last3Months.filter(m => m.hasData).map(m => m.daysActive);
      let oscillationLevel: "low" | "moderate" | "high" = "low";
      let operationalScore = 100;
      
      if (activeDaysLast3.length >= 2) {
        const maxDays = Math.max(...activeDaysLast3);
        const minDays = Math.min(...activeDaysLast3);
        const range = maxDays - minDays;
        const avgDays = activeDaysLast3.reduce((a, b) => a + b, 0) / activeDaysLast3.length;
        const variationPercent = avgDays > 0 ? (range / avgDays) * 100 : 0;
        
        if (variationPercent > 50) {
          oscillationLevel = "high";
          operationalScore = 20;
        } else if (variationPercent > 25) {
          oscillationLevel = "moderate";
          operationalScore = 60;
        }
      }
      const operationalContribution = Math.round(operationalScore * 0.15);

      // === SCORE FINAL ===
      const totalScore = historicalBaseContribution + eligibilityContribution + criteriaContribution + operationalContribution;
      
      // === CLASSIFICAÇÃO ===
      let level: "high" | "medium" | "low";
      let label: string;
      if (totalScore >= 71) {
        level = "high";
        label = "Alta";
      } else if (totalScore >= 41) {
        level = "medium";
        label = "Média";
      } else {
        level = "low";
        label = "Baixa";
      }
      
      // === WEIGHT MULTIPLIER for Global Score ===
      // Alta: 1.0, Média: 0.7, Baixa: 0.4
      let weightMultiplier: number;
      if (level === "high") weightMultiplier = 1.0;
      else if (level === "medium") weightMultiplier = 0.7;
      else weightMultiplier = 0.4;
      
      // Build explanation
      const explanationParts: string[] = [];
      explanationParts.push(`Base histórica: ${validMonths} meses (${historicalBaseScore}%)`);
      explanationParts.push(`Elegibilidade: ${eligibleMonthsCount}/${last6MonthsWithData.length} meses (${eligibilityConsistencyScore}%)`);
      explanationParts.push(`Estabilidade: ${regressionCount === 0 ? 'sem' : regressionCount} regressão (${criteriaStabilityScore}%)`);
      explanationParts.push(`Regularidade: ${oscillationLevel === 'low' ? 'baixa' : oscillationLevel === 'moderate' ? 'moderada' : 'alta'} oscilação (${operationalScore}%)`);
      
      return {
        score: totalScore,
        level,
        label,
        components: {
          historicalBase: {
            score: historicalBaseScore,
            validMonths,
            contribution: historicalBaseContribution
          },
          eligibilityConsistency: {
            score: eligibilityConsistencyScore,
            eligibleMonths: eligibleMonthsCount,
            totalMonths: last6MonthsWithData.length,
            contribution: eligibilityContribution
          },
          criteriaStability: {
            score: criteriaStabilityScore,
            regressionCount,
            contribution: criteriaContribution
          },
          operationalRegularity: {
            score: operationalScore,
            oscillationLevel,
            contribution: operationalContribution
          }
        },
        explanation: explanationParts.join(" • "),
        weightMultiplier
      };
    };

    // Calculate unit scores with eligibility check using MASTER RULES
    const unitScores: UnitScoreData[] = activeUnits.map(unit => {
      const unitTransactions = transactions.filter((t) => {
        const tDate = parseISO(t.date);
        return t.unit === unit.id && tDate >= currentMonthStart && tDate <= currentMonthEnd;
      });

      const metrics = calculateMetrics(unitTransactions);
      
      // Use master eligibility check function for ALL units
      const eligibilityCheck = checkUnitEligibility(
        metrics.daysActive,
        unitTransactions.length,
        metrics.concentrationPercentage
      );
      
      // Calculate reliability score
      const reliability = calculateUnitReliability(eligibilityCheck.isEligible, unit.id);
      
      // For Centro Clínico, use weighted score from specialties if available
      if (unit.id === "CENTRO_CLINICO" && eligibleSpecialties.length > 0) {
        const status = getScoreStatus(centroClinicoWeightedScore);
        return {
          unitId: unit.id,
          unitName: unit.name,
          score: centroClinicoWeightedScore,
          isEligible: eligibilityCheck.isEligible,
          weight: 0,
          income: metrics.income,
          daysActive: metrics.daysActive,
          recurrence: metrics.recurrenceIndex,
          concentration: metrics.concentrationPercentage,
          transactionCount: unitTransactions.length,
          status: eligibilityCheck.isEligible ? status : "ineligible",
          components: {
            regularity: 0,
            recurrence: 0,
            concentration: 0,
            trend: 0
          },
          eligibilityCheck,
          reliability
        };
      }

      // For other units, calculate directly
      const allUnitTxns = transactions.filter(t => t.unit === unit.id);
      const trendScore = calculateTrendScore(allUnitTxns);
      
      const { score, components } = calculateScore(
        metrics.daysActive,
        metrics.recurrenceIndex,
        metrics.concentrationPercentage,
        trendScore
      );

      const status = eligibilityCheck.isEligible ? getScoreStatus(score) : "ineligible";

      return {
        unitId: unit.id,
        unitName: unit.name,
        score: eligibilityCheck.isEligible ? score : 0,
        isEligible: eligibilityCheck.isEligible,
        weight: 0,
        income: metrics.income,
        daysActive: metrics.daysActive,
        recurrence: metrics.recurrenceIndex,
        concentration: metrics.concentrationPercentage,
        transactionCount: unitTransactions.length,
        status,
        components,
        eligibilityCheck,
        reliability
      };
    });

    // Calculate unit weights based on income proportion
    const totalUnitIncome = unitScores.reduce((sum, u) => sum + u.income, 0);
    unitScores.forEach(u => {
      u.weight = totalUnitIncome > 0 ? u.income / totalUnitIncome : 0;
    });

    // Calculate global weighted score
    const eligibleUnits = unitScores.filter(u => u.isEligible);
    let globalScore = 0;
    
    if (eligibleUnits.length > 0) {
      const eligibleUnitIncome = eligibleUnits.reduce((sum, u) => sum + u.income, 0);
      eligibleUnits.forEach(u => {
        const eligibleWeight = eligibleUnitIncome > 0 ? u.income / eligibleUnitIncome : 0;
        globalScore += u.score * eligibleWeight;
      });
      globalScore = Math.round(globalScore);
    }

    const globalStatus = eligibleUnits.length > 0 ? getScoreStatus(globalScore) : "ineligible";
    const globalLabel = getScoreLabel(globalStatus);
    const isGlobalEligible = eligibleUnits.length > 0;

    // Build explanation
    const unitWeightsExplanation = unitScores
      .filter(u => u.isEligible)
      .map(u => ({
        unitName: u.unitName,
        weight: u.weight,
        income: u.income
      }));

    const explanation = isGlobalEligible
      ? "Score Global calculado como média ponderada dos Scores das Unidades, com pesos proporcionais à participação financeira mensal."
      : "Score Global indisponível — nenhuma unidade atingiu critérios mínimos de elegibilidade no período.";

    return {
      globalScore,
      globalStatus,
      globalLabel,
      isEligible: isGlobalEligible,
      unitScores,
      centroClinicoSpecialties: specialtyScores,
      explanation,
      unitWeightsExplanation
    };
  }, [transactions, settings]);
}
