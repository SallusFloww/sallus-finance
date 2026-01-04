import { Receipt, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { DashboardStats, Category } from "@/types";

interface ExpenseBreakdownProps {
  stats: DashboardStats;
  categories: Category[];
}

export function ExpenseBreakdown({ stats, categories }: ExpenseBreakdownProps) {
  const hasExpenses = stats.totalExpense > 0;

  if (!hasExpenses) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Nenhuma saída registrada no período</p>
      </div>
    );
  }

  // Ordena categorias por valor (maior para menor)
  const sortedCategories = Object.entries(stats.expenseByCategory)
    .filter(([_, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);

  // Encontra o nome da categoria pelo ID
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  return (
    <div className="rounded-xl border border-destructive/20 bg-gradient-to-br from-destructive/10 to-destructive/5 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-destructive/20 p-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Composição das Saídas</h3>
          <p className="text-xs text-muted-foreground">Despesas por categoria</p>
        </div>
      </div>

      <p className="text-2xl font-bold text-destructive mb-4">
        {formatCurrency(stats.totalExpense)}
      </p>

      {sortedCategories.length > 0 ? (
        <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
          {sortedCategories.map(([categoryId, value]) => {
            const percentage = ((value / stats.totalExpense) * 100).toFixed(1);
            return (
              <div key={categoryId} className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[60%]">
                  <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{getCategoryName(categoryId)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">({percentage}%)</span>
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {formatCurrency(value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem categorias detalhadas</p>
      )}
    </div>
  );
}
