import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, FileSpreadsheet, HelpCircle, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConciliation } from "@/hooks/useConciliation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ConciliationOverview,
  ConciliationPending,
  ConciliationDivergences,
  ConciliationSettings,
  ConciliationFilters,
} from "@/components/conciliation";
import { exportConciliationPDF, exportConciliationExcel } from "@/utils/conciliationExport";
import { toast } from "sonner";

const FIRST_VISIT_KEY = "conciliation_first_visit";

export default function Conciliation() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [showGuide, setShowGuide] = useState(false);

  const {
    conciliationItems,
    filteredItems,
    pendingItems,
    criticalItems15,
    criticalItems30,
    divergences,
    stats,
    paretoByConvenio,
    suggestMatches,
    addNote,
    getNotesForItem,
    setItemStatus,
    settings,
    updateSettings,
    filters,
    setFilters,
    loading,
  } = useConciliation();

  // Show guide on first visit
  useEffect(() => {
    const visited = localStorage.getItem(FIRST_VISIT_KEY);
    if (!visited) {
      setShowGuide(true);
      localStorage.setItem(FIRST_VISIT_KEY, "true");
    }
  }, []);

  // Get unique units and sources for filters
  const availableUnits = useMemo(() => {
    const units = new Set(conciliationItems.map(i => i.unitKey).filter(Boolean));
    return Array.from(units).sort();
  }, [conciliationItems]);

  const availableSources = useMemo(() => {
    const sources = new Set(conciliationItems.map(i => i.sourceKey).filter(Boolean));
    return Array.from(sources).sort();
  }, [conciliationItems]);

  const userName = profile?.full_name || "Usuário";

  const handleExportPDF = () => {
    try {
      exportConciliationPDF({
        stats,
        pendingItems,
        divergences,
        paretoByConvenio,
        period: { start: filters.startDate, end: filters.endDate },
      });
      toast.success("PDF exportado com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
    }
  };

  const handleExportExcel = () => {
    try {
      exportConciliationExcel({
        stats,
        pendingItems,
        divergences,
        paretoByConvenio,
        period: { start: filters.startDate, end: filters.endDate },
      });
      toast.success("Excel exportado com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar Excel");
    }
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
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Conciliação</h1>
              <Badge variant="outline" className="text-xs">
                {conciliationItems.length} itens
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de faturamento vs recebimentos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGuide(true)}
              title="Guia rápido"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF Executivo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel Completo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Global Filters */}
        <ConciliationFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableUnits={availableUnits}
          availableSources={availableSources}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pendências
              {pendingItems.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 h-5 px-1.5 text-xs"
                >
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="divergences" className="relative">
              Divergências
              {divergences.length > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-1 h-5 px-1.5 text-xs"
                >
                  {divergences.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">Regras & Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <ConciliationOverview
              stats={stats}
              paretoByConvenio={paretoByConvenio}
              pendingItems={pendingItems}
            />
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <ConciliationPending
              pendingItems={pendingItems}
              criticalItems15={criticalItems15}
              criticalItems30={criticalItems30}
              onSuggestMatch={suggestMatches}
              onAddNote={addNote}
              onSetStatus={setItemStatus}
              getNotesForItem={getNotesForItem}
              userName={userName}
            />
          </TabsContent>

          <TabsContent value="divergences" className="mt-6">
            <ConciliationDivergences divergences={divergences} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ConciliationSettings
              settings={settings}
              onUpdateSettings={updateSettings}
              conciliationItems={conciliationItems}
              divergences={divergences}
            />
          </TabsContent>
        </Tabs>

        {/* Footer disclaimer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Módulo de conciliação gerencial — não altera dados de origem (faturamento/caixa)
        </div>
      </div>

      {/* Quick Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bem-vindo à Conciliação</DialogTitle>
            <DialogDescription>
              Fluxo diário recomendado em 5 passos
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm py-4">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <div>
                <strong>Filtrar período</strong>
                <p className="text-muted-foreground">Selecione o mês ou semana de referência</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <div>
                <strong>Ver Críticos &gt; 15 dias</strong>
                <p className="text-muted-foreground">Priorize pendências antigas</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <div>
                <strong>Abrir item, registrar nota</strong>
                <p className="text-muted-foreground">Documente ações e próximos passos</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
              <div>
                <strong>Sugerir/confirmar match</strong>
                <p className="text-muted-foreground">Valide sugestões de recebimento</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">5</span>
              <div>
                <strong>Exportar pendências</strong>
                <p className="text-muted-foreground">Gere relatório para cobrança</p>
              </div>
            </li>
          </ol>
          <Button onClick={() => setShowGuide(false)} className="w-full">
            Entendi, começar!
          </Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
