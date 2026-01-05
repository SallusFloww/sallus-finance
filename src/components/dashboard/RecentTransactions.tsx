import { forwardRef } from "react";
import { ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, Ban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/utils/formatters";
import { Transaction } from "@/types";
import { UNIT_LABELS, SPECIALTY_LABELS } from "@/utils/constants";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

// Agrupa transações por data (HOTFIX P0: usa parseLocalDate para evitar shift de timezone)
function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((t) => {
    // Usa parseLocalDate para interpretar YYYY-MM-DD como data local
    const dateKey = format(parseLocalDate(t.date), "yyyy-MM-dd");
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(t);
  });
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

// Status badge component
function StatusBadge({ status, cancelReason }: { status: string; cancelReason?: string }) {
  if (status === "REALIZADO") {
    return (
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        Realizado
      </Badge>
    );
  }
  
  if (status === "PENDENTE") {
    return (
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
        <Clock className="h-2.5 w-2.5 mr-0.5" />
        Previsto
      </Badge>
    );
  }
  
  if (status === "CANCELADO") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-muted-foreground/30">
              <Ban className="h-2.5 w-2.5 mr-0.5" />
              Cancelado
            </Badge>
          </TooltipTrigger>
          {cancelReason && (
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs"><strong>Motivo:</strong> {cancelReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return null;
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
    <div ref={ref} className="space-y-4">
      {groupedTransactions.map(([dateKey, dayTransactions]) => (
        <div key={dateKey}>
          {/* Cabeçalho do dia - HOTFIX P0: usa parseLocalDate para evitar double shift */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {format(parseLocalDate(dateKey), "EEEE, dd/MM", { locale: ptBR })}
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
              const isCancelled = transaction.status === "CANCELADO";

              return (
                <div
                  key={transaction.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors",
                    isCancelled 
                      ? "bg-muted/20 opacity-60" 
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Indicador de tipo - compacto */}
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        isCancelled 
                          ? "bg-muted" 
                          : isIncome 
                            ? "bg-success/10" 
                            : "bg-destructive/10"
                      )}
                    >
                      {isIncome ? (
                        <ArrowUpRight className={cn(
                          "h-3 w-3",
                          isCancelled ? "text-muted-foreground" : "text-success"
                        )} />
                      ) : (
                        <ArrowDownRight className={cn(
                          "h-3 w-3",
                          isCancelled ? "text-muted-foreground" : "text-destructive"
                        )} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isCancelled ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {transaction.category}
                        </p>
                        <StatusBadge 
                          status={transaction.status} 
                          cancelReason={transaction.cancelledReason}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {transaction.unit ? (UNIT_LABELS[transaction.unit] || transaction.unit) : "Sem unidade"}
                        {transaction.specialty && (
                          <span className="ml-1">• {SPECIALTY_LABELS[transaction.specialty]}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(parseLocalDate(transaction.date), "HH:mm")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums min-w-[80px] text-right",
                        isCancelled 
                          ? "text-muted-foreground line-through" 
                          : isIncome 
                            ? "text-success" 
                            : "text-destructive"
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