import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { format, parse, isValid, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Package,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";
import { PRODUCTION_TYPE_LABELS, DEFAULT_PAYMENT_METHODS_PARTICULAR } from "@/utils/constants";
import { BASE_PRODUCTION_TYPES, PaymentMethodParticularConfig } from "@/types";
import { usePackagePricing, PackageType, PackageComponents } from "@/hooks/usePackagePricing";

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
  doctor_id?: string | undefined; // ✅ undefined explícito — string vazia evitada intencionalmente
}

type RowStatus = "OK" | "ERRO" | "DUPLICADA";

interface ParsedRow {
  rowNumber: number;
  production_date: string | null; // YYYY-MM-DD
  unit_value: number | null;
  paciente_nome: string;
  // ✅ CORRIGIDO: doctor_id e doctor_name resolvidos corretamente
  doctor_id?: string | null;
  doctor_name?: string | null;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  status: RowStatus;
  // Package breakdown (apenas para PACOTE_BOX / PACOTE_GTA)
  isPackage?: boolean;
  consultAmount?: number;
  feeAmount?: number;
  matmedAmount?: number;
}

type Step = "context" | "upload";

// Filter types for preview table
type FilterType = "all" | "errors" | "duplicates" | "new";
type SortField = "rowNumber" | "date" | "status";
type SortDirection = "asc" | "desc";

// Package types que usam lógica de pacote
const PACKAGE_PRODUCTION_TYPES = ["PACOTE_BOX", "PACOTE_GTA"];

// ============= CONSTANTS =============

// Fallback de convênios
const DEFAULT_PAYERS = [
  { id: "IPASGO", name: "Ipasgo", type: "CONVENIO", active: true },
  { id: "UNIMED", name: "Unimed", type: "CONVENIO", active: true },
  { id: "BRADESCO", name: "Bradesco", type: "CONVENIO", active: true },
  { id: "GEAP", name: "GEAP", type: "CONVENIO", active: true },
] as const;

// ✅ CORRIGIDO: Modelo CSV atualizado com coluna "medico" documentada
const TEMPLATE_CSV = `sep=;
data_producao;valor_unitario;paciente_nome;medico
15/01/2026;150,00;João da Silva;Dra. Isabela Mendonça
16/01/2026;200,00;Maria Souza;Dra. Isabela Mendonça
17/01/2026;175,50;Pedro Lima;`;

// ============= HELPERS =============

function parseDateOnly(yyyyMmDd: string): Date {
  return parse(yyyyMmDd, "yyyy-MM-dd", new Date());
}

// Status priority for sorting (ERRO > DUPLICADA > OK)
function getStatusPriority(status: RowStatus): number {
  switch (status) {
    case "ERRO":
      return 0;
    case "DUPLICADA":
      return 1;
    case "OK":
      return 2;
    default:
      return 3;
  }
}

// ✅ CORRIGIDO: Normalização robusta de nome (remove acentos, espaços extras, prefixos opcionais)
function normalizeDoctorName(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim();
}

// ============= COMPONENT =============
export function ProductionImportModal({ open, onOpenChange, onImportComplete }: ProductionImportModalProps) {
  const { currentCompany } = useAuth();
  const { settings, extendedSettings } = useCompanySettings();
  const { refreshAll } = useGlobalRealtime();
  const { calculateComponents, validateTotal, getEffectiveRule } = usePackagePricing();

  // ============= DERIVED DATA =============

  // Unidades - IDÊNTICO ao formulário manual
  const units = settings?.units?.filter((u) => u.active !== false) || [];

  // Tipos de produção - MESMA FONTE do formulário manual
  const productionTypes = useMemo(() => {
    const allTypes = [...new Set([...BASE_PRODUCTION_TYPES, ...PACKAGE_PRODUCTION_TYPES])];
    return allTypes.map((id) => ({
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
    return DEFAULT_PAYERS.filter((p) => p.type === "CONVENIO");
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
    doctor_id: undefined, // ✅ undefined em vez de "" — ?? funciona corretamente; string vazia causaria edge case na RPC
  });

  // ============= MÉDICO =============
  const companyId = currentCompany?.id;

  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string }[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // ✅ CORRIGIDO: Mapa nome normalizado → id, para lookup robusto do CSV
  const doctorNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctorOptions) {
      // Indexar pelo nome completo normalizado
      map.set(normalizeDoctorName(d.name), d.id);

      // ✅ EXTRA: Indexar também sem o prefixo "dr." / "dra." para tolerância
      const semPrefixo = normalizeDoctorName(d.name)
        .replace(/^dr\.?\s+/, "")
        .replace(/^dra\.?\s+/, "")
        .trim();
      if (semPrefixo && !map.has(semPrefixo)) {
        map.set(semPrefixo, d.id);
      }
    }
    return map;
  }, [doctorOptions]);

  // ✅ CORRIGIDO: Mapa id → nome, para exibição na tabela
  const doctorIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctorOptions) {
      map.set(d.id, d.name);
    }
    return map;
  }, [doctorOptions]);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!companyId || !open) {
        setDoctorOptions([]);
        return;
      }

      try {
        setDoctorsLoading(true);

        const { data, error } = await supabase
          .from("doctors")
          .select("id, name, active, company_id")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) {
          if (import.meta.env.DEV) console.error("Erro ao buscar médicos:", error);
          setDoctorOptions([]);
          return;
        }

        const normalized = (data ?? [])
          .map((d: any) => ({
            id: String(d?.id ?? ""),
            name: String(d?.name ?? "").trim(),
          }))
          .filter((d: any) => Boolean(d.id) && Boolean(d.name));

        setDoctorOptions(normalized);
      } catch (err) {
        if (import.meta.env.DEV) console.error("Erro ao buscar médicos:", err);
        setDoctorOptions([]);
      } finally {
        setDoctorsLoading(false);
      }
    };

    fetchDoctors();
  }, [companyId, open]);

  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [duplicatesConfirmed, setDuplicatesConfirmed] = useState(false);

  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rowNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isPackageImport = PACKAGE_PRODUCTION_TYPES.includes(context.production_type);

  // Competências disponíveis (últimos 12 meses + próximos 2)
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
    const valid = parsedRows.filter((r) => r.isValid);
    const invalid = parsedRows.filter((r) => !r.isValid);
    const duplicates = parsedRows.filter((r) => r.isValid && r.isDuplicate);
    const newRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);

    return {
      total,
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicateCount: duplicates.length,
      newCount: newRows.length,
      totalValue: valid.reduce((sum, r) => sum + (r.unit_value || 0), 0),
      newTotalValue: newRows.reduce((sum, r) => sum + (r.unit_value || 0), 0),
    };
  }, [parsedRows]);

  const hasDuplicates = summary.duplicateCount > 0;
  const rowsToImportCount = includeDuplicates ? summary.validCount : summary.newCount;
  const canImport = rowsToImportCount > 0 && (!includeDuplicates || !hasDuplicates || duplicatesConfirmed);

  // ============= PARSE HELPERS =============

  const parseDate = useCallback((value: string): { formatted: string | null; date: Date | null } => {
    if (!value?.trim()) return { formatted: null, date: null };
    const trimmed = value.trim();

    let parsed = parse(trimmed, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
    }

    parsed = parse(trimmed, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      return { date: parsed, formatted: format(parsed, "yyyy-MM-dd") };
    }

    return { formatted: null, date: null };
  }, []);

  const parseValue = useCallback((value: string): number | null => {
    if (!value?.trim()) return null;
    let normalized = value.trim().replace(/\s/g, "");

    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(",", ".");
    }

    const num = parseFloat(normalized);
    return isNaN(num) || num <= 0 ? null : num;
  }, []);

  // ✅ CORRIGIDO: validateRow agora resolve doctor_id corretamente (linha > contexto)
  const validateRow = useCallback(
    (rawRow: Record<string, string>, rowNumber: number): ParsedRow => {
      const errors: string[] = [];

      // Parse date
      const dateStr = rawRow["data_producao"] || rawRow["data_produção"] || "";
      const { date, formatted: production_date } = parseDate(dateStr);

      if (!production_date) {
        errors.push("Data inválida");
      } else if (date) {
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

      // ✅ CORRIGIDO: Resolver médico da linha
      // Prioridade: doctor_id UUID direto > nome no CSV > médico padrão do contexto
      const rawDoctorId = (rawRow["doctor_id"] || rawRow["medico_id"] || rawRow["médico_id"] || "").trim();

      const rawDoctorName = (
        rawRow["doctor_name"] ||
        rawRow["medico_nome"] ||
        rawRow["médico_nome"] ||
        rawRow["medico"] ||
        rawRow["médico"] ||
        rawRow["doctor"] ||
        ""
      ).trim();

      let doctor_id: string | null = null;
      let doctor_name: string | null = null;

      if (rawDoctorId) {
        // UUID direto no CSV — máxima prioridade
        doctor_id = rawDoctorId;
        doctor_name = rawDoctorName || doctorIdToName.get(rawDoctorId) || null;
      } else if (rawDoctorName) {
        // Nome no CSV — buscar no mapa normalizado
        const mapped = doctorNameToId.get(normalizeDoctorName(rawDoctorName));
        if (mapped) {
          doctor_id = mapped;
          doctor_name = rawDoctorName;
        } else {
          // Nome veio mas não foi encontrado → erro explícito (evita importação silenciosa errada)
          errors.push(`Médico não encontrado: "${rawDoctorName}"`);
        }
      } else {
        // Sem médico na linha → usar médico padrão do contexto (se selecionado)
        // A RPC aplica o contexto; aqui deixamos null para a RPC resolver
        doctor_id = context.doctor_id || null;
        doctor_name = context.doctor_id ? doctorIdToName.get(context.doctor_id) || null : null;
      }

      // ============= VALIDAÇÃO DE PACOTE =============
      let isPackage = false;
      let consultAmount = 0;
      let feeAmount = 0;
      let matmedAmount = 0;

      if (isPackageImport && unit_value !== null && production_date && context.convenio) {
        isPackage = true;
        const packageType = context.production_type as PackageType;
        const planId = context.convenio;

        const validation = validateTotal(unit_value, planId, packageType, production_date, 1);

        if (!validation.valid) {
          errors.push(validation.message || "Valor do pacote menor que consulta+box");
        } else {
          const components = calculateComponents(unit_value, planId, packageType, production_date, 1);
          consultAmount = components.consultAmount;
          feeAmount = components.feeAmount;
          matmedAmount = components.matmedAmount;
        }
      }

      return {
        rowNumber,
        production_date,
        unit_value,
        paciente_nome,
        doctor_id,
        doctor_name,
        isValid: errors.length === 0,
        errors,
        isDuplicate: false,
        status: errors.length === 0 ? "OK" : "ERRO",
        isPackage,
        consultAmount,
        feeAmount,
        matmedAmount,
      };
    },
    [
      context.competencia,
      context.convenio,
      context.production_type,
      context.doctor_id,
      parseDate,
      parseValue,
      isPackageImport,
      validateTotal,
      calculateComponents,
      doctorNameToId,
      doctorIdToName,
    ],
  );

  // ============= DUPLICATE CHECK =============

  const checkDuplicates = useCallback(
    async (rows: ParsedRow[]) => {
      if (!currentCompany?.id) return;

      const validRows = rows.filter((r) => r.isValid && r.production_date);
      if (validRows.length === 0) return;

      try {
        let query = supabase
          .from("productions")
          .select("production_date, unit_value, production_type, unit, payer_type, health_plan_id, paciente_nome, doctor_id") // ✅ inclui doctor_id para chave de duplicidade mais precisa
          .eq("company_id", currentCompany.id)
          .eq("competencia", context.competencia)
          .eq("unit", context.unit)
          .eq("production_type", context.production_type)
          .eq("payer_type", context.payer_type);

        if (context.payer_type === "CONVENIO" && context.convenio) {
          query = query.eq("health_plan_id", context.convenio);
        }

        const { data: existing } = await query;

        if (!existing || existing.length === 0) {
          setParsedRows(
            rows.map((r) => ({
              ...r,
              isDuplicate: false,
              status: r.isValid ? "OK" : "ERRO",
            })),
          );
          return;
        }

        const existingKeys = new Set(
          existing.map(
            (p) =>
              // ✅ Chave inclui doctor_id: dois médicos diferentes atendendo mesmo paciente/dia/valor não são duplicatas
              `${p.production_date}|${Number(p.unit_value || 0).toFixed(2)}|${(p.paciente_nome || "").toLowerCase().trim()}|${p.doctor_id || ""}`,
          ),
        );

        const updatedRows = rows.map((r) => {
          if (!r.isValid || !r.production_date) {
            return { ...r, isDuplicate: false, status: "ERRO" as RowStatus };
          }

          // ✅ Chave inclui doctor_id: mesmo paciente/dia/valor com médicos diferentes não é duplicata
          const key = `${r.production_date}|${(r.unit_value || 0).toFixed(2)}|${r.paciente_nome.toLowerCase().trim()}|${r.doctor_id || ""}`;
          const isDuplicate = existingKeys.has(key);

          return {
            ...r,
            isDuplicate,
            status: isDuplicate ? ("DUPLICADA" as RowStatus) : ("OK" as RowStatus),
          };
        });

        setParsedRows(updatedRows);
      } catch (err) {
        if (import.meta.env.DEV) console.error("Erro ao verificar duplicados:", err);
      }
    },
    [currentCompany?.id, context],
  );

  // ============= FILE UPLOAD =============

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
          toast.error("CSV deve ter cabeçalho e ao menos uma linha de dados");
          return;
        }

        // Detectar separador
        const headerLine = lines[0];
        const separator = headerLine.includes(";") ? ";" : ",";

        const headers = headerLine.split(separator).map((h) => h.trim().toLowerCase().replace(/[""]/g, ""));

        // Validar colunas obrigatórias
        const hasDate = headers.some((h) => h.includes("data"));
        const hasValue = headers.some((h) => h.includes("valor"));

        if (!hasDate || !hasValue) {
          toast.error("CSV deve conter colunas: data_producao, valor_unitario");
          return;
        }

        // Parse linhas
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(separator).map((v) => v.trim().replace(/[""]/g, ""));
          const rawRow: Record<string, string> = {};
          headers.forEach((header, idx) => {
            rawRow[header] = values[idx] || "";
          });

          rows.push(validateRow(rawRow, i));
        }

        setParsedRows(rows);
      };

      reader.readAsText(file, "UTF-8");
    },
    [validateRow],
  );

  // Verificar duplicados quando parsedRows mudar
  useEffect(() => {
    if (parsedRows.length > 0 && step === "upload") {
      checkDuplicates(parsedRows);
    }
  }, [parsedRows, step]); // ✅ depende do conteúdo completo, não só do tamanho

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

    const rowsToProcess = includeDuplicates
      ? parsedRows.filter((r) => r.isValid)
      : parsedRows.filter((r) => r.isValid && !r.isDuplicate);

    if (rowsToProcess.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    importingRef.current = true;
    setIsImporting(true);

    try {
      // ✅ CORRIGIDO: doctor_id agora é enviado corretamente por linha
      const rowsToInsert = rowsToProcess.map((r) => ({
        production_date: r.production_date,
        unit_value: r.unit_value,
        paciente_nome: r.paciente_nome || null,
        doctor_id: r.doctor_id ?? context.doctor_id ?? null, // ✅ ?? evita falha com string vazia
        is_package: r.isPackage || false,
        consult_amount: r.consultAmount || 0,
        fee_amount: r.feeAmount || 0,
        matmed_amount: r.matmedAmount || 0,
      }));

      const contextForRpc = {
        production_type: context.production_type,
        unit: context.unit,
        competencia: context.competencia,
        payer_type: context.payer_type,
        convenio: context.convenio || null,
        payment_method: context.payer_type === "PARTICULAR" ? context.payment_method : null,
        doctor_id: context.doctor_id || null, // ✅ médico padrão do contexto para a RPC usar como fallback
        is_package_import: isPackageImport,
        package_type: isPackageImport ? context.production_type : null,
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
        `Importação concluída: ${result.imported_count} produções criadas | Total ${formatCurrency(result.total_value || 0)}`,
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
  }, [
    currentCompany?.id,
    parsedRows,
    context,
    fileName,
    onImportComplete,
    refreshAll,
    includeDuplicates,
    isPackageImport,
  ]);

  // ============= FILTERED & SORTED ROWS =============

  const filteredAndSortedRows = useMemo(() => {
    let rows = [...parsedRows];

    switch (filterType) {
      case "errors":
        rows = rows.filter((r) => r.status === "ERRO");
        break;
      case "duplicates":
        rows = rows.filter((r) => r.status === "DUPLICADA");
        break;
      case "new":
        rows = rows.filter((r) => r.status === "OK" && !r.isDuplicate);
        break;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => r.paciente_nome.toLowerCase().includes(query));
    }

    rows.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "rowNumber":
          comparison = a.rowNumber - b.rowNumber;
          break;
        case "date":
          comparison = (a.production_date || "").localeCompare(b.production_date || "");
          break;
        case "status":
          comparison = getStatusPriority(a.status) - getStatusPriority(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return rows;
  }, [parsedRows, filterType, searchQuery, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

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
      doctor_id: undefined, // ✅ reset para undefined, consistente com estado inicial
    });
    setFileName("");
    setParsedRows([]);
    setDuplicatesConfirmed(false);
    setIncludeDuplicates(false);
    setFilterType("all");
    setSearchQuery("");
    setSortField("rowNumber");
    setSortDirection("asc");
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
                Preencha o contexto que será aplicado a <strong>TODAS</strong> as linhas do CSV. Idêntico ao lançamento
                manual.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de Produção */}
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

              {/* Unidade */}
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={context.unit} onValueChange={(v) => setContext((c) => ({ ...c, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ✅ CORRIGIDO: Médico padrão do contexto — agora com dica atualizada */}
              <div className="space-y-2">
                <Label>Médico padrão do lote (opcional)</Label>
                <Select
                  value={context.doctor_id ?? "__NONE__"} // ✅ ?? correto: undefined e null caem no __NONE__, "" não interfere
                  onValueChange={(v) => setContext((c) => ({ ...c, doctor_id: v === "__NONE__" ? undefined : v }))} // ✅ undefined semânticamente correto — evita string vazia chegar na RPC
                >
                  <SelectTrigger>
                    <SelectValue placeholder={doctorsLoading ? "Carregando..." : "Sem médico"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">Sem médico</SelectItem>
                    {doctorOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ✅ CORRIGIDO: Dica mais clara sobre como o CSV amarra o médico */}
                <p className="text-xs text-muted-foreground">
                  Use a coluna <b>medico</b> no CSV para definir o médico por linha (nome exato do cadastro). Se a linha
                  não tiver médico, este padrão será usado. Sem nenhum dos dois, fica sem médico.
                </p>
              </div>

              {/* Competência */}
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

              {/* Pagador */}
              <div className="space-y-2">
                <Label>Pagador *</Label>
                <Select
                  value={context.payer_type}
                  onValueChange={(v) =>
                    setContext((c) => ({
                      ...c,
                      payer_type: v as "CONVENIO" | "PARTICULAR",
                      convenio: v === "PARTICULAR" ? "" : c.convenio,
                      payment_method: v === "CONVENIO" ? "" : c.payment_method,
                    }))
                  }
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

              {/* Convênio */}
              {context.payer_type === "CONVENIO" && (
                <div className="space-y-2 col-span-2">
                  <Label>Convênio *</Label>
                  <Select value={context.convenio} onValueChange={(v) => setContext((c) => ({ ...c, convenio: v }))}>
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

              {/* Modo de Pagamento */}
              {context.payer_type === "PARTICULAR" && (
                <div className="space-y-2 col-span-2">
                  <Label>Modo de Pagamento *</Label>
                  {(() => {
                    const allMethods = extendedSettings?.paymentMethodsParticular?.length
                      ? extendedSettings.paymentMethodsParticular
                      : DEFAULT_PAYMENT_METHODS_PARTICULAR;
                    const activeMethods = allMethods.filter((m) => m.active);

                    return (
                      <Select
                        value={context.payment_method}
                        onValueChange={(v) => setContext((c) => ({ ...c, payment_method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeMethods.map((pm) => (
                            <SelectItem key={pm.id} value={pm.id}>
                              {pm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
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
              <div className="font-medium mb-1 flex items-center gap-2">
                Contexto do Lote:
                {isPackageImport && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Package className="h-3 w-3" />
                    Pacote
                  </Badge>
                )}
              </div>
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
                    {context.payer_type === "PARTICULAR"
                      ? "Particular"
                      : payers.find((p: any) => p.id === context.convenio)?.name || context.convenio}
                  </strong>
                </span>
                {context.payer_type === "PARTICULAR" && context.payment_method && (
                  <span>
                    Pagamento:{" "}
                    <strong>
                      {(extendedSettings?.paymentMethodsParticular ?? DEFAULT_PAYMENT_METHODS_PARTICULAR).find(
                        (p) => p.id === context.payment_method,
                      )?.name || context.payment_method}
                    </strong>
                  </span>
                )}
                {/* ✅ NOVO: Exibir médico padrão do lote no resumo */}
                {context.doctor_id && (
                  <span>
                    Médico padrão: <strong>{doctorIdToName.get(context.doctor_id) || "—"}</strong>
                  </span>
                )}
              </div>
              {isPackageImport && (
                <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  <span className="text-foreground font-medium">Breakdown automático:</span> Consulta + Box/Taxa +
                  Mat/Med = Total (usando regras de precificação do convênio selecionado)
                </div>
              )}
            </div>

            {/* Upload area */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input type="file" accept=".csv" onChange={handleFileUpload} className="cursor-pointer" />
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Baixar modelo CSV
              </Button>
            </div>

            {/* Resumo de linhas */}
            {parsedRows.length > 0 && (
              <>
                {/* Stats */}
                <div className="flex flex-wrap gap-4 text-sm py-2 px-3 bg-muted/30 rounded-md">
                  <span>
                    Total: <strong>{summary.total}</strong>
                  </span>
                  <span className="text-green-600">
                    Novas: <strong>{summary.newCount}</strong>
                  </span>
                  <span className="text-destructive">
                    Com erro: <strong>{summary.invalidCount}</strong>
                  </span>
                  <span className="text-amber-600">
                    Duplicadas: <strong>{summary.duplicateCount}</strong>
                  </span>
                  <span className="ml-auto">
                    Valor novas: <strong>{formatCurrency(summary.newTotalValue)}</strong>
                  </span>
                </div>

                {/* Filtros e busca */}
                <div className="flex flex-wrap items-center gap-2 py-2">
                  <div className="flex items-center gap-1 border rounded-md p-0.5">
                    <Button
                      variant={filterType === "all" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterType("all")}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filterType === "errors" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterType("errors")}
                    >
                      Só erros
                    </Button>
                    <Button
                      variant={filterType === "duplicates" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterType("duplicates")}
                    >
                      Só duplicadas
                    </Button>
                    <Button
                      variant={filterType === "new" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterType("new")}
                    >
                      Só novas
                    </Button>
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Buscar por paciente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Exibindo {filteredAndSortedRows.length} de {parsedRows.length}
                  </span>
                </div>

                {/* Tabela de conferência */}
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[340px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead
                            className="w-14 text-xs cursor-pointer select-none"
                            onClick={() => toggleSort("rowNumber")}
                          >
                            <span className="flex items-center gap-1">
                              Linha
                              {sortField === "rowNumber" && <ArrowUpDown className="h-3 w-3" />}
                            </span>
                          </TableHead>
                          <TableHead
                            className="w-24 text-xs cursor-pointer select-none"
                            onClick={() => toggleSort("date")}
                          >
                            <span className="flex items-center gap-1">
                              Data
                              {sortField === "date" && <ArrowUpDown className="h-3 w-3" />}
                            </span>
                          </TableHead>
                          <TableHead className="text-xs">Paciente</TableHead>
                          <TableHead className="text-xs">Médico</TableHead>
                          <TableHead className="w-24 text-right text-xs">Valor</TableHead>
                          {isPackageImport && (
                            <>
                              <TableHead className="w-20 text-right text-xs">Consulta</TableHead>
                              <TableHead className="w-20 text-right text-xs">Box/Taxa</TableHead>
                              <TableHead className="w-20 text-right text-xs">Mat/Med</TableHead>
                            </>
                          )}
                          <TableHead
                            className="w-24 text-center text-xs cursor-pointer select-none"
                            onClick={() => toggleSort("status")}
                          >
                            <span className="flex items-center justify-center gap-1">
                              Status
                              {sortField === "status" && <ArrowUpDown className="h-3 w-3" />}
                            </span>
                          </TableHead>
                          <TableHead className="text-xs">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedRows.map((row) => (
                          <TableRow
                            key={row.rowNumber}
                            className={
                              row.status === "ERRO"
                                ? "bg-destructive/5"
                                : row.status === "DUPLICADA"
                                  ? "bg-amber-500/5"
                                  : ""
                            }
                          >
                            <TableCell className="text-muted-foreground font-mono text-xs py-1.5">
                              {row.rowNumber}
                            </TableCell>
                            <TableCell className="py-1.5 text-sm">
                              {row.production_date ? format(parseDateOnly(row.production_date), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className="py-1.5 text-sm truncate max-w-[150px]">
                              {row.paciente_nome || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            {/* ✅ CORRIGIDO: Exibição do médico na tabela — mostra fonte (linha vs contexto) */}
                            <TableCell className="py-1.5 text-sm truncate max-w-[220px]">
                              {row.doctor_name ? (
                                <Badge variant="secondary" className="text-[11px]">
                                  {row.doctor_name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">sem médico</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-1.5 font-mono text-sm">
                              {row.unit_value !== null ? formatCurrency(row.unit_value) : "-"}
                            </TableCell>
                            {isPackageImport && (
                              <>
                                <TableCell className="text-right py-1.5 font-mono text-xs text-muted-foreground">
                                  {row.isValid && row.consultAmount ? formatCurrency(row.consultAmount) : "-"}
                                </TableCell>
                                <TableCell className="text-right py-1.5 font-mono text-xs text-muted-foreground">
                                  {row.isValid && row.feeAmount ? formatCurrency(row.feeAmount) : "-"}
                                </TableCell>
                                <TableCell className="text-right py-1.5 font-mono text-xs text-muted-foreground">
                                  {row.isValid && row.matmedAmount !== undefined
                                    ? formatCurrency(row.matmedAmount)
                                    : "-"}
                                </TableCell>
                              </>
                            )}
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
                  </div>
                </div>

                {/* Toggle duplicadas */}
                {hasDuplicates && (
                  <div className="flex items-start space-x-3 p-3 border rounded-md bg-amber-500/5 border-amber-500/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-medium text-amber-800">
                        Existem {summary.duplicateCount} linha(s) duplicada(s). Por padrão, serão importadas apenas as{" "}
                        <strong>{summary.newCount}</strong> linhas novas.
                      </p>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="include-duplicates"
                          checked={includeDuplicates}
                          onCheckedChange={setIncludeDuplicates}
                        />
                        <Label htmlFor="include-duplicates" className="text-sm cursor-pointer">
                          Incluir duplicadas na importação
                        </Label>
                      </div>

                      {includeDuplicates && (
                        <div className="flex items-center space-x-2 pl-4 border-l-2 border-amber-400">
                          <Checkbox
                            id="confirm-duplicates"
                            checked={duplicatesConfirmed}
                            onCheckedChange={(checked) => setDuplicatesConfirmed(!!checked)}
                          />
                          <Label htmlFor="confirm-duplicates" className="text-sm cursor-pointer">
                            Confirmo que revisei as duplicidades
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Nenhuma linha */}
                {rowsToImportCount === 0 && summary.total > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nenhuma linha para importar. {summary.invalidCount > 0 && "Corrija os erros no CSV."}{" "}
                      {summary.duplicateCount > 0 &&
                        summary.newCount === 0 &&
                        "Todas as linhas válidas são duplicadas."}
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
                  variant={includeDuplicates && hasDuplicates ? "destructive" : "default"}
                >
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {includeDuplicates && hasDuplicates
                    ? `⚠️ Importar mesmo assim (${rowsToImportCount})`
                    : `Importar (${rowsToImportCount} novas)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
