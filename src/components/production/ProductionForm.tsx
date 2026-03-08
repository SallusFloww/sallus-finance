import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ProductionType, UnitConfig, BASE_PRODUCTION_TYPES } from "@/types";
import { toast } from "sonner";
import { Activity, Check, ChevronsUpDown, Plus, Calculator, Package, AlertCircle, Info, Layers, Copy, Trash2, Loader2, History as HistoryIcon, CheckCircle, ClipboardPaste } from "lucide-react";
import { SPECIALTIES, DEFAULT_PAYMENT_METHODS_PARTICULAR, PAYMENT_METHOD_PARTICULAR_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { usePackagePricing } from "@/hooks/usePackagePricing";
import { PackageFields } from "./PackageFields";
import { PRODUCTION_TYPE_LABELS } from "@/utils/constants";

// Função para obter label de tipo de produção
const getProductionTypeLabel = (type: string): string => {
  return PRODUCTION_TYPE_LABELS[type] || type;
};

// Tipos de pacote convênio
const PACKAGE_PRODUCTION_TYPES = ["PACOTE_BOX", "PACOTE_GTA"];

// ✅ Tipo Mat/Med (lançamento manual)
const MATMED_PRODUCTION_TYPE = "MAT_MED";

const CONVENIOS = ["IPASGO", "UNIMED", "BRADESCO", "GEAP", "SUS"];

// Sugestões padrão de exames
const DEFAULT_EXAM_TYPES = [
  "Ressonância Magnética",
  "Tomografia Computadorizada",
  "Raio-X",
  "Ultrassonografia",
  "Ecocardiograma",
  "Endoscopia",
  "Colonoscopia",
  "Eletrocardiograma",
  "Mamografia",
  "Densitometria Óssea",
];

// Sugestões padrão de sessões terapêuticas (exceto Quimio que agora é tipo próprio)
const DEFAULT_THERAPY_TYPES = [
  "Radioterapia",
  "Fisioterapia",
  "Terapia Ocupacional",
  "Hemodiálise",
  "Fonoaudiologia",
  "Psicoterapia",
];

// Tipos per-type values structure
interface PerTypeValue {
  quantity: string;
  totalValue: string;
  examType?: string;
  therapySessionType?: string;
}

interface ProductionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProductionFormData) => void;
  units: UnitConfig[];
  userName: string;
  /** P3-FIX: callback chamado após bulk insert bem-sucedido para forçar refetch mesmo se WebSocket estiver degradado */
  onBulkInsertSuccess?: (count?: number) => void;
  recentDescriptions?: string[];
}

interface BatchRow {
  id: string;
  description: string;
  procedureCode?: string;
  quantity: number;
  unitValue: number;
  convenio?: string;
  patientName?: string;
  error?: string;
  _justPasted?: boolean;
}

export interface ProductionFormData {
  productionDate: string;
  competencia: string;
  unit: string;
  specialty?: string;
  doctorId?: string;
  payerType: "CONVENIO" | "PARTICULAR";
  convenio?: string;
  // AUDIT_FIX: Campo forma de pagamento para PARTICULAR
  paymentMethod?: string;
  productionType: ProductionType;
  description: string;
  procedureCode?: string;
  quantity: number;
  unitValue: number;
  notes?: string;
  createdBy: string;
  // Campos dinâmicos
  examType?: string;
  therapySessionType?: string;
  // Campos de pacote convênio
  isPackage?: boolean;
  packageType?: string;
  packageQty?: number; // Quantidade de pacotes (explícito)
  consultAmount?: number;
  feeAmount?: number;
  matmedAmount?: number;
  consultQty?: number;
  feeQty?: number;
  matmedQty?: number;
}

export function ProductionForm({ open, onOpenChange, onSubmit, units, userName, onBulkInsertSuccess, recentDescriptions }: ProductionFormProps) {
  const currentMonth = format(new Date(), "MM/yyyy");

  // Use database-backed settings for suggestions
  const {
    settings,
    extendedSettings,
    getSavedExamTypes,
    getSavedTherapyTypes,
    getSavedProductionTypes,
    addExamType,
    addTherapyType,
    addProductionType,
  } = useCompanySettings();

  // Pricing hook para pacotes
  const { validateTotal } = usePackagePricing();
  // Médicos(as) - opcional (para análises por profissional)
  const { currentCompany, profile } = useAuth();
  const companyId = (currentCompany as any)?.id || (profile as any)?.company_id;

  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string; specialty_id?: string | null }[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  // Track if user manually changed the value (to prevent auto-fill overwrite)
  const [userOverrodeValue, setUserOverrodeValue] = useState(false);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!companyId) {
        setDoctorOptions([]);
        return;
      }

      try {
        setDoctorsLoading(true);
        const { data, error } = await supabase
          .from("doctors")
          .select("id, name, active, company_id, specialty_id")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) {
          if (import.meta.env.DEV) console.error(error);
          setDoctorOptions([]);
          return;
        }

        const normalized = (data ?? [])
          .map((d: any) => ({
            id: String(d?.id ?? ""),
            name: String(d?.name ?? "").trim(),
            specialty_id: d?.specialty_id ?? null,
          }))
          .filter((d: any) => Boolean(d.id) && Boolean(d.name));

        setDoctorOptions(normalized);
      } finally {
        setDoctorsLoading(false);
      }
    };

    // Só busca quando o modal abre, pra evitar fetch desnecessário
    if (open) fetchDoctors();
  }, [companyId, open]);

  // Combinar sugestões padrão com salvas do banco
  const savedExamTypes = getSavedExamTypes();
  const savedTherapyTypes = getSavedTherapyTypes();
  const savedProductionTypes = getSavedProductionTypes();

  // ===================================================================
  // EXAMES / PROCEDIMENTOS (FONTE ÚNICA OFICIAL)
  // ===================================================================
  const masterExamTypesRaw =
    (extendedSettings as any)?.examTypes ??
    (settings as any)?.examTypes ??
    (settings as any)?.exam_types ??
    (settings as any)?.production?.examTypes ??
    [];
  const masterExamNames = (
    Array.isArray(masterExamTypesRaw)
      ? masterExamTypesRaw
          .filter((e: any) => (e?.active ?? e?.is_active) === true)
          .map((e: any) => String(e?.name ?? "").trim())
          .filter(Boolean)
      : []
  ) as string[];

  const hasMasterExamTypes = masterExamNames.length > 0;

  const examTypes = [
    ...new Set(hasMasterExamTypes ? masterExamNames : [...DEFAULT_EXAM_TYPES, ...savedExamTypes]),
  ].sort();

  const therapyTypes = [...new Set([...DEFAULT_THERAPY_TYPES, ...savedTherapyTypes])].sort();

  // ✅ BASE_PRODUCTION_TYPES já contém MAT_MED — não duplicar.
  const customProductionTypes = savedProductionTypes.filter((name) => {
    const isBaseId = (BASE_PRODUCTION_TYPES as readonly string[]).includes(name);
    const isBaseLabel = Object.values(PRODUCTION_TYPE_LABELS).some(
      (label) => label.toLowerCase() === name.toLowerCase()
    );
    return !isBaseId && !isBaseLabel;
  });

  // Non-package production types (for multi-select checkboxes)
  const nonPackageProductionTypes = [
    ...new Set([
      ...BASE_PRODUCTION_TYPES,
      ...customProductionTypes,
    ]),
  ];

  // All production types (for legacy single-type flow compatibility)
  const productionTypes = [
    ...new Set([
      ...BASE_PRODUCTION_TYPES,
      ...PACKAGE_PRODUCTION_TYPES,
      ...customProductionTypes,
    ]),
  ];

  // ===================================================================
  // MULTI-TYPE STATE
  // ===================================================================
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["CONSULTA"]);
  const [perTypeValues, setPerTypeValues] = useState<Record<string, PerTypeValue>>({
    CONSULTA: { quantity: "1", totalValue: "" },
  });

  // Shared form data (everything that is NOT per-type)
  const [formData, setFormData] = useState({
    productionDate: format(new Date(), "yyyy-MM-dd"),
    competencia: currentMonth,
    unit: "",
    specialty: "",
    doctorId: "",
    payerType: "CONVENIO" as "CONVENIO" | "PARTICULAR",
    convenio: "",
    paymentMethod: "",
    description: "",
    procedureCode: "",
    notes: "",
    // Package-specific (only used when a package type is selected alone)
    consultAmount: 0,
    feeAmount: 0,
    matmedAmount: 0,
    consultQty: 1,
    feeQty: 1,
    matmedQty: 0,
    isManualOverride: false,
  });

  // Popover states for exam/therapy sub-selects (used in single-type mode)
  const [examTypeOpen, setExamTypeOpen] = useState(false);
  const [therapyTypeOpen, setTherapyTypeOpen] = useState(false);
  const [newExamType, setNewExamType] = useState("");
  const [newTherapyType, setNewTherapyType] = useState("");
  // Multi-type inline popovers: keyed by type
  const [inlineExamTypeOpen, setInlineExamTypeOpen] = useState<Record<string, boolean>>({});
  const [inlineTherapyTypeOpen, setInlineTherapyTypeOpen] = useState<Record<string, boolean>>({});
  const [inlineNewExamType, setInlineNewExamType] = useState<Record<string, string>>({});
  const [inlineNewTherapyType, setInlineNewTherapyType] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ===================================================================
  // BATCH MODE STATE
  // ===================================================================
  const [entryMode, setEntryMode] = useState<"single" | "batch">("single");
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unitValue: 0, convenio: "", patientName: "" }
  ]);
  const [batchSaving, setBatchSaving] = useState(false);

  // Autocomplete for description
  const [descOpen, setDescOpen] = useState(false);

  const addBatchRow = () => {
    const last = batchRows[batchRows.length - 1];
    setBatchRows(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitValue: last?.unitValue ?? 0,
        convenio: last?.convenio ?? "",
        patientName: "",
      }
    ]);
  };

  const updateBatchRow = (id: string, field: keyof BatchRow, value: any) =>
    setBatchRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, error: undefined } : r));

  const removeBatchRow = (id: string) =>
    setBatchRows(prev => prev.filter(r => r.id !== id));

  const duplicateBatchRow = (id: string) => {
    const row = batchRows.find(r => r.id === id);
    if (!row) return;
    const newRow = { ...row, id: crypto.randomUUID(), patientName: "" };
    setBatchRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  // ===================================================================
  // PASTE-TO-GRID: Smart Excel paste parser
  // ===================================================================
  const parseExcelPaste = (text: string): BatchRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const toNumber = (s: string): number | null => {
      if (!s) return null;
      const normalized = s.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      return isNaN(n) ? null : n;
    };

    const isNumeric = (s: string) => toNumber(s) !== null;

    return lines
      .map(line => {
        const parts = line.split(/\t|;(?=\s*\S)/).map(p => p.trim());

        let description = "";
        let patientName = "";
        let quantity = 1;
        let unitValue = 0;

        if (parts.length === 1) {
          description = parts[0];
        } else if (parts.length === 2) {
          description = parts[0];
          unitValue = toNumber(parts[1]) ?? 0;
        } else if (parts.length === 3) {
          description = parts[0];
          if (isNumeric(parts[1])) {
            quantity = toNumber(parts[1]) ?? 1;
            unitValue = toNumber(parts[2]) ?? 0;
          } else {
            patientName = parts[1];
            unitValue = toNumber(parts[2]) ?? 0;
          }
        } else if (parts.length >= 4) {
          description = parts[0];
          patientName = isNumeric(parts[1]) ? "" : parts[1];
          const qtyIdx = isNumeric(parts[1]) ? 1 : 2;
          const valIdx = qtyIdx + 1;
          quantity = toNumber(parts[qtyIdx]) ?? 1;
          unitValue = toNumber(parts[valIdx]) ?? 0;
        }

        return {
          id: crypto.randomUUID(),
          description,
          procedureCode: "",
          quantity: Math.max(1, quantity),
          unitValue: Math.max(0, unitValue),
          convenio: batchRows[batchRows.length - 1]?.convenio ?? "",
          patientName,
          error: undefined,
          _justPasted: true,
        } as BatchRow;
      })
      .filter(r => r.description.trim() !== "");
  };

  const handlePasteRows = useCallback((text: string) => {
    const parsed = parseExcelPaste(text);

    if (!parsed.length) return;

    if (parsed.length > 200) {
      toast.error(`Limite de 200 linhas por colagem. Você tentou colar ${parsed.length} linhas.`);
      return;
    }

    setBatchRows(prev => {
      const isGridEmpty = prev.length === 1 && !prev[0].description.trim();
      return isGridEmpty ? parsed : [...prev, ...parsed];
    });

    toast.success(`${parsed.length} linha${parsed.length > 1 ? "s" : ""} importada${parsed.length > 1 ? "s" : ""} do Excel`);

    // Remove highlight after 1.5s
    setTimeout(() => {
      setBatchRows(prev => prev.map(r => ({ ...r, _justPasted: false })));
    }, 1500);

    // Scroll to bottom
    setTimeout(() => {
      const grid = document.querySelector("[data-batch-grid]");
      if (grid) grid.scrollTop = grid.scrollHeight;
    }, 100);
  }, [batchRows]);

  // Paste listener: only in batch mode, only when not focused on input
  useEffect(() => {
    if (!open || entryMode !== "batch") return;

    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toUpperCase();

      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;

      const isTabular = text.includes("\t") || text.includes("\n");
      if (!isTabular) return;

      e.preventDefault();
      handlePasteRows(text);
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, entryMode, handlePasteRows]);

  const handleBatchSubmit = async () => {
    const validRows = batchRows.filter(r => r.description.trim() !== "");

    if (!validRows.length) {
      toast.error("Preencha ao menos uma linha");
      return;
    }

    if (!formData.unit) {
      toast.error("Selecione a unidade");
      return;
    }

    const withError = batchRows.map(r => {
      if (!r.description.trim()) return r;
      if (r.unitValue <= 0) return { ...r, error: "Valor obrigatório" };
      return r;
    });

    if (withError.some(r => r.error)) {
      setBatchRows(withError);
      toast.error("Corrija as linhas marcadas antes de confirmar");
      return;
    }

    setBatchSaving(true);
    try {
      const productionType = selectedTypes[0] || "CONSULTA";
      const CHUNK = 10;
      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK);
        await Promise.all(chunk.map(({ _justPasted, error, ...row }) =>
          onSubmit({
            productionDate: formData.productionDate,
            competencia: formData.competencia,
            unit: formData.unit,
            productionType: productionType as ProductionType,
            description: row.description.trim(),
            procedureCode: row.procedureCode?.trim() || undefined,
            quantity: row.quantity,
            unitValue: row.unitValue,
            payerType: (row.convenio && row.convenio !== "PARTICULAR") ? "CONVENIO" : "PARTICULAR",
            convenio: (row.convenio && row.convenio !== "PARTICULAR") ? row.convenio : undefined,
            createdBy: userName,
            ...(row.patientName?.trim() ? { pacienteNome: row.patientName.trim() } : {}),
          })
        ));
      }

      toast.success(`${validRows.length} produções registradas com sucesso!`);
      onOpenChange(false);
      setBatchRows([{ id: crypto.randomUUID(), description: "", quantity: 1, unitValue: 0, convenio: "", patientName: "" }]);
      onBulkInsertSuccess?.(validRows.length);
    } catch (err) {
      toast.error("Erro ao salvar lote. Verifique os dados e tente novamente.");
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setBatchSaving(false);
    }
  };

  // Derived flags
  const isSinglePackage =
    selectedTypes.length === 1 && PACKAGE_PRODUCTION_TYPES.includes(selectedTypes[0]);
  const isMultiType = selectedTypes.length > 1;
  const isSingleNonPackage =
    selectedTypes.length === 1 && !PACKAGE_PRODUCTION_TYPES.includes(selectedTypes[0]);

  // For backward compat in renderDynamicFields and getQuantityLabel (single-type only)
  const activeProductionType: string = isSingleNonPackage
    ? selectedTypes[0]
    : isSinglePackage
    ? selectedTypes[0]
    : "";

  // Locale-aware decimal parser (handles both "910.85" and "910,85")
  const toNum = (s?: string): number => {
    if (!s || s === "") return 0;
    let str = String(s).trim().replace(/[¤$\u20AC£¥\s]/g, "");
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  // ===================================================================
  // REAL-TIME TOTALS (pre-check display)
  // ===================================================================
  const totals = useMemo(() => {
    const totalValue = selectedTypes.reduce(
      (acc, t) => acc + toNum(perTypeValues[t]?.totalValue),
      0
    );
    const totalQty = selectedTypes.reduce(
      (acc, t) => acc + (toNum(perTypeValues[t]?.quantity) || 1),
      0
    );
    return { totalValue, totalQty };
  }, [selectedTypes, perTypeValues]);

  const formattedTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(totals.totalValue);

  // CORREÇÃO #1: Garantir unidades ativas - usar settings.units se units prop estiver vazia
  const effectiveUnits = settings?.units && settings.units.length > 0
    ? settings.units
    : (units && units.length > 0 ? units : []);
  const activeUnits = effectiveUnits.filter((u) => u.active);

  const selectedUnit = effectiveUnits.find((u) => u.id === formData.unit);

  // CORREÇÃO FORENSE: Normalização robusta para detectar Centro Clínico
  const norm = (s?: string) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s\-_]+/g, "");
  const unitKey = norm(selectedUnit?.id) + " " + norm(selectedUnit?.name);
  const isCentroClinico = unitKey.includes("centroclinico");

  // CORREÇÃO FORENSE: Especialidades com fallback para constantes padrão
  const masterSpecialties = extendedSettings?.specialties?.filter((s) => s.active) ?? [];
  const specialtyOptions =
    masterSpecialties.length > 0
      ? masterSpecialties
      : SPECIALTIES.map((s) => ({ id: s.id, name: s.name, active: true }));
  const hasCustomSpecialties = masterSpecialties.length > 0;

  // Descrição automática por tipo
  const getDefaultDescription = (type: string): string => {
    switch (type) {
      case "CONSULTA":
        return "Consulta Médica";
      case "QUIMIOTERAPIA":
        return "Sessão de Quimioterapia";
      case "BOX_PS":
        return "Atendimento Box/PS";
      case "INTERNACAO":
        return "Internação";
      case "PACOTE_BOX":
      return "Pacote Box";
      case "PACOTE_GTA":
        return "Pacote GTA";
      case MATMED_PRODUCTION_TYPE:
        return "Materiais e Medicamentos";
      default:
        return getProductionTypeLabel(type) || type;
    }
  };

  // ===================================================================
  // RESET when modal closes/opens
  // ===================================================================
  useEffect(() => {
    if (!open) return;
    setSelectedTypes(["CONSULTA"]);
    setPerTypeValues({ CONSULTA: { quantity: "1", totalValue: "" } });
    setFormData({
      productionDate: format(new Date(), "yyyy-MM-dd"),
      competencia: currentMonth,
      unit: "",
      specialty: "",
      doctorId: "",
      payerType: "CONVENIO",
      convenio: "",
      paymentMethod: "",
      description: "",
      procedureCode: "",
      notes: "",
      consultAmount: 0,
      feeAmount: 0,
      matmedAmount: 0,
      consultQty: 1,
      feeQty: 1,
      matmedQty: 0,
      isManualOverride: false,
    });
    setInlineExamTypeOpen({});
    setInlineTherapyTypeOpen({});
    setInlineNewExamType({});
    setInlineNewTherapyType({});
    setNewExamType("");
    setNewTherapyType("");
    setExamTypeOpen(false);
    setTherapyTypeOpen(false);
    setEntryMode("single");
    setBatchRows([{ id: crypto.randomUUID(), description: "", quantity: 1, unitValue: 0, convenio: "", patientName: "" }]);
    setDescOpen(false);
  }, [open]);

  // Reset specialty when unit changes and is not Centro Clínico
  useEffect(() => {
    if (!isCentroClinico && formData.specialty) {
      setFormData((prev) => ({ ...prev, specialty: "" }));
    }
  }, [formData.unit, isCentroClinico]);

  // When switching to a package type, reset breakdown fields (but don't force payerType)
  useEffect(() => {
    if (isSinglePackage) {
      setFormData((prev) => ({
        ...prev,
        consultAmount: 0,
        feeAmount: 0,
        matmedAmount: 0,
        consultQty: 1,
        feeQty: 1,
        matmedQty: 0,
        isManualOverride: false,
      }));
    }
  }, [isSinglePackage, selectedTypes[0]]);

  // Format competencia (MM/YYYY)
  const formatCompetencia = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    const limited = numbers.slice(0, 6);
    if (limited.length > 2) {
      return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    }
    return limited;
  };

  const validateCompetencia = (value: string): boolean => {
    const regex = /^(0[1-9]|1[0-2])\/\d{4}$/;
    if (!regex.test(value)) return false;
    const [month, year] = value.split("/").map(Number);
    return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
  };

  // ===================================================================
  // TOGGLE TYPE (multi-select logic)
  // ===================================================================
  const toggleType = (type: string) => {
    const isPackage = PACKAGE_PRODUCTION_TYPES.includes(type);

    if (isPackage) {
      // Package: exclusive single-select
      setSelectedTypes([type]);
      setPerTypeValues({ [type]: { quantity: "1", totalValue: "" } });
      return;
    }

    // Non-package: clear any package first
    const hadPackage = selectedTypes.some((t) => PACKAGE_PRODUCTION_TYPES.includes(t));

    if (selectedTypes.includes(type)) {
      // Uncheck — minimum 1 must remain
      const next = selectedTypes.filter((t) => t !== type);
      if (next.length === 0) return; // Don't allow empty selection
      setSelectedTypes(next);
      setPerTypeValues((prev) => {
        const c = { ...prev };
        delete c[type];
        return c;
      });
    } else {
      // Check — if had package, clear it first
      const base = hadPackage ? [] : selectedTypes;
      setSelectedTypes([...base, type]);
      setPerTypeValues((prev) => ({
        ...(hadPackage ? {} : prev),
        [type]: { quantity: "1", totalValue: "" },
      }));
    }
  };

  const updatePerTypeValue = (type: string, field: keyof PerTypeValue, value: string) => {
    setPerTypeValues((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  // ===================================================================
  // SAVE NEW SUGGESTIONS
  // ===================================================================
  const saveNewExamType = async (typeKey?: string) => {
    const val = typeKey ? (inlineNewExamType[typeKey] || "").trim() : newExamType.trim();
    if (hasMasterExamTypes) {
      toast.info("Este campo está sincronizado com Configurações → Exames. Cadastre/edite por lá.");
      if (typeKey) {
        setInlineNewExamType((prev) => ({ ...prev, [typeKey]: "" }));
        setInlineExamTypeOpen((prev) => ({ ...prev, [typeKey]: false }));
      } else {
        setNewExamType("");
        setExamTypeOpen(false);
      }
      return;
    }
    if (val && !examTypes.includes(val)) {
      await addExamType(val);
      toast.success(`"${val}" adicionado às sugestões`);
    }
    if (typeKey) {
      if (val) updatePerTypeValue(typeKey, "examType", val);
      setInlineNewExamType((prev) => ({ ...prev, [typeKey]: "" }));
      setInlineExamTypeOpen((prev) => ({ ...prev, [typeKey]: false }));
    } else {
      if (val) setPerTypeValues((prev) => ({ ...prev, [activeProductionType]: { ...prev[activeProductionType], examType: val } }));
      setNewExamType("");
      setExamTypeOpen(false);
    }
  };

  const saveNewTherapyType = async (typeKey?: string) => {
    const val = typeKey ? (inlineNewTherapyType[typeKey] || "").trim() : newTherapyType.trim();
    if (val && !therapyTypes.includes(val)) {
      await addTherapyType(val);
      toast.success(`"${val}" adicionado às sugestões`);
    }
    if (typeKey) {
      if (val) updatePerTypeValue(typeKey, "therapySessionType", val);
      setInlineNewTherapyType((prev) => ({ ...prev, [typeKey]: "" }));
      setInlineTherapyTypeOpen((prev) => ({ ...prev, [typeKey]: false }));
    } else {
      if (val) setPerTypeValues((prev) => ({ ...prev, [activeProductionType]: { ...prev[activeProductionType], therapySessionType: val } }));
      setNewTherapyType("");
      setTherapyTypeOpen(false);
    }
  };

  const saveNewProductionType = async (name: string) => {
    if (name.trim() && !productionTypes.includes(name.trim())) {
      await addProductionType(name.trim());
      toggleType(name.trim());
      toast.success(`"${name.trim()}" adicionado aos tipos de produção`);
    }
  };

  // ===================================================================
  // RENDER DYNAMIC FIELDS (single-type mode only)
  // ===================================================================
  const renderDynamicFields = () => {
    switch (activeProductionType) {
      case "CONSULTA":
        return (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-emerald-600 font-medium">✓ Consulta Médica</p>
            <p className="text-xs text-muted-foreground mt-1">Registro simples de consulta</p>
          </div>
        );

      case "EXAME":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Exame *</Label>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                {hasMasterExamTypes
                  ? "Sincronizado com Configurações → Exames"
                  : "Usando lista padrão (cadastre em Configurações → Exames para personalizar)"}
              </p>
              <Popover open={examTypeOpen} onOpenChange={setExamTypeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={examTypeOpen}
                    className="w-full justify-between"
                  >
                    {perTypeValues["EXAME"]?.examType || "Selecione ou digite..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar ou adicionar exame..."
                      value={newExamType}
                      onValueChange={setNewExamType}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2">
                          <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => saveNewExamType()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar "{newExamType}"
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {examTypes.map((type) => (
                          <CommandItem
                            key={type}
                            value={type}
                            onSelect={() => {
                              updatePerTypeValue("EXAME", "examType", type);
                              setExamTypeOpen(false);
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", perTypeValues["EXAME"]?.examType === type ? "opacity-100" : "opacity-0")}
                            />
                            {type}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Código do Exame (opcional)</Label>
              <Input
                placeholder="Ex: 40901033 (TUSS/AMB)"
                value={formData.procedureCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, procedureCode: e.target.value }))}
              />
            </div>
          </div>
        );

      case "QUIMIOTERAPIA":
        return (
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-purple-600 font-medium">💊 Quimioterapia</p>
            <p className="text-xs text-muted-foreground mt-1">Registre quantidade de sessões e valor total agregado</p>
          </div>
        );

      case "BOX_PS":
        return (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-600 font-medium">🚨 Box / Atendimento PS</p>
            <p className="text-xs text-muted-foreground mt-1">Registre quantidade de atendimentos</p>
          </div>
        );

      case "SESSAO_TERAPEUTICA":
        return (
          <div className="space-y-2">
            <Label>Tipo da Sessão *</Label>
            <Popover open={therapyTypeOpen} onOpenChange={setTherapyTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={therapyTypeOpen}
                  className="w-full justify-between"
                >
                  {perTypeValues["SESSAO_TERAPEUTICA"]?.therapySessionType || "Selecione ou digite..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar ou adicionar tipo..."
                    value={newTherapyType}
                    onValueChange={setNewTherapyType}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2">
                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => saveNewTherapyType()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar "{newTherapyType}"
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {therapyTypes.map((type) => (
                        <CommandItem
                          key={type}
                          value={type}
                          onSelect={() => {
                            updatePerTypeValue("SESSAO_TERAPEUTICA", "therapySessionType", type);
                            setTherapyTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              perTypeValues["SESSAO_TERAPEUTICA"]?.therapySessionType === type ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {type}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );

      case "INTERNACAO":
        return (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-600 font-medium">🏥 Internação</p>
            <p className="text-xs text-muted-foreground mt-1">Registre quantidade de internações e valor total</p>
          </div>
        );

      case MATMED_PRODUCTION_TYPE:
        return (
          <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <p className="text-sm text-sky-700 font-medium">🧾 Mat/Med</p>
            <p className="text-xs text-muted-foreground mt-1">
              Materiais e medicamentos. Use quantidade + valor total estimado como referência.
            </p>
          </div>
        );

      case "OUTRO":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição do Procedimento *</Label>
              <Input
                placeholder="Descreva o procedimento realizado"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Código (opcional)</Label>
              <Input
                placeholder="Código TUSS/AMB ou interno"
                value={formData.procedureCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, procedureCode: e.target.value }))}
              />
            </div>
          </div>
        );

      case "PACOTE_BOX":
      case "PACOTE_GTA":
        return (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <p className="text-sm text-primary font-medium">
                {activeProductionType === "PACOTE_BOX" ? "📦 Pacote Box (Convênio)" : "📦 Pacote GTA (Convênio)"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Consulta + Taxa/Box + Mat/Med em pacote único. Preencha convênio e valor total abaixo.
            </p>
          </div>
        );

      default:
        return (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium">{getProductionTypeLabel(activeProductionType)}</p>
            <p className="text-xs text-muted-foreground mt-1">Tipo de produção personalizado</p>
          </div>
        );
    }
  };

  // ===================================================================
  // RENDER INLINE SUB-FIELD (for multi-type mode: EXAME / SESSAO_TERAPEUTICA)
  // ===================================================================
  const renderInlineSubField = (type: string) => {
    if (type === "EXAME") {
      const currentVal = perTypeValues[type]?.examType || "";
      const popOpen = inlineExamTypeOpen[type] || false;
      const inputVal = inlineNewExamType[type] || "";
      return (
        <div className="mt-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de Exame *</Label>
          <Popover
            open={popOpen}
            onOpenChange={(v) => setInlineExamTypeOpen((prev) => ({ ...prev, [type]: v }))}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-8 text-sm" size="sm">
                {currentVal || "Selecione o exame..."}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar exame..."
                  value={inputVal}
                  onValueChange={(v) => setInlineNewExamType((prev) => ({ ...prev, [type]: v }))}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2">
                      <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => saveNewExamType(type)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar "{inputVal}"
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {examTypes.map((et) => (
                      <CommandItem
                        key={et}
                        value={et}
                        onSelect={() => {
                          updatePerTypeValue(type, "examType", et);
                          setInlineExamTypeOpen((prev) => ({ ...prev, [type]: false }));
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", currentVal === et ? "opacity-100" : "opacity-0")} />
                        {et}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    if (type === "SESSAO_TERAPEUTICA") {
      const currentVal = perTypeValues[type]?.therapySessionType || "";
      const popOpen = inlineTherapyTypeOpen[type] || false;
      const inputVal = inlineNewTherapyType[type] || "";
      return (
        <div className="mt-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de Sessão *</Label>
          <Popover
            open={popOpen}
            onOpenChange={(v) => setInlineTherapyTypeOpen((prev) => ({ ...prev, [type]: v }))}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-8 text-sm" size="sm">
                {currentVal || "Selecione a sessão..."}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar sessão..."
                  value={inputVal}
                  onValueChange={(v) => setInlineNewTherapyType((prev) => ({ ...prev, [type]: v }))}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2">
                      <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => saveNewTherapyType(type)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar "{inputVal}"
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {therapyTypes.map((tt) => (
                      <CommandItem
                        key={tt}
                        value={tt}
                        onSelect={() => {
                          updatePerTypeValue(type, "therapySessionType", tt);
                          setInlineTherapyTypeOpen((prev) => ({ ...prev, [type]: false }));
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", currentVal === tt ? "opacity-100" : "opacity-0")} />
                        {tt}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    return null;
  };

  // Determinar se é pacote convênio (single package selected)
  const isPackageType = isSinglePackage;

  // Determinar label de quantidade por tipo (single-type mode)
  const getQuantityLabel = (): string => {
    switch (activeProductionType) {
      case "QUIMIOTERAPIA":
      case "SESSAO_TERAPEUTICA":
        return "Quantidade de Sessões *";
      case "INTERNACAO":
        return "Quantidade de Internações *";
      case "CONSULTA":
        return "Quantidade de Consultas *";
      case "BOX_PS":
        return "Quantidade de Atendimentos *";
      default:
        return "Quantidade *";
    }
  };

  // Single-type quantity/value (from perTypeValues for the single active type)
  const singleQuantity = isSingleNonPackage ? (perTypeValues[selectedTypes[0]]?.quantity || "1") : "";
  const singleTotalValue = isSingleNonPackage ? (perTypeValues[selectedTypes[0]]?.totalValue || "") : "";
  // Package uses its own qty/value fields (stored in perTypeValues[packageType])
  const packageQuantity = isSinglePackage ? (perTypeValues[selectedTypes[0]]?.quantity || "1") : "1";
  const packageTotalValue = isSinglePackage ? (perTypeValues[selectedTypes[0]]?.totalValue || "") : "";

  const calculatedUnitValue = (() => {
    const qty = parseInt(singleQuantity || packageQuantity) || 0;
    const val = toNum(singleTotalValue || packageTotalValue);
    return qty > 0 ? val / qty : 0;
  })();

  // ===================================================================
  // HANDLE SUBMIT
  // ===================================================================
  const handleSubmit = async () => {
    if (!formData.unit || !formData.competencia) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (isCentroClinico && !formData.specialty) {
      toast.error("Selecione a especialidade para Centro Clínico");
      return;
    }

    if (!validateCompetencia(formData.competencia)) {
      toast.error("Competência inválida. Use o formato MM/AAAA");
      return;
    }

    if (formData.payerType === "CONVENIO" && !formData.convenio) {
      toast.error("Selecione o convênio");
      return;
    }

    if (formData.payerType === "PARTICULAR" && !formData.paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    if (selectedTypes.length === 0) {
      toast.error("Selecione ao menos um tipo de produção");
      return;
    }

    // ----------------------------------------------------------------
    // SINGLE PACKAGE — existing flow unchanged
    // ----------------------------------------------------------------
    if (isSinglePackage) {
      const pkgType = selectedTypes[0];
      const pkgQty = parseInt(packageQuantity) || 1;
      const pkgTotal = toNum(packageTotalValue);

      if (pkgTotal <= 0) {
        toast.error("Informe o valor total do pacote");
        return;
      }
      // Para CONVENIO, validar convenio selecionado e regra de total
      if (formData.payerType === "CONVENIO") {
        if (!formData.convenio) {
          toast.error("Selecione o convênio");
          return;
        }
        const validation = validateTotal(
          pkgTotal,
          formData.convenio,
          pkgType as "PACOTE_BOX" | "PACOTE_GTA",
          formData.productionDate,
          pkgQty,
        );
        if (!validation.valid) {
          toast.error(validation.message);
          return;
        }
      }
      // Para PARTICULAR, validar forma de pagamento (já validado acima)

      const planIdForPackage = formData.payerType === "PARTICULAR" ? "PARTICULAR" : formData.convenio;

      const unitValue = pkgQty > 0 ? pkgTotal / pkgQty : 0;
      onSubmit({
        productionDate: formData.productionDate,
        competencia: formData.competencia,
        unit: formData.unit,
        specialty: formData.specialty || undefined,
        doctorId: formData.doctorId || undefined,
        payerType: formData.payerType,
        convenio: formData.payerType === "CONVENIO" ? formData.convenio : undefined,
        paymentMethod: formData.payerType === "PARTICULAR" ? formData.paymentMethod : undefined,
        productionType: pkgType as ProductionType,
        description: getProductionTypeLabel(pkgType),
        procedureCode: formData.procedureCode || undefined,
        quantity: pkgQty,
        unitValue,
        notes: formData.notes || undefined,
        createdBy: userName,
        isPackage: true,
        packageType: pkgType,
        packageQty: pkgQty,
        consultAmount: formData.consultAmount,
        feeAmount: formData.feeAmount,
        matmedAmount: formData.matmedAmount,
        consultQty: formData.consultQty,
        feeQty: formData.feeQty,
        matmedQty: formData.matmedQty,
      });
      onOpenChange(false);
      return;
    }

    // ----------------------------------------------------------------
    // SINGLE NON-PACKAGE — existing flow via onSubmit
    // ----------------------------------------------------------------
    if (isSingleNonPackage) {
      const type = selectedTypes[0];
      const typeValues = perTypeValues[type] || { quantity: "1", totalValue: "" };
      const quantity = parseInt(typeValues.quantity) || 1;
      const totalValue = toNum(typeValues.totalValue);

      if (quantity <= 0) {
        toast.error("Quantidade deve ser maior que zero");
        return;
      }
      if (type === "EXAME" && !typeValues.examType) {
        toast.error("Selecione o tipo de exame");
        return;
      }
      if (type === "SESSAO_TERAPEUTICA" && !typeValues.therapySessionType) {
        toast.error("Selecione o tipo de sessão");
        return;
      }

      let description = formData.description;
      if (type === "EXAME") {
        description = typeValues.examType || formData.description;
      } else if (type === "SESSAO_TERAPEUTICA") {
        description = typeValues.therapySessionType || formData.description;
      } else {
        description = description || getDefaultDescription(type);
      }
      if (!description) {
        description = getProductionTypeLabel(type) || type;
      }

      const unitValue = quantity > 0 ? totalValue / quantity : 0;

      // P2-FIX: Converter competencia MM/YYYY → YYYY-MM antes de enviar ao banco
      const [smm, syyyy] = formData.competencia.split("/");
      const competenciaForDB = syyyy ? `${syyyy}-${smm}` : formData.competencia;

      onSubmit({
        productionDate: formData.productionDate,
        competencia: competenciaForDB,
        unit: formData.unit,
        specialty: formData.specialty || undefined,
        doctorId: formData.doctorId || undefined,
        payerType: formData.payerType,
        convenio: formData.payerType === "CONVENIO" ? formData.convenio : undefined,
        paymentMethod: formData.payerType === "PARTICULAR" ? formData.paymentMethod : undefined,
        productionType: type as ProductionType,
        description,
        procedureCode: formData.procedureCode || undefined,
        quantity,
        unitValue,
        notes: formData.notes || undefined,
        createdBy: userName,
        examType: typeValues.examType || undefined,
        therapySessionType: typeValues.therapySessionType || undefined,
        isPackage: false,
      });
      onOpenChange(false);
      return;
    }

    // ----------------------------------------------------------------
    // MULTI-TYPE — bulk insert directly to Supabase
    // ----------------------------------------------------------------
    // Validate all selected types
    for (const type of selectedTypes) {
      const typeValues = perTypeValues[type] || { quantity: "1", totalValue: "" };
      const qty = parseInt(typeValues.quantity) || 0;
      if (qty <= 0) {
        toast.error(`Quantidade inválida para "${getProductionTypeLabel(type)}"`);
        return;
      }
      if (type === "EXAME" && !typeValues.examType) {
        toast.error("Selecione o tipo de exame para Exame");
        return;
      }
      if (type === "SESSAO_TERAPEUTICA" && !typeValues.therapySessionType) {
        toast.error("Selecione o tipo de sessão para Sessão Terapêutica");
        return;
      }
    }

    if (!companyId || !profile?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    setSubmitting(true);

    try {
      const batchId = crypto.randomUUID();

      // Convert competencia MM/YYYY → YYYY-MM for DB
      const [mm, yyyy] = formData.competencia.split("/");
      const competenciaDB = `${yyyy}-${mm}`;

      const rows = selectedTypes.map((type) => {
        const typeValues = perTypeValues[type] || { quantity: "1", totalValue: "" };
        const qty = parseInt(typeValues.quantity) || 1;
        const total = toNum(typeValues.totalValue);
        const unitVal = qty > 0 ? total / qty : 0;

        let description = "";
        if (type === "EXAME") {
          description = typeValues.examType || getDefaultDescription(type);
        } else if (type === "SESSAO_TERAPEUTICA") {
          description = typeValues.therapySessionType || getDefaultDescription(type);
        } else {
          description = getDefaultDescription(type) || getProductionTypeLabel(type);
        }

        return {
          company_id: companyId,
          production_date: formData.productionDate,
          competencia: competenciaDB,
          unit: formData.unit,
          specialty: formData.specialty || null,
          doctor_id: formData.doctorId || null,
          payer_type: formData.payerType,
          health_plan_id: formData.payerType === "CONVENIO" ? (formData.convenio || null) : null,
          payment_method: formData.payerType === "PARTICULAR" ? (formData.paymentMethod || null) : null,
          production_type: type,
          description,
          quantity: qty,
          unit_value: unitVal,
          total_value: total,
          status: "PRODUZIDO",
          created_by: profile.id,
          import_source: "manual",
          is_package: false,
          history: [
            {
              action: "CREATED",
              at: new Date().toISOString(),
              by: userName,
            },
          ],
          // Batch audit trail stored in edit_logs (jsonb column, no schema change needed)
          edit_logs: [
            {
              field: "batch_id",
              value: batchId,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      const { error } = await supabase.from("productions").insert(rows);

      if (error) {
        if (import.meta.env.DEV) console.error("Bulk insert error:", error);
        toast.error("Falha ao registrar produções. Nada foi salvo.");
        return;
      }

      toast.success(`${selectedTypes.length} produções registradas com sucesso`);
      // P3-FIX: forçar refetch explícito caso WebSocket esteja degradado
      onBulkInsertSuccess?.(selectedTypes.length);
      onOpenChange(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Unexpected error:", err);
      toast.error("Erro inesperado ao registrar produções.");
    } finally {
      setSubmitting(false);
    }
  };

  // ===================================================================
  // NEW: Custom production type input (for multi-select mode)
  // ===================================================================
  const [newCustomType, setNewCustomType] = useState("");

  // ===================================================================
  // SHIFT+ENTER: salvar e abrir novo (single mode)
  // ===================================================================
  const handleSubmitAndNew = useCallback(async () => {
    // Trigger submit without closing
    if (entryMode !== "single") return;
    // Quick inline submit for single non-package
    if (isSingleNonPackage && formData.unit && selectedTypes.length > 0) {
      const type = selectedTypes[0];
      const typeValues = perTypeValues[type] || { quantity: "1", totalValue: "" };
      const quantity = parseInt(typeValues.quantity) || 1;
      const totalValue = toNum(typeValues.totalValue);
      const unitValue = quantity > 0 ? totalValue / quantity : 0;

      let description = formData.description;
      if (type === "EXAME") description = typeValues.examType || description;
      else if (type === "SESSAO_TERAPEUTICA") description = typeValues.therapySessionType || description;
      else description = description || getDefaultDescription(type);
      if (!description) description = getProductionTypeLabel(type) || type;

      const [smm, syyyy] = formData.competencia.split("/");
      const competenciaForDB = syyyy ? `${syyyy}-${smm}` : formData.competencia;

      try {
        await onSubmit({
          productionDate: formData.productionDate,
          competencia: competenciaForDB,
          unit: formData.unit,
          specialty: formData.specialty || undefined,
          doctorId: formData.doctorId || undefined,
          payerType: formData.payerType,
          convenio: formData.payerType === "CONVENIO" ? formData.convenio : undefined,
          paymentMethod: formData.payerType === "PARTICULAR" ? formData.paymentMethod : undefined,
          productionType: type as ProductionType,
          description,
          procedureCode: formData.procedureCode || undefined,
          quantity,
          unitValue,
          notes: formData.notes || undefined,
          createdBy: userName,
          examType: typeValues.examType || undefined,
          therapySessionType: typeValues.therapySessionType || undefined,
          isPackage: false,
        });
        // Reset content fields but keep context
        setFormData(prev => ({ ...prev, description: "", procedureCode: "", notes: "" }));
        setPerTypeValues(prev => ({
          ...prev,
          [type]: { ...prev[type], totalValue: "", quantity: "1" },
        }));
        toast.success("Registrado! Pronto para próximo lançamento.");
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
      }
    }
  }, [entryMode, isSingleNonPackage, formData, selectedTypes, perTypeValues, onSubmit, userName]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Enter" && e.shiftKey && tag !== "BUTTON") {
        e.preventDefault();
        handleSubmitAndNew();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleSubmitAndNew]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-500" />
            Registrar Produção
          </DialogTitle>
          <DialogDescription>Volume assistencial realizado. Não impacta Caixa, DRE ou Score.</DialogDescription>
        </DialogHeader>

        {/* Toggle Único / Lote */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          <button
            onClick={() => setEntryMode("single")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md transition-colors",
              entryMode === "single"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Único
          </button>
          <button
            onClick={() => setEntryMode("batch")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1",
              entryMode === "batch"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3 w-3" />
            Lote
          </button>
        </div>

        {/* ============================================================ */}
        {/* BATCH MODE                                                    */}
        {/* ============================================================ */}
        {entryMode === "batch" && (
          <div className="space-y-4 py-2">
            {/* Contexto compartilhado */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data (todas)</Label>
                <Input type="date" value={formData.productionDate} onChange={(e) => setFormData(prev => ({ ...prev, productionDate: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Unidade (todas)</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo (todas)</Label>
                <Select value={selectedTypes[0] || ""} onValueChange={(v) => { setSelectedTypes([v]); setPerTypeValues({ [v]: { quantity: "1", totalValue: "" } }); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(extendedSettings?.productionTypes || [])
                      .filter((t: any) => t.active !== false)
                      .map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Paste hint */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" />
                Cole linhas do Excel com{" "}
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">Ctrl+V</kbd>
                {" "}— colunas aceitas:{" "}
                <span className="font-medium text-foreground">Procedimento · Paciente · Qtde · Valor</span>
              </p>
              {batchRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBatchRows([{ id: crypto.randomUUID(), description: "", quantity: 1, unitValue: 0, convenio: "", patientName: "" }])}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpar tudo
                </button>
              )}
            </div>

            {/* Grade de linhas */}
            <div className="border rounded-lg overflow-auto max-h-[380px]" data-batch-grid>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Procedimento</TableHead>
                    <TableHead className="text-xs w-[80px]">Cód.</TableHead>
                    <TableHead className="text-xs">Paciente</TableHead>
                    <TableHead className="text-xs w-[110px]">Convênio</TableHead>
                    <TableHead className="text-xs w-[60px]">Qtde</TableHead>
                    <TableHead className="text-xs w-[90px]">Valor Unit.</TableHead>
                    <TableHead className="text-xs w-[80px]">Total</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.map((row, idx) => (
                    <TableRow key={row.id} className={cn(
                      "transition-colors",
                      row._justPasted && "bg-primary/5 animate-pulse",
                      row.error && "bg-destructive/5"
                    )}>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Ex: Consulta, ECG..."
                          value={row.description}
                          onChange={(e) => updateBatchRow(row.id, "description", e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Tab" && idx === batchRows.length - 1 && !e.shiftKey) {
                              e.preventDefault();
                              addBatchRow();
                            }
                          }}
                          className={cn(
                            "h-7 text-xs border-0 bg-transparent focus:bg-background px-1",
                            row.error && "border border-rose-300 rounded"
                          )}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="TUSS"
                          value={row.procedureCode || ""}
                          onChange={(e) => updateBatchRow(row.id, "procedureCode", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus:bg-background px-1"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Nome"
                          value={row.patientName || ""}
                          onChange={(e) => updateBatchRow(row.id, "patientName", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus:bg-background px-1"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select value={row.convenio || "PARTICULAR"} onValueChange={(v) => updateBatchRow(row.id, "convenio", v)}>
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PARTICULAR">Particular</SelectItem>
                            {(extendedSettings?.payers || [])
                              .filter((p: any) => p.active !== false)
                              .map((p: any) => (
                                <SelectItem key={p.id || p.name} value={p.name || p.id}>{p.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateBatchRow(row.id, "quantity", Math.max(1, Number(e.target.value) || 1))}
                          className="h-7 text-xs border-0 bg-transparent focus:bg-background text-center px-1"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={row.unitValue || ""}
                          onChange={(e) => updateBatchRow(row.id, "unitValue", parseFloat(e.target.value) || 0)}
                          className={cn(
                            "h-7 text-xs border-0 bg-transparent focus:bg-background text-right px-1",
                            row.error && "border border-rose-300 rounded"
                          )}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-xs text-right font-medium">
                        {row.unitValue > 0 ? formatCurrency(row.quantity * row.unitValue) : "—"}
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => duplicateBatchRow(row.id)}
                            title="Duplicar"
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {batchRows.length > 1 && (
                            <button
                              onClick={() => removeBatchRow(row.id)}
                              title="Remover"
                              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Footer row */}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="p-1">
                      <button onClick={addBatchRow} className="flex items-center gap-1 text-xs text-primary hover:underline px-1">
                        <Plus className="h-3 w-3" />
                        Adicionar linha
                        <span className="text-muted-foreground ml-1">(ou Tab na última célula)</span>
                      </button>
                    </TableCell>
                    <TableCell className="p-1 text-xs text-center font-medium">
                      {batchRows.reduce((a, r) => a + r.quantity, 0)}
                    </TableCell>
                    <TableCell className="p-1" />
                    <TableCell className="p-1 text-xs text-right font-bold">
                      {formatCurrency(batchRows.reduce((a, r) => a + r.quantity * r.unitValue, 0))}
                    </TableCell>
                    <TableCell className="p-1" />
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Rodapé do lote */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {batchRows.filter(r => r.description.trim()).length} de{" "}
                {batchRows.length} linhas preenchidas
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleBatchSubmit}
                  disabled={batchSaving || batchRows.filter(r => r.description.trim()).length === 0}
                  className="gap-2"
                >
                  {batchSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Confirmar {batchRows.filter(r => r.description.trim()).length} lançamento(s)</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SINGLE MODE (existing form)                                   */}
        {/* ============================================================ */}
        {entryMode === "single" && (
        <div className="space-y-4 py-4">
          {/* ============================================================ */}
          {/* TIPO DE PRODUÇÃO — Multi-select checkboxes                   */}
          {/* ============================================================ */}
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-600" />
              <Label className="text-violet-600 font-medium">Tipo de Produção *</Label>
              {isMultiType && (
                <span className="ml-auto text-xs bg-violet-500/20 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedTypes.length} selecionados
                </span>
              )}
            </div>

            {/* Total Geral pré-conferência — visível quando ≥1 tipo tem valor */}
            {totals.totalValue > 0 && (
              <div className="flex items-center justify-between bg-violet-500/5 border border-violet-500/15 rounded-md px-3 py-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calculator className="h-3 w-3" />
                  {isMultiType
                    ? `${totals.totalQty} itens`
                    : `${perTypeValues[selectedTypes[0]]?.quantity || 1} unid.`}
                </span>
                <span className="text-sm font-semibold text-violet-700">{formattedTotal}</span>
              </div>
            )}

            {/* Non-package types: checkboxes */}
            <div className="space-y-2">
              {nonPackageProductionTypes.map((type) => {
                const isChecked = selectedTypes.includes(type);
                const typeValues = perTypeValues[type];
                return (
                  <div key={type} className="space-y-1">
                    {/* Compact single-row: checkbox + label + inline inputs */}
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md cursor-pointer transition-colors px-2 py-1.5",
                        isChecked
                          ? "bg-violet-500/10 border border-violet-500/25"
                          : "hover:bg-muted/40 border border-transparent"
                      )}
                      onClick={() => toggleType(type)}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleType(type)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 shrink-0"
                      />
                      <span className={cn("text-sm flex-1 min-w-0 truncate", isChecked ? "text-violet-700 font-medium" : "text-foreground")}>
                        {getProductionTypeLabel(type)}
                      </span>

                      {/* Inline qty + value — only when checked */}
                      {isChecked && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            min="1"
                            value={typeValues?.quantity || "1"}
                            onChange={(e) => updatePerTypeValue(type, "quantity", e.target.value)}
                            className="h-7 w-14 text-xs text-center px-1"
                            title="Qtde"
                          />
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={typeValues?.totalValue || ""}
                            onChange={(e) => updatePerTypeValue(type, "totalValue", e.target.value)}
                            className="h-7 w-24 text-xs text-center px-1"
                            title="Valor Total (R$)"
                          />
                        </div>
                      )}
                    </div>

                    {/* Sub-field for EXAME / SESSAO_TERAPEUTICA (indented, compact) */}
                    {isChecked && (
                      <div className="ml-6">
                        {renderInlineSubField(type)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Custom type input */}
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Adicionar tipo personalizado..."
                  value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCustomType.trim()) {
                      saveNewProductionType(newCustomType.trim());
                      setNewCustomType("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => {
                    if (newCustomType.trim()) {
                      saveNewProductionType(newCustomType.trim());
                      setNewCustomType("");
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Separator + Package types */}
            <Separator className="my-2" />
            <div className="space-y-1">
              <div className="flex items-center gap-1 mb-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Pacotes (seleção exclusiva)</span>
              </div>
              {PACKAGE_PRODUCTION_TYPES.map((pkgType) => {
                const isSelected = selectedTypes.includes(pkgType);
                const pkgValues = perTypeValues[pkgType];
                return (
                  <div key={pkgType} className="space-y-1">
                    {/* Compact single-row: radio indicator + label + inline inputs */}
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md cursor-pointer transition-colors px-2 py-1.5",
                        isSelected
                          ? "bg-primary/10 border border-primary/25"
                          : "hover:bg-muted/40 border border-transparent"
                      )}
                      onClick={() => toggleType(pkgType)}
                    >
                      {/* Radio-style indicator */}
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className={cn("text-sm flex-1 min-w-0 truncate", isSelected ? "text-primary font-medium" : "text-foreground")}>
                        {getProductionTypeLabel(pkgType)}
                      </span>

                      {/* Inline qty + value — only when selected */}
                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            min="1"
                            value={pkgValues?.quantity || "1"}
                            onChange={(e) => updatePerTypeValue(pkgType, "quantity", e.target.value)}
                            className="h-7 w-14 text-xs text-center px-1"
                            title="Qtde"
                          />
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={pkgValues?.totalValue || ""}
                            onChange={(e) => updatePerTypeValue(pkgType, "totalValue", e.target.value)}
                            className="h-7 w-24 text-xs text-center px-1"
                            title="Valor Total (R$)"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 ml-1">
                <Info className="h-3 w-3" />
                Pacotes não podem ser combinados com outros tipos
              </p>
            </div>
          </div>

          {/* ============================================================ */}
          {/* DYNAMIC FIELDS (single-type mode only)                       */}
          {/* ============================================================ */}
          {!isMultiType && renderDynamicFields()}

          {/* ============================================================ */}
          {/* SINGLE-TYPE: Quantity + Value block (non-package)            */}
          {/* ============================================================ */}
          {isSingleNonPackage && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-4">
              <div className="space-y-2">
                <Label className="text-amber-700 font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {getQuantityLabel()}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={singleQuantity}
                  onChange={(e) => updatePerTypeValue(selectedTypes[0], "quantity", e.target.value)}
                  className="text-lg font-bold text-center h-12 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 font-medium">Valor Total Estimado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={singleTotalValue}
                  onChange={(e) => updatePerTypeValue(selectedTypes[0], "totalValue", e.target.value)}
                  className="text-lg font-bold text-center h-12 bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Valor total para a quantidade informada (opcional para referência)
                </p>
              </div>
              {calculatedUnitValue > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded">
                  <Calculator className="h-3.5 w-3.5" />
                  <span>
                    Valor unitário:{" "}
                    {calculatedUnitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Package quantity + value block */}
          {isSinglePackage && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-4">
              <div className="space-y-2">
                <Label className="text-amber-700 font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Quantidade de Pacotes *
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={packageQuantity}
                  onChange={(e) => updatePerTypeValue(selectedTypes[0], "quantity", e.target.value)}
                  className="text-lg font-bold text-center h-12 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 font-medium">Valor Total do Pacote (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={packageTotalValue}
                  onChange={(e) => updatePerTypeValue(selectedTypes[0], "totalValue", e.target.value)}
                  className="text-lg font-bold text-center h-12 bg-background"
                />
              </div>
              {calculatedUnitValue > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded">
                  <Calculator className="h-3.5 w-3.5" />
                  <span>
                    Valor unitário:{" "}
                    {calculatedUnitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* SHARED FIELDS                                                 */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              {activeUnits.length === 0 ? (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-700">
                  ⚠️ Nenhuma unidade ativa cadastrada.{" "}
                  <span className="font-medium">Vá em Configurações → Unidades</span>
                </div>
              ) : (
                <Select
                  value={formData.unit}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, unit: v, specialty: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Competência *</Label>
              <Input
                placeholder="MM/AAAA"
                value={formData.competencia}
                onChange={(e) => setFormData((prev) => ({ ...prev, competencia: formatCompetencia(e.target.value) }))}
                maxLength={7}
              />
            </div>
          </div>

          {/* Especialidade - APENAS Centro Clínico */}
          {isCentroClinico && (
            <div className="space-y-2">
              <Label>Especialidade *</Label>
              <Select
                value={formData.specialty}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, specialty: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {specialtyOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasCustomSpecialties && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Cadastre especialidades em Configurações para personalizar.
                </p>
              )}
            </div>
          )}

          {/* Médico(a) - opcional */}
          <div className="space-y-2">
            <Label>Médico(a) (opcional)</Label>
            <Select
              value={formData.doctorId ? formData.doctorId : "none"}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, doctorId: v === "none" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={doctorsLoading ? "Carregando..." : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {doctorOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Ajuda em relatórios por profissional (sem ser obrigatório).</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pagador *</Label>
              <Select
                value={formData.payerType}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    payerType: v as "CONVENIO" | "PARTICULAR",
                    convenio: v === "PARTICULAR" ? "" : prev.convenio,
                    paymentMethod: v === "CONVENIO" ? "" : prev.paymentMethod,
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

            {/* Campo Forma de Pagamento para PARTICULAR */}
            {formData.payerType === "PARTICULAR" && (
              <div className="space-y-2">
                <Label>Forma de Pagamento *</Label>
                {(() => {
                  const allMethods = extendedSettings?.paymentMethodsParticular?.length
                    ? extendedSettings.paymentMethodsParticular
                    : DEFAULT_PAYMENT_METHODS_PARTICULAR;
                  const activeMethods = allMethods.filter((m) => m.active);
                  const currentMethodInactive =
                    formData.paymentMethod &&
                    !activeMethods.some((m) => m.id === formData.paymentMethod);
                  const currentMethodData = currentMethodInactive
                    ? allMethods.find((m) => m.id === formData.paymentMethod)
                    : null;

                  return (
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, paymentMethod: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMethods.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                        {currentMethodData && (
                          <SelectItem key={currentMethodData.id} value={currentMethodData.id} disabled>
                            {currentMethodData.name} (Inativo)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            )}

            {formData.payerType === "CONVENIO" && (
              <div className="space-y-2">
                <Label>Convênio *</Label>
                <Select
                  value={formData.convenio}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, convenio: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVENIOS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* PACKAGE FIELDS (only when a package type is selected alone) */}
          {isPackageType && (
            <div className="space-y-4">
              {formData.payerType === "CONVENIO" && !formData.convenio ? (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Selecione o convênio para calcular automaticamente os componentes do pacote.
                </div>
              ) : (
                <PackageFields
                  packageType={selectedTypes[0] as "PACOTE_BOX" | "PACOTE_GTA"}
                  planId={formData.payerType === "PARTICULAR" ? "PARTICULAR" : formData.convenio}
                  referenceDate={formData.productionDate}
                  totalValue={toNum(packageTotalValue)}
                  packageQty={parseInt(packageQuantity, 10) || 1}
                  forceManual={formData.payerType === "PARTICULAR"}
                  onChange={(components) => {
                    setFormData((prev) => ({
                      ...prev,
                      consultAmount: components.consultAmount,
                      feeAmount: components.feeAmount,
                      matmedAmount: components.matmedAmount,
                      consultQty: components.consultQty,
                      feeQty: components.feeQty,
                      matmedQty: components.matmedQty,
                      isManualOverride: components.isManualOverride,
                    }));
                    if (components.isManualOverride) {
                      updatePerTypeValue(selectedTypes[0], "totalValue", components.totalAmount.toFixed(2));
                    }
                  }}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Produção</Label>
              <Input
                type="date"
                value={formData.productionDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, productionDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais (opcional)..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
        )}

        {/* Footer for single mode */}
        {entryMode === "single" && (
        <DialogFooter className="gap-2 sm:gap-0 flex-col">
          <div className="flex items-center gap-2 w-full sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="gradient-primary" disabled={submitting}>
              {submitting ? "Registrando..." : isMultiType ? `Registrar ${selectedTypes.length} produções` : "Registrar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center sm:text-right w-full">
            <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">Shift + Enter</kbd>
            {" "}salva e abre novo mantendo data, unidade e convênio
          </p>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
