/**
 * Production Report Export - Premium PDF + Excel Export
 * Non-breaking: Uses only existing data from the report state
 */

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Production } from "@/types";
import { exportProductionReportToExcel } from "@/utils/productionExcelExport";

// Types for export data
export interface ProductionReportExportData {
  // Metadata
  startDate: string;
  endDate: string;
  selectedUnit: string;
  selectedConvenio: string;
  selectedType: string;
  selectedSpecialty: string;
  
  // Core data
  totalQuantity: number;
  previousTotalQuantity: number;
  variationPercent: number;
  variationAbsolute: number;
  isSmallSample: boolean;
  
  // Rankings
  unitRanking: Array<{ name: string; quantity: number; percentage: number; variation: number | null }>;
  specialtyRanking: Array<{ name: string; quantity: number; percentage: number }>;
  typeBreakdown: Array<{ type: string; label: string; quantity: number; percentage: number }>;
  convenioRanking: Array<{ name: string; quantity: number; percentage: number; riskLevel: string }>;
  topProcedures: Array<{ name: string; code?: string; quantity: number; percentage: number }>;
  
  // Time series
  evolutionData: Array<{ date: string; dateLabel: string; total: number }>;
  
  // Consolidated table
  consolidatedTable: Array<{
    productionType: string;
    unit: string;
    specialty: string;
    convenio: string;
    quantity: number;
    percentage: number;
  }>;
  
  // Unbilled items
  unbilledProductions: Production[];
  
  // Top unit/convenio
  topUnit: { name: string; quantity: number; percentage: number } | null;
  topConvenio: { name: string; quantity: number; percentage: number } | null;
  topProcedure: { name: string; quantity: number; percentage: number } | null;
  
  // Raw productions for Base_Producao sheet (line-by-line export)
  rawProductions: Array<{
    productionDate: string;        // YYYY-MM-DD
    competencia: string;           // YYYY-MM (interno)
    unit: string;
    payer: string;                 // PARTICULAR/CONVENIO
    convenio?: string | null;
    productionType: string;
    procedureName: string;         // description
    patientName?: string | null;
    quantity: number;
    unitValue: number;
    totalValue: number;
    specialty?: string | null;
    status?: string;
    importSource?: string;         // manual/import
    importBatchId?: string | null;
  }>;
}

interface ProductionReportExportProps {
  data: ProductionReportExportData;
  disabled?: boolean;
}

export function ProductionReportExport({ data, disabled = false }: ProductionReportExportProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"pdf" | "excel">("excel");
  
  // Export options
  const [includeEvolution, setIncludeEvolution] = useState(true);
  const [includeConsolidated, setIncludeConsolidated] = useState(true);
  const [includeUnbilled, setIncludeUnbilled] = useState(true);

  const openExportModal = (type: "pdf" | "excel") => {
    setExportType(type);
    setIsModalOpen(true);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      exportProductionReportToExcel({
        data,
        includeEvolution,
        includeConsolidated,
        includeUnbilled,
      });
      toast.success("Relatório Excel exportado com sucesso!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar relatório. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Dynamic import to reduce bundle size
      const { generateProductionReportPDF } = await import("@/utils/productionPdfExport");
      await generateProductionReportPDF({
        data,
        includeEvolution,
        includeConsolidated,
        includeUnbilled,
      });
      toast.success("Relatório PDF exportado com sucesso!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("PDF Export error:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportType === "pdf") {
      handleExportPDF();
    } else {
      handleExportExcel();
    }
  };

  // Format filter display
  const formatFilter = (value: string, defaultLabel: string) => {
    if (!value || value === "all") return defaultLabel;
    return value;
  };

  const filtersDisplay = [
    { label: "Período", value: `${format(new Date(data.startDate), "dd/MM/yyyy")} a ${format(new Date(data.endDate), "dd/MM/yyyy")}` },
    { label: "Unidade", value: formatFilter(data.selectedUnit, "Todas") },
    { label: "Convênio", value: formatFilter(data.selectedConvenio, "Todos") },
    { label: "Tipo", value: formatFilter(data.selectedType, "Todos") },
    { label: "Especialidade", value: formatFilter(data.selectedSpecialty, "Todas") },
  ];

  const unbilledCount = data.unbilledProductions.length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || data.totalQuantity === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openExportModal("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar PDF (A4)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openExportModal("excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {exportType === "pdf" ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              )}
              Exportar Relatório
            </DialogTitle>
            <DialogDescription>
              Configure as opções de exportação do Relatório Gerencial de Produção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current filters display */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Filtros Aplicados
              </div>
              <div className="flex flex-wrap gap-2">
                {filtersDisplay.map((filter) => (
                  <Badge key={filter.label} variant="secondary" className="text-xs">
                    {filter.label}: {filter.value}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>

            <Separator />

            {/* Export options */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Incluir no relatório:</div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="evolution"
                    checked={includeEvolution}
                    onCheckedChange={(checked) => setIncludeEvolution(checked === true)}
                  />
                  <Label htmlFor="evolution" className="text-sm font-normal cursor-pointer">
                    Gráfico de evolução no tempo
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="consolidated"
                    checked={includeConsolidated}
                    onCheckedChange={(checked) => setIncludeConsolidated(checked === true)}
                  />
                  <Label htmlFor="consolidated" className="text-sm font-normal cursor-pointer">
                    Tabela consolidada completa
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unbilled"
                    checked={includeUnbilled}
                    onCheckedChange={(checked) => setIncludeUnbilled(checked === true)}
                    disabled={unbilledCount === 0}
                  />
                  <Label 
                    htmlFor="unbilled" 
                    className={`text-sm font-normal cursor-pointer ${unbilledCount === 0 ? "text-muted-foreground" : ""}`}
                  >
                    Pendências operacionais
                    {unbilledCount > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {unbilledCount} itens
                      </Badge>
                    )}
                  </Label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
              <strong>Total de produções:</strong> {data.totalQuantity.toLocaleString("pt-BR")}
              {data.variationPercent !== 0 && (
                <span className={data.variationPercent >= 0 ? "text-green-600" : "text-red-600"}>
                  {" "}({data.variationPercent >= 0 ? "+" : ""}{data.variationPercent.toFixed(1)}% vs anterior)
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isExporting}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  {exportType === "pdf" ? (
                    <FileText className="h-4 w-4 mr-2" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  {exportType === "pdf" ? "Gerar PDF" : "Baixar Excel"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
