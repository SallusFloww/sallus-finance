import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Building2,
  Users,
  Stethoscope,
  FlaskConical,
  Syringe,
  Heart,
  Bed,
  HelpCircle,
  AlertTriangle,
  FileWarning,
  PieChart,
  ExternalLink,
  FileSearch,
  Plus,
  Search,
  Filter,
  Upload,
} from "lucide-react";
import { useProductionDB } from "@/hooks/useProductionDB";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ProductionStats, ProductionForm, ProductionList, ProductionFormData, ProductionImportModal } from "@/components/production";
import { ProductionStatus, ProductionType } from "@/types";
import { toast } from "sonner";
import { formatUnitDisplayName, formatConvenioDisplayName } from "@/utils/formatters";

// Labels para tipos de produção
const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  QUIMIOTERAPIA: "Quimioterapia",
  BOX_PS: "Box / Atendimento PS",
  SESSAO_TERAPEUTICA: "Sessão Terapêutica",
  INTERNACAO: "Internação",
  OUTRO: "Outro",
};

const PRODUCTION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONSULTA: Stethoscope,
  EXAME: FlaskConical,
  QUIMIOTERAPIA: Syringe,
  BOX_PS: Heart,
  SESSAO_TERAPEUTICA: Activity,
  INTERNACAO: Bed,
  OUTRO: HelpCircle,
};

function getProductionTypeLabel(type: string): string {
  return PRODUCTION_TYPE_LABELS[type] || type;
}

function getProductionTypeIcon(type: string) {
  return PRODUCTION_TYPE_ICONS[type] || Activity;
}

// Use centralized formatUnitDisplayName from formatters.ts

interface OperationalAlert {
  type: "concentration" | "unbilled";
  severity: "warning" | "info";
  message: string;
  detail: string;
}

interface AggregatedRow {
  productionType: string;
  unit: string;
  convenio: string;
  quantity: number;
  percentage: number;
}

export default function Production() {
  const { transactions } = useApp();
  const { settings } = transactions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  
  const {
    productions, 
    addProduction, 
    deleteProduction,
    cancelProduction,
    updateProduction,
    filterProductions, 
    getStats: getProductionStats,
    uniqueConvenios,
    loading: productionsLoading,
    refetch: refetchProductions,
  } = useProductionDB();

  // Modal de produção
  const [isProductionFormOpen, setIsProductionFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedConvenio, setSelectedConvenio] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [productionStatusFilter, setProductionStatusFilter] = useState<string>("all");
  const [productionSearchQuery, setProductionSearchQuery] = useState("");

  // Unidades únicas
  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    productions.forEach((p) => units.add(p.unit));
    return Array.from(units).sort();
  }, [productions]);

  // Tipos únicos
  const uniqueProductionTypes = useMemo(() => {
    const types = new Set<string>();
    productions.forEach((p) => types.add(p.productionType));
    return Array.from(types).sort();
  }, [productions]);

  // Dados filtrados - IMPORTANT: include 'productions' in deps to react to realtime updates
  const filteredProductions = useMemo(() => {
    return filterProductions({
      startDate: startDate ? parseISO(startDate) : undefined,
      endDate: endDate ? parseISO(endDate) : undefined,
      unit: selectedUnit !== "all" ? selectedUnit : undefined,
      convenio: selectedConvenio !== "all" ? selectedConvenio : undefined,
      productionType: selectedType !== "all" ? (selectedType as ProductionType) : undefined,
      status: productionStatusFilter !== "all" ? (productionStatusFilter as ProductionStatus) : undefined,
      search: productionSearchQuery,
      includeCancelled: true,
    });
  }, [productions, filterProductions, startDate, endDate, selectedUnit, selectedConvenio, selectedType, productionStatusFilter, productionSearchQuery]);

  // Stats de produção
  const productionStats = useMemo(() => {
    const start = startDate ? parseISO(startDate) : startOfMonth(new Date());
    const end = endDate ? parseISO(endDate) : endOfMonth(new Date());
    return getProductionStats(start, end);
  }, [getProductionStats, startDate, endDate]);

  // Handlers de produção (toast is handled inside addProduction)
  const handleAddProduction = async (data: ProductionFormData) => {
    await addProduction({
      ...data,
      // Cast packageType para o tipo correto
      packageType: data.packageType as "PACOTE_BOX" | "PACOTE_GTA" | undefined,
      estimatedValue: data.quantity * data.unitValue,
    });
  };

  const handleDeleteProduction = (id: string) => {
    deleteProduction(id);
  };

  const handleCancelProduction = async (id: string, reason?: string) => {
    await cancelProduction(id, reason);
  };

  const handleEditProduction = async (id: string, data: Partial<any>) => {
    await updateProduction(id, data, user.name);
  };

  // Total de quantidade
  const totalQuantity = useMemo(() => {
    return filteredProductions.filter(p => p.status !== "CANCELADO").reduce((sum, p) => sum + p.quantity, 0);
  }, [filteredProductions]);

  // KPIs Operacionais (sem valores financeiros)
  const operationalStats = useMemo(() => {
    const byType: Record<string, number> = {};
    const byUnit: Record<string, number> = {};
    const byConvenio: Record<string, number> = {};

    const activeProductions = filteredProductions.filter(p => p.status !== "CANCELADO");

    activeProductions.forEach((p) => {
      byType[p.productionType] = (byType[p.productionType] || 0) + p.quantity;
      byUnit[p.unit] = (byUnit[p.unit] || 0) + p.quantity;
      if (p.convenio) {
        byConvenio[p.convenio] = (byConvenio[p.convenio] || 0) + p.quantity;
      }
    });

    // Top 3 tipos
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, qty]) => ({
        type: getProductionTypeLabel(type),
        quantity: qty,
        percentage: totalQuantity > 0 ? ((qty / totalQuantity) * 100).toFixed(1) : "0",
      }));

    const topUnit = Object.entries(byUnit)
      .sort((a, b) => b[1] - a[1])[0];

    const topConvenio = Object.entries(byConvenio)
      .sort((a, b) => b[1] - a[1])[0];

    const convenioConcentration = topConvenio && totalQuantity > 0
      ? (topConvenio[1] / totalQuantity) * 100
      : 0;

    return {
      totalQuantity,
      topTypes,
      typesCount: Object.keys(byType).length,
      topUnit: topUnit ? {
        name: topUnit[0],
        quantity: topUnit[1],
        percentage: totalQuantity > 0 ? ((topUnit[1] / totalQuantity) * 100).toFixed(1) : "0"
      } : null,
      topConvenio: topConvenio ? {
        name: topConvenio[0],
        quantity: topConvenio[1],
        percentage: totalQuantity > 0 ? ((topConvenio[1] / totalQuantity) * 100).toFixed(1) : "0"
      } : null,
      convenioConcentration,
    };
  }, [filteredProductions, totalQuantity]);

  // Alertas Operacionais
  const operationalAlerts = useMemo(() => {
    const alerts: OperationalAlert[] = [];

    // Concentração em convênio (>60%)
    if (operationalStats.convenioConcentration > 60 && operationalStats.topConvenio) {
      alerts.push({
        type: "concentration",
        severity: "warning",
        message: `Produção concentrada em ${operationalStats.topConvenio.name}`,
        detail: `${operationalStats.convenioConcentration.toFixed(0)}% da produção em um único convênio.`,
      });
    }

    // Produções não faturadas
    const unbilledCount = filteredProductions.filter(p => p.status === "PRODUZIDO").length;
    if (unbilledCount > 0) {
      alerts.push({
        type: "unbilled",
        severity: "info",
        message: `${unbilledCount} produção(ões) ainda não faturada(s)`,
        detail: "Acesse 'Faturamento Sugerido' para evitar perda de receita.",
      });
    }

    return alerts;
  }, [operationalStats, filteredProductions]);

  // Dados agregados para tabela
  const aggregatedData = useMemo(() => {
    const aggregation: Record<string, AggregatedRow> = {};

    filteredProductions.forEach((p) => {
      const key = `${p.productionType}|${p.unit}|${p.convenio || "PARTICULAR"}`;

      if (!aggregation[key]) {
        aggregation[key] = {
          productionType: p.productionType,
          unit: p.unit,
          convenio: p.convenio || "PARTICULAR",
          quantity: 0,
          percentage: 0,
        };
      }

      aggregation[key].quantity += p.quantity;
    });

    const rows = Object.values(aggregation).map((row) => ({
      ...row,
      percentage: totalQuantity > 0 ? (row.quantity / totalQuantity) * 100 : 0,
    }));

    return rows.sort((a, b) => b.quantity - a.quantity);
  }, [filteredProductions, totalQuantity]);

  // Título card tipos
  const typesCardTitle = useMemo(() => {
    const count = operationalStats.typesCount;
    if (count === 0) return "Tipos de Produção";
    if (count === 1) return "Tipo de Produção";
    if (count <= 3) return `${count} Tipos de Produção`;
    return "Top 3 Tipos";
  }, [operationalStats.typesCount]);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Badge Visual Temporário para Validação */}
        <div className="bg-green-500 text-white text-center py-2 px-4 rounded-lg font-bold text-sm">
          ✅ PRODUÇÃO OPERACIONAL (rota /production)
        </div>

        {/* Header - Ação Principal em Destaque */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Produção Assistencial</h1>
            <p className="text-xs text-muted-foreground">Lançamento e acompanhamento diário</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
            <Button 
              size="lg"
              className="gap-2 shadow-md"
              onClick={() => setIsProductionFormOpen(true)}
            >
              <Plus className="h-5 w-5" />
              Nova Produção
            </Button>
          </div>
        </div>

        {/* Alerta de Produções Não Faturadas (destaque operacional) */}
        {operationalAlerts.filter(a => a.type === "unbilled").map((alert, idx) => (
          <Alert key={idx} className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 py-2">
            <FileWarning className="h-4 w-4 text-amber-600" />
            <AlertDescription className="ml-2 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm">
                <strong>{alert.message}</strong> — {alert.detail}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/suggested-billing">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Faturar
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ))}

        {/* Filtros Compactos + Busca + Status */}
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produção..."
                value={productionSearchQuery}
                onChange={(e) => setProductionSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-[130px]"
              />
              <span className="text-muted-foreground text-sm">a</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-[130px]"
              />
              <Select value={productionStatusFilter} onValueChange={setProductionStatusFilter}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="PRODUZIDO">Não faturado</SelectItem>
                  <SelectItem value="FATURADO">Faturado</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                  <SelectItem value="GLOSADO">Glosado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas unid.</SelectItem>
                  {uniqueUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {formatUnitDisplayName(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Resumo Operacional Inline (compacto, em segundo plano) */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <Activity className="h-4 w-4 text-primary" />
            <strong className="text-foreground">{operationalStats.totalQuantity}</strong> produções
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-amber-600">{filteredProductions.filter(p => p.status === "PRODUZIDO").length}</strong> não faturadas
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-blue-600">{filteredProductions.filter(p => p.status === "FATURADO").length}</strong> faturadas
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-emerald-600">{filteredProductions.filter(p => p.status === "RECEBIDO").length}</strong> recebidas
          </span>
          {operationalStats.topConvenio && (
            <>
              <span className="text-border hidden sm:inline">|</span>
              <span className="hidden sm:inline">
                Top convênio: <strong className="text-foreground">{operationalStats.topConvenio.name}</strong> ({operationalStats.topConvenio.percentage}%)
              </span>
            </>
          )}
        </div>

        {/* LISTA OPERACIONAL - Foco Principal */}
        <ProductionList 
          productions={filteredProductions}
          units={settings.units}
          onDelete={handleDeleteProduction}
          onCancel={handleCancelProduction}
          onEdit={handleEditProduction}
        />

        {/* CTA Faturamento (simples) */}
        {filteredProductions.filter(p => p.status === "PRODUZIDO").length > 0 && (
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
            <span className="text-sm text-muted-foreground">
              Produções prontas para faturar
            </span>
            <Button size="sm" asChild>
              <Link to="/suggested-billing">
                <ExternalLink className="mr-2 h-4 w-4" />
                Faturamento Sugerido
              </Link>
            </Button>
          </div>
        )}

        {/* Link secundário para relatório gerencial */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-2">
          <span>
            {(() => {
              const s = startDate ? parseISO(startDate) : null;
              const e = endDate ? parseISO(endDate) : null;
              const sValid = s && !isNaN(s.getTime());
              const eValid = e && !isNaN(e.getTime());
              if (!sValid || !eValid) return "Período: —";
              return `Período: ${format(s, "dd/MM/yyyy", { locale: ptBR })} a ${format(e, "dd/MM/yyyy", { locale: ptBR })}`;
            })()}
          </span>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7">
            <Link to="/production-report">
              <FileSearch className="mr-1 h-3 w-3" />
              Ver Relatório Gerencial
            </Link>
          </Button>
        </div>
      </div>

      {/* Form de Produção */}
      <ProductionForm
        open={isProductionFormOpen}
        onOpenChange={setIsProductionFormOpen}
        onSubmit={handleAddProduction}
        units={settings.units}
        userName={user?.name || "Sistema"}
        onBulkInsertSuccess={refetchProductions}
      />

      {/* Modal de Importação CSV */}
      <ProductionImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportComplete={() => {
          // Refresh will happen automatically via realtime
        }}
      />
    </DashboardLayout>
  );
}
