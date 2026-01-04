import { forwardRef } from "react";
import { ArrowUpRight, ArrowDownRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { Transaction } from "@/types";
import { UNIT_LABELS, SPECIALTY_LABELS } from "@/utils/constants";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

// Agrupa transações por data
function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((t) => {
    const dateKey = format(new Date(t.date), "yyyy-MM-dd");
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(t);
  });
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

export const RecentTransactions = forwardRef<HTMLDivElement, RecentTransactionsProps>(
  function RecentTransactions({ transactions }, ref) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="rounded-full bg-muted p-3">
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-3 text-sm font-medium text-foreground">Nenhuma movimentação</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          As movimentações recentes aparecerão aqui
        </p>
      </div>
    );
  }

  const groupedTransactions = groupByDate(transactions);

  return (
    <div className="space-y-4">
      {groupedTransactions.map(([dateKey, dayTransactions]) => (
        <div key={dateKey}>
          {/* Cabeçalho do dia */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {format(new Date(dateKey), "EEEE, dd/MM", { locale: ptBR })}
            </span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] text-muted-foreground">
              {dayTransactions.length} mov.
            </span>
          </div>

          {/* Lista de transações do dia */}
          <div className="space-y-1">
            {dayTransactions.map((transaction) => {
              const isIncome = transaction.type === "INCOME";

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg bg-muted/30 hover:bg-muted/50 px-3 py-2.5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Indicador de tipo - compacto */}
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        isIncome ? "bg-success/10" : "bg-destructive/10"
                      )}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="h-3 w-3 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {transaction.category}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {UNIT_LABELS[transaction.unit] || transaction.unit}
                        {transaction.specialty && (
                          <span className="ml-1">• {SPECIALTY_LABELS[transaction.specialty]}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(transaction.date), "HH:mm")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums min-w-[80px] text-right",
                        isIncome ? "text-success" : "text-destructive"
                      )}
                    >
                      {isIncome ? "+" : "−"}{formatCurrency(transaction.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
