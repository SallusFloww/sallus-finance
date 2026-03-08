import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { RevenueMapItem } from "./types";

interface ReportRevenueMapProps {
  revenueMap: RevenueMapItem[];
}

export function ReportRevenueMap({ revenueMap }: ReportRevenueMapProps) {
  if (revenueMap.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-warning" />
        <h3 className="font-semibold text-foreground">Mapa de Receita do Período</h3>
        <span className="text-xs text-muted-foreground ml-auto">Top 3 categorias geradoras de caixa</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {revenueMap.map((item) => (
          <div
            key={`${item.unit}_${item.category}`}
            className={cn(
              "rounded-lg border p-4 relative overflow-hidden",
              item.rank === 1 && "border-warning bg-warning/10",
              item.rank === 2 && "border-muted-foreground/30 bg-muted/30",
              item.rank === 3 && "border-orange-500/30 bg-orange-50 dark:bg-orange-950/20"
            )}
          >
            <div className="absolute top-2 right-2 text-2xl font-bold text-muted-foreground/20">
              {item.rank}º
            </div>
            <p className="text-sm font-medium text-foreground">{item.categoryName}</p>
            <p className="text-xs text-muted-foreground">{item.unitName}</p>
            <p className="text-xl font-bold text-foreground mt-2">{formatCurrency(item.value)}</p>
            <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}% do total</p>
          </div>
        ))}
      </div>
    </div>
  );
}
