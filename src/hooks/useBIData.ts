import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useProductionDB } from "./useProductionDB";
import { useDRE } from "./useDRE";
import { useWeightedScore } from "./useWeightedScore";
import { useReceivablesDB } from "./useReceivablesDB";
import { format, parseISO, eachDayOfInterval, differenceInDays } from "date-fns";
import { isRealized } from "@/utils/statusHelpers";

// ============================================
// BI DATA HOOK - READ-ONLY AGGREGATIONS (POWER BI MODE READY)
// Fonte de verdade:
// - Caixa = Movimentações REALIZADO + Recebimentos
// - Competência = Produção / Faturamento / A Receber
//
// ✅ Agora suporta filtros globais "Power BI-like":
// - doctorId
// - productionType
// - payer (Particular / Convênio)
// - category (aplica em gráficos de despesas)
// ============================================

export interface BIFilters {
  startDate: Date;
  endDate: Date;

  // base slicers
  unit?: string; // "all" ou nome
  period?: "current" | "3m" | "6m" | "12m";

  // legacy/compat
  payerType?: "PARTICULAR" | "CONVENIO" | "SUS" | "all";
  productionType?: string; // "CONSULTA" | "EXAME" | ...

  // ✅ novos (vindos do BIFilterContext)
  payer?: string; // "all" ou "Particular" ou nome do convênio
  category?: string; // "all" ou nome categoria
  doctorId?: string; // "all" ou doctors.id

  // opcionais (futuro)
  receivableStatus?: string;
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

  // ✅ NOVO — Ranking por Médico (produção)
  productionByDoctor: { doctorId: string; value: number; quantity: number }[];

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

function safeString(v: any) {
  return String(v ?? "").trim();
}

function getProductionDoctorId(p: any): string {
  return safeString(p?.doctorId || p?.doctor_id) || "SEM_MEDICO";
}

function getProductionType(p: any): string {
  return safeString(p?.productionType || p?.type) || "SEM_TIPO";
}

function getProductionPayerLabel(p: any): string {
  const payerType = safeString(p?.payerType || p?.payer_type);
  const convenio = safeString(p?.convenio || p?.operadora || p?.payerName);

  if (payerType === "PARTICULAR") return "Particular";
  if (convenio) return convenio;

  // fallback
  return "Convênio";
}

function getTransactionPayerLabel(t: any): string {
  return t?.receiptType === "PARTICULAR" ? "Particular" : t?.operadora || "Convênio";
}

export function useBIData(filters: BIFilters) {
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;

  const { receivables } = useReceivablesDB();
  const { filterProductions } = useProductionDB();
  const { calculateDRE } = useDRE();
  const globalScore = useWeightedScore(transactions, settings);

  // Helper para filtrar receivables
  const filterReceivables = (opts: { startDate?: Date; endDate?: Date; unit?: string; payer?: string }) => {
    return receivables.filter((r: any) => {
      const billingDate = parseISO(r.billingDate);
      if (opts.startDate && billingDate < opts.startDate) return false;
      if (opts.endDate && billingDate > opts.endDate) return false;
      if (opts.unit && opts.unit !== "all" && r.unit !== opts.unit) return false;

      // ✅ filtro pagador (quando existir)
      if (opts.payer && opts.payer !== "all") {
        const label = safeString(r.source || r.operadora || r.payer || r.convenio);
        const payerLabel = label || "Convênio";
        if (opts.payer === "Particular") {
          // receivable particular costuma vir diferente; se não tiver, ignora
          if (safeString(r.payerType || r.payer_type) !== "PARTICULAR" && payerLabel !== "Particular") return false;
        } else {
          if (payerLabel !== opts.payer) return false;
        }
      }

      return true;
    });
  };

  // ============================================
  // KPIs CALCULADOS
  // ============================================
  const kpis = useMemo((): BIKPIs => {
    const { startDate, endDate, unit, doctorId, productionType, payer } = filters;

    // === CAIXA (apenas REALIZADO) ===
    const realizedTransactions = transactions.filter((t: any) => {
      const tDate = parseISO(t.date);
      if (tDate < startDate || tDate > endDate) return false;
      if (!isRealized(t.status)) return false;
      if (unit && unit !== "all" && t.unit !== unit) return false;

      // ✅ filtro pagador (aplica apenas em RECEBIMENTOS/INCOME de convênio e particular)
      if (payer && payer !== "all" && t.type === "INCOME") {
        const label = getTransactionPayerLabel(t);
        if (label !== payer) return false;
      }

      return true;
    });

    const entradas = realizedTransactions
      .filter((t: any) => t.type === "INCOME")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    // ⚠️ categoria NÃO deve mexer no saldo geral, senão vira confusão
    const saidas = realizedTransactions
      .filter((t: any) => t.type === "EXPENSE")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const saldoFinal = settings.initialBalance + entradas - saidas;

    // === COMPETÊNCIA (Produção/Faturamento) ===
    // Base (para ranking por médico e produção por tipo)
    const baseProductions = filterProductions({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
    }).filter((p: any) => {
      // payer global (produção)
      if (payer && payer !== "all") {
        const pLabel = getProductionPayerLabel(p);
        if (pLabel !== payer) return false;
      }

      // tipo global (produção)
      if (productionType && productionType !== "all") {
        const pType = getProductionType(p);
        if (pType !== productionType) return false;
      }

      return true;
    });

    // Filtrado final (para KPIs e métricas) - inclui médico
    const filteredProductions = baseProductions.filter((p: any) => {
      if (doctorId && doctorId !== "all") {
        const pDoctorId = getProductionDoctorId(p);
        if (pDoctorId !== doctorId) return false;
      }
      return true;
    });

    const produzido = filteredProductions.reduce((sum: number, p: any) => sum + (p.estimatedValue || 0), 0);

    const faturado = filteredProductions
      .filter((p: any) => p.status !== "PRODUZIDO")
      .reduce((sum: number, p: any) => sum + (p.billedValue || p.estimatedValue || 0), 0);

    // Recebido via transações (origem = FATURAMENTO_RECEBIDO ou similar)
    const recebido = realizedTransactions
      .filter(
        (t: any) =>
          t.type === "INCOME" &&
          (t.origin === "FATURAMENTO_RECEBIDO" ||
            t.origin === "FATURAMENTO_GLOSA_PARCIAL" ||
            t.origin === "RECURSO_GLOSA" ||
            t.receiptType === "CONVENIO"),
      )
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    // Recebíveis em aberto
    const filteredReceivables = filterReceivables({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
      payer,
    });

    const emAberto = filteredReceivables
      .filter((r: any) => r.status === "FATURADO")
      .reduce((sum: number, r: any) => sum + (r.billedAmount || 0), 0);

    const glosado = filteredReceivables
      .filter((r: any) => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
      .reduce((sum: number, r: any) => sum + (r.glossedAmount || 0), 0);

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
    const { startDate, endDate, unit, payer, category, doctorId, productionType } = filters;

    // ---------- Helpers de filtro por transações ----------
    const baseTx = transactions.filter((t: any) => {
      const tDate = parseISO(t.date);
      if (tDate < startDate || tDate > endDate) return false;
      if (!isRealized(t.status)) return false;
      if (unit && unit !== "all" && t.unit !== unit) return false;
      return true;
    });

    const incomeTx = baseTx.filter((t: any) => t.type === "INCOME");
    const expenseTx = baseTx.filter((t: any) => t.type === "EXPENSE");

    // ---------- Produções (base e filtrada por médico) ----------
    const baseProductions = filterProductions({
      startDate,
      endDate,
      unit: unit && unit !== "all" ? unit : undefined,
    }).filter((p: any) => {
      if (payer && payer !== "all") {
        const pLabel = getProductionPayerLabel(p);
        if (pLabel !== payer) return false;
      }
      if (productionType && productionType !== "all") {
        const pType = getProductionType(p);
        if (pType !== productionType) return false;
      }
      return true;
    });

    const filteredProductions = baseProductions.filter((p: any) => {
      if (doctorId && doctorId !== "all") {
        const pDoctorId = getProductionDoctorId(p);
        if (pDoctorId !== doctorId) return false;
      }
      return true;
    });

    // === Evolução do Caixa (diário) ===
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    let runningBalance = settings.initialBalance;

    const cashEvolution = days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");

      const dayTransactions = baseTx.filter((t: any) => {
        const tDate = format(parseISO(t.date), "yyyy-MM-dd");
        return tDate === dayStr;
      });

      const dayEntradas = dayTransactions
        .filter((t: any) => t.type === "INCOME")
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const daySaidas = dayTransactions
        .filter((t: any) => t.type === "EXPENSE")
        .reduce((sum: number, t: any) => sum + t.amount, 0);

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
    baseTx.forEach((t: any) => {
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
      {
        stage: "Em Aberto",
        value: kpis.emAberto,
        percentage: kpis.produzido > 0 ? (kpis.emAberto / kpis.produzido) * 100 : 0,
      },
    ];

    // === Recebido por Pagador ===
    // Se já filtrou payer global, esse gráfico vira "100%" pro pagador selecionado — exatamente como Power BI
    const payerMap = new Map<string, number>();
    incomeTx.forEach((t: any) => {
      const label = getTransactionPayerLabel(t);

      // payer slicer
      if (payer && payer !== "all" && label !== payer) return;

      payerMap.set(label, (payerMap.get(label) || 0) + t.amount);
    });

    const totalReceived = Array.from(payerMap.values()).reduce((sum, v) => sum + v, 0);
    const receivedByPayer = Array.from(payerMap.entries())
      .map(([payerLabel, value]) => ({
        payer: payerLabel,
        value,
        percentage: totalReceived > 0 ? (value / totalReceived) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // === Top 10 Categorias de Saída ===
    const categoryMap = new Map<string, number>();
    expenseTx.forEach((t: any) => {
      const cat = t.category || "Outros";

      // category slicer (aplica aqui)
      if (category && category !== "all" && cat !== category) return;

      categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
    });

    const topExpenseCategories = Array.from(categoryMap.entries())
      .map(([cat, value]) => ({ category: cat, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // === Produção por Tipo ===
    const productionTypeMap = new Map<string, { quantity: number; value: number }>();
    filteredProductions.forEach((p: any) => {
      const type = getProductionType(p);
      const existing = productionTypeMap.get(type) || { quantity: 0, value: 0 };
      existing.quantity += p.quantity || 0;
      existing.value += p.estimatedValue || 0;
      productionTypeMap.set(type, existing);
    });

    const productionByType = Array.from(productionTypeMap.entries())
      .map(([type, data]) => ({
        type,
        quantity: data.quantity,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);

    // ✅ NOVO — Produção por Médico (ranking)
    // Power BI feel: ranking mostra todos (base) mesmo quando você filtra um médico,
    // e o highlight/seleção fica no gráfico (front). Aqui entregamos o "universo" base.
    const doctorMap = new Map<string, { value: number; quantity: number }>();
    baseProductions.forEach((p: any) => {
      const docId = getProductionDoctorId(p);
      const existing = doctorMap.get(docId) || { value: 0, quantity: 0 };
      existing.value += p.estimatedValue || 0;
      existing.quantity += p.quantity || 0;
      doctorMap.set(docId, existing);
    });

    const productionByDoctor = Array.from(doctorMap.entries())
      .map(([docId, d]) => ({ doctorId: docId, value: d.value, quantity: d.quantity }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    // === Faturado por Unidade ===
    const unitBilledMap = new Map<string, number>();
    const filteredReceivables = filterReceivables({
      startDate,
      endDate,
      payer,
    });

    filteredReceivables.forEach((r: any) => {
      // unit slicer só aqui porque receivables tem unidade própria
      if (unit && unit !== "all" && r.unit !== unit) return;

      const unitName = r.unit || "Sem Unidade";
      unitBilledMap.set(unitName, (unitBilledMap.get(unitName) || 0) + (r.billedAmount || 0));
    });

    const billedByUnit = Array.from(unitBilledMap.entries())
      .map(([unitName, value]) => ({ unit: unitName, value }))
      .sort((a, b) => b.value - a.value);

    // === Aging (Recebíveis por Faixa) ===
    const today = new Date();
    const agingRanges = [
      { label: "0-30 dias", min: 0, max: 30 },
      { label: "31-60 dias", min: 31, max: 60 },
      { label: "61-90 dias", min: 61, max: 90 },
      { label: "90+ dias", min: 91, max: Infinity },
    ];

    const aging = agingRanges.map((range) => {
      const inRange = filteredReceivables.filter((r: any) => {
        if (r.status !== "FATURADO") return false;
        const daysOpen = differenceInDays(today, parseISO(r.billingDate));
        return daysOpen >= range.min && daysOpen <= range.max;
      });

      return {
        range: range.label,
        value: inRange.reduce((sum: number, r: any) => sum + (r.billedAmount || 0), 0),
        count: inRange.length,
      };
    });

    // === Glosa por Pagador ===
    const glossPayerMap = new Map<string, number>();
    filteredReceivables
      .filter((r: any) => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
      .forEach((r: any) => {
        const pLabel = safeString(r.source || r.operadora || r.payer || r.convenio) || "Outros";

        // payer slicer
        if (payer && payer !== "all" && pLabel !== payer) return;

        glossPayerMap.set(pLabel, (glossPayerMap.get(pLabel) || 0) + (r.glossedAmount || 0));
      });

    const totalGloss = Array.from(glossPayerMap.values()).reduce((sum, v) => sum + v, 0);
    const glossByPayer = Array.from(glossPayerMap.entries())
      .map(([payerLabel, value]) => ({
        payer: payerLabel,
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
      productionByDoctor,
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
      .filter((t: any) => {
        const tDate = parseISO(t.date);
        if (tDate < startDate || tDate > endDate) return false;
        if (!isRealized(t.status)) return false;
        if (unit && unit !== "all" && t.unit !== unit) return false;
        return true;
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map((t: any) => ({
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
