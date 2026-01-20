import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDoctors } from "@/hooks/useDoctors";
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
import { ProductionType, UnitConfig, BASE_PRODUCTION_TYPES } from "@/types";
import { toast } from "sonner";
import { Activity, Check, ChevronsUpDown, Plus, Calculator, Package, AlertCircle, Info, UserRound } from "lucide-react";
import { SPECIALTIES } from "@/utils/constants";
import { cn } from "@/lib/utils";
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

interface ProductionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProductionFormData) => void;
  units: UnitConfig[];
  userName: string;
}

export interface ProductionFormData {
  productionDate: string;
  competencia: string;
  unit: string;
  specialty?: string;
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

  // ✅ NOVO: Médico(a) opcional (vai ser mapeado para doctor_id no insert)
  doctorId?: string;
}

type DoctorOption = { id: string; name: string; active?: boolean };

export function ProductionForm({ open, onOpenChange, onSubmit, units, userName }: ProductionFormProps) {
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

  // Combinar sugestões padrão com salvas do banco
  const savedExamTypes = getSavedExamTypes();
  const savedTherapyTypes = getSavedTherapyTypes();
  const savedProductionTypes = getSavedProductionTypes();

  // ===================================================================
  // EXAMES / PROCEDIMENTOS (FONTE ÚNICA OFICIAL)
  // ===================================================================
  // Regra: se existir cadastro oficial em Configurações → Exames,
  // a Produção DEVE refletir exatamente o banco (incluindo ativo/inativo).
  // DEFAULT_EXAM_TYPES vira apenas fallback para empresas sem cadastro.
  const masterExamTypesRaw = (extendedSettings as any)?.examTypes ?? [];
  const masterExamNames = (
    Array.isArray(masterExamTypesRaw)
      ? masterExamTypesRaw
          .filter((e: any) => (e?.active ?? e?.is_active) === true)
          .map((e: any) => String(e?.name ?? "").trim())
          .filter(Boolean)
      : []
  ) as string[];

  const hasMasterExamTypes = masterExamNames.length > 0;

  // ✅ Se tem cadastro oficial, usa SOMENTE ele (reflete on/off)
  // ✅ Se não tem, usa fallback (DEFAULT + sugestões antigas)
  const examTypes = [
    ...new Set(hasMasterExamTypes ? masterExamNames : [...DEFAULT_EXAM_TYPES, ...savedExamTypes]),
  ].sort();

  const therapyTypes = [...new Set([...DEFAULT_THERAPY_TYPES, ...savedTherapyTypes])].sort();

  // Incluir pacotes convênio na lista de tipos
  const productionTypes = [
    ...new Set([...BASE_PRODUCTION_TYPES, ...PACKAGE_PRODUCTION_TYPES, ...savedProductionTypes]),
  ];

  const [formData, setFormData] = useState({
    productionDate: format(new Date(), "yyyy-MM-dd"),
    competencia: currentMonth,
    unit: "",
    specialty: "",
    payerType: "CONVENIO" as "CONVENIO" | "PARTICULAR",
    convenio: "",
    paymentMethod: "", // Campo forma de pagamento para PARTICULAR
    productionType: "CONSULTA" as ProductionType,
    description: "",
    procedureCode: "",
    quantity: "1",
    totalValue: "", // MODELO DEFINITIVO: Valor Total Estimado é o campo principal
    notes: "",

    // Campos dinâmicos
    examType: "",
    therapySessionType: "",

    // Campos pacote convênio
    consultAmount: 0,
    feeAmount: 0,
    matmedAmount: 0,
    consultQty: 1,
    feeQty: 1,
    matmedQty: 0,
    isManualOverride: false,

    // ✅ NOVO
    doctorId: "",
  });

  // Popovers state
  const [examTypeOpen, setExamTypeOpen] = useState(false);
  const [therapyTypeOpen, setTherapyTypeOpen] = useState(false);
  const [productionTypeOpen, setProductionTypeOpen] = useState(false);
  const [newExamType, setNewExamType] = useState("");
  const [newTherapyType, setNewTherapyType] = useState("");
  const [newProductionType, setNewProductionType] = useState("");

  // CORREÇÃO #1: Garantir unidades ativas - usar settings.units se units prop estiver vazia
  const effectiveUnits = units && units.length > 0 ? units : (settings as any)?.units || [];
  const activeUnits = effectiveUnits.filter((u: any) => u.active);

  const selectedUnit = effectiveUnits.find((u: any) => u.id === formData.unit);

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
  const masterSpecialties = (extendedSettings as any)?.specialties?.filter((s: any) => s.active) ?? [];
  const specialtyOptions =
    masterSpecialties.length > 0
      ? masterSpecialties
      : SPECIALTIES.map((s) => ({ id: s.id, name: s.name, active: true }));
  const hasCustomSpecialties = masterSpecialties.length > 0;

  // ✅ COMPANY ID (robusto)
  const companyId = useMemo(() => {
    const s: any = settings ?? {};
    const e: any = extendedSettings ?? {};
    return (
      e.companyId ??
      s.companyId ??
      e.company_id ??
      s.company_id ??
      e.company?.id ??
      s.company?.id ??
      e.currentCompanyId ??
      s.currentCompanyId ??
      null
    );
  }, [settings, extendedSettings]);

  // ✅ Doctors (opcional)
  const { data: doctorsRaw = [] } = useDoctors(companyId || undefined);
  const activeDoctors: DoctorOption[] = useMemo(() => {
    const list = Array.isArray(doctorsRaw) ? (doctorsRaw as any[]) : [];
    return list
      .map((d) => ({ id: String(d.id), name: String(d.name ?? ""), active: d.active }))
      .filter((d) => Boolean(d.id) && Boolean(d.name))
      .filter((d) => d.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [doctorsRaw]);

  // Reset campos dinâmicos quando muda o tipo de produção
  useEffect(() => {
    const newType = formData.productionType;
    const isPackage = PACKAGE_PRODUCTION_TYPES.includes(newType);

    setFormData((prev) => ({
      ...prev,
      examType: "",
      therapySessionType: "",
      procedureCode: "",
      description: getDefaultDescription(newType),

      // Se for pacote, forçar payerType para CONVENIO
      payerType: isPackage ? "CONVENIO" : prev.payerType,
      paymentMethod: isPackage ? "" : prev.paymentMethod,

      // Reset componentes do pacote
      consultAmount: 0,
      feeAmount: 0,
      matmedAmount: 0,
      consultQty: 1,
      feeQty: 1,
      matmedQty: 0,
      isManualOverride: false,
    }));
  }, [formData.productionType]);

  // Limpar specialty quando unidade não é Centro Clínico
  useEffect(() => {
    if (!isCentroClinico && formData.specialty) {
      setFormData((prev) => ({ ...prev, specialty: "" }));
    }
  }, [formData.unit, isCentroClinico]);

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
        return "Pacote Box (Convênio)";
      case "PACOTE_GTA":
        return "Pacote GTA (Convênio)";
      default:
        return "";
    }
  };

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

  // Salvar nova sugestão (persisted to database)
  const saveNewExamType = async () => {
    if (newExamType.trim() && !examTypes.includes(newExamType.trim())) {
      await addExamType(newExamType.trim());
      setFormData((prev) => ({ ...prev, examType: newExamType.trim(), description: newExamType.trim() }));
      toast.success(`"${newExamType.trim()}" adicionado às sugestões`);
    }
    setNewExamType("");
    setExamTypeOpen(false);
  };

  const saveNewTherapyType = async () => {
    if (newTherapyType.trim() && !therapyTypes.includes(newTherapyType.trim())) {
      await addTherapyType(newTherapyType.trim());
      setFormData((prev) => ({
        ...prev,
        therapySessionType: newTherapyType.trim(),
        description: newTherapyType.trim(),
      }));
      toast.success(`"${newTherapyType.trim()}" adicionado às sugestões`);
    }
    setNewTherapyType("");
    setTherapyTypeOpen(false);
  };

  const saveNewProductionType = async () => {
    if (newProductionType.trim() && !productionTypes.includes(newProductionType.trim())) {
      await addProductionType(newProductionType.trim());
      setFormData((prev) => ({
        ...prev,
        productionType: newProductionType.trim() as any,
        description: newProductionType.trim(),
      }));
      toast.success(`"${newProductionType.trim()}" adicionado aos tipos de produção`);
    }
    setNewProductionType("");
    setProductionTypeOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.unit || !formData.competencia) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // CORREÇÃO FORENSE: Centro Clínico EXIGE especialidade
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

    // CORREÇÃO: Validar Forma de Pagamento para PARTICULAR
    if (formData.payerType === "PARTICULAR" && !formData.paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    const quantity = parseInt(formData.quantity) || 1;
    const totalValue = parseFloat(formData.totalValue) || 0;

    if (quantity <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    // Validar campos específicos por tipo
    if (formData.productionType === "EXAME" && !formData.examType) {
      toast.error("Selecione o tipo de exame");
      return;
    }

    if (formData.productionType === "SESSAO_TERAPEUTICA" && !formData.therapySessionType) {
      toast.error("Selecione o tipo de sessão");
      return;
    }

    // Validação específica para pacotes: valor deve cobrir consulta + taxa
    const isPackageType = PACKAGE_PRODUCTION_TYPES.includes(formData.productionType);
    if (isPackageType) {
      if (totalValue <= 0) {
        toast.error("Informe o valor total do pacote");
        return;
      }
      if (formData.payerType !== "CONVENIO") {
        toast.error("Pacotes Convênio só podem ser registrados para pagador Convênio");
        return;
      }
      const validation = validateTotal(
        totalValue,
        formData.convenio,
        formData.productionType as "PACOTE_BOX" | "PACOTE_GTA",
        formData.productionDate,
        quantity,
      );
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }
    }

    // Definir description baseado no tipo (AUTO-PREENCHIMENTO)
    let description = formData.description;

    if (formData.productionType === "EXAME") {
      description = formData.examType || formData.description;
    } else if (formData.productionType === "SESSAO_TERAPEUTICA") {
      description = formData.therapySessionType || formData.description;
    } else if (isPackageType) {
      description = getProductionTypeLabel(formData.productionType);
    }

    // FALLBACK: Se ainda não tem descrição, usar o próprio tipo de produção
    if (!description) {
      description = getProductionTypeLabel(formData.productionType) || String(formData.productionType);
    }

    // MODELO DEFINITIVO: Valor unitário calculado automaticamente como referência
    const unitValue = quantity > 0 ? totalValue / quantity : 0;

    onSubmit({
      productionDate: formData.productionDate,
      competencia: formData.competencia,
      unit: formData.unit,
      specialty: formData.specialty || undefined,
      payerType: formData.payerType,
      convenio: formData.payerType === "CONVENIO" ? formData.convenio : undefined,
      // AUDIT_FIX: Persistir paymentMethod para produções PARTICULAR
      paymentMethod: formData.payerType === "PARTICULAR" ? formData.paymentMethod : undefined,
      productionType: formData.productionType,
      description,
      procedureCode: formData.procedureCode || undefined,
      quantity,
      unitValue, // Calculado automaticamente
      notes: formData.notes || undefined,
      createdBy: userName,
      examType: formData.examType || undefined,
      therapySessionType: formData.therapySessionType || undefined,

      // Dados de pacote convênio
      isPackage: isPackageType,
      packageType: isPackageType ? formData.productionType : undefined,
      packageQty: isPackageType ? quantity : undefined, // Quantidade de pacotes explícita
      consultAmount: isPackageType ? formData.consultAmount : undefined,
      feeAmount: isPackageType ? formData.feeAmount : undefined,
      matmedAmount: isPackageType ? formData.matmedAmount : undefined,
      consultQty: isPackageType ? formData.consultQty : undefined,
      feeQty: isPackageType ? formData.feeQty : undefined,
      matmedQty: isPackageType ? formData.matmedQty : undefined,

      // ✅ NOVO
      doctorId: formData.doctorId ? formData.doctorId : undefined,
    });

    // Reset form
    setFormData({
      productionDate: format(new Date(), "yyyy-MM-dd"),
      competencia: currentMonth,
      unit: "",
      specialty: "",
      payerType: "CONVENIO",
      convenio: "",
      paymentMethod: "",
      productionType: "CONSULTA" as ProductionType,
      description: "",
      procedureCode: "",
      quantity: "1",
      totalValue: "",
      notes: "",
      examType: "",
      therapySessionType: "",
      consultAmount: 0,
      feeAmount: 0,
      matmedAmount: 0,
      consultQty: 1,
      feeQty: 1,
      matmedQty: 0,
      isManualOverride: false,
      doctorId: "",
    });

    onOpenChange(false);
  };

  // Valor unitário calculado (apenas referência)
  const quantity = parseInt(formData.quantity) || 0;
  const totalValue = parseFloat(formData.totalValue) || 0;
  const calculatedUnitValue = quantity > 0 ? totalValue / quantity : 0;

  // Renderizar campos dinâmicos por tipo
  const renderDynamicFields = () => {
    switch (formData.productionType) {
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
                    {formData.examType || "Selecione ou digite..."}
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
                          <Button variant="ghost" className="w-full justify-start text-sm" onClick={saveNewExamType}>
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
                              setFormData((prev) => ({ ...prev, examType: type, description: type }));
                              setExamTypeOpen(false);
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", formData.examType === type ? "opacity-100" : "opacity-0")}
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
                  {formData.therapySessionType || "Selecione ou digite..."}
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
                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={saveNewTherapyType}>
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
                            setFormData((prev) => ({ ...prev, therapySessionType: type, description: type }));
                            setTherapyTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.therapySessionType === type ? "opacity-100" : "opacity-0",
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
        // Pacotes Convênio - apenas mensagem informativa (campos vão aparecer após Valor Total)
        return (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <p className="text-sm text-primary font-medium">
                {formData.productionType === "PACOTE_BOX" ? "📦 Pacote Box (Convênio)" : "📦 Pacote GTA (Convênio)"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Consulta + Taxa/Box + Mat/Med em pacote único. Preencha convênio e valor total abaixo.
            </p>
          </div>
        );

      default:
        // Para tipos dinâmicos (cadastrados pelo usuário)
        return (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium">{getProductionTypeLabel(formData.productionType)}</p>
            <p className="text-xs text-muted-foreground mt-1">Tipo de produção personalizado</p>
          </div>
        );
    }
  };

  // Determinar se é pacote convênio
  const isPackageType = PACKAGE_PRODUCTION_TYPES.includes(formData.productionType);

  // Determinar label de quantidade por tipo
  const getQuantityLabel = (): string => {
    switch (formData.productionType) {
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

        <div className="space-y-4 py-4">
          {/* Tipo de Produção - PRIMEIRO E EM DESTAQUE */}
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-3">
            <Label className="text-violet-600 font-medium">Tipo de Produção *</Label>
            <Popover open={productionTypeOpen} onOpenChange={setProductionTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productionTypeOpen}
                  className="w-full justify-between bg-background"
                >
                  {formData.productionType ? getProductionTypeLabel(formData.productionType) : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar ou adicionar tipo..."
                    value={newProductionType}
                    onValueChange={setNewProductionType}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-sm"
                          onClick={saveNewProductionType}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar "{newProductionType}"
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {productionTypes.map((type) => (
                        <CommandItem
                          key={type}
                          value={type}
                          onSelect={() => {
                            setFormData((prev) => ({ ...prev, productionType: type as any }));
                            setProductionTypeOpen(false);
                            setNewProductionType("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.productionType === type ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {getProductionTypeLabel(type)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Campos Dinâmicos por Tipo */}
          {renderDynamicFields()}

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
                    {activeUnits.map((u: any) => (
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
                  {specialtyOptions.map((s: any) => (
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

          {/* ✅ MÉDICO(A) - Opcional */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Médico(a) (opcional)
            </Label>

            <Select value={formData.doctorId} onValueChange={(v) => setFormData((prev) => ({ ...prev, doctorId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={activeDoctors.length ? "Selecione..." : "Sem médicos cadastrados"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem médico</SelectItem>
                {activeDoctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!companyId ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                CompanyId não identificado — a lista pode ficar vazia. (Se quiser, eu ajusto onde pegar esse companyId.)
              </p>
            ) : activeDoctors.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Nenhum médico ativo cadastrado ainda. Selecione “Sem médico” por enquanto.
              </p>
            ) : null}
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

            {/* CORREÇÃO #2: Campo Forma de Pagamento para PARTICULAR */}
            {formData.payerType === "PARTICULAR" && (
              <div className="space-y-2">
                <Label>Forma de Pagamento *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, paymentMethod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                    <SelectItem value="CREDITO_VISTA">Crédito à Vista</SelectItem>
                    <SelectItem value="CREDITO_PARCELADO">Crédito Parcelado</SelectItem>
                  </SelectContent>
                </Select>
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

          {/* MODELO PADRÃO ÚNICO: Quantidade + Valor Total Estimado */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-4">
            <div className="space-y-2">
              <Label className="text-amber-700 font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {getQuantityLabel()}
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
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
                value={formData.totalValue}
                onChange={(e) => setFormData((prev) => ({ ...prev, totalValue: e.target.value }))}
                className="text-lg font-bold text-center h-12 bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Valor total para a quantidade informada (opcional para referência)
              </p>
            </div>

            {/* Valor unitário calculado - apenas referência */}
            {calculatedUnitValue > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded">
                <Calculator className="h-3.5 w-3.5" />
                <span>
                  Valor unitário: {calculatedUnitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            )}
          </div>

          {/* BLOCO DE PACOTES CONVÊNIO - LOGO APÓS O VALOR TOTAL */}
          {isPackageType && (
            <div className="space-y-4">
              {!formData.convenio ? (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Selecione o convênio para calcular automaticamente os componentes do pacote.
                </div>
              ) : (
                <PackageFields
                  packageType={formData.productionType as "PACOTE_BOX" | "PACOTE_GTA"}
                  planId={formData.convenio}
                  referenceDate={formData.productionDate}
                  totalValue={parseFloat(formData.totalValue) || 0}
                  packageQty={parseInt(formData.quantity, 10) || 1}
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
                      // Se modo manual, sincronizar o TOTAL do formulário
                      totalValue: components.isManualOverride ? components.totalAmount.toFixed(2) : prev.totalValue,
                    }));
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="gradient-primary">
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
