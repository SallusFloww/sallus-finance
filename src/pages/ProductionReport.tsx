import { useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Users,
  Stethoscope,
  FlaskConical,
  Bed,
  Heart,
  Syringe,
  HelpCircle,
  AlertTriangle,
  FileWarning,
  PieChart,
  BarChart3,
  FileText,
  Calendar,
  Target,
  Layers,
  BookOpen,
  LineChart,
  Download,
  Eye,
  Award,
  AlertCircle,
  ChevronRight,
  Sparkles,
  TrendingDown as TrendDown,
} from "lucide-react";
import { useProductionDB } from "@/hooks/useProductionDB";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  parseISO, 
  differenceInDays,
  subDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart as RechartsLine, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Production } from "@/types";
import { ProceduresDetailPanel } from "@/components/production/ProceduresDetailPanel";
import { UnbilledItemsPanel } from "@/components/production/UnbilledItemsPanel";
import { ProductionReportExport, ProductionReportExportData } from "@/components/production/ProductionReportExport";
import { formatUnitDisplayName, formatSpecialtyDisplayName, formatConvenioDisplayName, displayLabel } from "@/utils/formatters";

// Labels para tipos de produção OFICIAIS (incluindo visão por componentes)
const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  QUIMIOTERAPIA: "Quimioterapia",
  BOX_PS: "Box / Atendimento PS",
  BOX_TAXA: "Box / Taxa",
  MAT_MED: "Mat/Med",
  SESSAO_TERAPEUTICA: "Sessão Terapêutica",
  INTERNACAO: "Internação",
  OUTRO: "Outro",
};

// Ícones para tipos de produção (incluindo visão por componentes)
const PRODUCTION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONSULTA: Stethoscope,
  EXAME: FlaskConical,
  QUIMIOTERAPIA: Syringe,
  BOX_PS: Heart,
  BOX_TAXA: Heart,
  MAT_MED: Syringe,
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

// ═══════════════════════════════════════════════════════════════════════════
// Interface ReportItem para visão por componentes (explode pacotes)
// ═══════════════════════════════════════════════════════════════════════════
interface ReportItem {
  id: string;
  sourceId: string;
  reportType: string; // CONSULTA | BOX_TAXA | MAT_MED | EXAME | etc
  unit: string;
  specialty?: string;
  convenio: string;
  productionDate: string;
  competencia: string;
  quantity: number;
  amount: number;
  description: string;
  status: string;
  isFromPackage: boolean;
}

/**
 * Transforma produções em ReportItems para visão por componentes.
 * - Pacotes (PACOTE_BOX/PACOTE_GTA) são "explodidos" em 3 itens: CONSULTA, BOX_TAXA, MAT_MED
 * - BOX_PS avulso é normalizado para BOX_TAXA
 * - Demais tipos mantêm seu reportType original
 */
function toReportItems(productions: Production[]): ReportItem[] {
  const items: ReportItem[] = [];

  for (const p of productions) {
    const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
    const baseItem = {
      sourceId: p.id,
      unit: p.unit,
      specialty: p.specialty,
      convenio: p.convenio || "PARTICULAR",
      productionDate: p.productionDate,
      competencia: p.competencia,
      status: p.status,
    };

    if (isPackage) {
      // Explodir pacote em 3 componentes
      items.push({
        ...baseItem,
        id: `${p.id}:CONSULTA`,
        reportType: "CONSULTA",
        quantity: 1,
        amount: p.consultAmount || 0,
        description: "Consulta (Pacote)",
        isFromPackage: true,
      });
      items.push({
        ...baseItem,
        id: `${p.id}:BOX`,
        reportType: "BOX_TAXA",
        quantity: 1,
        amount: p.feeAmount || 0,
        description: "Box/Taxa (Pacote)",
        isFromPackage: true,
      });
      items.push({
        ...baseItem,
        id: `${p.id}:MATMED`,
        reportType: "MAT_MED",
        quantity: 0, // Mat/Med não tem quantidade
        amount: p.matmedAmount || 0,
        description: "Mat/Med (Pacote)",
        isFromPackage: true,
      });
    } else {
      // Produção normal
      const reportType = p.productionType === "BOX_PS" ? "BOX_TAXA" : p.productionType;
      items.push({
        ...baseItem,
        id: p.id,
        reportType,
        quantity: p.quantity,
        amount: p.estimatedValue || (p.quantity * p.unitValue),
        description: p.description,
        isFromPackage: false,
      });
    }
  }

  return items;
}

// Formatação de nome de unidade para leitura humana (usa utilitário centralizado)
function formatUnitName(unit: string): string {
  return formatUnitDisplayName(unit);
}

interface AggregatedRow {
  reportType: string;
  unit: string;
  convenio: string;
  specialty: string;
  quantity: number;
  amount: number;
  percentage: number; // % by amount
  items: ReportItem[];
}

interface ManagementAlert {
  type: "concentration" | "unbilled" | "trend" | "specialty" | "drop";
  severity: "warning" | "info" | "error";
  message: string;
  interpretation: string;
  actionable?: boolean;
  actionLabel?: string;
}

interface UnitRanking {
  name: string;
  quantity: number;
  percentage: number;
  variation: number | null;
}

interface SpecialtyRanking {
  name: string;
  quantity: number;
  percentage: number;
  concentrationLevel: "alta" | "ok" | "baixa";
}

interface TypeBreakdown {
  type: string;
  label: string;
  quantity: number;
  percentage: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface ConvenioRanking {
  name: string;
  quantity: number;
  percentage: number;
  riskLevel: "alto" | "medio" | "baixo";
  riskText: string;
}

interface TopProcedure {
  name: string;
  code?: string;
  quantity: number;
  percentage: number;
  cumulativePercentage: number;
}

interface TimeSeriesData {
  date: string;
  dateLabel: string;
  total: number;
  [key: string]: string | number;
}

export default function ProductionReport() {
  const { productions, filterProductions, uniqueConvenios } = useProductionDB();

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
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  
  // Estados para novos componentes
  const [evolutionGranularity, setEvolutionGranularity] = useState<"daily" | "weekly">("daily");
  const [evolutionBreakdown, setEvolutionBreakdown] = useState<"geral" | "unidade" | "convenio" | "especialidade">("geral");
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownData, setDrilldownData] = useState<{title: string; items: ReportItem[]}>({ title: "", items: [] });

  // Unidades únicas das produções
  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    productions.forEach((p) => units.add(p.unit));
    return Array.from(units).sort();
  }, [productions]);

  // Especialidades únicas (APENAS especialidades reais, sem fallback para unit)
  const uniqueSpecialties = useMemo(() => {
    const specialties = new Set<string>();
    productions.forEach((p) => {
      // CORREÇÃO: Não usar unit como fallback - apenas especialidades reais
      if (p.specialty && p.specialty.trim() !== "") {
        specialties.add(p.specialty);
      }
    });
    // Adicionar "Sem especialidade" se houver produções sem specialty
    const hasWithoutSpecialty = productions.some(p => !p.specialty || p.specialty.trim() === "");
    const result = Array.from(specialties).sort();
    if (hasWithoutSpecialty) {
      result.push("__SEM_ESPECIALIDADE__");
    }
    return result;
  }, [productions]);

  // Dados filtrados
  const filteredProductions = useMemo(() => {
    let filtered = filterProductions({
      startDate: startDate ? parseISO(startDate) : undefined,
      endDate: endDate ? parseISO(endDate) : undefined,
      unit: selectedUnit !== "all" ? selectedUnit : undefined,
      convenio: selectedConvenio !== "all" ? selectedConvenio : undefined,
      productionType: selectedType !== "all" ? selectedType : undefined,
    });
    
    // Filtro adicional por especialidade (CORREÇÃO: sem fallback para unit)
    if (selectedSpecialty !== "all") {
      if (selectedSpecialty === "__SEM_ESPECIALIDADE__") {
        filtered = filtered.filter(p => !p.specialty || p.specialty.trim() === "");
      } else {
        filtered = filtered.filter(p => p.specialty === selectedSpecialty);
      }
    }
    
    return filtered;
  }, [filterProductions, startDate, endDate, selectedUnit, selectedConvenio, selectedType, selectedSpecialty]);

  // Cálculo do período anterior (mesmo número de dias)
  const periodDays = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  }, [startDate, endDate]);

  // Período anterior para comparação
  const previousPeriodProductions = useMemo(() => {
    const start = parseISO(startDate);
    const previousEnd = subDays(start, 1);
    const previousStart = subDays(previousEnd, periodDays - 1);
    
    let filtered = filterProductions({
      startDate: previousStart,
      endDate: previousEnd,
      unit: selectedUnit !== "all" ? selectedUnit : undefined,
      convenio: selectedConvenio !== "all" ? selectedConvenio : undefined,
      productionType: selectedType !== "all" ? selectedType : undefined,
    });
    
    // CORREÇÃO: Filtro de especialidade sem fallback para unit
    if (selectedSpecialty !== "all") {
      if (selectedSpecialty === "__SEM_ESPECIALIDADE__") {
        filtered = filtered.filter(p => !p.specialty || p.specialty.trim() === "");
      } else {
        filtered = filtered.filter(p => p.specialty === selectedSpecialty);
      }
    }
    
    return filtered;
  }, [filterProductions, startDate, periodDays, selectedUnit, selectedConvenio, selectedType, selectedSpecialty]);

  // Dados do período anterior por unidade (para variação)
  const previousByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    previousPeriodProductions.forEach((p) => {
      map[p.unit] = (map[p.unit] || 0) + p.quantity;
    });
    return map;
  }, [previousPeriodProductions]);

  // Total de quantidade
  const totalQuantity = useMemo(() => {
    return filteredProductions.reduce((sum, p) => sum + p.quantity, 0);
  }, [filteredProductions]);

  const previousTotalQuantity = useMemo(() => {
    return previousPeriodProductions.reduce((sum, p) => sum + p.quantity, 0);
  }, [previousPeriodProductions]);

  // Variação percentual e absoluta
  const variationData = useMemo(() => {
    if (previousTotalQuantity === 0 && totalQuantity === 0) {
      return { hasData: false, absolute: 0, percent: 0, message: "Sem produção em ambos os períodos" };
    }
    if (previousTotalQuantity === 0) {
      return { hasData: true, absolute: totalQuantity, percent: 100, message: null };
    }
    const absolute = totalQuantity - previousTotalQuantity;
    const percent = ((totalQuantity - previousTotalQuantity) / previousTotalQuantity) * 100;
    return { hasData: true, absolute, percent, message: null };
  }, [totalQuantity, previousTotalQuantity]);

  // KPIs estratégicos
  const strategicKPIs = useMemo(() => {
    const byType: Record<string, number> = {};
    const byUnit: Record<string, number> = {};
    const byConvenio: Record<string, number> = {};

    filteredProductions.forEach((p) => {
      byType[p.productionType] = (byType[p.productionType] || 0) + p.quantity;
      byUnit[p.unit] = (byUnit[p.unit] || 0) + p.quantity;
      if (p.convenio) {
        byConvenio[p.convenio] = (byConvenio[p.convenio] || 0) + p.quantity;
      }
    });

    const topUnit = Object.entries(byUnit).sort((a, b) => b[1] - a[1])[0];
    const topConvenio = Object.entries(byConvenio).sort((a, b) => b[1] - a[1])[0];

    // Mix assistencial (% por tipo)
    const mixAssistencial = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, qty]) => ({
        type,
        label: getProductionTypeLabel(type),
        quantity: qty,
        percentage: totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0,
        icon: getProductionTypeIcon(type),
      }));

    return {
      totalQuantity,
      topUnit: topUnit ? {
        name: formatUnitName(topUnit[0]),
        quantity: topUnit[1],
        percentage: totalQuantity > 0 ? (topUnit[1] / totalQuantity) * 100 : 0,
      } : null,
      topConvenio: topConvenio ? {
        name: topConvenio[0],
        quantity: topConvenio[1],
        percentage: totalQuantity > 0 ? (topConvenio[1] / totalQuantity) * 100 : 0,
      } : null,
      mixAssistencial,
    };
  }, [filteredProductions, totalQuantity]);

  // Ranking por unidade
  const unitRanking: UnitRanking[] = useMemo(() => {
    const byUnit: Record<string, number> = {};
    filteredProductions.forEach((p) => {
      byUnit[p.unit] = (byUnit[p.unit] || 0) + p.quantity;
    });

    return Object.entries(byUnit)
      .sort((a, b) => b[1] - a[1])
      .map(([unit, qty]) => {
        const prevQty = previousByUnit[unit] || 0;
        const variation = prevQty > 0 ? ((qty - prevQty) / prevQty) * 100 : null;
        return {
          name: formatUnitName(unit),
          quantity: qty,
          percentage: totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0,
          variation,
        };
      });
  }, [filteredProductions, totalQuantity, previousByUnit]);

  // Ranking por especialidade (CORREÇÃO: apenas especialidades reais, sem fallback para unit)
  const specialtyRanking: SpecialtyRanking[] = useMemo(() => {
    const bySpecialty: Record<string, number> = {};
    
    filteredProductions.forEach((p) => {
      // CORREÇÃO: NÃO usar unit como fallback - agrupar em "Sem especialidade"
      const spec = (p.specialty && p.specialty.trim() !== "") 
        ? p.specialty 
        : "__SEM_ESPECIALIDADE__";
      bySpecialty[spec] = (bySpecialty[spec] || 0) + p.quantity;
    });

    return Object.entries(bySpecialty)
      .sort((a, b) => {
        // "Sem especialidade" sempre por último
        if (a[0] === "__SEM_ESPECIALIDADE__") return 1;
        if (b[0] === "__SEM_ESPECIALIDADE__") return -1;
        return b[1] - a[1];
      })
      .map(([specialty, qty]) => {
        const percentage = totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0;
        let concentrationLevel: "alta" | "ok" | "baixa" = "ok";
        if (percentage > 70) concentrationLevel = "alta";
        else if (percentage < 10) concentrationLevel = "baixa";
        
        // CORREÇÃO: usar formatSpecialtyDisplayName para labels bonitos
        const displayName = specialty === "__SEM_ESPECIALIDADE__" 
          ? "Sem especialidade"
          : formatSpecialtyDisplayName(specialty);
        
        return {
          name: displayName,
          quantity: qty,
          percentage,
          concentrationLevel,
        };
      });
  }, [filteredProductions, totalQuantity]);

  // Breakdown por tipo assistencial
  const typeBreakdown: TypeBreakdown[] = useMemo(() => {
    return strategicKPIs.mixAssistencial;
  }, [strategicKPIs.mixAssistencial]);

  // Ranking por convênio com análise de risco
  const convenioRanking: ConvenioRanking[] = useMemo(() => {
    const byConvenio: Record<string, number> = {};
    filteredProductions.forEach((p) => {
      const conv = p.convenio || "PARTICULAR";
      byConvenio[conv] = (byConvenio[conv] || 0) + p.quantity;
    });

    return Object.entries(byConvenio)
      .sort((a, b) => b[1] - a[1])
      .map(([convenio, qty]) => {
        const percentage = totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0;
        let riskLevel: "alto" | "medio" | "baixo" = "baixo";
        let riskText = "Concentração saudável";

        if (percentage > 60) {
          riskLevel = "alto";
          riskText = "Alta dependência — considerar diversificação";
        } else if (percentage > 40) {
          riskLevel = "medio";
          riskText = "Concentração moderada";
        }

        return {
          name: formatConvenioDisplayName(convenio),
          quantity: qty,
          percentage,
          riskLevel,
          riskText,
        };
      });
  }, [filteredProductions, totalQuantity]);

  // Top 10 procedimentos/exames
  const topProcedures: TopProcedure[] = useMemo(() => {
    const byProcedure: Record<string, { quantity: number; code?: string }> = {};
    filteredProductions.forEach((p) => {
      const key = p.description;
      if (!byProcedure[key]) {
        byProcedure[key] = { quantity: 0, code: p.procedureCode };
      }
      byProcedure[key].quantity += p.quantity;
    });

    const sorted = Object.entries(byProcedure)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10);

    let cumulative = 0;
    return sorted.map(([name, data]) => {
      const percentage = totalQuantity > 0 ? (data.quantity / totalQuantity) * 100 : 0;
      cumulative += percentage;
      return {
        name,
        code: data.code,
        quantity: data.quantity,
        percentage,
        cumulativePercentage: cumulative,
      };
    });
  }, [filteredProductions, totalQuantity]);

  // Análise Pareto 80/20
  const paretoAnalysis = useMemo(() => {
    // Por convênio
    let cumulativeConvenio = 0;
    let conveniosFor80 = 0;
    for (const conv of convenioRanking) {
      cumulativeConvenio += conv.percentage;
      conveniosFor80++;
      if (cumulativeConvenio >= 80) break;
    }

    // Por procedimento
    const procedureFor80 = topProcedures.findIndex(p => p.cumulativePercentage >= 80) + 1;

    return {
      conveniosFor80,
      totalConvenios: convenioRanking.length,
      proceduresFor80: procedureFor80 || topProcedures.length,
      totalProcedures: topProcedures.length,
      riskText: conveniosFor80 <= 2 
        ? "Risco de dependência: poucos convênios concentram 80% da produção"
        : "Boa diversificação: produção distribuída entre múltiplos convênios",
      opportunityText: procedureFor80 <= 3
        ? "Oportunidade de diversificação: poucos procedimentos dominam a produção"
        : "Mix assistencial equilibrado",
    };
  }, [convenioRanking, topProcedures]);

  // Evolução no tempo (time series)
  const evolutionData: TimeSeriesData[] = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const useWeekly = evolutionGranularity === "weekly" || periodDays > 60;

    if (useWeekly) {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekProductions = filteredProductions.filter(p => {
          const prodDate = parseISO(p.productionDate);
          return isWithinInterval(prodDate, { start: weekStart, end: weekEnd });
        });

        const dataPoint: TimeSeriesData = {
          date: format(weekStart, "yyyy-MM-dd"),
          dateLabel: `${format(weekStart, "dd/MM")} - ${format(weekEnd, "dd/MM")}`,
          total: weekProductions.reduce((sum, p) => sum + p.quantity, 0),
        };

        if (evolutionBreakdown === "unidade") {
          uniqueUnits.forEach(unit => {
            dataPoint[formatUnitName(unit)] = weekProductions
              .filter(p => p.unit === unit)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        } else if (evolutionBreakdown === "convenio") {
          uniqueConvenios.forEach(conv => {
            dataPoint[conv] = weekProductions
              .filter(p => p.convenio === conv)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        } else if (evolutionBreakdown === "especialidade") {
          uniqueSpecialties.forEach(spec => {
            dataPoint[formatUnitName(spec)] = weekProductions
              .filter(p => (p.specialty || p.unit) === spec)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        }

        return dataPoint;
      });
    } else {
      const days = eachDayOfInterval({ start, end });
      return days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayProductions = filteredProductions.filter(p => p.productionDate === dayStr);

        const dataPoint: TimeSeriesData = {
          date: dayStr,
          dateLabel: format(day, "dd/MM"),
          total: dayProductions.reduce((sum, p) => sum + p.quantity, 0),
        };

        if (evolutionBreakdown === "unidade") {
          uniqueUnits.forEach(unit => {
            dataPoint[formatUnitName(unit)] = dayProductions
              .filter(p => p.unit === unit)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        } else if (evolutionBreakdown === "convenio") {
          uniqueConvenios.forEach(conv => {
            dataPoint[conv] = dayProductions
              .filter(p => p.convenio === conv)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        } else if (evolutionBreakdown === "especialidade") {
          uniqueSpecialties.forEach(spec => {
            dataPoint[formatUnitName(spec)] = dayProductions
              .filter(p => (p.specialty || p.unit) === spec)
              .reduce((sum, p) => sum + p.quantity, 0);
          });
        }

        return dataPoint;
      });
    }
  }, [filteredProductions, startDate, endDate, periodDays, evolutionGranularity, evolutionBreakdown, uniqueUnits, uniqueConvenios, uniqueSpecialties]);

  // Cores para o gráfico
  const chartColors = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#06b6d4", "#84cc16"];

  // Alertas gerenciais interpretativos (melhorados)
  const managementAlerts: ManagementAlert[] = useMemo(() => {
    const alerts: ManagementAlert[] = [];

    // Concentração em convênio (>60%)
    const topConvenio = convenioRanking[0];
    if (topConvenio && topConvenio.percentage > 60) {
      alerts.push({
        type: "concentration",
        severity: "warning",
        message: `Concentração em ${topConvenio.name}: ${topConvenio.percentage.toFixed(0)}%`,
        interpretation: "A dependência de um único convênio representa risco de receita. Recomenda-se estratégia de diversificação.",
      });
    }

    // Especialidade concentrada (>70%)
    const topSpecialty = specialtyRanking[0];
    if (topSpecialty && topSpecialty.percentage > 70) {
      alerts.push({
        type: "specialty",
        severity: "warning",
        message: `Especialidade concentrada: ${topSpecialty.name} (${topSpecialty.percentage.toFixed(0)}%)`,
        interpretation: "Alta concentração em uma única especialidade. Considere expandir outras áreas.",
      });
    }

    // Produção não faturada (visão macro)
    const unbilledCount = filteredProductions.filter(p => p.status === "PRODUZIDO").length;
    const unbilledQty = filteredProductions
      .filter(p => p.status === "PRODUZIDO")
      .reduce((sum, p) => sum + p.quantity, 0);
    if (unbilledCount > 0) {
      alerts.push({
        type: "unbilled",
        severity: "info",
        message: `${unbilledQty.toLocaleString("pt-BR")} itens ainda não faturados`,
        interpretation: "Produção registrada aguardando envio para faturamento.",
        actionable: true,
        actionLabel: "Ver Faturamento Sugerido",
      });
    }

    // Queda vs período anterior (> -10%)
    if (variationData.hasData && variationData.percent < -10) {
      alerts.push({
        type: "drop",
        severity: "error",
        message: `Queda de ${Math.abs(variationData.percent).toFixed(0)}% vs período anterior`,
        interpretation: "Redução significativa na produção. Investigar causas: agenda, sazonalidade ou demanda.",
      });
    }

    // Variação significativa positiva
    if (variationData.hasData && variationData.percent >= 15) {
      alerts.push({
        type: "trend",
        severity: "info",
        message: `Crescimento de ${variationData.percent.toFixed(0)}% vs período anterior`,
        interpretation: "Aumento expressivo na produção. Avaliar impacto na capacidade operacional e faturamento.",
      });
    }

    return alerts;
  }, [convenioRanking, specialtyRanking, filteredProductions, variationData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VISÃO POR COMPONENTES: Transformar produções em ReportItems
  // ═══════════════════════════════════════════════════════════════════════════
  const reportItems = useMemo(() => {
    return toReportItems(filteredProductions);
  }, [filteredProductions]);

  // Calcular totalAmount para % por valor
  const totalAmount = useMemo(() => {
    return reportItems.reduce((sum, item) => sum + item.amount, 0);
  }, [reportItems]);

  // Tabela consolidada por componentes (sem PACOTE_BOX/PACOTE_GTA)
  const consolidatedTable: AggregatedRow[] = useMemo(() => {
    const aggregation: Record<string, AggregatedRow> = {};

    reportItems.forEach((item) => {
      const specialty = (item.specialty && item.specialty.trim() !== "") ? item.specialty : "";
      const key = `${item.reportType}|${item.unit}|${item.convenio}|${specialty}`;

      if (!aggregation[key]) {
        aggregation[key] = {
          reportType: item.reportType,
          unit: item.unit,
          convenio: item.convenio,
          specialty,
          quantity: 0,
          amount: 0,
          percentage: 0,
          items: [],
        };
      }

      aggregation[key].quantity += item.quantity;
      aggregation[key].amount += item.amount;
      aggregation[key].items.push(item);
    });

    return Object.values(aggregation)
      .map((row) => ({
        ...row,
        percentage: totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [reportItems, totalAmount]);

  // Tipos únicos de produção
  const uniqueProductionTypes = useMemo(() => {
    const types = new Set<string>();
    productions.forEach((p) => types.add(p.productionType));
    return Array.from(types).sort();
  }, [productions]);

  // Período formatado
  const formattedPeriod = `${format(parseISO(startDate), "dd/MM/yyyy", { locale: ptBR })} a ${format(parseISO(endDate), "dd/MM/yyyy", { locale: ptBR })}`;
  const previousFormattedPeriod = useMemo(() => {
    const start = parseISO(startDate);
    const previousEnd = subDays(start, 1);
    const previousStart = subDays(previousEnd, periodDays - 1);
    return `${format(previousStart, "dd/MM/yyyy", { locale: ptBR })} a ${format(previousEnd, "dd/MM/yyyy", { locale: ptBR })}`;
  }, [startDate, periodDays]);

  // Handlers
  const handleOpenDrilldown = useCallback((title: string, items: ReportItem[]) => {
    setDrilldownData({ title, items });
    setDrilldownOpen(true);
  }, []);

  const handleSpecialtyFilter = useCallback((specialty: string) => {
    setSelectedSpecialty(specialty === selectedSpecialty ? "all" : specialty);
  }, [selectedSpecialty]);

  const handleExportCSV = useCallback(() => {
    const headers = ["Tipo", "Unidade", "Especialidade", "Convênio", "Qtd", "Valor (R$)", "% Valor", "Origem"];
    const rows = consolidatedTable.flatMap(row => 
      row.items.map(item => [
        getProductionTypeLabel(item.reportType),
        formatUnitName(item.unit),
        item.specialty ? formatSpecialtyDisplayName(item.specialty) : "Sem especialidade",
        formatConvenioDisplayName(item.convenio),
        item.reportType === "MAT_MED" ? "—" : item.quantity,
        item.amount.toFixed(2),
        totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(2) : "0",
        item.isFromPackage ? "PACOTE" : "AVULSO",
      ])
    );
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-producao-componentes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  }, [consolidatedTable, totalAmount]);

  // Check if specialty field exists (real specialties, not unit fallback)
  const hasRealSpecialty = useMemo(() => {
    return productions.some(p => p.specialty && p.specialty.trim() !== "");
  }, [productions]);

  // Top procedure for executive summary
  const topProcedure = topProcedures[0];
  
  // Small sample check
  const isSmallSample = previousTotalQuantity > 0 && previousTotalQuantity < 10;
  
  // Unbilled count for secondary alert
  const unbilledCount = filteredProductions.filter(p => p.status === "PRODUZIDO").length;
  const unbilledQty = filteredProductions
    .filter(p => p.status === "PRODUZIDO")
    .reduce((sum, p) => sum + p.quantity, 0);
  
  // Alerts without unbilled (production-focused)
  const productionAlerts = managementAlerts.filter(a => a.type !== "unbilled");
  const unbilledAlert = managementAlerts.find(a => a.type === "unbilled");
  
  // Unbilled productions for export
  const unbilledProductions = useMemo(() => {
    return filteredProductions.filter(p => p.status === "PRODUZIDO");
  }, [filteredProductions]);

  // Export data aggregated from all existing calculations
  const exportData: ProductionReportExportData = useMemo(() => ({
    // Metadata
    startDate,
    endDate,
    selectedUnit,
    selectedConvenio,
    selectedType,
    selectedSpecialty,
    
    // Core data
    totalQuantity,
    previousTotalQuantity,
    variationPercent: variationData.percent,
    variationAbsolute: variationData.absolute,
    isSmallSample,
    
    // Rankings
    unitRanking,
    specialtyRanking: specialtyRanking.map(s => ({ name: s.name, quantity: s.quantity, percentage: s.percentage })),
    typeBreakdown,
    convenioRanking: convenioRanking.map(c => ({ name: c.name, quantity: c.quantity, percentage: c.percentage, riskLevel: c.riskLevel })),
    topProcedures: topProcedures.map(p => ({ name: p.name, code: p.code, quantity: p.quantity, percentage: p.percentage })),
    
    // Time series
    evolutionData: evolutionData.map(e => ({ date: e.date, dateLabel: e.dateLabel, total: e.total })),
    
    // Consolidated table
    consolidatedTable: consolidatedTable.map(c => ({
      productionType: c.reportType,
      unit: c.unit,
      specialty: c.specialty,
      convenio: c.convenio,
      quantity: c.quantity,
      percentage: c.percentage,
    })),
    
    // Unbilled
    unbilledProductions,
    
    // Highlights
    topUnit: strategicKPIs.topUnit,
    topConvenio: strategicKPIs.topConvenio,
    topProcedure: topProcedure ? { name: topProcedure.name, quantity: topProcedure.quantity, percentage: topProcedure.percentage } : null,
  }), [
    startDate, endDate, selectedUnit, selectedConvenio, selectedType, selectedSpecialty,
    totalQuantity, previousTotalQuantity, variationData, isSmallSample,
    unitRanking, specialtyRanking, typeBreakdown, convenioRanking, topProcedures,
    evolutionData, consolidatedTable, unbilledProductions, strategicKPIs, topProcedure
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        
        {/* ══════════════════════════════════════════════════════════════════
            1️⃣ HEADER PREMIUM
        ══════════════════════════════════════════════════════════════════ */}
        <header className="border-b border-border/50 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl shadow-sm">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Relatório Gerencial de Produção
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Análise estratégica e operacional da produção assistencial
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ProductionReportExport data={exportData} />
              <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                Visão Gerencial
              </Badge>
            </div>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════════════
            2️⃣ FILTROS (LOGO ABAIXO DO HEADER)
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-muted/30 rounded-2xl p-5 border border-border/50">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Fim</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Unidade</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="h-9 text-sm bg-background">
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Convênio</Label>
                <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueConvenios.map((convenio) => (
                      <SelectItem key={convenio} value={convenio}>
                        {formatConvenioDisplayName(convenio)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueProductionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getProductionTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Especialidade
                </Label>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueSpecialties.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec === "__SEM_ESPECIALIDADE__" ? "Sem especialidade" : formatSpecialtyDisplayName(spec)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Período: {formattedPeriod}</span>
                <span className="mx-2">•</span>
                <span>{periodDays} dias</span>
              </div>
              <span className="opacity-70">Atualizado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            2.5️⃣ CONSOLIDADO POR COMPONENTES (AVULSO + PACOTES)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Consolidado por Componentes</h2>
            <Badge variant="outline" className="text-[10px] px-1.5">Avulso + Pacotes</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Consultas */}
            <Card className="shadow-sm border-border/60 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Consultas
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
                      {(() => {
                        const stats = (() => {
                          const filtered = filteredProductions;
                          let value = 0;
                          let quantity = 0;
                          filtered.forEach((p) => {
                            const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
                            if (isPackage) {
                              value += p.consultAmount || 0;
                              quantity += 1;
                            } else if (p.productionType === "CONSULTA") {
                              value += p.estimatedValue;
                              quantity += p.quantity;
                            }
                          });
                          return { value, quantity };
                        })();
                        return stats.quantity.toLocaleString("pt-BR");
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(() => {
                        const filtered = filteredProductions;
                        let value = 0;
                        filtered.forEach((p) => {
                          const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
                          if (isPackage) {
                            value += p.consultAmount || 0;
                          } else if (p.productionType === "CONSULTA") {
                            value += p.estimatedValue;
                          }
                        });
                        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
                      })()}
                    </p>
                  </div>
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Avulso CONSULTA + Pacotes (consult_amount)
                </p>
              </CardContent>
            </Card>

            {/* Box/Taxas */}
            <Card className="shadow-sm border-border/60 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Box / Taxas
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
                      {(() => {
                        const filtered = filteredProductions;
                        let quantity = 0;
                        filtered.forEach((p) => {
                          const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
                          if (isPackage) {
                            quantity += 1;
                          } else if (p.productionType === "BOX_PS") {
                            quantity += p.quantity;
                          }
                        });
                        return quantity.toLocaleString("pt-BR");
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(() => {
                        const filtered = filteredProductions;
                        let value = 0;
                        filtered.forEach((p) => {
                          const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
                          if (isPackage) {
                            value += p.feeAmount || 0;
                          } else if (p.productionType === "BOX_PS") {
                            value += p.estimatedValue;
                          }
                        });
                        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
                      })()}
                    </p>
                  </div>
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                    <Heart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Avulso BOX_PS + Pacotes (fee_amount)
                </p>
              </CardContent>
            </Card>

            {/* Mat/Med */}
            <Card className="shadow-sm border-border/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Mat/Med
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
                      {(() => {
                        const filtered = filteredProductions;
                        let value = 0;
                        filtered.forEach((p) => {
                          const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
                          if (isPackage) {
                            value += p.matmedAmount || 0;
                          }
                        });
                        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
                      })()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Somente valor (sem quantidade)
                    </p>
                  </div>
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <Syringe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Pacotes (matmed_amount)
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            3️⃣ RESUMO EXECUTIVO (NOVO - TEXTO AUTOMÁTICO)
        ══════════════════════════════════════════════════════════════════ */}
        {totalQuantity > 0 && (
          <section className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent rounded-xl px-5 py-4 border border-primary/10">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground/90 leading-relaxed">
                <span>No período, foram registradas </span>
                <span className="font-semibold text-foreground">{totalQuantity.toLocaleString("pt-BR")} produções</span>
                {variationData.hasData && variationData.percent !== 0 && (
                  <>
                    <span>. Variação vs período anterior: </span>
                    <span className={`font-semibold ${variationData.percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {variationData.percent >= 0 ? "+" : ""}{variationData.percent.toFixed(0)}%
                    </span>
                    {isSmallSample && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 align-middle">
                        Amostra pequena
                      </Badge>
                    )}
                  </>
                )}
                {strategicKPIs.topUnit && (
                  <>
                    <span>. Unidade destaque: </span>
                    <span className="font-semibold text-foreground">{strategicKPIs.topUnit.name}</span>
                    <span className="text-muted-foreground"> ({strategicKPIs.topUnit.percentage.toFixed(0)}%)</span>
                  </>
                )}
                {strategicKPIs.topConvenio && (
                  <>
                    <span>. Convênio principal: </span>
                    <span className="font-semibold text-foreground">{strategicKPIs.topConvenio.name}</span>
                  </>
                )}
                {topProcedure && (
                  <>
                    <span>. Top procedimento: </span>
                    <span className="font-semibold text-foreground truncate">{topProcedure.name}</span>
                  </>
                )}
                <span>.</span>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            4️⃣ KPIs ESTRATÉGICOS (CARDS PRINCIPAIS - 4 CARDS)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Produção Total */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Produção Total
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                      {totalQuantity.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredProductions.length.toLocaleString("pt-BR")} registros
                    </p>
                  </div>
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variação vs Anterior */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Variação vs Anterior
                    </p>
                    {variationData.hasData ? (
                      <>
                        <div className="flex items-center gap-2 mt-2">
                          <p className={`text-3xl font-bold tabular-nums ${
                            variationData.percent >= 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {variationData.percent >= 0 ? "+" : ""}{variationData.percent.toFixed(0)}%
                          </p>
                          {isSmallSample && (
                            <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Amostra pequena
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {variationData.percent >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          {variationData.absolute >= 0 ? "+" : ""}{variationData.absolute.toLocaleString("pt-BR")} itens
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mt-2">
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Sem dados</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Período anterior sem produção
                        </p>
                      </>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-xl ${
                    variationData.hasData && variationData.percent >= 0 
                      ? "bg-green-100 dark:bg-green-900/30" 
                      : variationData.hasData 
                        ? "bg-red-100 dark:bg-red-900/30"
                        : "bg-muted"
                  }`}>
                    {variationData.hasData && variationData.percent >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : variationData.hasData ? (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    ) : (
                      <Minus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unidade Destaque */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Unidade Destaque
                    </p>
                    {strategicKPIs.topUnit ? (
                      <>
                        <p className="text-xl font-bold text-foreground mt-2 truncate">
                          {strategicKPIs.topUnit.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {strategicKPIs.topUnit.percentage.toFixed(0)}% ({strategicKPIs.topUnit.quantity.toLocaleString("pt-BR")} itens)
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">Sem dados</p>
                    )}
                  </div>
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl flex-shrink-0">
                    <Building2 className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Convênio Principal */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Convênio Principal
                    </p>
                    {strategicKPIs.topConvenio ? (
                      <>
                        <p className="text-xl font-bold text-foreground mt-2 truncate">
                          {strategicKPIs.topConvenio.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {strategicKPIs.topConvenio.percentage.toFixed(0)}% ({strategicKPIs.topConvenio.quantity.toLocaleString("pt-BR")} itens)
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">Sem dados</p>
                    )}
                  </div>
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex-shrink-0">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            5️⃣ ALERTAS GERENCIAIS (SOMENTE PRODUÇÃO)
        ══════════════════════════════════════════════════════════════════ */}
        {productionAlerts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Alertas de Produção</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {productionAlerts.map((alert, idx) => (
                <Alert 
                  key={idx} 
                  className={`${
                    alert.severity === "error" 
                      ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" 
                      : alert.severity === "warning" 
                        ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20" 
                        : "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {alert.type === "concentration" && <PieChart className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />}
                    {alert.type === "specialty" && <Award className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />}
                    {alert.type === "drop" && <TrendDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />}
                    {alert.type === "trend" && <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />}
                    <AlertDescription className="flex-1">
                      <span className="font-semibold text-sm">{alert.message}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{alert.interpretation}</span>
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            6️⃣ PENDÊNCIAS OPERACIONAIS (FATURAMENTO SECUNDÁRIO)
        ══════════════════════════════════════════════════════════════════ */}
        {unbilledCount > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileWarning className="h-4 w-4" />
              <span>Pendências Operacionais</span>
            </div>
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100/80 dark:bg-amber-900/30 rounded-lg">
                      <FileText className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Produção pendente de fechamento
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {unbilledQty.toLocaleString("pt-BR")} itens aguardando envio para faturamento
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={() => {
                        const unbilledItems = toReportItems(filteredProductions.filter(p => p.status === "PRODUZIDO"));
                        handleOpenDrilldown("Itens pendentes de faturamento", unbilledItems);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1.5" />
                      Ver Detalhes
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-8 text-muted-foreground"
                      onClick={() => window.location.href = "/suggested-billing"}
                    >
                      Faturamento Sugerido
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/30">
                  Ação operacional (fora do relatório de produção)
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Painel de Itens Não Faturados (mantido mas agora após alertas) */}
        <section>
          <UnbilledItemsPanel productions={filteredProductions} />
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            4️⃣ EVOLUÇÃO NO TEMPO (NOVO - PREMIUM)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-primary" />
                    Evolução no Tempo
                    {totalQuantity < 50 && totalQuantity > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Amostra pequena
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Histórico de produção {totalQuantity < 50 ? "(semanal - amostra pequena)" : periodDays > 60 ? "(semanal)" : evolutionGranularity === "weekly" ? "(semanal)" : "(diário)"}
                    {variationData.hasData && previousTotalQuantity < 10 && previousTotalQuantity > 0 && (
                      <span className="text-amber-600 ml-2">• Período anterior com poucos dados</span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={totalQuantity < 50 ? "weekly" : evolutionGranularity} onValueChange={(v) => setEvolutionGranularity(v as "daily" | "weekly")}>
                    <TabsList className="h-8">
                      <TabsTrigger value="daily" className="text-xs px-3" disabled={periodDays > 60 || totalQuantity < 50}>
                        Diário
                      </TabsTrigger>
                      <TabsTrigger value="weekly" className="text-xs px-3">
                        Semanal
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select value={evolutionBreakdown} onValueChange={(v) => setEvolutionBreakdown(v as typeof evolutionBreakdown)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="unidade">Por Unidade</SelectItem>
                      <SelectItem value="convenio">Por Convênio</SelectItem>
                      <SelectItem value="especialidade">Por Especialidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {evolutionData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados para o período selecionado
                </div>
              ) : totalQuantity < 50 && evolutionBreakdown === "geral" ? (
                /* Use bar chart for small samples */
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="dateLabel" 
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px"
                        }}
                        formatter={(value: number) => [
                          `${value.toLocaleString("pt-BR")}`,
                          "Quantidade"
                        ]}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        name="Total"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLine data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="dateLabel" 
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px"
                        }}
                        formatter={(value: number, name: string) => [
                          `${value.toLocaleString("pt-BR")} (${totalQuantity > 0 ? ((value / totalQuantity) * 100).toFixed(1) : 0}%)`,
                          name
                        ]}
                      />
                      {evolutionBreakdown === "geral" ? (
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          name="Total"
                        />
                      ) : evolutionBreakdown === "unidade" ? (
                        uniqueUnits.map((unit, idx) => (
                          <Line 
                            key={unit}
                            type="monotone" 
                            dataKey={formatUnitName(unit)} 
                            stroke={chartColors[idx % chartColors.length]}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            name={formatUnitName(unit)}
                          />
                        ))
                      ) : evolutionBreakdown === "convenio" ? (
                        uniqueConvenios.slice(0, 5).map((conv, idx) => (
                          <Line 
                            key={conv}
                            type="monotone" 
                            dataKey={conv} 
                            stroke={chartColors[idx % chartColors.length]}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            name={conv}
                          />
                        ))
                      ) : (
                        uniqueSpecialties.filter(s => s !== "__SEM_ESPECIALIDADE__").slice(0, 5).map((spec, idx) => {
                          const displayName = formatSpecialtyDisplayName(spec);
                          return (
                            <Line 
                              key={spec}
                              type="monotone" 
                              dataKey={displayName} 
                              stroke={chartColors[idx % chartColors.length]}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              name={displayName}
                            />
                          );
                        })
                      )}
                      {evolutionBreakdown !== "geral" && <Legend />}
                    </RechartsLine>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            5️⃣ ANÁLISES CONSOLIDADAS (BLOCOS) - COM ESPECIALIDADE
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <Layers className="h-4 w-4" />
            <span>Análises Consolidadas</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Produção por Unidade */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  Produção por Unidade
                </CardTitle>
                <CardDescription className="text-xs">
                  Ranking e participação percentual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {unitRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  unitRanking.map((unit, idx) => (
                    <div key={unit.name} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="text-sm font-medium truncate max-w-[140px]">{unit.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {unit.quantity.toLocaleString("pt-BR")}
                        </Badge>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {unit.percentage.toFixed(0)}%
                        </span>
                        {unit.variation !== null && (
                          <Badge variant={unit.variation >= 0 ? "default" : "destructive"} className="text-xs w-14 justify-center">
                            {unit.variation >= 0 ? "↑" : "↓"}{Math.abs(unit.variation).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* NOVO: Produção por Especialidade */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-600" />
                  Produção por Especialidade
                  {!hasRealSpecialty && (
                    <Badge variant="outline" className="text-[10px] ml-1">proxy</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Clique para filtrar • {hasRealSpecialty ? "Campo especialidade" : "Usando unidade como proxy"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {specialtyRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  specialtyRanking.map((spec, idx) => {
                    // Find the original specialty value to use for filtering
                    const originalSpecValue = spec.name === "Sem especialidade" 
                      ? "__SEM_ESPECIALIDADE__"
                      : uniqueSpecialties.find(s => s !== "__SEM_ESPECIALIDADE__" && formatSpecialtyDisplayName(s) === spec.name) || "";
                    
                    return (
                      <div 
                        key={spec.name} 
                        className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                          selectedSpecialty === originalSpecValue
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleSpecialtyFilter(originalSpecValue)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[140px]">{spec.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {spec.quantity.toLocaleString("pt-BR")}
                          </Badge>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {spec.percentage.toFixed(0)}%
                          </span>
                          <Badge 
                            variant={spec.concentrationLevel === "alta" ? "destructive" : spec.concentrationLevel === "baixa" ? "outline" : "default"}
                            className="text-xs w-12 justify-center"
                          >
                            {spec.concentrationLevel === "alta" ? "Alta" : spec.concentrationLevel === "baixa" ? "Baixa" : "OK"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Mix Assistencial */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Mix Assistencial
                </CardTitle>
                <CardDescription className="text-xs">
                  Composição por tipo de produção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {typeBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  typeBreakdown.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.type} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {item.quantity.toLocaleString("pt-BR")}
                          </Badge>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {item.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Concentração por Convênio */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-600" />
                  Concentração por Convênio
                </CardTitle>
                <CardDescription className="text-xs">
                  Análise de risco e dependência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {convenioRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  convenioRanking.slice(0, 5).map((conv, idx) => (
                    <div key={conv.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[120px]">{conv.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {conv.percentage.toFixed(0)}%
                          </span>
                          <Badge 
                            variant={conv.riskLevel === "alto" ? "destructive" : conv.riskLevel === "medio" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {conv.riskLevel === "alto" ? "Alto" : conv.riskLevel === "medio" ? "Médio" : "OK"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">{conv.riskText}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            5.5️⃣ NOVA SEÇÃO: DETALHAMENTO POR PROCEDIMENTOS (DRILLDOWN)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          {filteredProductions.length > 0 ? (
            <ProceduresDetailPanel
              productions={filteredProductions}
              startDate={startDate}
              endDate={endDate}
            />
          ) : null}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            6️⃣ TOP PROCEDIMENTOS E MAPA DE CONCENTRAÇÃO (PARETO)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 Procedimentos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Top 10 Procedimentos/Exames
                </CardTitle>
                <CardDescription className="text-xs">
                  Procedimentos mais realizados no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    {topProcedures.map((proc, idx) => (
                      <div key={proc.name} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-medium text-muted-foreground w-5 flex-shrink-0">{idx + 1}.</span>
                          <span className="text-xs truncate" title={proc.name}>{proc.name}</span>
                          {proc.code && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">{proc.code}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-medium">{proc.quantity.toLocaleString("pt-BR")}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {proc.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mapa de Concentração (Pareto 80/20) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-orange-600" />
                  Mapa de Concentração (Pareto)
                </CardTitle>
                <CardDescription className="text-xs">
                  Análise 80/20 de convênios e procedimentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Convênios</span>
                    <Badge variant="secondary" className="text-xs">
                      {paretoAnalysis.conveniosFor80} de {paretoAnalysis.totalConvenios}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{paretoAnalysis.conveniosFor80} convênio(s)</span> representam 80% da produção
                  </p>
                  <div className="mt-2 flex items-start gap-2">
                    <AlertCircle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${paretoAnalysis.conveniosFor80 <= 2 ? "text-amber-500" : "text-green-500"}`} />
                    <p className="text-xs text-muted-foreground">{paretoAnalysis.riskText}</p>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Procedimentos</span>
                    <Badge variant="secondary" className="text-xs">
                      {paretoAnalysis.proceduresFor80} de {paretoAnalysis.totalProcedures}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{paretoAnalysis.proceduresFor80} procedimento(s)</span> representam 80% da produção
                  </p>
                  <div className="mt-2 flex items-start gap-2">
                    <AlertCircle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${paretoAnalysis.proceduresFor80 <= 3 ? "text-amber-500" : "text-green-500"}`} />
                    <p className="text-xs text-muted-foreground">{paretoAnalysis.opportunityText}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            7️⃣ TABELA GERENCIAL CONSOLIDADA (COM DRILLDOWN E EXPORT)
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Tabela Consolidada por Componentes
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Visão unificada: pacotes explodidos em Consulta + Box + Mat/Med, somados com avulsos
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {consolidatedTable.length} registros
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={handleExportCSV}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {consolidatedTable.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma produção encontrada no período selecionado.</p>
                </div>
              ) : (
                <div className="relative overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Componente</TableHead>
                        <TableHead className="font-semibold">Unidade</TableHead>
                        <TableHead className="font-semibold">
                          Especialidade {!hasRealSpecialty && <span className="text-muted-foreground text-[10px]">(proxy)</span>}
                        </TableHead>
                        <TableHead className="font-semibold">Convênio</TableHead>
                        <TableHead className="text-right font-semibold">Qtd</TableHead>
                        <TableHead className="text-right font-semibold">Valor</TableHead>
                        <TableHead className="text-right font-semibold">%</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedTable.slice(0, 20).map((row, idx) => {
                        const Icon = getProductionTypeIcon(row.reportType);
                        return (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs">{getProductionTypeLabel(row.reportType)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{formatUnitName(row.unit)}</TableCell>
                            <TableCell className="text-xs">{row.specialty ? formatSpecialtyDisplayName(row.specialty) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={row.convenio === "PARTICULAR" ? "secondary" : "outline"} className="text-xs">
                                {formatConvenioDisplayName(row.convenio)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs">
                              {row.reportType === "MAT_MED" ? "—" : row.quantity.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.amount)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <span className="text-muted-foreground">{row.percentage.toFixed(1)}%</span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleOpenDrilldown(
                                  `${getProductionTypeLabel(row.reportType)} - ${formatUnitName(row.unit)} - ${row.convenio}`,
                                  row.items
                                )}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/70 font-semibold">
                        <TableCell colSpan={4}>Total Geral</TableCell>
                        <TableCell className="text-right">
                          {reportItems.filter(i => i.reportType !== "MAT_MED").reduce((s, i) => s + i.quantity, 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-lg font-semibold tabular-nums">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
              {consolidatedTable.length > 20 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Exibindo 20 de {consolidatedTable.length} registros. Exporte para ver todos.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            8️⃣ LEITURA EXECUTIVA & PRÓXIMAS AÇÕES
        ══════════════════════════════════════════════════════════════════ */}
        <section>
          <Card className="bg-gradient-to-br from-primary/5 via-transparent to-muted/30 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Leitura Executiva</CardTitle>
                  <CardDescription className="text-xs">Síntese automática baseada nos dados filtrados</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Síntese Textual Automática */}
              <div className="bg-background/80 backdrop-blur rounded-lg p-4 border border-border/50">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {(() => {
                    const topConv = convenioRanking[0];
                    const topSpec = specialtyRanking[0];
                    const unbilledQty = filteredProductions
                      .filter(p => p.status === "PRODUZIDO")
                      .reduce((sum, p) => sum + p.quantity, 0);
                    
                    const parts: string[] = [];
                    
                    // Volume total e período
                    parts.push(`No período analisado, foram registradas ${totalQuantity.toLocaleString("pt-BR")} produções assistenciais.`);
                    
                    // Variação vs período anterior
                    if (variationData.hasData && variationData.message === null) {
                      if (variationData.percent > 5) {
                        parts.push(`Observa-se crescimento de ${variationData.percent.toFixed(0)}% em relação ao período anterior.`);
                      } else if (variationData.percent < -5) {
                        parts.push(`Houve redução de ${Math.abs(variationData.percent).toFixed(0)}% em relação ao período anterior, o que demanda atenção.`);
                      } else {
                        parts.push(`A produção manteve-se estável em comparação ao período anterior.`);
                      }
                    }
                    
                    // Concentração por convênio
                    if (topConv && topConv.percentage > 50) {
                      parts.push(`Há concentração significativa no convênio ${topConv.name}, responsável por ${topConv.percentage.toFixed(0)}% do volume total.`);
                    } else if (topConv) {
                      parts.push(`A distribuição entre convênios está equilibrada, com ${topConv.name} liderando com ${topConv.percentage.toFixed(0)}%.`);
                    }
                    
                    // Dependência por especialidade/unidade
                    if (topSpec && topSpec.percentage > 60) {
                      parts.push(`A ${topSpec.name} concentra ${topSpec.percentage.toFixed(0)}% da produção, indicando dependência operacional.`);
                    }
                    
                    // Produção não faturada
                    if (unbilledQty > 0) {
                      const unbilledPercent = totalQuantity > 0 ? (unbilledQty / totalQuantity) * 100 : 0;
                      parts.push(`Existem ${unbilledQty.toLocaleString("pt-BR")} itens (${unbilledPercent.toFixed(0)}%) aguardando faturamento.`);
                    }
                    
                    return parts.join(" ");
                  })()}
                </p>
              </div>

              {/* Próximas Ações Recomendadas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Próximas Ações Recomendadas</h4>
                </div>
                <ul className="space-y-2">
                  {(() => {
                    const actions: { icon: React.ReactNode; text: string; priority: "alta" | "media" | "normal" }[] = [];
                    const topConv = convenioRanking[0];
                    const topSpec = specialtyRanking[0];
                    const unbilledQty = filteredProductions
                      .filter(p => p.status === "PRODUZIDO")
                      .reduce((sum, p) => sum + p.quantity, 0);
                    
                    // Ação: Faturamento pendente
                    if (unbilledQty > 0) {
                      actions.push({
                        icon: <FileWarning className="h-3.5 w-3.5 text-amber-600" />,
                        text: `Priorizar faturamento dos ${unbilledQty.toLocaleString("pt-BR")} itens pendentes para evitar perda de receita`,
                        priority: "alta"
                      });
                    }
                    
                    // Ação: Concentração convênio
                    if (topConv && topConv.percentage > 50) {
                      actions.push({
                        icon: <PieChart className="h-3.5 w-3.5 text-blue-600" />,
                        text: `Avaliar estratégia de diversificação de convênios para reduzir dependência de ${topConv.name}`,
                        priority: topConv.percentage > 70 ? "alta" : "media"
                      });
                    }
                    
                    // Ação: Queda de produção
                    if (variationData.hasData && variationData.percent < -10) {
                      actions.push({
                        icon: <TrendDown className="h-3.5 w-3.5 text-red-600" />,
                        text: "Investigar causas da queda na produção: agenda, capacidade operacional ou demanda",
                        priority: "alta"
                      });
                    }
                    
                    // Ação: Concentração especialidade
                    if (topSpec && topSpec.percentage > 60) {
                      actions.push({
                        icon: <Award className="h-3.5 w-3.5 text-purple-600" />,
                        text: `Monitorar risco operacional pela concentração em ${topSpec.name}`,
                        priority: "media"
                      });
                    }
                    
                    // Ações padrão se não houver alertas críticos
                    if (actions.length < 3) {
                      if (!actions.some(a => a.text.includes("Pareto"))) {
                        actions.push({
                          icon: <BarChart3 className="h-3.5 w-3.5 text-primary" />,
                          text: "Analisar distribuição Pareto para identificar oportunidades de otimização do mix",
                          priority: "normal"
                        });
                      }
                      if (!actions.some(a => a.text.includes("tendência"))) {
                        actions.push({
                          icon: <LineChart className="h-3.5 w-3.5 text-emerald-600" />,
                          text: "Acompanhar evolução temporal para antecipar tendências e sazonalidades",
                          priority: "normal"
                        });
                      }
                    }
                    
                    return actions.slice(0, 3).map((action, idx) => (
                      <li 
                        key={idx} 
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          action.priority === "alta" 
                            ? "bg-red-50/50 border-red-200/50 dark:bg-red-950/20 dark:border-red-800/30" 
                            : action.priority === "media"
                              ? "bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-800/30"
                              : "bg-muted/30 border-border/50"
                        }`}
                      >
                        <div className="mt-0.5">{action.icon}</div>
                        <span className="text-sm text-foreground/90">{action.text}</span>
                        {action.priority === "alta" && (
                          <Badge variant="destructive" className="ml-auto text-[10px] h-5">Prioritário</Badge>
                        )}
                      </li>
                    ));
                  })()}
                </ul>
              </div>

              {/* Nota de rodapé do bloco */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground text-center italic">
                  Esta análise é gerada automaticamente com base nos dados filtrados. Não há edição manual.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            9️⃣ RODAPÉ GERENCIAL
        ══════════════════════════════════════════════════════════════════ */}
        <footer className="border-t pt-5 pb-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-center space-y-2">
              <Badge variant="outline" className="text-xs px-3 py-1">
                <BookOpen className="h-3 w-3 mr-1.5" />
                Visão gerencial — não impacta Caixa, DRE ou Score
              </Badge>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Este relatório é exclusivamente gerencial. Utiliza dados consolidados da Produção Assistencial.
              </p>
              <Separator className="max-w-xs mx-auto my-3" />
              <p className="text-xs text-muted-foreground">
                Período analisado: <span className="font-medium">{formattedPeriod}</span>
                {" • "}
                Atualizado em: <span className="font-medium">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </p>
            </div>
          </div>
        </footer>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DRILLDOWN DRAWER
      ══════════════════════════════════════════════════════════════════ */}
      {/* Footer disclaimer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">
          Relatório gerencial de produção (assistencial). Não representa faturamento, caixa ou contas a receber.
        </p>
      </div>

      <Sheet open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">{drilldownData.title}</SheetTitle>
            <SheetDescription className="text-xs">
              Detalhamento dos registros que compõem esta linha ({drilldownData.items.length} itens)
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-140px)] mt-4">
            <div className="space-y-2 pr-4">
              {drilldownData.items.map((item, idx) => (
                <div key={item.id} className="p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        {item.isFromPackage && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/5 border-primary/20">
                            Pacote
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(item.productionDate), "dd/MM/yyyy", { locale: ptBR })}
                        {" • "}
                        {getProductionTypeLabel(item.reportType)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {item.reportType === "MAT_MED" ? "—" : `${item.quantity}x`}
                      </Badge>
                      <span className="text-xs font-medium tabular-nums">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                    {item.convenio && (
                      <Badge variant="outline" className="text-[10px]">{formatConvenioDisplayName(item.convenio)}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

    </DashboardLayout>
  );
}
