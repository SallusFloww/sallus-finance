import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Building2, AlertCircle, Stethoscope, TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { Transaction, Specialty } from "@/types";
import { UNIT_LABELS, SPECIALTY_LABELS, SPECIALTIES } from "@/utils/constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UnitDrilldownProps {
  transactions: Transaction[];
  dateRange: { start: Date; end: Date };
}

interface UnitData {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  income: number;
  expense: number;
  netBalance: number;
  transactionCount: number;
  specialties?: {
    id: Specialty;
    name: string;
    income: number;
    expense: number;
    netBalance: number;
  }[];
}

// Cores neutras para unidades saudáveis, vermelho só para saldo negativo
const unitConfig: Record<string, { icon: LucideIcon; baseColor: string; iconColor: string }> = {
  ONCOLOGIA: {
    icon: Building2,
    baseColor: "from-slate-500/8 to-slate-500/4 border-slate-300/30 dark:border-slate-600/30",
    iconColor: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  },
  PRONTO_SOCORRO: {
    icon: AlertCircle,
    baseColor: "from-slate-500/8 to-slate-500/4 border-slate-300/30 dark:border-slate-600/30",
    iconColor: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  },
  CENTRO_CLINICO: {
    icon: Stethoscope,
    baseColor: "from-blue-500/8 to-blue-500/4 border-blue-300/30 dark:border-blue-600/30",
    iconColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
};

export function UnitDrilldown({ transactions, dateRange }: UnitDrilldownProps) {
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const unitData = useMemo(() => {
    // Filtrar por data - todas as transações são REALIZADAS
    const filtered = transactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        transactionDate >= dateRange.start &&
        transactionDate <= dateRange.end
      );
    });

    const units: UnitData[] = ["ONCOLOGIA", "PRONTO_SOCORRO", "CENTRO_CLINICO"].map((unitId) => {
      const unitTransactions = filtered.filter((t) => t.unit === unitId);
      const income = unitTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = unitTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      const config = unitConfig[unitId];

      const data: UnitData = {
        id: unitId,
        name: UNIT_LABELS[unitId] || unitId,
        icon: config.icon,
        color: config.baseColor,
        iconColor: config.iconColor,
        income,
        expense,
        netBalance: income - expense,
        transactionCount: unitTransactions.length,
      };

      // Adicionar especialidades para Centro Clínico
      if (unitId === "CENTRO_CLINICO") {
        data.specialties = SPECIALTIES.map((spec) => {
          const specTransactions = unitTransactions.filter((t) => t.specialty === spec.id);
          const specIncome = specTransactions
            .filter((t) => t.type === "INCOME")
            .reduce((sum, t) => sum + t.amount, 0);
          const specExpense = specTransactions
            .filter((t) => t.type === "EXPENSE")
            .reduce((sum, t) => sum + t.amount, 0);

          return {
            id: spec.id,
            name: SPECIALTY_LABELS[spec.id] || spec.name,
            income: specIncome,
            expense: specExpense,
            netBalance: specIncome - specExpense,
          };
        }).filter((spec) => spec.income > 0 || spec.expense > 0);
      }

      return data;
    });

    return units;
  }, [transactions, dateRange]);

  return (
    <div className="space-y-3">
      {unitData.map((unit) => {
        const Icon = unit.icon;
        const isExpanded = expandedUnit === unit.id;
        const hasSpecialties = unit.specialties && unit.specialties.length > 0;
        const isNegative = unit.netBalance < 0;

        // Cor dinâmica: vermelho só se saldo negativo
        const dynamicColor = isNegative 
          ? "from-destructive/10 to-destructive/5 border-destructive/30" 
          : unit.color;
        const dynamicIconColor = isNegative
          ? "bg-destructive/15 text-destructive"
          : unit.iconColor;

        return (
          <Collapsible
            key={unit.id}
            open={isExpanded}
            onOpenChange={(open) => setExpandedUnit(open ? unit.id : null)}
          >
            <div
              className={cn(
                "rounded-xl border bg-gradient-to-br transition-all",
                dynamicColor,
                hasSpecialties && "cursor-pointer hover:shadow-md"
              )}
            >
              <CollapsibleTrigger asChild disabled={!hasSpecialties}>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-xl p-2.5", dynamicIconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">{unit.name}</h3>
                        {hasSpecialties && (
                          isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {unit.transactionCount} mov.
                        {unit.id === "CENTRO_CLINICO" && hasSpecialties && !isExpanded && (
                          <span className="ml-1.5 text-primary/70">• Ver especialidades</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    {/* Entradas e Saídas - visual reduzido */}
                    <div className="hidden sm:block">
                      <p className="text-[10px] text-muted-foreground/70 uppercase">Entradas</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {formatCurrency(unit.income)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[10px] text-muted-foreground/70 uppercase">Saídas</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {formatCurrency(unit.expense)}
                      </p>
                    </div>
                    {/* SALDO - destaque principal */}
                    <div className="min-w-[90px]">
                      <p className="text-[10px] text-muted-foreground/70 uppercase">Saldo</p>
                      <p className={cn(
                        "font-bold text-base",
                        unit.netBalance >= 0 ? "text-foreground" : "text-destructive"
                      )}>
                        {formatCurrency(unit.netBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {hasSpecialties && (
                  <div className="border-t border-border/50 p-3 bg-background/50 rounded-b-xl">
                    <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Especialidades
                    </p>
                    <div className="space-y-1.5">
                      {unit.specialties?.map((spec) => (
                        <div
                          key={spec.id}
                          className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-border/50"
                        >
                          <span className="font-medium text-foreground text-sm">{spec.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">+{formatCurrency(spec.income)}</span>
                            <span className="text-muted-foreground">-{formatCurrency(spec.expense)}</span>
                            <span className={cn(
                              "font-semibold min-w-[70px] text-right",
                              spec.netBalance >= 0 ? "text-foreground" : "text-destructive"
                            )}>
                              {formatCurrency(spec.netBalance)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
