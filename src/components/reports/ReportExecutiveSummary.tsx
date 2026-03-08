import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { FilteredStats } from "./types";

interface ReportExecutiveSummaryProps {
  filteredStats: FilteredStats;
  executiveSummary: string[];
}

export function ReportExecutiveSummary({ filteredStats, executiveSummary }: ReportExecutiveSummaryProps) {
  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Saldo Inicial</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(filteredStats.initialBalance)}</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/10 p-4">
          <p className="text-sm text-success">Total Entradas</p>
          <p className="text-xl font-bold text-success">{formatCurrency(filteredStats.totalIncome)}</p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Total Saídas</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(filteredStats.totalExpense)}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-sm text-primary">Saldo Atual</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(filteredStats.currentBalance)}</p>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Status do Relatório</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span>Caixa conferido</span>
          </div>
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span>Valores realizados</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            <span>Não inclui previsões ou contas a receber</span>
          </div>
        </div>
      </div>

      {/* Executive Reading */}
      {executiveSummary.length > 0 && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Leitura Executiva do Período</h3>
          </div>
          <div className="space-y-2">
            {executiveSummary.map((insight, index) => (
              <p key={index} className="text-sm text-foreground leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
