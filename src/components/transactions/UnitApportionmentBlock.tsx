import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
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

  // Component initialization - no debug logging in production

  // Get active units
  const activeUnits = useMemo(() => {
    return settings.units.filter(u => u.active);
  }, [settings.units]);

  // Initialize apportionments when units change
  useEffect(() => {
    if (activeUnits.length > 0 && apportionments.length === 0) {
      const initialApportionments: UnitApportionment[] = activeUnits.map(unit => ({
        unitId: unit.id,
        unitName: unit.name,
        criterionValue: 0,
        apportionedAmount: 0,
      }));
      onApportionmentsChange(initialApportionments);
    }
  }, [activeUnits, apportionments.length, onApportionmentsChange]);

  // Recalculate apportioned amounts when total or criterion values change
  useEffect(() => {
    if (apportionments.length === 0 || totalAmount <= 0) return;

    const totalCriterion = apportionments.reduce((sum, a) => sum + a.criterionValue, 0);
    
    if (totalCriterion > 0) {
      const updatedApportionments = apportionments.map(a => ({
        ...a,
        apportionedAmount: (a.criterionValue / totalCriterion) * totalAmount,
      }));
      
      // Only update if values actually changed
      const hasChanges = updatedApportionments.some((ua, idx) => 
        Math.abs(ua.apportionedAmount - apportionments[idx].apportionedAmount) > 0.01
      );
      
      if (hasChanges) {
        onApportionmentsChange(updatedApportionments);
      }
    }
  }, [totalAmount]);

  // Handle criterion value change for a unit
  const handleCriterionChange = (unitId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    const updatedApportionments = apportionments.map(a => {
      if (a.unitId === unitId) {
        return { ...a, criterionValue: numValue };
      }
      return a;
    });

    // Recalculate apportioned amounts
    const totalCriterion = updatedApportionments.reduce((sum, a) => sum + a.criterionValue, 0);
    
    const finalApportionments = updatedApportionments.map(a => ({
      ...a,
      apportionedAmount: totalCriterion > 0 
        ? (a.criterionValue / totalCriterion) * totalAmount 
        : 0,
    }));

    onApportionmentsChange(finalApportionments);
  };

  // Validation
  const totalCriterion = apportionments.reduce((sum, a) => sum + a.criterionValue, 0);
  const totalApportioned = apportionments.reduce((sum, a) => sum + a.apportionedAmount, 0);
  
  const isPercentual = apportionmentCriteria === "PERCENTUAL";
  const isValid = isPercentual 
    ? Math.abs(totalCriterion - 100) < 0.01 
    : totalCriterion > 0;
  
  const showValidationError = totalCriterion > 0 && isPercentual && Math.abs(totalCriterion - 100) >= 0.01;

  // Get criterion label
  const getCriterionLabel = () => {
    switch (apportionmentCriteria) {
      case "PERCENTUAL": return "%";
      case "M2": return "m²";
      case "FIXO": return "R$";
      default: return "";
    }
  };

  const getCriterionPlaceholder = () => {
    switch (apportionmentCriteria) {
      case "PERCENTUAL": return "Ex: 40";
      case "M2": return "Ex: 150";
      case "FIXO": return "Ex: 1000";
      default: return "Valor";
    }
  };

  // DEBUG: se não houver unidades ativas, mostramos o motivo (não some silenciosamente)
  if (!apportionmentCriteria) {
    return null;
  }

  if (activeUnits.length === 0) {
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 border border-border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-foreground font-semibold flex items-center gap-2">
            📊 Distribuição do Rateio por Unidade
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
          📊 Distribuição do Rateio por Unidade
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Defina como este custo será distribuído entre as unidades. 
                  {isPercentual && " A soma deve ser exatamente 100%."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        {totalCriterion > 0 && (
          <Badge 
            variant="outline" 
            className={isValid 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            }
          >
            {isValid ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            {isPercentual ? `${totalCriterion.toFixed(1)}%` : `Total: ${totalCriterion}`}
          </Badge>
        )}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground border-b border-border pb-2">
        <div>Unidade</div>
        <div className="text-center">
          {apportionmentCriteria === "PERCENTUAL" ? "% Rateio" : 
           apportionmentCriteria === "M2" ? "Metragem (m²)" : 
           "Critério"}
        </div>
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
              <Input
                type="number"
                step="0.01"
                min="0"
                max={isPercentual ? 100 : undefined}
                placeholder={getCriterionPlaceholder()}
                value={apportionment.criterionValue || ""}
                onChange={(e) => handleCriterionChange(apportionment.unitId, e.target.value)}
                className="text-center pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {getCriterionLabel()}
              </span>
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
        <div className={`text-center ${showValidationError ? "text-amber-600" : "text-foreground"}`}>
          {totalCriterion.toFixed(isPercentual ? 1 : 2)} {getCriterionLabel()}
        </div>
        <div className="text-right text-purple-600">
          {formatCurrency(totalApportioned)}
        </div>
      </div>

      {/* Validation Messages */}
      {showValidationError && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            {totalCriterion < 100 
              ? `Faltam ${(100 - totalCriterion).toFixed(1)}% para completar o rateio.`
              : `Excedeu ${(totalCriterion - 100).toFixed(1)}%. A soma deve ser exatamente 100%.`
            }
          </AlertDescription>
        </Alert>
      )}

      {totalCriterion === 0 && (
        <Alert className="border-muted bg-muted/30">
          <Info className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-sm text-muted-foreground">
            Preencha os valores de rateio para cada unidade.
          </AlertDescription>
        </Alert>
      )}

      {isValid && totalCriterion > 0 && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-300">
            Rateio válido. A movimentação será registrada com distribuição por unidade no DRE.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
