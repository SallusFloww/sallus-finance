import { Banknote, CreditCard, Wallet, Building2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { DashboardStats } from "@/types";

interface IncomeBreakdownProps {
  stats: DashboardStats;
}

export function IncomeBreakdown({ stats }: IncomeBreakdownProps) {
  const hasParticular = stats.incomeByReceiptType.particular > 0;
  const hasConvenio = stats.incomeByReceiptType.convenio > 0;

  if (!hasParticular && !hasConvenio) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Nenhuma entrada registrada no período</p>
      </div>
    );
  }

  // Formas de pagamento PARTICULAR - apenas valores > 0
  const paymentMethods = [
    { key: "dinheiro", label: "Dinheiro", value: stats.incomeByPaymentMethod.dinheiro, icon: Banknote },
    { key: "pix", label: "Pix", value: stats.incomeByPaymentMethod.pix, icon: Wallet },
    { key: "debito", label: "Débito", value: stats.incomeByPaymentMethod.debito, icon: CreditCard },
    { key: "creditoVista", label: "Crédito à Vista", value: stats.incomeByPaymentMethod.creditoVista, icon: CreditCard },
    { key: "creditoParcelado", label: "Crédito Parcelado", value: stats.incomeByPaymentMethod.creditoParcelado, icon: CreditCard },
  ].filter(item => item.value > 0);

  // Operadoras CONVÊNIO - apenas valores > 0
  const operadoras = [
    { key: "ipasgo", label: "Ipasgo", value: stats.incomeByOperadora.ipasgo },
    { key: "unimed", label: "Unimed", value: stats.incomeByOperadora.unimed },
    { key: "bradesco", label: "Bradesco", value: stats.incomeByOperadora.bradesco },
    { key: "geap", label: "GEAP", value: stats.incomeByOperadora.geap },
  ].filter(item => item.value > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* RECEBIMENTOS PARTICULARES */}
      {hasParticular && (
        <div className="rounded-xl border border-success/20 bg-gradient-to-br from-success/10 to-success/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-success/20 p-2">
              <Banknote className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Particular</h3>
              <p className="text-xs text-muted-foreground">Recebimentos diretos</p>
            </div>
          </div>

          <p className="text-2xl font-bold text-success mb-4">
            {formatCurrency(stats.incomeByReceiptType.particular)}
          </p>

          {paymentMethods.length > 0 && (
            <div className="space-y-2 text-sm">
              {paymentMethods.map(({ key, label, value, icon: Icon }) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RECEBIMENTOS DE CONVÊNIOS */}
      {hasConvenio && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-primary/20 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Convênios</h3>
              <p className="text-xs text-muted-foreground">Valores já recebidos em caixa</p>
            </div>
          </div>

          <p className="text-2xl font-bold text-primary mb-4">
            {formatCurrency(stats.incomeByReceiptType.convenio)}
          </p>

          {operadoras.length > 0 && (
            <div className="space-y-2 text-sm">
              {operadoras.map(({ key, label, value }) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
