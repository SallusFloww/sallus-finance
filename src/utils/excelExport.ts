// src/utils/excelExport.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * ✅ EXPORT PREMIUM + DASHBOARD
 * - Mantém aba Movimentações pivot-ready
 * - Gera automaticamente a aba Dashboard com KPIs e Resumos
 * - Visual moderno, limpo, harmônico e "diretoria-friendly"
 *
 * ⚠️ NÃO QUEBRA NADA:
 * - Só adiciona valor, sem mudar regra de dados do app
 */

// =========================
// Tipos (ajuste se quiser)
// =========================

export type MovementStatus = "REALIZADO" | "PREVISTO" | "CANCELADO";

export type MovementType = "ENTRADA" | "SAIDA";

export interface MovementRow {
  date: Date | string; // Date ou string ISO
  competence?: string; // "01/2026"
  unit?: string; // unidade / setor
  category?: string; // categoria
  subcategory?: string; // subcategoria
  description?: string; // descrição
  paymentMode?: string; // pix, boleto etc
  type?: MovementType; // entrada / saida
  status?: MovementStatus; // realizado / previsto / cancelado
  amount: number; // valor
  origin?: string; // manual/import
  id?: string; // uuid
}

// =========================
// Helpers de Design
// =========================

const COLORS = {
  bg: "0B1220", // azul bem escuro (barra topo)
  card: "111827", // card escuro
  surface: "0F172A", // fundo escuro sutil
  text: "E5E7EB", // texto claro
  muted: "94A3B8", // texto secundário
  accent: "38BDF8", // azul claro
  good: "22C55E",
  warn: "F59E0B",
  bad: "EF4444",
  border: "1F2937",
  white: "FFFFFF",
};

function toDateSafe(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function moneyBR(num: number) {
  // Excel format will handle it; this is only for fallback strings if needed
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num || 0);
}

function normalizeStatus(s?: string): MovementStatus {
  const up = (s || "").toUpperCase().trim();
  if (up.includes("CANC")) return "CANCELADO";
  if (up.includes("PREV")) return "PREVISTO";
  return "REALIZADO";
}

function normalizeType(t?: string): MovementType {
  const up = (t || "").toUpperCase().trim();
  if (up.includes("SAI")) return "SAIDA";
  return "ENTRADA";
}

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bg } };
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function bodyCellStyle(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, color: { argb: "111827" } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.border = {
    bottom: { style: "thin", color: { argb: "E5E7EB" } },
  };
}

function makeCard(ws: ExcelJS.Worksheet, range: string, title: string, formula: string, color: string) {
  // range ex: "B4:D8"
  ws.mergeCells(range);
  const topLeft = ws.getCell(range.split(":")[0]);

  topLeft.value = {
    richText: [
      { text: `${title}\n`, font: { name: "Calibri", size: 11, color: { argb: COLORS.muted } } },
      { text: " ", font: { name: "Calibri", size: 8 } },
    ],
  };

  topLeft.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.card } };
  topLeft.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
  topLeft.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  topLeft.font = { name: "Calibri", size: 11, color: { argb: COLORS.text } };

  // Valor grandão (coloca no "miolo" do card)
  // pega célula central do card pra ficar bonito
  const [start] = range.split(":");
  const startCell = ws.getCell(start);
  const startRow = startCell.row;
  const startCol = startCell.col;

  const valueCell = ws.getCell(startRow + 2, startCol);
  valueCell.value = { formula, result: 0 };
  valueCell.font = { name: "Calibri", size: 20, bold: true, color: { argb: color } };
  valueCell.alignment = { vertical: "middle", horizontal: "left" };
  valueCell.numFmt = `"R$" #,##0.00;[Red]"R$" -#,##0.00`;

  // Linha auxiliar (subtítulo)
  const hintCell = ws.getCell(startRow + 4, startCol);
  hintCell.value = "Atualizado automaticamente";
  hintCell.font = { name: "Calibri", size: 10, color: { argb: COLORS.muted } };
  hintCell.alignment = { vertical: "middle", horizontal: "left" };

  // arredondamento visual “fake”: borda externa + espaço interno
  // (Excel não tem border radius, mas isso já dá o efeito premium)
}

function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 10, maxWidth = 42) {
  ws.columns?.forEach((col) => {
    if (!col) return;
    let longest = 0;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      const text =
        typeof val === "string"
          ? val
          : typeof val === "number"
            ? String(val)
            : val && typeof val === "object" && "richText" in val
              ? (val as any).richText.map((x: any) => x.text).join("")
              : val && typeof val === "object" && "formula" in val
                ? String((val as any).result ?? "")
                : val
                  ? String(val)
                  : "";
      longest = Math.max(longest, text.length);
    });
    col.width = Math.min(maxWidth, Math.max(minWidth, longest + 2));
  });
}

// =========================
// Export Premium
// =========================

export async function exportMovementsExcel(
  rows: MovementRow[],
  options?: {
    fileName?: string;
    companyName?: string;
    periodLabel?: string; // "01/2026"
  },
) {
  const fileName = options?.fileName ?? `Sallus_Finance_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const companyName = options?.companyName ?? "Sallus Finance";
  const periodLabel = options?.periodLabel ?? "Período selecionado";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SallusFlow";
  workbook.created = new Date();
  workbook.modified = new Date();

  // =========================
  // 1) Aba Movimentações
  // =========================
  const wsMov = workbook.addWorksheet("Movimentações", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: "2563EB" } },
  });

  wsMov.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Competência", key: "competence", width: 12 },
    { header: "Unidade", key: "unit", width: 20 },
    { header: "Categoria", key: "category", width: 18 },
    { header: "Subcategoria", key: "subcategory", width: 18 },
    { header: "Descrição", key: "description", width: 30 },
    { header: "Modo Pgto", key: "paymentMode", width: 14 },
    { header: "Tipo", key: "type", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Valor", key: "amount", width: 14 },
    { header: "Origem", key: "origin", width: 10 },
    { header: "ID", key: "id", width: 36 },
  ];

  // Cabeçalho premium
  const headerRow = wsMov.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => headerStyle(cell));

  // Linhas
  const normalized = rows.map((r) => ({
    date: toDateSafe(r.date),
    competence: r.competence ?? "",
    unit: r.unit ?? "Sem Unidade",
    category: r.category ?? "Sem Categoria",
    subcategory: r.subcategory ?? "",
    description: r.description ?? "",
    paymentMode: r.paymentMode ?? "",
    type: normalizeType(r.type),
    status: normalizeStatus(r.status),
    amount: Number(r.amount || 0),
    origin: r.origin ?? "",
    id: r.id ?? "",
  }));

  for (const r of normalized) {
    const row = wsMov.addRow(r);
    row.height = 18;
    row.eachCell((cell, colNumber) => {
      bodyCellStyle(cell);

      // Data como data real do Excel
      if (colNumber === 1) {
        cell.numFmt = "dd/mm/yyyy";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      // Tipo/Status centralizados
      if (colNumber === 8 || colNumber === 9) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      // Valor formatado BR
      if (colNumber === 10) {
        cell.numFmt = `"R$" #,##0.00;[Red]"R$" -#,##0.00`;
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }

      // Status com “badge visual”
      if (colNumber === 9) {
        const v = String(cell.value ?? "").toUpperCase();
        if (v === "REALIZADO") {
          cell.font = { ...cell.font, bold: true, color: { argb: "065F46" } };
        } else if (v === "PREVISTO") {
          cell.font = { ...cell.font, bold: true, color: { argb: "92400E" } };
        } else if (v === "CANCELADO") {
          cell.font = { ...cell.font, bold: true, color: { argb: "991B1B" } };
        }
      }
    });
  }

  // AutoFilter
  wsMov.autoFilter = {
    from: "A1",
    to: "L1",
  };

  // Tabela estruturada (excel “inteligente”)
  wsMov.addTable({
    name: "Movimentacoes",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium9",
      showRowStripes: true,
    },
    columns: wsMov.columns.map((c) => ({ name: String(c.header) })),
    rows: normalized.map((r) => [
      r.date,
      r.competence,
      r.unit,
      r.category,
      r.subcategory,
      r.description,
      r.paymentMode,
      r.type,
      r.status,
      r.amount,
      r.origin,
      r.id,
    ]),
  });

  // Ajuste fino
  wsMov.getColumn(12).hidden = true; // esconde ID (fica no arquivo, mas não polui)
  autoFitColumns(wsMov);

  // =========================
  // 2) Aba Dashboard
  // =========================
  const wsDash = workbook.addWorksheet("Dashboard", {
    views: [{ state: "frozen", ySplit: 3 }],
    properties: { tabColor: { argb: "0EA5E9" } },
  });

  // Layout base
  wsDash.getColumn(1).width = 2; // margem
  wsDash.getColumn(2).width = 18;
  wsDash.getColumn(3).width = 18;
  wsDash.getColumn(4).width = 18;
  wsDash.getColumn(5).width = 18;
  wsDash.getColumn(6).width = 2; // respiro
  wsDash.getColumn(7).width = 24;
  wsDash.getColumn(8).width = 18;
  wsDash.getColumn(9).width = 18;
  wsDash.getColumn(10).width = 2;

  // Top bar (estilo app)
  wsDash.mergeCells("A1:J1");
  const topBar = wsDash.getCell("A1");
  topBar.value = `${companyName} — Dashboard Financeiro`;
  topBar.font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.white } };
  topBar.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bg } };
  topBar.alignment = { vertical: "middle", horizontal: "left" };
  wsDash.getRow(1).height = 26;

  // Subheader
  wsDash.mergeCells("A2:J2");
  const sub = wsDash.getCell("A2");
  sub.value = `Período: ${periodLabel} | Export automático (Movimentações → Dashboard)`;
  sub.font = { name: "Calibri", size: 11, color: { argb: COLORS.muted } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
  sub.alignment = { vertical: "middle", horizontal: "left" };
  wsDash.getRow(2).height = 20;

  // Linha espaçadora
  wsDash.mergeCells("A3:J3");
  wsDash.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
  wsDash.getRow(3).height = 10;

  // KPIs (cards)
  // Usando Structured References da tabela Movimentacoes:
  // Colunas: Data, Competência, Unidade, Categoria, Subcategoria, Descrição, Modo Pgto, Tipo, Status, Valor, Origem, ID

  makeCard(
    wsDash,
    "B4:D8",
    "Saldo Total (Realizado)",
    `SUMIFS(Movimentacoes[Valor],Movimentacoes[Status],"REALIZADO")`,
    COLORS.accent,
  );

  makeCard(
    wsDash,
    "E4:G8",
    "Entradas (Realizado)",
    `SUMIFS(Movimentacoes[Valor],Movimentacoes[Status],"REALIZADO",Movimentacoes[Tipo],"ENTRADA")`,
    COLORS.good,
  );

  makeCard(
    wsDash,
    "H4:J8",
    "Saídas (Realizado)",
    `SUMIFS(Movimentacoes[Valor],Movimentacoes[Status],"REALIZADO",Movimentacoes[Tipo],"SAIDA")`,
    COLORS.bad,
  );

  // Linha 9: título seção
  wsDash.mergeCells("B10:J10");
  const sec1 = wsDash.getCell("B10");
  sec1.value = "Resumo por Unidade (Realizado)";
  sec1.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.text } };
  sec1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
  sec1.alignment = { vertical: "middle", horizontal: "left" };
  wsDash.getRow(10).height = 20;

  // Tabela por Unidade (aqui é “chique” e robusto)
  const units = Array.from(new Set(normalized.map((r) => r.unit))).sort((a, b) => a.localeCompare(b));
  const startRowUnits = 12;

  // Headers
  wsDash.getCell(`B${startRowUnits}`).value = "Unidade";
  wsDash.getCell(`C${startRowUnits}`).value = "Entradas (R$)";
  wsDash.getCell(`D${startRowUnits}`).value = "Saídas (R$)";
  wsDash.getCell(`E${startRowUnits}`).value = "Saldo (R$)";
  wsDash.getCell(`F${startRowUnits}`).value = "Qtd Mov.";
  wsDash.getCell(`G${startRowUnits}`).value = "Previsto (R$)";
  wsDash.getCell(`H${startRowUnits}`).value = "% Realizado";
  wsDash.getCell(`I${startRowUnits}`).value = "Alerta";

  const headerCells = [
    `B${startRowUnits}`,
    `C${startRowUnits}`,
    `D${startRowUnits}`,
    `E${startRowUnits}`,
    `F${startRowUnits}`,
    `G${startRowUnits}`,
    `H${startRowUnits}`,
    `I${startRowUnits}`,
  ];
  headerCells.forEach((addr) => {
    const c = wsDash.getCell(addr);
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bg } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  });

  wsDash.getRow(startRowUnits).height = 20;

  // Rows unidade
  let rowIdx = startRowUnits + 1;
  for (const unit of units) {
    wsDash.getCell(`B${rowIdx}`).value = unit;

    // Entradas realizado
    wsDash.getCell(`C${rowIdx}`).value = {
      formula: `SUMIFS(Movimentacoes[Valor],Movimentacoes[Unidade],"${unit}",Movimentacoes[Status],"REALIZADO",Movimentacoes[Tipo],"ENTRADA")`,
      result: 0,
    };

    // Saídas realizado
    wsDash.getCell(`D${rowIdx}`).value = {
      formula: `SUMIFS(Movimentacoes[Valor],Movimentacoes[Unidade],"${unit}",Movimentacoes[Status],"REALIZADO",Movimentacoes[Tipo],"SAIDA")`,
      result: 0,
    };

    // Saldo
    wsDash.getCell(`E${rowIdx}`).value = { formula: `C${rowIdx}-D${rowIdx}`, result: 0 };

    // Qtd movimentações
    wsDash.getCell(`F${rowIdx}`).value = {
      formula: `COUNTIF(Movimentacoes[Unidade],"${unit}")`,
      result: 0,
    };

    // Previsto
    wsDash.getCell(`G${rowIdx}`).value = {
      formula: `SUMIFS(Movimentacoes[Valor],Movimentacoes[Unidade],"${unit}",Movimentacoes[Status],"PREVISTO")`,
      result: 0,
    };

    // % Realizado (realizado / (realizado + previsto)) -> simples e útil
    wsDash.getCell(`H${rowIdx}`).value = {
      formula: `IFERROR((ABS(C${rowIdx})+ABS(D${rowIdx}))/(ABS(C${rowIdx})+ABS(D${rowIdx})+ABS(G${rowIdx})),0)`,
      result: 0,
    };

    // Alerta (texto inteligente)
    wsDash.getCell(`I${rowIdx}`).value = {
      formula: `IF(E${rowIdx}<0,"⚠️ Saldo negativo",IF(H${rowIdx}<0.5,"🟡 Baixa execução","✅ OK"))`,
      result: "",
    };

    // Estilos
    ["B", "C", "D", "E", "F", "G", "H", "I"].forEach((col) => {
      const cell = wsDash.getCell(`${col}${rowIdx}`);
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
      cell.font = { name: "Calibri", size: 11, color: { argb: COLORS.text } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
      cell.alignment = { vertical: "middle", horizontal: col === "B" ? "left" : "center" };

      if (["C", "D", "E", "G"].includes(col)) {
        cell.numFmt = `"R$" #,##0.00;[Red]"R$" -#,##0.00`;
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
      if (col === "H") {
        cell.numFmt = "0%";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    rowIdx++;
  }

  // Seção Top Categorias
  const catTitleRow = rowIdx + 2;
  wsDash.mergeCells(`B${catTitleRow}:J${catTitleRow}`);
  const sec2 = wsDash.getCell(`B${catTitleRow}`);
  sec2.value = "Top Categorias (Saídas Realizadas)";
  sec2.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.text } };
  sec2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
  sec2.alignment = { vertical: "middle", horizontal: "left" };
  wsDash.getRow(catTitleRow).height = 20;

  // Top categorias calculado no JS (mais confiável que fórmula maluca)
  const categoryTotals = new Map<string, number>();
  normalized.forEach((r) => {
    if (r.status !== "REALIZADO") return;
    if (r.type !== "SAIDA") return;
    const key = r.category || "Sem Categoria";
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + Math.abs(r.amount));
  });

  const topCats = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topStart = catTitleRow + 2;
  wsDash.getCell(`B${topStart}`).value = "Categoria";
  wsDash.getCell(`C${topStart}`).value = "Total Saídas";
  wsDash.getCell(`D${topStart}`).value = "% do Total";

  ["B", "C", "D"].forEach((col) => {
    const c = wsDash.getCell(`${col}${topStart}`);
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bg } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  });

  const totalOut = topCats.reduce((sum, [, v]) => sum + v, 0) || 1;

  let rr = topStart + 1;
  for (const [cat, val] of topCats) {
    wsDash.getCell(`B${rr}`).value = cat;
    wsDash.getCell(`C${rr}`).value = val;
    wsDash.getCell(`D${rr}`).value = val / totalOut;

    ["B", "C", "D"].forEach((col) => {
      const cell = wsDash.getCell(`${col}${rr}`);
      cell.font = { name: "Calibri", size: 11, color: { argb: COLORS.text } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
      cell.alignment = { vertical: "middle", horizontal: col === "B" ? "left" : "right" };
    });

    wsDash.getCell(`C${rr}`).numFmt = `"R$" #,##0.00;[Red]"R$" -#,##0.00`;
    wsDash.getCell(`D${rr}`).numFmt = "0%";

    rr++;
  }

  // Rodapé elegante (não polui)
  const footerRow = rr + 2;
  wsDash.mergeCells(`B${footerRow}:J${footerRow}`);
  const foot = wsDash.getCell(`B${footerRow}`);
  foot.value =
    "Gerado automaticamente pelo SallusFlow • Dados provenientes da aba Movimentações • Relatório pronto para diretoria";
  foot.font = { name: "Calibri", size: 10, color: { argb: COLORS.muted } };
  foot.alignment = { vertical: "middle", horizontal: "left" };

  // Fundo geral do dashboard
  for (let r = 1; r <= footerRow + 2; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = wsDash.getCell(r, c);
      if (!cell.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.surface } };
      }
    }
    wsDash.getRow(r).height = wsDash.getRow(r).height || 18;
  }

  // =========================
  // Final: salvar arquivo
  // =========================
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}
