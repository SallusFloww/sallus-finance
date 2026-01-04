import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercentage } from "@/utils/formatters";

type MetricType = "caixa" | "competencia";

interface BIKPICardProps {
  title: string;
  value: number;
  type: MetricType;
  icon: LucideIcon;
  isPercentage?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  tooltipText?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function BIKPICard({
  title,
  value,
  type,
  icon: Icon,
  isPercentage = false,
  trend,
  tooltipText,
  variant = "default",
}: BIKPICardProps) {
  const variantClasses = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    danger: "border-destructive/30 bg-destructive/5",
  };

  const iconClasses = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };

  const typeLabel = type === "caixa" ? "Caixa" : "Competência";
  const typeTooltip = type === "caixa" 
    ? "Baseado em movimentações realizadas (data de pagamento/recebimento)" 
    : "Baseado em produção/faturamento (data de competência)";

  return (
    <div className={cn(
      "flex flex-col gap-2 p-4 bg-card border rounded-lg shadow-sm transition-all hover:shadow-md",
      variantClasses[variant]
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconClasses[variant])} />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] h-5 px-1.5",
                type === "caixa" ? "border-primary/30 text-primary" : "border-secondary/30 text-secondary"
              )}
            >
              {typeLabel}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[200px] text-xs">{typeTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "text-2xl font-bold",
              variant === "success" && "text-success",
              variant === "warning" && "text-warning",
              variant === "danger" && "text-destructive"
            )}>
              {isPercentage ? formatPercentage(value) : formatCurrency(value)}
            </span>
          </TooltipTrigger>
          {tooltipText && (
            <TooltipContent>
              <p className="max-w-[200px] text-xs">{tooltipText}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {trend && (
          <span className={cn(
            "text-xs font-medium",
            trend.isPositive ? "text-success" : "text-destructive"
          )}>
            {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
