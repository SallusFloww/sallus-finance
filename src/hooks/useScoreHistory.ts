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
import { ptBR } from "date-fns/locale";
import { ELIGIBILITY_RULES, checkUnitEligibility } from "./useWeightedScore";

const { MIN_ACTIVE_DAYS, MIN_TOTAL_TRANSACTIONS, MAX_CONCENTRATION_PERCENT } = ELIGIBILITY_RULES;

// Types for historical data
export type GlobalScoreStatus = "unavailable" | "partial" | "released";
export type UnitMaturityTrend = "growing" | "stable" | "regressive";

export interface MonthlyUnitData {
  unitId: string;
  unitName: string;
  daysActive: number;
  transactionCount: number;
  concentration: number;
  criteriaMetCount: number; // 0-3
  maturityPercentage: number; // 0, 33, 66, 100
  state: "not-eligible" | "partial" | "eligible";
  daysMet: boolean;
  transactionsMet: boolean;
  concentrationMet: boolean;
}

export interface MonthlyGlobalScoreData {
  month: Date;
  monthLabel: string;
  monthKey: string; // YYYY-MM format
  globalScore: number | null;
  globalStatus: GlobalScoreStatus;
  classification: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  eligibleUnitsCount: number;
  eligibleUnitNames: string[];
  blockingCriterion: string | null;
  unitData: MonthlyUnitData[];
}

export interface UnitMaturityHistory {
  unitId: string;
  unitName: string;
  monthlyData: {
    month: Date;
    monthLabel: string;
    criteriaMetCount: number;
    maturityPercentage: number;
    state: "not-eligible" | "partial" | "eligible";
  }[];
  averageMaturity6Months: number;
  eligibilityFrequency: number; // How often eligible in last 6 months (0-100%)
  trend: UnitMaturityTrend;
  currentState: "not-eligible" | "partial" | "eligible";
  currentMaturity: number;
  // Unit Reliability Score data (new structure)
  reliabilityScore: number; // 0-100%
  reliabilityLevel: "high" | "medium" | "low";
  reliabilityLabel: string;
  reliabilityComponents: {
    historicalBase: { score: number; validMonths: number; contribution: number };
    eligibilityConsistency: { score: number; eligibleMonths: number; totalMonths: number; contribution: number };
    criteriaStability: { score: number; regressionCount: number; contribution: number };
    operationalRegularity: { score: number; oscillationLevel: "low" | "moderate" | "high"; contribution: number };
  };
  validMonthsCount: number; // Number of months with data
  hasCriticalRegressionRecent: boolean; // Critical regression in last 3 months
  // Previous reliability level for alert detection
  previousReliabilityLevel: "high" | "medium" | "low" | null;
}

export interface ScoreHistoryData {
  monthlyHistory: MonthlyGlobalScoreData[];
  unitMaturityHistory: UnitMaturityHistory[];
  maturityRanking: UnitMaturityHistory[];
}

function getScoreStatus(score: number): "excellent" | "healthy" | "attention" | "risk" | "critical" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 55) return "attention";
  if (score >= 40) return "risk";
  return "critical";
}

function calculateMaturityPercentage(criteriaMetCount: number): number {
  switch (criteriaMetCount) {
    case 0: return 0;
    case 1: return 33;
    case 2: return 66;
    case 3: return 100;
    default: return 0;
  }
}

function calculateTrend(recentMonths: { maturityPercentage: number }[]): UnitMaturityTrend {
  if (recentMonths.length < 2) return "stable";
  
  const last3 = recentMonths.slice(-3);
  if (last3.length < 2) return "stable";
  
  // Calculate trend direction
  let improvements = 0;
  let regressions = 0;
  
  for (let i = 1; i < last3.length; i++) {
    const diff = last3[i].maturityPercentage - last3[i - 1].maturityPercentage;
    if (diff > 0) improvements++;
    if (diff < 0) regressions++;
  }
  
  if (improvements > regressions) return "growing";
  if (regressions > improvements) return "regressive";
  return "stable";
}

export function useScoreHistory(
  transactions: Transaction[],
  settings: Settings
): ScoreHistoryData {
  return useMemo(() => {
    const now = new Date();
    const activeUnits = settings.units.filter(u => u.active);
    
    // Generate 12 months of history (including current month)
    const monthsInterval = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: startOfMonth(now)
    });

    // Calculate monthly history
    const monthlyHistory: MonthlyGlobalScoreData[] = monthsInterval.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const totalDays = monthEnd.getDate();
      const monthLabel = format(monthDate, "MMM yyyy", { locale: ptBR });
      const monthKey = format(monthDate, "yyyy-MM");

      // Calculate unit data for this month
      const unitData: MonthlyUnitData[] = activeUnits.map(unit => {
        const unitTransactions = transactions.filter(t => {
          const tDate = parseISO(t.date);
          return t.unit === unit.id && tDate >= monthStart && tDate <= monthEnd;
        });

        const daysActive = new Set(
          unitTransactions.map(t => format(parseISO(t.date), "yyyy-MM-dd"))
        ).size;

        const transactionCount = unitTransactions.length;

        // Calculate concentration
        const dailyIncomes: Record<string, number> = {};
        unitTransactions
          .filter(t => t.type === "INCOME")
          .forEach(t => {
            const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
            dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
          });

        const totalIncome = Object.values(dailyIncomes).reduce((sum, v) => sum + v, 0);
        const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
        const concentration = totalIncome > 0 ? (maxDayIncome / totalIncome) * 100 : 0;

        // Check eligibility using master rules
        const eligibilityCheck = checkUnitEligibility(daysActive, transactionCount, concentration);
        
        const state: "not-eligible" | "partial" | "eligible" = 
          eligibilityCheck.criteriaMetCount === 3 ? "eligible" :
          eligibilityCheck.criteriaMetCount >= 1 ? "partial" : "not-eligible";

        return {
          unitId: unit.id,
          unitName: unit.name,
          daysActive,
          transactionCount,
          concentration,
          criteriaMetCount: eligibilityCheck.criteriaMetCount,
          maturityPercentage: calculateMaturityPercentage(eligibilityCheck.criteriaMetCount),
          state,
          daysMet: eligibilityCheck.daysMet,
          transactionsMet: eligibilityCheck.transactionsMet,
          concentrationMet: eligibilityCheck.concentrationMet
        };
      });

      // Calculate global score for this month
      const eligibleUnits = unitData.filter(u => u.state === "eligible");
      const eligibleUnitNames = eligibleUnits.map(u => u.unitName);
      const eligibleUnitsCount = eligibleUnits.length;

      let globalScore: number | null = null;
      let globalStatus: GlobalScoreStatus = "unavailable";
      let classification: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible" = "ineligible";

      if (eligibleUnitsCount > 0) {
        globalStatus = "released";
        // Simplified score calculation (average of eligible units' maturity)
        const avgMaturity = eligibleUnits.reduce((sum, u) => sum + u.maturityPercentage, 0) / eligibleUnitsCount;
        globalScore = Math.round(avgMaturity);
        classification = getScoreStatus(globalScore);
      } else if (unitData.some(u => u.state === "partial")) {
        globalStatus = "partial";
      }

      // Find blocking criterion
      let blockingCriterion: string | null = null;
      if (globalStatus !== "released") {
        const bottleneckCounts = { concentration: 0, days: 0, transactions: 0 };
        unitData.forEach(u => {
          if (!u.concentrationMet) bottleneckCounts.concentration++;
          if (!u.daysMet) bottleneckCounts.days++;
          if (!u.transactionsMet) bottleneckCounts.transactions++;
        });

        if (bottleneckCounts.concentration >= bottleneckCounts.days && 
            bottleneckCounts.concentration >= bottleneckCounts.transactions) {
          blockingCriterion = "Concentração excessiva";
        } else if (bottleneckCounts.days >= bottleneckCounts.transactions) {
          blockingCriterion = "Poucos dias ativos";
        } else {
          blockingCriterion = "Poucas movimentações";
        }
      }

      return {
        month: monthDate,
        monthLabel,
        monthKey,
        globalScore,
        globalStatus,
        classification,
        eligibleUnitsCount,
        eligibleUnitNames,
        blockingCriterion,
        unitData
      };
    });

    // Calculate unit maturity history with reliability scores
    const unitMaturityHistory: UnitMaturityHistory[] = activeUnits.map(unit => {
      const monthlyData = monthlyHistory.map(mh => {
        const unitMonth = mh.unitData.find(u => u.unitId === unit.id);
        return {
          month: mh.month,
          monthLabel: mh.monthLabel,
          criteriaMetCount: unitMonth?.criteriaMetCount ?? 0,
          maturityPercentage: unitMonth?.maturityPercentage ?? 0,
          state: unitMonth?.state ?? "not-eligible" as const
        };
      });

      // Calculate 6-month average maturity
      const last6Months = monthlyData.slice(-6);
      const averageMaturity6Months = last6Months.length > 0
        ? Math.round(last6Months.reduce((sum, m) => sum + m.maturityPercentage, 0) / last6Months.length)
        : 0;

      // Calculate eligibility frequency (last 6 months)
      const eligibleMonths = last6Months.filter(m => m.state === "eligible").length;
      const eligibilityFrequency = last6Months.length > 0
        ? Math.round((eligibleMonths / last6Months.length) * 100)
        : 0;

      // Calculate trend based on last 3 months
      const trend = calculateTrend(monthlyData.slice(-3));

      // Current state
      const currentMonth = monthlyData[monthlyData.length - 1];
      const currentState = currentMonth?.state ?? "not-eligible";
      const currentMaturity = currentMonth?.maturityPercentage ?? 0;
      
      // Calculate reliability score with NEW 4-component formula
      const validMonthsCount = monthlyData.filter(m => m.maturityPercentage > 0 || m.criteriaMetCount > 0).length;
      
      // Check for critical regression in last 3 months
      const last3MonthsData = monthlyData.slice(-3);
      let hasCriticalRegressionRecent = false;
      for (let i = 1; i < last3MonthsData.length; i++) {
        if (last3MonthsData[i-1].state === "eligible" && last3MonthsData[i].state === "not-eligible") {
          hasCriticalRegressionRecent = true;
          break;
        }
      }
      
      // === 1️⃣ BASE HISTÓRICA VÁLIDA (peso 30%) ===
      let historicalBaseScore: number;
      if (validMonthsCount >= 6) historicalBaseScore = 100;
      else if (validMonthsCount >= 3) historicalBaseScore = 60;
      else historicalBaseScore = 20;
      const historicalBaseContribution = Math.round(historicalBaseScore * 0.30);

      // === 2️⃣ CONSISTÊNCIA DE ELEGIBILIDADE (peso 30%) ===
      const last6MonthsWithData = last6Months.filter(m => m.maturityPercentage > 0 || m.criteriaMetCount > 0);
      const eligibleMonthsCount = last6MonthsWithData.filter(m => m.state === "eligible").length;
      const eligibilityConsistencyScore = last6MonthsWithData.length > 0 
        ? Math.round((eligibleMonthsCount / last6MonthsWithData.length) * 100)
        : 0;
      const eligibilityContribution = Math.round(eligibilityConsistencyScore * 0.30);

      // === 3️⃣ ESTABILIDADE DE CRITÉRIOS (peso 25%) ===
      let regressionCount = 0;
      for (let i = 1; i < last3MonthsData.length; i++) {
        const prev = last3MonthsData[i - 1];
        const curr = last3MonthsData[i];
        if ((prev.maturityPercentage > 0 || prev.criteriaMetCount > 0) && 
            (curr.maturityPercentage > 0 || curr.criteriaMetCount > 0) && 
            prev.criteriaMetCount > curr.criteriaMetCount) {
          regressionCount++;
        }
      }
      let criteriaStabilityScore: number;
      if (regressionCount === 0) criteriaStabilityScore = 100;
      else if (regressionCount === 1) criteriaStabilityScore = 60;
      else criteriaStabilityScore = 20;
      const criteriaContribution = Math.round(criteriaStabilityScore * 0.25);

      // === 4️⃣ REGULARIDADE OPERACIONAL (peso 15%) ===
      // Calculate from maturity percentage changes
      const maturityLast3 = last3MonthsData.filter(m => m.maturityPercentage > 0 || m.criteriaMetCount > 0).map(m => m.maturityPercentage);
      let oscillationLevel: "low" | "moderate" | "high" = "low";
      let operationalScore = 100;
      
      if (maturityLast3.length >= 2) {
        const maxMat = Math.max(...maturityLast3);
        const minMat = Math.min(...maturityLast3);
        const range = maxMat - minMat;
        
        if (range >= 66) {
          oscillationLevel = "high";
          operationalScore = 20;
        } else if (range >= 33) {
          oscillationLevel = "moderate";
          operationalScore = 60;
        }
      }
      const operationalContribution = Math.round(operationalScore * 0.15);

      // === SCORE FINAL ===
      const reliabilityScore = historicalBaseContribution + eligibilityContribution + criteriaContribution + operationalContribution;
      
      // === CLASSIFICAÇÃO ===
      let reliabilityLevel: "high" | "medium" | "low";
      let reliabilityLabel: string;
      if (reliabilityScore >= 71) {
        reliabilityLevel = "high";
        reliabilityLabel = "Alta";
      } else if (reliabilityScore >= 41) {
        reliabilityLevel = "medium";
        reliabilityLabel = "Média";
      } else {
        reliabilityLevel = "low";
        reliabilityLabel = "Baixa";
      }

      // Previous reliability level (simulated - would need historical tracking in production)
      const previousReliabilityLevel: "high" | "medium" | "low" | null = null;

      return {
        unitId: unit.id,
        unitName: unit.name,
        monthlyData,
        averageMaturity6Months,
        eligibilityFrequency,
        trend,
        currentState,
        currentMaturity,
        reliabilityScore,
        reliabilityLevel,
        reliabilityLabel,
        reliabilityComponents: {
          historicalBase: {
            score: historicalBaseScore,
            validMonths: validMonthsCount,
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
        validMonthsCount,
        hasCriticalRegressionRecent,
        previousReliabilityLevel
      };
    });

    // Create maturity ranking - NOW sorted by (Score × Confiabilidade)
    // This ensures units with high score but low reliability rank lower
    const maturityRanking = [...unitMaturityHistory].sort((a, b) => {
      // Calculate weighted score: avgMaturity × (reliabilityScore / 100)
      const aWeightedScore = a.averageMaturity6Months * (a.reliabilityScore / 100);
      const bWeightedScore = b.averageMaturity6Months * (b.reliabilityScore / 100);
      
      // Primary: weighted score (descending)
      if (bWeightedScore !== aWeightedScore) {
        return bWeightedScore - aWeightedScore;
      }
      // Secondary: eligibility frequency
      return b.eligibilityFrequency - a.eligibilityFrequency;
    });

    return {
      monthlyHistory,
      unitMaturityHistory,
      maturityRanking
    };
  }, [transactions, settings]);
}
