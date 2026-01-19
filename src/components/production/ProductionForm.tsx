import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { ProductionType, UnitConfig, BASE_PRODUCTION_TYPES } from "@/types";
import { toast } from "sonner";
import { Activity, Check, ChevronsUpDown, Plus, Calculator, Package, AlertCircle, Info } from "lucide-react";
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
}

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

  // ===================================================================
  // EXAMES / PROCEDIMENTOS (FONTE ÚNICA OFICIAL)
  // ===================================================================
  // Regra: se existir cadastro oficial em Configurações → Exames,
  // a Produção DEVE refletir exatamente o banco (incluindo ativação/inativação).
  // DEFAULT_EXAM_TYPES vira apenas fallback para empresas sem cadastro.

  // Sugestões antigas (mantidas apenas para fallback/compatibilidade)
  const savedExamTypes = getSavedExamTypes();
  const savedTherapyTypes = getSavedTherapyTypes();
  const savedProductionTypes = getSavedProductionTypes();

  // Fonte oficial (Configurações → Exames)
  const masterExamTypesFromDB = (extendedSettings as any)?.examTypes ?? [];
  const masterExamNames = Array.isArray(masterExamTypesFromDB)
    ? masterExamTypesFromDB
        .filter((e: any) => (e?.active ?? e?.is_active) === true)
        .map((e: any) => String(e?.name ?? "").trim())
        .filter(Boolean)
    : [];

  // ✅ Se existir lista no banco, usa SOMENTE ela (para refletir on/off)
  // ✅ Se não existir ainda, usa fallback (default + sugestões antigas)
  const examTypes = (masterExamNames.length > 0 ? masterExamNames : [...DEFAULT_EXAM_TYPES, ...savedExamTypes])
    .filter(Boolean)
    .reduce((acc: string[], v: string) => (acc.includes(v) ? acc : [...acc, v]), [] as string[])
    .sort();

  const therapyTypes = [...new Set([...DEFAULT_THERAPY_TYPES, ...savedTherapyTypes])].sort();
  // Incluir pacotes convênio na lista de tipos
  const productionTypes = [
    ...new Set([...BASE_PRODUCTION_TYPES, ...PACKAGE_PRODUCTION_TYPES, ...savedProductionTypes]),
  ];
  const hasMasterExamTypes = masterExamNames.length > 0;

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
  });

  // Popovers state
  const [examTypeOpen, setExamTypeOpen] = useState(false);
  const [therapyTypeOpen, setTherapyTypeOpen] = useState(false);
  const [productionTypeOpen, setProductionTypeOpen] = useState(false);
  const [newExamType, setNewExamType] = useState("");
  const [newTherapyType, setNewTherapyType] = useState("");
  const [newProductionType, setNewProductionType] = useState("");

  // CORREÇÃO #1: Garantir unidades ativas - usar settings.units se units prop estiver vazia
  const effectiveUnits = units && units.length > 0 ? units : settings?.units || [];
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

  // Se a unidade é Centro Clínico / Centro Clinico
  const isCentroClinico =
    unitKey.includes("centroclinico") || unitKey.includes("centro clinico") || unitKey.includes("centro_clinico");

  // ===========================================================================
  // Regras dinâmicas para pacote convênio / produção
  // ===========================================================================
  const isPackageType = PACKAGE_PRODUCTION_TYPES.includes(formData.productionType);

  // Flag oficial para pacote
  useEffect(() => {
    setFormData((prev) => ({ ...prev, isPackage: isPackageType }));
  }, [isPackageType]);

  // Salvar novo tipo de exame
  const saveNewExamType = async () => {
    const examType = newExamType.trim();
    if (!examType) return;

    // Se já existe, só seleciona
    if (examTypes.includes(examType)) {
      setFormData((prev) => ({ ...prev, examType, description: examType }));
      setExamTypeOpen(false);
      setNewExamType("");
      return;
    }

    try {
      await addExamType(examType);
      toast.success("Tipo de exame adicionado!");
      setFormData((prev) => ({ ...prev, examType, description: examType }));
      setExamTypeOpen(false);
      setNewExamType("");
    } catch (error) {
      console.error("Error adding exam type:", error);
      toast.error("Erro ao adicionar tipo de exame");
    }
  };

  // Salvar novo tipo de terapia
  const saveNewTherapyType = async () => {
    const therapyType = newTherapyType.trim();
    if (!therapyType) return;

    if (therapyTypes.includes(therapyType)) {
      setFormData((prev) => ({ ...prev, therapySessionType: therapyType, description: therapyType }));
      setTherapyTypeOpen(false);
      setNewTherapyType("");
      return;
    }

    try {
      await addTherapyType(therapyType);
      toast.success("Tipo de sessão adicionado!");
      setFormData((prev) => ({ ...prev, therapySessionType: therapyType, description: therapyType }));
      setTherapyTypeOpen(false);
      setNewTherapyType("");
    } catch (error) {
      console.error("Error adding therapy type:", error);
      toast.error("Erro ao adicionar tipo de sessão");
    }
  };

  // Salvar novo tipo de produção
  const saveNewProductionType = async () => {
    const productionType = newProductionType.trim();
    if (!productionType) return;

    if (productionTypes.includes(productionType)) {
      setFormData((prev) => ({ ...prev, productionType: productionType as ProductionType }));
      setProductionTypeOpen(false);
      setNewProductionType("");
      return;
    }

    try {
      await addProductionType(productionType);
      toast.success("Tipo de produção adicionado!");
      setFormData((prev) => ({ ...prev, productionType: productionType as ProductionType }));
      setProductionTypeOpen(false);
      setNewProductionType("");
    } catch (error) {
      console.error("Error adding production type:", error);
      toast.error("Erro ao adicionar tipo de produção");
    }
  };

  // ===========================================================================
  // Funções auxiliares para cálculo e validações
  // ===========================================================================
  const getQuantityNumber = () => {
    const q = parseFloat(formData.quantity);
    if (isNaN(q) || q <= 0) return 1;
    return q;
  };

  const getTotalValueNumber = () => {
    const v = parseFloat(String(formData.totalValue).replace(",", "."));
    if (isNaN(v) || v < 0) return 0;
    return v;
  };

  // Calcular unitValue (sempre)
  const unitValue = () => {
    const qty = getQuantityNumber();
    const total = getTotalValueNumber();
    if (qty <= 0) return 0;
    return total / qty;
  };

  // ---------------------------------------------------------------------------
  // Validar quando pacote convênio está correto
  // ---------------------------------------------------------------------------
  const validatePackage = () => {
    if (!isPackageType) return { ok: true };

    const consultQty = formData.consultQty ?? 1;
    const feeQty = formData.feeQty ?? 1;
    const matmedQty = formData.matmedQty ?? 0;

    const consultAmount = formData.consultAmount ?? 0;
    const feeAmount = formData.feeAmount ?? 0;
    const matmedAmount = formData.matmedAmount ?? 0;

    // totalValue = soma
    const sum = consultAmount + feeAmount + matmedAmount;
    const total = getTotalValueNumber();

    // Forense: permitir pequeno delta centavos
    const delta = Math.abs(sum - total);

    if (delta > 0.05) {
      return {
        ok: false,
        message: "Pacote inconsistente: soma Consulta+Taxa+Mat/Med precisa bater com Valor Total.",
      };
    }

    // Qty default não pode ser 0
    if (consultQty <= 0 || feeQty <= 0) {
      return { ok: false, message: "Quantidade de Consulta/Taxa deve ser >= 1." };
    }

    return { ok: true };
  };

  // ===========================================================================
  // Submit - modelo definitivo
  // ===========================================================================
  const handleSubmit = () => {
    // validações básicas
    if (!formData.productionDate) {
      toast.error("Data obrigatória");
      return;
    }
    if (!formData.unit) {
      toast.error("Unidade obrigatória");
      return;
    }
    if (!formData.productionType) {
      toast.error("Tipo de produção obrigatório");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }

    // PARTICULAR precisa de forma de pagamento
    if (formData.payerType === "PARTICULAR" && !formData.paymentMethod.trim()) {
      toast.error("Modo de pagamento obrigatório para Particular");
      return;
    }

    // Convênio precisa de convênio
    if (formData.payerType === "CONVENIO" && !formData.convenio.trim()) {
      toast.error("Convênio obrigatório");
      return;
    }

    // Campos dinâmicos
    if (formData.productionType === "EXAME" && !formData.examType.trim()) {
      toast.error("Tipo de exame obrigatório");
      return;
    }
    if (formData.productionType === "SESSAO_TERAPEUTICA" && !formData.therapySessionType.trim()) {
      toast.error("Tipo de sessão obrigatório");
      return;
    }

    // Pacote convênio
    const packageValidation = validatePackage();
    if (!packageValidation.ok) {
      toast.error(packageValidation.message);
      return;
    }

    const data: ProductionFormData = {
      productionDate: formData.productionDate,
      competencia: formData.competencia,
      unit: formData.unit,
      specialty: formData.specialty || undefined,
      payerType: formData.payerType,
      convenio: formData.payerType === "CONVENIO" ? formData.convenio : undefined,
      paymentMethod: formData.payerType === "PARTICULAR" ? formData.paymentMethod : undefined,
      productionType: formData.productionType,
      description: formData.description,
      procedureCode: formData.procedureCode || undefined,
      quantity: getQuantityNumber(),
      unitValue: unitValue(),
      notes: formData.notes || undefined,
      createdBy: userName,

      // Campos dinâmicos
      examType: formData.productionType === "EXAME" ? formData.examType : undefined,
      therapySessionType: formData.productionType === "SESSAO_TERAPEUTICA" ? formData.therapySessionType : undefined,

      // Pacote convênio
      isPackage: isPackageType ? true : undefined,
      packageType: isPackageType ? formData.productionType : undefined,
      packageQty: isPackageType ? 1 : undefined,

      consultAmount: isPackageType ? formData.consultAmount : undefined,
      feeAmount: isPackageType ? formData.feeAmount : undefined,
      matmedAmount: isPackageType ? formData.matmedAmount : undefined,

      consultQty: isPackageType ? formData.consultQty : undefined,
      feeQty: isPackageType ? formData.feeQty : undefined,
      matmedQty: isPackageType ? formData.matmedQty : undefined,
    };

    onSubmit(data);
    toast.success("Produção lançada com sucesso!");
    onOpenChange(false);
  };

  // ===========================================================================
  // Renderizar campos dinâmicos por tipo
  // ===========================================================================
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

              <p className="text-xs text-muted-foreground flex items-center gap-1">
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

      case "SESSAO_TERAPEUTICA":
        return (
          <div className="space-y-2">
            <Label>Tipo de Sessão *</Label>
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
                    placeholder="Buscar ou adicionar sessão..."
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
                            setFormData((prev) => ({
                              ...prev,
                              therapySessionType: type,
                              description: type,
                            }));
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

      default:
        return null;
    }
  };

  // ===========================================================================
  // UI
  // ===========================================================================
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            Lançar Produção
          </DialogTitle>
          <DialogDescription>
            Registre uma nova produção com validações inteligentes e compatibilidade total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Unidade */}
          <div className="space-y-2">
            <Label>Unidade *</Label>
            <Select value={formData.unit} onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade..." />
              </SelectTrigger>
              <SelectContent>
                {activeUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Competência */}
          <div className="space-y-2">
            <Label>Competência</Label>
            <Input value={formData.competencia} disabled />
          </div>

          {/* Tipo de Pagador */}
          <div className="space-y-2">
            <Label>Pagador *</Label>
            <Select
              value={formData.payerType}
              onValueChange={(value: any) => setFormData((prev) => ({ ...prev, payerType: value }))}
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

          {/* Convênio / Pagamento Particular */}
          {formData.payerType === "CONVENIO" ? (
            <div className="space-y-2">
              <Label>Convênio *</Label>
              <Select
                value={formData.convenio}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, convenio: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o convênio..." />
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
          ) : (
            <div className="space-y-2">
              <Label>Modo de pagamento *</Label>
              <Input
                placeholder="Ex: Pix, Cartão, Dinheiro"
                value={formData.paymentMethod}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              />
            </div>
          )}

          {/* Tipo de Produção */}
          <div className="space-y-2">
            <Label>Tipo de Produção *</Label>
            <Popover open={productionTypeOpen} onOpenChange={setProductionTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productionTypeOpen}
                  className="w-full justify-between"
                >
                  {getProductionTypeLabel(formData.productionType) || "Selecione ou digite..."}
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
                            setFormData((prev) => ({ ...prev, productionType: type as ProductionType }));
                            setProductionTypeOpen(false);
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

          {/* Campos dinâmicos */}
          {renderDynamicFields()}

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              placeholder="Descreva o procedimento..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </div>

          {/* Valor total estimado */}
          <div className="space-y-2">
            <Label>Valor Total Estimado *</Label>
            <Input
              placeholder="Ex: 250"
              value={formData.totalValue}
              onChange={(e) => setFormData((prev) => ({ ...prev, totalValue: e.target.value }))}
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {/* Pacotes */}
          {isPackageType && (
            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Package className="h-4 w-4" />
                Pacote Convênio
              </div>
              <PackageFields formData={formData} setFormData={setFormData} />
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />A soma Consulta + Taxa + Mat/Med deve bater com o Valor Total.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700">
            <Calculator className="h-4 w-4 mr-2" />
            Salvar Produção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
