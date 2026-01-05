/**
 * Utility functions for robust status checking
 * Single source of truth for status-related logic
 */

/**
 * Checks if a status represents a cancelled transaction
 * Handles multiple formats: CANCELADO, cancelado, CANCELLED, CANCELED
 */
export function isCancelled(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toUpperCase();
  return normalized === "CANCELADO" || normalized === "CANCELLED" || normalized === "CANCELED";
}

/**
 * Checks if a status represents a realized/executed transaction
 * These are the only transactions that impact balances
 */
export function isRealized(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toUpperCase();
  return normalized === "REALIZADO" || normalized === "RECEBIDO";
}

/**
 * Checks if a status represents a pending/predicted transaction
 */
export function isPending(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toUpperCase();
  return normalized === "PENDENTE" || normalized === "PREVISTO";
}

/**
 * Filters out cancelled transactions from an array
 */
export function excludeCancelled<T extends { status?: string | null }>(items: T[]): T[] {
  return items.filter(item => !isCancelled(item.status));
}

/**
 * Filters to only realized transactions from an array
 */
export function onlyRealized<T extends { status?: string | null }>(items: T[]): T[] {
  return items.filter(item => isRealized(item.status));
}
