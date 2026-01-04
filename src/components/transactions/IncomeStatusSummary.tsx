import { DashboardStats } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IncomeStatusSummaryProps {
  stats: DashboardStats;
  onStatusClick?: (status: "previsto" | "recebido" | "cancelado") => void;
  selectedStatus?: string;
}

export function IncomeStatusSummary({ 
  stats, 
  onStatusClick,
  selectedStatus 
}: IncomeStatusSummaryProps) {
  const statusCards = [
    {
      id: "previsto",
      label: "Previsto",
      description: "Valores ainda não recebidos",
      amount: stats.incomeByStatus?.previsto || 0,
      count: stats.incomeCountByStatus?.previsto || 0,
      icon: Clock,
      colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-600",
    },
    {
      id: "recebido",
      label: "Recebido",
      description: "Valores já em caixa",
      amount: stats.incomeByStatus?.recebido || 0,
      count: stats.incomeCountByStatus?.recebido || 0,
      icon: CheckCircle2,
      colorClass: "bg-success/10 text-success border-success/30",
      iconBg: "bg-success/20",
      iconColor: "text-success",
    },
    {
      id: "cancelado",
      label: "Cancelado",
      description: "Valores não recebidos",
      amount: stats.incomeByStatus?.cancelado || 0,
      count: stats.incomeCountByStatus?.cancelado || 0,
      icon: XCircle,
      colorClass: "bg-destructive/10 text-destructive border-destructive/30",
      iconBg: "bg-destructive/20",
      iconColor: "text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {statusCards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.id;
        
        return (
          <button
            key={card.id}
            onClick={() => onStatusClick?.(card.id as "previsto" | "recebido" | "cancelado")}
            className={cn(
              "relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
              card.colorClass,
              isSelected && "ring-2 ring-offset-2 ring-offset-background",
              isSelected && card.id === "previsto" && "ring-amber-500",
              isSelected && card.id === "recebido" && "ring-success",
              isSelected && card.id === "cancelado" && "ring-destructive",
              onStatusClick && "hover:shadow-md cursor-pointer"
            )}
          >
            <div className="flex items-center gap-3 w-full">
              <div className={cn("rounded-lg p-2", card.iconBg)}>
                <Icon className={cn("h-5 w-5", card.iconColor)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{card.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {card.count} {card.count === 1 ? "entrada" : "entradas"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.description}
                </p>
              </div>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(card.amount)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
