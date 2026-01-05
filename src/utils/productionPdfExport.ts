/**
 * Production Report PDF Export
 * A4 Premium layout with professional styling
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductionReportExportData } from '@/components/production/ProductionReportExport';

interface ExportOptions {
  data: ProductionReportExportData;
  includeEvolution: boolean;
  includeConsolidated: boolean;
  includeUnbilled: boolean;
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

// Format percentage
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export async function generateProductionReportPDF({
  data,
  includeEvolution,
  includeConsolidated,
  includeUnbilled,
}: ExportOptions): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  let yPos = margin;
  const lineHeight = 6;
  
  // Calculate period days
  const periodDays = differenceInDays(parseISO(data.endDate), parseISO(data.startDate)) + 1;
  
  // Helper: Add page footer
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  };
  
  // Helper: Check for page break
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };
  
  // ===== HEADER (1st page only - Premium layout) =====
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Relatório Gerencial de Produção', margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Análise estratégica e operacional da produção assistencial', margin, yPos);
  yPos += 10;
  
  // Context line (filters)
  doc.setFontSize(9);
  doc.setTextColor(60);
  const periodText = `Período: ${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")} (${periodDays} dias)`;
  doc.text(periodText, margin, yPos);
  yPos += 5;
  
  const filtersLine = [
    data.selectedUnit !== 'all' ? `Unidade: ${formatUnitName(data.selectedUnit)}` : null,
    data.selectedConvenio !== 'all' ? `Convênio: ${data.selectedConvenio}` : null,
    data.selectedType !== 'all' ? `Tipo: ${data.selectedType}` : null,
    data.selectedSpecialty !== 'all' ? `Especialidade: ${data.selectedSpecialty}` : null,
  ].filter(Boolean).join(' | ');
  
  if (filtersLine) {
    doc.text(filtersLine, margin, yPos);
    yPos += 5;
  }
  
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, yPos);
  yPos += 6;
  
  // Disclaimer note
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'italic');
  doc.text('Relatório gerencial de produção. Não representa faturamento, caixa ou contas a receber.', margin, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 10;
  
  // Divider line
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  // ===== SECTION 1: RESUMO EXECUTIVO =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('1. Resumo Executivo', margin, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50);
  
  // Build executive summary bullets
  const bullets: string[] = [];
  bullets.push(`• Produção total no período: ${data.totalQuantity.toLocaleString('pt-BR')} itens`);
  
  if (data.variationPercent !== 0) {
    const variationText = data.variationPercent >= 0 
      ? `aumento de ${data.variationPercent.toFixed(1)}%`
      : `redução de ${Math.abs(data.variationPercent).toFixed(1)}%`;
    bullets.push(`• Variação vs período anterior: ${variationText}${data.isSmallSample ? ' (amostra pequena)' : ''}`);
  }
  
  if (data.topUnit) {
    bullets.push(`• Unidade destaque: ${data.topUnit.name} (${formatPercent(data.topUnit.percentage)} do total)`);
  }
  
  if (data.topConvenio) {
    bullets.push(`• Convênio principal: ${data.topConvenio.name} (${formatPercent(data.topConvenio.percentage)} do total)`);
  }
  
  bullets.forEach(bullet => {
    doc.text(bullet, margin, yPos);
    yPos += lineHeight;
  });
  yPos += 5;
  
  // ===== SECTION 2: KPIs PRINCIPAIS =====
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('2. Indicadores Principais', margin, yPos);
  yPos += 7;
  
  const kpiData = [
    ['Produção Total', data.totalQuantity.toLocaleString('pt-BR')],
    ['Variação vs Anterior', `${data.variationPercent >= 0 ? '+' : ''}${formatPercent(data.variationPercent)}${data.isSmallSample ? ' *' : ''}`],
    ['Unidade Destaque', data.topUnit ? `${data.topUnit.name} (${formatPercent(data.topUnit.percentage)})` : '-'],
    ['Convênio Principal', data.topConvenio ? `${data.topConvenio.name} (${formatPercent(data.topConvenio.percentage)})` : '-'],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    tableWidth: contentWidth * 0.6,
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // ===== SECTION 3: RANKINGS =====
  // 3.1 Produção por Unidade
  if (data.unitRanking.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('3. Rankings', margin, yPos);
    yPos += 7;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('3.1 Produção por Unidade', margin, yPos);
    yPos += 5;
    
    const unitData = data.unitRanking.slice(0, 10).map(row => [
      row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Unidade', 'Qtd', '%']],
      body: unitData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [70, 130, 180], textColor: 255 },
      tableWidth: contentWidth * 0.5,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }
  
  // 3.2 Mix Assistencial
  if (data.typeBreakdown.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('3.2 Mix Assistencial', margin, yPos);
    yPos += 5;
    
    const mixData = data.typeBreakdown.map(row => [
      row.label,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Qtd', '%']],
      body: mixData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [70, 130, 180], textColor: 255 },
      tableWidth: contentWidth * 0.5,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }
  
  // 3.3 Concentração por Convênio
  if (data.convenioRanking.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('3.3 Concentração por Convênio', margin, yPos);
    yPos += 5;
    
    const convData = data.convenioRanking.slice(0, 10).map(row => [
      row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
      row.riskLevel === 'alto' ? 'Alto' : row.riskLevel === 'medio' ? 'Médio' : 'Baixo',
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Convênio', 'Qtd', '%', 'Risco']],
      body: convData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [70, 130, 180], textColor: 255 },
      tableWidth: contentWidth * 0.7,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ===== SECTION 4: PROCEDIMENTOS =====
  if (data.topProcedures.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('4. Top 10 Procedimentos', margin, yPos);
    yPos += 7;
    
    const procData = data.topProcedures.map(row => [
      row.name.length > 40 ? row.name.substring(0, 37) + '...' : row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Procedimento', 'Qtd', '%']],
      body: procData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      columnStyles: { 0: { cellWidth: contentWidth * 0.6 } },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ===== SECTION 5: EVOLUÇÃO NO TEMPO (optional) =====
  if (includeEvolution && data.evolutionData.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('5. Evolução no Tempo', margin, yPos);
    yPos += 7;
    
    // Show as table (chart would require additional complexity)
    const evoData = data.evolutionData.map(row => [
      row.dateLabel,
      row.total.toLocaleString('pt-BR'),
    ]);
    
    // Limit to 30 rows for PDF
    const evoDataLimited = evoData.slice(0, 30);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Quantidade']],
      body: evoDataLimited,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      tableWidth: contentWidth * 0.4,
    });
    
    if (data.evolutionData.length > 30) {
      yPos = (doc as any).lastAutoTable.finalY + 3;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Exibindo 30 de ${data.evolutionData.length} registros. Veja o Excel para dados completos.`, margin, yPos);
    }
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ===== SECTION 6: TABELA CONSOLIDADA (optional) =====
  if (includeConsolidated && data.consolidatedTable.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('6. Tabela Consolidada', margin, yPos);
    yPos += 7;
    
    // Limit to first 30 rows
    const consData = data.consolidatedTable.slice(0, 30).map(row => [
      row.productionType,
      formatUnitName(row.unit),
      row.convenio,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Unidade', 'Convênio', 'Qtd', '%']],
      body: consData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
    });
    
    if (data.consolidatedTable.length > 30) {
      yPos = (doc as any).lastAutoTable.finalY + 3;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Exibindo 30 de ${data.consolidatedTable.length} registros. Veja o Excel para dados completos.`, margin, yPos);
    }
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ===== SECTION 7: PENDÊNCIAS OPERACIONAIS (optional) =====
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('7. Pendências Operacionais', margin, yPos);
    yPos += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text('Produção pendente de encaminhamento para faturamento', margin, yPos);
    yPos += 6;
    
    const now = new Date();
    const unbilledData = data.unbilledProductions.slice(0, 20).map(p => {
      const prodDate = parseISO(p.productionDate);
      const ageDays = differenceInDays(now, prodDate);
      return [
        format(prodDate, "dd/MM/yyyy"),
        formatUnitName(p.unit),
        p.convenio || 'PARTICULAR',
        p.quantity.toString(),
        ageDays.toString(),
      ];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Unidade', 'Convênio', 'Qtd', 'Idade (dias)']],
      body: unbilledData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 100, 50], textColor: 255 },
    });
    
    if (data.unbilledProductions.length > 20) {
      yPos = (doc as any).lastAutoTable.finalY + 3;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Exibindo 20 de ${data.unbilledProductions.length} itens. Veja o Excel para dados completos.`, margin, yPos);
    }
  }
  
  // Add page numbers
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }
  
  // Generate filename and save
  const startStr = format(parseISO(data.startDate), 'yyyy-MM-dd');
  const endStr = format(parseISO(data.endDate), 'yyyy-MM-dd');
  const unitSuffix = data.selectedUnit === 'all' ? 'Todas' : formatUnitName(data.selectedUnit).replace(/\s+/g, '_');
  const filename = `Relatorio_Producao_${startStr}_a_${endStr}_${unitSuffix}.pdf`;
  
  doc.save(filename);
}
