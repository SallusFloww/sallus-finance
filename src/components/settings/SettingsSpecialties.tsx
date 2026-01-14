import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Info,
  Stethoscope,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { SpecialtyConfig, Production, Transaction } from "@/types";

interface SettingsSpecialtiesProps {
  specialties: SpecialtyConfig[];
  productions: Production[];
  transactions: Transaction[];
  onUpdate: (types: SpecialtyConfig[]) => void;
  onAddLog: (action: string, details: string) => void;
}

// Especialidades padrão para inicialização
const DEFAULT_SPECIALTIES: SpecialtyConfig[] = [
  { id: "CARDIOLOGIA", name: "Cardiologia", active: true },
  { id: "HIPERBARICA", name: "Hiperbárica", active: true },
  { id: "OFTALMOLOGIA", name: "Oftalmologia", active: true },
  { id: "NEUROLOGIA", name: "Neurologia", active: true },
  { id: "NUTRICIONISTA", name: "Nutricionista", active: true },
  { id: "DERMATOLOGIA", name: "Dermatologia", active: true },
];

// Helper para normalizar chaves (compatibilidade com dados antigos)
function normalizeKey(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

// Helper para gerar ID estável baseado no nome
function generateStableId(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function SettingsSpecialties({
  specialties,
  productions,
  transactions,
  onUpdate,
  onAddLog,
}: SettingsSpecialtiesProps) {
  // BLINDAGEM: garantir arrays válidos
  const safeProductions = productions ?? [];
  const safeTransactions = transactions ?? [];
  const safeSpecialties = specialties ?? [];

  const [initialized, setInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Helper para formatar nome legível a partir do ID
  const formatDisplayName = (raw: string): string => {
    // Se já está em formato legível (tem minúsculas), retornar
    if (raw !== raw.toUpperCase()) {
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    // Converter CARDIOLOGIA -> Cardiologia
    return raw
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // CORREÇÃO DEFINITIVA: Merge de banco + defaults + histórico
  const types = useMemo(() => {
    const byId = new Map<string, SpecialtyConfig>();

    // 1) Adicionar especialidades do banco
    safeSpecialties.forEach((s) => byId.set(s.id, s));

    // 2) Adicionar defaults que não existem
    DEFAULT_SPECIALTIES.forEach((def) => {
      if (!byId.has(def.id)) {
        byId.set(def.id, def);
      }
    });

    // 3) Inferir especialidades do histórico (productions e transactions)
    const inferFromHistory = () => {
      const inferred = new Map<string, SpecialtyConfig>();

      // Produções com specialty
      safeProductions.forEach((p) => {
        if (p.specialty) {
          const id = generateStableId(p.specialty);
          if (!byId.has(id) && !inferred.has(id)) {
            inferred.set(id, {
              id,
              name: formatDisplayName(p.specialty),
              active: true,
            });
          }
        }
      });

      // Transações com specialty
      safeTransactions.forEach((t) => {
        if (t.specialty) {
          const id = generateStableId(t.specialty);
          if (!byId.has(id) && !inferred.has(id)) {
            inferred.set(id, {
              id,
              name: formatDisplayName(t.specialty),
              active: true,
            });
          }
        }
      });

      return inferred;
    };

    const inferred = inferFromHistory();
    inferred.forEach((spec, id) => {
      if (!byId.has(id)) {
        byId.set(id, spec);
      }
    });

    return Array.from(byId.values());
  }, [safeSpecialties, safeProductions, safeTransactions]);

  // Persistir se banco vazio OU se inferimos novos do histórico
  useEffect(() => {
    if (initialized) return;

    // Construir o merge completo para persistência
    const byId = new Map<string, SpecialtyConfig>();

    // Do banco
    safeSpecialties.forEach((s) => byId.set(s.id, s));

    // Defaults
    DEFAULT_SPECIALTIES.forEach((def) => {
      if (!byId.has(def.id)) {
        byId.set(def.id, def);
      }
    });

    // Do histórico
    safeProductions.forEach((p) => {
      if (p.specialty) {
        const id = generateStableId(p.specialty);
        if (!byId.has(id)) {
          byId.set(id, {
            id,
            name: formatDisplayName(p.specialty),
            active: true,
          });
        }
      }
    });
    safeTransactions.forEach((t) => {
      if (t.specialty) {
        const id = generateStableId(t.specialty);
        if (!byId.has(id)) {
          byId.set(id, {
            id,
            name: formatDisplayName(t.specialty),
            active: true,
          });
        }
      }
    });

    const merged = Array.from(byId.values());

    // Persistir se banco estava vazio OU se inferimos novos
    if (safeSpecialties.length === 0 || merged.length > safeSpecialties.length) {
      onUpdate(merged);
    }

    setInitialized(true);
  }, [initialized, safeSpecialties, safeProductions, safeTransactions, onUpdate]);

  // CORREÇÃO PASSO 5: Contagem de uso com compatibilidade de dados antigos
  const getUsageCount = (type: SpecialtyConfig) => {
    const specialtyId = type.id;
    const specialtyName = type.name;
    const normalizedId = normalizeKey(specialtyId);
    const normalizedName = normalizeKey(specialtyName);

    const prodCount = safeProductions.filter((p) => {
      if (!p.specialty) return false;
      if (p.specialty === specialtyId) return true;
      const normProd = normalizeKey(p.specialty);
      return normProd === normalizedId || normProd === normalizedName;
    }).length;

    const txnCount = safeTransactions.filter((t) => {
      if (!t.specialty) return false;
      if (t.specialty === specialtyId) return true;
      const normTxn = normalizeKey(t.specialty);
      return normTxn === normalizedId || normTxn === normalizedName;
    }).length;

    return prodCount + txnCount;
  };

  // Filtrar e ordenar
  const filteredTypes = useMemo(() => {
    return types
      .filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [types, searchTerm]);

  // CORREÇÃO PASSO 4: ID estável baseado no nome
  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const newId = generateStableId(trimmed);

    // Check duplicates by ID or name
    const exists = types.some(
      (t) => t.id === newId || t.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Especialidade já existe!");
      return;
    }

    const newObj: SpecialtyConfig = {
      id: newId,
      name: trimmed,
      active: true,
    };

    onUpdate([...types, newObj]);
    onAddLog("UPDATE_SETTINGS", `Especialidade "${trimmed}" adicionada`);
    setNewName("");
    toast.success("Especialidade adicionada!");
  };

  const handleToggle = (id: string) => {
    const type = types.find((t) => t.id === id);
    const usageCount = getUsageCount(type!);

    if (type?.active && usageCount > 0) {
      if (
        !confirm(
          `Esta especialidade possui ${usageCount} registro(s) vinculado(s). Deseja desativar mesmo assim?`
        )
      ) {
        return;
      }
    }

    const updated = types.map((t) =>
      t.id === id ? { ...t, active: !t.active } : t
    );
    onUpdate(updated);
    onAddLog(
      "UPDATE_SETTINGS",
      `Especialidade "${type?.name}" ${type?.active ? "desativada" : "ativada"}`
    );
    toast.success("Configuração salva!");
  };

  const handleStartEdit = (type: SpecialtyConfig) => {
    setEditingId(type.id);
    setEditingName(type.name);
  };

  const handleSaveEdit = () => {
    if (!editingName.trim()) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const updated = types.map((t) =>
      t.id === editingId ? { ...t, name: editingName.trim() } : t
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Especialidade "${editingName}" atualizada`);
    setEditingId(null);
    setEditingName("");
    toast.success("Especialidade atualizada!");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Contagem de ativos vs inativos - USA types (merged) não specialties (raw)
  const activeCount = types.filter((t) => t.active).length;
  const inactiveCount = types.length - activeCount;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Especialidades
            </CardTitle>
            <CardDescription>
              {types.length} especialidades ({activeCount} ativas, {inactiveCount} inativas)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Especialidades usadas no Centro Clínico para Produção e Lançamentos
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add form */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed border-border">
            <Label className="text-sm font-medium">Adicionar nova especialidade</Label>
            <div className="flex gap-3">
              <Input
                placeholder="Nome da especialidade..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1"
              />
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm ? "Nenhuma especialidade encontrada" : "Nenhuma especialidade cadastrada"}
              </p>
            ) : (
              filteredTypes.map((type) => {
                const usageCount = getUsageCount(type);
                const isEditing = editingId === type.id;
                const isInUse = usageCount > 0;

                if (isEditing) {
                  return (
                    <div
                      key={type.id}
                      className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
                    >
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder="Nome"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                      />
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
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                            Inativa
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
                              <p>Esta especialidade possui {usageCount} registro(s) vinculado(s).</p>
                              <p className="text-xs text-muted-foreground">
                                Não pode ser excluída, apenas inativada.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
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
                        <TooltipContent>Editar especialidade</TooltipContent>
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
