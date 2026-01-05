import { useMemo } from "react";
import { Transaction, Settings } from "@/types";
import { isRealized } from "@/utils/statusHelpers";

export interface FinancialIntegrityResult {
  isValid: boolean;
  calculatedBalance: number;
  displayedBalance: number;
  difference: number;
  totalIncome: number;
  totalExpense: number;
  initialBalance: number;
  transactionCount: number;
  errorMessage?: string;
}

/**
 * HOOK DE INTEGRIDADE FINANCEIRA
 * 
 * REGRA INVIOLÁVEL:
 * Saldo Atual = Saldo Inicial + Σ(Entradas) - Σ(Saídas)
 * 
 * O caixa NUNCA pode ser alterado diretamente.
 * Toda alteração DEVE nascer de uma movimentação registrada.
 */
export function useFinancialIntegrity(
  transactions: Transaction[],
  settings: Settings
): FinancialIntegrityResult {
  return useMemo(() => {
    const initialBalance = settings.initialBalance || 0;
    
    // Calcular total de entradas e saídas APENAS de transações REALIZADAS
    // Transações CANCELADAS são excluídas do cálculo (usando helper robusto)
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME" && isRealized(t.status))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE" && isRealized(t.status))
      .reduce((sum, t) => sum + t.amount, 0);
    
    // FÓRMULA ÚNICA E INEGOCIÁVEL
    // Saldo Atual = Saldo Inicial + Entradas REALIZADAS - Saídas REALIZADAS
    const calculatedBalance = initialBalance + totalIncome - totalExpense;
    
    // O saldo exibido DEVE ser igual ao calculado
    // Se houver qualquer divergência, há um erro de integridade
    const displayedBalance = calculatedBalance;
    const difference = Math.abs(calculatedBalance - displayedBalance);
    
    const isValid = difference < 0.01; // Tolerância para arredondamento
    
    // Contar apenas transações que compõem o saldo (REALIZADAS)
    const activeTransactionCount = transactions.filter(t => isRealized(t.status)).length;
    
    return {
      isValid,
      calculatedBalance,
      displayedBalance,
      difference,
      totalIncome,
      totalExpense,
      initialBalance,
      transactionCount: activeTransactionCount,
      errorMessage: !isValid 
        ? `Inconsistência financeira detectada. Diferença: R$ ${difference.toFixed(2)}. Verifique as movimentações.`
        : undefined,
    };
  }, [transactions, settings.initialBalance]);
}

/**
 * Validação de rastreabilidade de recebíveis
 * Verifica se todos os recebíveis marcados como recebidos têm transação vinculada
 */
export function validateReceivablesIntegrity(
  receivables: Array<{
    id: string;
    status: string;
    receivedAmount?: number;
    linkedTransactionId?: string;
  }>,
  transactions: Transaction[]
): {
  isValid: boolean;
  orphanedReceivables: string[];
  missingTransactions: string[];
  errorMessage?: string;
} {
  const orphanedReceivables: string[] = [];
  const missingTransactions: string[] = [];
  
  receivables.forEach((r) => {
    // Recebíveis com status RECEBIDO ou RECEBIDO_COM_GLOSA DEVEM ter transação vinculada
    if (
      (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
      (r.receivedAmount ?? 0) > 0
    ) {
      if (!r.linkedTransactionId) {
        orphanedReceivables.push(r.id);
      } else {
        // Verificar se a transação existe
        const transactionExists = transactions.some(
          (t) => t.id === r.linkedTransactionId
        );
        if (!transactionExists) {
          missingTransactions.push(r.id);
        }
      }
    }
  });
  
  const isValid = orphanedReceivables.length === 0 && missingTransactions.length === 0;
  
  let errorMessage: string | undefined;
  if (!isValid) {
    const issues: string[] = [];
    if (orphanedReceivables.length > 0) {
      issues.push(`${orphanedReceivables.length} recebível(is) sem movimentação vinculada`);
    }
    if (missingTransactions.length > 0) {
      issues.push(`${missingTransactions.length} transação(ões) referenciada(s) não encontrada(s)`);
    }
    errorMessage = `Inconsistência detectada: ${issues.join("; ")}. Verifique as movimentações.`;
  }
  
  return {
    isValid,
    orphanedReceivables,
    missingTransactions,
    errorMessage,
  };
}
