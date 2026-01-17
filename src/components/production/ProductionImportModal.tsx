import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { format, parse, isValid, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, X, Loader2, Search, Filter, AlertTriangle } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";
import { PRODUCTION_TYPE_LABELS } from "@/utils/constants";

// ✅ Helper para parsear data YYYY-MM-DD sem shift de timezone
function parseDateOnly(yyyyMmDd: string): Date {
  return parse(yyyyMmDd, "yyyy-MM-dd", new Date());
}

// ✅ Gerar hash simples para detecção de duplicação de lote
async function generateImportHash(context: ImportContext, rows: ParsedRow[]): Promise<string> {
  const validRows = rows.filter(r => r.isValid);
  
  // Normalizar dados para hash
  const normalized = {
    context: {
      production_type: context.production_type,
      unit: context.unit,
      competencia: context.competencia,
      payer_type: context.payer_type,
      convenio: context.convenio || "",
    },
    rows: validRows.map(r => ({
      date: r.production_date,
      value: Math.round((r.unit_value || 0) * 100), // centavos
      patient: (r.paciente_nome || "").trim().toLowerCase(),
    })).sort((a, b) => {
      // Ordenar por data + valor + paciente para consistência
      if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
      if (a.value !== b.value) return a.value - b.value;
      return a.patient.localeCompare(b.patient);
    }),
  };
  
  const text = JSON.stringify(normalized);
  
  // Usar SubtleCrypto para SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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
  isPossibleDuplicate?: boolean; // ✅ Marcação de possível duplicado
}

type Step = "context" | "upload";

// ✅ Modelo CSV padrão Brasil: separador ; e decimal , + sep=; para Excel
const TEMPLATE_CSV = `sep=;
data_producao;valor_unitario;paciente_nome
15/01/2026;150,00;João da Silva
16/01/2026;200,00;
17/01/2026;175,50;Maria Souza`;

// ✅ Fallback de convênios quando banco está vazio
const DEFAULT_PAYERS = [
  { id: "IPASGO", name: "Ipasgo", type: "CONVENIO", active: true },
  { id: "UNIMED", name: "Unimed", type: "CONVENIO", active: true },
  { id: "BRADESCO", name: "Bradesco", type: "CONVENIO", active: true },
  { id: "GEAP", name: "GEAP", type: "CONVENIO", active: true },
  { id: "PARTICULAR", name: "Particular", type: "PARTICULAR", active: true },
] as const;

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
  
  // ✅ FIX: Criar lista base a partir de PRODUCTION_TYPE_LABELS (inclui PACOTE_BOX/GTA)
  const baseProductionTypes = useMemo((): { id: string; name: string; active: boolean }[] => 
    Object.entries(PRODUCTION_TYPE_LABELS).map(([id, name]) => ({ id, name: String(name), active: true })),
    []
  );
  
  // ✅ Merge settings com base para garantir que PACOTE_BOX/GTA sempre apareçam
  const productionTypes = useMemo((): { id: string; name: string; active: boolean }[] => {
    const fromSettings = extendedSettings?.productionTypes ?? [];
    if (!Array.isArray(fromSettings) || fromSettings.length === 0) {
      return baseProductionTypes;
    }
    // Merge: settings sobrepõe base, mas base garante que pacotes existam
    const merged = new Map<string, { id: string; name: string; active: boolean }>();
    baseProductionTypes.forEach(t => merged.set(t.id, t));
    fromSettings.forEach((t: { id?: string; name?: string; active?: boolean }) => {
      if (t && t.id) {
        const existing = merged.get(t.id);
        merged.set(t.id, { 
          id: t.id, 
          name: String(t.name ?? existing?.name ?? t.id), 
          active: t.active ?? existing?.active ?? true 
        });
      }
    });
    return Array.from(merged.values());
  }, [baseProductionTypes, extendedSettings?.productionTypes]);
  
  const payers = (extendedSettings.payers && extendedSettings.payers.length > 0)
    ? extendedSettings.payers
    : (DEFAULT_PAYERS as unknown as typeof extendedSettings.payers);

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

  // ✅ Filtros de preview (modo auditoria)
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ✅ Estado para detecção de duplicação de lote
  const [duplicateCheckState, setDuplicateCheckState] = useState<{
    checking: boolean;
    existingBatch: { id: string; created_at: string } | null;
    showConfirmDialog: boolean;
  }>({
    checking: false,
    existingBatch: null,
    showConfirmDialog: false,
  });

  // ✅ Estado para duplicados por linha
  const [duplicateLineCount, setDuplicateLineCount] = useState(0);

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

  // ✅ Agrupamento por data para chips
  const dateGroups = useMemo(() => {
    const groups: { [date: string]: { count: number; total: number } } = {};
    
    parsedRows
      .filter(r => r.isValid && r.production_date)
      .forEach(r => {
        const key = r.production_date!;
        if (!groups[key]) {
          groups[key] = { count: 0, total: 0 };
        }
        groups[key].count++;
        groups[key].total += r.unit_value || 0;
      });
    
    return Object.entries(groups)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [parsedRows]);

  // ✅ Linhas filtradas para exibição
  const filteredRows = useMemo(() => {
    let rows = parsedRows;
    
    if (showOnlyInvalid) {
      rows = rows.filter(r => !r.isValid);
    }
    
    if (patientSearch.trim()) {
      const search = patientSearch.toLowerCase().trim();
      rows = rows.filter(r => 
        r.paciente_nome.toLowerCase().includes(search)
      );
    }
    
    if (selectedDate) {
      rows = rows.filter(r => r.production_date === selectedDate);
    }
    
    return rows;
  }, [parsedRows, showOnlyInvalid, patientSearch, selectedDate]);

  // Summary stats - ✅ Usa parseDateOnly para evitar bug de timezone
  const summary = useMemo(() => {
    const valid = parsedRows.filter((r) => r.isValid);
    const invalid = parsedRows.filter((r) => !r.isValid);
    const totalValue = valid.reduce((sum, r) => sum + (r.unit_value || 0), 0);
    const dates = valid
      .map((r) => r.production_date)
      .filter((d): d is string => d !== null)
      .map((d) => parseDateOnly(d))
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

  // Parse numeric value - suporta formato brasileiro (vírgula como decimal)
  const parseValue = useCallback((value: string): number | null => {
    if (!value || !value.trim()) return null;
    // Remove espaços e caracteres indesejados
    let normalized = value.trim().replace(/\s/g, "");
    // Se tiver vírgula como decimal e não tiver ponto, converter: 150,00 → 150.00
    if (normalized.includes(",") && !normalized.includes(".")) {
      normalized = normalized.replace(",", ".");
    }
    // Se tiver vírgula e ponto (ex: 1.000,00), remover pontos de milhar e converter vírgula
    else if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }
    const num = parseFloat(normalized);
    if (isNaN(num) || num <= 0) return null;
    return num;
  }, []);

  // ✅ Garantir competência sempre como YYYY-MM
  const normalizeCompetencia = useCallback((value: string): string => {
    // Se já está no formato YYYY-MM, retornar
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    // Se está no formato MM/YYYY, converter
    if (/^\d{2}\/\d{4}$/.test(value)) {
      return value.slice(3) + "-" + value.slice(0, 2);
    }
    return value;
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
        const normalizedComp = normalizeCompetencia(context.competencia);
        const [year, month] = normalizedComp.split("-").map(Number);
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
    [context.competencia, parseDate, parseValue, normalizeCompetencia]
  );

  // ✅ Verificar duplicados por linha no banco
  const checkLineDuplicates = useCallback(async (rows: ParsedRow[]) => {
    if (!currentCompany?.id) return;
    
    const validRows = rows.filter(r => r.isValid && r.production_date);
    if (validRows.length === 0) return;

    try {
      // Buscar produções existentes para a mesma competência/unidade
      const normalizedComp = normalizeCompetencia(context.competencia);
      
      const { data: existingProductions } = await supabase
        .from("productions")
        .select("production_date, unit_value, production_type, unit, payer_type, convenio, paciente_nome")
        .eq("company_id", currentCompany.id)
        .eq("competencia", normalizedComp)
        .eq("unit", context.unit)
        .eq("production_type", context.production_type)
        .eq("payer_type", context.payer_type);
      
      if (!existingProductions || existingProductions.length === 0) {
        setDuplicateLineCount(0);
        return;
      }

      // Criar set de chaves existentes para busca rápida
      const existingKeys = new Set(
        existingProductions.map(p => 
          `${p.production_date}|${p.unit_value}|${(p.paciente_nome || "").toLowerCase().trim()}`
        )
      );

      // Marcar linhas como possíveis duplicados
      let count = 0;
      const updatedRows = rows.map(r => {
        if (!r.isValid || !r.production_date) return r;
        
        const key = `${r.production_date}|${r.unit_value}|${r.paciente_nome.toLowerCase().trim()}`;
        const isPossibleDuplicate = existingKeys.has(key);
        
        if (isPossibleDuplicate) count++;
        
        return { ...r, isPossibleDuplicate };
      });

      setParsedRows(updatedRows);
      setDuplicateLineCount(count);
    } catch (err) {
      console.error("Erro ao verificar duplicados:", err);
    }
  }, [currentCompany?.id, context, normalizeCompetencia]);

  // Handle file upload - suporta formato brasileiro
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setPatientSearch("");
      setSelectedDate(null);
      setShowOnlyInvalid(false);

      const reader = new FileReader();
      reader.onload = (event) => {
        let text = event.target?.result as string;
        if (!text) {
          toast.error("Erro ao ler arquivo");
          return;
        }

        // ✅ Remover BOM do Excel (UTF-8 BOM)
        text = text.replace(/^\uFEFF/, "");

        // ✅ Remover linha sep=; se existir
        if (text.startsWith("sep=")) {
          const firstNewline = text.indexOf("\n");
          if (firstNewline !== -1) {
            text = text.substring(firstNewline + 1);
          }
        }

        // Parse CSV
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
          toast.error("CSV deve ter cabeçalho e ao menos uma linha de dados");
          return;
        }

        // ✅ Detectar separador automaticamente (priorizar ;)
        const headerLine = lines[0];
        const separator = headerLine.includes(";") ? ";" : ",";
        
        const headers = headerLine
          .split(separator)
          .map((h) => h.trim().toLowerCase().replace(/[""]/g, ""));

        // Validate required headers
        const hasDate = headers.some((h) => h.includes("data"));
        const hasValue = headers.some((h) => h.includes("valor"));

        if (!hasDate || !hasValue) {
          toast.error("CSV deve conter colunas: data_producao, valor_unitario");
          return;
        }

        // Parse data rows usando o mesmo separador
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(separator).map((v) => v.trim().replace(/[""]/g, ""));
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

  // ✅ Verificar duplicados quando parsedRows mudar
  useEffect(() => {
    if (parsedRows.length > 0 && step === "upload") {
      checkLineDuplicates(parsedRows);
    }
  }, [parsedRows.length, step]); // Removido checkLineDuplicates para evitar loop

  // Download template - com BOM UTF-8 para Excel abrir corretamente
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

  // ✅ Verificar se lote já foi importado (por hash)
  const checkBatchDuplicate = useCallback(async (): Promise<boolean> => {
    if (!currentCompany?.id) return false;
    
    setDuplicateCheckState(s => ({ ...s, checking: true }));
    
    try {
      const hash = await generateImportHash(context, parsedRows);
      
      const { data, error } = await supabase
        .from("production_import_batches")
        .select("id, created_at")
        .eq("company_id", currentCompany.id)
        .eq("import_hash", hash)
        .maybeSingle();
      
      if (error) {
        console.error("Erro ao verificar hash:", error);
        return false;
      }
      
      if (data) {
        setDuplicateCheckState({
          checking: false,
          existingBatch: data,
          showConfirmDialog: true,
        });
        return true; // É duplicado, precisa confirmação
      }
      
      setDuplicateCheckState(s => ({ ...s, checking: false }));
      return false;
    } catch (err) {
      console.error("Erro ao gerar hash:", err);
      setDuplicateCheckState(s => ({ ...s, checking: false }));
      return false;
    }
  }, [currentCompany?.id, context, parsedRows]);

  // Import productions
  const handleImport = useCallback(async (forceImport = false) => {
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

    // ✅ Verificar duplicação de lote (se não forçado)
    if (!forceImport) {
      const isDuplicate = await checkBatchDuplicate();
      if (isDuplicate) return; // Dialog será exibido
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
      const competenciaFormatted = normalizeCompetencia(context.competencia);

      // Convert context to plain object for JSON serialization
      const contextForRpc = {
        production_type: context.production_type,
        unit: context.unit,
        competencia: competenciaFormatted,
        payer_type: context.payer_type,
        convenio: context.convenio || null,
      };

      // ✅ Gerar hash para anti-duplicação
      let importHash = await generateImportHash(context, parsedRows);
      
      // Se é import forçado, adicionar timestamp ao hash para permitir novo lote
      if (forceImport) {
        importHash = `${importHash}_${Date.now()}`;
      }

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
        batch_id?: string;
        error?: string;
        errors?: Array<{ row: number; error: string }>;
      };

      if (!result.success) {
        throw new Error(result.error || "Erro na importação");
      }

      // ✅ Atualizar batch com hash
      if (result.batch_id) {
        await supabase
          .from("production_import_batches")
          .update({ import_hash: importHash })
          .eq("id", result.batch_id);
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
      resetAndClose();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error(err.message || "Erro ao importar produções");
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  }, [currentCompany?.id, parsedRows, context, fileName, onImportComplete, refreshAll, checkBatchDuplicate, normalizeCompetencia]);

  // Reset and close
  const resetAndClose = useCallback(() => {
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
    setPatientSearch("");
    setSelectedDate(null);
    setShowOnlyInvalid(false);
    setDuplicateLineCount(0);
    setDuplicateCheckState({
      checking: false,
      existingBatch: null,
      showConfirmDialog: false,
    });
    onOpenChange(false);
  }, [onOpenChange]);

  const handleClose = resetAndClose;

  // Get payer name for display
  const getPayerName = useCallback(
    (id: string) => {
      const payer = payers.find((p) => p.id === id);
      return payer?.name || id;
    },
    [payers]
  );

  return (
    <>
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
                  <strong>Importante:</strong> Essas informações serão aplicadas a <strong>TODAS</strong> as linhas do arquivo CSV.
                  O arquivo não pode sobrescrever esses campos.
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
                        {payers.filter((p) => p.type === "CONVENIO" && p.active !== false).length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            Nenhum convênio cadastrado
                          </div>
                        ) : (
                          payers
                            .filter((p) => p.type === "CONVENIO" && p.active !== false)
                            .map((payer) => (
                              <SelectItem key={payer.id} value={payer.id}>
                                {payer.name}
                              </SelectItem>
                            ))
                        )}
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

              {/* ✅ Texto explicativo para Etapa 2 */}
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  O arquivo deve conter <strong>APENAS</strong> as colunas: <code className="bg-muted px-1 rounded">data_producao</code>, <code className="bg-muted px-1 rounded">valor_unitario</code> e <code className="bg-muted px-1 rounded">paciente_nome</code>.
                  <br />
                  <span className="text-muted-foreground">Unidade, convênio e competência já foram definidos na etapa anterior.</span>
                </AlertDescription>
              </Alert>

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

                  {/* ✅ Alerta de duplicados por linha */}
                  {duplicateLineCount > 0 && (
                    <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700">
                        <strong>{duplicateLineCount}</strong> linha(s) pode(m) ser duplicada(s) (já existe produção semelhante no banco).
                        Revise antes de importar.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* ✅ Filtros do preview (modo auditoria) */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Toggle inválidas */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-invalid"
                        checked={showOnlyInvalid}
                        onCheckedChange={setShowOnlyInvalid}
                      />
                      <Label htmlFor="show-invalid" className="text-sm cursor-pointer">
                        <Filter className="h-3 w-3 inline mr-1" />
                        Só inválidas
                      </Label>
                    </div>

                    {/* Busca por paciente */}
                    <div className="relative flex-1 max-w-[200px]">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paciente..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>

                    {/* Limpar filtros */}
                    {(showOnlyInvalid || patientSearch || selectedDate) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowOnlyInvalid(false);
                          setPatientSearch("");
                          setSelectedDate(null);
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  {/* ✅ Chips por data */}
                  {dateGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {dateGroups.map(({ date, count, total }) => (
                        <Badge
                          key={date}
                          variant={selectedDate === date ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                        >
                          {format(parseDateOnly(date), "dd/MM")} ({count}) - {formatCurrency(total)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* ✅ Preview table com header sticky e linhas compactas */}
                  <ScrollArea className="h-[280px] border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10 py-2 text-xs">#</TableHead>
                          <TableHead className="py-2 text-xs">Data</TableHead>
                          <TableHead className="text-right py-2 text-xs">Valor</TableHead>
                          <TableHead className="py-2 text-xs">Paciente</TableHead>
                          <TableHead className="w-28 py-2 text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => (
                          <TableRow 
                            key={row.rowNumber} 
                            className={`${!row.isValid ? "bg-destructive/5" : ""} ${row.isPossibleDuplicate ? "bg-amber-500/10" : ""}`}
                          >
                            <TableCell className="text-muted-foreground py-1.5 text-xs">{row.rowNumber}</TableCell>
                            <TableCell className="py-1.5 text-sm">
                              {row.production_date
                                ? format(parseDateOnly(row.production_date), "dd/MM/yyyy")
                                : row.raw["data_producao"] || "-"}
                            </TableCell>
                            <TableCell className="text-right py-1.5 text-sm">
                              {row.unit_value !== null ? formatCurrency(row.unit_value) : row.raw["valor_unitario"] || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground py-1.5 text-sm truncate max-w-[150px]">{row.paciente_nome || "-"}</TableCell>
                            <TableCell className="py-1.5">
                              {row.isValid ? (
                                row.isPossibleDuplicate ? (
                                  <Badge variant="outline" className="text-amber-600 border-amber-600/30 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Dup?
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-600/30 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  <X className="h-3 w-3 mr-1" />
                                  {row.errors[0]}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhuma linha encontrada com os filtros aplicados.
                            </TableCell>
                          </TableRow>
                        )}
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
                    onClick={() => handleImport(false)}
                    disabled={isImporting || duplicateCheckState.checking || summary.validCount === 0}
                  >
                    {(isImporting || duplicateCheckState.checking) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Importar {summary.validCount > 0 && `(${summary.validCount})`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog de confirmação de lote duplicado */}
      <AlertDialog 
        open={duplicateCheckState.showConfirmDialog} 
        onOpenChange={(open) => setDuplicateCheckState(s => ({ ...s, showConfirmDialog: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Lote possivelmente duplicado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este lote já foi importado anteriormente em{" "}
              <strong>
                {duplicateCheckState.existingBatch?.created_at
                  ? format(new Date(duplicateCheckState.existingBatch.created_at), "dd/MM/yyyy 'às' HH:mm")
                  : "data desconhecida"}
              </strong>.
              <br /><br />
              Deseja importar mesmo assim? Isso pode criar registros duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateCheckState(s => ({ ...s, showConfirmDialog: false }));
                handleImport(true); // Forçar importação
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Importar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
