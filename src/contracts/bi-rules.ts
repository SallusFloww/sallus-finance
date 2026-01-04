// ============================================
// CONTRATOS DO BI - REGRAS DE CÁLCULO E EXIBIÇÃO
// Release freeze: only bugfixes allowed
// 
// Este arquivo centraliza TODAS as regras de negócio do BI.
// Qualquer mudança aqui exige incremento de versão.
// ============================================

import { APP_VERSION } from "./version";

// ============================================
// REGRAS DE EXIBIÇÃO DE VALORES
// ============================================

/**
 * Regras para exibição de valores vazios ou em consolidação
 */
export const DISPLAY_RULES = {
  /** Texto para valor não disponível */
  NOT_AVAILABLE: "—",
  
  /** Texto para dados em consolidação */
  IN_CONSOLIDATION: "Em consolidação",
  
  /** Texto para score em formação */
  SCORE_IN_FORMATION: "Em Formação",
  
  /** Valor mínimo para considerar dado válido */
  MIN_VALID_VALUE: 0,
} as const;

/**
 * Verifica se um valor é válido para exibição
 * Retorna false para: NaN, null, undefined, Infinity
 */
export function isValidValue(value: unknown): value is number {
  if (value === null || value === undefined) return false;
  if (typeof value !== "number") return false;
  if (isNaN(value)) return false;
  if (!isFinite(value)) return false;
  return true;
}

/**
 * Verifica se há dados suficientes para exibir um KPI
 */
export function hasDataForDisplay(value: number, hasSourceData: boolean): boolean {
  if (!hasSourceData) return false;
  if (!isValidValue(value)) return false;
  return true;
}

/**
 * Formata valor para exibição, respeitando regras de consolidação
 */
export function formatDisplayValue(
  value: number,
  hasData: boolean,
  formatter: (v: number) => string
): string {
  if (!hasData || !isValidValue(value)) {
    return DISPLAY_RULES.NOT_AVAILABLE;
  }
  return formatter(value);
}

// ============================================
// REGRAS DE CÁLCULO DE PERCENTUAIS
// ============================================

/**
 * Regras para cálculo de taxas percentuais
 */
export const PERCENTAGE_RULES = {
  /** Denominador mínimo para calcular porcentagem */
  MIN_DENOMINATOR: 0.01,
  
  /** Valor máximo para exibição de percentual */
  MAX_DISPLAY_PERCENT: 999.9,
  
  /** Casas decimais para percentuais */
  DECIMAL_PLACES: 1,
} as const;

/**
 * Calcula percentual com segurança (evita divisão por zero)
 * Retorna null se denominador insuficiente
 */
export function safePercentage(
  numerator: number,
  denominator: number
): number | null {
  if (!isValidValue(numerator) || !isValidValue(denominator)) {
    return null;
  }
  if (Math.abs(denominator) < PERCENTAGE_RULES.MIN_DENOMINATOR) {
    return null;
  }
  const result = (numerator / denominator) * 100;
  return Math.min(PERCENTAGE_RULES.MAX_DISPLAY_PERCENT, Math.max(0, result));
}

/**
 * Formata percentual para exibição
 */
export function formatPercentage(value: number | null): string {
  if (value === null || !isValidValue(value)) {
    return DISPLAY_RULES.NOT_AVAILABLE;
  }
  return `${value.toFixed(PERCENTAGE_RULES.DECIMAL_PLACES)}%`;
}

// ============================================
// REGRAS DO SCORE FINANCEIRO
// ============================================

/**
 * Regras para cálculo e exibição do Score
 */
export const SCORE_RULES = {
  /** Base mínima para cálculo do score (dias) */
  MIN_DAYS_FOR_SCORE: 7,
  
  /** Transações mínimas para cálculo */
  MIN_TRANSACTIONS_FOR_SCORE: 3,
  
  /** Valor mínimo de movimentação para score */
  MIN_AMOUNT_FOR_SCORE: 100,
  
  /** Thresholds de status */
  THRESHOLDS: {
    EXCELLENT: 85,
    HEALTHY: 70,
    ATTENTION: 55,
    WARNING: 40,
    CRITICAL: 0,
  },
} as const;

export type ScoreStatus = "excellent" | "healthy" | "attention" | "warning" | "critical";

/**
 * Determina se há dados suficientes para calcular score
 */
export function canCalculateScore(
  hasProductionData: boolean,
  hasBillingData: boolean,
  hasCashData: boolean,
  globalScore: number
): boolean {
  // Score = 0 indica dados insuficientes
  if (globalScore === 0) return false;
  
  // Precisa de pelo menos um tipo de dado
  if (!hasProductionData && !hasBillingData && !hasCashData) return false;
  
  return true;
}

/**
 * Obtém status do score
 */
export function getScoreStatus(score: number): ScoreStatus {
  if (!isValidValue(score)) return "critical";
  if (score >= SCORE_RULES.THRESHOLDS.EXCELLENT) return "excellent";
  if (score >= SCORE_RULES.THRESHOLDS.HEALTHY) return "healthy";
  if (score >= SCORE_RULES.THRESHOLDS.ATTENTION) return "attention";
  if (score >= SCORE_RULES.THRESHOLDS.WARNING) return "warning";
  return "critical";
}

/**
 * Obtém label do score
 */
export function getScoreLabel(status: ScoreStatus): string {
  const labels: Record<ScoreStatus, string> = {
    excellent: "Excelente",
    healthy: "Saudável",
    attention: "Atenção",
    warning: "Alerta",
    critical: "Crítico",
  };
  return labels[status];
}

// ============================================
// REGRAS DE TAXAS E KPIs
// ============================================

/**
 * Thresholds para classificação de KPIs
 */
export const KPI_THRESHOLDS = {
  /** Taxa de recebimento */
  RECEIVING_RATE: {
    GOOD: 80,
    WARNING: 60,
  },
  
  /** Taxa de faturamento */
  BILLING_RATE: {
    GOOD: 90,
    WARNING: 70,
  },
  
  /** Taxa de glosa (máximo aceitável) */
  GLOSS_RATE: {
    WARNING: 5,
    CRITICAL: 10,
  },
  
  /** Concentração de pagador (máximo) */
  PAYER_CONCENTRATION: {
    WARNING: 60,
    CRITICAL: 80,
  },
} as const;

export type KPIVariant = "success" | "warning" | "danger";

/**
 * Obtém variante de exibição para KPI
 */
export function getKPIVariant(
  value: number,
  goodThreshold: number,
  warnThreshold: number
): KPIVariant {
  if (!isValidValue(value)) return "warning";
  if (value >= goodThreshold) return "success";
  if (value >= warnThreshold) return "warning";
  return "danger";
}

/**
 * Obtém variante inversa (para métricas onde menor é melhor, como glosa)
 */
export function getKPIVariantInverse(
  value: number,
  warnThreshold: number,
  criticalThreshold: number
): KPIVariant {
  if (!isValidValue(value)) return "warning";
  if (value <= warnThreshold) return "success";
  if (value <= criticalThreshold) return "warning";
  return "danger";
}

// ============================================
// REGRAS DE AGING
// ============================================

/**
 * Faixas de aging (dias)
 */
export const AGING_RANGES = [
  { label: "0-30 dias", min: 0, max: 30, severity: "low" as const },
  { label: "31-60 dias", min: 31, max: 60, severity: "medium" as const },
  { label: "61-90 dias", min: 61, max: 90, severity: "high" as const },
  { label: "90+ dias", min: 91, max: Infinity, severity: "critical" as const },
] as const;

/**
 * Determina se aging é crítico (acima de 60 dias)
 */
export function isAgingCritical(range: string): boolean {
  return range === "61-90 dias" || range === "90+ dias";
}

// ============================================
// REGRAS DE ALERTAS
// ============================================

/**
 * Thresholds para geração de alertas
 */
export const ALERT_RULES = {
  /** Produção muito maior que faturamento (%) */
  PRODUCTION_VS_BILLING_THRESHOLD: 120,
  
  /** Faturamento muito maior que recebido (%) */
  BILLING_VS_RECEIVED_THRESHOLD: 130,
  
  /** Concentração de pagador para alerta (%) */
  PAYER_CONCENTRATION_THRESHOLD: 80,
  
  /** Valor mínimo para considerar aging crítico */
  CRITICAL_AGING_MIN_VALUE: 1000,
} as const;

// ============================================
// METADATA DO CONTRATO
// ============================================

export const CONTRACT_METADATA = {
  version: APP_VERSION,
  lastUpdated: "2024-12-30",
  maintainer: "Sistema IMEC",
  description: "Regras centralizadas do módulo BI",
} as const;
