import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { IncomeStatusSummary } from "@/components/transactions/IncomeStatusSummary";
import { useApp } from "@/contexts/AppContext";
import { TransactionStatus, FinancialCategory } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { exportWithExecutiveSummary } from "@/utils/excelExport";
import { toast } from "sonner";
import { ExportButton } from "@/components/ui/export-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/utils/formatters";

interface FiltersState {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: TransactionStatus;
  type?: "INCOME" | "EXPENSE";
  financialCategory?: FinancialCategory;
  search?: string;
}

export default function Transactions() {
  const { transactions } = useApp();
  const { filterTransactions, transactions: allTransactions, getStats } = transactions;

  const [filters, setFilters] = useState<FiltersState>({});
  const [consistencyError, setConsistencyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all");
  const [selectedIncomeStatus, setSelectedIncomeStatus] = useState<string | undefined>(undefined);

  // Calcular stats para o resumo de status
  const stats = useMemo(() => {
    return getStats(filters.startDate, filters.endDate);
  }, [getStats, filters.startDate, filters.endDate]);

  const filteredTransactions = useMemo(() => {
    // Aplicar filtro de tipo baseado na tab ativa
    const typeFilter = activeTab === "all" ? undefined : activeTab === "income" ? "INCOME" : "EXPENSE";
    
    // Aplicar filtro de status de entrada se selecionado
    let statusFilter = filters.status;
    if (activeTab === "income" && selectedIncomeStatus) {
      statusFilter = selectedIncomeStatus === "previsto" ? "PENDENTE" 
                   : selectedIncomeStatus === "recebido" ? "REALIZADO" 
                   : "CANCELADO";
    }
    
    const result = filterTransactions({
      ...filters,
      type: typeFilter || filters.type,
      status: statusFilter,
    });
    return result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filterTransactions, filters, activeTab, selectedIncomeStatus]);

  // Handler para clique nos cards de status
  const handleStatusClick = (status: "previsto" | "recebido" | "cancelado") => {
    if (selectedIncomeStatus === status) {
      setSelectedIncomeStatus(undefined); // Toggle off
    } else {
      setSelectedIncomeStatus(status);
    }
  };

  // ============= VALIDAÇÃO DE CONSISTÊNCIA (OBRIGATÓRIA) =============
  useEffect(() => {
    const hasFilters = Object.values(filters).some(
      (v) => v !== undefined && v !== ""
    );
    
    if (!hasFilters && activeTab === "all" && !selectedIncomeStatus) {
      if (filteredTransactions.length !== allTransactions.length) {
        setConsistencyError(
          `Inconsistência de listagem detectada: ${filteredTransactions.length} movimentações exibidas, mas ${allTransactions.length} existentes no sistema.`
        );
      } else {
        setConsistencyError(null);
      }
    } else {
      setConsistencyError(null);
    }
  }, [filteredTransactions, allTransactions, filters, activeTab, selectedIncomeStatus]);

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast.error("Nenhuma movimentação para exportar");
      throw new Error("No data");
    }
    
    exportWithExecutiveSummary({
      transactions: filteredTransactions,
      filename: 'resumo-executivo-imec-saude',
      periodStart: filters.startDate,
      periodEnd: filters.endDate
    });
  };

  // Contadores por tipo
  const incomeCount = allTransactions.filter(t => t.type === "INCOME").length;
  const expenseCount = allTransactions.filter(t => t.type === "EXPENSE").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ALERTA DE INCONSISTÊNCIA */}
        {consistencyError && (
          <Alert variant="destructive" className="animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inconsistência de Listagem Detectada</AlertTitle>
            <AlertDescription>{consistencyError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
              Movimentações
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {filteredTransactions.length} de {allTransactions.length} movimentações
              </p>
              {filteredTransactions.length === allTransactions.length && !consistencyError && activeTab === "all" && !selectedIncomeStatus && (
                <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Listagem completa
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              onExportExcel={handleExportExcel}
              reportName="Movimentações"
              exportType="data"
              filters={{ 
                startDate: filters.startDate?.toISOString() || "",
                endDate: filters.endDate?.toISOString() || "",
              }}
            />
            <TransactionForm />
          </div>
        </div>

        {/* Tabs de tipo */}
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as "all" | "income" | "expense");
          setSelectedIncomeStatus(undefined);
        }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">
              Todas ({allTransactions.length})
            </TabsTrigger>
            <TabsTrigger value="income" className="text-success">
              Entradas ({incomeCount})
            </TabsTrigger>
            <TabsTrigger value="expense" className="text-destructive">
              Saídas ({expenseCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            <TransactionFilters onFilterChange={setFilters} />
            <TransactionList transactions={filteredTransactions} />
          </TabsContent>

          <TabsContent value="income" className="space-y-4 mt-4">
            {/* Resumo de Status de Entradas */}
            <IncomeStatusSummary 
              stats={stats} 
              onStatusClick={handleStatusClick}
              selectedStatus={selectedIncomeStatus}
            />
            
            {selectedIncomeStatus && (
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedIncomeStatus(undefined)}
                >
                  Filtrando por: {selectedIncomeStatus === "previsto" ? "Previsto" : selectedIncomeStatus === "recebido" ? "Recebido" : "Cancelado"}
                  <span className="ml-1">×</span>
                </Badge>
              </div>
            )}
            
            <TransactionFilters onFilterChange={setFilters} />
            <TransactionList transactions={filteredTransactions} />
          </TabsContent>

          <TabsContent value="expense" className="space-y-4 mt-4">
            <TransactionFilters onFilterChange={setFilters} />
            <TransactionList transactions={filteredTransactions} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
