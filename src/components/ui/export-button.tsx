import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useExportPermission, ExportType } from "@/hooks/useExportPermission";
import { useAuditLogDB } from "@/hooks/useAuditLogDB";
import { safeExport, EXPORT_ERRORS } from "@/utils/exportUtils";

interface ExportButtonProps {
  onExportPDF?: () => Promise<void> | void;
  onExportExcel?: () => Promise<void> | void;
  reportName: string;
  exportType?: ExportType;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  filters?: Record<string, string>;
}

export function ExportButton({
  onExportPDF,
  onExportExcel,
  reportName,
  exportType = "reports",
  disabled = false,
  variant = "outline",
  size = "sm",
  className = "",
  filters,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { checkExportPermission } = useExportPermission();
  const { logExportPDF, logExportExcel } = useAuditLogDB();

  const hasPermission = checkExportPermission(exportType);

  // Don't render if no permission
  if (!hasPermission) {
    return null;
  }

  const handleExportPDF = async () => {
    if (!onExportPDF || isExporting) return;

    setIsExporting(true);
    const result = await safeExport(async () => {
      await onExportPDF();
      // Log the export action
      logExportPDF(reportName, filters);
    });

    setIsExporting(false);

    if (result.success) {
      toast.success("Relatório PDF exportado com sucesso!");
    } else {
      toast.error(result.error || EXPORT_ERRORS.GENERIC);
    }
  };

  const handleExportExcel = async () => {
    if (!onExportExcel || isExporting) return;

    setIsExporting(true);
    const result = await safeExport(async () => {
      await onExportExcel();
      // Log the export action
      logExportExcel(reportName, filters);
    });

    setIsExporting(false);

    if (result.success) {
      toast.success("Relatório Excel exportado com sucesso!");
    } else {
      toast.error(result.error || EXPORT_ERRORS.GENERIC);
    }
  };

  // If only one export type is available
  if (onExportPDF && !onExportExcel) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled || isExporting}
        onClick={handleExportPDF}
        className={className}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        {isExporting ? "Exportando..." : "Exportar PDF"}
      </Button>
    );
  }

  if (onExportExcel && !onExportPDF) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled || isExporting}
        onClick={handleExportExcel}
        className={className}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        {isExporting ? "Exportando..." : "Exportar Excel"}
      </Button>
    );
  }

  // Dropdown for multiple export options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isExporting ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportPDF && (
          <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar PDF
          </DropdownMenuItem>
        )}
        {onExportExcel && (
          <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
