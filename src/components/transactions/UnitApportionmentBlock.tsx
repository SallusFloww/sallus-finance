import { useState, useEffect, useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Info, Calculator } from "lucide-react";
import { UnitApportionment, ApportionmentCriteria } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/utils/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnitApportionmentBlockProps {
  totalAmount: number;
  apportionmentCriteria: ApportionmentCriteria | "";
  apportionments: UnitApportionment[];
  onApportionmentsChange: (apportionments: UnitApportionment[]) => void;
}

export function UnitApportionmentBlock({
  totalAmount,
  apportionmentCriteria,
  apportionments,
  onApportionmentsChange,
}: UnitApportionmentBlockProps) {
  const { transactions } = useApp();
  const { settings } = transactions;

  // Get active units
  const activeUnits = useMemo(() => {
    return settings.units.filter(u => u.active);
  }, [settings.units]);

  const isManual = apportionmentCriteria === "MANUAL";
  const isIgual = apportionmentCriteria === "IGUAL";
  const isFaturamento = apportionmentCriteria === "FATURAMENTO";
  const isProducao = apportionmentCriteria === "PRODUCAO";

  // Calculate apportionments when criteria or units change
  const calculateApportionments = useCallback(() => {
    if (activeUnits.length === 0 || totalAmount <= 0) return [];

    const unitCount = activeUnits.length;

    if (isIgual) {
      // Equal distribution
      const baseAmount = Math.floor((totalAmount * 100) / unitCount) / 100;
      const remainder = Math.round((totalAmount - baseAmount * unitCount) * 100) / 100;
      
      return activeUnits.map((unit, idx) => ({
        unitId: unit.id,
        unitName: unit.name,
        criterionValue: 100 / unitCount,
        apportionedAmount: idx === unitCount - 1 ? baseAmount + remainder : baseAmount,
      }));
    }

    if (isFaturamento || isProducao) {
      // For now, if no data, fall back to equal
      // TODO: Integrate with actual billing/production data
      const baseAmount = Math.floor((totalAmount * 100) / unitCount) / 100;
      const remainder = Math.round((totalAmount - baseAmount * unitCount) * 100) / 100;
      
      return activeUnits.map((unit, idx) => ({
        unitId: unit.id,
        unitName: unit.name,
        criterionValue: 100 / unitCount,
        apportionedAmount: idx === unitCount - 1 ? baseAmount + remainder : baseAmount,
      }));
    }

    // Manual - keep existing or initialize with zeros
    if (apportionments.length === activeUnits.length) {
      return apportionments;
    }

    return activeUnits.map(unit => ({
      unitId: unit.id,
      unitName: unit.name,
      criterionValue: 0,
      apportionedAmount: 0,
    }));
  }, [activeUnits, totalAmount, isIgual, isFaturamento, isProducao, apportionments.length]);

  // Initialize/recalculate on criteria or amount change
  useEffect(() => {
    if (!apportionmentCriteria || activeUnits.length === 0) return;

    // Only auto-recalculate for automatic criteria
    if (isIgual || isFaturamento || isProducao) {
      const calculated = calculateApportionments();
      onApportionmentsChange(calculated);
    } else if (isManual && apportionments.length === 0) {
      // Initialize manual with zeros
      const initial = activeUnits.map(unit => ({
        unitId: unit.id,
        unitName: unit.name,
        criterionValue: 0,
        apportionedAmount: 0,
      }));
      onApportionmentsChange(initial);
    }
  }, [apportionmentCriteria, activeUnits.length, totalAmount]);

  // Recalculate amounts when manual percentages change
  useEffect(() => {
    if (!isManual || apportionments.length === 0 || totalAmount <= 0) return;

    const totalPercent = apportionments.reduce((sum, a) => sum + a.criterionValue, 0);
    if (totalPercent > 0) {
      const updated = apportionments.map((a, idx) => {
        const percent = a.criterionValue / totalPercent;
        let amount = Math.floor(percent * totalAmount * 100) / 100;
        
        // Adjust last item to ensure total matches
        if (idx === apportionments.length - 1) {
          const currentTotal = apportionments.slice(0, -1).reduce((sum, item, i) => {
            const p = item.criterionValue / totalPercent;
            return sum + Math.floor(p * totalAmount * 100) / 100;
          }, 0);
          amount = Math.round((totalAmount - currentTotal) * 100) / 100;
        }
        
        return { ...a, apportionedAmount: amount };
      });
      
      // Only update if amounts changed
      const hasChanges = updated.some((u, i) => 
        Math.abs(u.apportionedAmount - apportionments[i].apportionedAmount) > 0.001
      );
      if (hasChanges) {
        onApportionmentsChange(updated);
      }
    }
  }, [apportionments.map(a => a.criterionValue).join(','), totalAmount, isManual]);

  // Handle manual percentage change
  const handlePercentChange = (unitId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const updated = apportionments.map(a => 
      a.unitId === unitId ? { ...a, criterionValue: Math.min(100, Math.max(0, numValue)) } : a
    );
    onApportionmentsChange(updated);
  };

  // Validation
  const totalPercent = apportionments.reduce((sum, a) => sum + a.criterionValue, 0);
  const totalApportioned = apportionments.reduce((sum, a) => sum + a.apportionedAmount, 0);
  const isPercentValid = Math.abs(totalPercent - 100) < 0.01;
  const isAmountValid = Math.abs(totalApportioned - totalAmount) < 0.01;
  const isValid = isManual ? (isPercentValid && isAmountValid) : isAmountValid;

  if (!apportionmentCriteria) {
    return null;
  }

  if (activeUnits.length === 0) {
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 border border-border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-foreground font-semibold flex items-center gap-2">
            📊 Rateio por Unidade
          </Label>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Sem unidades
          </Badge>
        </div>
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            Nenhuma unidade ativa encontrada em <strong>Configurações</strong>. Ative ao menos 1 unidade para exibir o rateio.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 border border-purple-500/20 rounded-lg p-4 bg-purple-500/5">
      <div className="flex items-center justify-between">
        <Label className="text-primary font-semibold flex items-center gap-2">
          📊 Rateio por Unidade
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  {isManual 
                    ? "Defina o percentual de cada unidade. A soma deve ser exatamente 100%."
                    : "Os valores são calculados automaticamente pelo critério selecionado."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        {apportionments.length > 0 && (
          <Badge 
            variant="outline" 
            className={isValid 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            }
          >
            {isValid ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            {isManual ? `${totalPercent.toFixed(1)}%` : <Calculator className="h-3 w-3" />}
          </Badge>
        )}
      </div>

      {/* Info about automatic calculation */}
      {(isIgual || isFaturamento || isProducao) && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Calculator className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
            {isIgual && "Valor dividido igualmente entre todas as unidades ativas."}
            {isFaturamento && "Valores calculados proporcionalmente ao faturamento de cada unidade. (Usando distribuição igual como fallback)"}
            {isProducao && "Valores calculados proporcionalmente à produção de cada unidade. (Usando distribuição igual como fallback)"}
          </AlertDescription>
        </Alert>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground border-b border-border pb-2">
        <div>Unidade</div>
        <div className="text-center">% Rateio</div>
        <div className="text-right">Valor (R$)</div>
      </div>

      {/* Table Rows */}
      <div className="space-y-3">
        {apportionments.map((apportionment) => (
          <div key={apportionment.unitId} className="grid grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{apportionment.unitName}</span>
            </div>
            <div className="relative">
              {isManual ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ex: 33.33"
                  value={apportionment.criterionValue || ""}
                  onChange={(e) => handlePercentChange(apportionment.unitId, e.target.value)}
                  className="text-center pr-8"
                />
              ) : (
                <div className="text-center font-medium text-muted-foreground">
                  {apportionment.criterionValue.toFixed(2)}%
                </div>
              )}
              {isManual && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              )}
            </div>
            <div className="text-right">
              <span className={`font-semibold ${apportionment.apportionedAmount > 0 ? "text-purple-600" : "text-muted-foreground"}`}>
                {formatCurrency(apportionment.apportionedAmount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals Row */}
      <div className="grid grid-cols-3 gap-4 items-center pt-3 border-t border-border font-semibold">
        <div className="text-sm text-muted-foreground">Total</div>
        <div className={`text-center ${isManual && !isPercentValid ? "text-amber-600" : "text-foreground"}`}>
          {totalPercent.toFixed(2)}%
        </div>
        <div className={`text-right ${isAmountValid ? "text-purple-600" : "text-amber-600"}`}>
          {formatCurrency(totalApportioned)}
        </div>
      </div>

      {/* Comparison with total */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded p-2">
        <span>Valor Total da Movimentação:</span>
        <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
      </div>

      {/* Validation Messages */}
      {isManual && totalPercent > 0 && !isPercentValid && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            {totalPercent < 100 
              ? `Faltam ${(100 - totalPercent).toFixed(2)}% para completar o rateio.`
              : `Excedeu ${(totalPercent - 100).toFixed(2)}%. A soma deve ser exatamente 100%.`
            }
          </AlertDescription>
        </Alert>
      )}

      {isManual && totalPercent === 0 && (
        <Alert className="border-muted bg-muted/30">
          <Info className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-sm text-muted-foreground">
            Preencha os percentuais de rateio para cada unidade. A soma deve ser 100%.
          </AlertDescription>
        </Alert>
      )}

      {isValid && apportionments.length > 0 && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-300">
            Rateio válido. A despesa será distribuída entre as unidades no DRE.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
