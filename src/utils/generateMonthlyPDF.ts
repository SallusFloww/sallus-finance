import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MonthlyReportData } from "@/hooks/useMonthlyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatMoney = (value: number): string => {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export function generateMonthlyPDF(data: MonthlyReportData): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  // Verifica se o score está em formação
  const isScoreInFormation = data.score.globalScore === 0 || 
    (data.production.totalValue === 0 && data.billing.totalBilled === 0);
  
  let yPos = margin;
  
  // ===== CAPA =====
  // Fundo institucional
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  // Header institucional
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SallusFlow — Gestão Financeira Inteligente", margin, margin);
  
  // Título principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO EXECUTIVO", pageWidth / 2, 80, { align: "center" });
  
  // Competência
  doc.setFontSize(22);
  const competenciaTitle = data.competenciaFormatted.charAt(0).toUpperCase() + data.competenciaFormatted.slice(1);
  doc.text(competenciaTitle, pageWidth / 2, 100, { align: "center" });
  
  // Score Badge - Com tratamento para "Em Formação"
  if (isScoreInFormation) {
    // Score em formação - cor neutra (azul/cinza)
    doc.setFillColor(100, 116, 139); // slate-500
    doc.roundedRect(pageWidth / 2 - 50, 130, 100, 50, 5, 5, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SCORE EM FORMAÇÃO", pageWidth / 2, 152, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Base de dados ainda em consolidação", pageWidth / 2, 165, { align: "center" });
  } else {
    const scoreColor = data.score.globalScore >= 70 ? [34, 197, 94] : data.score.globalScore >= 55 ? [250, 204, 21] : [239, 68, 68];
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.roundedRect(pageWidth / 2 - 40, 130, 80, 45, 5, 5, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.score.globalScore}`, pageWidth / 2, 155, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SCORE FINANCEIRO", pageWidth / 2, 168, { align: "center" });
  }
  
  // Data de geração
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(10);
  doc.text(
    `Gerado em ${format(new Date(data.generatedAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    pageHeight - 30,
    { align: "center" }
  );
  
  // ===== PÁGINA 2: RESUMO EXECUTIVO =====
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  yPos = margin;
  
  // Header institucional
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO EXECUTIVO – " + competenciaTitle.toUpperCase(), margin, yPos);
  doc.text("SallusFlow", pageWidth - margin, yPos, { align: "right" });
  yPos += 10;
  
  // Título da seção
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", margin, yPos);
  yPos += 10;
  
  // Linha separadora
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;
  
  // Score Section no resumo
  if (isScoreInFormation) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, "F");
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SCORE FINANCEIRO: Em Formação", margin + 10, yPos + 12);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Base de dados ainda em consolidação.", margin + 10, yPos + 22);
    doc.text("O score será calculado automaticamente conforme o histórico do período for consolidado.", margin + 10, yPos + 30);
    
    yPos += 45;
  } else {
    yPos += 5;
  }
  
  // KPIs principais - Indicadores Principais
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Principais", margin, yPos);
  yPos += 10;
  
  const kpiBoxWidth = (contentWidth - 10) / 2;
  const kpiBoxHeight = 35;
  
  // Saldo em Caixa
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(margin, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(22, 101, 52); // green-800
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("SALDO EM CAIXA", margin + 5, yPos + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.cash.currentBalance), margin + 5, yPos + 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Posição atual do caixa", margin + 5, yPos + 30);
  
  // Faturamento do Período
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(margin + kpiBoxWidth + 10, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(30, 64, 175); // blue-800
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("FATURAMENTO DO PERÍODO", margin + kpiBoxWidth + 15, yPos + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.billing.totalBilled), margin + kpiBoxWidth + 15, yPos + 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Total faturado no período", margin + kpiBoxWidth + 15, yPos + 30);
  
  yPos += kpiBoxHeight + 10;
  
  // Produção Realizada
  doc.setFillColor(245, 243, 255); // violet-50
  doc.roundedRect(margin, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(91, 33, 182); // violet-700
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PRODUÇÃO REALIZADA", margin + 5, yPos + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.production.totalValue), margin + 5, yPos + 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.production.totalQuantity} procedimentos realizados`, margin + 5, yPos + 30);
  
  // Valores em Aberto
  doc.setFillColor(255, 247, 237); // orange-50
  doc.roundedRect(margin + kpiBoxWidth + 10, yPos, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
  doc.setTextColor(154, 52, 18); // orange-800
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("VALORES EM ABERTO", margin + kpiBoxWidth + 15, yPos + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.aging.totalOpen), margin + kpiBoxWidth + 15, yPos + 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Títulos a receber", margin + kpiBoxWidth + 15, yPos + 30);
  
  yPos += kpiBoxHeight + 20;
  
  // Funil de Conversão
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Funil de Conversão", margin, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Etapa", "Valor", "Taxa"]],
    body: [
      ["Produção", formatMoney(data.production.totalValue), "—"],
      ["Faturamento", formatMoney(data.billing.totalBilled), formatPercent(data.operationalKPIs.productionToBillingConversion)],
      ["Recebimento", formatMoney(data.billing.totalReceived), formatPercent(data.operationalKPIs.billingToReceiptConversion)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 5;
  
  // Texto explicativo do funil
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Os percentuais representam a relação entre produção, faturamento e valores efetivamente recebidos no período.",
    margin,
    yPos
  );
  yPos += 4;
  doc.text(
    "Valores superiores a 100% indicam recebimentos referentes a períodos anteriores.",
    margin,
    yPos
  );
  
  yPos += 15;
  
  // Bloco de Alertas
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Alertas", margin, yPos);
  yPos += 10;
  
  const hasCriticalAlerts = data.alerts.some(
    alert => alert.type === "critical" && data.aging.criticalPercentage > 0
  );
  
  if (hasCriticalAlerts) {
    // Alerta ativo
    doc.setFillColor(254, 243, 199); // amber-100
    doc.roundedRect(margin, yPos, contentWidth, 24, 3, 3, "F");
    
    doc.setTextColor(146, 64, 14); // amber-800
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Atenção: existem valores relevantes pendentes de regularização.", margin + 10, yPos + 10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Recomenda-se acompanhamento para evitar impactos futuros.", margin + 10, yPos + 19);
    
    yPos += 30;
  } else {
    // Sem alertas
    doc.setFillColor(220, 252, 231); // green-100
    doc.roundedRect(margin, yPos, contentWidth, 18, 3, 3, "F");
    
    doc.setTextColor(22, 101, 52); // green-800
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhum risco relevante identificado no período analisado.", margin + 10, yPos + 12);
    
    yPos += 25;
  }
  
  // Rodapé da página
  addFooter(doc, pageWidth, pageHeight, margin, generatedAt);
  
  // ===== PÁGINA 3: PRODUÇÃO & FATURAMENTO =====
  doc.addPage();
  yPos = margin;
  
  // Header institucional
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO EXECUTIVO – " + competenciaTitle.toUpperCase(), margin, yPos);
  doc.text("IMEC", pageWidth - margin, yPos, { align: "right" });
  yPos += 10;
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Produção & Faturamento", margin, yPos);
  yPos += 10;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;
  
  // Tabela de Produção
  doc.setFontSize(12);
  doc.text("Produção", margin, yPos);
  yPos += 8;
  
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
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Tabela de Faturamento
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Faturamento a Receber", margin, yPos);
  yPos += 8;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Valor", "% do Total"]],
    body: [
      ["Faturado", formatMoney(data.billing.totalBilled), "100%"],
      ["Recebido", formatMoney(data.billing.totalReceived), formatPercent(data.billing.receiptRate)],
      ["Glosado", formatMoney(data.billing.totalGlossed), formatPercent(data.billing.glossRate)],
      ["Em Recurso", formatMoney(data.billing.totalInAppeal), "-"],
      ["Em Aberto", formatMoney(data.billing.totalOpen), formatPercent(data.billing.totalBilled > 0 ? (data.billing.totalOpen / data.billing.totalBilled) * 100 : 0)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Aging
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Aging de Contas a Receber", margin, yPos);
  yPos += 8;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Faixa", "Valor", "% do Total"]],
    body: [
      ["0-30 dias", formatMoney(data.aging.bucket0to30), formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket0to30 / data.aging.totalOpen) * 100 : 0)],
      ["31-60 dias", formatMoney(data.aging.bucket31to60), formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket31to60 / data.aging.totalOpen) * 100 : 0)],
      ["61-90 dias", formatMoney(data.aging.bucket61to90), formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucket61to90 / data.aging.totalOpen) * 100 : 0)],
      [">90 dias", formatMoney(data.aging.bucketOver90), formatPercent(data.aging.totalOpen > 0 ? (data.aging.bucketOver90 / data.aging.totalOpen) * 100 : 0)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index >= 2) {
        data.cell.styles.fillColor = [254, 226, 226];
      }
    }
  });
  
  // Rodapé da página
  addFooter(doc, pageWidth, pageHeight, margin, generatedAt);
  
  // ===== PÁGINA 4: CAIXA & SCORE =====
  doc.addPage();
  yPos = margin;
  
  // Header institucional
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO EXECUTIVO – " + competenciaTitle.toUpperCase(), margin, yPos);
  doc.text("IMEC", pageWidth - margin, yPos, { align: "right" });
  yPos += 10;
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Caixa & Score Financeiro", margin, yPos);
  yPos += 10;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;
  
  // Caixa
  doc.setFontSize(12);
  doc.text("Demonstrativo de Caixa", margin, yPos);
  yPos += 8;
  
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
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [220, 252, 231];
      }
    }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 20;
  
  // Score Financeiro
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Score Financeiro", margin, yPos);
  yPos += 15;
  
  // Score visual
  const scoreBoxWidth = 100;
  const scoreBoxHeight = isScoreInFormation ? 45 : 50;
  const scoreX = pageWidth / 2 - scoreBoxWidth / 2;
  
  if (isScoreInFormation) {
    // Score em formação - cor neutra
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(scoreX, yPos, scoreBoxWidth, scoreBoxHeight, 5, 5, "F");
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Score em Formação", pageWidth / 2, yPos + 18, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Base de dados ainda em consolidação.", pageWidth / 2, yPos + 30, { align: "center" });
    doc.text("O score será calculado automaticamente", pageWidth / 2, yPos + 38, { align: "center" });
  } else {
    const bgColor = data.score.globalScore >= 70 ? [220, 252, 231] : data.score.globalScore >= 55 ? [254, 249, 195] : [254, 226, 226];
    const fgColor = data.score.globalScore >= 70 ? [22, 101, 52] : data.score.globalScore >= 55 ? [133, 77, 14] : [127, 29, 29];
    
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.roundedRect(scoreX, yPos, scoreBoxWidth, scoreBoxHeight, 5, 5, "F");
    
    doc.setTextColor(fgColor[0], fgColor[1], fgColor[2]);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.score.globalScore}`, pageWidth / 2, yPos + 28, { align: "center" });
    doc.setFontSize(10);
    doc.text(data.score.globalLabel.toUpperCase(), pageWidth / 2, yPos + 42, { align: "center" });
  }
  
  yPos += scoreBoxHeight + 15;
  
  // Unidades (apenas se não estiver em formação)
  if (!isScoreInFormation && data.score.unitScores.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Score por Unidade", margin, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [["Unidade", "Score", "Status", "Peso"]],
      body: data.score.unitScores.map(u => [
        u.unitName,
        u.score.toString(),
        u.status.charAt(0).toUpperCase() + u.status.slice(1),
        formatPercent(u.weight)
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }
  
  // Rodapé da página
  addFooter(doc, pageWidth, pageHeight, margin, generatedAt);
  
  // ===== PÁGINA 5: PRÓXIMAS AÇÕES =====
  doc.addPage();
  yPos = margin;
  
  // Header institucional
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO EXECUTIVO – " + competenciaTitle.toUpperCase(), margin, yPos);
  doc.text("IMEC", pageWidth - margin, yPos, { align: "right" });
  yPos += 10;
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Próximas Ações", margin, yPos);
  yPos += 10;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;
  
  // Limitar a 3 ações objetivas
  const actionsToShow = data.nextActions.slice(0, 3);
  
  actionsToShow.forEach((action, index) => {
    const priorityColor = action.priority === "high" ? [254, 243, 199] : action.priority === "medium" ? [254, 249, 195] : [219, 234, 254];
    const priorityTextColor = action.priority === "high" ? [146, 64, 14] : action.priority === "medium" ? [133, 77, 14] : [30, 64, 175];
    const priorityLabel = action.priority === "high" ? "ALTA" : action.priority === "medium" ? "MÉDIA" : "BAIXA";
    
    doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
    doc.roundedRect(margin, yPos, contentWidth, 28, 3, 3, "F");
    
    // Número
    doc.setTextColor(priorityTextColor[0], priorityTextColor[1], priorityTextColor[2]);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}`, margin + 8, yPos + 16);
    
    // Ação
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(action.action, margin + 25, yPos + 10);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Impacto estimado: ${action.impact}`, margin + 25, yPos + 20);
    
    // Badge prioridade
    doc.setFillColor(priorityTextColor[0], priorityTextColor[1], priorityTextColor[2]);
    doc.roundedRect(pageWidth - margin - 35, yPos + 8, 30, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(priorityLabel, pageWidth - margin - 20, yPos + 16, { align: "center" });
    
    yPos += 35;
  });
  
  // Rodapé institucional obrigatório
  addFooter(doc, pageWidth, pageHeight, margin, generatedAt);
  
  // Salvar PDF
  const fileName = `relatorio-executivo-${data.competencia}.pdf`;
  doc.save(fileName);
}

// Função auxiliar para adicionar rodapé institucional
function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, generatedAt: string): void {
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  
  // Linha separadora do rodapé
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
  
  // Texto institucional
  doc.text(
    "Relatório gerado automaticamente pelo Sistema de Gestão Financeira IMEC.",
    pageWidth / 2,
    pageHeight - 18,
    { align: "center" }
  );
  doc.text(
    `Dados consolidados até ${generatedAt}.`,
    pageWidth / 2,
    pageHeight - 13,
    { align: "center" }
  );
  doc.text(
    "Uso exclusivo para fins gerenciais.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );
}
