/**
 * Production Report Excel Export - Pivot-Ready Version
 * Multi-sheet XLSX with Base_Producao as the main pivot-ready sheet
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

// ===== Excel numeric helpers (BR currency safe) =====
function parseBRNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v ?? "").trim();
  if (!s) return 0;

  // "1.234,56" -> "1234.56"
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function applyCurrencyFormat(ws: XLSX.WorkSheet, colLetter: string, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    const addr = `${colLetter}${r}`;
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;

    // Force numeric type
    cell.v = parseBRNumber(cell.v);
    cell.t = "n";

    // Currency mask (pt-BR friendly)
    (cell as any).z = '"R$" #,##0.00';
  }
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

// Format competencia from YYYY-MM to MM/YYYY
function formatCompetenciaDisplay(competencia: string | null | undefined): string {
  if (!competencia) return "";
  const parts = competencia.split("-");
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return competencia;
}

// Format date from YYYY-MM-DD to DD/MM/YYYY
function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

// Format payment method (centralized list for PARTICULAR)
function formatPaymentMethodDisplay(paymentMethod: string | null | undefined): string {
  const raw = (paymentMethod || "").trim();
  if (!raw) return "Não informado";

  // If it matches known list, keep standardized label; otherwise keep as-is
  const found = (PAYMENT_METHODS_PARTICULAR as any)?.find(
    (m: any) => (m?.value || m) === raw || (m?.label || m) === raw,
  );
  if (found) return (found.label || found.value || raw) as string;

  return raw;
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

  summaryRows.push(["RELATÓRIO GERENCIAL DE PRODUÇÃO"]);
  summaryRows.push([""]);
  summaryRows.push(["METADADOS"]);
  summaryRows.push([
    "Período",
    `${format(parseISO(data.startDate), "dd/MM/yyyy")} a ${format(parseISO(data.endDate), "dd/MM/yyyy")}`,
  ]);
  summaryRows.push(["Duração", `${periodDays} dias`]);
  summaryRows.push(["Unidade", data.selectedUnit === "all" ? "Todas" : formatUnitName(data.selectedUnit)]);
  summaryRows.push(["Convênio", data.selectedConvenio === "all" ? "Todos" : data.selectedConvenio]);
  summaryRows.push(["Tipo", data.selectedType === "all" ? "Todos" : data.selectedType]);
  summaryRows.push(["Especialidade", data.selectedSpecialty === "all" ? "Todas" : data.selectedSpecialty]);
  summaryRows.push(["Data de Geração", format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })]);
  summaryRows.push([""]);

  // KPIs (same 4 as PDF)
  summaryRows.push(["INDICADORES PRINCIPAIS"]);
  summaryRows.push(["Indicador", "Valor"]);
  summaryRows.push(["Produção Total", data.totalQuantity]);
  summaryRows.push([
    "Unidade Destaque",
    data.topUnit ? `${data.topUnit.name} (${formatPercent(data.topUnit.percentage)})` : "-",
  ]);
  summaryRows.push([
    "Especialidade Destaque",
    topSpec ? `${topSpec.name} (${formatPercent(topSpec.percentage)})` : "-",
  ]);
  summaryRows.push(["Mix Principal", topMix ? `${topMix.label} (${formatPercent(topMix.percentage)})` : "-"]);
  summaryRows.push([""]);

  // Top 5 tables
  summaryRows.push(["TOP 5 UNIDADES"]);
  summaryRows.push(["Unidade", "Quantidade", "%"]);
  data.unitRanking.slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["TOP 5 ESPECIALIDADES"]);
  summaryRows.push(["Especialidade", "Quantidade", "%"]);
  (data.specialtyRanking || []).slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["TOP 5 PROCEDIMENTOS"]);
  summaryRows.push(["Procedimento", "Quantidade", "%"]);
  data.topProcedures.slice(0, 5).forEach((row) => {
    summaryRows.push([row.name, row.quantity, formatPercent(row.percentage)]);
  });
  summaryRows.push([""]);

  summaryRows.push(["OBSERVAÇÃO"]);
  summaryRows.push(["Relatório gerencial de produção. Não representa faturamento, caixa ou contas a receber."]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // ===== SHEET 2: BASE_PRODUCAO (Main Pivot-Ready Sheet - RAW PRODUCTIONS) =====
  const baseData: (string | number | null)[][] = [];

  // Header row with all required columns
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

  // Build from rawProductions
  if (data.rawProductions && data.rawProductions.length > 0) {
    data.rawProductions.forEach((row: any) => {
      const paymentMethodDisplay = row.payer === "PARTICULAR" ? formatPaymentMethodDisplay(row.paymentMethod) : "";

      baseData.push([
        formatDateDisplay(row.productionDate),
        formatCompetenciaDisplay(row.competencia),
        formatUnitName(row.unit),
        row.payer,
        formatConvenioName(row.convenio),
        paymentMethodDisplay,
        displayLabel(row.productionType),
        row.procedureName,
        row.patientName || "",
        row.quantity,
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

  // Column widths for 16 columns
  wsBase["!cols"] = [
    { wch: 12 }, // Data
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

  // Freeze header row
  wsBase["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Add autofilter
  const baseLastRow = baseData.length;
  wsBase["!autofilter"] = { ref: `A1:P${baseLastRow}` };

  // Apply currency format: K (Valor Unitário) and L (Valor Total)
  applyCurrencyFormat(wsBase, "K", 2, baseLastRow);
  applyCurrencyFormat(wsBase, "L", 2, baseLastRow);

  XLSX.utils.book_append_sheet(wb, wsBase, "Base_Producao");

  // ===== SHEET 3: RANKINGS_UNIDADE =====
  if (data.unitRanking.length > 0) {
    const unitData: (string | number)[][] = [];
    unitData.push(["Unidade", "Quantidade", "Participação (%)", "Variação vs Anterior (%)"]);

    data.unitRanking.forEach((row) => {
      unitData.push([
        row.name,
        row.quantity,
        row.percentage / 100, // decimal for percentage
        row.variation !== null ? row.variation / 100 : ("N/A" as any),
      ]);
    });

    const wsUnit = XLSX.utils.aoa_to_sheet(unitData);
    wsUnit["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 22 }];
    wsUnit["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsUnit["!autofilter"] = { ref: `A1:D${unitData.length}` };
    XLSX.utils.book_append_sheet(wb, wsUnit, "Rankings_Unidade");
  }

  // ===== SHEET 4: RANKINGS_ESPECIALIDADE =====
  if (data.specialtyRanking && data.specialtyRanking.length > 0) {
    const specData: (string | number)[][] = [];
    specData.push(["Especialidade", "Quantidade", "Participação (%)"]);

    data.specialtyRanking.forEach((row) => {
      specData.push([row.name, row.quantity, row.percentage / 100]);
    });

    const wsSpec = XLSX.utils.aoa_to_sheet(specData);
    wsSpec["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }];
    wsSpec["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsSpec["!autofilter"] = { ref: `A1:C${specData.length}` };
    XLSX.utils.book_append_sheet(wb, wsSpec, "Rankings_Especialidade");
  }

  // ===== SHEET 5: PROCEDIMENTOS =====
  if (data.topProcedures.length > 0) {
    const procData: (string | number)[][] = [];
    procData.push(["Procedimento", "Código", "Quantidade", "Participação (%)"]);

    data.topProcedures.forEach((row) => {
      procData.push([row.name, row.code || "", row.quantity, row.percentage / 100]);
    });

    const wsProc = XLSX.utils.aoa_to_sheet(procData);
    wsProc["!cols"] = [{ wch: 45 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
    wsProc["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsProc["!autofilter"] = { ref: `A1:D${procData.length}` };
    XLSX.utils.book_append_sheet(wb, wsProc, "Procedimentos");
  }

  // ===== SHEET 6: EVOLUCAO =====
  if (includeEvolution && data.evolutionData.length > 0) {
    const evoData: (string | number)[][] = [];
    evoData.push(["Data", "Quantidade"]);

    data.evolutionData.forEach((row) => {
      evoData.push([row.dateLabel, row.total]);
    });

    const wsEvo = XLSX.utils.aoa_to_sheet(evoData);
    wsEvo["!cols"] = [{ wch: 15 }, { wch: 12 }];
    wsEvo["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsEvo["!autofilter"] = { ref: `A1:B${evoData.length}` };
    XLSX.utils.book_append_sheet(wb, wsEvo, "Evolucao");
  }

  // ===== SHEET 7: CONSOLIDADA_COMPONENTES =====
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
        row.percentage / 100, // decimal for percentage format
      ]);
    });

    const wsCons = XLSX.utils.aoa_to_sheet(consData);
    wsCons["!cols"] = [
      { wch: 18 }, // Componente
      { wch: 18 }, // Unidade
      { wch: 25 }, // Convênio
      { wch: 18 }, // Especialidade
      { wch: 12 }, // Quantidade
      { wch: 16 }, // Participação
    ];
    wsCons["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsCons["!autofilter"] = { ref: `A1:F${consData.length}` };
    XLSX.utils.book_append_sheet(wb, wsCons, "Consolidada_Componentes");
  }

  // ===== SHEET 8: PENDENCIAS_OPERACIONAIS =====
  if (includeUnbilled && data.unbilledProductions.length > 0) {
    const pendData: (string | number)[][] = [];
    pendData.push(["Data", "Competência", "Unidade", "Convênio", "Tipo", "Quantidade", "Idade_Dias", "Status"]);

    data.unbilledProductions.forEach((p: any) => {
      const prodDate = parseISO(p.productionDate);
      const ageDays = differenceInDays(now, prodDate);

      pendData.push([
        formatDateDisplay(p.productionDate),
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
      { wch: 12 }, // Data
      { wch: 12 }, // Competência
      { wch: 18 }, // Unidade
      { wch: 25 }, // Convênio
      { wch: 18 }, // Tipo
      { wch: 12 }, // Quantidade
      { wch: 12 }, // Idade_Dias
      { wch: 12 }, // Status
    ];

    wsPend["!freeze"] = { xSplit: 0, ySplit: 1 };
    wsPend["!autofilter"] = { ref: `A1:H${pendData.length}` };

    XLSX.utils.book_append_sheet(wb, wsPend, "Pendencias_Operacionais");
  }

  // Generate filename with EXEC suffix
  const startStr = format(parseISO(data.startDate), "yyyy-MM-dd");
  const endStr = format(parseISO(data.endDate), "yyyy-MM-dd");
  const unitSuffix = data.selectedUnit === "all" ? "Todas" : formatUnitName(data.selectedUnit).replace(/\s+/g, "_");
  const filename = `Relatorio_Producao_EXEC_${startStr}_a_${endStr}_${unitSuffix}.xlsx`;

  // Write and download
  XLSX.writeFile(wb, filename);
}
