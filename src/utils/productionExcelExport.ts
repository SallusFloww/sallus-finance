/**
 * Production Report Excel Export - Pivot-Ready Version
 * Multi-sheet XLSX with Base_Producao as the main pivot-ready sheet
 */

import * as XLSX from 'xlsx';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductionReportExportData } from '@/components/production/ProductionReportExport';
import { formatUnitDisplayName, formatSpecialtyDisplayName, formatConvenioDisplayName, displayLabel } from '@/utils/formatters';

interface ExportOptions {
  data: ProductionReportExportData;
  includeEvolution: boolean;
  includeConsolidated: boolean;
  includeUnbilled: boolean;
}

// Format number as percentage
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format unit name (using centralized utility)
function formatUnitName(unit: string): string {
  return formatUnitDisplayName(unit);
}

// Format specialty name (using centralized utility)
function formatSpecialtyName(specialty: string | null | undefined): string {
  if (!specialty || specialty.trim() === "") return "Sem especialidade";
  return formatSpecialtyDisplayName(specialty);
}

// Format convenio name (using centralized utility)
function formatConvenioName(convenio: string | null | undefined): string {
  return formatConvenioDisplayName(convenio || "PARTICULAR");
}

export function exportProductionReportToExcel({
  data,
  includeEvolution,
  includeConsolidated,
  includeUnbilled,
}: ExportOptions): void {
  const wb = XLSX.utils.book_new();
  
  // Calculate period days
  const periodDays = differenceInDays(parseISO(data.endDate), parseISO(data.startDate)) + 1;
  const now = new Date();
  
  // Get top specialty and mix
  const topSpec = data.specialtyRanking?.[0];
  const topMix = data.typeBreakdown?.[0];
  
  // ===== SHEET 1: RESUMO (Executive Summary) =====
  const summaryRows: (string | number | null)[][] = [];
  
  summaryRows.push(['RELATÓRIO GERENCIAL DE PRODUÇÃO']);
  summaryRows.push(['']);
  summaryRows.push(['METADADOS']);
  summaryRows.push(['Período', `${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")}`]);
  summaryRows.push(['Duração', `${periodDays} dias`]);
  summaryRows.push(['Unidade', data.selectedUnit === 'all' ? 'Todas' : formatUnitName(data.selectedUnit)]);
  summaryRows.push(['Convênio', data.selectedConvenio === 'all' ? 'Todos' : data.selectedConvenio]);
  summaryRows.push(['Tipo', data.selectedType === 'all' ? 'Todos' : data.selectedType]);
  summaryRows.push(['Especialidade', data.selectedSpecialty === 'all' ? 'Todas' : data.selectedSpecialty]);
  summaryRows.push(['Data de Geração', format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })]);
  summaryRows.push(['']);
  
  // KPIs (same 4 as PDF)
  summaryRows.push(['INDICADORES PRINCIPAIS']);
  summaryRows.push(['Indicador', 'Valor']);
  summaryRows.push(['Produção Total', data.totalQuantity]);
  summaryRows.push(['Unidade Destaque', data.topUnit ? `${data.topUnit.name} (${formatPercent(data.topUnit.percentage)})` : '-']);
  summaryRows.push(['Especialidade Destaque', topSpec ? `${topSpec.name} (${formatPercent(topSpec.percentage)})` : '-']);
  summaryRows.push(['Mix Principal', topMix ? `${topMix.label} (${formatPercent(topMix.percentage)})` : '-']);
  summaryRows.push(['']);
  
  // Top 5 tables
  summaryRows.push(['TOP 5 UNIDADES']);
  summaryRows.push(['Unidade', 'Quantidade', '%']);
  data.unitRanking.slice(0, 5).forEach(row => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push(['']);
  
  summaryRows.push(['TOP 5 ESPECIALIDADES']);
  summaryRows.push(['Especialidade', 'Quantidade', '%']);
  (data.specialtyRanking || []).slice(0, 5).forEach(row => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push(['']);
  
  summaryRows.push(['TOP 5 PROCEDIMENTOS']);
  summaryRows.push(['Procedimento', 'Quantidade', '%']);
  data.topProcedures.slice(0, 5).forEach(row => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push(['']);
  
  summaryRows.push(['OBSERVAÇÃO']);
  summaryRows.push(['Relatório gerencial de produção. Não representa faturamento, caixa ou contas a receber.']);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
  
  // ===== SHEET 2: BASE_PRODUCAO (Main Pivot-Ready Sheet) =====
  // This is the most important sheet - flat, no merges, proper types
  const baseData: (string | number | Date | null)[][] = [];
  
  // Header row
  baseData.push([
    'Data',
    'Unidade', 
    'Convenio',
    'Tipo',
    'Especialidade',
    'Procedimento',
    'Quantidade',
    'Percentual',
    'Valor_Est',
    'Status',
    'Idade_Dias'
  ]);
  
  // Build from consolidated table (already has the dimensions we need)
  if (data.consolidatedTable.length > 0) {
    data.consolidatedTable.forEach(row => {
      baseData.push([
        null, // Date - not available in consolidated
        formatUnitName(row.unit),
        formatConvenioName(row.convenio),
        displayLabel(row.productionType),
        formatSpecialtyName(row.specialty),
        '', // Procedimento - not in consolidated
        row.quantity,
        row.percentage / 100, // Store as decimal for Excel percentage format
        null, // Valor_Est
        'Consolidado',
        null, // Idade_Dias
      ]);
    });
  }
  
  const wsBase = XLSX.utils.aoa_to_sheet(baseData);
  
  // Column widths
  wsBase['!cols'] = [
    { wch: 12 },  // Data
    { wch: 18 },  // Unidade
    { wch: 25 },  // Convenio
    { wch: 15 },  // Tipo
    { wch: 18 },  // Especialidade
    { wch: 35 },  // Procedimento
    { wch: 12 },  // Quantidade
    { wch: 12 },  // Percentual
    { wch: 14 },  // Valor_Est
    { wch: 12 },  // Status
    { wch: 12 },  // Idade_Dias
  ];
  
  // Freeze header row
  wsBase['!freeze'] = { xSplit: 0, ySplit: 1 };
  
  // Add autofilter
  const baseLastRow = baseData.length;
  wsBase['!autofilter'] = { ref: `A1:K${baseLastRow}` };
  
  XLSX.utils.book_append_sheet(wb, wsBase, 'Base_Producao');
  
  // ===== SHEET 3: RANKINGS_UNIDADE =====
  if (data.unitRanking.length > 0) {
    const unitData: (string | number)[][] = [];
    unitData.push(['Unidade', 'Quantidade', 'Participação (%)', 'Variação vs Anterior (%)']);
    
    data.unitRanking.forEach(row => {
      unitData.push([
        row.name,
        row.quantity,
        row.percentage / 100, // decimal for percentage
        row.variation !== null ? row.variation / 100 : 'N/A' as any,
      ]);
    });
    
    const wsUnit = XLSX.utils.aoa_to_sheet(unitData);
    wsUnit['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 22 }];
    wsUnit['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsUnit['!autofilter'] = { ref: `A1:D${unitData.length}` };
    XLSX.utils.book_append_sheet(wb, wsUnit, 'Rankings_Unidade');
  }
  
  // ===== SHEET 4: RANKINGS_ESPECIALIDADE =====
  if (data.specialtyRanking && data.specialtyRanking.length > 0) {
    const specData: (string | number)[][] = [];
    specData.push(['Especialidade', 'Quantidade', 'Participação (%)']);
    
    data.specialtyRanking.forEach(row => {
      specData.push([
        row.name,
        row.quantity,
        row.percentage / 100,
      ]);
    });
    
    const wsSpec = XLSX.utils.aoa_to_sheet(specData);
    wsSpec['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }];
    wsSpec['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsSpec['!autofilter'] = { ref: `A1:C${specData.length}` };
    XLSX.utils.book_append_sheet(wb, wsSpec, 'Rankings_Especialidade');
  }
  
  // ===== SHEET 5: PROCEDIMENTOS =====
  if (data.topProcedures.length > 0) {
    const procData: (string | number)[][] = [];
    procData.push(['Procedimento', 'Código', 'Quantidade', 'Participação (%)']);
    
    data.topProcedures.forEach(row => {
      procData.push([
        row.name,
        row.code || '',
        row.quantity,
        row.percentage / 100,
      ]);
    });
    
    const wsProc = XLSX.utils.aoa_to_sheet(procData);
    wsProc['!cols'] = [{ wch: 45 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
    wsProc['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsProc['!autofilter'] = { ref: `A1:D${procData.length}` };
    XLSX.utils.book_append_sheet(wb, wsProc, 'Procedimentos');
  }
  
  // ===== SHEET 6: EVOLUCAO =====
  if (includeEvolution && data.evolutionData.length > 0) {
    const evoData: (string | number | Date)[][] = [];
    evoData.push(['Data', 'Quantidade']);
    
    data.evolutionData.forEach(row => {
      evoData.push([
        row.dateLabel,
        row.total,
      ]);
    });
    
    const wsEvo = XLSX.utils.aoa_to_sheet(evoData);
    wsEvo['!cols'] = [{ wch: 15 }, { wch: 12 }];
    wsEvo['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsEvo['!autofilter'] = { ref: `A1:B${evoData.length}` };
    XLSX.utils.book_append_sheet(wb, wsEvo, 'Evolucao');
  }
  
  // ===== SHEET 7: PENDENCIAS_OPERACIONAIS =====
  // Produção pendente de fechamento (encaminhamento administrativo)
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    const pendData: (string | number | Date)[][] = [];
    pendData.push(['Data', 'Unidade', 'Convenio', 'Tipo', 'Quantidade', 'Idade_Dias', 'Status']);
    
    data.unbilledProductions.forEach(p => {
      const prodDate = parseISO(p.productionDate);
      const ageDays = differenceInDays(now, prodDate);
      
      pendData.push([
        prodDate, // Date type
        formatUnitName(p.unit),
        formatConvenioName(p.convenio),
        displayLabel(p.productionType),
        p.quantity, // Number
        ageDays, // Number
        'Pendente',
      ]);
    });
    
    const wsPend = XLSX.utils.aoa_to_sheet(pendData);
    
    wsPend['!cols'] = [
      { wch: 12 },  // Data
      { wch: 18 },  // Unidade
      { wch: 25 },  // Convenio
      { wch: 18 },  // Tipo
      { wch: 12 },  // Quantidade
      { wch: 12 },  // Idade_Dias
      { wch: 12 },  // Status
    ];
    
    wsPend['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsPend['!autofilter'] = { ref: `A1:G${pendData.length}` };
    
    XLSX.utils.book_append_sheet(wb, wsPend, 'Pendencias_Operacionais');
  }
  
  // Generate filename with EXEC suffix
  const startStr = format(parseISO(data.startDate), 'yyyy-MM-dd');
  const endStr = format(parseISO(data.endDate), 'yyyy-MM-dd');
  const unitSuffix = data.selectedUnit === 'all' ? 'Todas' : formatUnitName(data.selectedUnit).replace(/\s+/g, '_');
  const filename = `Relatorio_Producao_EXEC_${startStr}_a_${endStr}_${unitSuffix}.xlsx`;
  
  // Write and download
  XLSX.writeFile(wb, filename);
}
