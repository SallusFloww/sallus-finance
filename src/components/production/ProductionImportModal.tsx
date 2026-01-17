import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { format, parse, isValid, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, X, Loader2, AlertTriangle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";
import { PRODUCTION_TYPE_LABELS } from "@/utils/constants";
import { BASE_PRODUCTION_TYPES } from "@/types";

// ============= TYPES =============
interface ProductionImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportContext {
  production_type: string;
  unit: string;
  competencia: string; // YYYY-MM interno
  payer_type: "CONVENIO" | "PARTICULAR";
  convenio: string;
  payment_method: string;
}

type RowStatus = "OK" | "ERRO" | "DUPLICADA";

interface ParsedRow {
  rowNumber: number;
  production_date: string | null; // YYYY-MM-DD
  unit_value: number | null;
  paciente_nome: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  status: RowStatus;
}

type Step = "context" | "upload";

// ============= CONSTANTS =============

// Modos de pagamento para PARTICULAR (idêntico ao lançamento manual)
const PAYMENT_METHODS = [
  { id: "PIX", name: "PIX" },
  { id: "DINHEIRO", name: "Dinheiro" },
  { id: "CARTAO", name: "Cartão" },
  { id: "TRANSFERENCIA", name: "Transferência" },
  { id: "BOLETO", name: "Boleto" },
  { id: "OUTRO", name: "Outro" },
] as const;

// Fallback de convênios
const DEFAULT_PAYERS = [
  { id: "IPASGO", name: "Ipasgo", type: "CONVENIO", active: true },
  { id: "UNIMED", name: "Unimed", type: "CONVENIO", active: true },
  { id: "BRADESCO", name: "Bradesco", type: "CONVENIO", active: true },
  { id: "GEAP", name: "GEAP", type: "CONVENIO", active: true },
] as const;

// Modelo CSV enxuto (colunas obrigatórias apenas)
const TEMPLATE_CSV = `sep=;
data_producao;valor_unitario;paciente_nome
15/01/2026;150,00;João da Silva
16/01/2026;200,00;
17/01/2026;175,50;Maria Souza`;

// ============= HELPERS =============

function parseDateOnly(yyyyMmDd: string): Date {
  return parse(yyyyMmDd, "yyyy-MM-dd", new Date());
}

// ============= COMPONENT =============
export function ProductionImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: ProductionImportModalProps) {
  const { currentCompany } = useAuth();
  const { settings, extendedSettings } = useCompanySettings();
  const { refreshAll } = useGlobalRealtime();

  // ============= DERIVED DATA =============
  
  // Unidades - IDÊNTICO ao formulário manual
  const units = settings?.units?.filter(u => u.active !== false) || [];

  // Tipos de produção - MESMA FONTE do formulário manual (BASE_PRODUCTION_TYPES + PACOTE_BOX/GTA)
  const productionTypes = useMemo(() => {
    const PACKAGE_TYPES = ["PACOTE_BOX", "PACOTE_GTA"];
    const allTypes = [...new Set([...BASE_PRODUCTION_TYPES, ...PACKAGE_TYPES])];
    return allTypes.map(id => ({
      id,
      name: PRODUCTION_TYPE_LABELS[id] || id,
    }));
  }, []);

  // Pagadores/Convênios
  const payers = useMemo(() => {
    const fromSettings = extendedSettings?.payers;
    if (fromSettings && Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.filter((p: any) => p.type === "CONVENIO" && p.active !== false);
    }
    return DEFAULT_PAYERS.filter(p => p.type === "CONVENIO");
  }, [extendedSettings?.payers]);

  // ============= STATE =============
  
  const [step, setStep] = useState<Step>("context");
  const [isImporting, setIsImporting] = useState(false);
  const importingRef = useRef(false);

  const [context, setContext] = useState<ImportContext>({
    production_type: "",
    unit: "",
    competencia: format(new Date(), "yyyy-MM"),
    payer_type: "CONVENIO",
    convenio: "",
    payment_method: "",
  });

  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [duplicatesConfirmed, setDuplicatesConfirmed] = useState(false);

  // Competências disponíveis (últimos 12 meses + próximos 2)
  const competenciaOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -12; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MM/yyyy"), // Exibição MM/YYYY
      });
    }
    return options.reverse();
  }, []);

  // ============= VALIDATION =============

  const isContextValid = useMemo(() => {
    if (!context.production_type || !context.unit || !context.competencia) return false;
    if (context.payer_type === "CONVENIO" && !context.convenio) return false;
    if (context.payer_type === "PARTICULAR" && !context.payment_method) return false;
    return true;
  }, [context]);

  // ============= SUMMARY STATS =============

  const summary = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter(r => r.isValid);
    const invalid = parsedRows.filter(r => !r.isValid);
    const duplicates = parsedRows.filter(r => r.isValid && r.isDuplicate);

    return {
      total,
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicateCount: duplicates.length,
      totalValue: valid.reduce((sum, r) => sum + (r.unit_value || 0), 0),
    };
  }, [parsedRows]);

  const hasDuplicates = summary.duplicateCount > 0;
  const canImport = summary.validCount > 0 && (!hasDuplicates || duplicatesConfirmed);

  // ============= PARSE HELPERS =============

  const parseDate = useCallback((value: string): { formatted: string | null; date: Date | null } => {
    if (!value?.trim()) return { formatted: null, date: null };
    const trimmed = value.trim();

    // Try DD/MM/YYYY
    let parsed = parse(trimmed, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
    }

    // Try YYYY-MM-DD
    parsed = parse(trimmed, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
    }

    return { formatted: null, date: null };
  }, []);

  const parseValue = useCallback((value: string): number | null => {
    if (!value?.trim()) return null;
    let normalized = value.trim().replace(/\s/g, "");
    
    // Formato brasileiro: 1.234,56 → 1234.56
    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(",", ".");
    }
    
    const num = parseFloat(normalized);
    return isNaN(num) || num <= 0 ? null : num;
  }, []);

  const validateRow = useCallback((rawRow: Record<string, string>, rowNumber: number): ParsedRow => {
    const errors: string[] = [];

    // Parse date
    const dateStr = rawRow["data_producao"] || rawRow["data_produção"] || "";
    const { date, formatted: production_date } = parseDate(dateStr);

    if (!production_date) {
      errors.push("Data inválida");
    } else if (date) {
      // Validar se está dentro da competência
      const [year, month] = context.competencia.split("-").map(Number);
      const compStart = startOfMonth(new Date(year, month - 1));
      const compEnd = endOfMonth(new Date(year, month - 1));

      if (!isWithinInterval(date, { start: compStart, end: compEnd })) {
        errors.push(`Fora da competência ${format(compStart, "MM/yyyy")}`);
      }
    }

    // Parse value
    const valueStr = rawRow["valor_unitario"] || rawRow["valor_unitário"] || "";
    const unit_value = parseValue(valueStr);
    if (unit_value === null) {
      errors.push("Valor inválido");
    }

    // Paciente (opcional)
    const paciente_nome = (rawRow["paciente_nome"] || rawRow["paciente"] || "").trim();

    return {
      rowNumber,
      production_date,
      unit_value,
      paciente_nome,
      isValid: errors.length === 0,
      errors,
      isDuplicate: false,
      status: errors.length === 0 ? "OK" : "ERRO",
    };
  }, [context.competencia, parseDate, parseValue]);

  // ============= DUPLICATE CHECK =============

  const checkDuplicates = useCallback(async (rows: ParsedRow[]) => {
    if (!currentCompany?.id) return;

    const validRows = rows.filter(r => r.isValid && r.production_date);
    if (validRows.length === 0) return;

    try {
      // Buscar produções existentes com mesmo contexto
      let query = supabase
        .from("productions")
        .select("production_date, unit_value, production_type, unit, payer_type, convenio, paciente_nome")
        .eq("company_id", currentCompany.id)
        .eq("competencia", context.competencia)
        .eq("unit", context.unit)
        .eq("production_type", context.production_type)
        .eq("payer_type", context.payer_type);

      if (context.payer_type === "CONVENIO" && context.convenio) {
        query = query.eq("convenio", context.convenio);
      }

      const { data: existing } = await query;

      if (!existing || existing.length === 0) {
        // Sem duplicados
        setParsedRows(rows.map(r => ({
          ...r,
          isDuplicate: false,
          status: r.isValid ? "OK" : "ERRO",
        })));
        return;
      }

      // Criar set de chaves existentes
      const existingKeys = new Set(
        existing.map(p =>
          `${p.production_date}|${Number(p.unit_value).toFixed(2)}|${(p.paciente_nome || "").toLowerCase().trim()}`
        )
      );

      // Marcar duplicados
      const updatedRows = rows.map(r => {
        if (!r.isValid || !r.production_date) {
          return { ...r, isDuplicate: false, status: "ERRO" as RowStatus };
        }

        const key = `${r.production_date}|${(r.unit_value || 0).toFixed(2)}|${r.paciente_nome.toLowerCase().trim()}`;
        const isDuplicate = existingKeys.has(key);

        return {
          ...r,
          isDuplicate,
          status: isDuplicate ? "DUPLICADA" as RowStatus : "OK" as RowStatus,
        };
      });

      setParsedRows(updatedRows);
    } catch (err) {
      console.error("Erro ao verificar duplicados:", err);
    }
  }, [currentCompany?.id, context]);

  // ============= FILE UPLOAD =============

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setDuplicatesConfirmed(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (!text) {
        toast.error("Erro ao ler arquivo");
        return;
      }

      // Remover BOM do Excel
      text = text.replace(/^\uFEFF/, "");

      // Remover linha sep=; se existir
      if (text.startsWith("sep=")) {
        const firstNewline = text.indexOf("\n");
        if (firstNewline !== -1) {
          text = text.substring(firstNewline + 1);
        }
      }

      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        toast.error("CSV deve ter cabeçalho e ao menos uma linha de dados");
        return;
      }

      // Detectar separador
      const headerLine = lines[0];
      const separator = headerLine.includes(";") ? ";" : ",";

      const headers = headerLine
        .split(separator)
        .map(h => h.trim().toLowerCase().replace(/[""]/g, ""));

      // Validar colunas obrigatórias
      const hasDate = headers.some(h => h.includes("data"));
      const hasValue = headers.some(h => h.includes("valor"));

      if (!hasDate || !hasValue) {
        toast.error("CSV deve conter colunas: data_producao, valor_unitario");
        return;
      }

      // Parse linhas
      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(separator).map(v => v.trim().replace(/[""]/g, ""));
        const rawRow: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rawRow[header] = values[idx] || "";
        });

        rows.push(validateRow(rawRow, i));
      }

      setParsedRows(rows);
    };

    reader.readAsText(file, "UTF-8");
  }, [validateRow]);

  // Verificar duplicados quando parsedRows mudar
  useEffect(() => {
    if (parsedRows.length > 0 && step === "upload") {
      checkDuplicates(parsedRows);
    }
  }, [parsedRows.length, step]);

  // ============= DOWNLOAD TEMPLATE =============

  const downloadTemplate = useCallback(() => {
    const BOM = "\ufeff";
    const blob = new Blob([BOM + TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao_producao.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // ============= IMPORT =============

  const handleImport = useCallback(async () => {
    if (importingRef.current) {
      toast.warning("Importação já em andamento...");
      return;
    }

    if (!currentCompany?.id) {
      toast.error("Empresa não selecionada");
      return;
    }

    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    importingRef.current = true;
    setIsImporting(true);

    try {
      const rowsToInsert = validRows.map(r => ({
        production_date: r.production_date,
        unit_value: r.unit_value,
        paciente_nome: r.paciente_nome || null,
      }));

      const contextForRpc = {
        production_type: context.production_type,
        unit: context.unit,
        competencia: context.competencia,
        payer_type: context.payer_type,
        convenio: context.convenio || null,
        payment_method: context.payer_type === "PARTICULAR" ? context.payment_method : null,
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
      };

      if (!result.success) {
        throw new Error(result.error || "Erro na importação");
      }

      toast.success(
        `Importação concluída: ${result.imported_count} produções criadas | Total ${formatCurrency(result.total_value || 0)}`
      );

      refreshAll();
      onImportComplete();
      resetAndClose();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error(err.message || "Erro ao importar produções");
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  }, [currentCompany?.id, parsedRows, context, fileName, onImportComplete, refreshAll]);

  // ============= RESET =============

  const resetAndClose = useCallback(() => {
    setStep("context");
    setContext({
      production_type: "",
      unit: "",
      competencia: format(new Date(), "yyyy-MM"),
      payer_type: "CONVENIO",
      convenio: "",
      payment_method: "",
    });
    setFileName("");
    setParsedRows([]);
    setDuplicatesConfirmed(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // ============= RENDER =============

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
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
          <Badge variant={step === "upload" ? "default" : "secondary"}>2. Conferência</Badge>
        </div>

        {/* ============= STEP 1: CONTEXTO ============= */}
        {step === "context" && (
          <div className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Preencha o contexto que será aplicado a <strong>TODAS</strong> as linhas do CSV.
                Idêntico ao lançamento manual.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de Produção */}
              <div className="space-y-2">
                <Label>Tipo de Produção *</Label>
                <Select
                  value={context.production_type}
                  onValueChange={v => setContext(c => ({ ...c, production_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productionTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unidade */}
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select
                  value={context.unit}
                  onValueChange={v => setContext(c => ({ ...c, unit: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competência - EXIBE MM/YYYY */}
              <div className="space-y-2">
                <Label>Competência *</Label>
                <Select
                  value={context.competencia}
                  onValueChange={v => setContext(c => ({ ...c, competencia: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciaOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pagador */}
              <div className="space-y-2">
                <Label>Pagador *</Label>
                <Select
                  value={context.payer_type}
                  onValueChange={v => setContext(c => ({
                    ...c,
                    payer_type: v as "CONVENIO" | "PARTICULAR",
                    convenio: v === "PARTICULAR" ? "" : c.convenio,
                    payment_method: v === "CONVENIO" ? "" : c.payment_method,
                  }))}
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

              {/* Convênio (se CONVENIO) */}
              {context.payer_type === "CONVENIO" && (
                <div className="space-y-2 col-span-2">
                  <Label>Convênio *</Label>
                  <Select
                    value={context.convenio}
                    onValueChange={v => setContext(c => ({ ...c, convenio: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o convênio..." />
                    </SelectTrigger>
                    <SelectContent>
                      {payers.map((payer: any) => (
                        <SelectItem key={payer.id} value={payer.id}>
                          {payer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Modo de Pagamento (se PARTICULAR) */}
              {context.payer_type === "PARTICULAR" && (
                <div className="space-y-2 col-span-2">
                  <Label>Modo de Pagamento *</Label>
                  <Select
                    value={context.payment_method}
                    onValueChange={v => setContext(c => ({ ...c, payment_method: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(pm => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={resetAndClose}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("upload")} disabled={!isContextValid}>
                Continuar →
              </Button>
            </div>
          </div>
        )}

        {/* ============= STEP 2: CONFERÊNCIA ============= */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Resumo do contexto */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="font-medium mb-1">Contexto do Lote:</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>Tipo: <strong>{productionTypes.find(t => t.id === context.production_type)?.name}</strong></span>
                <span>Unidade: <strong>{units.find(u => u.id === context.unit)?.name}</strong></span>
                <span>Competência: <strong>{context.competencia.split("-").reverse().join("/")}</strong></span>
                <span>
                  Pagador:{" "}
                  <strong>
                    {context.payer_type === "PARTICULAR" 
                      ? "Particular" 
                      : payers.find((p: any) => p.id === context.convenio)?.name || context.convenio}
                  </strong>
                </span>
                {context.payer_type === "PARTICULAR" && context.payment_method && (
                  <span>Pagamento: <strong>{PAYMENT_METHODS.find(p => p.id === context.payment_method)?.name}</strong></span>
                )}
              </div>
            </div>

            {/* Upload area */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
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

            {/* Resumo de linhas */}
            {parsedRows.length > 0 && (
              <>
                {/* Stats simples no topo */}
                <div className="flex flex-wrap gap-4 text-sm py-2 px-3 bg-muted/30 rounded-md">
                  <span>Total: <strong>{summary.total}</strong></span>
                  <span className="text-green-600">Válidas: <strong>{summary.validCount}</strong></span>
                  <span className="text-destructive">Com erro: <strong>{summary.invalidCount}</strong></span>
                  <span className="text-amber-600">Duplicadas: <strong>{summary.duplicateCount}</strong></span>
                  <span className="ml-auto">Valor válido: <strong>{formatCurrency(summary.totalValue)}</strong></span>
                </div>

                {/* Tabela de conferência - SIMPLES */}
                <ScrollArea className="flex-1 border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-16 text-xs">Linha</TableHead>
                        <TableHead className="w-28 text-xs">Data</TableHead>
                        <TableHead className="text-xs">Paciente</TableHead>
                        <TableHead className="w-28 text-right text-xs">Valor</TableHead>
                        <TableHead className="w-24 text-center text-xs">Status</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map(row => (
                        <TableRow
                          key={row.rowNumber}
                          className={
                            row.status === "ERRO" ? "bg-destructive/5" :
                            row.status === "DUPLICADA" ? "bg-amber-500/5" : ""
                          }
                        >
                          <TableCell className="text-muted-foreground font-mono text-xs py-1.5">
                            {row.rowNumber}
                          </TableCell>
                          <TableCell className="py-1.5 text-sm">
                            {row.production_date
                              ? format(parseDateOnly(row.production_date), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="py-1.5 text-sm truncate max-w-[200px]">
                            {row.paciente_nome || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right py-1.5 font-mono text-sm">
                            {row.unit_value !== null ? formatCurrency(row.unit_value) : "-"}
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            {row.status === "OK" && (
                              <Badge variant="outline" className="text-green-600 border-green-500/40 text-xs">
                                OK
                              </Badge>
                            )}
                            {row.status === "DUPLICADA" && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-xs">
                                DUPLICADA
                              </Badge>
                            )}
                            {row.status === "ERRO" && (
                              <Badge variant="destructive" className="text-xs">
                                ERRO
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-1.5">
                            {row.status === "ERRO" && row.errors.join(", ")}
                            {row.status === "DUPLICADA" && "Registro já existe"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Alerta de duplicadas + checkbox obrigatório */}
                {hasDuplicates && (
                  <div className="flex items-start space-x-3 p-3 border rounded-md bg-amber-500/5 border-amber-500/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-amber-800">
                        Existem {summary.duplicateCount} linha(s) duplicada(s)
                      </p>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="confirm-duplicates"
                          checked={duplicatesConfirmed}
                          onCheckedChange={checked => setDuplicatesConfirmed(!!checked)}
                        />
                        <Label htmlFor="confirm-duplicates" className="text-sm cursor-pointer">
                          Confirmo que revisei as duplicidades
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nenhuma linha válida */}
                {summary.validCount === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nenhuma linha válida para importar. Corrija os erros no CSV.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("context")}>
                ← Voltar
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={resetAndClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || !canImport}
                  variant={hasDuplicates ? "destructive" : "default"}
                >
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {hasDuplicates
                    ? `⚠️ Importar mesmo assim (${summary.duplicateCount} duplicadas)`
                    : `Importar (${summary.validCount})`
                  }
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
