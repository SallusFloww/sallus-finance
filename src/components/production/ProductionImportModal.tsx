import { useState, useCallback, useMemo, useRef } from "react";
import { format, parse, isValid, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";

interface ProductionImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportContext {
  production_type: string;
  unit: string;
  competencia: string; // YYYY-MM
  payer_type: "CONVENIO" | "PARTICULAR";
  convenio: string;
}

interface ParsedRow {
  rowNumber: number;
  raw: { [key: string]: string };
  production_date: string | null;
  unit_value: number | null;
  paciente_nome: string;
  isValid: boolean;
  errors: string[];
}

type Step = "context" | "upload";

const TEMPLATE_CSV = `data_producao,valor_unitario,paciente_nome
2025-01-15,150.00,João Silva
2025-01-16,200.50,Maria Santos
2025-01-17,175,`;

export function ProductionImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: ProductionImportModalProps) {
  const { currentCompany } = useAuth();
  const { settings, extendedSettings } = useCompanySettings();
  const { refreshAll } = useGlobalRealtime();

  // Extract units, productionTypes, payers from settings
  const units = settings.units || [];
  const productionTypes = extendedSettings.productionTypes || [];
  const payers = extendedSettings.payers || [];

  const [step, setStep] = useState<Step>("context");
  const [isImporting, setIsImporting] = useState(false);

  // ✅ PROTEÇÃO 4A: Ref para evitar clique duplo
  const importingRef = useRef(false);

  // Context state
  const [context, setContext] = useState<ImportContext>({
    production_type: "",
    unit: "",
    competencia: format(new Date(), "yyyy-MM"),
    payer_type: "CONVENIO",
    convenio: "",
  });

  // Upload state
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Generate competencia options (last 12 months + next 2)
  const competenciaOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -12; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MM/yyyy"),
      });
    }
    return options.reverse();
  }, []);

  // Summary stats
  const summary = useMemo(() => {
    const valid = parsedRows.filter((r) => r.isValid);
    const invalid = parsedRows.filter((r) => !r.isValid);
    const totalValue = valid.reduce((sum, r) => sum + (r.unit_value || 0), 0);
    const dates = valid
      .map((r) => r.production_date)
      .filter((d): d is string => d !== null)
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      total: parsedRows.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      totalValue,
      minDate: dates[0] ? format(dates[0], "dd/MM/yyyy") : "-",
      maxDate: dates[dates.length - 1] ? format(dates[dates.length - 1], "dd/MM/yyyy") : "-",
    };
  }, [parsedRows]);

  const isContextValid = useMemo(() => {
    if (!context.production_type || !context.unit || !context.competencia) return false;
    if (context.payer_type === "CONVENIO" && !context.convenio) return false;
    return true;
  }, [context]);

  // Parse date from various formats
  const parseDate = useCallback(
    (value: string): { date: Date | null; formatted: string | null } => {
      if (!value || !value.trim()) return { date: null, formatted: null };

      const trimmed = value.trim();

      // Try YYYY-MM-DD
      let parsed = parse(trimmed, "yyyy-MM-dd", new Date());
      if (isValid(parsed)) {
        return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
      }

      // Try DD/MM/YYYY
      parsed = parse(trimmed, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
      }

      return { date: null, formatted: null };
    },
    []
  );

  // Parse numeric value
  const parseValue = useCallback((value: string): number | null => {
    if (!value || !value.trim()) return null;
    // Replace comma with dot, remove spaces
    const normalized = value.trim().replace(",", ".").replace(/\s/g, "");
    const num = parseFloat(normalized);
    if (isNaN(num) || num <= 0) return null;
    return num;
  }, []);

  // Validate row against competencia
  const validateRow = useCallback(
    (
      rawRow: { [key: string]: string },
      rowNumber: number
    ): ParsedRow => {
      const errors: string[] = [];

      // Parse date
      const dateStr = rawRow["data_producao"] || rawRow["data_produção"] || "";
      const { date, formatted: production_date } = parseDate(dateStr);

      if (!production_date) {
        errors.push("Data inválida");
      } else if (date) {
        // Check if date is within competencia
        const [year, month] = context.competencia.split("-").map(Number);
        const competenciaStart = startOfMonth(new Date(year, month - 1));
        const competenciaEnd = endOfMonth(new Date(year, month - 1));

        if (!isWithinInterval(date, { start: competenciaStart, end: competenciaEnd })) {
          errors.push(`Fora da competência ${format(competenciaStart, "MM/yyyy")}`);
        }
      }

      // Parse value
      const valueStr = rawRow["valor_unitario"] || rawRow["valor_unitário"] || "";
      const unit_value = parseValue(valueStr);

      if (unit_value === null) {
        errors.push("Valor inválido");
      }

      // Paciente is optional
      const paciente_nome = (rawRow["paciente_nome"] || rawRow["paciente"] || "").trim();

      return {
        rowNumber,
        raw: rawRow,
        production_date,
        unit_value,
        paciente_nome,
        isValid: errors.length === 0,
        errors,
      };
    },
    [context.competencia, parseDate, parseValue]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) {
          toast.error("Erro ao ler arquivo");
          return;
        }

        // Parse CSV
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
          toast.error("CSV deve ter cabeçalho e ao menos uma linha de dados");
          return;
        }

        // Parse header
        const headerLine = lines[0];
        const headers = headerLine.split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/[""]/g, ""));

        // Validate required headers
        const hasDate = headers.some((h) => h.includes("data"));
        const hasValue = headers.some((h) => h.includes("valor"));

        if (!hasDate || !hasValue) {
          toast.error("CSV deve conter colunas: data_producao, valor_unitario");
          return;
        }

        // Parse data rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(/[,;]/).map((v) => v.trim().replace(/[""]/g, ""));
          const rawRow: { [key: string]: string } = {};

          headers.forEach((header, idx) => {
            rawRow[header] = values[idx] || "";
          });

          rows.push(validateRow(rawRow, i));
        }

        setParsedRows(rows);
      };

      reader.readAsText(file, "UTF-8");
    },
    [validateRow]
  );

  // Download template
  const downloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao_producao.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // Import productions
  const handleImport = useCallback(async () => {
    // ✅ PROTEÇÃO 4A: Evitar clique duplo via ref
    if (importingRef.current) {
      toast.warning("Importação já em andamento...");
      return;
    }

    if (!currentCompany?.id) {
      toast.error("Empresa não selecionada");
      return;
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    importingRef.current = true;
    setIsImporting(true);

    try {
      const rowsToInsert = validRows.map((r) => ({
        production_date: r.production_date,
        unit_value: r.unit_value,
        paciente_nome: r.paciente_nome || null,
      }));

      // ✅ PROTEÇÃO 3: Garantir competência como YYYY-MM
      let competenciaFormatted = context.competencia;
      // Se veio como MM/YYYY, converter
      if (/^\d{2}\/\d{4}$/.test(competenciaFormatted)) {
        competenciaFormatted = competenciaFormatted.slice(3) + "-" + competenciaFormatted.slice(0, 2);
      }

      // Convert context to plain object for JSON serialization
      const contextForRpc = {
        production_type: context.production_type,
        unit: context.unit,
        competencia: competenciaFormatted,
        payer_type: context.payer_type,
        convenio: context.convenio || null,
      };

      const { data, error } = await supabase.rpc("import_productions_batch", {
        _company_id: currentCompany.id,
        _context: contextForRpc,
        _file_name: fileName || null,
        _rows: rowsToInsert,
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        imported_count?: number; 
        invalid_count?: number;
        total_value?: number; 
        error?: string;
        errors?: Array<{ row: number; error: string }>;
      };

      if (!result.success) {
        throw new Error(result.error || "Erro na importação");
      }

      // Mostrar resumo com linhas inválidas se houver
      const invalidMsg = result.invalid_count && result.invalid_count > 0 
        ? ` | ${result.invalid_count} linha(s) rejeitada(s)` 
        : "";

      toast.success(
        `Importação concluída: ${result.imported_count} produções criadas | Total ${formatCurrency(result.total_value || 0)}${invalidMsg}`
      );

      // ✅ Atualizar lista sem F5
      refreshAll();

      onImportComplete();
      // Reset state and close
      setStep("context");
      setContext({
        production_type: "",
        unit: "",
        competencia: format(new Date(), "yyyy-MM"),
        payer_type: "CONVENIO",
        convenio: "",
      });
      setFileName("");
      setParsedRows([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error(err.message || "Erro ao importar produções");
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  }, [currentCompany?.id, parsedRows, context, fileName, onImportComplete, refreshAll, onOpenChange]);

  // Reset and close
  const handleClose = useCallback(() => {
    setStep("context");
    setContext({
      production_type: "",
      unit: "",
      competencia: format(new Date(), "yyyy-MM"),
      payer_type: "CONVENIO",
      convenio: "",
    });
    setFileName("");
    setParsedRows([]);
    onOpenChange(false);
  }, [onOpenChange]);

  // Get payer name for display
  const getPayerName = useCallback(
    (id: string) => {
      const payer = payers.find((p) => p.id === id);
      return payer?.name || id;
    },
    [payers]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Produções via CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Badge variant={step === "context" ? "default" : "secondary"}>1. Contexto</Badge>
          <span>→</span>
          <Badge variant={step === "upload" ? "default" : "secondary"}>2. Upload</Badge>
        </div>

        {step === "context" && (
          <div className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Defina o contexto do lote. Todas as linhas do CSV herdarão essas informações.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Produção *</Label>
                <Select
                  value={context.production_type}
                  onValueChange={(v) => setContext((c) => ({ ...c, production_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select
                  value={context.unit}
                  onValueChange={(v) => setContext((c) => ({ ...c, unit: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.filter((u) => u.active !== false).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Competência *</Label>
                <Select
                  value={context.competencia}
                  onValueChange={(v) => setContext((c) => ({ ...c, competencia: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciaOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pagador *</Label>
                <Select
                  value={context.payer_type}
                  onValueChange={(v) => setContext((c) => ({ ...c, payer_type: v as "CONVENIO" | "PARTICULAR", convenio: v === "PARTICULAR" ? "" : c.convenio }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONVENIO">Convênio</SelectItem>
                    <SelectItem value="PARTICULAR">Particular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {context.payer_type === "CONVENIO" && (
                <div className="space-y-2 col-span-2">
                  <Label>Convênio *</Label>
                  <Select
                    value={context.convenio}
                    onValueChange={(v) => setContext((c) => ({ ...c, convenio: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o convênio..." />
                    </SelectTrigger>
                    <SelectContent>
                      {payers.map((payer) => (
                        <SelectItem key={payer.id} value={payer.id}>
                          {payer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("upload")} disabled={!isContextValid}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Context summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="font-medium mb-1">Contexto do Lote:</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  Tipo: <strong>{productionTypes.find((t) => t.id === context.production_type)?.name}</strong>
                </span>
                <span>
                  Unidade: <strong>{units.find((u) => u.id === context.unit)?.name}</strong>
                </span>
                <span>
                  Competência: <strong>{context.competencia.split("-").reverse().join("/")}</strong>
                </span>
                <span>
                  Pagador:{" "}
                  <strong>
                    {context.payer_type === "PARTICULAR" ? "Particular" : getPayerName(context.convenio)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Upload area */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="csv-upload" className="sr-only">
                  Arquivo CSV
                </Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Baixar modelo CSV
              </Button>
            </div>

            {/* Summary */}
            {parsedRows.length > 0 && (
              <>
                <Separator />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Total de linhas</div>
                    <div className="font-semibold">{summary.total}</div>
                  </div>
                  <div className="bg-green-500/10 rounded p-2">
                    <div className="text-green-600 text-xs">Válidas</div>
                    <div className="font-semibold text-green-600">{summary.validCount}</div>
                  </div>
                  <div className="bg-destructive/10 rounded p-2">
                    <div className="text-destructive text-xs">Inválidas</div>
                    <div className="font-semibold text-destructive">{summary.invalidCount}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Total (válidas)</div>
                    <div className="font-semibold">{formatCurrency(summary.totalValue)}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Menor data</div>
                    <div className="font-semibold">{summary.minDate}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Maior data</div>
                    <div className="font-semibold">{summary.maxDate}</div>
                  </div>
                </div>

                {/* Preview table */}
                <ScrollArea className="flex-1 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row) => (
                        <TableRow key={row.rowNumber} className={row.isValid ? "" : "bg-destructive/5"}>
                          <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                          <TableCell>
                            {row.production_date
                              ? format(new Date(row.production_date), "dd/MM/yyyy")
                              : row.raw["data_producao"] || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.unit_value !== null ? formatCurrency(row.unit_value) : row.raw["valor_unitario"] || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.paciente_nome || "-"}</TableCell>
                          <TableCell>
                            {row.isValid ? (
                              <Badge variant="outline" className="text-green-600 border-green-600/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <X className="h-3 w-3 mr-1" />
                                {row.errors.join(", ")}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            {/* No valid rows warning */}
            {parsedRows.length > 0 && summary.validCount === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma linha válida para importar. Corrija os erros no CSV e tente novamente.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("context")}>
                ← Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || summary.validCount === 0}
                >
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Importar {summary.validCount > 0 && `(${summary.validCount})`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
