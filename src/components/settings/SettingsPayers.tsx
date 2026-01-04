import { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Info,
  Users,
  Building,
  User,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { PayerConfig, Production, Receivable } from "@/types";
import { generateId } from "@/utils/formatters";

interface SettingsPayersProps {
  payers: PayerConfig[];
  productions: Production[];
  receivables: Receivable[];
  onUpdate: (payers: PayerConfig[]) => void;
  onAddLog: (action: string, details: string) => void;
}

// Default payers (from constants)
const DEFAULT_PAYERS: PayerConfig[] = [
  { id: "IPASGO", name: "Ipasgo", type: "CONVENIO", active: true },
  { id: "UNIMED", name: "Unimed", type: "CONVENIO", active: true },
  { id: "BRADESCO", name: "Bradesco", type: "CONVENIO", active: true },
  { id: "GEAP", name: "GEAP", type: "CONVENIO", active: true },
  { id: "PARTICULAR", name: "Particular", type: "PARTICULAR", active: true },
];

export function SettingsPayers({
  payers,
  productions,
  receivables,
  onUpdate,
  onAddLog,
}: SettingsPayersProps) {
  const allPayers = payers.length > 0 ? payers : DEFAULT_PAYERS;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"CONVENIO" | "PARTICULAR">("CONVENIO");
  const [newNotes, setNewNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<PayerConfig>>({});

  const getUsageCount = (payerId: string) => {
    const productionCount = productions.filter(
      (p) => p.convenio === payerId || (p.payerType === "PARTICULAR" && payerId === "PARTICULAR")
    ).length;
    const receivableCount = receivables.filter((r) => r.source === payerId).length;
    return { productionCount, receivableCount, total: productionCount + receivableCount };
  };

  // Filter payers
  const filteredPayers = useMemo(() => {
    return allPayers
      .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allPayers, searchTerm]);

  const convenios = filteredPayers.filter((p) => p.type === "CONVENIO");
  const particulares = filteredPayers.filter((p) => p.type === "PARTICULAR");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = allPayers.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Convênio/Pagador já existe!");
      return;
    }

    const newObj: PayerConfig = {
      id: generateId(),
      name: trimmed,
      type: newType,
      active: true,
      notes: newNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onUpdate([...allPayers, newObj]);
    onAddLog("UPDATE_SETTINGS", `${newType === "CONVENIO" ? "Convênio" : "Pagador"} "${trimmed}" adicionado`);
    setNewName("");
    setNewNotes("");
    toast.success("Convênio/Pagador adicionado!");
  };

  const handleToggle = (id: string) => {
    const payer = allPayers.find((p) => p.id === id);
    const { total } = getUsageCount(id);
    
    if (payer?.active && total > 0) {
      if (!confirm(`Este pagador possui ${total} registro(s) vinculado(s). Deseja desativar mesmo assim?`)) {
        return;
      }
    }

    const updated = allPayers.map((p) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Pagador "${payer?.name}" ${payer?.active ? "desativado" : "ativado"}`);
    toast.success("Configuração salva!");
  };

  const handleStartEdit = (payer: PayerConfig) => {
    setEditingId(payer.id);
    setEditingData({
      name: payer.name,
      type: payer.type,
      notes: payer.notes || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingData.name?.trim()) {
      toast.error("Nome não pode estar vazio!");
      return;
    }

    const updated = allPayers.map((p) =>
      p.id === editingId
        ? {
            ...p,
            name: editingData.name!.trim(),
            type: editingData.type || "CONVENIO",
            notes: editingData.notes?.trim() || undefined,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", `Pagador "${editingData.name}" atualizado`);
    setEditingId(null);
    setEditingData({});
    toast.success("Pagador atualizado!");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  // Count active vs inactive
  const activeCount = allPayers.filter((p) => p.active).length;
  const inactiveCount = allPayers.length - activeCount;

  const renderPayerCard = (payer: PayerConfig) => {
    const { productionCount, receivableCount, total } = getUsageCount(payer.id);
    const isEditing = editingId === payer.id;
    const isInUse = total > 0;

    if (isEditing) {
      return (
        <div
          key={payer.id}
          className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
        >
          <div className="flex gap-2">
            <Input
              value={editingData.name || ""}
              onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
              placeholder="Nome"
              className="flex-1"
            />
            <Select
              value={editingData.type || "CONVENIO"}
              onValueChange={(v) => setEditingData({ ...editingData, type: v as PayerConfig["type"] })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONVENIO">Convênio</SelectItem>
                <SelectItem value="PARTICULAR">Particular</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={editingData.notes || ""}
            onChange={(e) => setEditingData({ ...editingData, notes: e.target.value })}
            placeholder="Observações (opcional)"
            className="h-16 text-sm"
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
        key={payer.id}
        className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
          payer.active
            ? "border-border bg-card hover:bg-accent/50"
            : "border-border/50 bg-muted/30 opacity-70"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{payer.name}</span>
            {/* Status badges */}
            {payer.active ? (
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
                    Em uso ({total})
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Este pagador possui registros vinculados:</p>
                  <ul className="text-xs mt-1">
                    {productionCount > 0 && <li>• {productionCount} produção(ões)</li>}
                    {receivableCount > 0 && <li>• {receivableCount} faturamento(s)</li>}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-1">Não pode ser excluído, apenas inativado.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {payer.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{payer.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleStartEdit(payer)}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar pagador</TooltipContent>
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
            checked={payer.active}
            onCheckedChange={() => handleToggle(payer.id)}
          />
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Convênios / Pagadores
            </CardTitle>
            <CardDescription>
              {allPayers.length} pagadores ({activeCount} ativos, {inactiveCount} inativos)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Pagadores inativos não aparecem para novos lançamentos
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar convênio/pagador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add form */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed border-border">
            <Label className="text-sm font-medium">Adicionar novo pagador</Label>
            <div className="flex gap-3">
              <Input
                placeholder="Nome do convênio/pagador..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONVENIO">Convênio</SelectItem>
                  <SelectItem value="PARTICULAR">Particular</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
            <Textarea
              placeholder="Observações (opcional)..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="h-16 text-sm"
            />
          </div>

          {/* Convênios */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Convênios</h4>
              <Badge variant="secondary" className="text-xs">{convenios.length}</Badge>
            </div>
            <div className="space-y-2">
              {convenios.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  {searchTerm ? "Nenhum convênio encontrado" : "Nenhum convênio cadastrado"}
                </p>
              ) : (
                convenios.map((payer) => renderPayerCard(payer))
              )}
            </div>
          </div>

          {/* Particulares */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Particular</h4>
              <Badge variant="secondary" className="text-xs">{particulares.length}</Badge>
            </div>
            <div className="space-y-2">
              {particulares.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  {searchTerm ? "Nenhum tipo particular encontrado" : "Nenhum tipo particular cadastrado"}
                </p>
              ) : (
                particulares.map((payer) => renderPayerCard(payer))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
