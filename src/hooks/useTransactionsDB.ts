import { useCallback, useMemo } from "react";
import { useFinancialEntries, FinancialEntry, FinancialEntryInsert } from "./useFinancialEntries";
import { useCompanySettings } from "./useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { parseLocalDate, toStartOfDay } from "@/utils/formatters";
import {
  Transaction,
  DashboardStats,
  UnitStats,
  TransactionStatus,
  Settings,
  InitialBalanceAdjustment,
  FinancialCategory,
} from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isCancelled, isRealized } from "@/utils/statusHelpers";
import { PRODUCTION_TYPE_LABELS, DEFAULT_CATEGORIES } from "@/utils/constants";

// Resolve raw DB category codes to human-readable display labels
function resolveCategoryLabel(categoria: string | null): string {
  if (!categoria) return "";
  // Try production type labels first (e.g. MAT_MED → "Mat/Med", CONSULTA → "Consulta")
  if (PRODUCTION_TYPE_LABELS[categoria]) return PRODUCTION_TYPE_LABELS[categoria];
  // Try default categories by id (e.g. "salario" → "Salário")
  const defaultCat = DEFAULT_CATEGORIES.find(
    (c) => c.id === categoria || c.id.toUpperCase() === categoria.toUpperCase()
  );
  if (defaultCat) return defaultCat.name;
  // Return as-is (custom categories or display names stored directly)
  return categoria;
}

interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: TransactionStatus;
  type?: "INCOME" | "EXPENSE";
  financialCategory?: FinancialCategory;
  search?: string;
  includeCancelled?: boolean;
}

// Convert DB entry to Transaction format
function entryToTransaction(entry: FinancialEntry): Transaction {
  return {
    id: entry.id,
    date: entry.data_prevista,
    type: entry.type === "entrada" ? "INCOME" : "EXPENSE",
    amount: entry.valor,
    financialCategory: (
      entry.categoria?.startsWith("NAO_OP") ? "NAO_OPERACIONAL"
        : entry.categoria?.startsWith("COMP") ? "COMPARTILHADO"
        : "OPERACIONAL"
    ) as FinancialCategory,
    unit: entry.unit_id || "",
    specialty: entry.specialty || undefined,
    category: resolveCategoryLabel(entry.categoria),
    paymentMethod: (entry.payment_method as any) || "PIX",
    paymentMethodParticular: entry.receipt_type === "PARTICULAR" ? (entry.payment_method as any) : undefined,
    status: entry.status === "recebido" 
      ? "REALIZADO" 
      : entry.status === "cancelado" 
        ? "CANCELADO" 
        : "PENDENTE",
    receiptType: entry.receipt_type as any,
    operadora: entry.operadora as any,
    notes: entry.observacao || undefined,
    createdBy: entry.created_by || "system",
    createdAt: entry.created_at,
    receivedAt: entry.data_recebimento || undefined,
    cancelledAt: entry.cancelled_at || undefined,
    cancelledBy: entry.cancelled_by || undefined,
    cancelledReason: entry.cancel_reason || undefined,
  };
}

// Convert Transaction to DB insert format
function transactionToEntry(
  t: Omit<Transaction, "id" | "createdAt">
): FinancialEntryInsert {
  return {
    type: t.type === "INCOME" ? "entrada" : "saida",
    status: t.status === "REALIZADO" 
      ? "recebido" 
      : t.status === "CANCELADO" 
        ? "cancelado" 
        : "previsto",
    descricao: t.category || t.notes || "Movimentação",
    categoria: t.category,
    valor: t.amount,
    data_prevista: t.date,
    data_recebimento: t.receivedAt,
    observacao: t.notes,
    unit_id: t.unit || undefined,
    specialty: t.specialty || undefined,
    payment_method: t.paymentMethod,
    receipt_type: t.receiptType,
    operadora: t.operadora,
  };
}

export function useTransactionsDB() {
  const { currentCompany, profile } = useAuth();
  const {
    entries,
    loading,
    addEntry,
    updateEntry,
    cancelEntry,
    markAsReceived: markEntryAsReceived,
    filterEntries: filterDbEntries,
    getStats: getDbStats,
    refetch,
  } = useFinancialEntries();

  // Get settings from database via useCompanySettings
  const { 
    settings, 
    updateSettings: updateCompanySettings,
    loading: settingsLoading 
  } = useCompanySettings();

  // Convert all entries to Transaction format
  const transactions = useMemo(
    () => entries.map(entryToTransaction),
    [entries]
  );

  // Add transaction
  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, "id" | "createdAt">) => {
      const entry = transactionToEntry(transaction);
      const result = await addEntry(entry);
      if (result) {
        return entryToTransaction(result);
      }
      return null;
    },
    [addEntry]
  );

  // Update transaction
  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>, _editedBy: string = "system") => {
      const dbUpdates: any = {};
      
      if (updates.status !== undefined) {
        dbUpdates.status = updates.status === "REALIZADO" 
          ? "recebido" 
          : updates.status === "CANCELADO" 
            ? "cancelado" 
            : "previsto";
      }
      if (updates.amount !== undefined) dbUpdates.valor = updates.amount;
      if (updates.date !== undefined) dbUpdates.data_prevista = updates.date;
      if (updates.category !== undefined) dbUpdates.categoria = updates.category;
      if (updates.notes !== undefined) dbUpdates.observacao = updates.notes;
      if (updates.unit !== undefined) dbUpdates.unit_id = updates.unit;
      if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
      if (updates.receiptType !== undefined) dbUpdates.receipt_type = updates.receiptType;
      if (updates.operadora !== undefined) dbUpdates.operadora = updates.operadora;
      if (updates.receivedAt !== undefined) dbUpdates.data_recebimento = updates.receivedAt;

      return updateEntry(id, dbUpdates);
    },
    [updateEntry]
  );

  // Cancel transaction (soft delete)
  const cancelTransaction = useCallback(
    async (id: string, cancelledBy: string, reason?: string) => {
      return cancelEntry(id, reason);
    },
    [cancelEntry]
  );

  // Delete transaction (not allowed - use cancel)
  const deleteTransaction = useCallback(
    (_id: string) => {
      toast.error("Exclusão física não permitida. Use cancelamento.");
    },
    []
  );

  // Filter transactions
  const filterTransactions = useCallback(
    (filters: TransactionFilters): Transaction[] => {
      return transactions.filter((t) => {
        // HOTFIX P0: usa parseLocalDate para YYYY-MM-DD (evita UTC shift)
        const transactionDate = toStartOfDay(parseLocalDate(t.date));

        if (filters.startDate && transactionDate < toStartOfDay(filters.startDate)) return false;
        if (filters.endDate && transactionDate > toStartOfDay(filters.endDate)) return false;
        if (filters.unit && t.unit !== filters.unit) return false;
        if (filters.type && t.type !== filters.type) return false;
        if (filters.status && t.status !== filters.status) return false;
        if (filters.financialCategory && t.financialCategory !== filters.financialCategory) return false;
        
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch =
            t.category?.toLowerCase().includes(searchLower) ||
            t.reference?.toLowerCase().includes(searchLower) ||
            t.notes?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }

        return true;
      });
    },
    [transactions]
  );

  // Get stats - SINGLE SOURCE OF TRUTH
  // REGRA: Apenas movimentações com status REALIZADO impactam o saldo
  // Cancelados NUNCA entram no saldo, Previstos são informativos
  const getStats = useCallback(
    (startDate?: Date, endDate?: Date): DashboardStats => {
      const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const filtered = filterTransactions({ startDate: start, endDate: end });

      // Separar por tipo e status (usando helpers robustos)
      const allIncomes = filtered.filter((t) => t.type === "INCOME");
      const allExpenses = filtered.filter((t) => t.type === "EXPENSE");
      
      const pendingIncomes = allIncomes.filter((t) => !isRealized(t.status) && !isCancelled(t.status));
      const realizedIncomes = allIncomes.filter((t) => isRealized(t.status));
      const cancelledIncomes = allIncomes.filter((t) => isCancelled(t.status));

      // Apenas REALIZADOS impactam o saldo (cancelados NUNCA entram)
      const realizedExpenses = allExpenses.filter((t) => isRealized(t.status));

      const totalIncome = realizedIncomes.reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = realizedExpenses.reduce((sum, t) => sum + t.amount, 0);

      const currentBalance = settings.initialBalance + totalIncome - totalExpense;

      // Calcular breakdown de entradas por forma de pagamento (apenas REALIZADOS)
      const incomeByPaymentMethod = {
        dinheiro: realizedIncomes
          .filter((t) => t.paymentMethodParticular === "DINHEIRO")
          .reduce((sum, t) => sum + t.amount, 0),
        pix: realizedIncomes
          .filter((t) => t.paymentMethodParticular === "PIX")
          .reduce((sum, t) => sum + t.amount, 0),
        debito: realizedIncomes
          .filter((t) => t.paymentMethodParticular === "CARTAO_DEBITO")
          .reduce((sum, t) => sum + t.amount, 0),
        creditoVista: realizedIncomes
          .filter((t) => t.paymentMethodParticular === "CREDITO_VISTA")
          .reduce((sum, t) => sum + t.amount, 0),
        creditoParcelado: realizedIncomes
          .filter((t) => t.paymentMethodParticular === "CREDITO_PARCELADO")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // Calcular breakdown de entradas por operadora (apenas REALIZADOS)
      const incomeByOperadora = {
        ipasgo: realizedIncomes
          .filter((t) => t.operadora === "IPASGO")
          .reduce((sum, t) => sum + t.amount, 0),
        unimed: realizedIncomes
          .filter((t) => t.operadora === "UNIMED")
          .reduce((sum, t) => sum + t.amount, 0),
        bradesco: realizedIncomes
          .filter((t) => t.operadora === "BRADESCO")
          .reduce((sum, t) => sum + t.amount, 0),
        geap: realizedIncomes
          .filter((t) => t.operadora === "GEAP")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // Calcular breakdown de saídas por categoria (apenas REALIZADAS)
      const expenseByCategory: Record<string, number> = {};
      realizedExpenses.forEach((t) => {
        const cat = t.category || "Sem Categoria";
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount;
      });

      return {
        initialBalance: settings.initialBalance,
        initialBalanceLastUpdate: settings.initialBalanceLastUpdate,
        totalIncome,
        totalExpense,
        currentBalance,
        transactionCount: realizedIncomes.length + realizedExpenses.length,
        incomeByStatus: {
          previsto: pendingIncomes.reduce((sum, t) => sum + t.amount, 0),
          recebido: realizedIncomes.reduce((sum, t) => sum + t.amount, 0),
          cancelado: cancelledIncomes.reduce((sum, t) => sum + t.amount, 0),
        },
        incomeCountByStatus: {
          previsto: pendingIncomes.length,
          recebido: realizedIncomes.length,
          cancelado: cancelledIncomes.length,
        },
        incomeByReceiptType: {
          particular: realizedIncomes
            .filter((t) => t.receiptType === "PARTICULAR")
            .reduce((sum, t) => sum + t.amount, 0),
          convenio: realizedIncomes
            .filter((t) => t.receiptType === "CONVENIO")
            .reduce((sum, t) => sum + t.amount, 0),
        },
        incomeByPaymentMethod,
        incomeByOperadora,
        expenseByCategory,
      };
    },
    [filterTransactions, settings.initialBalance, settings.initialBalanceLastUpdate]
  );

  // Get unit stats - SINGLE SOURCE OF TRUTH
  // REGRA: Apenas movimentações REALIZADAS impactam saldo por unidade
  const getUnitStats = useCallback(
    (startDate?: Date, endDate?: Date): UnitStats[] => {
      const filtered = filterTransactions({ startDate, endDate });
      const unitMap = new Map<string, UnitStats>();

      filtered.forEach((t) => {
        if (!t.unit) return;
        // Apenas REALIZADOS impactam saldo (cancelados excluídos)
        if (!isRealized(t.status) || isCancelled(t.status)) return;
        
        const existing = unitMap.get(t.unit) || {
          unit: t.unit,
          income: 0,
          expense: 0,
          transactionCount: 0,
          netBalance: 0,
        };

        if (t.type === "INCOME") {
          existing.income += t.amount;
        } else if (t.type === "EXPENSE") {
          existing.expense += t.amount;
        }
        existing.transactionCount++;
        existing.netBalance = existing.income - existing.expense;

        unitMap.set(t.unit, existing);
      });

      return Array.from(unitMap.values());
    },
    [filterTransactions]
  );

  // Update initial balance
  const updateInitialBalance = useCallback(
    async (newValue: number, adjustedBy: string, reason?: string) => {
      // TODO: Update in company_financial_settings table
      const adjustment: InitialBalanceAdjustment = {
        id: crypto.randomUUID(),
        previousValue: settings.initialBalance,
        newValue,
        adjustedBy,
        adjustedAt: new Date().toISOString(),
        reason,
      };
      
      toast.success("Saldo inicial atualizado");
      return adjustment;
    },
    [settings.initialBalance]
  );

  // Update settings (delegates to useCompanySettings)
  const updateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      return updateCompanySettings(updates);
    },
    [updateCompanySettings]
  );

  // Import transactions
  const importTransactions = useCallback(
    async (newTransactions: Omit<Transaction, "id" | "createdAt">[]) => {
      let count = 0;
      for (const t of newTransactions) {
        const result = await addTransaction(t);
        if (result) count++;
      }
      return count;
    },
    [addTransaction]
  );

  // Recent transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      // createdAt é timestamp ISO completo, parseLocalDate lida corretamente
      .sort((a, b) => parseLocalDate(b.createdAt).getTime() - parseLocalDate(a.createdAt).getTime())
      .slice(0, 10);
  }, [transactions]);

  return {
    transactions,
    settings,
    loading,
    addTransaction,
    updateTransaction,
    cancelTransaction,
    deleteTransaction,
    filterTransactions,
    getStats,
    getUnitStats,
    updateInitialBalance,
    updateSettings,
    importTransactions,
    recentTransactions,
    refetch,
  };
}
