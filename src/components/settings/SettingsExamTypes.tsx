import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Info,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExamTypeConfig, Production, ProductionTypeConfig } from "@/types";
import { generateId } from "@/utils/formatters";

interface SettingsExamTypesProps {
  examTypes: ExamTypeConfig[];
  productionTypes: ProductionTypeConfig[];
  productions: Production[];
  onUpdate: (types: ExamTypeConfig[]) => void;
  onAddLog: (action: string, details: string) => void;
}

const EXAM_CATEGORIES = [
  { id: "IMAGEM", name: "Imagem" },
  { id: "LABORATORIO", name: "Laboratório" },
  { id: "TERAPIA", name: "Terapia" },
  { id: "OUTRO", name: "Outro" },
];

// Exames default para inicialização
const DEFAULT_EXAM_TYPES: ExamTypeConfig[] = [
  { id: "ressonancia", name: "Ressonância Magnética", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "tomografia", name: "Tomografia Computadorizada", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "raio-x", name: "Raio-X", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "ultrassonografia", name: "Ultrassonografia", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "ecocardiograma", name: "Ecocardiograma", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "endoscopia", name: "Endoscopia", linkedProductionType: "EXAME", category: "LABORATORIO", active: true },
  { id: "colonoscopia", name: "Colonoscopia", linkedProductionType: "EXAME", category: "LABORATORIO", active: true },
  { id: "eletrocardiograma", name: "Eletrocardiograma", linkedProductionType: "EXAME", category: "OUTRO", active: true },
  { id: "mamografia", name: "Mamografia", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
  { id: "densitometria", name: "Densitometria Óssea", linkedProductionType: "EXAME", category: "IMAGEM", active: true },
];

export function SettingsExamTypes({
  examTypes,
  productionTypes,
  productions,
  onUpdate,
  onAddLog,
}: SettingsExamTypesProps) {
  const [initialized, setInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newLinkedType, setNewLinkedType] = useState("EXAME");
  const [newCategory, setNewCategory] = useState<"IMAGEM" | "LABORATORIO" | "TERAPIA" | "OUTRO">("OUTRO");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<ExamTypeConfig>>({});

  // CORREÇÃO: Usar lista do banco OU defaults se vazia
  const types = useMemo(() => {
    if (examTypes.length === 0) {
      return DEFAULT_EXAM_TYPES;
    }
    return examTypes;
  }, [examTypes]);

  // Persistir defaults se a lista do banco estiver vazia
  useEffect(() => {
    if (!initialized && examTypes.length === 0) {
      onUpdate(DEFAULT_EXAM_TYPES);
      setInitialized(true);
    }
  }, [initialized, examTypes.length, onUpdate]);

  const getUsageCount = (examId: string) => {
    return productions.filter((p) => p.examType === examId).length;
  };

  // Filter production types that require detail
  const detailableTypes = productionTypes.filter((t) => t.requiresDetail && t.active);

  // Filter and sort exam types
  const filteredTypes = useMemo(() => {
    return types
      .filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [types, searchTerm]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = types.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Tipo de exame/procedimento já existe!");
      return;
    }

    const newObj: ExamTypeConfig = {
      id: generateId(),
      name: trimmed,
      linkedProductionType: newLinkedType,
      category: newCategory,
      active: true,
      createdAt: new Date().toISOString(),
    };

    // CORREÇÃO: Usar types (lista combinada) ao invés de examTypes
    onUpdate([...types, newObj]);
    onAddLog("UPDATE_SETTINGS", `Tipo de exame "${trimmed}" adicionado`);
    setNewName("");
    toast.success("Tipo de exame/procedimento adicionado!");
  };

  const handleToggle = (id: string) => {
    const type = types.find((t) => t.id === id);
    const usageCount = getUsageCount(id);
    
    if (type?.active && usageCount > 0) {
      if (!confirm(`Este tipo possui ${usageCount} produção(ões) vinculada(s). Deseja desativar mesmo assim?`)) {
        return;
      }
    }

    // CORREÇÃO: Usar types ao invés de examTypes
    const updated = types.map((t) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Tipo de exame "${type?.name}" ${type?.active ? "desativado" : "ativado"}`);
    toast.success("Configuração salva!");
  };

  const handleStartEdit = (type: ExamTypeConfig) => {
    setEditingId(type.id);
    setEditingData({
      name: type.name,
      linkedProductionType: type.linkedProductionType,
      category: type.category,
    });
  };

  const handleSaveEdit = () => {
    if (!editingData.name?.trim()) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    // CORREÇÃO: Usar types ao invés de examTypes
    const updated = types.map((t) =>
      t.id === editingId
        ? {
            ...t,
            name: editingData.name!.trim(),
            linkedProductionType: editingData.linkedProductionType || "EXAME",
            category: editingData.category || "OUTRO",
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Tipo de exame "${editingData.name}" atualizado`);
    setEditingId(null);
    setEditingData({});
    toast.success("Tipo atualizado!");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const getCategoryLabel = (cat: string) => {
    return EXAM_CATEGORIES.find((c) => c.id === cat)?.name || cat;
  };

  const getProductionTypeLabel = (id: string) => {
    return productionTypes.find((t) => t.id === id)?.name || id;
  };

  // Count active vs inactive
  const activeCount = examTypes.filter((t) => t.active).length;
  const inactiveCount = examTypes.length - activeCount;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tipos de Exame / Procedimento
            </CardTitle>
            <CardDescription>
              {examTypes.length} tipos ({activeCount} ativos, {inactiveCount} inativos)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Cadastro dinâmico usado no formulário de Produção
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar exame/procedimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add form */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed border-border">
            <Label className="text-sm font-medium">Adicionar novo exame/procedimento</Label>
            <div className="flex gap-3">
              <Input
                placeholder="Nome do exame/procedimento..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
            <div className="flex gap-3">
              <Select value={newLinkedType} onValueChange={setNewLinkedType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Tipo vinculado" />
                </SelectTrigger>
                <SelectContent>
                  {detailableTypes.length > 0 ? (
                    detailableTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="EXAME">Exame</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as typeof newCategory)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm ? "Nenhum exame encontrado" : "Nenhum exame cadastrado ainda"}
              </p>
            ) : (
              filteredTypes.map((type) => {
                const usageCount = getUsageCount(type.id);
                const isEditing = editingId === type.id;
                const isInUse = usageCount > 0;

                if (isEditing) {
                  return (
                    <div
                      key={type.id}
                      className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
                    >
                      <Input
                        value={editingData.name || ""}
                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                        placeholder="Nome"
                      />
                      <div className="flex gap-3">
                        <Select
                          value={editingData.linkedProductionType || "EXAME"}
                          onValueChange={(v) => setEditingData({ ...editingData, linkedProductionType: v })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {detailableTypes.length > 0 ? (
                              detailableTypes.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="EXAME">Exame</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={editingData.category || "OUTRO"}
                          onValueChange={(v) => setEditingData({ ...editingData, category: v as ExamTypeConfig["category"] })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXAM_CATEGORIES.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-3 w-3 mr-1" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={type.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      type.active
                        ? "border-border bg-card hover:bg-accent/50"
                        : "border-border/50 bg-muted/30 opacity-70"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{type.name}</span>
                        {/* Category badge */}
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(type.category)}
                        </Badge>
                        {/* Status badges */}
                        {type.active ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                            Inativo
                          </Badge>
                        )}
                        {isInUse && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                Em uso ({usageCount})
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Este exame possui {usageCount} produção(ões) vinculada(s).</p>
                              <p className="text-xs text-muted-foreground">Não pode ser excluído, apenas inativado.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vinculado a: {getProductionTypeLabel(type.linkedProductionType)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(type)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar exame</TooltipContent>
                      </Tooltip>
                      {isInUse && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Possui histórico vinculado.</p>
                            <p className="text-xs">Apenas inativação permitida.</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Switch
                        checked={type.active}
                        onCheckedChange={() => handleToggle(type.id)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
