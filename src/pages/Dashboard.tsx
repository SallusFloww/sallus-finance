import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarIcon,
  CircleDollarSign,
  History,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { IncomeBreakdown } from "@/components/dashboard/IncomeBreakdown";
import { ExpenseBreakdown } from "@/components/dashboard/ExpenseBreakdown";
import { UnitDrilldown } from "@/components/dashboard/UnitDrilldown";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ReceivablesCard } from "@/components/dashboard/ReceivablesCard";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFinancialIntegrity } from "@/hooks/useFinancialIntegrity";
import { getStartOfMonth, getEndOfMonth, formatCurrency, formatDateTime } from "@/utils/formatters";
import { toast } from "sonner";

export default function Dashboard() {
  const { transactions, auditLog } = useApp();
  const { profile } = useAuth();
  const { getStats, recentTransactions, settings, updateInitialBalance, transactions: allTransactions } = transactions;
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  const addAuditLog = (_action: string, _details: string, _meta?: unknown) => {};

  const [dateRange, setDateRange] = useState({
    start: getStartOfMonth(new Date()),
    end: getEndOfMonth(new Date()),
  });
  const [initialBalanceOpen, setInitialBalanceOpen] = useState(false);
  const [newInitialBalance, setNewInitialBalance] = useState(settings.initialBalance.toString());
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showAdjustmentHistory, setShowAdjustmentHistory] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const stats = getStats(dateRange.start, dateRange.end);
  
  // VALIDAÇÃO DE INTEGRIDADE FINANCEIRA
  const financialIntegrity = useFinancialIntegrity(allTransactions, settings);

  // Atualiza o timestamp a cada mudança nas transações
  useEffect(() => {
    setLastUpdate(new Date());
  }, [allTransactions]);

  const handleUpdateInitialBalance = async () => {
    const value = parseFloat(newInitialBalance) || 0;
    
    if (value === settings.initialBalance) {
      toast.info("O valor é o mesmo, nenhum ajuste necessário.");
      return;
    }

    const adjustment = await updateInitialBalance(
      value, 
      user?.name || "Sistema",
      adjustmentReason || undefined
    );
    
    if (adjustment) {
      addAuditLog(
        "ADJUST_INITIAL_BALANCE",
        `Saldo inicial ajustado de ${formatCurrency(adjustment.previousValue)} para ${formatCurrency(adjustment.newValue)}`,
        { adjustment }
      );
    }
    
    setInitialBalanceOpen(false);
    setAdjustmentReason("");
    toast.success("Saldo inicial atualizado com registro!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ALERTA DE INTEGRIDADE FINANCEIRA */}
        {!financialIntegrity.isValid && (
          <Alert variant="destructive" className="animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inconsistência Financeira Detectada</AlertTitle>
            <AlertDescription>
              {financialIntegrity.errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
              Painel Financeiro
            </h1>
            {/* Microcontexto executivo */}
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-md">
              Visão geral financeira consolidada. Valores faturados a receber não compõem o saldo.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              <span className="mx-2">•</span>
              <span className="text-xs">{stats.transactionCount} movimentações</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.start, "dd/MM")} - {format(dateRange.end, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Data Inicial
                      </p>
                      <Calendar
                        mode="single"
                        selected={dateRange.start}
                        onSelect={(d) => d && setDateRange((prev) => ({ ...prev, start: d }))}
                        className="pointer-events-auto rounded-lg border"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Data Final
                      </p>
                      <Calendar
                        mode="single"
                        selected={dateRange.end}
                        onSelect={(d) => d && setDateRange((prev) => ({ ...prev, end: d }))}
                        className="pointer-events-auto rounded-lg border"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <TransactionForm />
          </div>
        </div>

        {/* ============= CARDS PRINCIPAIS - ORDEM OBRIGATÓRIA ============= */}
        {/* 1. Saldo Inicial | 2. Total Entradas | 3. Total Saídas | 4. SALDO ATUAL (destaque) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. SALDO INICIAL */}
          <Dialog open={initialBalanceOpen} onOpenChange={setInitialBalanceOpen}>
            <DialogTrigger asChild>
              <div className="cursor-pointer">
                <StatsCard
                  title="Saldo Inicial"
                  value={stats.initialBalance}
                  icon={Wallet}
                  subtitle={stats.initialBalanceLastUpdate 
                    ? `Atualizado: ${formatDateTime(stats.initialBalanceLastUpdate)}`
                    : "Clique para ajustar"
                  }
                />
              </div>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajustar Saldo Inicial</DialogTitle>
                <DialogDescription>
                  O ajuste será registrado com data, responsável e motivo.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Novo Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={newInitialBalance}
                    onChange={(e) => setNewInitialBalance(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motivo do Ajuste (opcional)</Label>
                  <Textarea
                    placeholder="Ex: Acerto de fechamento anterior..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleUpdateInitialBalance} className="flex-1 gradient-primary">
                    Confirmar Ajuste
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAdjustmentHistory(!showAdjustmentHistory)}
                    className="gap-2"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </div>

                {/* Histórico de ajustes */}
                {showAdjustmentHistory && settings.initialBalanceAdjustments && settings.initialBalanceAdjustments.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/50 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Histórico de Ajustes</p>
                    <div className="space-y-2">
                      {settings.initialBalanceAdjustments.slice(0, 5).map((adj) => (
                        <div key={adj.id} className="rounded bg-card p-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{formatDateTime(adj.adjustedAt)}</span>
                            <span className="font-medium">{adj.adjustedBy}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-destructive">{formatCurrency(adj.previousValue)}</span>
                            <span className="mx-2">→</span>
                            <span className="text-success">{formatCurrency(adj.newValue)}</span>
                          </div>
                          {adj.reason && <p className="mt-1 text-muted-foreground italic">{adj.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* 2. TOTAL DE ENTRADAS */}
          <StatsCard
            title="Total de Entradas"
            value={stats.totalIncome}
            icon={TrendingUp}
            variant="income"
          />

          {/* 3. TOTAL DE SAÍDAS */}
          <StatsCard
            title="Total de Saídas"
            value={stats.totalExpense}
            icon={TrendingDown}
            variant="expense"
          />

          {/* 4. SALDO ATUAL (DESTAQUE PRINCIPAL) */}
          <StatsCard
            title="Saldo Atual"
            value={stats.currentBalance}
            icon={CircleDollarSign}
            variant="currentBalance"
            subtitle="= Inicial + Entradas - Saídas"
            highlighted
          />
        </div>

        {/* Detalhamento de Entradas e Saídas */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Composição das Entradas
            </h2>
            <IncomeBreakdown stats={stats} />
          </div>
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Composição das Saídas
            </h2>
            <ExpenseBreakdown stats={stats} categories={settings.categories} />
          </div>
        </div>

        {/* Movimentação por Unidade com Drill-down */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Movimentação por Unidade
            </h2>
            <UnitDrilldown transactions={allTransactions} dateRange={dateRange} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Faturamento Pendente
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                Informativo
              </span>
            </div>
            <ReceivablesCard />
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Últimas Movimentações
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>Última conferência: {format(lastUpdate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <RecentTransactions transactions={recentTransactions} />
          </div>
        </div>

        {/* Rodapé de confiabilidade */}
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground border-t border-border">
          {financialIntegrity.isValid ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Integridade financeira verificada • Saldo = Inicial + Entradas - Saídas</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>Verificação de integridade pendente</span>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
