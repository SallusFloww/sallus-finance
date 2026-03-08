/**
 * Production status transition validation
 * Single source of truth for valid status changes
 */
import { ProductionStatus } from "@/types";

export const STATUS_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  PRODUZIDO: ["FATURADO", "CANCELADO"],
  FATURADO: ["RECEBIDO", "GLOSADO"],
  GLOSADO: ["FATURADO"],
  RECEBIDO: [],
  CANCELADO: [],
};

/**
 * Checks if a status transition is valid
 */
export function isValidTransition(
  currentStatus: ProductionStatus,
  newStatus: ProductionStatus,
): boolean {
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Returns a human-readable error for invalid transitions
 */
export function getTransitionError(
  currentStatus: ProductionStatus,
  newStatus: ProductionStatus,
): string {
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed || allowed.length === 0) {
    return `Status "${currentStatus}" é final e não pode ser alterado.`;
  }
  return `Transição "${currentStatus}" → "${newStatus}" não é permitida. Transições válidas: ${allowed.join(", ")}.`;
}
