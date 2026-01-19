import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MonthlyReportData } from "@/hooks/useMonthlyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatMoney = (value: number): string => {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Cabeçalho institucional padrão (todas as páginas)
 * - Esquerda: IMEC + SallusFlow
 * - Centro: título + competência
 * - Direita: data de geração + versão
 *
 * Retorna o Y inicial recomendado para começar o conteúdo.
 */
function addHeader(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  competenciaTitle: string,
  generatedAt: string,
): number {
  const headerTop = margin;
  const headerHeight = 18;

  // Texto base
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500

  // ESQUERDA
  doc.setFont("helvetica", "bold");
  doc.text("IMEC Saúde", margin, headerTop);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema SallusFlow — Gestão Financeira", margin, headerTop + 5);

  // CENTRO
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("RELATÓRIO EXECUTIVO FINANCEIRO", pageWidth / 2, headerTop, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Competência: ${competenciaTitle}`, pageWidth / 2, headerTop + 5, {
    align: "center",
  });

  // DIREITA
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${generatedAt}`, pageWidth - margin, headerTop, {
    align: "right",
  });
  doc.text("Versão: Automática", pageWidth - margin, headerTop + 5, {
    align: "right",
  });

  // Linha separadora
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(margin, headerTop + headerHeight, pageWidth - margin, headerTop + headerHeight);

  // Conteúdo começa abaixo do cabeçalho
  return headerTop + headerHeight + 10;
}

// Função auxiliar para adicionar rodapé institucional
function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, generatedAt: string): void {
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  // Linha separadora do rodapé
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  // Texto institucional
  doc.text("Relatório gerado automaticamente pelo Sistema de Gestão Financeira IMEC.", pageWidth / 2, pageHeight - 18, {
    align: "center",
  });
  doc.text(`Dados consolidados até ${generatedAt}.`, pageWidth / 2, pageHeight - 13, {
    align: "center",
  });
  doc.text("Uso exclusivo para fins gerenciais.", pageWidth / 2, pageHeight - 8, {
    align: "center",
  });
}

export function generateMonthlyPDF(data: MonthlyReportData): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  const generatedAtShort = format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  // Data de geração que aparece no cabeçalho (padronizada)
  const generatedAtLong = format(new Date(data.generatedAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  // Competência
  const competenciaTitle = data.competenciaFormatted.charAt(0).toUpperCase() + data.competenciaFormatted.slice(1);

  // Score em formação
  const isScoreInFormation =
    data.score.globalScore === 0 || (data.production.totalValue === 0 && data.billing.totalBilled === 0);

  // =============================================================================
  // PÁGINA 1: RESUMO EXECUTIVO (SEM CAPA)
  // =============================================================================
  let yPos = addHeader(doc, pageWidth, margin, competenciaTitle, generatedAtLong);

  // Título seção
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", margin, yPos);
  yPos += 10;

  // Linha fina
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Bloco: Situação geral (compacto e executivo)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, yPos, contentWidth, 26, 3, 3, "F");

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Situação Financeira do Período", margin + 8, yPos + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // slate-600

  const scoreLine = isScoreInFormation
    ? "Score financeiro: Em formação • Confiabilidade: Parcial • Tendência inicial: Em consolidação"
    : `Score financeiro: ${data.score.globalScore} (${data.score.globalLabel}) • Confiabilidade: Alta • Tendência: Monitorar`;

  doc.text(scoreLine, margin + 8, yPos + 18);

  yPos += 36;

  // KPIs principais (4 cards)
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Principais", margin, yPos);
  yPos += 10;

  const kpiBoxWidth = (contentWidth - 10) / 2;
  const kpiBoxHeight = 28;

  // 1) Saldo em Caixa
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(margin, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("SALDO EM CAIXA", margin + 6, yPos + 9);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.cash.currentBalance), margin + 6, yPos + 20);

  // 2) Faturamento do Período
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(margin + kpiBoxWidth + 10, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("FATURAMENTO DO PERÍODO", margin + kpiBoxWidth + 16, yPos + 9);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.billing.totalBilled), margin + kpiBoxWidth + 16, yPos + 20);

  yPos += kpiBoxHeight + 10;

  // 3) Produção Realizada
  doc.setFillColor(245, 243, 255); // violet-50
  doc.roundedRect(margin, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(91, 33, 182);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PRODUÇÃO REALIZADA", margin + 6, yPos + 9);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.production.totalValue), margin + 6, yPos + 20);

  // 4) Valores em Aberto
  doc.setFillColor(255, 247, 237); // orange-50
  doc.roundedRect(margin + kpiBoxWidth + 10, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(154, 52, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("VALORES EM ABERTO", margin + kpiBoxWidth + 16, yPos + 9);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.aging.totalOpen), margin + kpiBoxWidth + 16, yPos + 20);

  yPos += kpiBoxHeight + 16;

  // Funil de Conversão
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Funil de Conversão", margin, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [["Etapa", "Valor", "Taxa"]],
    body: [
      ["Produção", formatMoney(data.production.totalValue), "—"],
      [
        "Faturamento",
        formatMoney(data.billing.totalBilled),
        formatPercent(data.operationalKPIs.productionToBillingConversion),
      ],
      [
        "Recebimento",
        formatMoney(data.billing.totalReceived),
        formatPercent(data.operationalKPIs.billingToReceiptConversion),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Alertas (mais seco e executivo)
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Alertas", margin, yPos);
  yPos += 8;

  const hasCriticalAlerts = data.alerts.some((alert) => alert.type === "critical" && data.aging.criticalPercentage > 0);

  if (hasCriticalAlerts) {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, "F");

    doc.setTextColor(146, 64, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Risco identificado: pendências relevantes a regularizar.", margin + 8, yPos + 12);
  } else {
    doc.setFillColor(220, 252, 231); // green-100
    doc.roundedRect(margin, yPos, contentWidth, 18, 3, 3, "F");

    doc.setTextColor(22, 101, 52);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhum risco financeiro relevante identificado no período.", margin + 8, yPos + 12);
  }

  // Rodapé
  addFooter(doc, pageWidth, pageHeight, margin, generatedAtShort);

  // =============================================================================
  // PÁGINA 2: PRODUÇÃO & FATURAMENTO
  // =============================================================================
  doc.addPage();
  yPos = addHeader(doc, pageWidth, margin, competenciaTitle, generatedAtLong);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Produção & Faturamento", margin, yPos);
  yPos += 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Tabela de Produção
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Produção", margin, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Quantidade", "Valor"]],
    body: [
      ["Total Produzido", data.production.totalQuantity.toString(), formatMoney(data.production.totalValue)],
      ["Faturado", data.production.billedQuantity.toString(), formatMoney(data.production.billedValue)],
      ["Recebido", data.production.receivedQuantity.toString(), formatMoney(data.production.receivedValue)],
      ["Em Aberto", data.production.openQuantity.toString(), formatMoney(data.production.openValue)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Tabela de Faturamento
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Faturamento a Receber", margin, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Valor", "% do Total"]],
    body: [
      ["Faturado", formatMoney(data.billing.totalBilled), "100%"],
      ["Recebido", formatMoney(data.billing.totalReceived), formatPercent(data.billing.receiptRate)],
      ["Glosado", formatMoney(data.billing.totalGlossed), formatPercent(data.billing.glossRate)],
      ["Em Recurso", formatMoney(data.billing.totalInAppeal), "—"],
      [
        "Em Aberto",
        formatMoney(data.billing.totalOpen),
        formatPercent(data.billing.totalBilled > 0 ? (data.billing.totalOpen / data.billing.totalBilled) * 100 : 0),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Aging
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Aging de Contas a Receber", margin, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Faixa", "Valor", "% do Total"]],
    body: [
      [
        "0–30 dias",
        formatMoney(data.aging.bucket0to30),
        formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket0to30 / data.aging.totalOpen) * 100 : 0),
      ],
      [
        "31–60 dias",
        formatMoney(data.aging.bucket31to60),
        formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket31to60 / data.aging.totalOpen) * 100 : 0),
      ],
      [
        "61–90 dias",
        formatMoney(data.aging.bucket61to90),
        formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket61to90 / data.aging.totalOpen) * 100 : 0),
      ],
      [
        "> 90 dias",
        formatMoney(data.aging.bucketOver90),
        formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucketOver90 / data.aging.totalOpen) * 100 : 0),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (hook) => {
      // realce leve em faixas mais antigas
      if (hook.section === "body" && (hook.row.index === 2 || hook.row.index === 3)) {
        hook.cell.styles.fillColor = [254, 226, 226]; // red-100
      }
    },
  });

  addFooter(doc, pageWidth, pageHeight, margin, generatedAtShort);

  // =============================================================================
  // PÁGINA 3: CAIXA & SCORE
  // =============================================================================
  doc.addPage();
  yPos = addHeader(doc, pageWidth, margin, competenciaTitle, generatedAtLong);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Caixa & Score Financeiro", margin, yPos);
  yPos += 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Caixa
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Demonstrativo de Caixa", margin, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Descrição", "Valor"]],
    body: [
      ["Saldo Inicial", formatMoney(data.cash.initialBalance)],
      ["(+) Total de Entradas", formatMoney(data.cash.totalIncome)],
      ["(-) Total de Saídas", formatMoney(data.cash.totalExpense)],
      ["(=) Resultado do Período", formatMoney(data.cash.netResult)],
      ["Saldo Final", formatMoney(data.cash.currentBalance)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === 4) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fillColor = [220, 252, 231];
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 14;

  // Score Financeiro (compacto)
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Score Financeiro", margin, yPos);
  yPos += 8;

  const scoreBoxWidth = contentWidth;
  const scoreBoxHeight = 22;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, yPos, scoreBoxWidth, scoreBoxHeight, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);

  if (isScoreInFormation) {
    doc.text("Status: Score em formação", margin + 8, yPos + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Indicador será consolidado automaticamente conforme o histórico for completado.", margin + 8, yPos + 17);
  } else {
    doc.text(`Score Global: ${data.score.globalScore} — ${data.score.globalLabel}`, margin + 8, yPos + 10);
  }

  yPos += scoreBoxHeight + 10;

  // Score por unidade (apenas se existir e não estiver em formação)
  if (!isScoreInFormation && data.score.unitScores.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Score por Unidade", margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [["Unidade", "Score", "Status", "Peso"]],
      body: data.score.unitScores.map((u) => [
        u.unitName,
        u.score.toString(),
        u.status.charAt(0).toUpperCase() + u.status.slice(1),
        formatPercent(u.weight),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  addFooter(doc, pageWidth, pageHeight, margin, generatedAtShort);

  // =============================================================================
  // PÁGINA 4: PRÓXIMAS AÇÕES
  // =============================================================================
  doc.addPage();
  yPos = addHeader(doc, pageWidth, margin, competenciaTitle, generatedAtLong);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Próximas Ações", margin, yPos);
  yPos += 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Limitar a 3 ações objetivas
  const actionsToShow = data.nextActions.slice(0, 3);

  if (actionsToShow.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 18, 3, 3, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhuma ação recomendada disponível para o período.", margin + 8, yPos + 12);
    yPos += 24;
  } else {
    actionsToShow.forEach((action, index) => {
      // Mais sóbrio: menos cor, foco na informação
      const boxFill = [248, 250, 252] as [number, number, number];
      const badgeFill =
        action.priority === "high"
          ? ([239, 68, 68] as [number, number, number])
          : action.priority === "medium"
            ? ([234, 179, 8] as [number, number, number])
            : ([37, 99, 235] as [number, number, number]);

      const priorityLabel = action.priority === "high" ? "ALTA" : action.priority === "medium" ? "MÉDIA" : "BAIXA";

      doc.setFillColor(boxFill[0], boxFill[1], boxFill[2]);
      doc.roundedRect(margin, yPos, contentWidth, 26, 3, 3, "F");

      // Número
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}.`, margin + 8, yPos + 16);

      // Ação
      doc.setFontSize(11);
      doc.text(action.action, margin + 18, yPos + 11);

      // Impacto
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Impacto estimado: ${action.impact}`, margin + 18, yPos + 20);

      // Badge prioridade
      doc.setFillColor(badgeFill[0], badgeFill[1], badgeFill[2]);
      doc.roundedRect(pageWidth - margin - 34, yPos + 7, 30, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(priorityLabel, pageWidth - margin - 19, yPos + 14, { align: "center" });

      yPos += 32;
    });
  }

  addFooter(doc, pageWidth, pageHeight, margin, generatedAtShort);

  // =============================================================================
  // Salvar PDF
  // =============================================================================
  const fileName = `relatorio-executivo-${data.competencia}.pdf`;
  doc.save(fileName);
}
