import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, XCircle, DollarSign, FileX2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

export type ConfirmationAction = "cancel" | "delete" | "receive" | "gloss" | "generic";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  action: ConfirmationAction;
  title?: string;
  description?: string;
  // Impacto financeiro (se houver)
  financialImpact?: {
    type: "income" | "expense" | "neutral";
    amount: number;
    description?: string;
  };
  // Nível de confirmação (do parâmetro do sistema)
  confirmationType?: "SIMPLE" | "REINFORCED";
  // Texto obrigatório para confirmação reforçada
  requiredConfirmText?: string;
  // Nome do item para exibição
  itemName?: string;
}

const ACTION_CONFIG: Record<ConfirmationAction, {
  icon: React.ElementType;
  iconClass: string;
  defaultTitle: string;
  defaultDescription: string;
  confirmLabel: string;
  confirmClass: string;
}> = {
  cancel: {
    icon: XCircle,
    iconClass: "text-amber-600",
    defaultTitle: "Cancelar Registro",
    defaultDescription: "Esta ação marcará o registro como cancelado. O histórico será mantido, mas o registro não impactará mais o saldo.",
    confirmLabel: "Confirmar Cancelamento",
    confirmClass: "bg-amber-600 hover:bg-amber-700",
  },
  delete: {
    icon: Trash2,
    iconClass: "text-destructive",
    defaultTitle: "Excluir Permanentemente",
    defaultDescription: "Esta ação é irreversível. O registro será excluído permanentemente do sistema.",
    confirmLabel: "Excluir",
    confirmClass: "bg-destructive hover:bg-destructive/90",
  },
  receive: {
    icon: DollarSign,
    iconClass: "text-emerald-600",
    defaultTitle: "Confirmar Recebimento",
    defaultDescription: "Esta ação gerará uma movimentação de entrada no caixa.",
    confirmLabel: "Confirmar Recebimento",
    confirmClass: "bg-emerald-600 hover:bg-emerald-700",
  },
  gloss: {
    icon: FileX2,
    iconClass: "text-rose-600",
    defaultTitle: "Registrar Glosa",
    defaultDescription: "Esta ação registrará a glosa no faturamento. Glosas parciais geram movimentação apenas do valor líquido.",
    confirmLabel: "Confirmar Glosa",
    confirmClass: "bg-rose-600 hover:bg-rose-700",
  },
  generic: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    defaultTitle: "Confirmar Ação",
    defaultDescription: "Você tem certeza que deseja continuar?",
    confirmLabel: "Confirmar",
    confirmClass: "",
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  action,
  title,
  description,
  financialImpact,
  confirmationType = "SIMPLE",
  requiredConfirmText = "CONFIRMAR",
  itemName,
}: ConfirmationDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  const isReinforcedValid = confirmationType === "REINFORCED" 
    ? confirmInput.toUpperCase() === requiredConfirmText.toUpperCase()
    : true;

  const handleConfirm = () => {
    if (!isReinforcedValid) return;
    setConfirmInput("");
    onConfirm();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmInput("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full bg-muted ${config.iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              {title || config.defaultTitle}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>{description || config.defaultDescription}</p>
            
            {itemName && (
              <div className="p-3 bg-muted rounded-lg">
                <span className="font-medium text-foreground">{itemName}</span>
              </div>
            )}

            {financialImpact && financialImpact.amount > 0 && (
              <div className={`p-3 rounded-lg border ${
                financialImpact.type === "income" 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : financialImpact.type === "expense"
                    ? "bg-rose-500/10 border-rose-500/20"
                    : "bg-muted border-border"
              }`}>
                <p className="text-sm font-medium text-foreground">
                  Impacto Financeiro
                </p>
                <p className={`text-lg font-bold ${
                  financialImpact.type === "income" 
                    ? "text-emerald-600" 
                    : financialImpact.type === "expense"
                      ? "text-rose-600"
                      : "text-foreground"
                }`}>
                  {financialImpact.type === "income" ? "+" : financialImpact.type === "expense" ? "-" : ""}
                  {formatCurrency(financialImpact.amount)}
                </p>
                {financialImpact.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {financialImpact.description}
                  </p>
                )}
              </div>
            )}

            {confirmationType === "REINFORCED" && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-destructive font-medium">
                  Digite "{requiredConfirmText}" para confirmar:
                </Label>
                <Input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={requiredConfirmText}
                  className="uppercase"
                  autoFocus
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isReinforcedValid}
            className={config.confirmClass}
          >
            {config.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
