import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity,
  Banknote,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  XCircle,
  Clock,
  Target,
  ExternalLink,
  Gauge,
  DollarSign,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Minus,
  User,
  Calendar,
  Building2,
  Users,
  BarChart3,
  Lightbulb,
  Shield,
  TrendingUp as TrendUp,
  Info,
  MessageSquare,
  Download,
  FileDown,
  Loader2,
} from "lucide-react";
import { useProductionDB } from "@/hooks/useProductionDB";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { useWeightedScore } from "@/hooks/useWeightedScore";
import { useAuth } from "@/contexts/AuthContext";
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  parseISO, 
  differenceInDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/utils/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Helper to safely format values, avoiding NaN
const safeFormat = (value: number | undefined | null, fallback = "—"): string => {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  return formatCurrency(value);
};

const safePercent = (value: number | undefined | null, fallback = "—"): string => {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  return `${value.toFixed(1)}%`;
};

export default function ExecutiveReport() {
  const navigate = useNavigate();
  const { productions, getStats: getProductionStats } = useProductionDB();
  const { receivables, getStats: getReceivablesStats } = useReceivablesDB();
  const { transactions } = useApp();
  const { getStats: getTransactionStats, settings } = transactions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };

  // Score Financeiro
  const scoreData = useWeightedScore(transactions.transactions, settings);

  // Filtros
  const [competencia, setCompetencia] = useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedConvenio, setSelectedConvenio] = useState<string>("all");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const startDate = useMemo(() => startOfMonth(parseISO(`${competencia}-01`)), [competencia]);
  const endDate = useMemo(() => endOfMonth(parseISO(`${competencia}-01`)), [competencia]);

  // Período anterior para comparações
  const prevStartDate = useMemo(() => startOfMonth(subMonths(startDate, 1)), [startDate]);
  const prevEndDate = useMemo(() => endOfMonth(subMonths(startDate, 1)), [startDate]);

  // Lista de convênios únicos
  const uniqueConvenios = useMemo(() => {
    const convenios = new Set<string>();
    receivables.forEach(r => {
      if (r.source) convenios.add(r.source);
    });
    return Array.from(convenios).sort();
  }, [receivables]);

  // Filtrar recebíveis pelo período e filtros
  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      const rDate = parseISO(r.billingDate);
      const inPeriod = rDate >= startDate && rDate <= endDate;
      const matchUnit = selectedUnit === "all" || r.unit === selectedUnit;
      const matchConvenio = selectedConvenio === "all" || r.source === selectedConvenio;
      return inPeriod && matchUnit && matchConvenio;
    });
  }, [receivables, startDate, endDate, selectedUnit, selectedConvenio]);

  // Recebíveis do período anterior
  const prevFilteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      const rDate = parseISO(r.billingDate);
      const inPeriod = rDate >= prevStartDate && rDate <= prevEndDate;
      const matchUnit = selectedUnit === "all" || r.unit === selectedUnit;
      const matchConvenio = selectedConvenio === "all" || r.source === selectedConvenio;
      return inPeriod && matchUnit && matchConvenio;
    });
  }, [receivables, prevStartDate, prevEndDate, selectedUnit, selectedConvenio]);

  // Stats de cada módulo
  const productionStats = useMemo(() => {
    return getProductionStats(startDate, endDate);
  }, [getProductionStats, startDate, endDate]);

  const receivableStats = useMemo(() => {
    return getReceivablesStats(startDate, endDate);
  }, [getReceivablesStats, startDate, endDate]);

  const transactionStats = useMemo(() => {
    return getTransactionStats(startDate, endDate);
  }, [getTransactionStats, startDate, endDate]);

  // Fluxo do funil: Produção → Faturamento → Recebimento → Caixa
  const funnelData = useMemo(() => {
    const produced = productionStats.totalProduced;
    const billed = receivableStats.totalBilled;
    const received = receivableStats.totalReceived;
    const inCash = transactionStats.totalIncome;
    const glossed = receivableStats.totalGlossed;
    const open = receivableStats.totalOpen;

    // Taxas de conversão
    const billingConversion = produced > 0 ? (billed / produced) * 100 : 0;
    const receiptConversion = billed > 0 ? (received / billed) * 100 : 0;
    const totalConversion = produced > 0 ? (received / produced) * 100 : 0;
    const glossRate = billed > 0 ? (glossed / billed) * 100 : 0;
    const openRate = billed > 0 ? (open / billed) * 100 : 0;

    return {
      produced,
      billed,
      received,
      inCash,
      glossed,
      open,
      billingConversion,
      receiptConversion,
      totalConversion,
      glossRate,
      openRate,
    };
  }, [productionStats, receivableStats, transactionStats]);

  // Análise de Aging
  const agingAnalysis = useMemo(() => {
    const today = new Date();
    const openReceivables = filteredReceivables.filter(r => r.status === "FATURADO");
    
    const aging = {
      "0-30": { value: 0, count: 0 },
      "31-60": { value: 0, count: 0 },
      "61-90": { value: 0, count: 0 },
      ">90": { value: 0, count: 0 },
    };

    openReceivables.forEach(r => {
      const days = differenceInDays(today, parseISO(r.billingDate));
      const openValue = r.billedAmount - r.receivedAmount - r.glossedAmount;
      
      if (days <= 30) {
        aging["0-30"].value += openValue;
        aging["0-30"].count += 1;
      } else if (days <= 60) {
        aging["31-60"].value += openValue;
        aging["31-60"].count += 1;
      } else if (days <= 90) {
        aging["61-90"].value += openValue;
        aging["61-90"].count += 1;
      } else {
        aging[">90"].value += openValue;
        aging[">90"].count += 1;
      }
    });

    const totalOpen = Object.values(aging).reduce((sum, a) => sum + a.value, 0);
    const totalRisk = aging["61-90"].value + aging[">90"].value;
    const riskPercentage = totalOpen > 0 ? (totalRisk / totalOpen) * 100 : 0;

    let riskLevel: "low" | "medium" | "high" = "low";
    if (riskPercentage >= 30) riskLevel = "high";
    else if (riskPercentage >= 10) riskLevel = "medium";

    return {
      aging,
      totalOpen,
      totalRisk,
      riskPercentage,
      riskLevel,
    };
  }, [filteredReceivables]);

  // Análise de Aging do período anterior
  const prevAgingAnalysis = useMemo(() => {
    const today = new Date();
    const openReceivables = prevFilteredReceivables.filter(r => r.status === "FATURADO");
    
    const totalOpen = openReceivables.reduce((sum, r) => {
      const openValue = r.billedAmount - r.receivedAmount - r.glossedAmount;
      return sum + openValue;
    }, 0);

    let totalRisk = 0;
    openReceivables.forEach(r => {
      const days = differenceInDays(today, parseISO(r.billingDate));
      const openValue = r.billedAmount - r.receivedAmount - r.glossedAmount;
      if (days > 60) totalRisk += openValue;
    });

    const riskPercentage = totalOpen > 0 ? (totalRisk / totalOpen) * 100 : 0;

    return { totalOpen, totalRisk, riskPercentage };
  }, [prevFilteredReceivables]);

  // Variação do risco comparado ao período anterior
  const riskVariation = useMemo(() => {
    const currentRisk = agingAnalysis.riskPercentage;
    const prevRisk = prevAgingAnalysis.riskPercentage;
    const variation = currentRisk - prevRisk;
    return {
      value: variation,
      direction: variation > 0 ? "up" : variation < 0 ? "down" : "stable",
    };
  }, [agingAnalysis.riskPercentage, prevAgingAnalysis.riskPercentage]);

  // Cálculo do Score Financeiro com Estados (OK, Em Formação, Indisponível)
  const calculatedScore = useMemo(() => {
    // Verificar se há dados suficientes
    const hasProduction = funnelData.produced > 0;
    const hasBilling = funnelData.billed > 0;
    const hasReceivables = filteredReceivables.length > 0;
    const hasTransactions = transactionStats.totalIncome > 0 || transactionStats.totalExpense > 0;
    
    // Determinar estado do score
    const dataAvailable = hasProduction || hasBilling || hasReceivables || hasTransactions;
    const dataComplete = hasProduction && hasBilling;
    
    // Calcular maturidade (confiabilidade)
    const daysInPeriod = differenceInDays(endDate, startDate);
    const daysPassed = differenceInDays(new Date(), startDate);
    const maturityPercent = Math.min(100, (daysPassed / Math.max(daysInPeriod, 1)) * 100);
    let confidence: "baixa" | "media" | "alta" = "baixa";
    if (maturityPercent >= 80) confidence = "alta";
    else if (maturityPercent >= 40) confidence = "media";

    // Se não há dados, retornar estado indisponível
    if (!dataAvailable) {
      return {
        state: "unavailable" as const,
        score: 0,
        status: "critico" as const,
        emoji: "⚪",
        label: "Score não calculado",
        message: "Dados incompletos no período (verificar recebimentos/faturamento)",
        confidence,
        components: { receiptScore: 0, riskScore: 0, conversionScore: 0 },
        whatToDoNow: "Verificar lançamentos de produção e faturamento para o período.",
      };
    }

    // Se dados insuficientes, retornar estado em formação
    if (!dataComplete) {
      return {
        state: "forming" as const,
        score: 0,
        status: "atencao" as const,
        emoji: "🔄",
        label: "Score em Formação",
        message: "Histórico mínimo ainda em construção para cálculo consolidado",
        confidence,
        components: { receiptScore: 0, riskScore: 0, conversionScore: 0 },
        whatToDoNow: "Aguardar consolidação dos dados do período para cálculo completo.",
      };
    }

    // Componentes do score:
    const receiptScore = Math.min(funnelData.receiptConversion, 100);
    const riskScore = Math.max(0, 100 - agingAnalysis.riskPercentage * 2);
    const conversionScore = Math.min(funnelData.billingConversion, 100);

    const weightedScore = (receiptScore * 0.4) + (riskScore * 0.3) + (conversionScore * 0.3);

    let status: "saudavel" | "atencao" | "alerta" | "critico";
    let emoji: string;
    let label: string;
    let whatToDoNow: string;

    if (weightedScore >= 80) {
      status = "saudavel";
      emoji = "🟢";
      label = "Saudável";
      whatToDoNow = "Manter práticas atuais e buscar oportunidades de crescimento.";
    } else if (weightedScore >= 60) {
      status = "atencao";
      emoji = "🟡";
      label = "Atenção";
      whatToDoNow = "Monitorar recebíveis e otimizar ciclo de faturamento.";
    } else if (weightedScore >= 40) {
      status = "alerta";
      emoji = "🟠";
      label = "Alerta";
      whatToDoNow = "Priorizar cobranças pendentes e revisar processos de faturamento.";
    } else {
      status = "critico";
      emoji = "🔴";
      label = "Crítico";
      whatToDoNow = "Ação imediata: priorizar cobranças vencidas e regularizar faturamento.";
    }

    // Determinar maior gargalo
    const bottleneck = receiptScore < riskScore && receiptScore < conversionScore 
      ? "recebimento baixo" 
      : riskScore < conversionScore 
        ? "risco alto na carteira"
        : "produção não faturada";

    return {
      state: "ok" as const,
      score: Math.round(weightedScore),
      status,
      emoji,
      label,
      message: `Baseado em: recebimento, risco e conversão do período.`,
      confidence,
      components: {
        receiptScore: Math.round(receiptScore),
        riskScore: Math.round(riskScore),
        conversionScore: Math.round(conversionScore),
      },
      whatToDoNow: `${whatToDoNow} (Gargalo principal: ${bottleneck})`,
    };
  }, [funnelData, agingAnalysis.riskPercentage, filteredReceivables.length, transactionStats, startDate, endDate]);

  // Frase interpretativa do Aging
  const agingInterpretation = useMemo(() => {
    const { aging, totalOpen, riskLevel } = agingAnalysis;
    const pct0_30 = totalOpen > 0 ? (aging["0-30"].value / totalOpen) * 100 : 0;
    const pct31_60 = totalOpen > 0 ? (aging["31-60"].value / totalOpen) * 100 : 0;
    const pct61_90 = totalOpen > 0 ? (aging["61-90"].value / totalOpen) * 100 : 0;
    const pct90 = totalOpen > 0 ? (aging[">90"].value / totalOpen) * 100 : 0;

    if (totalOpen === 0) {
      return "Nenhum valor em aberto no período selecionado.";
    }

    if (pct0_30 === 100) {
      return "Carteira saudável: 100% dos valores concentrados em até 30 dias.";
    }

    if (riskLevel === "low") {
      return `Carteira saudável: ${pct0_30.toFixed(0)}% em até 30 dias. Risco controlado.`;
    }

    if (riskLevel === "medium") {
      return `Atenção moderada: ${(pct61_90 + pct90).toFixed(0)}% do valor em aberto possui mais de 60 dias.`;
    }

    return `Alerta crítico: ${(pct61_90 + pct90).toFixed(0)}% do valor em aberto está acima de 60 dias. Ação imediata necessária.`;
  }, [agingAnalysis]);

  // Análise por Convênio
  const analysisByConvenio = useMemo(() => {
    const today = new Date();
    const byConvenio: Record<string, {
      convenio: string;
      billed: number;
      received: number;
      open: number;
      risk: number;
      riskPercentage: number;
      hasHighOpenValue: boolean;
      hasZeroReceived: boolean;
    }> = {};

    filteredReceivables.forEach(r => {
      const key = r.source || "Sem Convênio";
      if (!byConvenio[key]) {
        byConvenio[key] = { 
          convenio: key, 
          billed: 0, 
          received: 0, 
          open: 0, 
          risk: 0, 
          riskPercentage: 0,
          hasHighOpenValue: false,
          hasZeroReceived: false,
        };
      }
      
      const openValue = r.billedAmount - r.receivedAmount - r.glossedAmount;
      const days = differenceInDays(today, parseISO(r.billingDate));
      
      byConvenio[key].billed += r.billedAmount;
      byConvenio[key].received += r.receivedAmount;
      byConvenio[key].open += r.status === "FATURADO" ? openValue : 0;
      
      if (r.status === "FATURADO" && days > 60) {
        byConvenio[key].risk += openValue;
      }
    });

    // Calcular percentual de risco e alertas
    const avgOpen = Object.values(byConvenio).reduce((sum, c) => sum + c.open, 0) / Math.max(Object.values(byConvenio).length, 1);
    Object.values(byConvenio).forEach(c => {
      c.riskPercentage = c.open > 0 ? (c.risk / c.open) * 100 : 0;
      c.hasHighOpenValue = c.open > avgOpen * 1.5;
      c.hasZeroReceived = c.billed > 0 && c.received === 0;
    });

    return Object.values(byConvenio).sort((a, b) => b.open - a.open);
  }, [filteredReceivables]);

  // Análise por Unidade
  const analysisByUnit = useMemo(() => {
    const today = new Date();
    const byUnit: Record<string, {
      unitId: string;
      unitName: string;
      billed: number;
      received: number;
      open: number;
      risk: number;
      riskPercentage: number;
      hasHighOpenValue: boolean;
      hasZeroReceived: boolean;
    }> = {};

    filteredReceivables.forEach(r => {
      const unit = settings.units.find(u => u.id === r.unit);
      const key = r.unit || "Sem Unidade";
      const unitName = unit?.name || key;
      
      if (!byUnit[key]) {
        byUnit[key] = { 
          unitId: key, 
          unitName, 
          billed: 0, 
          received: 0, 
          open: 0, 
          risk: 0, 
          riskPercentage: 0,
          hasHighOpenValue: false,
          hasZeroReceived: false,
        };
      }
      
      const openValue = r.billedAmount - r.receivedAmount - r.glossedAmount;
      const days = differenceInDays(today, parseISO(r.billingDate));
      
      byUnit[key].billed += r.billedAmount;
      byUnit[key].received += r.receivedAmount;
      byUnit[key].open += r.status === "FATURADO" ? openValue : 0;
      
      if (r.status === "FATURADO" && days > 60) {
        byUnit[key].risk += openValue;
      }
    });

    // Calcular percentual de risco e alertas
    const avgOpen = Object.values(byUnit).reduce((sum, u) => sum + u.open, 0) / Math.max(Object.values(byUnit).length, 1);
    Object.values(byUnit).forEach(u => {
      u.riskPercentage = u.open > 0 ? (u.risk / u.open) * 100 : 0;
      u.hasHighOpenValue = u.open > avgOpen * 1.5;
      u.hasZeroReceived = u.billed > 0 && u.received === 0;
    });

    return Object.values(byUnit).sort((a, b) => b.open - a.open);
  }, [filteredReceivables, settings.units]);

  // Ações Inteligentes (NBA) como checklist com CTAs
  const intelligentActions = useMemo(() => {
    const actions: {
      id: string;
      type: "high" | "medium" | "low";
      title: string;
      description: string;
      impact: string;
      impactValue: number;
      icon: typeof AlertTriangle;
      cta?: { label: string; route: string };
    }[] = [];

    // Priorizar cobrança do maior convênio em aberto
    if (analysisByConvenio.length > 0 && analysisByConvenio[0].open > 0) {
      const top = analysisByConvenio[0];
      actions.push({
        id: "cobranca-convenio",
        type: top.riskPercentage > 30 ? "high" : top.riskPercentage > 10 ? "medium" : "low",
        title: `Priorizar cobrança ${top.convenio}`,
        description: `Maior valor em aberto | Ação: contatar convênio para regularização`,
        impact: `Potencial recuperação: ${formatCurrency(top.open)}`,
        impactValue: top.open,
        icon: AlertTriangle,
        cta: { label: "Abrir Contas a Receber", route: "/receivables" },
      });
    }

    // Alerta de risco >90 dias
    if (agingAnalysis.aging[">90"].value > 0) {
      actions.push({
        id: "titulos-90",
        type: "high",
        title: "Regularizar títulos >90 dias",
        description: `${agingAnalysis.aging[">90"].count} título(s) vencidos | Ação: priorizar cobrança judicial ou negociação`,
        impact: `Valor em risco: ${formatCurrency(agingAnalysis.aging[">90"].value)}`,
        impactValue: agingAnalysis.aging[">90"].value,
        icon: XCircle,
        cta: { label: "Abrir Aging", route: "/aging-report" },
      });
    }

    // Produção elevada sem faturamento
    if (productionStats.totalOpen > productionStats.totalProduced * 0.3) {
      actions.push({
        id: "producao-faturar",
        type: "medium",
        title: "Faturar produções pendentes",
        description: `Produção não faturada | Ação: concluir faturamento pendente`,
        impact: `Valor a faturar: ${formatCurrency(productionStats.totalOpen)}`,
        impactValue: productionStats.totalOpen,
        icon: Clock,
        cta: { label: "Abrir Faturamento Sugerido", route: "/suggested-billing" },
      });
    }

    // Recebimento abaixo do ideal
    if (funnelData.receiptConversion < 60 && funnelData.billed > 0) {
      actions.push({
        id: "recebimento-baixo",
        type: "medium",
        title: "Recebimento abaixo do ideal",
        description: `Taxa de ${funnelData.receiptConversion.toFixed(1)}% | Ação: priorizar cobranças dos maiores convênios`,
        impact: `Valor pendente: ${formatCurrency(funnelData.billed - funnelData.received)}`,
        impactValue: funnelData.billed - funnelData.received,
        icon: TrendingDown,
        cta: { label: "Abrir Contas a Receber", route: "/receivables" },
      });
    }

    // Convênios com baixa conversão
    const lowConversionConvenios = analysisByConvenio.filter(c => c.billed > 0 && (c.received / c.billed) < 0.5);
    if (lowConversionConvenios.length > 0) {
      actions.push({
        id: "baixa-conversao",
        type: "medium",
        title: "Revisar convênios com baixa conversão",
        description: `${lowConversionConvenios.length} convênio(s) com <50% de recebimento | Ação: identificar gargalos`,
        impact: `Em aberto: ${formatCurrency(lowConversionConvenios.reduce((sum, c) => sum + c.open, 0))}`,
        impactValue: lowConversionConvenios.reduce((sum, c) => sum + c.open, 0),
        icon: TrendingDown,
        cta: { label: "Abrir Aging", route: "/aging-report" },
      });
    }

    // Cenário saudável
    if (agingAnalysis.riskLevel === "low" && actions.length === 0) {
      actions.push({
        id: "cenario-saudavel",
        type: "low",
        title: "Sem alertas críticos no período",
        description: "Nenhum título acima de 60 dias em aberto — risco controlado",
        impact: "Manter monitoramento regular",
        impactValue: 0,
        icon: CheckCircle2,
      });
    }

    return actions.sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return priority[a.type] - priority[b.type];
    }).slice(0, 5);
  }, [analysisByConvenio, agingAnalysis, productionStats, funnelData]);

  // Score Status
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
    if (score >= 40) return "bg-orange-100 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800";
    return "bg-red-100 dark:bg-red-950/30 border-red-200 dark:border-red-800";
  };

  const getRiskColor = (level: string) => {
    if (level === "high") return "text-red-600";
    if (level === "medium") return "text-amber-500";
    return "text-emerald-600";
  };

  const getRiskLabel = (level: string) => {
    if (level === "high") return "Alto";
    if (level === "medium") return "Moderado";
    return "Baixo";
  };

  const getRiskBadge = (level: string) => {
    if (level === "high") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
    if (level === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  };

  // Gráfico de Aging com barra de gradiente de risco
  const agingChartData = [
    { name: "0-30", value: agingAnalysis.aging["0-30"].value, fill: "#22c55e" },
    { name: "31-60", value: agingAnalysis.aging["31-60"].value, fill: "#eab308" },
    { name: "61-90", value: agingAnalysis.aging["61-90"].value, fill: "#f97316" },
    { name: ">90", value: agingAnalysis.aging[">90"].value, fill: "#ef4444" },
  ];

  // Status Executivo Final com recomendação objetiva
  const executiveStatus = useMemo(() => {
    const score = calculatedScore.score;
    const riskLevel = agingAnalysis.riskLevel;
    const conversionRate = funnelData.totalConversion;

    let status: "green" | "yellow" | "red" = "green";
    let label: string;
    let phrase: string;
    let recommendation: string;

    if (score < 40 || riskLevel === "high") {
      status = "red";
      label = "Crítico";
      phrase = "Situação crítica: alto risco de inadimplência e baixa conversão financeira identificados.";
      recommendation = "Ação imediata: priorizar cobranças vencidas e revisar processos de faturamento.";
    } else if (score < 60 || riskLevel === "medium" || conversionRate < 50) {
      status = "yellow";
      label = "Atenção";
      phrase = "O desempenho financeiro requer atenção moderada. Indicadores dentro do aceitável, mas com pontos de melhoria.";
      recommendation = "Monitorar de perto os recebíveis e otimizar o ciclo de faturamento.";
    } else if (score < 80) {
      status = "yellow";
      label = "Atenção";
      phrase = "Desempenho financeiro estável, mas há oportunidades de otimização para alcançar níveis ideais.";
      recommendation = "Manter acompanhamento regular e buscar reduzir prazos de recebimento.";
    } else {
      status = "green";
      label = "Saudável";
      phrase = "Excelente desempenho financeiro. Indicadores dentro das metas, risco controlado e alta conversão.";
      recommendation = "Manter as práticas atuais e buscar oportunidades de crescimento.";
    }

    return { status, label, phrase, recommendation };
  }, [calculatedScore.score, agingAnalysis.riskLevel, funnelData.totalConversion]);

  const getStatusIcon = (row: { riskPercentage: number; hasHighOpenValue: boolean; hasZeroReceived: boolean }) => {
    if (row.riskPercentage > 30 || row.hasZeroReceived) {
      return { icon: XCircle, color: "text-red-500", tooltip: "Risco alto: valores significativos acima de 60 dias ou sem recebimento" };
    }
    if (row.riskPercentage > 10 || row.hasHighOpenValue) {
      return { icon: AlertCircle, color: "text-amber-500", tooltip: "Atenção: valor em aberto acima da média ou risco moderado" };
    }
    return { icon: CheckCircle2, color: "text-emerald-500", tooltip: "Situação regular: risco controlado" };
  };

  // Gerar texto para WhatsApp
  const generateWhatsAppText = () => {
    const mesAno = format(parseISO(`${competencia}-01`), "MMMM/yyyy", { locale: ptBR }).toUpperCase();
    const scoreStatus = calculatedScore.state === "ok" 
      ? calculatedScore.label 
      : calculatedScore.state === "forming" 
        ? "Em Formação" 
        : "Indisponível";
    
    const scoreNote = calculatedScore.state !== "ok" 
      ? "\n• Score consolidado em formação (histórico mínimo ainda sendo construído)." 
      : "";

    const topActions = intelligentActions
      .slice(0, 3)
      .map((a, i) => `${i + 1}) ${a.title}`)
      .join(" ");

    const text = `*RELATÓRIO EXECUTIVO — ${mesAno} (SallusFlow)*
• Caixa (posição atual): ${safeFormat(transactionStats.currentBalance)}
• Faturamento emitido: ${safeFormat(funnelData.billed)} (Recebido: ${safePercent(funnelData.receiptConversion)})
• Produção realizada: ${safeFormat(funnelData.produced)}
• Em aberto (A receber): ${safeFormat(agingAnalysis.totalOpen)} | Risco >60d: ${safePercent(agingAnalysis.riskPercentage)}
• Status do mês: ${scoreStatus}${scoreNote}
• Prioridades: ${topActions || "Nenhuma ação crítica"}
_Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}_`;

    return text;
  };

  const handleShareWhatsApp = () => {
    const text = generateWhatsAppText();
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast.success("Texto copiado para WhatsApp!");
  };

  // Gerar PDF Institucional
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const mesAno = format(parseISO(`${competencia}-01`), "MMMM/yyyy", { locale: ptBR });
      
      // Header
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("SallusFlow", 14, 18);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Relatório Executivo Mensal — ${mesAno}`, 14, 28);

      let y = 50;

      // Score Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Score Financeiro", 14, y);
      y += 8;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (calculatedScore.state === "ok") {
        doc.text(`Score: ${calculatedScore.score}/100 — ${calculatedScore.label}`, 14, y);
        y += 6;
        doc.text(`Componentes: Recebimento ${calculatedScore.components.receiptScore}% | Risco ${calculatedScore.components.riskScore}% | Conversão ${calculatedScore.components.conversionScore}%`, 14, y);
      } else if (calculatedScore.state === "forming") {
        doc.text("Score em Formação — Histórico mínimo em construção", 14, y);
      } else {
        doc.text("Score não calculado — Dados incompletos no período", 14, y);
      }
      y += 12;

      // KPIs
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Indicadores-Chave (KPIs)", 14, y);
      y += 8;

      const kpiData = [
        ["Saldo em Caixa", safeFormat(transactionStats.currentBalance)],
        ["Faturamento Emitido", safeFormat(funnelData.billed)],
        ["Produção Realizada", safeFormat(funnelData.produced)],
        ["Valor em Aberto", safeFormat(agingAnalysis.totalOpen)],
        ["Conversão Total", safePercent(funnelData.totalConversion)],
        ["Taxa de Recebimento", safePercent(funnelData.receiptConversion)],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [["Indicador", "Valor"]],
        body: kpiData,
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Aging
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Análise de Aging", 14, y);
      y += 8;

      const agingData = [
        ["0-30 dias", safeFormat(agingAnalysis.aging["0-30"].value), `${agingAnalysis.aging["0-30"].count} título(s)`],
        ["31-60 dias", safeFormat(agingAnalysis.aging["31-60"].value), `${agingAnalysis.aging["31-60"].count} título(s)`],
        ["61-90 dias", safeFormat(agingAnalysis.aging["61-90"].value), `${agingAnalysis.aging["61-90"].count} título(s)`],
        [">90 dias", safeFormat(agingAnalysis.aging[">90"].value), `${agingAnalysis.aging[">90"].count} título(s)`],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [["Faixa", "Valor", "Títulos"]],
        body: agingData,
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Risco
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Risco da Carteira: ${getRiskLabel(agingAnalysis.riskLevel)} (${safePercent(agingAnalysis.riskPercentage)} > 60 dias)`, 14, y);
      y += 10;

      // Próximas Ações
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Próximas Melhores Ações", 14, y);
      y += 8;

      const actionsData = intelligentActions.map((a, i) => [
        `${i + 1}`,
        a.type === "high" ? "Alta" : a.type === "medium" ? "Média" : "Baixa",
        a.title,
        a.impact,
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [["#", "Prioridade", "Ação", "Impacto"]],
        body: actionsData,
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 80 },
          3: { cellWidth: 55 },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Status Executivo
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Status Executivo: ${executiveStatus.label}`, 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(executiveStatus.phrase, 14, y, { maxWidth: pageWidth - 28 });
      y += 12;
      doc.text(`Recomendação: ${executiveStatus.recommendation}`, 14, y, { maxWidth: pageWidth - 28 });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Relatório gerado automaticamente pelo SallusFlow. Dados consolidados até ${format(new Date(), "dd/MM/yyyy HH:mm")}. Uso exclusivo da gestão.`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: "right" });
      }

      doc.save(`Relatorio_Executivo_SallusFlow_${competencia}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* 1️⃣ Cabeçalho com contexto e ações */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Relatório Executivo Mensal
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Este relatório consolida o período selecionado. Para visão em tempo real, use "Executivo Integrado".</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              Documento de fechamento do mês (PDF institucional) + resumo para WhatsApp
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {user?.name || "Usuário"}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleShareWhatsApp}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="gap-2"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Baixar PDF
            </Button>
            <Badge variant="outline" className="text-sm">
              <FileText className="mr-1 h-3 w-3" />
              {format(parseISO(`${competencia}-01`), "MMMM/yyyy", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* 2️⃣ Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Unidades</SelectItem>
                    {settings.units.filter(u => u.active).map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
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
                    <SelectItem value="all">Todos os Convênios</SelectItem>
                    {uniqueConvenios.map(conv => (
                      <SelectItem key={conv} value={conv}>{conv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setCompetencia(format(new Date(), "yyyy-MM"));
                    setSelectedUnit("all");
                    setSelectedConvenio("all");
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3️⃣ Score Executivo - Com 3 estados */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Score Principal */}
          <Card className={`lg:col-span-2 border ${calculatedScore.state === "ok" ? getScoreBgColor(calculatedScore.score) : "bg-muted/30 border-muted"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Score Financeiro Geral
                <Badge variant="outline" className="text-xs ml-auto">
                  Confiabilidade: {calculatedScore.confidence === "alta" ? "Alta" : calculatedScore.confidence === "media" ? "Média" : "Baixa"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calculatedScore.state === "ok" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-5xl font-bold ${getScoreColor(calculatedScore.score)}`}>
                        {calculatedScore.score}
                      </p>
                      <span className="text-2xl">{calculatedScore.emoji}</span>
                    </div>
                    <Badge className={`mt-2 ${getRiskBadge(calculatedScore.status === "saudavel" ? "low" : calculatedScore.status === "critico" ? "high" : "medium")}`}>
                      {calculatedScore.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                      {calculatedScore.message}
                    </p>
                    <div className="mt-2 p-2 bg-primary/5 rounded text-xs">
                      <span className="font-medium">O que fazer agora:</span> {calculatedScore.whatToDoNow}
                    </div>
                  </div>
                  <div className="relative h-24 w-24">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                      <circle
                        className="text-muted/20 stroke-current"
                        strokeWidth="10"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                      />
                      <circle
                        className={`${calculatedScore.score >= 80 ? "text-emerald-500" : calculatedScore.score >= 60 ? "text-yellow-500" : calculatedScore.score >= 40 ? "text-orange-500" : "text-red-500"} stroke-current`}
                        strokeWidth="10"
                        strokeLinecap="round"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                        style={{
                          strokeDasharray: `${2 * Math.PI * 40}`,
                          strokeDashoffset: `${2 * Math.PI * 40 * (1 - calculatedScore.score / 100)}`,
                        }}
                      />
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl">{calculatedScore.emoji}</span>
                    <p className="text-xl font-semibold text-muted-foreground">
                      {calculatedScore.label}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {calculatedScore.message}
                  </p>
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    <span className="font-medium">Próximo passo:</span> {calculatedScore.whatToDoNow}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-xs">Saldo em Caixa</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(transactionStats.currentBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Posição atual</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Banknote className="h-4 w-4 text-blue-600" />
                <span className="text-xs">Faturamento</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(funnelData.billed)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">No período</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="h-4 w-4 text-violet-600" />
                <span className="text-xs">Produção</span>
              </div>
              <p className="text-2xl font-bold text-violet-600">
                {safeFormat(funnelData.produced)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Realizada no período</p>
            </CardContent>
          </Card>
        </div>

        {/* KPIs Adicionais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs">Valor em Aberto</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">
                {safeFormat(agingAnalysis.totalOpen)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">A receber (títulos em aberto)</p>
              {agingAnalysis.riskPercentage === 0 && (
                <p className="text-xs text-emerald-600 mt-1">Risco atual: 0% (&gt;60d)</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendUp className="h-4 w-4 text-green-600" />
                <span className="text-xs">Conversão Total</span>
              </div>
              <p className="text-2xl font-bold">
                {safePercent(funnelData.totalConversion)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Produção → Caixa</p>
              <Progress value={Math.min(funnelData.totalConversion, 100)} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
                <span className="text-xs">Taxa de Faturamento</span>
              </div>
              <p className="text-2xl font-bold">
                {funnelData.billingConversion.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Produção → Faturamento</p>
              <Progress value={funnelData.billingConversion} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs">Taxa de Recebimento</span>
              </div>
              <p className="text-2xl font-bold">
                {funnelData.receiptConversion.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Faturamento → Recebido</p>
              <Progress value={funnelData.receiptConversion} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* 4️⃣ Funil Financeiro com nomenclatura executiva */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Funil Financeiro (Visão Estratégica)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Produção Realizada */}
              <div className="flex-1 text-center p-4 rounded-lg bg-violet-100 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <Activity className="h-8 w-8 mx-auto text-violet-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Produção Realizada</p>
                <p className="text-2xl font-bold text-violet-600">
                  {formatCurrency(funnelData.produced)}
                </p>
                <p className="text-xs text-muted-foreground">100%</p>
              </div>

              <div className="hidden md:flex flex-col items-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs font-medium text-violet-600 mt-1">{funnelData.billingConversion.toFixed(0)}%</span>
                <span className="text-[10px] text-muted-foreground">% da produção faturada</span>
              </div>

              {/* Faturamento Emitido */}
              <div className="flex-1 text-center p-4 rounded-lg bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Banknote className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Faturamento Emitido</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(funnelData.billed)}
                </p>
                <p className="text-xs text-muted-foreground">{funnelData.billingConversion.toFixed(0)}% do produzido</p>
              </div>

              <div className="hidden md:flex flex-col items-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs font-medium text-blue-600 mt-1">{funnelData.receiptConversion.toFixed(0)}%</span>
                <span className="text-[10px] text-muted-foreground">% faturado já recebido</span>
              </div>

              {/* Valores Recebidos */}
              <div className="flex-1 text-center p-4 rounded-lg bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Valores Recebidos</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(funnelData.received)}
                </p>
                <p className="text-xs text-muted-foreground">{funnelData.receiptConversion.toFixed(0)}% do faturado</p>
              </div>

              <div className="hidden md:flex flex-col items-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Entrada em Caixa */}
              <div className="flex-1 text-center p-4 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <Wallet className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Entrada em Caixa</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(funnelData.inCash)}
                </p>
                <p className="text-xs text-muted-foreground">No período</p>
              </div>
            </div>

            {/* Barra de progresso geral */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Conversão total (Produção → Caixa)</span>
                <span className="font-medium">{funnelData.totalConversion.toFixed(1)}%</span>
              </div>
              <Progress value={funnelData.totalConversion} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* 5️⃣ Análise de Risco e Aging */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Cards de Aging */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Análise de Aging (Risco)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Frase interpretativa automática */}
                <div className={`p-3 rounded-lg mb-4 ${
                  agingAnalysis.riskLevel === "low" 
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800" 
                    : agingAnalysis.riskLevel === "medium"
                      ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                }`}>
                  <p className={`text-sm font-medium ${
                    agingAnalysis.riskLevel === "low" ? "text-emerald-700 dark:text-emerald-400" :
                    agingAnalysis.riskLevel === "medium" ? "text-amber-700 dark:text-amber-400" :
                    "text-red-700 dark:text-red-400"
                  }`}>
                    {agingInterpretation}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">0–30 dias</p>
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(agingAnalysis.aging["0-30"].value)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{agingAnalysis.aging["0-30"].count} título(s)</span>
                        <span className="text-xs text-muted-foreground">
                          {agingAnalysis.totalOpen > 0 ? ((agingAnalysis.aging["0-30"].value / agingAnalysis.totalOpen) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">31–60 dias</p>
                      <p className="text-xl font-bold text-yellow-600">{formatCurrency(agingAnalysis.aging["31-60"].value)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{agingAnalysis.aging["31-60"].count} título(s)</span>
                        <span className="text-xs text-muted-foreground">
                          {agingAnalysis.totalOpen > 0 ? ((agingAnalysis.aging["31-60"].value / agingAnalysis.totalOpen) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">61–90 dias</p>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(agingAnalysis.aging["61-90"].value)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{agingAnalysis.aging["61-90"].count} título(s)</span>
                        <span className="text-xs text-muted-foreground">
                          {agingAnalysis.totalOpen > 0 ? ((agingAnalysis.aging["61-90"].value / agingAnalysis.totalOpen) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">&gt;90 dias</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(agingAnalysis.aging[">90"].value)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{agingAnalysis.aging[">90"].count} título(s)</span>
                        <span className="text-xs text-muted-foreground">
                          {agingAnalysis.totalOpen > 0 ? ((agingAnalysis.aging[">90"].value / agingAnalysis.totalOpen) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Barra de risco visual (gradiente) */}
                <div className="mt-6">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Distribuição de Risco</span>
                    <span>Verde → Vermelho</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden flex">
                    {agingAnalysis.totalOpen > 0 ? (
                      <>
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${(agingAnalysis.aging["0-30"].value / agingAnalysis.totalOpen) * 100}%` }}
                        />
                        <div 
                          className="bg-yellow-500 h-full transition-all" 
                          style={{ width: `${(agingAnalysis.aging["31-60"].value / agingAnalysis.totalOpen) * 100}%` }}
                        />
                        <div 
                          className="bg-orange-500 h-full transition-all" 
                          style={{ width: `${(agingAnalysis.aging["61-90"].value / agingAnalysis.totalOpen) * 100}%` }}
                        />
                        <div 
                          className="bg-red-500 h-full transition-all" 
                          style={{ width: `${(agingAnalysis.aging[">90"].value / agingAnalysis.totalOpen) * 100}%` }}
                        />
                      </>
                    ) : (
                      <div className="bg-muted h-full w-full" />
                    )}
                  </div>
                </div>

                {/* Gráfico de Aging */}
                <div className="mt-6 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} fontSize={10} />
                      <YAxis type="category" dataKey="name" fontSize={12} width={60} />
                      <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {agingChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicador Geral de Risco com comparação */}
          <Card className={`border ${getRiskBadge(agingAnalysis.riskLevel)}`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risco da Carteira
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2">
                  <p className={`text-4xl font-bold ${getRiskColor(agingAnalysis.riskLevel)}`}>
                    {getRiskLabel(agingAnalysis.riskLevel)}
                  </p>
                  {/* Comparação com período anterior */}
                  {riskVariation.direction !== "stable" && (
                    <div className={`flex items-center gap-1 text-sm ${
                      riskVariation.direction === "down" ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {riskVariation.direction === "down" ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                      <span>{Math.abs(riskVariation.value).toFixed(1)}%</span>
                    </div>
                  )}
                  {riskVariation.direction === "stable" && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Minus className="h-4 w-4" />
                      <span>Estável</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {agingAnalysis.riskPercentage.toFixed(1)}% em risco (&gt;60 dias)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exposição Total</span>
                  <span className="font-medium text-red-600">{formatCurrency(agingAnalysis.totalRisk)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total em Aberto</span>
                  <span className="font-medium">{formatCurrency(agingAnalysis.totalOpen)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">% em Risco</span>
                  <span className="font-medium">{agingAnalysis.riskPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">vs. Período Anterior</span>
                  <span className={`font-medium flex items-center gap-1 ${
                    riskVariation.direction === "down" ? "text-emerald-600" : 
                    riskVariation.direction === "up" ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {riskVariation.direction === "down" ? "↓" : riskVariation.direction === "up" ? "↑" : "→"}
                    {Math.abs(riskVariation.value).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Progress 
                  value={agingAnalysis.riskPercentage} 
                  className={`h-2 ${agingAnalysis.riskLevel === "high" ? "[&>div]:bg-red-500" : agingAnalysis.riskLevel === "medium" ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 6️⃣ Tabelas Detalhadas com tooltips e alertas */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Por Convênio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Análise por Convênio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Convênio</TableHead>
                      <TableHead className="text-right">Faturado</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Em Aberto</TableHead>
                      <TableHead className="text-right">% Risco</TableHead>
                      <TableHead className="text-center">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisByConvenio.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum dado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysisByConvenio.slice(0, 5).map((row, idx) => {
                        const statusInfo = getStatusIcon(row);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {row.convenio}
                                {(row.hasHighOpenValue || row.hasZeroReceived) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {row.hasHighOpenValue && <p>Valor em aberto acima da média</p>}
                                        {row.hasZeroReceived && <p>Nenhum recebimento registrado</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.billed)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.received)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.open)}</TableCell>
                            <TableCell className="text-right">{row.riskPercentage.toFixed(0)}%</TableCell>
                            <TableCell className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <statusInfo.icon className={`h-4 w-4 ${statusInfo.color} mx-auto`} />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{statusInfo.tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Por Unidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Análise por Unidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Faturado</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Em Aberto</TableHead>
                      <TableHead className="text-right">% Risco</TableHead>
                      <TableHead className="text-center">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisByUnit.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum dado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysisByUnit.map((row, idx) => {
                        const statusInfo = getStatusIcon(row);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {row.unitName}
                                {(row.hasHighOpenValue || row.hasZeroReceived) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {row.hasHighOpenValue && <p>Valor em aberto acima da média</p>}
                                        {row.hasZeroReceived && <p>Nenhum recebimento registrado</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.billed)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.received)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.open)}</TableCell>
                            <TableCell className="text-right">{row.riskPercentage.toFixed(0)}%</TableCell>
                            <TableCell className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <statusInfo.icon className={`h-4 w-4 ${statusInfo.color} mx-auto`} />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{statusInfo.tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 7️⃣ Ações Inteligentes (Checklist Acionável) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Ações Inteligentes (Checklist)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intelligentActions.map((action) => (
                <div 
                  key={action.id} 
                  className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${
                    action.type === "high" 
                      ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" 
                      : action.type === "medium" 
                        ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20" 
                        : "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  }`}
                >
                  <Checkbox 
                    id={action.id}
                    className={`mt-0.5 ${
                      action.type === "high" ? "border-red-500 data-[state=checked]:bg-red-500" :
                      action.type === "medium" ? "border-amber-500 data-[state=checked]:bg-amber-500" :
                      "border-emerald-500 data-[state=checked]:bg-emerald-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={action.type === "high" ? "destructive" : action.type === "medium" ? "secondary" : "outline"}>
                        {action.type === "high" ? "Alta" : action.type === "medium" ? "Média" : "Baixa"}
                      </Badge>
                      <action.icon className={`h-4 w-4 ${
                        action.type === "high" ? "text-red-500" : action.type === "medium" ? "text-amber-500" : "text-emerald-500"
                      }`} />
                    </div>
                    <label htmlFor={action.id} className="font-medium cursor-pointer">{action.title}</label>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    <p className="text-sm font-medium mt-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {action.impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 8️⃣ Status Executivo Final com recomendação objetiva */}
        <Card className={`border-2 ${
          executiveStatus.status === "green" 
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
            : executiveStatus.status === "yellow" 
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" 
              : "border-red-500 bg-red-50/50 dark:bg-red-950/20"
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                executiveStatus.status === "green" 
                  ? "bg-emerald-100 dark:bg-emerald-900" 
                  : executiveStatus.status === "yellow" 
                    ? "bg-amber-100 dark:bg-amber-900" 
                    : "bg-red-100 dark:bg-red-900"
              }`}>
                {executiveStatus.status === "green" ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                ) : executiveStatus.status === "yellow" ? (
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${
                  executiveStatus.status === "green" ? "text-emerald-600" : executiveStatus.status === "yellow" ? "text-amber-600" : "text-red-600"
                }`}>
                  Status Executivo: {executiveStatus.label}
                </h3>
                <p className="text-muted-foreground mt-1">{executiveStatus.phrase}</p>
                <div className={`mt-3 p-3 rounded-lg ${
                  executiveStatus.status === "green" 
                    ? "bg-emerald-100/50 dark:bg-emerald-900/30" 
                    : executiveStatus.status === "yellow" 
                      ? "bg-amber-100/50 dark:bg-amber-900/30" 
                      : "bg-red-100/50 dark:bg-red-900/30"
                }`}>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Recomendação:
                  </p>
                  <p className="text-sm mt-1">{executiveStatus.recommendation}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links para Relatórios Gerenciais */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Aprofundar Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link to="/production-report">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Relatório de Produção
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link to="/billing-report">
                  <Banknote className="h-4 w-4 text-blue-600" />
                  Relatório de Faturamento
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link to="/aging-report">
                  <Clock className="h-4 w-4 text-orange-600" />
                  Aging (Contas a Receber)
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link to="/score">
                  <Gauge className="h-4 w-4 text-emerald-600" />
                  Score Financeiro
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé */}
        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          <p className="font-medium">
            Relatório gerado automaticamente pelo SallusFlow.
          </p>
          <p>
            Dados consolidados em tempo real. Uso exclusivo da gestão.
          </p>
          <p className="mt-1">
            Período analisado: {format(startDate, "dd/MM/yyyy", { locale: ptBR })} a{" "}
            {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
