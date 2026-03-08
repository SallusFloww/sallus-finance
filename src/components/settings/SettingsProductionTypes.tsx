import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Check, X, AlertTriangle, Info, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ProductionTypeConfig, Production, Category } from "@/types";
import { generateId } from "@/utils/formatters";
import { supabase } from "@/integrations/supabase/client";

interface SettingsProductionTypesProps {
  productionTypes: ProductionTypeConfig[];
  productions: Production[];
  companyId: string;
  onUpdate: (types: ProductionTypeConfig[]) => void;
  onSyncComplete: (data: { productionTypes: ProductionTypeConfig[]; categories: Category[] }) => void;
  onRefetch?: () => Promise<void>;
  onAddLog: (action: string, details: string) => void;
}

const DEFAULT_PRODUCTION_TYPES: ProductionTypeConfig[] = [
  { id: "CONSULTA", name: "Consulta", active: true, allowBatchEntry: true, requiresDetail: false, valueModel: "TOTAL" },
  { id: "EXAME", name: "Exame", active: true, allowBatchEntry: true, requiresDetail: true, valueModel: "TOTAL" },
  {
    id: "QUIMIOTERAPIA",
    name: "Quimioterapia",
    active: true,
    allowBatchEntry: true,
    requiresDetail: false,
    valueModel: "TOTAL",
  },
  {
    id: "BOX_PS",
    name: "Box / Atendimento PS",
    active: true,
    allowBatchEntry: true,
    requiresDetail: false,
    valueModel: "TOTAL",
  },
  {
    id: "SESSAO_TERAPEUTICA",
    name: "Sessão Terapêutica",
    active: true,
    allowBatchEntry: true,
    requiresDetail: false,
    valueModel: "TOTAL",
  },
  {
    id: "INTERNACAO",
    name: "Internação",
    active: true,
    allowBatchEntry: false,
    requiresDetail: false,
    valueModel: "TOTAL",
  },
  { id: "MAT_MED", name: "Mat/Med", active: true, allowBatchEntry: true, requiresDetail: false, valueModel: "TOTAL" },
  { id: "OUTRO", name: "Outro", active: true, allowBatchEntry: true, requiresDetail: false, valueModel: "TOTAL" },
];

export function SettingsProductionTypes({
  productionTypes,
  productions,
  companyId,
  onUpdate,
  onSyncComplete,
  onRefetch,
  onAddLog,
}: SettingsProductionTypesProps) {
  // CORREÇÃO: Se não há tipos salvos no banco, usar defaults e PERSISTIR
  // Isso garante que os defaults sejam salvos no banco imediatamente
  const [initialized, setInitialized] = useState(false);

  // Combinar tipos do banco com defaults que ainda não existem
  const types = useMemo(() => {
    if (productionTypes.length === 0) {
      return DEFAULT_PRODUCTION_TYPES;
    }
    // Mesclar: manter os do banco e adicionar defaults que não existem
    const byId = new Map(productionTypes.map((t) => [t.id, t]));
    DEFAULT_PRODUCTION_TYPES.forEach((def) => {
      if (!byId.has(def.id)) {
        byId.set(def.id, def);
      }
    });
    return Array.from(byId.values());
  }, [productionTypes]);

  // Persistir defaults se a lista do banco estiver vazia
  useEffect(() => {
    if (!initialized && productionTypes.length === 0) {
      // Salvar defaults no banco para garantir persistência
      onUpdate(DEFAULT_PRODUCTION_TYPES);
      setInitialized(true);
    }
  }, [initialized, productionTypes.length, onUpdate]);

  const [searchTerm, setSearchTerm] = useState("");
  const [newType, setNewType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<ProductionTypeConfig>>({});

  const getUsageCount = (typeId: string) => {
    return productions.filter((p) => p.productionType === typeId).length;
  };

  // Filter and sort types
  const filteredTypes = useMemo(() => {
    return types
      .filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [types, searchTerm]);

  const [addingType, setAddingType] = useState(false);

  const handleAddType = async () => {
    const trimmed = newType.trim();
    if (!trimmed) return;

    const exists = types.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("Tipo de produção já existe!");
      return;
    }

    setAddingType(true);
    try {
      if (import.meta.env.DEV) console.log('[ADD_PROD_TYPE] calling RPC', { companyId, name: trimmed, description: newDescription.trim() });

      const { data, error } = await (supabase.rpc as any)('upsert_production_type_with_category', {
        _company_id: companyId,
        _name: trimmed,
        _description: newDescription.trim(),
        _desired_entry_type: 'entrada',
      });

      if (import.meta.env.DEV) console.log('[ADD_PROD_TYPE] rpc result', { data, error });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || 'Erro ao criar tipo');
        return;
      }

      // RPC updated DB atomically. Refetch settings to get fresh data.
      if (onRefetch) {
        await onRefetch();
      } else {
        // Fallback: use onSyncComplete if onRefetch not available
        onSyncComplete({
          productionTypes: result.production_types ?? [],
          categories: result.categories ?? [],
        });
      }

      onAddLog("UPDATE_SETTINGS", `Tipo "${trimmed}" adicionado com categoria ENTRADA vinculada`);
      setNewType("");
      setNewDescription("");
      toast.success("Tipo criado e categoria vinculada como ENTRADA");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[ADD_PROD_TYPE] Exception:", err);
      // Fallback: criar localmente sem categoria (compatibilidade)
      const newTypeObj: ProductionTypeConfig = {
        id: generateId(),
        name: trimmed,
        description: newDescription.trim() || undefined,
        active: true,
        allowBatchEntry: true,
        requiresDetail: false,
        valueModel: "TOTAL",
        createdAt: new Date().toISOString(),
      };
      onUpdate([...types, newTypeObj]);
      onAddLog("UPDATE_SETTINGS", `Tipo de produção "${trimmed}" adicionado (fallback local)`);
      setNewType("");
      setNewDescription("");
      toast.warning("Tipo criado localmente. Categoria pode precisar ser criada manualmente.");
    } finally {
      setAddingType(false);
    }
  };

  const handleToggle = (id: string) => {
    const type = types.find((t) => t.id === id);
    const usageCount = getUsageCount(id);

    if (type?.active && usageCount > 0) {
      if (!confirm(`Este tipo possui ${usageCount} produção(ões) vinculada(s). Deseja desativar mesmo assim?`)) {
        return;
      }
    }

    const updated = types.map((t) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t,
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Tipo de produção "${type?.name}" ${type?.active ? "desativado" : "ativado"}`);
    toast.success("Configuração salva!");
  };

  const handleStartEdit = (type: ProductionTypeConfig) => {
    setEditingId(type.id);
    setEditingData({
      name: type.name,
      description: type.description || "",
      allowBatchEntry: type.allowBatchEntry,
      requiresDetail: type.requiresDetail,
      valueModel: type.valueModel,
    });
  };

  const handleSaveEdit = () => {
    if (!editingData.name?.trim()) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const updated = types.map((t) =>
      t.id === editingId
        ? {
            ...t,
            name: editingData.name!.trim(),
            description: editingData.description?.trim() || undefined,
            allowBatchEntry: editingData.allowBatchEntry ?? true,
            requiresDetail: editingData.requiresDetail ?? false,
            valueModel: editingData.valueModel || "TOTAL",
            updatedAt: new Date().toISOString(),
          }
        : t,
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Tipo de produção "${editingData.name}" atualizado`);
    setEditingId(null);
    setEditingData({});
    toast.success("Tipo atualizado!");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  // Count active vs inactive
  const activeCount = types.filter((t) => t.active).length;
  const inactiveCount = types.length - activeCount;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tipos de Produção
            </CardTitle>
            <CardDescription>
              {types.length} tipos ({activeCount} ativos, {inactiveCount} inativos)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Alterações aqui NÃO afetam produções já registradas
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tipo de produção..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add form */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed border-border">
            <Label className="text-sm font-medium">Adicionar novo tipo</Label>
            <div className="flex gap-3">
              <Input
                placeholder="Nome do tipo..."
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddType} size="sm" disabled={addingType}>
                <Plus className="h-4 w-4 mr-2" />
                {addingType ? "Criando..." : "Adicionar"}
              </Button>
            </div>
            <Textarea
              placeholder="Descrição (opcional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="h-16 text-sm"
            />
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm ? "Nenhum tipo encontrado" : "Nenhum tipo cadastrado"}
              </p>
            ) : (
              filteredTypes.map((type) => {
                const usageCount = getUsageCount(type.id);
                const isEditing = editingId === type.id;
                const isInUse = usageCount > 0;

                if (isEditing) {
                  return (
                    <div key={type.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex gap-2">
                        <Input
                          value={editingData.name || ""}
                          onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                          placeholder="Nome"
                          className="flex-1"
                        />
                      </div>
                      <Textarea
                        value={editingData.description || ""}
                        onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                        placeholder="Descrição (opcional)"
                        className="h-16 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`batch-${type.id}`}
                            checked={editingData.allowBatchEntry ?? true}
                            onCheckedChange={(c) => setEditingData({ ...editingData, allowBatchEntry: c === true })}
                          />
                          <Label htmlFor={`batch-${type.id}`} className="text-xs">
                            Permite lançamento em lote
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`detail-${type.id}`}
                            checked={editingData.requiresDetail ?? false}
                            onCheckedChange={(c) => setEditingData({ ...editingData, requiresDetail: c === true })}
                          />
                          <Label htmlFor={`detail-${type.id}`} className="text-xs">
                            Exige detalhamento (exame)
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Modelo de valor:</Label>
                        <Select
                          value={editingData.valueModel || "TOTAL"}
                          onValueChange={(v) =>
                            setEditingData({ ...editingData, valueModel: v as "TOTAL" | "QUANTITY_AVERAGE" })
                          }
                        >
                          <SelectTrigger className="w-48 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TOTAL">Valor total informado</SelectItem>
                            <SelectItem value="QUANTITY_AVERAGE">Quantidade + valor médio</SelectItem>
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
                        {/* Status badges */}
                        {type.active ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs"
                          >
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
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"
                              >
                                Em uso ({usageCount})
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Este tipo possui {usageCount} produção(ões) vinculada(s).</p>
                              <p className="text-xs text-muted-foreground">Não pode ser excluído, apenas inativado.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {type.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{type.description}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {type.allowBatchEntry && <span>• Lote</span>}
                        {type.requiresDetail && <span>• Exige exame</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleStartEdit(type)} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar tipo</TooltipContent>
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
                      <Switch checked={type.active} onCheckedChange={() => handleToggle(type.id)} />
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
