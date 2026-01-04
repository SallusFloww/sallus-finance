import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useProductionDB } from "@/hooks/useProductionDB";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useWeightedScore } from "@/hooks/useWeightedScore";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  parseISO,
  differenceInDays 
} from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MonthlyReportData {
  // Identificação
  competencia: string;
  competenciaFormatted: string;
  generatedAt: string;
  
  // Produção
  production: {
    totalQuantity: number;
    totalValue: number;
    billedQuantity: number;
    billedValue: number;
    receivedQuantity: number;
    receivedValue: number;
    openQuantity: number;
    openValue: number;
    billingRate: number; // % produção faturada
    receiptRate: number; // % faturamento recebido
  };
  
  // Faturamento & A Receber
  billing: {
    totalBilled: number;
    totalReceived: number;
    totalGlossed: number;
    totalInAppeal: number;
    totalOpen: number;
    glossRate: number;
    receiptRate: number;
    avgReceiptDays: number;
  };
  
  // Aging
  aging: {
    bucket0to30: number;
    bucket31to60: number;
    bucket61to90: number;
    bucketOver90: number;
    totalOpen: number;
    criticalAmount: number; // >60 dias
    criticalPercentage: number;
  };
  
  // Caixa
  cash: {
    initialBalance: number;
    totalIncome: number;
    totalExpense: number;
    netResult: number;
    currentBalance: number;
    transactionCount: number;
  };
  
  // Score
  score: {
    globalScore: number;
    globalStatus: string;
    globalLabel: string;
    isEligible: boolean;
    unitScores: {
      unitName: string;
      score: number;
      status: string;
      weight: number;
    }[];
    factors: string[];
  };
  
  // Indicadores Operacionais
  operationalKPIs: {
    productionToBillingConversion: number;
    billingToReceiptConversion: number;
    totalConversion: number; // produção → caixa
    lossAmount: number;
    lossPercentage: number;
  };
  
  // Alertas
  alerts: {
    type: "critical" | "warning" | "info";
    title: string;
    description: string;
  }[];
  
  // Próximas Ações Recomendadas
  nextActions: {
    priority: "high" | "medium" | "low";
    action: string;
    impact: string;
  }[];
  
  // Texto WhatsApp
  whatsappText: string;
}

export function useMonthlyReport(competencia?: string): MonthlyReportData {
  const { transactions } = useApp();
  const { getStats: getTransactionStats, settings } = transactions;
  const { productions, getStats: getProductionStats } = useProductionDB();
  const { receivables, getStats: getReceivablesStats } = useReceivablesDB();
  const scoreData = useWeightedScore(transactions.transactions, settings);
  
  return useMemo(() => {
    // Determinar período
    const now = new Date();
    const targetDate = competencia 
      ? parseISO(`${competencia}-01`) 
      : now;
    
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const competenciaStr = format(monthStart, "yyyy-MM");
    const competenciaFormatted = format(monthStart, "MMMM 'de' yyyy", { locale: ptBR });
    
    // ===== PRODUÇÃO =====
    const prodStats = getProductionStats(monthStart, monthEnd);
    const productionData = {
      totalQuantity: prodStats.totalQuantityProduced,
      totalValue: prodStats.totalProduced,
      billedQuantity: prodStats.totalQuantityBilled,
      billedValue: prodStats.totalBilled,
      receivedQuantity: prodStats.totalQuantityReceived,
      receivedValue: prodStats.totalReceived,
      openQuantity: prodStats.totalQuantityOpen,
      openValue: prodStats.totalOpen,
      billingRate: prodStats.billingRate,
      receiptRate: prodStats.receiptRate,
    };
    
    // ===== FATURAMENTO =====
    const recStats = getReceivablesStats(monthStart, monthEnd);
    const billingData = {
      totalBilled: recStats.totalBilled,
      totalReceived: recStats.totalReceived,
      totalGlossed: recStats.totalGlossed,
      totalInAppeal: recStats.totalInAppeal,
      totalOpen: recStats.totalOpen,
      glossRate: recStats.totalBilled > 0 ? (recStats.totalGlossed / recStats.totalBilled) * 100 : 0,
      receiptRate: recStats.totalBilled > 0 ? (recStats.totalReceived / recStats.totalBilled) * 100 : 0,
      avgReceiptDays: recStats.averageReceiptDays,
    };
    
    // ===== AGING =====
    const today = new Date();
    const openReceivables = receivables.filter(r => r.status === "FATURADO");
    
    let bucket0to30 = 0, bucket31to60 = 0, bucket61to90 = 0, bucketOver90 = 0;
    
    openReceivables.forEach(r => {
      const days = differenceInDays(today, parseISO(r.billingDate));
      if (days <= 30) bucket0to30 += r.billedAmount;
      else if (days <= 60) bucket31to60 += r.billedAmount;
      else if (days <= 90) bucket61to90 += r.billedAmount;
      else bucketOver90 += r.billedAmount;
    });
    
    const totalOpenAging = bucket0to30 + bucket31to60 + bucket61to90 + bucketOver90;
    const criticalAmount = bucket61to90 + bucketOver90;
    
    const agingData = {
      bucket0to30,
      bucket31to60,
      bucket61to90,
      bucketOver90,
      totalOpen: totalOpenAging,
      criticalAmount,
      criticalPercentage: totalOpenAging > 0 ? (criticalAmount / totalOpenAging) * 100 : 0,
    };
    
    // ===== CAIXA =====
    const txStats = getTransactionStats(monthStart, monthEnd);
    const cashData = {
      initialBalance: txStats.initialBalance,
      totalIncome: txStats.totalIncome,
      totalExpense: txStats.totalExpense,
      netResult: txStats.totalIncome - txStats.totalExpense,
      currentBalance: txStats.currentBalance,
      transactionCount: txStats.transactionCount,
    };
    
    // ===== SCORE =====
    const factors: string[] = [];
    if (scoreData.globalScore >= 85) factors.push("Score excelente mantido");
    else if (scoreData.globalScore >= 70) factors.push("Score saudável");
    else if (scoreData.globalScore >= 55) factors.push("Score requer atenção");
    else factors.push("Score crítico - ação imediata necessária");
    
    // Adicionar fatores baseados nos componentes
    scoreData.unitScores.forEach(unit => {
      if (unit.components.concentration > 15) {
        factors.push(`${unit.unitName}: Boa diversificação de receita`);
      }
      if (unit.components.regularity >= 24) {
        factors.push(`${unit.unitName}: Alta regularidade operacional`);
      }
    });
    
    const scoreDataFormatted = {
      globalScore: scoreData.globalScore,
      globalStatus: scoreData.globalStatus,
      globalLabel: scoreData.globalLabel,
      isEligible: scoreData.isEligible,
      unitScores: scoreData.unitScores.map(u => ({
        unitName: u.unitName,
        score: u.score,
        status: u.status,
        weight: u.weight * 100,
      })),
      factors: factors.slice(0, 5),
    };
    
    // ===== KPIs OPERACIONAIS =====
    const totalConversion = productionData.totalValue > 0 
      ? (billingData.totalReceived / productionData.totalValue) * 100 
      : 0;
    const lossAmount = productionData.totalValue - billingData.totalReceived;
    
    const operationalKPIs = {
      productionToBillingConversion: productionData.billingRate,
      billingToReceiptConversion: billingData.receiptRate,
      totalConversion,
      lossAmount: Math.max(0, lossAmount),
      lossPercentage: productionData.totalValue > 0 
        ? Math.max(0, (lossAmount / productionData.totalValue) * 100) 
        : 0,
    };
    
    // ===== ALERTAS =====
    const alerts: MonthlyReportData["alerts"] = [];
    
    if (agingData.criticalPercentage > 30) {
      alerts.push({
        type: "critical",
        title: "Aging crítico",
        description: `${agingData.criticalPercentage.toFixed(0)}% dos recebíveis estão vencidos há mais de 60 dias`,
      });
    }
    
    if (billingData.glossRate > 10) {
      alerts.push({
        type: "critical",
        title: "Taxa de glosa elevada",
        description: `${billingData.glossRate.toFixed(1)}% do faturamento foi glosado`,
      });
    }
    
    if (productionData.openValue > 0) {
      alerts.push({
        type: "warning",
        title: "Produção não faturada",
        description: `R$ ${productionData.openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em produção aguardando faturamento`,
      });
    }
    
    if (cashData.netResult < 0) {
      alerts.push({
        type: "critical",
        title: "Resultado negativo",
        description: `Caixa operacional negativo de R$ ${Math.abs(cashData.netResult).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    }
    
    if (scoreDataFormatted.globalScore < 55) {
      alerts.push({
        type: "warning",
        title: "Score financeiro baixo",
        description: `Score de ${scoreDataFormatted.globalScore} indica necessidade de ação`,
      });
    }
    
    // ===== PRÓXIMAS AÇÕES =====
    const nextActions: MonthlyReportData["nextActions"] = [];
    
    if (productionData.openValue > 0) {
      nextActions.push({
        priority: "high",
        action: "Faturar produções pendentes",
        impact: `Potencial de R$ ${productionData.openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    }
    
    if (agingData.bucketOver90 > 0) {
      nextActions.push({
        priority: "high",
        action: "Cobrar títulos vencidos >90 dias",
        impact: `Recuperar R$ ${agingData.bucketOver90.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    }
    
    if (billingData.totalInAppeal > 0) {
      nextActions.push({
        priority: "medium",
        action: "Acompanhar recursos de glosa",
        impact: `R$ ${billingData.totalInAppeal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em recurso`,
      });
    }
    
    if (billingData.glossRate > 5) {
      nextActions.push({
        priority: "medium",
        action: "Revisar processos para reduzir glosas",
        impact: `Reduzir taxa de ${billingData.glossRate.toFixed(1)}%`,
      });
    }
    
    if (cashData.totalExpense > cashData.totalIncome * 0.9) {
      nextActions.push({
        priority: "low",
        action: "Revisar estrutura de custos",
        impact: "Melhorar margem operacional",
      });
    }
    
    // ===== TEXTO WHATSAPP =====
    const formatMoney = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    let whatsappText = `📊 *IMEC SAÚDE - Resumo Executivo*\n`;
    whatsappText += `📅 Competência: ${competenciaFormatted.charAt(0).toUpperCase() + competenciaFormatted.slice(1)}\n\n`;
    
    whatsappText += `💰 *CAIXA*\n`;
    whatsappText += `Entradas: ${formatMoney(cashData.totalIncome)}\n`;
    whatsappText += `Saídas: ${formatMoney(cashData.totalExpense)}\n`;
    whatsappText += `Resultado: ${cashData.netResult >= 0 ? "✅" : "⚠️"} ${formatMoney(cashData.netResult)}\n`;
    whatsappText += `Saldo: ${formatMoney(cashData.currentBalance)}\n\n`;
    
    whatsappText += `📈 *FATURAMENTO*\n`;
    whatsappText += `Faturado: ${formatMoney(billingData.totalBilled)}\n`;
    whatsappText += `Recebido: ${formatMoney(billingData.totalReceived)} (${billingData.receiptRate.toFixed(0)}%)\n`;
    if (billingData.totalGlossed > 0) {
      whatsappText += `Glosado: ${formatMoney(billingData.totalGlossed)} (${billingData.glossRate.toFixed(1)}%)\n`;
    }
    whatsappText += `Em aberto: ${formatMoney(billingData.totalOpen)}\n\n`;
    
    whatsappText += `🏆 *SCORE FINANCEIRO*\n`;
    whatsappText += `Nota: ${scoreDataFormatted.globalScore}/100 (${scoreDataFormatted.globalLabel})\n\n`;
    
    if (alerts.filter(a => a.type === "critical").length > 0) {
      whatsappText += `🚨 *ALERTAS*\n`;
      alerts.filter(a => a.type === "critical").slice(0, 2).forEach(a => {
        whatsappText += `• ${a.title}\n`;
      });
      whatsappText += `\n`;
    }
    
    whatsappText += `✅ *TOP 3 AÇÕES*\n`;
    nextActions.slice(0, 3).forEach((action, i) => {
      whatsappText += `${i + 1}. ${action.action}\n`;
    });
    
    whatsappText += `\n_Gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}_`;
    
    return {
      competencia: competenciaStr,
      competenciaFormatted,
      generatedAt: new Date().toISOString(),
      production: productionData,
      billing: billingData,
      aging: agingData,
      cash: cashData,
      score: scoreDataFormatted,
      operationalKPIs,
      alerts,
      nextActions,
      whatsappText,
    };
  }, [
    competencia,
    transactions,
    productions,
    receivables,
    getTransactionStats,
    getProductionStats,
    getReceivablesStats,
    scoreData,
    settings,
  ]);
}
