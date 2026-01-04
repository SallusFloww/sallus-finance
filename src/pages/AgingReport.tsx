import { useState, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  AlertTriangle,
  FileSearch,
  Building2,
  Banknote,
  Target,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Activity,
  User,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/utils/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function formatUnitName(unit: string): string {
  const unitLabels: Record<string, string> = {
    oncologia: "Oncologia",
    "pronto-socorro": "Pronto Socorro",
    "centro-clinico": "Centro Clínico",
    centroclinico: "Centro Clínico",
  };
  const normalized = unit.toLowerCase().replace(/\s+/g, "-");
  return unitLabels[normalized] || unit;
}

interface AgingBucket {
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  chartColor: string;
}

const AGING_BUCKETS: AgingBucket[] = [
  { label: "0-30 dias", min: 0, max: 30, color: "text-green-600", bgColor: "bg-green-500", chartColor: "#22c55e" },
  { label: "31-60 dias", min: 31, max: 60, color: "text-amber-600", bgColor: "bg-amber-500", chartColor: "#f59e0b" },
  { label: "61-90 dias", min: 61, max: 90, color: "text-orange-600", bgColor: "bg-orange-500", chartColor: "#f97316" },
  { label: ">90 dias", min: 91, max: Infinity, color: "text-red-600", bgColor: "bg-red-500", chartColor: "#ef4444" },
];

function getAgingBucket(days: number): AgingBucket {
  return AGING_BUCKETS.find((b) => days >= b.min && days <= b.max) || AGING_BUCKETS[3];
}

function getAgingBucketLabel(days: number): string {
  if (days <= 30) return "0-30 dias";
  if (days <= 60) return "31-60 dias";
  if (days <= 90) return "61-90 dias";
  return ">90 dias";
}

const ITEMS_PER_PAGE = 10;

export default function AgingReport() {
  const { receivables, uniqueSources } = useReceivablesDB();
  const { transactions } = useApp();
  const { settings } = transactions;

  // Refs for scrolling
  const detailsRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedConvenio, setSelectedConvenio] = useState<string>("all");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  
  // Filtros de detalhamento
  const [detailFilter, setDetailFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);

  // Data atual para referência
  const today = new Date();
  const currentUser = "Usuário";

  // Unidades únicas
  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    receivables.forEach((r) => units.add(r.unit));
    return Array.from(units).sort();
  }, [receivables]);

  // Apenas recebíveis em aberto (FATURADO) com filtros aplicados
  const openReceivables = useMemo(() => {
    return receivables.filter((r) => {
      if (r.status !== "FATURADO") return false;
      if (selectedUnit !== "all" && r.unit !== selectedUnit) return false;
      if (selectedConvenio !== "all" && r.source !== selectedConvenio) return false;
      if (dateStart && parseISO(r.billingDate) < parseISO(dateStart)) return false;
      if (dateEnd && parseISO(r.billingDate) > parseISO(dateEnd)) return false;
      return true;
    });
  }, [receivables, selectedUnit, selectedConvenio, dateStart, dateEnd]);

  // Classificar por aging
  const agingData = useMemo(() => {
    const buckets: Record<string, { items: typeof openReceivables; total: number }> = {};
    
    AGING_BUCKETS.forEach((bucket) => {
      buckets[bucket.label] = { items: [], total: 0 };
    });

    openReceivables.forEach((r) => {
      const days = differenceInDays(today, parseISO(r.billingDate));
      const bucket = getAgingBucket(days);
      buckets[bucket.label].items.push(r);
      buckets[bucket.label].total += r.billedAmount;
    });

    return buckets;
  }, [openReceivables]);

  // Totais
  const totals = useMemo(() => {
    const total = openReceivables.reduce((sum, r) => sum + r.billedAmount, 0);
    const critical = (agingData[">90 dias"]?.total || 0) + (agingData["61-90 dias"]?.total || 0);
    const criticalPercentage = total > 0 ? (critical / total) * 100 : 0;
    return { total, critical, criticalPercentage, count: openReceivables.length };
  }, [openReceivables, agingData]);

  // Dados para o gráfico
  const chartData = useMemo(() => {
    return AGING_BUCKETS.map((bucket) => ({
      name: bucket.label,
      value: agingData[bucket.label]?.total || 0,
      color: bucket.chartColor,
      count: agingData[bucket.label]?.items.length || 0,
    }));
  }, [agingData]);

  // Leitura Executiva
  const executiveReading = useMemo(() => {
    // Top convênio em aberto
    const convenioTotals: Record<string, number> = {};
    openReceivables.forEach((r) => {
      convenioTotals[r.source] = (convenioTotals[r.source] || 0) + r.billedAmount;
    });
    const topConvenio = Object.entries(convenioTotals).sort((a, b) => b[1] - a[1])[0];
    const topConvenioPercentage = topConvenio && totals.total > 0 
      ? (topConvenio[1] / totals.total) * 100 : 0;

    // Top unidade em aberto
    const unitTotals: Record<string, number> = {};
    openReceivables.forEach((r) => {
      unitTotals[r.unit] = (unitTotals[r.unit] || 0) + r.billedAmount;
    });
    const topUnit = Object.entries(unitTotals).sort((a, b) => b[1] - a[1])[0];

    // Avaliação de risco
    let riskLevel: "Baixo" | "Médio" | "Alto" = "Baixo";
    if (totals.criticalPercentage > 20) {
      riskLevel = "Alto";
    } else if (totals.criticalPercentage > 10 || totals.critical > 0) {
      riskLevel = "Médio";
    }

    return {
      topConvenio: topConvenio ? { name: topConvenio[0], value: topConvenio[1], percentage: topConvenioPercentage } : null,
      topUnit: topUnit ? { name: formatUnitName(topUnit[0]), value: topUnit[1], key: topUnit[0] } : null,
      riskLevel,
    };
  }, [openReceivables, totals]);

  // Tabelas por Convênio
  const byConvenio = useMemo(() => {
    const data: Record<string, {
      source: string;
      buckets: Record<string, number>;
      total: number;
      risk: number;
      riskPercentage: number;
    }> = {};

    openReceivables.forEach((r) => {
      if (!data[r.source]) {
        data[r.source] = {
          source: r.source,
          buckets: { "0-30 dias": 0, "31-60 dias": 0, "61-90 dias": 0, ">90 dias": 0 },
          total: 0,
          risk: 0,
          riskPercentage: 0,
        };
      }

      const days = differenceInDays(today, parseISO(r.billingDate));
      const bucket = getAgingBucket(days);
      data[r.source].buckets[bucket.label] += r.billedAmount;
      data[r.source].total += r.billedAmount;
      if (days > 60) {
        data[r.source].risk += r.billedAmount;
      }
    });

    Object.values(data).forEach((e) => {
      e.riskPercentage = e.total > 0 ? (e.risk / e.total) * 100 : 0;
    });

    return Object.values(data).sort((a, b) => b.total - a.total);
  }, [openReceivables]);

  // Tabelas por Unidade
  const byUnit = useMemo(() => {
    const data: Record<string, {
      unit: string;
      buckets: Record<string, number>;
      total: number;
      risk: number;
      riskPercentage: number;
    }> = {};

    openReceivables.forEach((r) => {
      if (!data[r.unit]) {
        data[r.unit] = {
          unit: r.unit,
          buckets: { "0-30 dias": 0, "31-60 dias": 0, "61-90 dias": 0, ">90 dias": 0 },
          total: 0,
          risk: 0,
          riskPercentage: 0,
        };
      }

      const days = differenceInDays(today, parseISO(r.billingDate));
      const bucket = getAgingBucket(days);
      data[r.unit].buckets[bucket.label] += r.billedAmount;
      data[r.unit].total += r.billedAmount;
      if (days > 60) {
        data[r.unit].risk += r.billedAmount;
      }
    });

    Object.values(data).forEach((e) => {
      e.riskPercentage = e.total > 0 ? (e.risk / e.total) * 100 : 0;
    });

    return Object.values(data).sort((a, b) => b.total - a.total);
  }, [openReceivables]);

  // Detalhamento de títulos
  const detailedReceivables = useMemo(() => {
    let filtered = openReceivables.map((r) => {
      const days = differenceInDays(today, parseISO(r.billingDate));
      return {
        ...r,
        daysOpen: days,
        bucket: getAgingBucketLabel(days),
      };
    });

    // Aplicar filtros de detalhamento
    if (detailFilter === ">30") {
      filtered = filtered.filter((r) => r.daysOpen > 30);
    } else if (detailFilter === ">60") {
      filtered = filtered.filter((r) => r.daysOpen > 60);
    } else if (detailFilter === ">90") {
      filtered = filtered.filter((r) => r.daysOpen > 90);
    } else if (detailFilter.startsWith("convenio:")) {
      const convenio = detailFilter.replace("convenio:", "");
      filtered = filtered.filter((r) => r.source === convenio);
    } else if (detailFilter.startsWith("unit:")) {
      const unit = detailFilter.replace("unit:", "");
      filtered = filtered.filter((r) => r.unit === unit);
    }

    return filtered.sort((a, b) => b.daysOpen - a.daysOpen);
  }, [openReceivables, detailFilter]);

  // Paginação
  const paginatedReceivables = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return detailedReceivables.slice(start, start + ITEMS_PER_PAGE);
  }, [detailedReceivables, currentPage]);

  const totalPages = Math.ceil(detailedReceivables.length / ITEMS_PER_PAGE);

  // Ações recomendadas (NBA)
  const recommendedActions = useMemo(() => {
    const actions: Array<{
      id: string;
      type: "alert" | "attention" | "ok";
      title: string;
      description: string;
      filter?: string;
    }> = [];

    // Priorizar cobrança do maior valor
    if (executiveReading.topConvenio && executiveReading.topConvenio.value > 0) {
      const topConvenioRisk = byConvenio.find((c) => c.source === executiveReading.topConvenio?.name);
      if (topConvenioRisk && topConvenioRisk.risk > 0) {
        actions.push({
          id: "priorizar-cobranca",
          type: "alert",
          title: `Priorizar cobrança – ${executiveReading.topConvenio.name}`,
          description: `Maior valor em aberto: ${formatCurrency(executiveReading.topConvenio.value)} (${executiveReading.topConvenio.percentage.toFixed(0)}% do total)`,
          filter: `convenio:${executiveReading.topConvenio.name}`,
        });
      }
    }

    // Atenção à unidade com maior concentração
    if (executiveReading.topUnit && executiveReading.topUnit.value > 0) {
      const topUnitRisk = byUnit.find((u) => u.unit === executiveReading.topUnit?.key);
      if (topUnitRisk && topUnitRisk.risk > 0) {
        actions.push({
          id: "atencao-unidade",
          type: "attention",
          title: `Atenção ao ${executiveReading.topUnit.name}`,
          description: `Maior concentração de valores: ${formatCurrency(executiveReading.topUnit.value)}`,
          filter: `unit:${executiveReading.topUnit.key}`,
        });
      }
    }

    // Alerta >90 dias
    const over90 = agingData[">90 dias"];
    if (over90 && over90.total > 0) {
      actions.push({
        id: "alerta-90",
        type: "alert",
        title: "Risco crítico: >90 dias",
        description: `${over90.items.length} títulos totalizando ${formatCurrency(over90.total)} em atraso severo`,
        filter: ">90",
      });
    }

    // Cenário saudável
    if (totals.critical === 0 && totals.count > 0) {
      actions.push({
        id: "cenario-saudavel",
        type: "ok",
        title: "Sem riscos críticos (>60 dias)",
        description: "Cenário saudável — todos os títulos estão dentro do prazo aceitável",
      });
    }

    return actions.slice(0, 4);
  }, [executiveReading, agingData, totals, byConvenio, byUnit]);

  // Handlers
  const handleConvenioDrilldown = (source: string) => {
    setDetailFilter(`convenio:${source}`);
    setCurrentPage(1);
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleUnitDrilldown = (unit: string) => {
    setDetailFilter(`unit:${unit}`);
    setCurrentPage(1);
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleActionClick = (filter?: string) => {
    if (filter) {
      setDetailFilter(filter);
      setCurrentPage(1);
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setDetailFilter("all");
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "alert": return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "attention": return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default: return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  const getRiskBadgeColor = (percentage: number) => {
    if (percentage > 20) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (percentage > 10) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  // Empty state
  if (openReceivables.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          {/* Cabeçalho */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Contas a Receber (Aging)
            </h1>
            <p className="text-sm text-muted-foreground">
              Análise de antiguidade dos recebíveis em aberto
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(today, "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {currentUser}
              </span>
              <Badge variant="outline" className="text-xs">
                0 títulos em aberto
              </Badge>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {formatUnitName(unit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Convênio</Label>
                  <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {uniqueSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data início</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data fim</Label>
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleApplyFilters} className="w-full">
                    Aplicar filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Clock className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Sem títulos em aberto
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Não há títulos em aberto no filtro atual. Todos os faturamentos foram recebidos ou não existem faturamentos cadastrados.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* 1️⃣ Cabeçalho */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Contas a Receber (Aging)
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise de antiguidade dos recebíveis em aberto
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(today, "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {currentUser}
            </span>
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {totals.count} títulos em aberto
            </Badge>
          </div>
        </div>

        {/* 2️⃣ Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {formatUnitName(unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Convênio</Label>
                <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters} className="w-full">
                  Aplicar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3️⃣ Leitura Executiva */}
        <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Leitura Executiva (Resumo Inteligente)
              </CardTitle>
              <Badge 
                className={`${
                  executiveReading.riskLevel === "Baixo" 
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                    : executiveReading.riskLevel === "Médio" 
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" 
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                Risco {executiveReading.riskLevel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Em aberto:</span>{" "}
                {formatCurrency(totals.total)}
                {executiveReading.topConvenio && (
                  <> — {executiveReading.topConvenio.percentage.toFixed(0)}% concentrado no convênio <span className="font-medium">{executiveReading.topConvenio.name}</span>.</>
                )}
              </p>
              {executiveReading.topUnit && (
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Maior risco concentrado:</span>{" "}
                  na unidade <span className="font-medium">{executiveReading.topUnit.name}</span>.
                </p>
              )}
              <p className={totals.critical > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                {totals.critical > 0 
                  ? `⚠️ ${formatCurrency(totals.critical)} em risco (>60 dias) — ${totals.criticalPercentage.toFixed(0)}% do total.`
                  : "✅ Nenhum título acima de 60 dias — cenário considerado saudável."}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total em aberto</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Convênio com maior pendência</p>
                <p className="text-sm font-medium">{executiveReading.topConvenio?.name || "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Unidade mais exposta</p>
                <p className="text-sm font-medium">{executiveReading.topUnit?.name || "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avaliação do risco</p>
                <Badge className={getRiskBadgeColor(totals.criticalPercentage)}>
                  {executiveReading.riskLevel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4️⃣ Cards de Visão Rápida (KPIs) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {AGING_BUCKETS.map((bucket) => {
            const bucketData = agingData[bucket.label] || { items: [], total: 0 };
            const percentage = totals.total > 0 ? (bucketData.total / totals.total) * 100 : 0;
            
            return (
              <Card key={bucket.label} className={`border-l-4 ${
                bucket.label === "0-30 dias" ? "border-l-green-500" :
                bucket.label === "31-60 dias" ? "border-l-amber-500" :
                bucket.label === "61-90 dias" ? "border-l-orange-500" :
                "border-l-red-500"
              }`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${bucket.bgColor}`} />
                    <span className="text-xs font-medium text-muted-foreground">{bucket.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${bucket.color}`}>
                    {formatCurrency(bucketData.total)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {percentage.toFixed(1)}% do total
                  </p>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Total em Risco */}
          <Card className={`border-l-4 border-l-red-500 ${totals.critical > 0 ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${totals.critical > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground">Total em Risco</span>
              </div>
              <p className={`text-xl font-bold ${totals.critical > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrency(totals.critical)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {">"}60 dias
              </p>
            </CardContent>
          </Card>
          
          {/* Percentual em Risco */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-muted-foreground">% em Risco</span>
              </div>
              <p className={`text-xl font-bold ${totals.criticalPercentage > 20 ? "text-red-600" : totals.criticalPercentage > 10 ? "text-amber-600" : "text-green-600"}`}>
                {totals.criticalPercentage.toFixed(1)}%
              </p>
              <Progress 
                value={totals.criticalPercentage} 
                className={`h-1.5 mt-2 ${
                  totals.criticalPercentage > 20 ? "[&>div]:bg-red-500" :
                  totals.criticalPercentage > 10 ? "[&>div]:bg-amber-500" :
                  "[&>div]:bg-green-500"
                }`}
              />
            </CardContent>
          </Card>
        </div>

        {/* 5️⃣ Gráfico de Distribuição */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Distribuição por Faixa de Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={80}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    labelFormatter={(label) => `Faixa: ${label}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs">
              {AGING_BUCKETS.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${bucket.bgColor}`} />
                  <span className="text-muted-foreground">{bucket.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6️⃣ Tabela: Aging por Convênio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Aging por Convênio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convênio</TableHead>
                    <TableHead className="text-right text-green-600">0-30 dias</TableHead>
                    <TableHead className="text-right text-amber-600">31-60 dias</TableHead>
                    <TableHead className="text-right text-orange-600">61-90 dias</TableHead>
                    <TableHead className="text-right text-red-600">{">"}90 dias</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                    <TableHead className="text-right">% Risco</TableHead>
                    <TableHead className="text-center">Indicador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byConvenio.map((row) => (
                    <TableRow 
                      key={row.source}
                      className="cursor-pointer hover:bg-muted/70"
                      onClick={() => handleConvenioDrilldown(row.source)}
                    >
                      <TableCell className="font-medium">{row.source}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(row.buckets["0-30 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatCurrency(row.buckets["31-60 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(row.buckets["61-90 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(row.buckets[">90 dias"])}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(row.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={row.riskPercentage > 20 ? "text-red-600 font-medium" : row.riskPercentage > 10 ? "text-amber-600" : ""}>
                          {row.riskPercentage.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.riskPercentage > 20 ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                        ) : row.riskPercentage > 10 ? (
                          <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 7️⃣ Tabela: Aging por Unidade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Aging por Unidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right text-green-600">0-30 dias</TableHead>
                    <TableHead className="text-right text-amber-600">31-60 dias</TableHead>
                    <TableHead className="text-right text-orange-600">61-90 dias</TableHead>
                    <TableHead className="text-right text-red-600">{">"}90 dias</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                    <TableHead className="text-right">% Risco</TableHead>
                    <TableHead className="text-center">Indicador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byUnit.map((row) => (
                    <TableRow 
                      key={row.unit}
                      className="cursor-pointer hover:bg-muted/70"
                      onClick={() => handleUnitDrilldown(row.unit)}
                    >
                      <TableCell className="font-medium">{formatUnitName(row.unit)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(row.buckets["0-30 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatCurrency(row.buckets["31-60 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(row.buckets["61-90 dias"])}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(row.buckets[">90 dias"])}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(row.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={row.riskPercentage > 20 ? "text-red-600 font-medium" : row.riskPercentage > 10 ? "text-amber-600" : ""}>
                          {row.riskPercentage.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.riskPercentage > 20 ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                        ) : row.riskPercentage > 10 ? (
                          <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 8️⃣ Próxima Melhor Ação (NBA) */}
        {recommendedActions.length > 0 && (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle className="text-base font-semibold">
                    Próxima Melhor Ação
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recomendações automáticas baseadas nos dados
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {recommendedActions.map((action) => (
                  <div 
                    key={action.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      action.type === "alert" ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" :
                      action.type === "attention" ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" :
                      "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                    }`}
                    onClick={() => handleActionClick(action.filter)}
                  >
                    <div className="flex items-start gap-3">
                      {getActionIcon(action.type)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{action.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 9️⃣ Tabela Detalhada – Títulos em Aberto */}
        <div ref={detailsRef}>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSearch className="h-4 w-4" />
                  Títulos em Aberto — Detalhamento
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={detailFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDetailFilter("all"); setCurrentPage(1); }}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={detailFilter === ">30" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDetailFilter(">30"); setCurrentPage(1); }}
                  >
                    {">"}30 dias
                  </Button>
                  <Button
                    variant={detailFilter === ">60" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDetailFilter(">60"); setCurrentPage(1); }}
                  >
                    {">"}60 dias
                  </Button>
                  <Button
                    variant={detailFilter === ">90" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDetailFilter(">90"); setCurrentPage(1); }}
                  >
                    {">"}90 dias
                  </Button>
                </div>
              </div>
              {detailFilter !== "all" && (
                <Badge variant="secondary" className="w-fit mt-2">
                  Filtro ativo: {detailFilter.startsWith("convenio:") ? `Convênio: ${detailFilter.replace("convenio:", "")}` :
                                 detailFilter.startsWith("unit:") ? `Unidade: ${formatUnitName(detailFilter.replace("unit:", ""))}` :
                                 detailFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2"
                    onClick={() => setDetailFilter("all")}
                  >
                    ×
                  </Button>
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {detailedReceivables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum título encontrado com o filtro atual.</p>
                </div>
              ) : (
                <>
                  <div className="relative overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Convênio</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-center">Dias em aberto</TableHead>
                          <TableHead className="text-center">Faixa de risco</TableHead>
                          <TableHead className="text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReceivables.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">
                              {format(parseISO(r.billingDate), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium">{r.source}</TableCell>
                            <TableCell>{formatUnitName(r.unit)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {r.description || "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(r.billedAmount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-medium ${
                                r.daysOpen > 90 ? "text-red-600" :
                                r.daysOpen > 60 ? "text-orange-600" :
                                r.daysOpen > 30 ? "text-amber-600" :
                                "text-green-600"
                              }`}>
                                {r.daysOpen}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                className={`text-xs ${
                                  r.bucket === ">90 dias" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                                  r.bucket === "61-90 dias" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" :
                                  r.bucket === "31-60 dias" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
                                  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                }`}
                              >
                                {r.bucket}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedReceivable(r)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, detailedReceivables.length)} de {detailedReceivables.length} títulos
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(currentPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Página {currentPage} de {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(currentPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 🔒 Rodapé */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground border-t pt-4 gap-2">
          <p>
            Relatório automático — dados consolidados do sistema
          </p>
          <p>
            Período analisado: {dateStart ? format(parseISO(dateStart), "dd/MM/yyyy", { locale: ptBR }) : "início"} a {dateEnd ? format(parseISO(dateEnd), "dd/MM/yyyy", { locale: ptBR }) : format(today, "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Modal de detalhes */}
      <Dialog open={!!selectedReceivable} onOpenChange={() => setSelectedReceivable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Detalhes do Título
            </DialogTitle>
          </DialogHeader>
          {selectedReceivable && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data Faturamento</p>
                  <p className="font-medium">
                    {format(parseISO(selectedReceivable.billingDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dias em Aberto</p>
                  <p className={`font-medium ${
                    selectedReceivable.daysOpen > 90 ? "text-red-600" :
                    selectedReceivable.daysOpen > 60 ? "text-orange-600" :
                    selectedReceivable.daysOpen > 30 ? "text-amber-600" :
                    "text-green-600"
                  }`}>
                    {selectedReceivable.daysOpen} dias
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Convênio</p>
                <p className="font-medium">{selectedReceivable.source}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unidade</p>
                <p className="font-medium">{formatUnitName(selectedReceivable.unit)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Descrição</p>
                <p className="font-medium">{selectedReceivable.description || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faixa de Risco</p>
                <Badge 
                  className={`text-xs ${
                    selectedReceivable.bucket === ">90 dias" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                    selectedReceivable.bucket === "61-90 dias" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" :
                    selectedReceivable.bucket === "31-60 dias" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
                    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  }`}
                >
                  {selectedReceivable.bucket}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Valor em Aberto</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedReceivable.billedAmount)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
