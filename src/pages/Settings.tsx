import { useState } from "react";
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
  Boxes,
  FlaskConical,
  UserRound, // ✅ NOVO (aba Médicos)
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { CategoryType, Subunit, ExpandedSettings } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DEFAULT_UNITS } from "@/utils/constants";

import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  SettingsProductionTypes,
  SettingsExamTypes,
  SettingsPayers,
  SettingsParameters,
  SettingsPackagePricing,
  SettingsSpecialties,
  SettingsPaymentMethodsParticular,
} from "@/components/settings";
import { DemoSettings } from "@/components/settings/DemoSettings";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useProductionDB } from "@/hooks/useProductionDB";

// ✅ IMPORTA O CADASTRO DE MÉDICOS
import { SettingsDoctors } from "@/components/settings/SettingsDoctors";

export default function Settings() {
  const { transactions } = useApp();
  const { transactions: allTransactions } = transactions;

  const { profile, isAdmin, currentCompany } = useAuth();

  // Use database-backed settings instead of localStorage
  const { settings, extendedSettings, updateSettings, updateExtendedSettings, refetch } = useCompanySettings();

  // Wrapper to update extended settings (supports updater fn or partial object)
  const setExtendedSettings = (updater: ((prev: ExpandedSettings) => ExpandedSettings) | Partial<ExpandedSettings>) => {
    if (typeof updater === "function") {
      const safeExtended = (extendedSettings ?? {}) as ExpandedSettings;
      const newValue = updater(safeExtended);
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
    return (allTransactions ?? []).filter((t) => t.unit === unitId).length;
  };

  // Toggle unit expansion
  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits((prev) => (prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]));
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
          name: def.name,
          active: true,
        });
      } else {
        byId.set(def.id, {
          ...def,
          active: true,
          subunits: def.subunits || [],
        });
      }
    });

    updateSettings({ units: Array.from(byId.values()) });
    toast.success("Unidades padrão restauradas!");
  };

  const handleToggleUnit = (unitId: string) => {
    const unit = settings.units.find((u) => u.id === unitId);
    const updatedUnits = settings.units.map((u) => (u.id === unitId ? { ...u, active: !u.active } : u));
    updateSettings({ units: updatedUnits });
    addAuditLog(
      "UPDATE_SETTINGS",
      `Unidade "${unit?.name}" ${updatedUnits.find((u) => u.id === unitId)?.active ? "ativada" : "desativada"}`,
    );
    toast.success("Configuração salva!");
  };

  const handleAddUnit = () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;

    const exists = settings.units.some((u) => u.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("Unidade já existe!");
      return;
    }

    const newUnitObj = {
      id: trimmed
        .toLowerCase()
        .replace(/\s+/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
      name: trimmed,
      active: true,
      subunits: [] as Subunit[],
    };

    const updatedUnits = [...settings.units, newUnitObj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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

    const exists = settings.units.some((u) => u.id !== editingUnitId && u.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("Já existe uma unidade com esse nome!");
      return;
    }

    const oldUnit = settings.units.find((u) => u.id === editingUnitId);
    const updatedUnits = settings.units
      .map((u) => (u.id === editingUnitId ? { ...u, name: trimmed } : u))
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

    const exists = unit.subunits?.some((s) => s.name.toLowerCase() === subunitName.toLowerCase());
    if (exists) {
      toast.error("Subunidade já existe!");
      return;
    }

    const newSubunitObj: Subunit = {
      id: subunitName
        .toLowerCase()
        .replace(/\s+/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
      name: subunitName,
      active: true,
    };

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            subunits: [...(u.subunits || []), newSubunitObj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
          }
        : u,
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
      u.id === unitId ? { ...u, subunits: u.subunits?.filter((s) => s.id !== subunitId) || [] } : u,
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
            subunits: u.subunits?.map((s) => (s.id === subunitId ? { ...s, active: !s.active } : s)) || [],
          }
        : u,
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
      (s) => s.id !== editingSubunitId && s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.error("Já existe uma subunidade com esse nome!");
      return;
    }

    const updatedUnits = settings.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            subunits:
              u.subunits
                ?.map((s) => (s.id === editingSubunitId ? { ...s, name: trimmed } : s))
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) || [],
          }
        : u,
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

  // ============= SPECIALTY HELPERS (Centro Clínico note only) =============
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

  // ============= CATEGORY HANDLERS =============
  const handleToggleCategory = (catId: string) => {
    const cat = settings.categories.find((c) => c.id === catId);
    const updatedCategories = settings.categories.map((c) => (c.id === catId ? { ...c, active: !c.active } : c));
    updateSettings({ categories: updatedCategories });
    addAuditLog(
      "UPDATE_SETTINGS",
      `Categoria "${cat?.name}" ${updatedCategories.find((c) => c.id === catId)?.active ? "ativada" : "desativada"}`,
    );
    toast.success("Configuração salva!");
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    const exists = settings.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("Categoria já existe!");
      return;
    }

    // Generate uppercase code (what the DB trigger validates against)
    const code = trimmed
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");

    if (!code) {
      toast.error("Nome inválido: use ao menos uma letra ou número.");
      return;
    }

    const codeExists = settings.categories.some(
      (c) => (c.code || c.id)?.toUpperCase() === code,
    );
    if (codeExists) {
      toast.error(`O código interno "${code}" já está em uso. Escolha um nome diferente.`);
      return;
    }

    const newCat = {
      id: trimmed
        .toLowerCase()
        .replace(/\s+/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
      code,
      name: trimmed,
      type: newCategoryType,
      active: true,
      isStrategic: false,
      impactsPredictability: false,
      internalNote: "",
    };

    const updatedCategories = [...settings.categories, newCat].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    updateSettings({ categories: updatedCategories });
    addAuditLog(
      "UPDATE_SETTINGS",
      `Categoria "${trimmed}" (${newCategoryType === "INCOME" ? "Entrada" : "Saída"}) adicionada`,
    );
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
      (c) => c.id !== editingCatId && c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.error("Já existe uma categoria com esse nome!");
      return;
    }

    const oldCat = settings.categories.find((c) => c.id === editingCatId);
    const updatedCategories = settings.categories
      .map((c) =>
        c.id === editingCatId
          ? {
              ...c,
              name: trimmed,
              type: editingCatType,
              isStrategic: editingCatStrategic,
              impactsPredictability: editingCatImpacts,
              internalNote: editingCatNote,
            }
          : c,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    updateSettings({ categories: updatedCategories });
    addAuditLog(
      "UPDATE_SETTINGS",
      `Categoria "${oldCat?.name}" atualizada para "${trimmed}" (${editingCatType === "INCOME" ? "Entrada" : "Saída"})`,
    );
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
  const incomeCategories = settings.categories.filter((c) => c.type === "INCOME");
  const expenseCategories = settings.categories.filter((c) => c.type === "EXPENSE");

  // Render category card
  const renderCategoryCard = (cat: (typeof settings.categories)[0], isExpense: boolean) => {
    const baseStyles = isExpense
      ? cat.active
        ? "border-destructive/20 bg-destructive/5"
        : "border-border bg-muted/30 opacity-60"
      : cat.active
        ? "border-success/20 bg-success/5"
        : "border-border bg-muted/30 opacity-60";

    if (editingCatId === cat.id) {
      return (
        <div key={cat.id} className={`rounded-lg border p-4 ${baseStyles}`}>
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
      <div key={cat.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${baseStyles}`}>
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

          <Switch checked={cat.active} onCheckedChange={() => handleToggleCategory(cat.id)} className="scale-75" />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Configurações</h1>
          <p className="text-sm text-muted-foreground">Personalize unidades, subunidades e categorias do sistema</p>
        </div>

        <Tabs defaultValue="units" className="space-y-6">
          {/* ✅ Ajuste de colunas pra caber todas as abas */}
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 lg:grid-cols-10">
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

            <TabsTrigger value="specialties" className="gap-1 text-xs lg:text-sm">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">Especialidades</span>
            </TabsTrigger>

            {/* ✅ NOVA ABA: MÉDICOS */}
            <TabsTrigger value="doctors" className="gap-1 text-xs lg:text-sm">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">Médicos</span>
            </TabsTrigger>

            <TabsTrigger value="payers" className="gap-1 text-xs lg:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Pagadores</span>
            </TabsTrigger>

            {/* ✅ NOVA ABA: FORMAS DE PAGAMENTO */}
            <TabsTrigger value="payment-methods" className="gap-1 text-xs lg:text-sm">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
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
            {/* (Mantido igual ao seu arquivo original) */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Unidades de Negócio</h3>
              <p className="mb-6 text-sm text-muted-foreground">Gerencie as unidades e seus setores/subunidades</p>

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
                <Button variant="outline" onClick={handleRestoreDefaultUnits} disabled={!isAdmin()}>
                  Restaurar Unidades Padrão
                </Button>
              </div>

              {/* ... resto do conteúdo de unidades permanece igual ... */}
              <div className="space-y-3">
                {settings.units.map((unit) => {
                  const transactionCount = getUnitTransactionCount(unit.id);
                  const isExpanded = expandedUnits.includes(unit.id);
                  const subunitCount = unit.subunits?.length || 0;

                  return (
                    <Collapsible key={unit.id} open={isExpanded} onOpenChange={() => toggleUnitExpansion(unit.id)}>
                      <div className="rounded-lg border border-border overflow-hidden">
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
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleSaveEditUnit}
                                  className="h-8 w-8 text-success"
                                >
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
                                  title={
                                    transactionCount > 0
                                      ? "Não é possível excluir: existem movimentações vinculadas"
                                      : "Excluir unidade"
                                  }
                                >
                                  {transactionCount > 0 ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>

                                <Switch checked={unit.active} onCheckedChange={() => handleToggleUnit(unit.id)} />
                              </>
                            )}
                          </div>
                        </div>

                        <CollapsibleContent>
                          {/* Mantido igual */}
                          <div className="border-t border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">Setores / Subunidades</span>
                            </div>

                            <div className="flex gap-2 mb-3">
                              <Input
                                placeholder="Novo setor..."
                                value={newSubunit[unit.id] || ""}
                                onChange={(e) =>
                                  setNewSubunit((prev) => ({
                                    ...prev,
                                    [unit.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => e.key === "Enter" && handleAddSubunit(unit.id)}
                                className="h-8 text-sm max-w-xs"
                              />
                              <Button size="sm" onClick={() => handleAddSubunit(unit.id)} className="h-8 gap-1">
                                <Plus className="h-3 w-3" />
                                Adicionar
                              </Button>
                            </div>

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
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleSaveEditSubunit(unit.id)}
                                          className="h-6 w-6 text-success"
                                        >
                                          <Check className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={handleCancelEditSubunit}
                                          className="h-6 w-6"
                                        >
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

                            {isCentroClinico(unit) && (
                              <div className="mt-6 pt-4 border-t border-border">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Stethoscope className="h-4 w-4" />
                                  <span className="text-sm">
                                    Especialidades são gerenciadas na aba <strong>Especialidades</strong>
                                  </span>
                                </div>
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
                Total: {settings.units.length} unidades ({settings.units.filter((u) => u.active).length} ativas)
              </p>
            </div>
          </TabsContent>

          {/* ============= CATEGORIES TAB ============= */}
          <TabsContent value="categories" className="space-y-4">
            {/* Mantido igual */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Categorias</h3>
              <p className="mb-6 text-sm text-muted-foreground">Gerencie as categorias de entradas e saídas</p>

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
                Total: {settings.categories.length} categorias ({settings.categories.filter((c) => c.active).length}{" "}
                ativas)
              </p>
            </div>
          </TabsContent>

          {/* ============= PRODUCTION TYPES TAB ============= */}
          <TabsContent value="production-types" className="space-y-4">
            <SettingsProductionTypes
              productionTypes={extendedSettings?.productionTypes ?? []}
              productions={productions ?? []}
              companyId={currentCompany?.id || ""}
              onUpdate={(types) => setExtendedSettings((prev) => ({ ...prev, productionTypes: types }))}
              onSyncComplete={({ productionTypes, categories }) => {
                setExtendedSettings((prev) => ({ ...prev, productionTypes }));
                updateSettings({ categories });
              }}
              onRefetch={async () => { await refetch(); }}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= EXAM TYPES TAB ============= */}
          <TabsContent value="exam-types" className="space-y-4">
            <SettingsExamTypes
              examTypes={extendedSettings?.examTypes ?? []}
              productionTypes={extendedSettings?.productionTypes ?? []}
              productions={productions ?? []}
              onUpdate={(types) => setExtendedSettings((prev) => ({ ...prev, examTypes: types }))}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= SPECIALTIES TAB ============= */}
          <TabsContent value="specialties" className="space-y-4">
            <SettingsSpecialties
              specialties={extendedSettings?.specialties ?? []}
              productions={productions ?? []}
              transactions={allTransactions ?? []}
              onUpdate={(specs) =>
                setExtendedSettings((prev) => ({ ...(prev ?? {}), specialties: specs }) as ExpandedSettings)
              }
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ✅ NOVA TAB: DOCTORS */}
          <TabsContent value="doctors" className="space-y-4">
            <SettingsDoctors />
          </TabsContent>

          {/* ============= PAYERS TAB ============= */}
          <TabsContent value="payers" className="space-y-4">
            <SettingsPayers
              payers={extendedSettings?.payers ?? []}
              productions={productions ?? []}
              receivables={receivables ?? []}
              onUpdate={(payers) => setExtendedSettings((prev) => ({ ...prev, payers }) as ExpandedSettings)}
              onAddLog={addAuditLog}
            />
          </TabsContent>

          {/* ============= PAYMENT METHODS TAB ============= */}
          <TabsContent value="payment-methods" className="space-y-4">
            <SettingsPaymentMethodsParticular
              paymentMethods={extendedSettings?.paymentMethodsParticular ?? []}
              onUpdate={(methods) =>
                setExtendedSettings((prev) => ({ ...(prev ?? {}), paymentMethodsParticular: methods }) as ExpandedSettings)
              }
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
              parameters={
                extendedSettings?.systemParameters ?? {
                  daysForBillingAlert: 15,
                  allowFutureCompetence: false,
                  allowPhysicalDeletion: false,
                  criticalActionConfirmation: "SIMPLE",
                }
              }
              onUpdate={(params) =>
                setExtendedSettings((prev) => ({ ...prev, systemParameters: params }) as ExpandedSettings)
              }
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
