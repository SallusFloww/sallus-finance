/**
 * Export Utilities - Professional PDF/Excel exports
 * SallusFlow - v1.0.0
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Export metadata for professional headers/footers
export interface ExportMetadata {
  companyName: string;
  reportName: string;
  userName: string;
  generatedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
  filters?: Record<string, string>;
}

// Generate standard header info
export function getExportHeader(metadata: ExportMetadata): string[] {
  const lines = [
    metadata.companyName,
    metadata.reportName,
    `Gerado por: ${metadata.userName}`,
    `Data/Hora: ${format(metadata.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
  ];

  if (metadata.periodStart && metadata.periodEnd) {
    lines.push(
      `Período: ${format(metadata.periodStart, "dd/MM/yyyy")} a ${format(metadata.periodEnd, "dd/MM/yyyy")}`
    );
  }

  return lines;
}

// Generate standard footer info
export function getExportFooter(systemName: string = "SallusFlow"): {
  systemName: string;
  disclaimer: string;
  pageFormat: (current: number, total: number) => string;
} {
  return {
    systemName,
    disclaimer: "Uso exclusivo para fins gerenciais.",
    pageFormat: (current: number, total: number) => `Página ${current} de ${total}`,
  };
}

// Format currency for exports
export function formatExportCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format percentage for exports
export function formatExportPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

// Format date for exports
export function formatExportDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

// Check if user can export based on role
export type ExportPermissionLevel = "admin" | "gestor" | "leitor";

export function canExport(
  userRole: string,
  exportType: "all" | "reports" | "data"
): boolean {
  const normalizedRole = userRole.toLowerCase();

  // Admin can export everything
  if (normalizedRole === "admin") return true;

  // Gestor can export reports only
  if (normalizedRole === "gestor" && (exportType === "reports" || exportType === "data")) {
    return true;
  }

  // Leitor cannot export
  return false;
}

// Export error messages (user-friendly, no technical details)
export const EXPORT_ERRORS = {
  GENERIC: "Não foi possível gerar o relatório. Tente novamente em alguns minutos.",
  TIMEOUT: "A geração do relatório demorou mais que o esperado. Tente com um período menor.",
  NO_DATA: "Não há dados disponíveis para exportar com os filtros selecionados.",
  PERMISSION: "Você não tem permissão para exportar este relatório.",
  FILE_ERROR: "Erro ao salvar o arquivo. Verifique suas permissões de download.",
} as const;

// Safe export wrapper with error handling
export async function safeExport<T>(
  exportFn: () => Promise<T> | T,
  onError?: (error: Error) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    await exportFn();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (onError && error instanceof Error) {
      onError(error);
    }
    
    // Return user-friendly message
    if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
      return { success: false, error: EXPORT_ERRORS.TIMEOUT };
    }
    
    return { success: false, error: EXPORT_ERRORS.GENERIC };
  }
}

// Generate filename with timestamp
export function generateExportFilename(
  baseName: string,
  extension: "pdf" | "xlsx",
  includeTimestamp: boolean = true
): string {
  const sanitized = baseName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  
  if (includeTimestamp) {
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
    return `${sanitized}_${timestamp}.${extension}`;
  }
  
  return `${sanitized}.${extension}`;
}
