/**
 * Production Report Excel Export
 * Multi-sheet XLSX with pivot-ready structure
 */

import * as XLSX from 'xlsx';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductionReportExportData } from '@/components/production/ProductionReportExport';

interface ExportOptions {
  data: ProductionReportExportData;
  includeEvolution: boolean;
  includeConsolidated: boolean;
  includeUnbilled: boolean;
}

// Apply professional styling to worksheet
function applyProfessionalStyling(ws: XLSX.WorkSheet, columns: { wch: number }[]): void {
  ws['!cols'] = columns;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!rows'] = [{ hpt: 22 }];
}

// Format number as percentage
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format unit name
function formatUnitName(unit: string): string {
  const unitLabels: Record<string, string> = {
    oncologia: "Oncologia",
    "pronto-socorro": "Pronto Socorro",
    "centro-clinico": "Centro Clínico",
    centroclinico: "Centro Clínico",
  };
  const normalized = unit.toLowerCase().replace(/\s+/g, "-");
  return unitLabels[normalized] || unit;
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
  
  // ===== SHEET 1: RESUMO (Summary) =====
  const summaryRows: (string | number | null)[][] = [];
  
  // Header block
  summaryRows.push(['RELATÓRIO GERENCIAL DE PRODUÇÃO']);
  summaryRows.push(['Análise estratégica e operacional da produção assistencial']);
  summaryRows.push(['']);
  summaryRows.push(['METADADOS']);
  summaryRows.push(['Período', `${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")}`]);
  summaryRows.push(['Duração', `${periodDays} dias`]);
  summaryRows.push(['Unidade', data.selectedUnit === 'all' ? 'Todas' : formatUnitName(data.selectedUnit)]);
  summaryRows.push(['Convênio', data.selectedConvenio === 'all' ? 'Todos' : data.selectedConvenio]);
  summaryRows.push(['Tipo', data.selectedType === 'all' ? 'Todos' : data.selectedType]);
  summaryRows.push(['Especialidade', data.selectedSpecialty === 'all' ? 'Todas' : data.selectedSpecialty]);
  summaryRows.push(['Data de Geração', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })]);
  summaryRows.push(['']);
  
  // KPIs block
  summaryRows.push(['INDICADORES PRINCIPAIS']);
  summaryRows.push(['Indicador', 'Valor', 'Observação']);
  summaryRows.push(['Produção Total', data.totalQuantity, '']);
  summaryRows.push(['Produção Período Anterior', data.previousTotalQuantity, '']);
  summaryRows.push(['Variação Absoluta', data.variationAbsolute, '']);
  summaryRows.push(['Variação Percentual', formatPercent(data.variationPercent), data.isSmallSample ? 'Amostra pequena' : '']);
  summaryRows.push(['']);
  
  // Highlights
  summaryRows.push(['DESTAQUES']);
  if (data.topUnit) {
    summaryRows.push(['Unidade Destaque', data.topUnit.name, `${data.topUnit.quantity} (${formatPercent(data.topUnit.percentage)})`]);
  }
  if (data.topConvenio) {
    summaryRows.push(['Convênio Principal', data.topConvenio.name, `${data.topConvenio.quantity} (${formatPercent(data.topConvenio.percentage)})`]);
  }
  if (data.topProcedure) {
    summaryRows.push(['Top Procedimento', data.topProcedure.name, `${data.topProcedure.quantity} (${formatPercent(data.topProcedure.percentage)})`]);
  }
  summaryRows.push(['']);
  
  // Disclaimer
  summaryRows.push(['OBSERVAÇÃO']);
  summaryRows.push(['Relatório gerencial de produção. Não representa faturamento, caixa ou contas a receber.']);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  applyProfessionalStyling(wsSummary, [{ wch: 30 }, { wch: 40 }, { wch: 30 }]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
  
  // ===== SHEET 2: EVOLUÇÃO =====
  if (includeEvolution && data.evolutionData.length > 0) {
    const evolutionRows = data.evolutionData.map(row => ({
      'Data': row.dateLabel,
      'Quantidade': row.total,
    }));
    
    const wsEvolution = XLSX.utils.json_to_sheet(evolutionRows);
    applyProfessionalStyling(wsEvolution, [{ wch: 20 }, { wch: 15 }]);
    XLSX.utils.book_append_sheet(wb, wsEvolution, 'Evolucao');
  }
  
  // ===== SHEET 3: RANKING UNIDADE =====
  if (data.unitRanking.length > 0) {
    const unitRows = data.unitRanking.map(row => ({
      'Unidade': row.name,
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
      'Variação vs Anterior (%)': row.variation !== null ? formatPercent(row.variation) : 'N/A',
    }));
    
    const wsUnit = XLSX.utils.json_to_sheet(unitRows);
    applyProfessionalStyling(wsUnit, [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 22 }]);
    XLSX.utils.book_append_sheet(wb, wsUnit, 'Ranking_Unidade');
  }
  
  // ===== SHEET 4: RANKING ESPECIALIDADE =====
  if (data.specialtyRanking.length > 0) {
    const specRows = data.specialtyRanking.map(row => ({
      'Especialidade': row.name,
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
    }));
    
    const wsSpec = XLSX.utils.json_to_sheet(specRows);
    applyProfessionalStyling(wsSpec, [{ wch: 25 }, { wch: 15 }, { wch: 18 }]);
    XLSX.utils.book_append_sheet(wb, wsSpec, 'Ranking_Especialidade');
  }
  
  // ===== SHEET 5: MIX ASSISTENCIAL =====
  if (data.typeBreakdown.length > 0) {
    const mixRows = data.typeBreakdown.map(row => ({
      'Tipo': row.label,
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
    }));
    
    const wsMix = XLSX.utils.json_to_sheet(mixRows);
    applyProfessionalStyling(wsMix, [{ wch: 25 }, { wch: 15 }, { wch: 18 }]);
    XLSX.utils.book_append_sheet(wb, wsMix, 'Mix_Assistencial');
  }
  
  // ===== SHEET 6: CONVÊNIOS =====
  if (data.convenioRanking.length > 0) {
    const convRows = data.convenioRanking.map(row => ({
      'Convênio': row.name,
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
      'Nível de Risco': row.riskLevel === 'alto' ? 'Alto' : row.riskLevel === 'medio' ? 'Médio' : 'Baixo',
    }));
    
    const wsConv = XLSX.utils.json_to_sheet(convRows);
    applyProfessionalStyling(wsConv, [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 15 }]);
    XLSX.utils.book_append_sheet(wb, wsConv, 'Convenios');
  }
  
  // ===== SHEET 7: PROCEDIMENTOS =====
  if (data.topProcedures.length > 0) {
    const procRows = data.topProcedures.map(row => ({
      'Procedimento': row.name,
      'Código': row.code || '',
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
    }));
    
    const wsProc = XLSX.utils.json_to_sheet(procRows);
    applyProfessionalStyling(wsProc, [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 18 }]);
    XLSX.utils.book_append_sheet(wb, wsProc, 'Procedimentos');
  }
  
  // ===== SHEET 8: TABELA CONSOLIDADA =====
  if (includeConsolidated && data.consolidatedTable.length > 0) {
    const consRows = data.consolidatedTable.map(row => ({
      'Tipo': row.productionType,
      'Unidade': formatUnitName(row.unit),
      'Especialidade': formatUnitName(row.specialty),
      'Convênio': row.convenio,
      'Quantidade': row.quantity,
      'Participação (%)': formatPercent(row.percentage),
    }));
    
    // Add total row
    const totalQty = data.consolidatedTable.reduce((sum, r) => sum + r.quantity, 0);
    consRows.push({
      'Tipo': 'TOTAL',
      'Unidade': '',
      'Especialidade': '',
      'Convênio': '',
      'Quantidade': totalQty,
      'Participação (%)': '100.0%',
    });
    
    const wsCons = XLSX.utils.json_to_sheet(consRows);
    applyProfessionalStyling(wsCons, [
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsCons, 'Tabela_Consolidada');
  }
  
  // ===== SHEET 9: PENDÊNCIAS OPERACIONAIS (Unbilled) =====
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    const now = new Date();
    const unbilledRows = data.unbilledProductions.map(p => {
      const prodDate = parseISO(p.productionDate);
      const ageDays = differenceInDays(now, prodDate);
      
      return {
        'Data': format(prodDate, "dd/MM/yyyy"),
        'Unidade': formatUnitName(p.unit),
        'Convênio': p.convenio || 'PARTICULAR',
        'Tipo': p.productionType,
        'Descrição': p.description,
        'Quantidade': p.quantity,
        'Idade (dias)': ageDays,
        'Status': 'Pendente de encaminhamento',
      };
    });
    
    const wsUnbilled = XLSX.utils.json_to_sheet(unbilledRows);
    applyProfessionalStyling(wsUnbilled, [
      { wch: 12 }, { wch: 18 }, { wch: 25 }, { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 25 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsUnbilled, 'Pendencias_Operacionais');
  }
  
  // Generate filename
  const startStr = format(parseISO(data.startDate), 'yyyy-MM-dd');
  const endStr = format(parseISO(data.endDate), 'yyyy-MM-dd');
  const unitSuffix = data.selectedUnit === 'all' ? 'Todas' : formatUnitName(data.selectedUnit).replace(/\s+/g, '_');
  const filename = `Relatorio_Producao_${startStr}_a_${endStr}_${unitSuffix}.xlsx`;
  
  // Write and download
  XLSX.writeFile(wb, filename);
}
