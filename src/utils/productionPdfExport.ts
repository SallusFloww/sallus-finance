/**
 * Production Report PDF Export - Executive Version (1-2 pages)
 * A4 Premium layout with professional styling
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProductionReportExportData } from "@/components/production/ProductionReportExport";
import {
  formatUnitDisplayName,
  formatSpecialtyDisplayName,
  formatConvenioDisplayName,
  displayLabel,
  formatCurrency,
} from "@/utils/formatters";

// Logo (PNG base64) for header
const SALLUS_LOGO_PNG =
  "data:image/png;base64,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";

interface ExportOptions {
  data: ProductionReportExportData;
  includeEvolution: boolean;
  includeConsolidated: boolean;
  includeUnbilled: boolean;
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
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin;
  const lineHeight = 5;

  // Calculate period days
  const periodDays = differenceInDays(parseISO(data.endDate), parseISO(data.startDate)) + 1;
  // Reference date for 'idade' calculations (use end of the selected period)
  const refDate = parseISO(data.endDate);

  // Helper: Add page footer
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
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
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  // Header logo (top-right)
  try {
    const logoW = 28;
    const logoH = 10;
    doc.addImage(SALLUS_LOGO_PNG, "PNG", pageWidth - margin - logoW, margin - 2, logoW, logoH);
  } catch {
    // ignore logo rendering errors
  }

  doc.text("Relatório Gerencial de Produção", margin, yPos);
  yPos += 6;

  // Context line (period + filters - single line)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const periodText = `${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")} (${periodDays} dias)`;

  const filtersLine = [
    data.selectedUnit !== "all" ? formatUnitName(data.selectedUnit) : null,
    data.selectedConvenio !== "all" ? formatConvenioName(data.selectedConvenio) : null,
    data.selectedType !== "all" ? displayLabel(data.selectedType) : null,
    data.selectedSpecialty !== "all" && data.selectedSpecialty !== "__SEM_ESPECIALIDADE__"
      ? formatSpecialtyName(data.selectedSpecialty)
      : data.selectedSpecialty === "__SEM_ESPECIALIDADE__"
        ? "Sem especialidade"
        : null,
  ]
    .filter(Boolean)
    .join(" • ");

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
  doc.setFont("helvetica", "italic");
  doc.text("Relatório de Produção. Não representa faturamento, caixa ou contas a receber.", margin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 6;

  // Divider line
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ===== SECTION 1: RESUMO EXECUTIVO (max 4 bullets) =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Resumo Executivo", margin, yPos);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  // Build 4 concise bullets
  const bullets: string[] = [];
  bullets.push(`• Produção total: ${data.totalQuantity.toLocaleString("pt-BR")}`);

  if (data.variationPercent !== 0) {
    const variationText =
      data.variationPercent >= 0 ? `+${data.variationPercent.toFixed(1)}%` : `${data.variationPercent.toFixed(1)}%`;
    bullets.push(`• Variação vs anterior: ${variationText}${data.isSmallSample ? " (amostra pequena)" : ""}`);
  }

  // Driver principal (com leitura executiva)
  const topSpec = data.specialtyRanking?.[0];
  if (data.topUnit || topSpec) {
    const driverParts: string[] = [];
    if (data.topUnit) driverParts.push(`Unidade ${data.topUnit.name}`);
    if (topSpec) driverParts.push(`Especialidade ${topSpec.name}`);

    // Nota de concentração: ajuda diretoria a entender dependência operacional
    const topP = Math.max(data.topUnit?.percentage ?? 0, topSpec?.percentage ?? 0);
    const concentrationNote = topP >= 35 ? " (alta concentração)" : topP >= 25 ? " (concentração moderada)" : "";

    bullets.push(`• Driver principal: ${driverParts.join(" / ")}${concentrationNote}`);
  }

  // Pendências operacionais
  const unbilledCount = data.unbilledProductions.length;
  if (unbilledCount > 0) {
    const criticalCount = data.unbilledProductions.filter((p) => {
      const ageDays = Math.max(0, differenceInDays(refDate, parseISO(p.productionDate)));
      return ageDays > 30;
    }).length;
    const riskNote = criticalCount > 0 ? " — atenção (risco operacional)" : "";
    bullets.push(`• Pendências operacionais: ${unbilledCount} (críticos: ${criticalCount})${riskNote}`);
  }

  bullets.slice(0, 4).forEach((bullet) => {
    doc.text(bullet, margin, yPos);
    yPos += lineHeight;
  });
  yPos += 4;

  // ===== SECTION 2: KPIs PRINCIPAIS (4 only) =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Indicadores Principais", margin, yPos);
  yPos += 5;

  // Get top specialty and top mix
  const topMix = data.typeBreakdown[0];

  const kpiData = [
    ["Produção Total", data.totalQuantity.toLocaleString("pt-BR")],
    ["Unidade Destaque", data.topUnit ? `${data.topUnit.name} (${formatPercent(data.topUnit.percentage)})` : "-"],
    [
      "Especialidade Destaque",
      (() => {
        if (!topSpec) return "Distribuição homogênea";
        // Regra executiva: só destaca quando houver concentração real
        if ((topSpec.percentage ?? 0) < 25) return "Distribuição homogênea";
        return `${topSpec.name} (${formatPercent(topSpec.percentage)})`;
      })(),
    ],
    ["Mix Principal", topMix ? `${topMix.label} (${formatPercent(topMix.percentage)})` : "-"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Indicador", "Valor"]],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [70, 70, 70], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    tableWidth: contentWidth * 0.55,
  });

  yPos = (doc as any).lastAutoTable.finalY + 6;

  // ===== SECTION 3: TOP 5 LISTS (compact, side by side approach) =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Top 5 Rankings", margin, yPos);
  yPos += 5;

  // Top 5 Unidades
  if (data.unitRanking.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Unidades", margin, yPos);
    yPos += 4;

    const unitData = data.unitRanking
      .slice(0, 5)
      .map((row) => [row.name, row.quantity.toLocaleString("pt-BR"), formatPercent(row.percentage)]);

    autoTable(doc, {
      startY: yPos,
      head: [["Unidade", "Qtd", "%"]],
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
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Especialidades", margin, yPos);
    yPos += 4;

    const specData = data.specialtyRanking
      .slice(0, 5)
      .map((row) => [row.name, row.quantity.toLocaleString("pt-BR"), formatPercent(row.percentage)]);

    autoTable(doc, {
      startY: yPos,
      head: [["Especialidade", "Qtd", "%"]],
      body: specData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 140, 180], textColor: 255 },
      tableWidth: contentWidth * 0.45,
    });

    yPos = (doc as any).lastAutoTable.finalY + 4;
  }

  // Top 5 Médicos
  if (data.doctorRanking && data.doctorRanking.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Médicos", margin, yPos);
    yPos += 4;

    const docData = data.doctorRanking
      .slice(0, 5)
      .map((row) => [
        row.name.length > 35 ? row.name.substring(0, 32) + "..." : row.name,
        row.quantity.toLocaleString("pt-BR"),
        formatCurrency(row.value),
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Médico", "Qtd", "Valor"]],
      body: docData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 140, 180], textColor: 255 },
      columnStyles: { 0: { cellWidth: contentWidth * 0.45 } },
    });

    yPos = (doc as any).lastAutoTable.finalY + 4;
  }

  // Top 5 Procedimentos
  if (data.topProcedures.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Procedimentos", margin, yPos);
    yPos += 4;

    const procData = data.topProcedures
      .slice(0, 5)
      .map((row) => [
        row.name.length > 35 ? row.name.substring(0, 32) + "..." : row.name,
        row.quantity.toLocaleString("pt-BR"),
        formatPercent(row.percentage),
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Procedimento", "Qtd", "%"]],
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
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Pendências Operacionais", margin, yPos);
    yPos += 4;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text("Produção pendente de fechamento (encaminhamento administrativo)", margin, yPos);
    yPos += 5;

    // Calculate KPIs (idade sempre >= 0)
    const ages = data.unbilledProductions.map((p) =>
      Math.max(0, differenceInDays(refDate, parseISO(p.productionDate))),
    );
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const criticalCount = ages.filter((age) => age > 30).length;

    const pendKpiData = [
      ["Qtd Pendente", unbilledCount.toString()],
      ["Idade Média", `${avgAge} dias`],
      ["Críticos (>30 dias)", criticalCount.toString()],
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
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Evolução no Tempo", margin, yPos);
    yPos += 5;

    // Filter only days with production > 0
    const evoWithProduction = data.evolutionData.filter((row) => row.total > 0);
    const daysWithProduction = evoWithProduction.length;
    const daysWithoutProduction = data.evolutionData.length - daysWithProduction;

    // Find peak day
    const peakDay = evoWithProduction.reduce((max, row) => (row.total > max.total ? row : max), {
      dateLabel: "-",
      total: 0,
    });

    // Summary line
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    const summaryText = `Dias com produção: ${daysWithProduction} | Dias sem produção: ${daysWithoutProduction} | Pico: ${peakDay.dateLabel} (${peakDay.total.toLocaleString("pt-BR")})`;
    doc.text(summaryText, margin, yPos);
    yPos += 5;

    // Show only days with production (limit to 20 for PDF)
    const evoData = evoWithProduction.slice(0, 20).map((row) => [row.dateLabel, row.total.toLocaleString("pt-BR")]);

    if (evoData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [["Data", "Quantidade"]],
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
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Tabela Consolidada", margin, yPos);
    yPos += 5;

    // Limit to 20 rows
    // Recalcular % com base no TOTAL do período (evita inconsistência de base)
    const safeTotal = Math.max(
      1,
      data.totalQuantity || data.consolidatedTable.reduce((sum, r) => sum + (r.quantity || 0), 0),
    );

    const consData = data.consolidatedTable.slice(0, 20).map((row) => {
      const convName = formatConvenioName(row.convenio);
      const pct = (Number(row.quantity || 0) / safeTotal) * 100;
      return [
        displayLabel(row.productionType),
        formatUnitName(row.unit),
        convName.length > 20 ? convName.substring(0, 17) + "..." : convName,
        row.quantity.toLocaleString("pt-BR"),
        formatPercent(pct),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["Tipo", "Unidade", "Convênio", "Qtd", "%"]],
      body: consData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
    });

    if (data.consolidatedTable.length > 20) {
      yPos = (doc as any).lastAutoTable.finalY + 2;
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text("Detalhe completo disponível no Excel.", margin, yPos);
    }

    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // PENDÊNCIAS DETALHADAS (optional - page 2)
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Pendências — Detalhe", margin, yPos);
    yPos += 5;

    // Nota de escopo (Top 5)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    const unbilledTotal = data.unbilledProductions.length;
    doc.text(
      unbilledTotal > 5
        ? `Exibindo Top 5 pendências mais antigas (de ${unbilledTotal})`
        : `Exibindo todas as pendências (${unbilledTotal})`,
      margin,
      yPos,
    );
    yPos += 4;

    // Top 5 by age (idade sempre >= 0)
    const sortedByAge = [...data.unbilledProductions]
      .map((p) => ({
        ...p,
        ageDays: Math.max(0, differenceInDays(refDate, parseISO(p.productionDate))),
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 5);

    const unbilledData = sortedByAge.map((p) => [
      format(parseISO(p.productionDate), "dd/MM/yyyy"),
      formatUnitName(p.unit),
      formatConvenioName(p.convenio),
      p.ageDays.toString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Unidade", "Convênio", "Idade (dias)"]],
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
      doc.text("Detalhe completo disponível no Excel.", margin, yPos);
      yPos += 4; // evita sobreposição com a próxima seção
    }
  }

  // garante respiro após a tabela (mesmo quando não houver a linha acima)
  if ((doc as any).lastAutoTable?.finalY) {
    yPos = Math.max(yPos, (doc as any).lastAutoTable.finalY + 8);
  }

  // ===== SECTION X: LEITURA EXECUTIVA (So What?) =====
  checkPageBreak(32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Leitura Executiva", margin, yPos);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  const execLines: string[] = [];
  execLines.push("• Operação manteve estabilidade no período analisado.");
  if (data.topUnit)
    execLines.push(`• Concentração por unidade: ${data.topUnit.name} (${formatPercent(data.topUnit.percentage)}).`);
  if (data.specialtyRanking?.[0])
    execLines.push(
      `• Concentração por especialidade: ${data.specialtyRanking[0].name} (${formatPercent(data.specialtyRanking[0].percentage)}).`,
    );

  if (data.unbilledProductions.length > 0) {
    const agesExec = data.unbilledProductions.map((p) =>
      Math.max(0, differenceInDays(refDate, parseISO(p.productionDate))),
    );
    const criticalExec = agesExec.filter((a) => a > 30).length;
    execLines.push(
      criticalExec > 0
        ? `• Pendências críticas (>30 dias): ${criticalExec}. Recomenda-se ação imediata para reduzir risco operacional.`
        : "• Pendências sem criticidade >30 dias, manter monitoramento.",
    );
  } else {
    execLines.push("• Sem pendências operacionais no período.");
  }

  execLines.slice(0, 5).forEach((line) => {
    doc.text(line, margin, yPos);
    yPos += lineHeight;
  });
  yPos += 3;

  // ===== SECTION Y: NOTA METODOLÓGICA =====
  checkPageBreak(22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Nota Metodológica", margin, yPos);
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  const meta = [
    "Baseado exclusivamente em dados de produção assistencial.",
    "Não representa faturamento, fluxo de caixa ou contas a receber.",
    `Idade de pendências calculada com referência no fim do período: ${format(refDate, "dd/MM/yyyy")}.`,
  ];
  meta.forEach((line) => {
    doc.text(line, margin, yPos);
    yPos += 4;
  });
  yPos += 2;

  // Add page numbers
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // Generate filename and save
  const startStr = format(parseISO(data.startDate), "yyyy-MM-dd");
  const endStr = format(parseISO(data.endDate), "yyyy-MM-dd");
  const unitSuffix = data.selectedUnit === "all" ? "Todas" : formatUnitName(data.selectedUnit).replace(/\s+/g, "_");
  const filename = `Relatorio_Producao_EXEC_${startStr}_a_${endStr}_${unitSuffix}.pdf`;

  doc.save(filename);
}
