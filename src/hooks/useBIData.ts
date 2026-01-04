import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useProductionDB } from "./useProductionDB";
import { useDRE } from "./useDRE";
import { useWeightedScore } from "./useWeightedScore";
import { useReceivablesDB } from "./useReceivablesDB";
import { Receivable } from "@/types";
import { 
  format, 
  parseISO,
  eachDayOfInterval,
  differenceInDays
} from "date-fns";

// ============================================
// BI DATA HOOK - READ-ONLY AGGREGATIONS
// Fonte de verdade:
// - Caixa = Movimentações REALIZADO + Recebimentos
// - Competência = Produção / Faturamento / A Receber
// ============================================

export interface BIFilters {
  startDate: Date;
  endDate: Date;
  unit?: string;
  payerType?: "PARTICULAR" | "CONVENIO" | "SUS" | "all";
  productionType?: string;
  receivableStatus?: string;
  period?: "current" | "3m" | "6m" | "12m";
}

export interface BIKPIs {
  // CAIXA (movimentações realizadas)
  saldoFinal: number;
  entradas: number;
  saidas: number;
  
  // COMPETÊNCIA (produção/faturamento)
  produzido: number;
  faturado: number;
  recebido: number; // via transações geradas
  emAberto: number;
  glosado: number;
  glossaPercentual: number;
  
  // TAXAS
  taxaRecebimento: number; // recebido / faturado
  taxaFaturamento: number; // faturado / produzido
}

export interface BIChartData {
  // Evolução do caixa
  cashEvolution: { date: string; saldo: number; entradas: number; saidas: number }[];
  
  // Entradas vs Saídas por período
  incomeVsExpense: { period: string; entradas: number; saidas: number }[];
  
  // Funil de conversão
  funnel: { stage: string; value: number; percentage: number }[];
  
  // Recebido por pagador
  receivedByPayer: { payer: string; value: number; percentage: number }[];
  
  // Top categorias de saída
  topExpenseCategories: { category: string; value: number }[];
  
  // Produção por tipo
  productionByType: { type: string; quantity: number; value: number }[];
  
  // Faturado por unidade
  billedByUnit: { unit: string; value: number }[];
  
  // Aging (recebíveis por faixa)
  aging: { range: string; value: number; count: number }[];
  
  // Glosa por pagador
  glossByPayer: { payer: string; value: number; percentage: number }[];
}

export interface BITransactionRow {
  id: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  unit: string;
  description: string;
}

export function useBIData(filters: BIFilters) {
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;
  const { receivables } = useReceivablesDB();
  const { productions, filterProductions } = useProductionDB();
  const { calculateDRE } = useDRE();
  const globalScore = useWeightedScore(transactions, settings);

  // Helper para filtrar receivables
  const filterReceivables = (opts: { startDate?: Date; endDate?: Date; unit?: string }) => {
    return receivables.filter(r => {
      const billingDate = parseISO(r.billingDate);
      if (opts.startDate && billingDate < opts.startDate) return false;
      if (opts.endDate && billingDate > opts.endDate) return false;
      if (opts.unit && opts.unit !== "all" && r.unit !== opts.unit) return false;
      return true;
    });
  };

  // ============================================
  // KPIs CALCULADOS
  // ============================================
  const kpis = useMemo((): BIKPIs => {
    const { startDate, endDate, unit } = filters;

    // === CAIXA (apenas REALIZADO) ===
    const realizedTransactions = transactions.filter(t => {
      const tDate = parseISO(t.date);
      if (tDate < startDate || tDate > endDate) return false;
      if (t.status !== "REALIZADO") return false;
      if (unit && unit !== "all" && t.unit !== unit) return false;
      return true;
    });

    const entradas = realizedTransactions
      .filter(t => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const saidas = realizedTransactions
      .filter(t => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const saldoFinal = settings.initialBalance + entradas - saidas;

    // === COMPETÊNCIA (Produção/Faturamento) ===
    const filteredProductions = filterProductions({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
    });

    const produzido = filteredProductions.reduce((sum, p) => sum + p.estimatedValue, 0);
    
    const faturado = filteredProductions
      .filter(p => p.status !== "PRODUZIDO")
      .reduce((sum, p) => sum + (p.billedValue || p.estimatedValue), 0);

    // Recebido via transações (origem = FATURAMENTO_RECEBIDO ou similar)
    const recebido = realizedTransactions
      .filter(t => 
        t.type === "INCOME" && 
        (t.origin === "FATURAMENTO_RECEBIDO" || 
         t.origin === "FATURAMENTO_GLOSA_PARCIAL" ||
         t.origin === "RECURSO_GLOSA" ||
         t.receiptType === "CONVENIO")
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // Recebíveis em aberto
    const filteredReceivables = filterReceivables({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
    });

    const emAberto = filteredReceivables
      .filter(r => r.status === "FATURADO")
      .reduce((sum, r) => sum + r.billedAmount, 0);

    const glosado = filteredReceivables
      .filter(r => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
      .reduce((sum, r) => sum + (r.glossedAmount || 0), 0);

    const glossaPercentual = faturado > 0 ? (glosado / faturado) * 100 : 0;
    const taxaRecebimento = faturado > 0 ? (recebido / faturado) * 100 : 0;
    const taxaFaturamento = produzido > 0 ? (faturado / produzido) * 100 : 0;

    return {
      saldoFinal,
      entradas,
      saidas,
      produzido,
      faturado,
      recebido,
      emAberto,
      glosado,
      glossaPercentual,
      taxaRecebimento,
      taxaFaturamento,
    };
  }, [transactions, settings, filters, filterProductions, filterReceivables]);

  // ============================================
  // DADOS PARA GRÁFICOS
  // ============================================
  const chartData = useMemo((): BIChartData => {
    const { startDate, endDate, unit } = filters;

    // === Evolução do Caixa (diário) ===
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    let runningBalance = settings.initialBalance;
    
    const cashEvolution = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayTransactions = transactions.filter(t => {
        const tDate = format(parseISO(t.date), "yyyy-MM-dd");
        if (tDate !== dayStr) return false;
        if (t.status !== "REALIZADO") return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      });

      const dayEntradas = dayTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const daySaidas = dayTransactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      runningBalance += dayEntradas - daySaidas;

      return {
        date: format(day, "dd/MM"),
        saldo: runningBalance,
        entradas: dayEntradas,
        saidas: daySaidas,
      };
    });

    // === Entradas vs Saídas (mensal) ===
    const monthsMap = new Map<string, { entradas: number; saidas: number }>();
    transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        if (tDate < startDate || tDate > endDate) return false;
        if (t.status !== "REALIZADO") return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      })
      .forEach(t => {
        const monthKey = format(parseISO(t.date), "MMM/yy");
        const existing = monthsMap.get(monthKey) || { entradas: 0, saidas: 0 };
        if (t.type === "INCOME") existing.entradas += t.amount;
        else existing.saidas += t.amount;
        monthsMap.set(monthKey, existing);
      });

    const incomeVsExpense = Array.from(monthsMap.entries()).map(([period, data]) => ({
      period,
      entradas: data.entradas,
      saidas: data.saidas,
    }));

    // === Funil de Conversão ===
    const funnel = [
      { stage: "Produzido", value: kpis.produzido, percentage: 100 },
      { stage: "Faturado", value: kpis.faturado, percentage: kpis.taxaFaturamento },
      { stage: "Recebido", value: kpis.recebido, percentage: kpis.taxaRecebimento },
      { stage: "Em Aberto", value: kpis.emAberto, percentage: kpis.produzido > 0 ? (kpis.emAberto / kpis.produzido) * 100 : 0 },
    ];

    // === Recebido por Pagador ===
    const payerMap = new Map<string, number>();
    transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        if (tDate < startDate || tDate > endDate) return false;
        if (t.status !== "REALIZADO") return false;
        if (t.type !== "INCOME") return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      })
      .forEach(t => {
        const payer = t.receiptType === "PARTICULAR" ? "Particular" : (t.operadora || "Convênio");
        payerMap.set(payer, (payerMap.get(payer) || 0) + t.amount);
      });

    const totalReceived = Array.from(payerMap.values()).reduce((sum, v) => sum + v, 0);
    const receivedByPayer = Array.from(payerMap.entries())
      .map(([payer, value]) => ({
        payer,
        value,
        percentage: totalReceived > 0 ? (value / totalReceived) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // === Top 10 Categorias de Saída ===
    const categoryMap = new Map<string, number>();
    transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        if (tDate < startDate || tDate > endDate) return false;
        if (t.status !== "REALIZADO") return false;
        if (t.type !== "EXPENSE") return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      })
      .forEach(t => {
        const category = t.category || "Outros";
        categoryMap.set(category, (categoryMap.get(category) || 0) + t.amount);
      });

    const topExpenseCategories = Array.from(categoryMap.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // === Produção por Tipo ===
    const productionTypeMap = new Map<string, { quantity: number; value: number }>();
    const filteredProductions = filterProductions({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
    });

    filteredProductions.forEach(p => {
      const existing = productionTypeMap.get(p.productionType) || { quantity: 0, value: 0 };
      existing.quantity += p.quantity;
      existing.value += p.estimatedValue;
      productionTypeMap.set(p.productionType, existing);
    });

    const productionByType = Array.from(productionTypeMap.entries())
      .map(([type, data]) => ({
        type,
        quantity: data.quantity,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);

    // === Faturado por Unidade ===
    const unitBilledMap = new Map<string, number>();
    const filteredReceivables = filterReceivables({
      startDate,
      endDate,
    });

    filteredReceivables.forEach(r => {
      const unitName = r.unit || "Sem Unidade";
      unitBilledMap.set(unitName, (unitBilledMap.get(unitName) || 0) + r.billedAmount);
    });

    const billedByUnit = Array.from(unitBilledMap.entries())
      .map(([unit, value]) => ({ unit, value }))
      .sort((a, b) => b.value - a.value);

    // === Aging (Recebíveis por Faixa) ===
    const today = new Date();
    const agingRanges = [
      { label: "0-30 dias", min: 0, max: 30 },
      { label: "31-60 dias", min: 31, max: 60 },
      { label: "61-90 dias", min: 61, max: 90 },
      { label: "90+ dias", min: 91, max: Infinity },
    ];

    const aging = agingRanges.map(range => {
      const inRange = filteredReceivables.filter(r => {
        if (r.status !== "FATURADO") return false;
        const daysOpen = differenceInDays(today, parseISO(r.billingDate));
        return daysOpen >= range.min && daysOpen <= range.max;
      });

      return {
        range: range.label,
        value: inRange.reduce((sum, r) => sum + r.billedAmount, 0),
        count: inRange.length,
      };
    });

    // === Glosa por Pagador ===
    const glossPayerMap = new Map<string, number>();
    filteredReceivables
      .filter(r => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
      .forEach(r => {
        const payer = r.source || "Outros";
        glossPayerMap.set(payer, (glossPayerMap.get(payer) || 0) + (r.glossedAmount || 0));
      });

    const totalGloss = Array.from(glossPayerMap.values()).reduce((sum, v) => sum + v, 0);
    const glossByPayer = Array.from(glossPayerMap.entries())
      .map(([payer, value]) => ({
        payer,
        value,
        percentage: totalGloss > 0 ? (value / totalGloss) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      cashEvolution,
      incomeVsExpense,
      funnel,
      receivedByPayer,
      topExpenseCategories,
      productionByType,
      billedByUnit,
      aging,
      glossByPayer,
    };
  }, [transactions, settings, filters, kpis, filterProductions, filterReceivables]);

  // ============================================
  // LISTA DE TRANSAÇÕES (READ-ONLY)
  // ============================================
  const recentTransactions = useMemo((): BITransactionRow[] => {
    const { startDate, endDate, unit } = filters;

    return transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        if (tDate < startDate || tDate > endDate) return false;
        if (t.status !== "REALIZADO") return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map(t => ({
        id: t.id,
        date: format(parseISO(t.date), "dd/MM/yyyy"),
        type: t.type,
        amount: t.amount,
        category: t.category || "Sem categoria",
        unit: t.unit || "-",
        description: t.notes || t.reference || "-",
      }));
  }, [transactions, filters]);

  // ============================================
  // DRE DATA
  // ============================================
  const dreData = useMemo(() => {
    return calculateDRE(filters.startDate, filters.endDate, filters.unit === "all" ? undefined : filters.unit);
  }, [calculateDRE, filters]);

  // ============================================
  // SCORE DATA
  // ============================================
  const scoreData = useMemo(() => {
    return globalScore;
  }, [globalScore]);

  return {
    kpis,
    chartData,
    recentTransactions,
    dreData,
    scoreData,
    settings,
  };
}
