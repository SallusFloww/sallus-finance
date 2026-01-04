import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "income" | "expense" | "balance" | "currentBalance";
  subtitle?: string;
  showCurrency?: boolean;
  highlighted?: boolean;
  secondaryValue?: number;
  secondaryLabel?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  subtitle,
  showCurrency = true,
  highlighted = false,
  secondaryValue,
  secondaryLabel,
}: StatsCardProps) {
  const variantStyles = {
    default: "bg-card border-border",
    income: "bg-card border-border",
    expense: "bg-card border-border",
    balance: "bg-card border-border",
    currentBalance: "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-400/5 border-emerald-500/40",
  };

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    income: "bg-success/15 text-success",
    expense: "bg-destructive/15 text-destructive",
    balance: "bg-primary/15 text-primary",
    currentBalance: "bg-emerald-500/20 text-emerald-600",
  };

  const valueStyles = {
    default: "text-foreground",
    income: "text-success",
    expense: "text-destructive",
    balance: "text-foreground",
    currentBalance: "text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div
      className={cn(
        "animate-fade-in rounded-xl border p-5 transition-all",
        variantStyles[variant],
        highlighted 
          ? "ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/25" 
          : "shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "font-medium text-muted-foreground",
            highlighted ? "text-sm" : "text-xs"
          )}>{title}</p>
          <p className={cn(
            "font-bold tracking-tight",
            valueStyles[variant],
            highlighted ? "text-3xl lg:text-4xl" : "text-xl lg:text-2xl"
          )}>
            {showCurrency ? formatCurrency(value) : value}
          </p>
          
          {/* Valor secundário (realizado) */}
          {secondaryValue !== undefined && secondaryLabel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{secondaryLabel}:</span>
              <span className={cn(
                variant === "income" && "text-success",
                variant === "expense" && "text-destructive"
              )}>
                {formatCurrency(secondaryValue)}
              </span>
            </div>
          )}
          
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "rounded-xl",
          highlighted ? "p-3.5" : "p-2.5",
          iconStyles[variant]
        )}>
          <Icon className={cn(highlighted ? "h-6 w-6" : "h-5 w-5")} />
        </div>
      </div>
    </div>
  );
}