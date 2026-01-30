import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PaymentMethodParticularConfig } from "@/types";
import { DEFAULT_PAYMENT_METHODS_PARTICULAR } from "@/utils/constants";

interface SettingsPaymentMethodsParticularProps {
  paymentMethods: PaymentMethodParticularConfig[];
  onUpdate: (methods: PaymentMethodParticularConfig[]) => void;
  onAddLog?: (action: string, details: string, meta?: unknown) => void;
}

// Helper para gerar ID slug único
function generateSlugId(name: string, existingIds: string[]): string {
  const baseSlug = name
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
  
  if (!existingIds.includes(baseSlug)) {
    return baseSlug;
  }
  
  // Append _2, _3, etc if exists
  let counter = 2;
  while (existingIds.includes(`${baseSlug}_${counter}`)) {
    counter++;
  }
  return `${baseSlug}_${counter}`;
}

export function SettingsPaymentMethodsParticular({
  paymentMethods,
  onUpdate,
  onAddLog,
}: SettingsPaymentMethodsParticularProps) {
  const [newMethodName, setNewMethodName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Garantir que temos ao menos os defaults
  const methods = paymentMethods?.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS_PARTICULAR;

  const handleAdd = () => {
    const trimmed = newMethodName.trim();
    if (!trimmed) {
      toast.error("Digite o nome da forma de pagamento");
      return;
    }

    const nameLower = trimmed.toLowerCase();
    const exists = methods.some((m) => m.name.toLowerCase() === nameLower);
    if (exists) {
      toast.error("Já existe uma forma de pagamento com esse nome");
      return;
    }

    const newId = generateSlugId(trimmed, methods.map((m) => m.id));
    const newMethod: PaymentMethodParticularConfig = {
      id: newId,
      name: trimmed,
      active: true,
    };

    onUpdate([...methods, newMethod]);
    onAddLog?.("UPDATE_SETTINGS", `Forma de pagamento "${trimmed}" adicionada`);
    setNewMethodName("");
    toast.success("Forma de pagamento adicionada!");
  };

  const handleToggle = (id: string) => {
    const method = methods.find((m) => m.id === id);
    if (!method) return;

    const updated = methods.map((m) =>
      m.id === id ? { ...m, active: !m.active } : m
    );
    
    onUpdate(updated);
    onAddLog?.(
      "UPDATE_SETTINGS",
      `Forma de pagamento "${method.name}" ${method.active ? "desativada" : "ativada"}`
    );
    toast.success(`"${method.name}" ${method.active ? "desativada" : "ativada"}!`);
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("Nome não pode estar vazio");
      return;
    }

    const nameLower = trimmed.toLowerCase();
    const exists = methods.some(
      (m) => m.id !== editingId && m.name.toLowerCase() === nameLower
    );
    if (exists) {
      toast.error("Já existe uma forma de pagamento com esse nome");
      return;
    }

    const oldMethod = methods.find((m) => m.id === editingId);
    const updated = methods.map((m) =>
      m.id === editingId ? { ...m, name: trimmed } : m
    );

    onUpdate(updated);
    onAddLog?.("UPDATE_SETTINGS", `Forma de pagamento "${oldMethod?.name}" renomeada para "${trimmed}"`);
    setEditingId(null);
    setEditingName("");
    toast.success("Forma de pagamento atualizada!");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleRemove = (id: string) => {
    const method = methods.find((m) => m.id === id);
    if (!method) return;

    // Verificar se é uma forma padrão do sistema
    const isDefault = DEFAULT_PAYMENT_METHODS_PARTICULAR.some((d) => d.id === id);
    if (isDefault) {
      toast.error("Formas de pagamento padrão não podem ser excluídas. Desative-a se necessário.");
      return;
    }

    const updated = methods.filter((m) => m.id !== id);
    onUpdate(updated);
    onAddLog?.("UPDATE_SETTINGS", `Forma de pagamento "${method.name}" removida`);
    toast.success("Forma de pagamento removida!");
  };

  const handleRestoreDefaults = () => {
    // Merge: manter as customizadas, adicionar/reativar padrões ausentes
    const existingIds = methods.map((m) => m.id);
    const customMethods = methods.filter(
      (m) => !DEFAULT_PAYMENT_METHODS_PARTICULAR.some((d) => d.id === m.id)
    );

    // Defaults (reativa se já existe, adiciona se não existe)
    const defaults = DEFAULT_PAYMENT_METHODS_PARTICULAR.map((def) => {
      const existing = methods.find((m) => m.id === def.id);
      return existing ? { ...existing, active: true } : def;
    });

    onUpdate([...defaults, ...customMethods]);
    onAddLog?.("UPDATE_SETTINGS", "Formas de pagamento padrão restauradas");
    toast.success("Formas de pagamento padrão restauradas!");
  };

  const activeCount = methods.filter((m) => m.active).length;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Formas de Pagamento (Particular)</h3>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Gerencie as formas de pagamento disponíveis para produções/lançamentos com pagador Particular.
        Formas inativas não aparecem nos selects de novos lançamentos, mas permanecem visíveis em registros antigos.
      </p>

      {/* Adicionar nova forma */}
      <div className="mb-6 flex gap-3">
        <Input
          placeholder="Nova forma de pagamento..."
          value={newMethodName}
          onChange={(e) => setNewMethodName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-sm"
        />
        <Button onClick={handleAdd} className="gap-2 gradient-primary">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
        <Button variant="outline" onClick={handleRestoreDefaults}>
          Restaurar Padrões
        </Button>
      </div>

      {/* Lista de formas de pagamento */}
      <div className="space-y-2">
        {methods.map((method) => {
          const isDefault = DEFAULT_PAYMENT_METHODS_PARTICULAR.some((d) => d.id === method.id);
          const isEditing = editingId === method.id;

          return (
            <div
              key={method.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                method.active
                  ? "border-border bg-background"
                  : "border-border/50 bg-muted/50 opacity-60"
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="max-w-[200px]"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveEdit}
                    className="h-8 w-8 text-success"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{method.name}</span>
                    {isDefault && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        padrão
                      </span>
                    )}
                    {!method.active && (
                      <span className="text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        inativo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(method.id, method.name)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(method.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="h-8 w-8 opacity-30"
                        title="Formas padrão não podem ser excluídas"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    )}
                    <Switch
                      checked={method.active}
                      onCheckedChange={() => handleToggle(method.id)}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Total: {methods.length} formas de pagamento ({activeCount} ativas)
      </p>
    </div>
  );
}
