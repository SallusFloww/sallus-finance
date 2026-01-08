import { useState, useEffect } from "react";
import { 
  Building2, 
  Tag, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  TrendingUp, 
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Layers,
  AlertTriangle,
  Star,
  BarChart3,
  StickyNote,
  Stethoscope,
  Package,
  FileText,
  Users,
  Settings2,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { CategoryType, Subunit, SpecialtyConfig, ProductionTypeConfig, ExamTypeConfig, PayerConfig, SystemParameters, ExpandedSettings } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DEFAULT_UNITS, SPECIALTIES, SPECIALTY_LABELS } from "@/utils/constants";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  SettingsProductionTypes,
  SettingsExamTypes,
  SettingsPayers,
  SettingsParameters,
  SettingsPackagePricing,
} from "@/components/settings";
import { DemoSettings } from "@/components/settings/DemoSettings";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useProductionDB } from "@/hooks/useProductionDB";
import { Boxes, FlaskConical } from "lucide-react";

export default function Settings() {
  const { transactions, auditLog } = useApp();
  const { transactions: allTransactions } = transactions;
  const { profile, isAdmin } = useAuth();
  
  // Use database-backed settings instead of localStorage
  const { 
    settings, 
    extendedSettings, 
    updateSettings, 
    updateExtendedSettings,
    loading: settingsLoading 
  } = useCompanySettings();
  
  // Wrapper to update extended settings
  const setExtendedSettings = (updater: ((prev: ExpandedSettings) => ExpandedSettings) | Partial<ExpandedSettings>) => {
    if (typeof updater === 'function') {
      const newValue = updater(extendedSettings);
      updateExtendedSettings(newValue);
    } else {
      updateExtendedSettings(updater);
    }
  };
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  const addAuditLog = (_action: string, _details: string, _meta?: unknown) => {};
  
  const { receivables } = useReceivablesDB();
  const { productions } = useProductionDB();

  // Unit states
  const [newUnit, setNewUnit] = useState("");
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState("");
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);

  // Subunit states
  const [newSubunit, setNewSubunit] = useState<Record<string, string>>({});
  const [editingSubunitId, setEditingSubunitId] = useState<string | null>(null);
  const [editingSubunitName, setEditingSubunitName] = useState("");

  // Specialty states (Centro Clínico only)
  const [newSpecialty, setNewSpecialty] = useState("");
  const [editingSpecialtyId, setEditingSpecialtyId] = useState<string | null>(null);
  const [editingSpecialtyName, setEditingSpecialtyName] = useState("");
  const [specialtyToDelete, setSpecialtyToDelete] = useState<{ unitId: string; id: string; name: string } | null>(null);

  // Category states
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>("EXPENSE");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatType, setEditingCatType] = useState<CategoryType>("EXPENSE");
  const [editingCatStrategic, setEditingCatStrategic] = useState(false);
  const [editingCatImpacts, setEditingCatImpacts] = useState(false);
  const [editingCatNote, setEditingCatNote] = useState("");

  // Check if unit has linked transactions
  const getUnitTransactionCount = (unitId: string) => {
    return allTransactions.filter((t) => t.unit === unitId).length;
  };

  // Toggle unit expansion
  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  // ============= UNIT HANDLERS =============
  const handleRestoreDefaultUnits = () => {
    if (!isAdmin()) {
      toast.error("Apenas administradores podem restaurar unidades.");
      return;
    }

    const byId = new Map(settings.units.map((u) => [u.id, u]));

    DEFAULT_UNITS.forEach((def) => {
      const existing = byId.get(def.id);
      if (existing) {
        byId.set(def.id, {
          ...existing,
          name: def.name, // garante o nome correto
          active: true,
        });
      } else {
        byId.set(def.id, { ...def, active: true, subunits: def.subunits || [] });
      }
    });

    // Garantir especialidades padrão no Centro Clínico (se não existir cadastro)
    const centro = byId.get("CENTRO_CLINICO");
    if (centro) {
      const existing = Array.isArray((centro as any).specialties) ? (centro as any).specialties : [];
      if (existing.length === 0) {
        (centro as any).specialties = SPECIALTIES.map((s) => ({ id: s.id, name: s.name, active: true }));
      }
      byId.set("CENTRO_CLINICO", centro);
    }

    updateSettings({ units: Array.from(byId.values()) });
    toast.success("Unidades padrão restauradas!");
  };

  const handleToggleUnit = (unitId: string) => {
    const unit = settings.units.find((u) => u.id === unitId);
    const updatedUnits = settings.units.map((u) =>
      u.id === unitId ? { ...u, active: !u.active } : u
    );
    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Unidade "${unit?.name}" ${updatedUnits.find((u) => u.id === unitId)?.active ? "ativada" : "desativada"}`);
    toast.success("Configuração salva!");
  };

  const handleAddUnit = () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;

    const exists = settings.units.some(
      (u) => u.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Unidade já existe!");
      return;
    }

    const newUnitObj = {
      id: trimmed.toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      name: trimmed,
      active: true,
      subunits: [],
    };

    const updatedUnits = [...settings.units, newUnitObj].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Unidade "${trimmed}" adicionada`);
    setNewUnit("");
    toast.success("Unidade adicionada!");
  };

  const handleRemoveUnit = (unitId: string, unitName: string) => {
    const transactionCount = getUnitTransactionCount(unitId);
    if (transactionCount > 0) {
      toast.error(`Não é possível excluir: existem ${transactionCount} movimentação(ões) vinculada(s) a esta unidade.`);
      return;
    }

    updateSettings({
      units: settings.units.filter((u) => u.id !== unitId),
    });
    addAuditLog("UPDATE_SETTINGS", `Unidade "${unitName}" removida`);
    toast.success("Unidade removida!");
  };

  const handleStartEditUnit = (unitId: string, unitName: string) => {
    setEditingUnitId(unitId);
    setEditingUnitName(unitName);
  };

  const handleSaveEditUnit = () => {
    const trimmed = editingUnitName.trim();
    if (!trimmed) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const exists = settings.units.some(
      (u) => u.id !== editingUnitId && u.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Já existe uma unidade com esse nome!");
      return;
    }

    const oldUnit = settings.units.find((u) => u.id === editingUnitId);
    const updatedUnits = settings.units
      .map((u) => u.id === editingUnitId ? { ...u, name: trimmed } : u)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Unidade "${oldUnit?.name}" renomeada para "${trimmed}"`);
    setEditingUnitId(null);
    setEditingUnitName("");
    toast.success("Unidade atualizada!");
  };

  const handleCancelEditUnit = () => {
    setEditingUnitId(null);
    setEditingUnitName("");
  };

  // ============= SUBUNIT HANDLERS =============
  const handleAddSubunit = (unitId: string) => {
    const subunitName = newSubunit[unitId]?.trim();
    if (!subunitName) return;

    const unit = settings.units.find((u) => u.id === unitId);
    if (!unit) return;

    const exists = unit.subunits?.some(
      (s) => s.name.toLowerCase() === subunitName.toLowerCase()
    );
    if (exists) {
      toast.error("Subunidade já existe!");
      return;
    }

    const newSubunitObj: Subunit = {
      id: subunitName.toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      name: subunitName,
      active: true,
    };

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? { ...u, subunits: [...(u.subunits || []), newSubunitObj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Subunidade "${subunitName}" adicionada à unidade "${unit.name}"`);
    setNewSubunit((prev) => ({ ...prev, [unitId]: "" }));
    toast.success("Subunidade adicionada!");
  };

  const handleRemoveSubunit = (unitId: string, subunitId: string, subunitName: string) => {
    const unit = settings.units.find((u) => u.id === unitId);
    if (!unit) return;

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? { ...u, subunits: u.subunits?.filter((s) => s.id !== subunitId) || [] }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Subunidade "${subunitName}" removida da unidade "${unit.name}"`);
    toast.success("Subunidade removida!");
  };

  const handleToggleSubunit = (unitId: string, subunitId: string) => {
    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            subunits: u.subunits?.map((s) =>
              s.id === subunitId ? { ...s, active: !s.active } : s
            ) || [],
          }
        : u
    );

    updateSettings({ units: updatedUnits });
    toast.success("Configuração salva!");
  };

  const handleStartEditSubunit = (subunitId: string, subunitName: string) => {
    setEditingSubunitId(subunitId);
    setEditingSubunitName(subunitName);
  };

  const handleSaveEditSubunit = (unitId: string) => {
    const trimmed = editingSubunitName.trim();
    if (!trimmed) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const unit = settings.units.find((u) => u.id === unitId);
    if (!unit) return;

    const exists = unit.subunits?.some(
      (s) => s.id !== editingSubunitId && s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Já existe uma subunidade com esse nome!");
      return;
    }

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            subunits: u.subunits?.map((s) =>
              s.id === editingSubunitId ? { ...s, name: trimmed } : s
            ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) || [],
          }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Subunidade renomeada para "${trimmed}"`);
    setEditingSubunitId(null);
    setEditingSubunitName("");
    toast.success("Subunidade atualizada!");
  };

  const handleCancelEditSubunit = () => {
    setEditingSubunitId(null);
    setEditingSubunitName("");
  };

  // ============= SPECIALTY HANDLERS (Centro Clínico) =============
  // Check for Centro Clínico unit by ID or name (case-insensitive), but persist specialties by ID
  const isCentroClinico = (unit: { id: string; name: string }) => {
    const normalizedId = unit.id.toUpperCase();
    if (normalizedId === "CENTRO_CLINICO") return true;
    const normalizedName = unit.name.toLowerCase().replace(/[_\s]/g, "");
    return (
      normalizedId.includes("CENTRO_CLINICO") ||
      normalizedName.includes("centroclínico") ||
      normalizedName.includes("centroclinico")
    );
  };

  // Hidratar especialidades existentes do Centro Clínico a partir das transações (apenas se ainda não houver cadastro)
  useEffect(() => {
    const centroClinico = settings.units.find((u) => u.id === "CENTRO_CLINICO");
    if (!centroClinico) return;

    // Se já existem especialidades cadastradas, não sobrescrever
    if (centroClinico.specialties && centroClinico.specialties.length > 0) return;

    // Buscar especialidades distintas usadas nas movimentações do Centro Clínico
    const usedSpecialtyIds = Array.from(
      new Set(
        allTransactions
          .filter((t) => t.unit === "CENTRO_CLINICO" && t.specialty)
          .map((t) => t.specialty as string)
      )
    );

    if (usedSpecialtyIds.length === 0) return;

    const inferredSpecialties: SpecialtyConfig[] = usedSpecialtyIds.map((id) => ({
      id,
      name: SPECIALTY_LABELS[id] ?? id,
      active: true,
    }));

    const updatedUnits = settings.units.map((u) =>
      u.id === "CENTRO_CLINICO"
        ? {
            ...u,
            specialties: inferredSpecialties.sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR")
            ),
          }
        : u
    );

    updateSettings({ units: updatedUnits });
  }, [allTransactions, settings.units, updateSettings]);

  const getSpecialtyTransactionCount = (specialtyId: string) => {
    return allTransactions.filter((t) => t.specialty === specialtyId).length;
  };

  const handleAddSpecialty = (unitId: string) => {
    const trimmed = newSpecialty.trim();
    if (!trimmed) return;

    const unit = settings.units.find((u) => u.id === unitId);
    if (!unit) {
      toast.error("Centro Clínico não encontrado!");
      return;
    }

    const exists = unit.specialties?.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Especialidade já existe!");
      return;
    }

    const newSpecialtyObj: SpecialtyConfig = {
      id: trimmed.toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      name: trimmed,
      active: true,
    };

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? { ...u, specialties: [...(u.specialties || []), newSpecialtyObj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Especialidade "${trimmed}" adicionada ao Centro Clínico`);
    setNewSpecialty("");
    toast.success("Especialidade adicionada!");
  };

  const handleConfirmDeleteSpecialty = () => {
    if (!specialtyToDelete) return;
    const { unitId, id, name } = specialtyToDelete;

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? { ...u, specialties: u.specialties?.filter((s) => s.id !== id) || [] }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Especialidade "${name}" removida do Centro Clínico`);
    toast.success("Especialidade removida!");
    setSpecialtyToDelete(null);
  };

  const handleToggleSpecialty = (unitId: string, specialtyId: string) => {
    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            specialties: u.specialties?.map((s) =>
              s.id === specialtyId ? { ...s, active: !s.active } : s
            ) || [],
          }
        : u
    );

    updateSettings({ units: updatedUnits });
    toast.success("Configuração salva!");
  };

  const handleStartEditSpecialty = (specialtyId: string, specialtyName: string) => {
    setEditingSpecialtyId(specialtyId);
    setEditingSpecialtyName(specialtyName);
  };

  const handleSaveEditSpecialty = (unitId: string) => {
    const trimmed = editingSpecialtyName.trim();
    if (!trimmed) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const unit = settings.units.find((u) => u.id === unitId);
    if (!unit) return;

    const exists = unit.specialties?.some(
      (s) => s.id !== editingSpecialtyId && s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Já existe uma especialidade com esse nome!");
      return;
    }

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            specialties: u.specialties?.map((s) =>
              s.id === editingSpecialtyId ? { ...s, name: trimmed } : s
            ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) || [],
          }
        : u
    );

    updateSettings({ units: updatedUnits });
    addAuditLog("UPDATE_SETTINGS", `Especialidade renomeada para "${trimmed}"`);
    setEditingSpecialtyId(null);
    setEditingSpecialtyName("");
    toast.success("Especialidade atualizada!");
  };

  const handleCancelEditSpecialty = () => {
    setEditingSpecialtyId(null);
    setEditingSpecialtyName("");
  };

  // centroClinicoUnit is no longer needed - we use isCentroClinico in the render

  // ============= CATEGORY HANDLERS =============
  const handleToggleCategory = (catId: string) => {
    const cat = settings.categories.find((c) => c.id === catId);
    const updatedCategories = settings.categories.map((c) =>
      c.id === catId ? { ...c, active: !c.active } : c
    );
    updateSettings({ categories: updatedCategories });
    addAuditLog("UPDATE_SETTINGS", `Categoria "${cat?.name}" ${updatedCategories.find((c) => c.id === catId)?.active ? "ativada" : "desativada"}`);
    toast.success("Configuração salva!");
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    const exists = settings.categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Categoria já existe!");
      return;
    }

    const newCat = {
      id: trimmed.toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      name: trimmed,
      type: newCategoryType,
      active: true,
      isStrategic: false,
      impactsPredictability: false,
      internalNote: "",
    };

    const updatedCategories = [...settings.categories, newCat].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );

    updateSettings({ categories: updatedCategories });
    addAuditLog("UPDATE_SETTINGS", `Categoria "${trimmed}" (${newCategoryType === "INCOME" ? "Entrada" : "Saída"}) adicionada`);
    setNewCategory("");
    toast.success("Categoria adicionada!");
  };

  const handleRemoveCategory = (catId: string, catName: string) => {
    updateSettings({
      categories: settings.categories.filter((c) => c.id !== catId),
    });
    addAuditLog("UPDATE_SETTINGS", `Categoria "${catName}" removida`);
    toast.success("Categoria removida!");
  };

  const handleStartEditCategory = (catId: string, catName: string, catType: CategoryType) => {
    const cat = settings.categories.find((c) => c.id === catId);
    setEditingCatId(catId);
    setEditingCatName(catName);
    setEditingCatType(catType);
    setEditingCatStrategic(cat?.isStrategic || false);
    setEditingCatImpacts(cat?.impactsPredictability || false);
    setEditingCatNote(cat?.internalNote || "");
  };

  const handleSaveEditCategory = () => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const exists = settings.categories.some(
      (c) => c.id !== editingCatId && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Já existe uma categoria com esse nome!");
      return;
    }

    const oldCat = settings.categories.find((c) => c.id === editingCatId);
    const updatedCategories = settings.categories
      .map((c) => c.id === editingCatId ? { 
        ...c, 
        name: trimmed, 
        type: editingCatType,
        isStrategic: editingCatStrategic,
        impactsPredictability: editingCatImpacts,
        internalNote: editingCatNote,
      } : c)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    updateSettings({ categories: updatedCategories });
    addAuditLog("UPDATE_SETTINGS", `Categoria "${oldCat?.name}" atualizada para "${trimmed}" (${editingCatType === "INCOME" ? "Entrada" : "Saída"})`);
    setEditingCatId(null);
    setEditingCatName("");
    setEditingCatStrategic(false);
    setEditingCatImpacts(false);
    setEditingCatNote("");
    toast.success("Categoria atualizada!");
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName("");
    setEditingCatStrategic(false);
    setEditingCatImpacts(false);
    setEditingCatNote("");
  };

  // Filter categories by type
  const incomeCategories = settings.categories.filter(c => c.type === "INCOME");
  const expenseCategories = settings.categories.filter(c => c.type === "EXPENSE");

  // Render category card
  const renderCategoryCard = (cat: typeof settings.categories[0], isExpense: boolean) => {
    const baseStyles = isExpense
      ? cat.active 
        ? "border-destructive/20 bg-destructive/5" 
        : "border-border bg-muted/30 opacity-60"
      : cat.active 
        ? "border-success/20 bg-success/5" 
        : "border-border bg-muted/30 opacity-60";

    if (editingCatId === cat.id) {
      return (
        <div
          key={cat.id}
          className={`rounded-lg border p-4 ${baseStyles}`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={editingCatName}
                onChange={(e) => setEditingCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEditCategory();
                  if (e.key === "Escape") handleCancelEditCategory();
                }}
                className="h-8 text-sm flex-1"
                autoFocus
              />
              <Select value={editingCatType} onValueChange={(v) => setEditingCatType(v as CategoryType)}>
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Entrada</SelectItem>
                  <SelectItem value="EXPENSE">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Governance fields */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`strategic-${cat.id}`}
                  checked={editingCatStrategic}
                  onCheckedChange={(checked) => setEditingCatStrategic(checked === true)}
                />
                <Label htmlFor={`strategic-${cat.id}`} className="text-xs flex items-center gap-1">
                  <Star className="h-3 w-3 text-warning" />
                  Categoria estratégica
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`impacts-${cat.id}`}
                  checked={editingCatImpacts}
                  onCheckedChange={(checked) => setEditingCatImpacts(checked === true)}
                />
                <Label htmlFor={`impacts-${cat.id}`} className="text-xs flex items-center gap-1">
                  <BarChart3 className="h-3 w-3 text-info" />
                  Impacta previsibilidade
                </Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <StickyNote className="h-3 w-3 text-muted-foreground" />
                  Observação interna
                </Label>
                <Textarea
                  value={editingCatNote}
                  onChange={(e) => setEditingCatNote(e.target.value)}
                  placeholder="Nota interna..."
                  className="h-16 text-xs resize-none"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="flex justify-end gap-1 pt-1">
              <Button size="sm" variant="ghost" onClick={handleSaveEditCategory} className="h-7 text-success">
                <Check className="h-3 w-3 mr-1" />
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEditCategory} className="h-7">
                <X className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={cat.id}
        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${baseStyles}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
          {cat.isStrategic && (
            <span title="Categoria estratégica">
              <Star className="h-3 w-3 text-warning shrink-0" />
            </span>
          )}
          {cat.impactsPredictability && (
            <span title="Impacta previsibilidade">
              <BarChart3 className="h-3 w-3 text-info shrink-0" />
            </span>
          )}
          {cat.internalNote && (
            <span title={cat.internalNote}>
              <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleStartEditCategory(cat.id, cat.name, cat.type)}
            className="h-7 w-7"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveCategory(cat.id, cat.name)}
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Switch
            checked={cat.active}
            onCheckedChange={() => handleToggleCategory(cat.id)}
            className="scale-75"
          />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Personalize unidades, subunidades e categorias do sistema
          </p>
        </div>

        <Tabs defaultValue="units" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="units" className="gap-1 text-xs lg:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Unidades</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1 text-xs lg:text-sm">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="production-types" className="gap-1 text-xs lg:text-sm">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produção</span>
            </TabsTrigger>
            <TabsTrigger value="exam-types" className="gap-1 text-xs lg:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Exames</span>
            </TabsTrigger>
            <TabsTrigger value="payers" className="gap-1 text-xs lg:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Pagadores</span>
            </TabsTrigger>
            <TabsTrigger value="packages" className="gap-1 text-xs lg:text-sm">
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">Pacotes</span>
            </TabsTrigger>
            <TabsTrigger value="parameters" className="gap-1 text-xs lg:text-sm">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Parâmetros</span>
            </TabsTrigger>
            {isAdmin() && (
              <TabsTrigger value="demo" className="gap-1 text-xs lg:text-sm text-amber-600">
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">DEMO</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============= UNITS TAB ============= */}
          <TabsContent value="units" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Unidades de Negócio</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Gerencie as unidades e seus setores/subunidades
              </p>

              <div className="mb-6 flex gap-3">
                <Input
                  placeholder="Nova unidade..."
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUnit()}
                  className="max-w-sm"
                />
                <Button onClick={handleAddUnit} className="gap-2 gradient-primary">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRestoreDefaultUnits}
                  disabled={!isAdmin()}
                >
                  Restaurar Unidades Padrão
                </Button>
              </div>

              <div className="space-y-3">
                {settings.units.map((unit) => {
                  const transactionCount = getUnitTransactionCount(unit.id);
                  const isExpanded = expandedUnits.includes(unit.id);
                  const subunitCount = unit.subunits?.length || 0;

                  return (
                    <Collapsible
                      key={unit.id}
                      open={isExpanded}
                      onOpenChange={() => toggleUnitExpansion(unit.id)}
                    >
                      <div className="rounded-lg border border-border overflow-hidden">
                        {/* Unit header */}
                        <div className="flex items-center justify-between p-4 bg-card">
                          <div className="flex items-center gap-3 flex-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>

                            {editingUnitId === unit.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={editingUnitName}
                                  onChange={(e) => setEditingUnitName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEditUnit();
                                    if (e.key === "Escape") handleCancelEditUnit();
                                  }}
                                  className="max-w-[200px]"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" onClick={handleSaveEditUnit} className="h-8 w-8 text-success">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleCancelEditUnit} className="h-8 w-8">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{unit.name}</p>
                                  {subunitCount > 0 && (
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {subunitCount} setor{subunitCount > 1 ? "es" : ""}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {unit.active ? "Ativo" : "Inativo"} • {transactionCount} movimentação(ões)
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {editingUnitId !== unit.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStartEditUnit(unit.id, unit.name)}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveUnit(unit.id, unit.name)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={transactionCount > 0}
                                  title={transactionCount > 0 ? "Não é possível excluir: existem movimentações vinculadas" : "Excluir unidade"}
                                >
                                  {transactionCount > 0 ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Switch
                                  checked={unit.active}
                                  onCheckedChange={() => handleToggleUnit(unit.id)}
                                />
                              </>
                            )}
                          </div>
                        </div>

                        {/* Subunits section */}
                        <CollapsibleContent>
                          <div className="border-t border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">Setores / Subunidades</span>
                            </div>

                            {/* Add subunit form */}
                            <div className="flex gap-2 mb-3">
                              <Input
                                placeholder="Novo setor..."
                                value={newSubunit[unit.id] || ""}
                                onChange={(e) => setNewSubunit((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleAddSubunit(unit.id)}
                                className="h-8 text-sm max-w-xs"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddSubunit(unit.id)}
                                className="h-8 gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Adicionar
                              </Button>
                            </div>

                            {/* Subunits list */}
                            {unit.subunits && unit.subunits.length > 0 ? (
                              <div className="space-y-2">
                                {unit.subunits.map((subunit) => (
                                  <div
                                    key={subunit.id}
                                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                                      subunit.active
                                        ? "border-border bg-background"
                                        : "border-border/50 bg-muted/50 opacity-60"
                                    }`}
                                  >
                                    {editingSubunitId === subunit.id ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <Input
                                          value={editingSubunitName}
                                          onChange={(e) => setEditingSubunitName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEditSubunit(unit.id);
                                            if (e.key === "Escape") handleCancelEditSubunit();
                                          }}
                                          className="h-7 text-sm max-w-[150px]"
                                          autoFocus
                                        />
                                        <Button size="icon" variant="ghost" onClick={() => handleSaveEditSubunit(unit.id)} className="h-6 w-6 text-success">
                                          <Check className="h-3 w-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={handleCancelEditSubunit} className="h-6 w-6">
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-sm text-foreground">{subunit.name}</span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleStartEditSubunit(subunit.id, subunit.name)}
                                            className="h-6 w-6"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveSubunit(unit.id, subunit.id, subunit.name)}
                                            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                          <Switch
                                            checked={subunit.active}
                                            onCheckedChange={() => handleToggleSubunit(unit.id, subunit.id)}
                                            className="scale-75"
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Nenhum setor cadastrado. Adicione setores para organização interna.
                              </p>
                            )}

                            <p className="mt-3 text-xs text-muted-foreground">
                              💡 Subunidades ficam disponíveis para filtros analíticos (Score, Projeção, Cenários).
                            </p>

                            {/* Specialties Section - Centro Clínico only */}
                            {isCentroClinico(unit) && (
                              <div className="mt-6 pt-4 border-t border-border">
                                <div className="flex items-center gap-2 mb-3">
                                  <Stethoscope className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium text-foreground">Especialidades</span>
                                  {unit.specialties && unit.specialties.length > 0 && (
                                    <span className="text-xs text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded">
                                      {unit.specialties.length}
                                    </span>
                                  )}
                                </div>

                                {/* Add specialty form */}
                                <div className="flex gap-2 mb-3">
                                  <Input
                                    placeholder="Nova especialidade..."
                                    value={newSpecialty}
                                    onChange={(e) => setNewSpecialty(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddSpecialty(unit.id)}
                                    className="h-8 text-sm max-w-xs"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddSpecialty(unit.id)}
                                    className="h-8 gap-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adicionar
                                  </Button>
                                </div>

                                {/* Specialties list */}
                                {unit.specialties && unit.specialties.length > 0 ? (
                                  <div className="space-y-2">
                                    {unit.specialties.map((specialty) => {
                                      const specTransactionCount = getSpecialtyTransactionCount(specialty.id);
                                      return (
                                        <div
                                          key={specialty.id}
                                          className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                                            specialty.active
                                              ? "border-primary/30 bg-primary/5"
                                              : "border-border/50 bg-muted/50 opacity-60"
                                          }`}
                                        >
                                          {editingSpecialtyId === specialty.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <Input
                                                value={editingSpecialtyName}
                                                onChange={(e) => setEditingSpecialtyName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") handleSaveEditSpecialty(unit.id);
                                                  if (e.key === "Escape") handleCancelEditSpecialty();
                                                }}
                                                className="h-7 text-sm max-w-[150px]"
                                                autoFocus
                                              />
                                              <Button size="icon" variant="ghost" onClick={() => handleSaveEditSpecialty(unit.id)} className="h-6 w-6 text-success">
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" onClick={handleCancelEditSpecialty} className="h-6 w-6">
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm text-foreground">{specialty.name}</span>
                                                {specTransactionCount > 0 && (
                                                  <span className="text-xs text-muted-foreground">
                                                    ({specTransactionCount} mov.)
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleStartEditSpecialty(specialty.id, specialty.name)}
                                                  className="h-6 w-6"
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </Button>
                                                {specTransactionCount > 0 ? (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground cursor-not-allowed"
                                                    title="Especialidade possui histórico financeiro. Exclusão não permitida — apenas desativação."
                                                    onClick={() => toast.warning("Especialidade possui histórico financeiro. Exclusão não permitida — apenas desativação.")}
                                                  >
                                                    <AlertTriangle className="h-3 w-3" />
                                                  </Button>
                                                ) : (
                                                  <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        title="Excluir especialidade"
                                                        onClick={() => setSpecialtyToDelete({ unitId: unit.id, id: specialty.id, name: specialty.name })}
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir especialidade?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          Deseja realmente excluir a especialidade <strong>"{specialty.name}"</strong>?
                                                          Esta ação não pode ser desfeita.
                                                        </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setSpecialtyToDelete(null)}>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                          onClick={handleConfirmDeleteSpecialty}
                                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                          Excluir
                                                        </AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                                )}
                                                <Switch
                                                  checked={specialty.active}
                                                  onCheckedChange={() => handleToggleSpecialty(unit.id, specialty.id)}
                                                  className="scale-75"
                                                />
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-6 text-center bg-muted/20 rounded-lg border border-dashed border-border">
                                    <Stethoscope className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                      Nenhuma especialidade cadastrada.
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Adicione uma nova especialidade acima.
                                    </p>
                                  </div>
                                )}

                                <p className="mt-3 text-xs text-muted-foreground">
                                  🏥 Especialidades ficam disponíveis para filtros analíticos (Score, Projeção, Cenários).
                                </p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Total: {settings.units.length} unidades ({settings.units.filter(u => u.active).length} ativas)
              </p>
            </div>
          </TabsContent>

          {/* ============= CATEGORIES TAB ============= */}
          <TabsContent value="categories" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Categorias</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Gerencie as categorias de entradas e saídas
              </p>

              {/* Add new category */}
              <div className="mb-6 flex flex-wrap gap-3">
                <Input
                  placeholder="Nova categoria..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  className="max-w-sm"
                />
                <Select value={newCategoryType} onValueChange={(v) => setNewCategoryType(v as CategoryType)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        Entrada
                      </span>
                    </SelectItem>
                    <SelectItem value="EXPENSE">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        Saída
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddCategory} className="gap-2 gradient-primary">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              {/* Legend */}
              <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-warning" />
                  Estratégica
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3 text-info" />
                  Impacta previsibilidade
                </span>
                <span className="flex items-center gap-1">
                  <StickyNote className="h-3 w-3 text-muted-foreground" />
                  Tem observação
                </span>
              </div>

              {/* Expense Categories */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <h4 className="font-medium text-foreground">Categorias de Saída</h4>
                  <span className="text-xs text-muted-foreground">({expenseCategories.length})</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {expenseCategories.map((cat) => renderCategoryCard(cat, true))}
                </div>
              </div>

              {/* Income Categories */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <h4 className="font-medium text-foreground">Categorias de Entrada</h4>
                  <span className="text-xs text-muted-foreground">({incomeCategories.length})</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {incomeCategories.map((cat) => renderCategoryCard(cat, false))}
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Total: {settings.categories.length} categorias ({settings.categories.filter(c => c.active).length} ativas)
              </p>
            </div>
          </TabsContent>

          {/* ============= PRODUCTION TYPES TAB ============= */}
          <TabsContent value="production-types" className="space-y-4">
            <SettingsProductionTypes
              productionTypes={extendedSettings.productionTypes || []}
              productions={productions}
              onUpdate={(types) => setExtendedSettings(prev => ({ ...prev, productionTypes: types }))}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= EXAM TYPES TAB ============= */}
          <TabsContent value="exam-types" className="space-y-4">
            <SettingsExamTypes
              examTypes={extendedSettings.examTypes || []}
              productionTypes={extendedSettings.productionTypes || []}
              productions={productions}
              onUpdate={(types) => setExtendedSettings(prev => ({ ...prev, examTypes: types }))}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= PAYERS TAB ============= */}
          <TabsContent value="payers" className="space-y-4">
            <SettingsPayers
              payers={extendedSettings.payers || []}
              productions={productions}
              receivables={receivables}
              onUpdate={(payers) => setExtendedSettings(prev => ({ ...prev, payers }))}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= PACKAGES TAB ============= */}
          <TabsContent value="packages" className="space-y-4">
            <SettingsPackagePricing />
          </TabsContent>

          {/* ============= PARAMETERS TAB ============= */}
          <TabsContent value="parameters" className="space-y-4">
            <SettingsParameters
              parameters={extendedSettings.systemParameters || {
                daysForBillingAlert: 15,
                allowFutureCompetence: false,
                allowPhysicalDeletion: false,
                criticalActionConfirmation: "SIMPLE",
              }}
              onUpdate={(params) => setExtendedSettings(prev => ({ ...prev, systemParameters: params }))}
              onAddLog={addAuditLog}
              userName={user?.name || "Sistema"}
            />
          </TabsContent>

          {/* ============= DEMO TAB (Admin only) ============= */}
          {isAdmin() && (
            <TabsContent value="demo" className="space-y-4">
              <DemoSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
