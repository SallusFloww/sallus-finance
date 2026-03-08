import { Building2, TrendingUp, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import {
  UnitAnalysisItem,
  CategoryAnalysisItem,
  ReceiptTypeAnalysis,
  OperadoraAnalysisItem,
  PaymentMethodAnalysisItem,
} from "./types";

interface ReportConsolidatedTablesProps {
  unitAnalysis: UnitAnalysisItem[];
  totalIncomeAllUnits: number;
  categoryAnalysis: CategoryAnalysisItem[];
  receiptTypeAnalysis: ReceiptTypeAnalysis;
  operadoraAnalysis: OperadoraAnalysisItem[];
  paymentMethodAnalysis: PaymentMethodAnalysisItem[];
  directorMode: boolean;
}

export function ReportConsolidatedTables({
  unitAnalysis,
  totalIncomeAllUnits,
  categoryAnalysis,
  receiptTypeAnalysis,
  operadoraAnalysis,
  paymentMethodAnalysis,
  directorMode,
}: ReportConsolidatedTablesProps) {
  return (
    <>
      {/* Entradas por Unidade */}
      {!directorMode && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Entradas por Unidade</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Unidade</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Total Entradas</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Qtd. Mov.</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {unitAnalysis.map((u) => (
                  <tr key={u.unit} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-foreground">{u.name}</td>
                    <td className="py-3 text-right text-success">{formatCurrency(u.totalIncome)}</td>
                    <td className="py-3 text-right text-muted-foreground">{u.count}</td>
                    <td className="py-3 text-right text-foreground">{formatCurrency(u.avgTicket)}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {totalIncomeAllUnits > 0 ? ((u.totalIncome / totalIncomeAllUnits) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Análise por Categoria */}
      {!directorMode && categoryAnalysis.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Análise por Categoria</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Valor Total</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Qtd.</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {categoryAnalysis.map((c) => (
                  <tr key={c.category} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-foreground">{c.categoryName}</td>
                    <td className="py-3 text-right text-success">{formatCurrency(c.value)}</td>
                    <td className="py-3 text-right text-muted-foreground">{c.count}</td>
                    <td className="py-3 text-right text-muted-foreground">{c.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribuição das Entradas */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Distribuição das Entradas</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Particular</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(receiptTypeAnalysis.particular.value)}</p>
            <p className="text-sm text-muted-foreground">{receiptTypeAnalysis.particular.percentage.toFixed(1)}% das entradas</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Convênios</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(receiptTypeAnalysis.convenio.value)}</p>
            <p className="text-sm text-muted-foreground">{receiptTypeAnalysis.convenio.percentage.toFixed(1)}% das entradas</p>
          </div>
        </div>
      </div>

      {/* Operadoras */}
      {!directorMode && operadoraAnalysis.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Recebimentos por Operadora</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Operadora</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Valor Recebido</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">% Convênios</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">% Total</th>
                </tr>
              </thead>
              <tbody>
                {operadoraAnalysis.map((op) => (
                  <tr key={op.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-foreground">{op.name}</td>
                    <td className="py-3 text-right text-success">{formatCurrency(op.value)}</td>
                    <td className="py-3 text-right text-muted-foreground">{op.percentageOfConvenio.toFixed(1)}%</td>
                    <td className="py-3 text-right text-muted-foreground">{op.percentageOfTotal.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meios de Pagamento */}
      {!directorMode && paymentMethodAnalysis.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Meios de Pagamento (Particular)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Ranking</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Meio de Pagamento</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Qtd</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethodAnalysis.map((pm, index) => (
                  <tr key={pm.id} className="border-b border-border last:border-0">
                    <td className="py-3 text-muted-foreground">{index + 1}º</td>
                    <td className="py-3 font-medium text-foreground">{pm.name}</td>
                    <td className="py-3 text-right text-success">{formatCurrency(pm.value)}</td>
                    <td className="py-3 text-right text-muted-foreground">{pm.count}</td>
                    <td className="py-3 text-right text-foreground">{formatCurrency(pm.avgTicket)}</td>
                    <td className="py-3 text-right text-muted-foreground">{pm.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumo Consolidado */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-semibold text-foreground">Resumo por Unidade (Consolidado)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-sm font-medium text-muted-foreground">Unidade</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Entradas</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Saídas</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Saldo Líquido</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Ticket Médio</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">% Caixa Total</th>
              </tr>
            </thead>
            <tbody>
              {unitAnalysis.map((u) => (
                <tr key={u.unit} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium text-foreground">{u.name}</td>
                  <td className="py-3 text-right text-success">{formatCurrency(u.totalIncome)}</td>
                  <td className="py-3 text-right text-destructive">{formatCurrency(u.totalExpense)}</td>
                  <td className={cn("py-3 text-right font-semibold", u.netBalance >= 0 ? "text-success" : "text-destructive")}>
                    {formatCurrency(u.netBalance)}
                  </td>
                  <td className="py-3 text-right text-foreground">{formatCurrency(u.avgTicket)}</td>
                  <td className="py-3 text-right text-muted-foreground">
                    {totalIncomeAllUnits > 0 ? ((u.totalIncome / totalIncomeAllUnits) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
