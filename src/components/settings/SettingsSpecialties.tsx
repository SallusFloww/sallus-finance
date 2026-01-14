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
import { generateId } from "@/utils/formatters";

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

export function SettingsSpecialties({
  specialties,
  productions,
  transactions,
  onUpdate,
  onAddLog,
}: SettingsSpecialtiesProps) {
  const [initialized, setInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // CORREÇÃO: Usar lista do banco OU defaults se vazia
  const types = useMemo(() => {
    if (specialties.length === 0) {
      return DEFAULT_SPECIALTIES;
    }
    return specialties;
  }, [specialties]);

  // Persistir defaults se a lista do banco estiver vazia
  useEffect(() => {
    if (!initialized && specialties.length === 0) {
      onUpdate(DEFAULT_SPECIALTIES);
      setInitialized(true);
    }
  }, [initialized, specialties.length, onUpdate]);

  // Contagem de uso em produções e transações
  const getUsageCount = (specialtyId: string) => {
    const prodCount = productions.filter((p) => p.specialty === specialtyId).length;
    const txnCount = transactions.filter((t) => t.specialty === specialtyId).length;
    return prodCount + txnCount;
  };

  // Filtrar e ordenar
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
      toast.error("Especialidade já existe!");
      return;
    }

    const newObj: SpecialtyConfig = {
      id: generateId(),
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
    const usageCount = getUsageCount(id);

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

  // Contagem de ativos vs inativos
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
