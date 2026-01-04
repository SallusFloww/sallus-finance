import { Card, CardContent } from "@/components/ui/card";
import { FinancialStats } from "@/hooks/useFinancialEntries";
import { formatCurrency } from "@/utils/formatters";
import { Clock, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialStatusSummaryProps {
  stats: FinancialStats;
  onStatusClick?: (status: "previsto" | "recebido" | "cancelado") => void;
  selectedStatus?: string;
}

export function FinancialStatusSummary({ 
  stats, 
  onStatusClick,
  selectedStatus 
}: FinancialStatusSummaryProps) {
  const cards = [
    {
      id: "previsto",
      label: "Previsto",
      value: stats.entradasPrevistas,
      count: stats.countPrevistas,
      icon: Clock,
      colorClass: "text-amber-600",
      bgClass: "bg-amber-500/10",
      borderClass: "border-amber-500/20",
    },
    {
      id: "recebido",
      label: "Recebido",
      value: stats.entradasRecebidas,
      count: stats.countRecebidas,
      icon: CheckCircle2,
      colorClass: "text-success",
      bgClass: "bg-success/10",
      borderClass: "border-success/20",
    },
    {
      id: "cancelado",
      label: "Cancelado",
      value: stats.entradasCanceladas,
      count: stats.countCanceladas,
      icon: XCircle,
      colorClass: "text-muted-foreground",
      bgClass: "bg-muted",
      borderClass: "border-muted-foreground/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Cards de Status */}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedStatus === card.id;
          
          return (
            <Card 
              key={card.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary",
                card.borderClass
              )}
              onClick={() => onStatusClick?.(card.id as "previsto" | "recebido" | "cancelado")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-lg p-2", card.bgClass)}>
                    <Icon className={cn("h-5 w-5", card.colorClass)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className={cn("text-xl font-bold", card.colorClass)}>
                      {formatCurrency(card.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {card.count} {card.count === 1 ? "entrada" : "entradas"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-success/10">
                <ArrowUpRight className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entradas</p>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(stats.totalEntradas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-destructive/10">
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Saídas</p>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(stats.totalSaidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className={cn(
                  "text-xl font-bold",
                  stats.saldo >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(stats.saldo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
