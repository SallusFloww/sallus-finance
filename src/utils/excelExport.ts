import * as XLSX from "xlsx";
import { Transaction, FinancialCategory, NonOperationalSubtype } from "@/types";
import {
  UNIT_LABELS,
  FINANCIAL_CATEGORY_LABELS,
  NON_OPERATIONAL_SUBTYPE_LABELS,
  SPECIALTY_LABELS,
  OPERADORA_LABELS,
} from "@/utils/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isCancelled, isRealized } from "@/utils/statusHelpers";
import { parseLocalDate } from "@/utils/formatters";

interface ExportOptions {
  transactions: Transaction[];
  filename?: string;
  sheetName?: string;
}

/** ===========================
 * Helpers
 * =========================== */

// Get financial category label
function getFinancialCategoryLabel(category: FinancialCategory): string {
  return FINANCIAL_CATEGORY_LABELS[category] || category;
}

// Get non-operational subtype label
function getNonOperationalSubtypeLabel(subtype?: NonOperationalSubtype): string {
  if (!subtype) return "";
  return NON_OPERATIONAL_SUBTYPE_LABELS[subtype] || subtype;
}

// Get unit label
function getUnitLabel(unit: string, financialCategory: FinancialCategory): string {
  if (financialCategory === "NAO_OPERACIONAL") return "Corporativo";
  if (financialCategory === "COMPARTILHADO") return "Estrutura Compartilhada";
  return UNIT_LABELS[unit] || unit || "";
}

// Get origin/convênio label
function getOriginLabel(tx: Transaction): string {
  if (tx.receiptType === "CONVENIO" && tx.operadora) {
    return OPERADORA_LABELS[tx.operadora] || tx.operadora;
  }
  if (tx.receiptType === "PARTICULAR") return "Particular";
  if (tx.nonOperationalSubtype) return getNonOperationalSubtypeLabel(tx.nonOperationalSubtype);
  return "";
}

// Normalize category name for export (e.g., "Recebimento de Convênio" → "Convênio")
function normalizeCategoryForExport(category: string, categoryMap: Map<string, string>): string {
  const label = categoryMap.get(category) || category;

  // Standardize "Recebimento de Convênio" to "Convênio"
  if (
    label.toLowerCase().includes("recebimento de convênio") ||
    label.toLowerCase().includes("recebimento de convenio") ||
    category.toLowerCase().includes("recebimento_convenio") ||
    category.toLowerCase() === "convenios"
  ) {
    return "Convênio";
  }
  return label;
}

// Excel number formats (premium BR)
const BRL_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const DATE_FORMAT = "dd/mm/yyyy";

/**
 * Transform transaction to Excel row with separate Entrada/Saída columns
 * ✅ Status real (Realizado/Previsto/Cancelado)
 * ✅ Data como Date (parseLocalDate) para virar data real no Excel (cellDates)
 */
function transactionToRow(tx: Transaction, categories: Map<string, string>): Record<string, unknown> {
  const isIncome = tx.type === "INCOME";
  const amount = Math.abs(tx.amount);

  const statusLabel = isCancelled(tx.status) ? "Cancelado" : isRealized(tx.status) ? "Realizado" : "Previsto";

  return {
    // HOTFIX P0: usa parseLocalDate para YYYY-MM-DD (evita UTC shift)
    "Data da Movimentação": parseLocalDate(tx.date),
    Tipo: isIncome ? "Entrada" : "Saída",
    Descrição: tx.reference || tx.notes || categories.get(tx.category) || tx.category,
    "Classificação Principal": getFinancialCategoryLabel(tx.financialCategory),
    Unidade: getUnitLabel(tx.unit, tx.financialCategory),
    Categoria: normalizeCategoryForExport(tx.category, categories),
    "Subcategoria / Referência": tx.specialty ? SPECIALTY_LABELS[tx.specialty] || tx.specialty : tx.reference || "",
    "Convênio / Origem": getOriginLabel(tx),
    Status: statusLabel,
    "Entrada (R$)": isIncome ? amount : null,
    "Saída (R$)": !isIncome ? amount : null,
    Observações: tx.notes || "",
  };
}

// Apply professional styling to worksheet
function applyProfessionalStyling(ws: XLSX.WorkSheet): void {
  // Column widths (premium)
  ws["!cols"] = [
    { wch: 18 }, // Data
    { wch: 10 }, // Tipo
    { wch: 40 }, // Descrição
    { wch: 28 }, // Classificação
    { wch: 22 }, // Unidade
    { wch: 18 }, // Categoria
    { wch: 26 }, // Subcategoria/Referência
    { wch: 18 }, // Convênio/Origem
    { wch: 12 }, // Status
    { wch: 16 }, // Entrada (R$)
    { wch: 16 }, // Saída (R$)
    { wch: 34 }, // Observações
  ];

  // Freeze header row (SheetJS extension used by your project)
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Header row height
  ws["!rows"] = [{ hpt: 22 }];
}

/**
 * Apply formats to columns (BRL + date) and enable AutoFilter
 * NOTE: SheetJS doesn't support "real" Excel Table in community build,
 * but freeze+autofilter+formats already give the premium UX.
 */
function applyFormatsAndFilter(ws: XLSX.WorkSheet): void {
  const ref = ws["!ref"] || "A1";
  const range = XLSX.utils.decode_range(ref);

  // AutoFilter
  const lastColLetter = XLSX.utils.encode_col(range.e.c);
  const lastRow = range.e.r + 1;
  ws["!autofilter"] = { ref: `A1:${lastColLetter}${lastRow}` };

  // Apply formats
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    // Date column (A - c=0)
    const dateCell = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[dateCell]) ws[dateCell].z = DATE_FORMAT;

    // Entrada (J - c=9)
    const entradaCell = XLSX.utils.encode_cell({ r, c: 9 });
    if (ws[entradaCell] && ws[entradaCell].v != null) ws[entradaCell].z = BRL_FORMAT;

    // Saída (K - c=10)
    const saidaCell = XLSX.utils.encode_cell({ r, c: 10 });
    if (ws[saidaCell] && ws[saidaCell].v != null) ws[saidaCell].z = BRL_FORMAT;
  }
}

// Build category lookup (centralized)
function buildCategoryLookup(): Map<string, string> {
  const categoryNames = new Map<string, string>();
  const categoryMappings: Record<string, string> = {
    agua: "Água",
    aluguel: "Aluguel",
    energia: "Energia",
    internet: "Internet",
    manutencao: "Manutenção",
    medicamento: "Medicamento",
    salario: "Salário",
    consulta: "Consulta",
    exame: "Exame",
    convenios: "Convênios",
    quimioterapia: "Quimioterapia",
  };

  Object.entries(categoryMappings).forEach(([key, value]) => categoryNames.set(key, value));
  return categoryNames;
}

/** ===========================
 * Export 1: Movimentações (aba única)
 * =========================== */
export function exportTransactionsToExcel({
  transactions,
  filename = "movimentacoes-sallusflow",
  sheetName = "Movimentações",
}: ExportOptions): void {
  if (!transactions?.length) return;

  const categoryNames = buildCategoryLookup();

  const rows = transactions.map((tx) => transactionToRow(tx, categoryNames));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Data da Movimentação",
      "Tipo",
      "Descrição",
      "Classificação Principal",
      "Unidade",
      "Categoria",
      "Subcategoria / Referência",
      "Convênio / Origem",
      "Status",
      "Entrada (R$)",
      "Saída (R$)",
      "Observações",
    ],
    dateNF: DATE_FORMAT,
  });

  applyProfessionalStyling(ws);
  applyFormatsAndFilter(ws);

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const dateStr = format(new Date(), "yyyy-MM-dd", { locale: ptBR });
  const fullFilename = `${filename}_${dateStr}.xlsx`;

  // ✅ cellDates garante que Date vira data real no Excel (não texto)
  XLSX.writeFile(wb, fullFilename, { bookType: "xlsx", cellDates: true });
}

/** ===========================
 * Executive Reading
 * =========================== */
function generateExecutiveReading(
  totalIncome: number,
  totalExpense: number,
  operationalResult: number,
  sharedExpense: number,
  nonOperationalResult: number,
  totalIncome_nonOp: number,
): string {
  const lines: string[] = [];

  if (operationalResult > 0) {
    lines.push(
      "No período analisado, a operação assistencial apresentou resultado positivo, sustentando o caixa do grupo.",
    );
  } else if (operationalResult < 0) {
    lines.push(
      "No período analisado, a operação assistencial apresentou resultado negativo, demandando atenção gerencial.",
    );
  } else {
    lines.push("No período analisado, a operação assistencial apresentou equilíbrio entre receitas e despesas.");
  }

  const sharedRatio = totalIncome > 0 ? (sharedExpense / totalIncome) * 100 : 0;
  if (sharedRatio <= 15) lines.push("Os custos compartilhados mantiveram-se dentro do esperado.");
  else if (sharedRatio <= 30) lines.push("Os custos compartilhados representam parcela moderada do faturamento.");
  else lines.push("Os custos compartilhados demandam revisão estrutural.");

  const netResult = totalIncome - totalExpense;
  if (totalIncome_nonOp > 0 && netResult > 0) {
    const dependencyRatio = (totalIncome_nonOp / netResult) * 100;
    if (dependencyRatio > 50) lines.push("O resultado do período apresenta dependência de eventos não operacionais.");
    else lines.push("Não houve dependência relevante de eventos não operacionais.");
  } else {
    lines.push("Não houve dependência relevante de eventos não operacionais.");
  }

  return lines.join(" ");
}

/** ===========================
 * Export 2: Resumo Executivo + Movimentações
 * =========================== */
export function exportWithExecutiveSummary({
  transactions,
  filename = "resumo-executivo-sallusflow",
  periodStart,
  periodEnd,
}: ExportOptions & { periodStart?: Date; periodEnd?: Date }): void {
  if (!transactions?.length) return;

  // HOTFIX P0: usa parseLocalDate para YYYY-MM-DD (evita UTC shift)
  const dates = transactions.map((t) => parseLocalDate(t.date).getTime());
  const startDate = periodStart || new Date(Math.min(...dates));
  const endDate = periodEnd || new Date(Math.max(...dates));

  const categoryNames = buildCategoryLookup();

  // ===== CALCULATIONS - Excluir cancelados =====
  const activeTransactions = transactions.filter((tx) => !isCancelled(tx.status));
  const realizedTransactions = activeTransactions.filter((tx) => isRealized(tx.status));

  const totalIncome = realizedTransactions.filter((tx) => tx.type === "INCOME").reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = realizedTransactions
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netResult = totalIncome - totalExpense;

  const operationalIncome = realizedTransactions
    .filter((tx) => tx.type === "INCOME" && tx.financialCategory === "OPERACIONAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const operationalExpense = realizedTransactions
    .filter((tx) => tx.type === "EXPENSE" && tx.financialCategory === "OPERACIONAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const operationalResult = operationalIncome - operationalExpense;

  const sharedExpense = realizedTransactions
    .filter((tx) => tx.financialCategory === "COMPARTILHADO")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const sharedResult = -sharedExpense;

  const nonOpIncome = realizedTransactions
    .filter((tx) => tx.type === "INCOME" && tx.financialCategory === "NAO_OPERACIONAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const nonOpExpense = realizedTransactions
    .filter((tx) => tx.type === "EXPENSE" && tx.financialCategory === "NAO_OPERACIONAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const nonOperationalResult = nonOpIncome - nonOpExpense;

  const managementResult = operationalResult + sharedResult + nonOperationalResult;

  const uniqueDays = new Set(transactions.map((tx) => tx.date.split("T")[0]));
  const activeDays = uniqueDays.size;

  // Unit analysis (operacional)
  const unitResults = new Map<string, number>();
  transactions
    .filter((tx) => tx.financialCategory === "OPERACIONAL" && tx.unit)
    .forEach((tx) => {
      const current = unitResults.get(tx.unit) || 0;
      const value = tx.type === "INCOME" ? tx.amount : -tx.amount;
      unitResults.set(tx.unit, current + value);
    });

  const unitArray = Array.from(unitResults.entries()).map(([unit, result]) => ({
    unit,
    label: UNIT_LABELS[unit] || unit,
    result,
  }));

  const bestUnit = unitArray.length ? unitArray.reduce((a, b) => (a.result > b.result ? a : b)) : null;
  const worstUnit = unitArray.length ? unitArray.reduce((a, b) => (a.result < b.result ? a : b)) : null;

  const executiveReading = generateExecutiveReading(
    totalIncome,
    totalExpense,
    operationalResult,
    sharedExpense,
    nonOperationalResult,
    nonOpIncome,
  );

  // ===== BUILD EXECUTIVE SUMMARY SHEET =====
  const summaryData: (string | number | null)[][] = [];

  summaryData.push(["Relatório: Resumo Executivo – Fluxo de Caixa SallusFlow"]);
  summaryData.push([`Período analisado: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`]);
  summaryData.push([`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`]);
  summaryData.push([""]);

  summaryData.push(["VISÃO GERAL DO PERÍODO"]);
  summaryData.push(["Indicador", "Valor"]);
  summaryData.push(["Total de Entradas", totalIncome]);
  summaryData.push(["Total de Saídas", totalExpense]);
  summaryData.push(["Resultado Líquido do Período", netResult]);
  summaryData.push(["Número de Movimentações", transactions.length]);
  summaryData.push(["Número de Dias Ativos", activeDays]);
  summaryData.push([""]);

  summaryData.push(["RESULTADO POR CLASSIFICAÇÃO"]);
  summaryData.push(["Classificação", "Resultado (R$)"]);
  summaryData.push(["Operacional – Unidade", operationalResult]);
  summaryData.push(["Operacional – Compartilhado", sharedResult]);
  summaryData.push(["Não Operacional / Financeiro", nonOperationalResult]);
  summaryData.push(["Resultado Gerencial do Período", managementResult]);
  summaryData.push([""]);

  if (unitArray.length > 0) {
    summaryData.push(["DESTAQUES POR UNIDADE"]);
    if (bestUnit && bestUnit.result > 0) {
      summaryData.push([
        "Maior resultado positivo",
        `${bestUnit.label}: R$ ${bestUnit.result.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]);
    }
    if (worstUnit && worstUnit.result < 0) {
      summaryData.push([
        "Maior impacto negativo",
        `${worstUnit.label}: R$ ${worstUnit.result.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]);
    }
    summaryData.push([""]);
  }

  summaryData.push(["LEITURA EXECUTIVA"]);
  summaryData.push([executiveReading]);
  summaryData.push([""]);

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 45 }, { wch: 50 }];

  // Apply BRL format to value cells (keep the existing cell refs, but with correct BRL format)
  const currencyCells = ["B7", "B8", "B9", "B15", "B16", "B17", "B18"];
  currencyCells.forEach((cell) => {
    if (wsSummary[cell] && typeof wsSummary[cell].v === "number") {
      wsSummary[cell].z = BRL_FORMAT;
    }
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");

  // Data sheet (Movimentações)
  const rows = transactions.map((tx) => transactionToRow(tx, categoryNames));
  const wsData = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Data da Movimentação",
      "Tipo",
      "Descrição",
      "Classificação Principal",
      "Unidade",
      "Categoria",
      "Subcategoria / Referência",
      "Convênio / Origem",
      "Status",
      "Entrada (R$)",
      "Saída (R$)",
      "Observações",
    ],
    dateNF: DATE_FORMAT,
  });

  applyProfessionalStyling(wsData);
  applyFormatsAndFilter(wsData);

  XLSX.utils.book_append_sheet(wb, wsData, "Movimentações");

  const dateStr = format(new Date(), "yyyy-MM-dd", { locale: ptBR });
  const fullFilename = `${filename}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fullFilename, { bookType: "xlsx", cellDates: true });
}

// Legacy export with summary (kept for compatibility)
export function exportTransactionsWithSummary({
  transactions,
  filename = "relatorio-movimentacoes-sallusflow",
}: ExportOptions): void {
  exportWithExecutiveSummary({ transactions, filename });
}
