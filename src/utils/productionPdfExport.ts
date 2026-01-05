/**
 * Production Report PDF Export - Executive Version (1-2 pages)
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
  const lineHeight = 5;
  
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
  
  // ===== HEADER (compact, premium) =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Relatório Gerencial de Produção', margin, yPos);
  yPos += 6;
  
  // Context line (period + filters - single line)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  const periodText = `${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")} (${periodDays} dias)`;
  
  const filtersLine = [
    data.selectedUnit !== 'all' ? formatUnitName(data.selectedUnit) : null,
    data.selectedConvenio !== 'all' ? data.selectedConvenio : null,
    data.selectedType !== 'all' ? data.selectedType : null,
    data.selectedSpecialty !== 'all' ? data.selectedSpecialty : null,
  ].filter(Boolean).join(' • ');
  
  const contextLine = filtersLine ? `${periodText} | ${filtersLine}` : periodText;
  doc.text(contextLine, margin, yPos);
  yPos += 4;
  
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, yPos);
  yPos += 4;
  
  // Disclaimer note
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'italic');
  doc.text('Relatório de Produção. Não representa faturamento, caixa ou contas a receber.', margin, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 6;
  
  // Divider line
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;
  
  // ===== SECTION 1: RESUMO EXECUTIVO (max 4 bullets) =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Resumo Executivo', margin, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50);
  
  // Build 4 concise bullets
  const bullets: string[] = [];
  bullets.push(`• Produção total: ${data.totalQuantity.toLocaleString('pt-BR')}`);
  
  if (data.variationPercent !== 0) {
    const variationText = data.variationPercent >= 0 
      ? `+${data.variationPercent.toFixed(1)}%`
      : `${data.variationPercent.toFixed(1)}%`;
    bullets.push(`• Variação vs anterior: ${variationText}${data.isSmallSample ? ' (amostra pequena)' : ''}`);
  }
  
  // Driver principal
  const topSpec = data.specialtyRanking?.[0];
  if (data.topUnit || topSpec) {
    const driverParts = [];
    if (data.topUnit) driverParts.push(`Unidade ${data.topUnit.name}`);
    if (topSpec) driverParts.push(`Especialidade ${topSpec.name}`);
    bullets.push(`• Driver principal: ${driverParts.join(' / ')}`);
  }
  
  // Pendências operacionais
  const unbilledCount = data.unbilledProductions.length;
  if (unbilledCount > 0) {
    const now = new Date();
    const criticalCount = data.unbilledProductions.filter(p => {
      const ageDays = differenceInDays(now, parseISO(p.productionDate));
      return ageDays > 30;
    }).length;
    bullets.push(`• Pendências operacionais: ${unbilledCount} (críticos: ${criticalCount})`);
  }
  
  bullets.slice(0, 4).forEach(bullet => {
    doc.text(bullet, margin, yPos);
    yPos += lineHeight;
  });
  yPos += 4;
  
  // ===== SECTION 2: KPIs PRINCIPAIS (4 only) =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Indicadores Principais', margin, yPos);
  yPos += 5;
  
  // Get top specialty and top mix
  const topMix = data.typeBreakdown[0];
  
  const kpiData = [
    ['Produção Total', data.totalQuantity.toLocaleString('pt-BR')],
    ['Unidade Destaque', data.topUnit ? `${data.topUnit.name} (${formatPercent(data.topUnit.percentage)})` : '-'],
    ['Especialidade Destaque', topSpec ? `${topSpec.name} (${formatPercent(topSpec.percentage)})` : (data.topConvenio ? `Convênio: ${data.topConvenio.name}` : '-')],
    ['Mix Principal', topMix ? `${topMix.label} (${formatPercent(topMix.percentage)})` : '-'],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [70, 70, 70], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    tableWidth: contentWidth * 0.55,
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 6;
  
  // ===== SECTION 3: TOP 5 LISTS (compact, side by side approach) =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Top 5 Rankings', margin, yPos);
  yPos += 5;
  
  // Top 5 Unidades
  if (data.unitRanking.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Unidades', margin, yPos);
    yPos += 4;
    
    const unitData = data.unitRanking.slice(0, 5).map(row => [
      row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Unidade', 'Qtd', '%']],
      body: unitData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 140, 180], textColor: 255 },
      tableWidth: contentWidth * 0.45,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }
  
  // Top 5 Especialidades
  if (data.specialtyRanking && data.specialtyRanking.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Especialidades', margin, yPos);
    yPos += 4;
    
    const specData = data.specialtyRanking.slice(0, 5).map(row => [
      row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Especialidade', 'Qtd', '%']],
      body: specData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 140, 180], textColor: 255 },
      tableWidth: contentWidth * 0.45,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }
  
  // Top 5 Procedimentos
  if (data.topProcedures.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Procedimentos', margin, yPos);
    yPos += 4;
    
    const procData = data.topProcedures.slice(0, 5).map(row => [
      row.name.length > 35 ? row.name.substring(0, 32) + '...' : row.name,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Procedimento', 'Qtd', '%']],
      body: procData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 140, 180], textColor: 255 },
      columnStyles: { 0: { cellWidth: contentWidth * 0.45 } },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }
  
  // ===== SECTION 4: PENDÊNCIAS OPERACIONAIS (compact KPIs) =====
  if (unbilledCount > 0) {
    checkPageBreak(35);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Pendências Operacionais', margin, yPos);
    yPos += 4;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text('Produção pendente de fechamento (encaminhamento administrativo)', margin, yPos);
    yPos += 5;
    
    // Calculate KPIs
    const now = new Date();
    const ages = data.unbilledProductions.map(p => differenceInDays(now, parseISO(p.productionDate)));
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const criticalCount = ages.filter(age => age > 30).length;
    
    const pendKpiData = [
      ['Qtd Pendente', unbilledCount.toString()],
      ['Idade Média', `${avgAge} dias`],
      ['Críticos (>30 dias)', criticalCount.toString()],
    ];
    
    autoTable(doc, {
      startY: yPos,
      body: pendKpiData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [255, 248, 240] },
      tableWidth: contentWidth * 0.4,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }
  
  // ===== PAGE 2 CONTENT (only if options selected) =====
  
  // EVOLUÇÃO NO TEMPO (optional - page 2)
  if (includeEvolution && data.evolutionData.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Evolução no Tempo', margin, yPos);
    yPos += 5;
    
    // Filter only days with production > 0
    const evoWithProduction = data.evolutionData.filter(row => row.total > 0);
    const daysWithProduction = evoWithProduction.length;
    const daysWithoutProduction = data.evolutionData.length - daysWithProduction;
    
    // Find peak day
    const peakDay = evoWithProduction.reduce((max, row) => 
      row.total > max.total ? row : max, 
      { dateLabel: '-', total: 0 }
    );
    
    // Summary line
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    const summaryText = `Dias com produção: ${daysWithProduction} | Dias sem produção: ${daysWithoutProduction} | Pico: ${peakDay.dateLabel} (${peakDay.total.toLocaleString('pt-BR')})`;
    doc.text(summaryText, margin, yPos);
    yPos += 5;
    
    // Show only days with production (limit to 20 for PDF)
    const evoData = evoWithProduction.slice(0, 20).map(row => [
      row.dateLabel,
      row.total.toLocaleString('pt-BR'),
    ]);
    
    if (evoData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Quantidade']],
        body: evoData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        tableWidth: contentWidth * 0.35,
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 6;
    }
  }
  
  // TABELA CONSOLIDADA (optional - page 2, max 20 rows)
  if (includeConsolidated && data.consolidatedTable.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Tabela Consolidada', margin, yPos);
    yPos += 5;
    
    // Limit to 20 rows
    const consData = data.consolidatedTable.slice(0, 20).map(row => [
      row.productionType,
      formatUnitName(row.unit),
      row.convenio.length > 20 ? row.convenio.substring(0, 17) + '...' : row.convenio,
      row.quantity.toLocaleString('pt-BR'),
      formatPercent(row.percentage),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Unidade', 'Convênio', 'Qtd', '%']],
      body: consData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
    });
    
    if (data.consolidatedTable.length > 20) {
      yPos = (doc as any).lastAutoTable.finalY + 2;
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('Detalhe completo disponível no Excel.', margin, yPos);
    }
    
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }
  
  // PENDÊNCIAS DETALHADAS (optional - page 2)
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Pendências — Detalhe', margin, yPos);
    yPos += 5;
    
    const now = new Date();
    // Top 5 by age
    const sortedByAge = [...data.unbilledProductions]
      .map(p => ({
        ...p,
        ageDays: differenceInDays(now, parseISO(p.productionDate))
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 5);
    
    const unbilledData = sortedByAge.map(p => [
      format(parseISO(p.productionDate), "dd/MM/yyyy"),
      formatUnitName(p.unit),
      p.convenio || 'PARTICULAR',
      p.ageDays.toString(),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Unidade', 'Convênio', 'Idade (dias)']],
      body: unbilledData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [180, 100, 50], textColor: 255 },
      tableWidth: contentWidth * 0.6,
    });
    
    if (data.unbilledProductions.length > 5) {
      yPos = (doc as any).lastAutoTable.finalY + 2;
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('Detalhe completo disponível no Excel.', margin, yPos);
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
  const filename = `Relatorio_Producao_EXEC_${startStr}_a_${endStr}_${unitSuffix}.pdf`;
  
  doc.save(filename);
}
