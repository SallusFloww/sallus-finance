/**
 * Production Report Excel Export - Pivot-Ready Version
 * Multi-sheet XLSX with Base_Producao as the main pivot-ready sheet
 *
 * ✅ Ajustes "de uma vez":
 * - Moeda: mantém valores NUMÉRICOS + máscara "R$" #,##0.00 (pivot/soma OK)
 * - Datas: "Data" vira DATA REAL do Excel (número serial) + máscara dd/mm/yyyy
 * - Percentuais: colunas de % viram número + máscara 0.0% (ordenar/filtrar OK)
 * - Freeze header: usa panes (compatível com Excel)
 */

import * as XLSX from "xlsx";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProductionReportExportData } from "@/components/production/ProductionReportExport";
import {
  formatUnitDisplayName,
  formatSpecialtyDisplayName,
  formatConvenioDisplayName,
  displayLabel,
} from "@/utils/formatters";
import { PAYMENT_METHODS_PARTICULAR } from "@/utils/constants";

interface ExportOptions {
  data: ProductionReportExportData;
  includeEvolution: boolean;
  includeConsolidated: boolean;
  includeUnbilled: boolean;
}

// =============================================================================
// Excel numeric helpers (BR currency safe) + date/percent helpers
// =============================================================================

function parseBRNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v ?? "").trim();
  if (!s) return 0;

  // "1.234,56" -> "1234.56"
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseAnyDate(input: unknown): Date | null {
  if (!input) return null;
  if (typeof input === "number") return null; // já é serial do Excel (ou número), não reparsear
  if (input instanceof Date && !isNaN(input.getTime())) return input;

  const s = String(input).trim();
  if (!s) return null;

  // dd/MM/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }

  // yyyy-MM-dd (ISO short)
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    try {
      const d = parseISO(s);
      if (!isNaN(d.getTime())) return d;
    } catch {
      // ignore
    }
  }

  // ISO / qualquer coisa que o JS entenda
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2;

  return null;
}

/**
 * Date JS -> número serial do Excel (base 1899-12-30, padrão do Excel)
 * Obs: usando UTC para evitar shift de fuso.
 */
function excelDateSerial(date: Date): number {
  const excelEpoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return (utc - excelEpoch) / 86400000;
}

function freezeHeader(ws: XLSX.WorkSheet, topLeftCell: string = "A2") {
  // Padrão que o Excel respeita bem
  (ws as any)["!panes"] = [
    {
      ySplit: 1,
      topLeftCell,
      activePane: "bottomLeft",
      state: "frozen",
    },
  ];
  // Mantém compatibilidade com builds que ainda olham isso:
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
}

function applyCurrencyFormat(ws: XLSX.WorkSheet, colLetter: string, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    const addr = `${colLetter}${r}`;
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;

    cell.v = parseBRNumber(cell.v);
    cell.t = "n";
    (cell as any).z = '"R$" #,##0.00';
  }
}

function applyDateFormat(ws: XLSX.WorkSheet, colLetter: string, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    const addr = `${colLetter}${r}`;
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;

    // Se já veio como serial numérico, só aplica a máscara
    if (typeof cell.v === "number") {
      cell.t = "n";
      (cell as any).z = "dd/mm/yyyy";
      continue;
    }

    const d = parseAnyDate(cell.v);
    if (!d) continue;

    cell.v = excelDateSerial(d);
    cell.t = "n";
    (cell as any).z = "dd/mm/yyyy";
  }
}

function applyPercentFormat(ws: XLSX.WorkSheet, colLetter: string, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    const addr = `${colLetter}${r}`;
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;

    // Se vier "N/A" ou vazio, deixa como texto
    if (typeof cell.v === "string" && cell.v.trim().toUpperCase() === "N/A") {
      cell.t = "s";
      continue;
    }

    const n = typeof cell.v === "number" ? cell.v : parseBRNumber(cell.v);
    cell.v = n;
    cell.t = "n";
    (cell as any).z = "0.0%";
  }
}

// =============================================================================
// Formatting helpers (display)
// =============================================================================

function formatPercentText(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatUnitName(unit: string): string {
  return formatUnitDisplayName(unit);
}

function formatSpecialtyName(specialty: string | null | undefined): string {
  if (!specialty || specialty.trim() === "") return "Sem especialidade";
  return formatSpecialtyDisplayName(specialty);
}

function formatConvenioName(convenio: string | null | undefined): string {
  return formatConvenioDisplayName(convenio || "PARTICULAR");
}

function formatCompetenciaDisplay(competencia: string | null | undefined): string {
  if (!competencia) return "";
  const parts = competencia.split("-");
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return competencia;
}

function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function formatPaymentMethodDisplay(paymentMethod: string | null | undefined): string {
  const raw = (paymentMethod || "").trim();
  if (!raw) return "Não informado";

  const found = (PAYMENT_METHODS_PARTICULAR as any)?.find(
    (m: any) => (m?.value || m) === raw || (m?.label || m) === raw,
  );
  if (found) return (found.label || found.value || raw) as string;

  return raw;
}

// =============================================================================
// Main export
// =============================================================================

export function exportProductionReportToExcel({
  data,
  includeEvolution,
  includeConsolidated,
  includeUnbilled,
}: ExportOptions): void {
  const wb = XLSX.utils.book_new();

  // period days (safe)
  const startISO = data.startDate;
  const endISO = data.endDate;
  const startDate = parseISO(startISO);
  const endDate = parseISO(endISO);
  const periodDays = differenceInDays(endDate, startDate) + 1;

  const now = new Date();

  const topSpec = data.specialtyRanking?.[0];
  const topMix = data.typeBreakdown?.[0];

  // =============================================================================
  // SHEET 1: RESUMO
  // =============================================================================
  const summaryRows: (string | number | null)[][] = [];

  summaryRows.push(["RELATÓRIO GERENCIAL DE PRODUÇÃO"]);
  summaryRows.push([""]);
  summaryRows.push(["METADADOS"]);
  summaryRows.push(["Período", `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`]);
  summaryRows.push(["Duração", `${periodDays} dias`]);
  summaryRows.push(["Unidade", data.selectedUnit === "all" ? "Todas" : formatUnitName(data.selectedUnit)]);
  summaryRows.push(["Convênio", data.selectedConvenio === "all" ? "Todos" : data.selectedConvenio]);
  summaryRows.push(["Tipo", data.selectedType === "all" ? "Todos" : data.selectedType]);
  summaryRows.push(["Especialidade", data.selectedSpecialty === "all" ? "Todas" : data.selectedSpecialty]);
  summaryRows.push(["Data de Geração", format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })]);
  summaryRows.push([""]);

  summaryRows.push(["INDICADORES PRINCIPAIS"]);
  summaryRows.push(["Indicador", "Valor"]);
  summaryRows.push(["Produção Total", data.totalQuantity]);
  summaryRows.push([
    "Unidade Destaque",
    data.topUnit ? `${data.topUnit.name} (${formatPercentText(data.topUnit.percentage)})` : "-",
  ]);
  summaryRows.push([
    "Especialidade Destaque",
    topSpec ? `${topSpec.name} (${formatPercentText(topSpec.percentage)})` : "-",
  ]);
  summaryRows.push(["Mix Principal", topMix ? `${topMix.label} (${formatPercentText(topMix.percentage)})` : "-"]);
  summaryRows.push([""]);

  summaryRows.push(["TOP 5 UNIDADES"]);
  summaryRows.push(["Unidade", "Quantidade", "%"]);
  data.unitRanking.slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercentText(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["TOP 5 ESPECIALIDADES"]);
  summaryRows.push(["Especialidade", "Quantidade", "%"]);
  (data.specialtyRanking || []).slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercentText(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["TOP 5 PROCEDIMENTOS"]);
  summaryRows.push(["Procedimento", "Quantidade", "%"]);
  data.topProcedures.slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercentText(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["OBSERVAÇÃO"]);
  summaryRows.push(["Relatório gerencial de produção. Não representa faturamento, caixa ou contas a receber."]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // =============================================================================
  // SHEET 2: BASE_PRODUCAO (Pivot-Ready)
  // =============================================================================
  const baseData: (string | number | null)[][] = [];

  baseData.push([
    "Data",
    "Competência",
    "Unidade",
    "Pagador",
    "Convênio",
    "Modo de Pagamento",
    "Tipo de Produção",
    "Procedimento",
    "Paciente",
    "Qtde",
    "Valor Unitário",
    "Valor Total",
    "Especialidade",
    "Status",
    "Origem",
    "Batch ID",
  ]);

  if (data.rawProductions && data.rawProductions.length > 0) {
    data.rawProductions.forEach((row: any) => {
      const paymentMethodDisplay = row.payer === "PARTICULAR" ? formatPaymentMethodDisplay(row.paymentMethod) : "";

      // ✅ Data como número serial do Excel (e não texto)
      const d = parseAnyDate(row.productionDate);
      const excelDate = d ? excelDateSerial(d) : null;

      baseData.push([
        excelDate, // Data (n)
        formatCompetenciaDisplay(row.competencia),
        formatUnitName(row.unit),
        row.payer,
        formatConvenioName(row.convenio),
        paymentMethodDisplay,
        displayLabel(row.productionType),
        row.procedureName,
        row.patientName || "",
        parseBRNumber(row.quantity),
        parseBRNumber(row.unitValue),
        parseBRNumber(row.totalValue),
        formatSpecialtyName(row.specialty),
        row.status || "",
        row.importSource || "manual",
        row.importBatchId || "",
      ]);
    });
  }

  const wsBase = XLSX.utils.aoa_to_sheet(baseData);

  wsBase["!cols"] = [
    { wch: 14 }, // Data
    { wch: 12 }, // Competência
    { wch: 18 }, // Unidade
    { wch: 12 }, // Pagador
    { wch: 25 }, // Convênio
    { wch: 18 }, // Modo de Pagamento
    { wch: 18 }, // Tipo de Produção
    { wch: 35 }, // Procedimento
    { wch: 25 }, // Paciente
    { wch: 8 }, // Qtde
    { wch: 14 }, // Valor Unitário
    { wch: 14 }, // Valor Total
    { wch: 18 }, // Especialidade
    { wch: 12 }, // Status
    { wch: 10 }, // Origem
    { wch: 36 }, // Batch ID
  ];

  freezeHeader(wsBase, "A2");

  const baseLastRow = baseData.length;
  wsBase["!autofilter"] = { ref: `A1:P${baseLastRow}` };

  // ✅ Formatos
  applyDateFormat(wsBase, "A", 2, baseLastRow); // Data
  applyCurrencyFormat(wsBase, "K", 2, baseLastRow); // Valor Unitário
  applyCurrencyFormat(wsBase, "L", 2, baseLastRow); // Valor Total

  XLSX.utils.book_append_sheet(wb, wsBase, "Base_Producao");

  // =============================================================================
  // SHEET 3: RANKINGS_UNIDADE
  // =============================================================================
  if (data.unitRanking.length > 0) {
    const unitData: (string | number)[][] = [];
    unitData.push(["Unidade", "Quantidade", "Participação (%)", "Variação vs Anterior (%)"]);

    data.unitRanking.forEach((row) => {
      unitData.push([
        row.name,
        row.quantity,
        row.percentage / 100, // decimal
        row.variation !== null ? row.variation / 100 : ("N/A" as any),
      ]);
    });

    const wsUnit = XLSX.utils.aoa_to_sheet(unitData);
    wsUnit["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 22 }];
    freezeHeader(wsUnit, "A2");
    wsUnit["!autofilter"] = { ref: `A1:D${unitData.length}` };

    applyPercentFormat(wsUnit, "C", 2, unitData.length);
    applyPercentFormat(wsUnit, "D", 2, unitData.length);

    XLSX.utils.book_append_sheet(wb, wsUnit, "Rankings_Unidade");
  }

  // =============================================================================
  // SHEET 4: RANKINGS_ESPECIALIDADE
  // =============================================================================
  if (data.specialtyRanking && data.specialtyRanking.length > 0) {
    const specData: (string | number)[][] = [];
    specData.push(["Especialidade", "Quantidade", "Participação (%)"]);

    data.specialtyRanking.forEach((row) => {
      specData.push([row.name, row.quantity, row.percentage / 100]);
    });

    const wsSpec = XLSX.utils.aoa_to_sheet(specData);
    wsSpec["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }];
    freezeHeader(wsSpec, "A2");
    wsSpec["!autofilter"] = { ref: `A1:C${specData.length}` };

    applyPercentFormat(wsSpec, "C", 2, specData.length);

    XLSX.utils.book_append_sheet(wb, wsSpec, "Rankings_Especialidade");
  }

  // =============================================================================
  // SHEET 5: PROCEDIMENTOS
  // =============================================================================
  if (data.topProcedures.length > 0) {
    const procData: (string | number)[][] = [];
    procData.push(["Procedimento", "Código", "Quantidade", "Participação (%)"]);

    data.topProcedures.forEach((row) => {
      procData.push([row.name, row.code || "", row.quantity, row.percentage / 100]);
    });

    const wsProc = XLSX.utils.aoa_to_sheet(procData);
    wsProc["!cols"] = [{ wch: 45 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
    freezeHeader(wsProc, "A2");
    wsProc["!autofilter"] = { ref: `A1:D${procData.length}` };

    applyPercentFormat(wsProc, "D", 2, procData.length);

    XLSX.utils.book_append_sheet(wb, wsProc, "Procedimentos");
  }

  // =============================================================================
  // SHEET 6: EVOLUCAO
  // =============================================================================
  if (includeEvolution && data.evolutionData.length > 0) {
    const evoData: (string | number)[][] = [];
    evoData.push(["Data", "Quantidade"]);

    data.evolutionData.forEach((row) => {
      // Se row.dateLabel vier em dd/MM/yyyy, vira data real do Excel
      const d = parseAnyDate(row.dateLabel);
      evoData.push([d ? excelDateSerial(d) : row.dateLabel, row.total]);
    });

    const wsEvo = XLSX.utils.aoa_to_sheet(evoData);
    wsEvo["!cols"] = [{ wch: 15 }, { wch: 12 }];
    freezeHeader(wsEvo, "A2");
    wsEvo["!autofilter"] = { ref: `A1:B${evoData.length}` };

    applyDateFormat(wsEvo, "A", 2, evoData.length);

    XLSX.utils.book_append_sheet(wb, wsEvo, "Evolucao");
  }

  // =============================================================================
  // SHEET 7: CONSOLIDADA_COMPONENTES
  // =============================================================================
  if (includeConsolidated && data.consolidatedTable.length > 0) {
    const consData: (string | number)[][] = [];
    consData.push(["Componente", "Unidade", "Convênio", "Especialidade", "Quantidade", "Participação (%)"]);

    data.consolidatedTable.forEach((row) => {
      consData.push([
        displayLabel(row.productionType),
        formatUnitName(row.unit),
        formatConvenioName(row.convenio),
        formatSpecialtyName(row.specialty),
        row.quantity,
        row.percentage / 100,
      ]);
    });

    const wsCons = XLSX.utils.aoa_to_sheet(consData);
    wsCons["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];
    freezeHeader(wsCons, "A2");
    wsCons["!autofilter"] = { ref: `A1:F${consData.length}` };

    applyPercentFormat(wsCons, "F", 2, consData.length);

    XLSX.utils.book_append_sheet(wb, wsCons, "Consolidada_Componentes");
  }

  // =============================================================================
  // SHEET 8: PENDENCIAS_OPERACIONAIS
  // =============================================================================
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    const pendData: (string | number)[][] = [];
    pendData.push(["Data", "Competência", "Unidade", "Convênio", "Tipo", "Quantidade", "Idade_Dias", "Status"]);

    data.unbilledProductions.forEach((p: any) => {
      const prodDate = parseISO(p.productionDate);
      const ageDays = differenceInDays(now, prodDate);

      pendData.push([
        excelDateSerial(prodDate), // ✅ data real do Excel
        formatCompetenciaDisplay(p.competencia),
        formatUnitName(p.unit),
        formatConvenioName(p.convenio),
        displayLabel(p.productionType),
        p.quantity,
        ageDays,
        "Pendente",
      ]);
    });

    const wsPend = XLSX.utils.aoa_to_sheet(pendData);

    wsPend["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    freezeHeader(wsPend, "A2");
    wsPend["!autofilter"] = { ref: `A1:H${pendData.length}` };

    applyDateFormat(wsPend, "A", 2, pendData.length);

    XLSX.utils.book_append_sheet(wb, wsPend, "Pendencias_Operacionais");
  }

  // =============================================================================
  // Filename + write
  // =============================================================================
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  const unitSuffix = data.selectedUnit === "all" ? "Todas" : formatUnitName(data.selectedUnit).replace(/\s+/g, "_");
  const filename = `Relatorio_Producao_EXEC_${startStr}_a_${endStr}_${unitSuffix}.xlsx`;

  XLSX.writeFile(wb, filename);
}
