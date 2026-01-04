import { useMemo, useCallback } from "react";
import { Transaction } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { getStartOfMonth, getEndOfMonth } from "@/utils/formatters";

export interface DRELineItem {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
  tooltip?: string;
}

export interface DREBlock {
  title: string;
  icon: string;
  color: string;
  tooltip: string;
  items: DRELineItem[];
  total: number;
}

export interface DREData {
  // Receita Bruta Operacional
  receitaBrutaOperacional: number;
  receitaBrutaOperacionalItems: DRELineItem[];
  
  // Deduções (preparado para futuro)
  deducoesOperacionais: number;
  
  // Receita Líquida Operacional
  receitaLiquidaOperacional: number;
  
  // Custos Operacionais Diretos
  custosOperacionaisDiretos: number;
  custosOperacionaisDiretosItems: DRELineItem[];
  
  // Resultado Operacional Assistencial
  resultadoOperacionalAssistencial: number;
  
  // Custos Operacionais Compartilhados
  custosCompartilhados: number;
  custosCompartilhadosItems: DRELineItem[];
  
  // Resultado Operacional Total
  resultadoOperacionalTotal: number;
  
  // Receitas Não Operacionais
  receitasNaoOperacionais: number;
  receitasNaoOperacionaisItems: DRELineItem[];
  
  // Despesas Não Operacionais
  despesasNaoOperacionais: number;
  despesasNaoOperacionaisItems: DRELineItem[];
  
  // Resultado Não Operacional
  resultadoNaoOperacional: number;
  
  // Eventos Extraordinários
  eventosExtraordinarios: number;
  eventosExtraordinariosItems: DRELineItem[];
  
  // Resultado Gerencial do Período
  resultadoGerencial: number;
  
  // Margens
  margemOperacionalAssistencial: number;
  margemOperacionalTotal: number;
  margemGerencial: number;
  
  // Metadata
  period: { start: Date; end: Date };
  transactionCount: number;
}

export function useDRE() {
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;

  // Helper para normalizar categoria financeira (backwards compatibility)
  const getFinancialCategory = (t: Transaction): string => {
    // Se tem categoria definida, usar
    if (t.financialCategory) return t.financialCategory;
    // Transações antigas sem categoria = OPERACIONAL por padrão
    return "OPERACIONAL";
  };

  const calculateDRE = useCallback(
    (startDate?: Date, endDate?: Date, unitFilter?: string): DREData => {
      const start = startDate || getStartOfMonth(new Date());
      const end = endDate || getEndOfMonth(new Date());

      // Filtrar transações do período
      const periodTransactions = transactions.filter((t) => {
        const txDate = new Date(t.date);
        return txDate >= start && txDate <= end;
      });

      // Aplicar filtro de unidade se necessário (apenas para operacional)
      const filterByUnit = (tx: Transaction[]) => {
        if (!unitFilter || unitFilter === "all") return tx;
        return tx.filter((t) => t.unit === unitFilter);
      };

      // ===== 1. RECEITA BRUTA OPERACIONAL =====
      // Apenas ENTRADAS classificadas como OPERACIONAL (ou sem categoria = default OPERACIONAL)
      const receitasOperacionais = filterByUnit(
        periodTransactions.filter(
          (t) => t.type === "INCOME" && getFinancialCategory(t) === "OPERACIONAL"
        )
      );
      
      const receitaBrutaOperacional = receitasOperacionais.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      // Agrupar por categoria
      const receitasByCategory: Record<string, number> = {};
      receitasOperacionais.forEach((t) => {
        const cat = t.category || "Outros";
        receitasByCategory[cat] = (receitasByCategory[cat] || 0) + t.amount;
      });
      
      const receitaBrutaOperacionalItems: DRELineItem[] = Object.entries(receitasByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, indent: 1 }));

      // ===== 2. DEDUÇÕES OPERACIONAIS (preparado para futuro) =====
      const deducoesOperacionais = 0;

      // ===== 3. RECEITA LÍQUIDA OPERACIONAL =====
      const receitaLiquidaOperacional = receitaBrutaOperacional - deducoesOperacionais;

      // ===== 4. CUSTOS OPERACIONAIS DIRETOS =====
      // Apenas SAÍDAS classificadas como OPERACIONAL (ou sem categoria = default OPERACIONAL)
      const custosOperacionaisDiretos_tx = filterByUnit(
        periodTransactions.filter(
          (t) => t.type === "EXPENSE" && getFinancialCategory(t) === "OPERACIONAL"
        )
      );
      
      const custosOperacionaisDiretos = custosOperacionaisDiretos_tx.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      // Agrupar por categoria
      const custosDiretosByCategory: Record<string, number> = {};
      custosOperacionaisDiretos_tx.forEach((t) => {
        const cat = t.category || "Outros";
        custosDiretosByCategory[cat] = (custosDiretosByCategory[cat] || 0) + t.amount;
      });
      
      const custosOperacionaisDiretosItems: DRELineItem[] = Object.entries(custosDiretosByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, indent: 1 }));

      // ===== 5. RESULTADO OPERACIONAL ASSISTENCIAL =====
      const resultadoOperacionalAssistencial = receitaLiquidaOperacional - custosOperacionaisDiretos;

      // ===== 6. CUSTOS OPERACIONAIS COMPARTILHADOS =====
      // SAÍDAS classificadas como COMPARTILHADO
      const custosCompartilhados_tx = periodTransactions.filter(
        (t) => t.type === "EXPENSE" && getFinancialCategory(t) === "COMPARTILHADO"
      );
      
      const custosCompartilhados = custosCompartilhados_tx.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      // Agrupar por categoria
      const compartilhadosByCategory: Record<string, number> = {};
      custosCompartilhados_tx.forEach((t) => {
        const cat = t.category || "Outros";
        compartilhadosByCategory[cat] = (compartilhadosByCategory[cat] || 0) + t.amount;
      });
      
      const custosCompartilhadosItems: DRELineItem[] = Object.entries(compartilhadosByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, indent: 1 }));

      // ===== 7. RESULTADO OPERACIONAL TOTAL =====
      const resultadoOperacionalTotal = resultadoOperacionalAssistencial - custosCompartilhados;

      // ===== 8. RECEITAS NÃO OPERACIONAIS (exceto Eventos Extraordinários e Aporte de Sócio) =====
      // APORTE_SOCIO impacta APENAS Caixa - não entra em Receita, Margem ou Resultado
      const receitasNaoOp_tx = periodTransactions.filter(
        (t) => t.type === "INCOME" && 
               getFinancialCategory(t) === "NAO_OPERACIONAL" &&
               t.nonOperationalSubtype !== "EVENTO_EXTRAORDINARIO" &&
               t.nonOperationalSubtype !== "APORTE_SOCIO"
      );
      
      const receitasNaoOperacionais = receitasNaoOp_tx.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      // Agrupar por subtipo
      const receitasNaoOpBySubtype: Record<string, number> = {};
      receitasNaoOp_tx.forEach((t) => {
        const subtype = t.nonOperationalSubtype || t.category || "Outros";
        receitasNaoOpBySubtype[subtype] = (receitasNaoOpBySubtype[subtype] || 0) + t.amount;
      });
      
      const receitasNaoOperacionaisItems: DRELineItem[] = Object.entries(receitasNaoOpBySubtype)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, indent: 1 }));

      // ===== 9. DESPESAS NÃO OPERACIONAIS (exceto Eventos Extraordinários) =====
      const despesasNaoOp_tx = periodTransactions.filter(
        (t) => t.type === "EXPENSE" && 
               getFinancialCategory(t) === "NAO_OPERACIONAL" &&
               t.nonOperationalSubtype !== "EVENTO_EXTRAORDINARIO"
      );
      
      const despesasNaoOperacionais = despesasNaoOp_tx.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      // Agrupar por subtipo
      const despesasNaoOpBySubtype: Record<string, number> = {};
      despesasNaoOp_tx.forEach((t) => {
        const subtype = t.nonOperationalSubtype || t.category || "Outros";
        despesasNaoOpBySubtype[subtype] = (despesasNaoOpBySubtype[subtype] || 0) + t.amount;
      });
      
      const despesasNaoOperacionaisItems: DRELineItem[] = Object.entries(despesasNaoOpBySubtype)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, indent: 1 }));

      // ===== 10. RESULTADO NÃO OPERACIONAL =====
      const resultadoNaoOperacional = receitasNaoOperacionais - despesasNaoOperacionais;

      // ===== 11. EVENTOS EXTRAORDINÁRIOS =====
      // Agora são subtipos de NAO_OPERACIONAL com nonOperationalSubtype === "EVENTO_EXTRAORDINARIO"
      const extraordinarios_tx = periodTransactions.filter(
        (t) => getFinancialCategory(t) === "NAO_OPERACIONAL" && 
               t.nonOperationalSubtype === "EVENTO_EXTRAORDINARIO"
      );
      
      const extraordinariosIncome = extraordinarios_tx
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const extraordinariosExpense = extraordinarios_tx
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const eventosExtraordinarios = extraordinariosIncome - extraordinariosExpense;

      const eventosExtraordinariosItems: DRELineItem[] = extraordinarios_tx.map((t) => ({
        label: t.adjustmentReason || t.category || "Evento Extraordinário",
        value: t.type === "INCOME" ? t.amount : -t.amount,
        indent: 1,
        tooltip: t.notes,
      }));

      // ===== 12. RESULTADO GERENCIAL DO PERÍODO =====
      const resultadoGerencial = resultadoOperacionalTotal + resultadoNaoOperacional + eventosExtraordinarios;

      // ===== MARGENS =====
      const margemOperacionalAssistencial = receitaBrutaOperacional > 0
        ? (resultadoOperacionalAssistencial / receitaBrutaOperacional) * 100
        : 0;
      
      const margemOperacionalTotal = receitaBrutaOperacional > 0
        ? (resultadoOperacionalTotal / receitaBrutaOperacional) * 100
        : 0;
      
      const totalReceitas = receitaBrutaOperacional + receitasNaoOperacionais + extraordinariosIncome;
      const margemGerencial = totalReceitas > 0
        ? (resultadoGerencial / totalReceitas) * 100
        : 0;

      return {
        receitaBrutaOperacional,
        receitaBrutaOperacionalItems,
        deducoesOperacionais,
        receitaLiquidaOperacional,
        custosOperacionaisDiretos,
        custosOperacionaisDiretosItems,
        resultadoOperacionalAssistencial,
        custosCompartilhados,
        custosCompartilhadosItems,
        resultadoOperacionalTotal,
        receitasNaoOperacionais,
        receitasNaoOperacionaisItems,
        despesasNaoOperacionais,
        despesasNaoOperacionaisItems,
        resultadoNaoOperacional,
        eventosExtraordinarios,
        eventosExtraordinariosItems,
        resultadoGerencial,
        margemOperacionalAssistencial,
        margemOperacionalTotal,
        margemGerencial,
        period: { start, end },
        transactionCount: periodTransactions.length,
      };
    },
    [transactions]
  );

  // Comparativo mês a mês
  const getMonthlyComparison = useCallback(
    (months: number = 3, unitFilter?: string): DREData[] => {
      const results: DREData[] = [];
      const now = new Date();
      
      for (let i = 0; i < months; i++) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = getStartOfMonth(month);
        const end = getEndOfMonth(month);
        results.push(calculateDRE(start, end, unitFilter));
      }
      
      return results.reverse();
    },
    [calculateDRE]
  );

  // Unidades disponíveis
  const availableUnits = useMemo(() => {
    return settings.units.filter((u) => u.active);
  }, [settings.units]);

  return {
    calculateDRE,
    getMonthlyComparison,
    availableUnits,
  };
}
