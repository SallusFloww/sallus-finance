import { useMemo } from "react";
import { ScoreHistoryData, MonthlyUnitData } from "./useScoreHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type AlertSeverity = "critical" | "moderate" | "stagnation";
export type AlertType = 
  | "eligible_to_not_eligible" 
  | "lost_2_criteria" 
  | "lost_1_criterion" 
  | "maturity_drop" 
  | "high_concentration_persistent" 
  | "stagnation";

export interface MaturityAlert {
  id: string;
  unitId: string;
  unitName: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  criteriaAffected: string[];
  previousMonth: {
    label: string;
    criteriaMetCount: number;
    maturityPercentage: number;
    state: "not-eligible" | "partial" | "eligible";
  };
  currentMonth: {
    label: string;
    criteriaMetCount: number;
    maturityPercentage: number;
    state: "not-eligible" | "partial" | "eligible";
  };
  suggestedAction: string;
  globalScoreImpact: string;
  createdAt: Date;
}

export interface MaturityAlertsData {
  alerts: MaturityAlert[];
  criticalCount: number;
  moderateCount: number;
  stagnationCount: number;
  hasActiveAlerts: boolean;
  alertsByUnit: Record<string, MaturityAlert[]>;
}

function getAlertTitle(type: AlertType): string {
  switch (type) {
    case "eligible_to_not_eligible":
      return "Regressão Crítica: Perda de Elegibilidade";
    case "lost_2_criteria":
      return "Regressão Crítica: Perda de 2+ Critérios";
    case "lost_1_criterion":
      return "Regressão Moderada: Perda de Critério";
    case "maturity_drop":
      return "Regressão Moderada: Queda de Maturidade";
    case "high_concentration_persistent":
      return "Alerta: Concentração Persistente";
    case "stagnation":
      return "Estagnação: Sem Evolução";
    default:
      return "Alerta de Maturidade";
  }
}

function getSuggestedAction(type: AlertType, criteriaAffected: string[]): string {
  switch (type) {
    case "eligible_to_not_eligible":
      return `Priorizar imediatamente: recuperar ${criteriaAffected.join(" e ")} para retomar elegibilidade no próximo ciclo.`;
    case "lost_2_criteria":
      return `Ação urgente: revisar operação para recuperar ${criteriaAffected.join(" e ")}.`;
    case "lost_1_criterion":
      return `Monitorar e agir: focar em recuperar ${criteriaAffected[0] || "critério perdido"} para evitar regressão adicional.`;
    case "maturity_drop":
      return `Avaliar causas da queda de maturidade e implementar medidas corretivas.`;
    case "high_concentration_persistent":
      return `Distribuir faturamento em pelo menos 3 dias distintos para reduzir concentração abaixo de 80%.`;
    case "stagnation":
      return `Implementar ações para evoluir maturidade: aumentar dias ativos ou diversificar receitas.`;
    default:
      return `Revisar indicadores e implementar melhorias operacionais.`;
  }
}

function getGlobalScoreImpact(severity: AlertSeverity, state: "not-eligible" | "partial" | "eligible"): string {
  if (severity === "critical") {
    if (state === "not-eligible") {
      return "Unidade não contribui para o Score Global. Impacto direto na capacidade de liberação.";
    }
    return "Risco de perda de contribuição para o Score Global no próximo ciclo.";
  }
  if (severity === "moderate") {
    return "Pode reduzir a pontuação global se não corrigido nos próximos meses.";
  }
  return "Impacto limitado no curto prazo, mas pode indicar problema estrutural.";
}

function findLostCriteria(
  prev: MonthlyUnitData | undefined,
  curr: MonthlyUnitData | undefined
): string[] {
  if (!prev || !curr) return [];
  
  const lost: string[] = [];
  if (prev.daysMet && !curr.daysMet) lost.push("Dias ativos");
  if (prev.transactionsMet && !curr.transactionsMet) lost.push("Movimentações");
  if (prev.concentrationMet && !curr.concentrationMet) lost.push("Concentração");
  
  return lost;
}

export function useMaturityAlerts(data: ScoreHistoryData): MaturityAlertsData {
  return useMemo(() => {
    const alerts: MaturityAlert[] = [];
    const now = new Date();

    // Need at least 2 months of data
    if (data.monthlyHistory.length < 2) {
      return {
        alerts: [],
        criticalCount: 0,
        moderateCount: 0,
        stagnationCount: 0,
        hasActiveAlerts: false,
        alertsByUnit: {}
      };
    }

    // Get current and previous month data
    const currentMonthData = data.monthlyHistory[data.monthlyHistory.length - 1];
    const previousMonthData = data.monthlyHistory[data.monthlyHistory.length - 2];

    // Check for persistent concentration (last 2 months)
    const last2Months = data.monthlyHistory.slice(-2);

    // Analyze each unit
    data.unitMaturityHistory.forEach(unit => {
      const currentUnitData = currentMonthData.unitData.find(u => u.unitId === unit.unitId);
      const previousUnitData = previousMonthData.unitData.find(u => u.unitId === unit.unitId);

      if (!currentUnitData) return;

      // 1. Check: Eligible → Not Eligible (CRITICAL)
      if (previousUnitData?.state === "eligible" && currentUnitData.state === "not-eligible") {
        const lostCriteria = findLostCriteria(previousUnitData, currentUnitData);
        alerts.push({
          id: `${unit.unitId}-eligible-to-not-eligible-${currentMonthData.monthKey}`,
          unitId: unit.unitId,
          unitName: unit.unitName,
          severity: "critical",
          type: "eligible_to_not_eligible",
          title: getAlertTitle("eligible_to_not_eligible"),
          description: `${unit.unitName} perdeu elegibilidade: passou de Elegível para Não Elegível.`,
          criteriaAffected: lostCriteria,
          previousMonth: {
            label: previousMonthData.monthLabel,
            criteriaMetCount: previousUnitData.criteriaMetCount,
            maturityPercentage: previousUnitData.maturityPercentage,
            state: previousUnitData.state
          },
          currentMonth: {
            label: currentMonthData.monthLabel,
            criteriaMetCount: currentUnitData.criteriaMetCount,
            maturityPercentage: currentUnitData.maturityPercentage,
            state: currentUnitData.state
          },
          suggestedAction: getSuggestedAction("eligible_to_not_eligible", lostCriteria),
          globalScoreImpact: getGlobalScoreImpact("critical", currentUnitData.state),
          createdAt: now
        });
        return; // Don't add other alerts for this unit
      }

      // 2. Check: Lost 2+ criteria (CRITICAL)
      if (previousUnitData) {
        const criteriaLost = previousUnitData.criteriaMetCount - currentUnitData.criteriaMetCount;
        if (criteriaLost >= 2) {
          const lostCriteria = findLostCriteria(previousUnitData, currentUnitData);
          alerts.push({
            id: `${unit.unitId}-lost-2-criteria-${currentMonthData.monthKey}`,
            unitId: unit.unitId,
            unitName: unit.unitName,
            severity: "critical",
            type: "lost_2_criteria",
            title: getAlertTitle("lost_2_criteria"),
            description: `${unit.unitName} perdeu ${criteriaLost} critérios de elegibilidade em um mês.`,
            criteriaAffected: lostCriteria,
            previousMonth: {
              label: previousMonthData.monthLabel,
              criteriaMetCount: previousUnitData.criteriaMetCount,
              maturityPercentage: previousUnitData.maturityPercentage,
              state: previousUnitData.state
            },
            currentMonth: {
              label: currentMonthData.monthLabel,
              criteriaMetCount: currentUnitData.criteriaMetCount,
              maturityPercentage: currentUnitData.maturityPercentage,
              state: currentUnitData.state
            },
            suggestedAction: getSuggestedAction("lost_2_criteria", lostCriteria),
            globalScoreImpact: getGlobalScoreImpact("critical", currentUnitData.state),
            createdAt: now
          });
          return;
        }

        // 3. Check: Lost 1 criterion (MODERATE)
        if (criteriaLost === 1) {
          const lostCriteria = findLostCriteria(previousUnitData, currentUnitData);
          alerts.push({
            id: `${unit.unitId}-lost-1-criterion-${currentMonthData.monthKey}`,
            unitId: unit.unitId,
            unitName: unit.unitName,
            severity: "moderate",
            type: "lost_1_criterion",
            title: getAlertTitle("lost_1_criterion"),
            description: `${unit.unitName} perdeu 1 critério de elegibilidade.`,
            criteriaAffected: lostCriteria,
            previousMonth: {
              label: previousMonthData.monthLabel,
              criteriaMetCount: previousUnitData.criteriaMetCount,
              maturityPercentage: previousUnitData.maturityPercentage,
              state: previousUnitData.state
            },
            currentMonth: {
              label: currentMonthData.monthLabel,
              criteriaMetCount: currentUnitData.criteriaMetCount,
              maturityPercentage: currentUnitData.maturityPercentage,
              state: currentUnitData.state
            },
            suggestedAction: getSuggestedAction("lost_1_criterion", lostCriteria),
            globalScoreImpact: getGlobalScoreImpact("moderate", currentUnitData.state),
            createdAt: now
          });
          return;
        }

        // 4. Check: Maturity drop >= 33% (MODERATE)
        const maturityDrop = previousUnitData.maturityPercentage - currentUnitData.maturityPercentage;
        if (maturityDrop >= 33) {
          alerts.push({
            id: `${unit.unitId}-maturity-drop-${currentMonthData.monthKey}`,
            unitId: unit.unitId,
            unitName: unit.unitName,
            severity: "moderate",
            type: "maturity_drop",
            title: getAlertTitle("maturity_drop"),
            description: `${unit.unitName} teve queda de ${maturityDrop}% na maturidade.`,
            criteriaAffected: [],
            previousMonth: {
              label: previousMonthData.monthLabel,
              criteriaMetCount: previousUnitData.criteriaMetCount,
              maturityPercentage: previousUnitData.maturityPercentage,
              state: previousUnitData.state
            },
            currentMonth: {
              label: currentMonthData.monthLabel,
              criteriaMetCount: currentUnitData.criteriaMetCount,
              maturityPercentage: currentUnitData.maturityPercentage,
              state: currentUnitData.state
            },
            suggestedAction: getSuggestedAction("maturity_drop", []),
            globalScoreImpact: getGlobalScoreImpact("moderate", currentUnitData.state),
            createdAt: now
          });
          return;
        }
      }

      // 5. Check: High concentration (>80%) for 2 consecutive months (MODERATE)
      const hasHighConcentration2Months = last2Months.every(month => {
        const unitData = month.unitData.find(u => u.unitId === unit.unitId);
        return unitData && unitData.concentration > 80;
      });

      if (hasHighConcentration2Months) {
        alerts.push({
          id: `${unit.unitId}-high-concentration-${currentMonthData.monthKey}`,
          unitId: unit.unitId,
          unitName: unit.unitName,
          severity: "moderate",
          type: "high_concentration_persistent",
          title: getAlertTitle("high_concentration_persistent"),
          description: `${unit.unitName} mantém concentração acima de 80% por 2 meses consecutivos.`,
          criteriaAffected: ["Concentração"],
          previousMonth: {
            label: previousMonthData.monthLabel,
            criteriaMetCount: previousUnitData?.criteriaMetCount ?? 0,
            maturityPercentage: previousUnitData?.maturityPercentage ?? 0,
            state: previousUnitData?.state ?? "not-eligible"
          },
          currentMonth: {
            label: currentMonthData.monthLabel,
            criteriaMetCount: currentUnitData.criteriaMetCount,
            maturityPercentage: currentUnitData.maturityPercentage,
            state: currentUnitData.state
          },
          suggestedAction: getSuggestedAction("high_concentration_persistent", ["Concentração"]),
          globalScoreImpact: getGlobalScoreImpact("moderate", currentUnitData.state),
          createdAt: now
        });
        return;
      }

      // 6. Check: Stagnation - no evolution for 3 consecutive months (STAGNATION)
      if (unit.monthlyData.length >= 3) {
        const last3Months = unit.monthlyData.slice(-3);
        const allSameMaturity = last3Months.every(m => 
          m.maturityPercentage === last3Months[0].maturityPercentage
        );
        const notEligible = last3Months.every(m => m.state !== "eligible");

        if (allSameMaturity && notEligible && last3Months[0].maturityPercentage < 100) {
          alerts.push({
            id: `${unit.unitId}-stagnation-${currentMonthData.monthKey}`,
            unitId: unit.unitId,
            unitName: unit.unitName,
            severity: "stagnation",
            type: "stagnation",
            title: getAlertTitle("stagnation"),
            description: `${unit.unitName} não apresenta evolução de maturidade há 3 meses consecutivos.`,
            criteriaAffected: [],
            previousMonth: {
              label: previousMonthData.monthLabel,
              criteriaMetCount: previousUnitData?.criteriaMetCount ?? 0,
              maturityPercentage: previousUnitData?.maturityPercentage ?? 0,
              state: previousUnitData?.state ?? "not-eligible"
            },
            currentMonth: {
              label: currentMonthData.monthLabel,
              criteriaMetCount: currentUnitData.criteriaMetCount,
              maturityPercentage: currentUnitData.maturityPercentage,
              state: currentUnitData.state
            },
            suggestedAction: getSuggestedAction("stagnation", []),
            globalScoreImpact: getGlobalScoreImpact("stagnation", currentUnitData.state),
            createdAt: now
          });
        }
      }
    });

    // Sort alerts by severity
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      moderate: 1,
      stagnation: 2
    };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Count by severity
    const criticalCount = alerts.filter(a => a.severity === "critical").length;
    const moderateCount = alerts.filter(a => a.severity === "moderate").length;
    const stagnationCount = alerts.filter(a => a.severity === "stagnation").length;

    // Group by unit
    const alertsByUnit: Record<string, MaturityAlert[]> = {};
    alerts.forEach(alert => {
      if (!alertsByUnit[alert.unitId]) {
        alertsByUnit[alert.unitId] = [];
      }
      alertsByUnit[alert.unitId].push(alert);
    });

    return {
      alerts,
      criticalCount,
      moderateCount,
      stagnationCount,
      hasActiveAlerts: alerts.length > 0,
      alertsByUnit
    };
  }, [data]);
}
