import { Building2, AlertCircle, Stethoscope, TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { UnitStats } from "@/types";
import { UNIT_LABELS } from "@/utils/constants";

const unitIcons: Record<string, LucideIcon> = {
  ONCOLOGIA: Building2,
  PRONTO_SOCORRO: AlertCircle,
  CENTRO_CLINICO: Stethoscope,
};

const unitColors: Record<string, string> = {
  ONCOLOGIA: "from-rose-500/10 to-rose-500/5 border-rose-500/20",
  PRONTO_SOCORRO: "from-red-500/10 to-red-500/5 border-red-500/20",
  CENTRO_CLINICO: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
};

const iconColors: Record<string, string> = {
  ONCOLOGIA: "bg-rose-500/20 text-rose-600",
  PRONTO_SOCORRO: "bg-red-500/20 text-red-600",
  CENTRO_CLINICO: "bg-blue-500/20 text-blue-600",
};

interface UnitCardProps {
  stats: UnitStats;
}

export function UnitCard({ stats }: UnitCardProps) {
  const Icon = unitIcons[stats.unit] || Building2;
  const isPositive = stats.netBalance >= 0;

  return (
    <div
      className={cn(
        "animate-slide-up rounded-xl border bg-gradient-to-br p-5 shadow-soft transition-all hover:shadow-glow",
        unitColors[stats.unit] || "from-primary/10 to-primary/5 border-primary/20"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("rounded-xl p-3", iconColors[stats.unit] || "bg-primary/20 text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-muted-foreground">
            {stats.transactionCount} mov.
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="font-semibold text-foreground">{UNIT_LABELS[stats.unit] || stats.unit}</h3>
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          <span
            className={cn(
              "text-lg font-bold",
              isPositive ? "text-success" : "text-destructive"
            )}
          >
            {formatCurrency(stats.netBalance)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-success/10 p-2">
          <p className="text-[10px] font-medium text-success">Entradas</p>
          <p className="text-sm font-semibold text-success">
            {formatCurrency(stats.income)}
          </p>
        </div>
        <div className="rounded-lg bg-destructive/10 p-2">
          <p className="text-[10px] font-medium text-destructive">Saídas</p>
          <p className="text-sm font-semibold text-destructive">
            {formatCurrency(stats.expense)}
          </p>
        </div>
      </div>
    </div>
  );
}
