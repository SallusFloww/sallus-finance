import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FinancialEntryForm, FinancialEntryList, FinancialStatusSummary } from "@/components/financial";
import { useFinancialEntries, FinancialEntryStatus } from "@/hooks/useFinancialEntries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function Financial() {
  const { entries, entradas, saidas, loading, getStats } = useFinancialEntries();
  const [activeTab, setActiveTab] = useState<"all" | "entrada" | "saida">("all");
  const [selectedStatus, setSelectedStatus] = useState<FinancialEntryStatus | undefined>();

  const stats = useMemo(() => getStats(), [getStats]);

  const filteredEntries = useMemo(() => {
    let result = activeTab === "all" ? entries : activeTab === "entrada" ? entradas : saidas;
    
    if (selectedStatus) {
      result = result.filter(e => e.status === selectedStatus);
    }
    
    return result.sort((a, b) => new Date(b.data_prevista).getTime() - new Date(a.data_prevista).getTime());
  }, [entries, entradas, saidas, activeTab, selectedStatus]);

  const handleStatusClick = (status: "previsto" | "recebido" | "cancelado") => {
    setSelectedStatus(prev => prev === status ? undefined : status);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Financeiro</h1>
            <p className="text-sm text-muted-foreground">{entries.length} movimentações</p>
          </div>
          <FinancialEntryForm />
        </div>

        <FinancialStatusSummary 
          stats={stats} 
          onStatusClick={handleStatusClick}
          selectedStatus={selectedStatus}
        />

        {selectedStatus && (
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-muted"
            onClick={() => setSelectedStatus(undefined)}
          >
            Filtrando: {selectedStatus} ×
          </Badge>
        )}

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedStatus(undefined); }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">Todas ({entries.length})</TabsTrigger>
            <TabsTrigger value="entrada" className="text-success">Entradas ({entradas.length})</TabsTrigger>
            <TabsTrigger value="saida" className="text-destructive">Saídas ({saidas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <FinancialEntryList entries={filteredEntries} />
          </TabsContent>
          <TabsContent value="entrada" className="mt-4">
            <FinancialEntryList entries={filteredEntries} />
          </TabsContent>
          <TabsContent value="saida" className="mt-4">
            <FinancialEntryList entries={filteredEntries} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
