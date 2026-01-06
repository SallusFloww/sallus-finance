import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calculator, Package, Edit3 } from "lucide-react";
import { usePackagePricing, PackageType, PackageComponents } from "@/hooks/usePackagePricing";
import { formatCurrency } from "@/utils/formatters";

interface PackageFieldsProps {
  packageType: PackageType;
  planId: string;
  referenceDate: string;
  totalValue: number;
  onChange: (components: {
    totalAmount: number;
    consultAmount: number;
    feeAmount: number;
    matmedAmount: number;
    isManualOverride: boolean;
  }) => void;
  disabled?: boolean;
}

export function PackageFields({
  packageType,
  planId,
  referenceDate,
  totalValue,
  onChange,
  disabled = false,
}: PackageFieldsProps) {
  const { calculateComponents, validateTotal, getEffectiveRule } = usePackagePricing();

  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualConsult, setManualConsult] = useState("");
  const [manualFee, setManualFee] = useState("");
  const [manualMatmed, setManualMatmed] = useState("");

  // Regra vigente
  const effectiveRule = useMemo(() => {
    if (!planId || !referenceDate) return null;
    return getEffectiveRule(planId, packageType, referenceDate);
  }, [planId, packageType, referenceDate, getEffectiveRule]);

  // Componentes calculados automaticamente
  const autoComponents = useMemo((): PackageComponents => {
    if (!planId || !referenceDate || totalValue <= 0) {
      return {
        consultAmount: 0,
        feeAmount: 0,
        matmedAmount: 0,
        totalAmount: 0,
      };
    }
    return calculateComponents(totalValue, planId, packageType, referenceDate);
  }, [totalValue, planId, packageType, referenceDate, calculateComponents]);

  // Validação
  const validation = useMemo(() => {
    if (!planId || !referenceDate || totalValue <= 0) {
      return { valid: true };
    }
    return validateTotal(totalValue, planId, packageType, referenceDate);
  }, [totalValue, planId, packageType, referenceDate, validateTotal]);

  // Quando muda o modo ou os valores automáticos, notificar o parent
  useEffect(() => {
    if (isManualOverride) {
      const consult = parseFloat(manualConsult) || 0;
      const fee = parseFloat(manualFee) || 0;
      const matmed = parseFloat(manualMatmed) || 0;
      const total = consult + fee + matmed;

      onChange({
        totalAmount: total,
        consultAmount: consult,
        feeAmount: fee,
        matmedAmount: matmed,
        isManualOverride: true,
      });
    } else {
      onChange({
        totalAmount: autoComponents.totalAmount,
        consultAmount: autoComponents.consultAmount,
        feeAmount: autoComponents.feeAmount,
        matmedAmount: autoComponents.matmedAmount,
        isManualOverride: false,
      });
    }
  }, [
    isManualOverride,
    manualConsult,
    manualFee,
    manualMatmed,
    autoComponents,
    onChange,
  ]);

  // Quando ativa modo manual, preencher com valores automáticos
  useEffect(() => {
    if (isManualOverride && !manualConsult && !manualFee && !manualMatmed) {
      setManualConsult(autoComponents.consultAmount.toFixed(2));
      setManualFee(autoComponents.feeAmount.toFixed(2));
      setManualMatmed(autoComponents.matmedAmount.toFixed(2));
    }
  }, [isManualOverride, autoComponents, manualConsult, manualFee, manualMatmed]);

  // Reset manual quando desativa
  useEffect(() => {
    if (!isManualOverride) {
      setManualConsult("");
      setManualFee("");
      setManualMatmed("");
    }
  }, [isManualOverride]);

  const displayComponents = isManualOverride
    ? {
        consultAmount: parseFloat(manualConsult) || 0,
        feeAmount: parseFloat(manualFee) || 0,
        matmedAmount: parseFloat(manualMatmed) || 0,
      }
    : autoComponents;

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">
            Componentes do Pacote
          </span>
          {effectiveRule && (
            <Badge variant="outline" className="text-xs">
              Regra vigente: {effectiveRule.planId} desde{" "}
              {new Date(effectiveRule.effectiveFrom).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="manual-override" className="text-xs text-muted-foreground">
            Editar manualmente
          </Label>
          <Switch
            id="manual-override"
            checked={isManualOverride}
            onCheckedChange={setIsManualOverride}
            disabled={disabled}
          />
        </div>
      </div>

      {!effectiveRule && !isManualOverride && (
        <div className="flex items-center gap-2 p-2 rounded bg-warning/10 border border-warning/20 text-warning text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>
            Nenhuma regra configurada para {planId || "este plano"}. 
            Valores podem ser editados manualmente ou configurar em Configurações → Pacotes Convênio.
          </span>
        </div>
      )}

      {!validation.valid && (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{validation.message}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Consulta */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Consulta</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualConsult}
              onChange={(e) => setManualConsult(e.target.value)}
              disabled={disabled}
              className="h-9"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.consultAmount)}
            </div>
          )}
        </div>

        {/* Taxa/Box */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Taxa/Box</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualFee}
              onChange={(e) => setManualFee(e.target.value)}
              disabled={disabled}
              className="h-9"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.feeAmount)}
            </div>
          )}
        </div>

        {/* Mat/Med */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mat/Med</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualMatmed}
              onChange={(e) => setManualMatmed(e.target.value)}
              disabled={disabled}
              className="h-9"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.matmedAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calculator className="h-4 w-4" />
          <span>Total calculado:</span>
        </div>
        <span className="font-semibold text-foreground">
          {formatCurrency(
            displayComponents.consultAmount +
            displayComponents.feeAmount +
            displayComponents.matmedAmount
          )}
        </span>
      </div>

      {isManualOverride && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Edit3 className="h-3 w-3" />
          Modo manual ativo. O total será a soma dos componentes.
        </p>
      )}
    </div>
  );
}
