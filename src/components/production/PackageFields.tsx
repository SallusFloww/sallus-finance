import { useState, useEffect, useMemo, useCallback } from "react";
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
  packageQty?: number; // Quantidade de pacotes (para exibir Qtd dinâmica)
  onChange: (components: {
    totalAmount: number;
    consultAmount: number;
    feeAmount: number;
    matmedAmount: number;
    consultQty: number;
    feeQty: number;
    matmedQty: number; // Sempre 0, mantido para compatibilidade
    isManualOverride: boolean;
  }) => void;
  disabled?: boolean;
}

export function PackageFields({
  packageType,
  planId,
  referenceDate,
  totalValue,
  packageQty = 1,
  onChange,
  disabled = false,
}: PackageFieldsProps) {
  // Quantidade efetiva do pacote para exibição
  const displayQty = packageQty ?? 1;
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

  // Componentes calculados automaticamente (passando displayQty para multiplicar)
  const autoComponents = useMemo((): PackageComponents => {
    if (!planId || !referenceDate || totalValue <= 0) {
      return {
        consultAmount: 0,
        feeAmount: 0,
        matmedAmount: 0,
        totalAmount: 0,
      };
    }
    return calculateComponents(totalValue, planId, packageType, referenceDate, displayQty);
  }, [totalValue, planId, packageType, referenceDate, displayQty, calculateComponents]);

  // Validação (passando displayQty para considerar quantidade)
  const validation = useMemo(() => {
    if (!planId || !referenceDate || totalValue <= 0) {
      return { valid: true };
    }
    return validateTotal(totalValue, planId, packageType, referenceDate, displayQty);
  }, [totalValue, planId, packageType, referenceDate, displayQty, validateTotal]);

  // Callback estável para notificar parent
  const notifyParent = useCallback(() => {
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
        consultQty: displayQty,
        feeQty: displayQty,
        matmedQty: 0, // Sempre 0 - não controlamos quantidade de Mat/Med
        isManualOverride: true,
      });
    } else {
      onChange({
        totalAmount: autoComponents.totalAmount,
        consultAmount: autoComponents.consultAmount,
        feeAmount: autoComponents.feeAmount,
        matmedAmount: autoComponents.matmedAmount,
        consultQty: displayQty,
        feeQty: displayQty,
        matmedQty: 0, // Sempre 0 - não controlamos quantidade de Mat/Med
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
    displayQty,
  ]);

  // Quando muda qualquer valor, notificar o parent
  useEffect(() => {
    notifyParent();
  }, [notifyParent]);

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

  // Mostrar aviso se total é 0
  const showTotalWarning = totalValue <= 0;

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">
            Componentes do Pacote (Convênio)
          </span>
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

      {/* Regra vigente badge */}
      {effectiveRule && (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-xs w-fit">
            Regra vigente: {effectiveRule.planId} desde{" "}
            {new Date(effectiveRule.effectiveFrom).toLocaleDateString("pt-BR")}
          </Badge>
          {displayQty > 1 && (
            <p className="text-xs text-muted-foreground">
              Valores abaixo já estão multiplicados pela Qtd ({displayQty}).
            </p>
          )}
        </div>
      )}

      {/* Aviso se não tem valor total */}
      {showTotalWarning && (
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>
            Informe o "Valor Total Estimado" abaixo para calcular os componentes.
          </span>
        </div>
      )}

      {/* Aviso se não tem regra configurada */}
      {!effectiveRule && !isManualOverride && !showTotalWarning && (
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>
            Sem regra para {planId || "este plano"}. 
            Configure em Configurações → Pacotes ou edite manualmente.
          </span>
        </div>
      )}

      {/* Erro de validação */}
      {!validation.valid && !showTotalWarning && (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{validation.message}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Consulta */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Consulta (R$)</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualConsult}
              onChange={(e) => setManualConsult(e.target.value)}
              disabled={disabled}
              className="h-9"
              placeholder="0,00"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.consultAmount)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Qtd: {displayQty}</p>
        </div>

        {/* Taxa/Box do Pacote */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Box do Pacote (R$)</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualFee}
              onChange={(e) => setManualFee(e.target.value)}
              disabled={disabled}
              className="h-9"
              placeholder="0,00"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.feeAmount)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Qtd: {displayQty}</p>
        </div>

        {/* Mat/Med - Somente valor, sem quantidade */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mat/Med (R$)</Label>
          {isManualOverride ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualMatmed}
              onChange={(e) => setManualMatmed(e.target.value)}
              disabled={disabled}
              className="h-9"
              placeholder="0,00"
            />
          ) : (
            <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium text-sm">
              {formatCurrency(displayComponents.matmedAmount)}
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">Somente valor</p>
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
