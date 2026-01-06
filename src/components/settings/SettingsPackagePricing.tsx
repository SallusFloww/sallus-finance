import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package,
  Plus,
  Calendar,
  DollarSign,
  Check,
  X,
  AlertCircle,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePackagePricing, PackageType, PackagePricingRule } from "@/hooks/usePackagePricing";
import { OPERADORAS } from "@/utils/constants";
import { formatCurrency } from "@/utils/formatters";

const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  PACOTE_BOX: "Pacote Box (Convênio)",
  PACOTE_GTA: "Pacote GTA (Convênio)",
};

const PACKAGE_TYPE_COLORS: Record<PackageType, string> = {
  PACOTE_BOX: "bg-blue-100 text-blue-800 border-blue-200",
  PACOTE_GTA: "bg-purple-100 text-purple-800 border-purple-200",
};

export function SettingsPackagePricing() {
  const {
    rules,
    loading,
    addRule,
    inactivateRule,
    activeRulesByPlan,
  } = usePackagePricing();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PackagePricingRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    planId: "",
    packageType: "PACOTE_BOX" as PackageType,
    consultDefaultAmount: "",
    feeDefaultAmount: "",
    effectiveFrom: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      planId: "",
      packageType: "PACOTE_BOX",
      consultDefaultAmount: "",
      feeDefaultAmount: "",
      effectiveFrom: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
  };

  const handleOpenDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.planId) {
      toast.error("Selecione o plano/convênio");
      return;
    }

    const consultAmount = parseFloat(formData.consultDefaultAmount) || 0;
    const feeAmount = parseFloat(formData.feeDefaultAmount) || 0;

    if (consultAmount < 0 || feeAmount < 0) {
      toast.error("Valores não podem ser negativos");
      return;
    }

    setSaving(true);
    try {
      await addRule({
        planId: formData.planId,
        packageType: formData.packageType,
        consultDefaultAmount: consultAmount,
        feeDefaultAmount: feeAmount,
        effectiveFrom: formData.effectiveFrom,
        notes: formData.notes || undefined,
      });
      setDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleInactivate = async () => {
    if (!selectedRule) return;
    
    setSaving(true);
    try {
      await inactivateRule(selectedRule.id);
      setInactivateDialogOpen(false);
      setSelectedRule(null);
    } finally {
      setSaving(false);
    }
  };

  const activeRules = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pacotes Convênio — Parâmetros (Consulta/Taxa)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure valores padrão de consulta e taxa por plano e tipo de pacote.
            Cada regra tem vigência a partir de uma data específica.
          </p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {/* Lista de regras ativas por plano */}
      {activeRules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma regra de pacote configurada.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione regras para habilitar o cálculo automático de componentes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(activeRulesByPlan).map(([planId, planRules]) => (
            <Card key={planId}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {planId}
                  <Badge variant="outline" className="ml-auto">
                    {planRules.length} regra{planRules.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {planRules
                    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border"
                      >
                        <Badge className={PACKAGE_TYPE_COLORS[rule.packageType]}>
                          {PACKAGE_TYPE_LABELS[rule.packageType]}
                        </Badge>
                        
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Consulta:</span>{" "}
                            <span className="font-medium">{formatCurrency(rule.consultDefaultAmount)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Taxa:</span>{" "}
                            <span className="font-medium">{formatCurrency(rule.feeDefaultAmount)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Vigência:</span>{" "}
                            <span className="font-medium">
                              {format(parseISO(rule.effectiveFrom), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {rule.notes && (
                            <div className="text-muted-foreground truncate" title={rule.notes}>
                              {rule.notes}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRule(rule);
                            setInactivateDialogOpen(true);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Regras inativas (histórico) */}
      {inactiveRules.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Regras inativas ({inactiveRules.length})
          </summary>
          <div className="mt-3 space-y-2">
            {inactiveRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-dashed opacity-60"
              >
                <Badge variant="outline" className="text-muted-foreground">
                  {rule.planId}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {PACKAGE_TYPE_LABELS[rule.packageType]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(rule.consultDefaultAmount)} + {formatCurrency(rule.feeDefaultAmount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  (vigência: {format(parseISO(rule.effectiveFrom), "dd/MM/yyyy")})
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Dialog para adicionar regra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Regra de Pacote
            </DialogTitle>
            <DialogDescription>
              Defina os valores padrão de consulta e taxa para este plano.
              A regra será aplicada a lançamentos a partir da data de vigência.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plano/Convênio *</Label>
              <Select
                value={formData.planId}
                onValueChange={(v) => setFormData({ ...formData, planId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {OPERADORAS.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Pacote *</Label>
              <Select
                value={formData.packageType}
                onValueChange={(v) => setFormData({ ...formData, packageType: v as PackageType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PACOTE_BOX">
                    <span className="flex items-center gap-2">
                      📦 Pacote Box (Convênio)
                    </span>
                  </SelectItem>
                  <SelectItem value="PACOTE_GTA">
                    <span className="flex items-center gap-2">
                      🚑 Pacote GTA (Convênio)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Consulta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.consultDefaultAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, consultDefaultAmount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Taxa/Box (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.feeDefaultAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, feeDefaultAmount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vigência a partir de *</Label>
              <Input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) =>
                  setFormData({ ...formData, effectiveFrom: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Lançamentos com data igual ou posterior usarão esta regra.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Ex: Reajuste tabela 2024..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>Salvando...</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Regra
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para inativar */}
      <AlertDialog open={inactivateDialogOpen} onOpenChange={setInactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Inativar Regra de Pacote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta regra será marcada como inativa. Lançamentos existentes não serão afetados.
              Novos lançamentos usarão a próxima regra vigente (se existir).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleInactivate} disabled={saving}>
              {saving ? "Inativando..." : "Inativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
