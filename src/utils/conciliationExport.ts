import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatUnitDisplayName, formatConvenioDisplayName, formatCurrency } from "./formatters";
import type { ConciliationItem, Divergence } from "@/hooks/useConciliation";

interface ConciliationExportData {
  stats: {
    totalBilled: number;
    totalReceived: number;
    totalGlossed: number;
    totalOpen: number;
    conciliationRate: number;
    pendingCount: number;
    avgAge: number;
  };
  pendingItems: ConciliationItem[];
  divergences: Divergence[];
  paretoByConvenio: Array<{ convenio: string; openAmount: number; count: number }>;
  period?: { start?: Date; end?: Date };
  companyName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  CONCILIADO: "Conciliado",
  PARCIAL: "Parcial",
  EM_ABERTO: "Em Aberto",
  GLOSADO: "Glosado",
  DIVERGENTE: "Divergente",
  SEM_VINCULO: "Sem Vínculo",
  EM_ANALISE: "Em Análise",
};

const DIVERGENCE_LABELS: Record<string, string> = {
  VALOR_DIFERENTE: "Valor Diferente",
  DATA_FORA_JANELA: "Data Fora da Janela",
  RECEBIDO_SEM_FATURAMENTO: "Recebido sem Faturamento",
  FATURADO_SEM_RECEBIDO: "Faturado sem Recebido",
  GLOSA_PARCIAL: "Glosa Parcial",
  GLOSA_TOTAL: "Glosa Total",
};

export function exportConciliationPDF(data: ConciliationExportData): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Conciliação", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  // Period and date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const periodText = data.period?.start && data.period?.end
    ? `Período: ${format(data.period.start, "dd/MM/yyyy")} a ${format(data.period.end, "dd/MM/yyyy")}`
    : `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
  doc.text(periodText, pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // KPIs Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", 14, yPos);
  yPos += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const kpis = [
    ["Faturado", formatCurrency(data.stats.totalBilled)],
    ["Recebido", formatCurrency(data.stats.totalReceived)],
    ["Glosado", formatCurrency(data.stats.totalGlossed)],
    ["Em Aberto", formatCurrency(data.stats.totalOpen)],
    ["Taxa de Conciliação", `${data.stats.conciliationRate.toFixed(1)}%`],
    ["Itens Pendentes", `${data.stats.pendingCount} (idade média: ${data.stats.avgAge} dias)`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: kpis,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right", cellWidth: 60 },
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Pareto by Convenio
  if (data.paretoByConvenio.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Top 10 Pendências por Convênio", 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [["Convênio", "Em Aberto", "Qtd"]],
      body: data.paretoByConvenio.slice(0, 10).map(p => [
        formatConvenioDisplayName(p.convenio),
        formatCurrency(p.openAmount),
        p.count.toString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Pending Items
  if (data.pendingItems.length > 0) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Principais Pendências", 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Unidade", "Convênio", "Faturado", "Em Aberto", "Idade", "Status"]],
      body: data.pendingItems.slice(0, 20).map(item => [
        format(new Date(item.date), "dd/MM/yy"),
        formatUnitDisplayName(item.unit),
        formatConvenioDisplayName(item.source),
        formatCurrency(item.billedAmount),
        formatCurrency(item.openAmount),
        `${item.ageInDays}d`,
        STATUS_LABELS[item.status] || item.status,
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
      styles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Divergences
  if (data.divergences.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Principais Divergências", 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [["Tipo", "Severidade", "Unidade", "Convênio", "Descrição"]],
      body: data.divergences.slice(0, 15).map(div => [
        DIVERGENCE_LABELS[div.type] || div.type,
        div.severity,
        formatUnitDisplayName(div.item.unit),
        formatConvenioDisplayName(div.item.source),
        div.description.substring(0, 50),
      ]),
      theme: "striped",
      headStyles: { fillColor: [239, 68, 68], fontSize: 8 },
      styles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer disclaimer
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(
      "Relatório gerencial de conciliação — não substitui análise contábil oficial",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: "right" }
    );
  }

  const fileName = `conciliacao_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`;
  doc.save(fileName);
}

export function exportConciliationExcel(data: ConciliationExportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo
  const resumoData = [
    ["Relatório de Conciliação"],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
    [],
    ["Indicador", "Valor"],
    ["Faturado", data.stats.totalBilled],
    ["Recebido", data.stats.totalReceived],
    ["Glosado", data.stats.totalGlossed],
    ["Em Aberto", data.stats.totalOpen],
    ["Taxa de Conciliação (%)", data.stats.conciliationRate],
    ["Itens Pendentes", data.stats.pendingCount],
    ["Idade Média (dias)", data.stats.avgAge],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Sheet 2: Pendências
  const pendingHeaders = [
    "Data", "Unidade", "Convênio", "Descrição", 
    "Faturado", "Recebido", "Glosado", "Em Aberto", 
    "Idade (dias)", "Status"
  ];
  const pendingRows = data.pendingItems.map(item => [
    format(new Date(item.date), "dd/MM/yyyy"),
    formatUnitDisplayName(item.unit),
    formatConvenioDisplayName(item.source),
    item.description,
    item.billedAmount,
    item.receivedAmount,
    item.glossedAmount,
    item.openAmount,
    item.ageInDays,
    STATUS_LABELS[item.status] || item.status,
  ]);
  const wsPending = XLSX.utils.aoa_to_sheet([pendingHeaders, ...pendingRows]);
  wsPending["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 35 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
  ];
  wsPending["!autofilter"] = { ref: `A1:J${pendingRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsPending, "Pendencias");

  // Sheet 3: Divergências
  const divHeaders = [
    "Tipo", "Severidade", "Unidade", "Convênio", 
    "Descrição", "Valor Faturado", "Valor Em Aberto", "Idade (dias)"
  ];
  const divRows = data.divergences.map(div => [
    DIVERGENCE_LABELS[div.type] || div.type,
    div.severity,
    formatUnitDisplayName(div.item.unit),
    formatConvenioDisplayName(div.item.source),
    div.description,
    div.item.billedAmount,
    div.item.openAmount,
    div.item.ageInDays,
  ]);
  const wsDiv = XLSX.utils.aoa_to_sheet([divHeaders, ...divRows]);
  wsDiv["!cols"] = [
    { wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 18 },
    { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ];
  wsDiv["!autofilter"] = { ref: `A1:H${divRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsDiv, "Divergencias");

  // Sheet 4: Pareto por Convênio
  const paretoHeaders = ["Convênio", "Em Aberto", "Quantidade"];
  const paretoRows = data.paretoByConvenio.map(p => [
    formatConvenioDisplayName(p.convenio),
    p.openAmount,
    p.count,
  ]);
  const wsPareto = XLSX.utils.aoa_to_sheet([paretoHeaders, ...paretoRows]);
  wsPareto["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPareto, "Pareto_Convenio");

  const fileName = `conciliacao_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
