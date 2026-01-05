import * as XLSX from 'xlsx';
import { Transaction, FinancialCategory, NonOperationalSubtype } from '@/types';
import { 
  UNIT_LABELS, 
  FINANCIAL_CATEGORY_LABELS, 
  NON_OPERATIONAL_SUBTYPE_LABELS,
  SPECIALTY_LABELS,
  RECEIPT_TYPE_LABELS,
  OPERADORA_LABELS
} from '@/utils/constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isCancelled, isRealized } from '@/utils/statusHelpers';
import { parseLocalDate } from '@/utils/formatters';

interface ExportOptions {
  transactions: Transaction[];
  filename?: string;
  sheetName?: string;
}

// Get financial category label
function getFinancialCategoryLabel(category: FinancialCategory): string {
  return FINANCIAL_CATEGORY_LABELS[category] || category;
}

// Get non-operational subtype label
function getNonOperationalSubtypeLabel(subtype?: NonOperationalSubtype): string {
  if (!subtype) return '';
  return NON_OPERATIONAL_SUBTYPE_LABELS[subtype] || subtype;
}

// Get unit label
function getUnitLabel(unit: string, financialCategory: FinancialCategory): string {
  if (financialCategory === 'NAO_OPERACIONAL') {
    return 'Corporativo';
  }
  if (financialCategory === 'COMPARTILHADO') {
    return 'Estrutura Compartilhada';
  }
  return UNIT_LABELS[unit] || unit || '';
}

// Get origin/convênio label
function getOriginLabel(tx: Transaction): string {
  if (tx.receiptType === 'CONVENIO' && tx.operadora) {
    return OPERADORA_LABELS[tx.operadora] || tx.operadora;
  }
  if (tx.receiptType === 'PARTICULAR') {
    return 'Particular';
  }
  if (tx.nonOperationalSubtype) {
    return getNonOperationalSubtypeLabel(tx.nonOperationalSubtype);
  }
  return '';
}

// Normalize category name for export (e.g., "Recebimento de Convênio" → "Convênio")
function normalizeCategoryForExport(category: string, categoryMap: Map<string, string>): string {
  const label = categoryMap.get(category) || category;
  // Standardize "Recebimento de Convênio" to "Convênio"
  if (label.toLowerCase().includes('recebimento de convênio') || 
      label.toLowerCase().includes('recebimento de convenio') ||
      category.toLowerCase().includes('recebimento_convenio') ||
      category.toLowerCase() === 'convenios') {
    return 'Convênio';
  }
  return label;
}

// Transform transaction to Excel row with separate Entrada/Saída columns
function transactionToRow(tx: Transaction, categories: Map<string, string>): Record<string, unknown> {
  const isIncome = tx.type === 'INCOME';
  const amount = Math.abs(tx.amount);
  
  return {
    // HOTFIX P0: usa parseLocalDate para YYYY-MM-DD (evita UTC shift)
    'Data da Movimentação': parseLocalDate(tx.date),
    'Tipo': isIncome ? 'Entrada' : 'Saída',
    'Descrição': tx.reference || tx.notes || categories.get(tx.category) || tx.category,
    'Classificação Principal': getFinancialCategoryLabel(tx.financialCategory),
    'Unidade': getUnitLabel(tx.unit, tx.financialCategory),
    'Categoria': normalizeCategoryForExport(tx.category, categories),
    'Subcategoria / Referência': tx.specialty ? (SPECIALTY_LABELS[tx.specialty] || tx.specialty) : (tx.reference || ''),
    'Convênio / Origem': getOriginLabel(tx),
    'Status': 'Realizado',
    'Entrada (R$)': isIncome ? amount : null,
    'Saída (R$)': !isIncome ? amount : null,
    'Observações': tx.notes || ''
  };
}

// Apply professional styling to worksheet
function applyProfessionalStyling(ws: XLSX.WorkSheet, rowCount: number): void {
  // Set column widths
  ws['!cols'] = [
    { wch: 18 },  // Data
    { wch: 10 },  // Tipo
    { wch: 35 },  // Descrição
    { wch: 28 },  // Classificação
    { wch: 22 },  // Unidade
    { wch: 18 },  // Categoria
    { wch: 22 },  // Subcategoria
    { wch: 18 },  // Convênio/Origem
    { wch: 12 },  // Status
    { wch: 15 },  // Entrada (R$)
    { wch: 15 },  // Saída (R$)
    { wch: 30 },  // Observações
  ];
  
  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  
  // Set row heights
  ws['!rows'] = [{ hpt: 22 }]; // Header row height
}

// Main export function
export function exportTransactionsToExcel({ 
  transactions, 
  filename = 'movimentacoes-sallusflow',
  sheetName = 'Movimentações'
}: ExportOptions): void {
  if (transactions.length === 0) {
    return;
  }
  
  // Build category lookup
  const categoryNames = new Map<string, string>();
  // Common category mappings
  const categoryMappings: Record<string, string> = {
    agua: 'Água',
    aluguel: 'Aluguel',
    energia: 'Energia',
    internet: 'Internet',
    manutencao: 'Manutenção',
    medicamento: 'Medicamento',
    salario: 'Salário',
    consulta: 'Consulta',
    exame: 'Exame',
    convenios: 'Convênios',
    quimioterapia: 'Quimioterapia',
  };
  
  Object.entries(categoryMappings).forEach(([key, value]) => {
    categoryNames.set(key, value);
  });
  
  // Transform transactions to rows
  const rows = transactions.map(tx => transactionToRow(tx, categoryNames));
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Data da Movimentação',
      'Tipo',
      'Descrição',
      'Classificação Principal',
      'Unidade',
      'Categoria',
      'Subcategoria / Referência',
      'Convênio / Origem',
      'Status',
      'Entrada (R$)',
      'Saída (R$)',
      'Observações'
    ],
    dateNF: 'dd/mm/yyyy'
  });
  
  // Apply styling
  applyProfessionalStyling(ws, rows.length + 1);
  
  // Format cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Apply number format to Entrada (J) and Saída (K) columns
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    // Entrada column (J - index 9)
    const entradaCell = XLSX.utils.encode_cell({ r: row, c: 9 });
    if (ws[entradaCell] && ws[entradaCell].v != null) {
      ws[entradaCell].z = '#,##0.00';
    }
    
    // Saída column (K - index 10)
    const saidaCell = XLSX.utils.encode_cell({ r: row, c: 10 });
    if (ws[saidaCell] && ws[saidaCell].v != null) {
      ws[saidaCell].z = '#,##0.00';
    }
    
    // Format date column (A)
    const dateCell = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (ws[dateCell]) {
      ws[dateCell].z = 'dd/mm/yyyy';
    }
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: ptBR });
  const fullFilename = `${filename}_${dateStr}.xlsx`;
  
  // Write and download
  XLSX.writeFile(wb, fullFilename);
}

// Generate executive reading text based on data
function generateExecutiveReading(
  totalIncome: number,
  totalExpense: number,
  operationalResult: number,
  sharedExpense: number,
  nonOperationalResult: number,
  totalIncome_nonOp: number
): string {
  const lines: string[] = [];
  
  // Operational analysis
  if (operationalResult > 0) {
    lines.push('No período analisado, a operação assistencial apresentou resultado positivo, sustentando o caixa do grupo.');
  } else if (operationalResult < 0) {
    lines.push('No período analisado, a operação assistencial apresentou resultado negativo, demandando atenção gerencial.');
  } else {
    lines.push('No período analisado, a operação assistencial apresentou equilíbrio entre receitas e despesas.');
  }
  
  // Shared costs analysis
  const sharedRatio = totalIncome > 0 ? (sharedExpense / totalIncome) * 100 : 0;
  if (sharedRatio <= 15) {
    lines.push('Os custos compartilhados mantiveram-se dentro do esperado.');
  } else if (sharedRatio <= 30) {
    lines.push('Os custos compartilhados representam parcela moderada do faturamento.');
  } else {
    lines.push('Os custos compartilhados demandam revisão estrutural.');
  }
  
  // Non-operational dependency
  const netResult = totalIncome - totalExpense;
  if (totalIncome_nonOp > 0 && netResult > 0) {
    const dependencyRatio = (totalIncome_nonOp / netResult) * 100;
    if (dependencyRatio > 50) {
      lines.push('O resultado do período apresenta dependência de eventos não operacionais.');
    } else {
      lines.push('Não houve dependência relevante de eventos não operacionais.');
    }
  } else {
    lines.push('Não houve dependência relevante de eventos não operacionais.');
  }
  
  return lines.join(' ');
}

// Export with Executive Summary sheet (SallusFlow standard)
export function exportWithExecutiveSummary({ 
  transactions, 
  filename = 'resumo-executivo-sallusflow',
  periodStart,
  periodEnd
}: ExportOptions & { periodStart?: Date; periodEnd?: Date }): void {
  if (transactions.length === 0) {
    return;
  }
  
  // Calculate period from transactions if not provided
  // HOTFIX P0: usa parseLocalDate para YYYY-MM-DD (evita UTC shift)
  const dates = transactions.map(t => parseLocalDate(t.date).getTime());
  const startDate = periodStart || new Date(Math.min(...dates));
  const endDate = periodEnd || new Date(Math.max(...dates));
  
  // Build category lookup
  const categoryNames = new Map<string, string>();
  const categoryMappings: Record<string, string> = {
    agua: 'Água', aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet',
    manutencao: 'Manutenção', medicamento: 'Medicamento', salario: 'Salário',
    consulta: 'Consulta', exame: 'Exame', convenios: 'Convênios', quimioterapia: 'Quimioterapia',
  };
  Object.entries(categoryMappings).forEach(([key, value]) => categoryNames.set(key, value));
  
  // ===== CALCULATIONS - Excluir cancelados =====
  const activeTransactions = transactions.filter(tx => !isCancelled(tx.status));
  const realizedTransactions = activeTransactions.filter(tx => isRealized(tx.status));
  
  const totalIncome = realizedTransactions.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = realizedTransactions.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amount, 0);
  const netResult = totalIncome - totalExpense;
  
  // By classification (usando apenas realizadas)
  const operationalIncome = realizedTransactions.filter(tx => tx.type === 'INCOME' && tx.financialCategory === 'OPERACIONAL').reduce((sum, tx) => sum + tx.amount, 0);
  const operationalExpense = realizedTransactions.filter(tx => tx.type === 'EXPENSE' && tx.financialCategory === 'OPERACIONAL').reduce((sum, tx) => sum + tx.amount, 0);
  const operationalResult = operationalIncome - operationalExpense;
  
  const sharedExpense = realizedTransactions.filter(tx => tx.financialCategory === 'COMPARTILHADO').reduce((sum, tx) => sum + tx.amount, 0);
  const sharedResult = -sharedExpense;
  
  const nonOpIncome = realizedTransactions.filter(tx => tx.type === 'INCOME' && tx.financialCategory === 'NAO_OPERACIONAL').reduce((sum, tx) => sum + tx.amount, 0);
  const nonOpExpense = realizedTransactions.filter(tx => tx.type === 'EXPENSE' && tx.financialCategory === 'NAO_OPERACIONAL').reduce((sum, tx) => sum + tx.amount, 0);
  const nonOperationalResult = nonOpIncome - nonOpExpense;
  
  const managementResult = operationalResult + sharedResult + nonOperationalResult;
  
  // Active days
  const uniqueDays = new Set(transactions.map(tx => tx.date.split('T')[0]));
  const activeDays = uniqueDays.size;
  
  // Unit analysis
  const unitResults = new Map<string, number>();
  transactions.filter(tx => tx.financialCategory === 'OPERACIONAL' && tx.unit).forEach(tx => {
    const current = unitResults.get(tx.unit) || 0;
    const value = tx.type === 'INCOME' ? tx.amount : -tx.amount;
    unitResults.set(tx.unit, current + value);
  });
  
  const unitArray = Array.from(unitResults.entries()).map(([unit, result]) => ({
    unit,
    label: UNIT_LABELS[unit] || unit,
    result
  }));
  
  const bestUnit = unitArray.length > 0 ? unitArray.reduce((a, b) => a.result > b.result ? a : b) : null;
  const worstUnit = unitArray.length > 0 ? unitArray.reduce((a, b) => a.result < b.result ? a : b) : null;
  const attentionUnit = unitArray.length > 0 ? unitArray.filter(u => u.result < 0).sort((a, b) => a.result - b.result)[0] : null;
  
  // Executive reading
  const executiveReading = generateExecutiveReading(
    totalIncome, totalExpense, operationalResult, sharedExpense, nonOperationalResult, nonOpIncome
  );
  
  // ===== BUILD EXECUTIVE SUMMARY SHEET =====
  const summaryData: (string | number | null)[][] = [];
  
  // Block 1 - Identification
  summaryData.push(['Relatório: Resumo Executivo – Fluxo de Caixa SallusFlow']);
  summaryData.push([`Período analisado: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`]);
  summaryData.push([`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`]);
  summaryData.push(['']);
  
  // Block 2 - Period Overview
  summaryData.push(['VISÃO GERAL DO PERÍODO']);
  summaryData.push(['Indicador', 'Valor']);
  summaryData.push(['Total de Entradas', totalIncome]);
  summaryData.push(['Total de Saídas', totalExpense]);
  summaryData.push(['Resultado Líquido do Período', netResult]);
  summaryData.push(['Número de Movimentações', transactions.length]);
  summaryData.push(['Número de Dias Ativos', activeDays]);
  summaryData.push(['']);
  
  // Block 3 - Results by Classification
  summaryData.push(['RESULTADO POR CLASSIFICAÇÃO']);
  summaryData.push(['Classificação', 'Resultado (R$)']);
  summaryData.push(['Operacional – Unidade', operationalResult]);
  summaryData.push(['Operacional – Compartilhado', sharedResult]);
  summaryData.push(['Não Operacional / Financeiro', nonOperationalResult]);
  summaryData.push(['Resultado Gerencial do Período', managementResult]);
  summaryData.push(['']);
  
  // Block 4 - Unit Highlights (only if units exist)
  if (unitArray.length > 0) {
    summaryData.push(['DESTAQUES POR UNIDADE']);
    if (bestUnit && bestUnit.result > 0) {
      summaryData.push(['Maior resultado positivo', `${bestUnit.label}: R$ ${bestUnit.result.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
    }
    if (worstUnit && worstUnit.result < 0) {
      summaryData.push(['Maior impacto negativo', `${worstUnit.label}: R$ ${worstUnit.result.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
    }
    if (attentionUnit && attentionUnit !== worstUnit) {
      summaryData.push(['Unidade em atenção', attentionUnit.label]);
    }
    summaryData.push(['']);
  }
  
  // Block 5 - Executive Reading
  summaryData.push(['LEITURA EXECUTIVA']);
  summaryData.push([executiveReading]);
  summaryData.push(['']);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Executive Summary sheet (first)
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Styling for summary
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 50 }];
  wsSummary['!rows'] = [
    { hpt: 20 }, { hpt: 18 }, { hpt: 18 }, { hpt: 12 },
    { hpt: 22 }, { hpt: 18 }
  ];
  
  // Apply currency format to value cells
  const currencyCells = ['B7', 'B8', 'B9', 'B15', 'B16', 'B17', 'B18'];
  currencyCells.forEach(cell => {
    if (wsSummary[cell] && typeof wsSummary[cell].v === 'number') {
      wsSummary[cell].z = 'R$ #,##0.00;[Red]-R$ #,##0.00';
    }
  });
  
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Executivo');
  
  // Transactions detail sheet (second)
  const rows = transactions.map(tx => transactionToRow(tx, categoryNames));
  const wsData = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Data da Movimentação', 'Tipo', 'Descrição', 'Classificação Principal',
      'Unidade', 'Categoria', 'Subcategoria / Referência', 'Convênio / Origem',
      'Status', 'Entrada (R$)', 'Saída (R$)', 'Observações'
    ],
    dateNF: 'dd/mm/yyyy'
  });
  
  applyProfessionalStyling(wsData, rows.length + 1);
  
  // Format cells in data sheet
  const range = XLSX.utils.decode_range(wsData['!ref'] || 'A1');
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    // Entrada column (J - index 9)
    const entradaCell = XLSX.utils.encode_cell({ r: row, c: 9 });
    if (wsData[entradaCell] && wsData[entradaCell].v != null) wsData[entradaCell].z = '#,##0.00';
    // Saída column (K - index 10)
    const saidaCell = XLSX.utils.encode_cell({ r: row, c: 10 });
    if (wsData[saidaCell] && wsData[saidaCell].v != null) wsData[saidaCell].z = '#,##0.00';
    // Date column
    const dateCell = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (wsData[dateCell]) wsData[dateCell].z = 'dd/mm/yyyy';
  }
  
  XLSX.utils.book_append_sheet(wb, wsData, 'Movimentações');
  
  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: ptBR });
  const fullFilename = `${filename}_${dateStr}.xlsx`;
  
  // Write and download
  XLSX.writeFile(wb, fullFilename);
}

// Legacy export with summary (kept for compatibility)
export function exportTransactionsWithSummary({ 
  transactions, 
  filename = 'relatorio-movimentacoes-sallusflow'
}: ExportOptions): void {
  exportWithExecutiveSummary({ transactions, filename });
}