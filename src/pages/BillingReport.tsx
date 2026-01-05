import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Banknote,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  XCircle,
  Scale,
  Calendar,
  Eye,
  Shield,
  Lightbulb,
  Target,
  ArrowRight,
  Building2,
  Wallet,
  Percent,
  Zap,
} from "lucide-react";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { startOfMonth, endOfMonth, format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatUnitDisplayName } from "@/utils/formatters";

export default function BillingReport() {
  const navigate = useNavigate();
  const { receivables, filterReceivables, uniqueSources } = useReceivablesDB();
  const { transactions } = useApp();
  const { settings } = transactions;

  const [startDate, setStartDate] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedConvenio, setSelectedConvenio] = useState<string>("all");

  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    receivables.forEach((r) => units.add(r.unit));
    return Array.from(units).sort();
  }, [receivables]);

  const filteredReceivables = useMemo(() => {
    return filterReceivables({
      startDate: startDate ? parseISO(startDate) : undefined,
      endDate: endDate ? parseISO(endDate) : undefined,
      unit: selectedUnit !== "all" ? selectedUnit : undefined,
      source: selectedConvenio !== "all" ? selectedConvenio : undefined,
    });
  }, [filterReceivables, startDate, endDate, selectedUnit, selectedConvenio]);

  const stats = useMemo(() => {
    const totalBilled = filteredReceivables.reduce((sum, r) => sum + r.billedAmount, 0);
    const totalReceived = filteredReceivables.reduce((sum, r) => sum + (r.receivedAmount || 0), 0);
    const totalGlossed = filteredReceivables
      .filter((r) => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
      .reduce((sum, r) => sum + (r.glossedAmount || 0), 0);
    const totalInAppeal = filteredReceivables
      .filter((r) => r.appealStatus === "EM_RECURSO")
      .reduce((sum, r) => sum + (r.appealAmount || r.glossedAmount || 0), 0);
    
    // Separar valores em aberto por prazo
    const openItems = filteredReceivables.filter((r) => r.status === "FATURADO");
    const totalOpen = openItems.reduce((sum, r) => sum + r.billedAmount, 0);
    
    // Classificar por risco de prazo
    const today = new Date();
    let openLowRisk = 0;    // Até 30 dias
    let openMediumRisk = 0; // 31-60 dias
    let openHighRisk = 0;   // +60 dias
    
    openItems.forEach((r) => {
      const daysSinceBilling = differenceInDays(today, parseISO(r.billingDate));
      if (daysSinceBilling <= 30) {
        openLowRisk += r.billedAmount;
      } else if (daysSinceBilling <= 60) {
        openMediumRisk += r.billedAmount;
      } else {
        openHighRisk += r.billedAmount;
      }
    });

    const receivedItems = filteredReceivables.filter(
      (r) => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.actualReceiptDate
    );
    const totalDays = receivedItems.reduce((sum, r) => {
      const days = differenceInDays(parseISO(r.actualReceiptDate!), parseISO(r.billingDate));
      return sum + days;
    }, 0);
    const avgReceiptDays = receivedItems.length > 0 ? Math.round(totalDays / receivedItems.length) : 0;

    const glossRate = totalBilled > 0 ? (totalGlossed / totalBilled) * 100 : 0;
    const receiptRate = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;
    const efficiencyRate = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;

    return { 
      totalBilled, totalReceived, totalGlossed, totalInAppeal, totalOpen, 
      openLowRisk, openMediumRisk, openHighRisk,
      avgReceiptDays, glossRate, receiptRate, efficiencyRate, 
      count: filteredReceivables.length 
    };
  }, [filteredReceivables]);

  // ========== PRINCIPAL CAUSA DE GLOSA ==========
  const mainGlossReason = useMemo(() => {
    const glossedItems = filteredReceivables.filter(
      (r) => (r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA") && r.glossReason
    );
    if (glossedItems.length === 0) return null;
    
    const reasonCounts: Record<string, { count: number; total: number }> = {};
    glossedItems.forEach((r) => {
      const reason = r.glossReason || "Não especificado";
      if (!reasonCounts[reason]) {
        reasonCounts[reason] = { count: 0, total: 0 };
      }
      reasonCounts[reason].count++;
      reasonCounts[reason].total += r.glossedAmount || 0;
    });
    
    const sorted = Object.entries(reasonCounts).sort((a, b) => b[1].total - a[1].total);
    return sorted[0] ? { reason: sorted[0][0], count: sorted[0][1].count, total: sorted[0][1].total } : null;
  }, [filteredReceivables]);

  const dataByConvenio = useMemo(() => {
    const byConvenio: Record<string, { source: string; billed: number; received: number; glossed: number; inAppeal: number; open: number; count: number }> = {};
    filteredReceivables.forEach((r) => {
      if (!byConvenio[r.source]) {
        byConvenio[r.source] = { source: r.source, billed: 0, received: 0, glossed: 0, inAppeal: 0, open: 0, count: 0 };
      }
      byConvenio[r.source].billed += r.billedAmount;
      byConvenio[r.source].received += r.receivedAmount || 0;
      byConvenio[r.source].count++;
      if (r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA") byConvenio[r.source].glossed += r.glossedAmount || 0;
      if (r.appealStatus === "EM_RECURSO") byConvenio[r.source].inAppeal += r.appealAmount || r.glossedAmount || 0;
      if (r.status === "FATURADO") byConvenio[r.source].open += r.billedAmount;
    });
    return Object.values(byConvenio).sort((a, b) => b.billed - a.billed);
  }, [filteredReceivables]);

  const dataByUnit = useMemo(() => {
    const byUnit: Record<string, { unit: string; billed: number; received: number; glossed: number; open: number; count: number }> = {};
    filteredReceivables.forEach((r) => {
      if (!byUnit[r.unit]) {
        byUnit[r.unit] = { unit: r.unit, billed: 0, received: 0, glossed: 0, open: 0, count: 0 };
      }
      byUnit[r.unit].billed += r.billedAmount;
      byUnit[r.unit].received += r.receivedAmount || 0;
      byUnit[r.unit].count++;
      if (r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA") byUnit[r.unit].glossed += r.glossedAmount || 0;
      if (r.status === "FATURADO") byUnit[r.unit].open += r.billedAmount;
    });
    return Object.values(byUnit).sort((a, b) => b.billed - a.billed);
  }, [filteredReceivables]);

  // ========== LEITURA EXECUTIVA ==========
  const executiveReading = useMemo(() => {
    if (dataByConvenio.length === 0 && dataByUnit.length === 0) return null;
    const topConvenioBilled = dataByConvenio[0] || null;
    const topConvenioOpen = [...dataByConvenio].filter(c => c.open > 0).sort((a, b) => b.open - a.open)[0] || null;
    const conveniosWithGloss = dataByConvenio.filter(c => c.billed > 0).map(c => ({ ...c, glossRate: (c.glossed / c.billed) * 100 })).filter(c => c.glossRate > 0);
    const topConvenioGlossRate = conveniosWithGloss.sort((a, b) => b.glossRate - a.glossRate)[0] || null;
    const unitsWithReceipt = dataByUnit.filter(u => u.billed > 0).map(u => ({ ...u, receiptRate: (u.received / u.billed) * 100 }));
    const topUnitReceiptRate = unitsWithReceipt.sort((a, b) => b.receiptRate - a.receiptRate)[0] || null;
    const topUnitPending = [...dataByUnit].filter(u => u.open > 0).sort((a, b) => b.open - a.open)[0] || null;
    return { topConvenioBilled, topConvenioOpen, topConvenioGlossRate, topUnitReceiptRate, topUnitPending };
  }, [dataByConvenio, dataByUnit]);

  // ========== ALERTAS FINANCEIROS ==========
  const financialAlerts = useMemo(() => {
    const alerts: Array<{ type: 'warning' | 'error'; message: string }> = [];
    if (stats.glossRate > 1) alerts.push({ type: stats.glossRate > 5 ? 'error' : 'warning', message: `Taxa de glosa em ${stats.glossRate.toFixed(1)}% — acima do limite aceitável de 1%` });
    const openPercentage = stats.totalBilled > 0 ? (stats.totalOpen / stats.totalBilled) * 100 : 0;
    if (openPercentage > 30) alerts.push({ type: openPercentage > 50 ? 'error' : 'warning', message: `${openPercentage.toFixed(0)}% do valor faturado ainda está em aberto` });
    if (stats.avgReceiptDays > 30) alerts.push({ type: stats.avgReceiptDays > 45 ? 'error' : 'warning', message: `Prazo médio de recebimento em ${stats.avgReceiptDays} dias — acima do ideal de 30 dias` });
    return alerts;
  }, [stats]);

  // ========== AÇÕES RECOMENDADAS ==========
  const recommendedActions = useMemo(() => {
    const actions: Array<{ priority: 'alta' | 'média' | 'baixa'; action: string; reason: string }> = [];
    if (executiveReading?.topConvenioOpen) actions.push({ priority: 'alta', action: `Priorizar cobrança: ${executiveReading.topConvenioOpen.source}`, reason: `Maior valor em aberto: ${formatCurrency(executiveReading.topConvenioOpen.open)}` });
    if (executiveReading?.topConvenioGlossRate && executiveReading.topConvenioGlossRate.glossRate > 1) actions.push({ priority: 'alta', action: `Revisar glosas: ${executiveReading.topConvenioGlossRate.source}`, reason: `Maior taxa de glosa: ${executiveReading.topConvenioGlossRate.glossRate.toFixed(1)}%` });
    if (executiveReading?.topConvenioBilled) {
      const rate = executiveReading.topConvenioBilled.billed > 0 ? (executiveReading.topConvenioBilled.received / executiveReading.topConvenioBilled.billed) * 100 : 0;
      if (rate >= 90) actions.push({ priority: 'baixa', action: `Manter padrão: ${executiveReading.topConvenioBilled.source}`, reason: `Boa performance: ${rate.toFixed(0)}% de recebimento` });
    }
    return actions.slice(0, 3);
  }, [executiveReading]);

  const getPriorityColor = (priority: 'alta' | 'média' | 'baixa') => {
    switch (priority) {
      case 'alta': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'média': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'baixa': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório de Faturamento</h1>
            <p className="text-sm text-muted-foreground">Visão executiva consolidada: faturado, recebido, glosado e em aberto</p>
          </div>
          <Badge variant="outline" className="w-fit"><Banknote className="mr-1 h-3 w-3" />{stats.count} faturamentos</Badge>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileSearch className="h-4 w-4" />Filtros</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Unidade</Label><Select value={selectedUnit} onValueChange={setSelectedUnit}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{uniqueUnits.map((unit) => (<SelectItem key={unit} value={unit}>{formatUnitDisplayName(unit)}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Convênio</Label><Select value={selectedConvenio} onValueChange={setSelectedConvenio}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSources.map((source) => (<SelectItem key={source} value={source}>{source}</SelectItem>))}</SelectContent></Select></div>
            </div>
          </CardContent>
        </Card>

        {/* ========== LEITURA EXECUTIVA ========== */}
        {executiveReading && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Leitura Executiva</CardTitle></div>
              <CardDescription>Síntese automática baseada nos dados filtrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {executiveReading.topConvenioBilled && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                    <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Principal Convênio (Faturado)</p><p className="font-semibold text-foreground">{executiveReading.topConvenioBilled.source}</p><p className="text-sm text-muted-foreground">{formatCurrency(executiveReading.topConvenioBilled.billed)}</p></div>
                  </div>
                )}
                {executiveReading.topConvenioOpen && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                    <Wallet className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Maior Valor em Aberto</p><p className="font-semibold text-foreground">{executiveReading.topConvenioOpen.source}</p><p className="text-sm text-muted-foreground">{formatCurrency(executiveReading.topConvenioOpen.open)}</p></div>
                  </div>
                )}
                {executiveReading.topConvenioGlossRate && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Maior Taxa de Glosa</p><p className="font-semibold text-foreground">{executiveReading.topConvenioGlossRate.source}</p><p className="text-sm text-muted-foreground">{executiveReading.topConvenioGlossRate.glossRate.toFixed(1)}%</p></div>
                  </div>
                )}
                {executiveReading.topUnitReceiptRate && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Taxa de Recebimento</p><p className="font-semibold text-foreground">{formatUnitDisplayName(executiveReading.topUnitReceiptRate.unit)}</p><p className="text-sm text-muted-foreground">{executiveReading.topUnitReceiptRate.receiptRate.toFixed(0)}%</p></div>
                  </div>
                )}
                {executiveReading.topUnitPending && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                    <Building2 className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Unidade com Maior Pendente</p><p className="font-semibold text-foreground">{formatUnitDisplayName(executiveReading.topUnitPending.unit)}</p><p className="text-sm text-muted-foreground">{formatCurrency(executiveReading.topUnitPending.open)}</p></div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== ALERTAS FINANCEIROS ========== */}
        {financialAlerts.length > 0 && (
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-destructive" /><CardTitle className="text-lg">Alertas Financeiros</CardTitle></div>
              <CardDescription>Indicadores que requerem atenção imediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {financialAlerts.map((alert, index) => (
                  <div key={index} className={`flex items-center gap-3 p-3 rounded-lg border ${alert.type === 'error' ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-amber-500/10 border-amber-500/20 text-amber-600'}`}>
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">{alert.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Card className="border-l-4 border-l-blue-500"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Faturado</p><p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalBilled)}</p></div><Banknote className="h-8 w-8 text-blue-500 opacity-80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-green-500"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Recebido</p><p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalReceived)}</p><p className="text-xs text-green-600 flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3" />{stats.receiptRate.toFixed(1)}% do faturado</p></div><CheckCircle2 className="h-8 w-8 text-green-500 opacity-80" /></div></CardContent></Card>
          
          {/* Card Glosado Enriquecido */}
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Glosado</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalGlossed)}</p>
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <TrendingDown className="h-3 w-3" />{stats.glossRate.toFixed(1)}% de glosa
                  </p>
                  {mainGlossReason && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      Principal causa: <span className="font-medium text-red-600">{mainGlossReason.reason}</span>
                    </p>
                  )}
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-amber-500"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Em Recurso</p><p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalInAppeal)}</p></div><Scale className="h-8 w-8 text-amber-500 opacity-80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-violet-500"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Prazo Médio</p><p className="text-xl font-bold text-foreground">{stats.avgReceiptDays} dias</p></div><Calendar className="h-8 w-8 text-violet-500 opacity-80" /></div></CardContent></Card>
          
          {/* Novo KPI: Eficiência de Recebimento */}
          <Card className="border-l-4 border-l-teal-500 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Eficiência de Recebimento</p>
                  <p className="text-xl font-bold text-foreground">{stats.efficiencyRate.toFixed(1)}%</p>
                  <p className="text-xs text-teal-600 mt-1">Recebido ÷ Faturado</p>
                  <p className="text-xs text-muted-foreground mt-1">% convertido em caixa</p>
                </div>
                <Percent className="h-8 w-8 text-teal-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Em Aberto com Leitura de Risco por Prazo */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <p className="text-sm font-medium text-muted-foreground">Em Aberto (Aguardando Recebimento)</p>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">{formatCurrency(stats.totalOpen)}</p>
                <Progress value={stats.totalBilled > 0 ? (stats.totalOpen / stats.totalBilled) * 100 : 0} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalBilled > 0 ? ((stats.totalOpen / stats.totalBilled) * 100).toFixed(1) : 0}% do faturado pendente
                </p>
              </div>
              
              {/* Leitura de Risco por Prazo */}
              {stats.totalOpen > 0 && (
                <div className="flex-1 border-l pl-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Risco por Prazo</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-muted-foreground">Até 30 dias</span>
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">Baixo risco</Badge>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(stats.openLowRisk)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">31–60 dias</span>
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">Atenção</Badge>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(stats.openMediumRisk)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        <span className="text-xs text-muted-foreground">+60 dias</span>
                        <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 text-[10px]">Alto risco</Badge>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(stats.openHighRisk)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {stats.totalOpen > 0 && (
              <button onClick={() => navigate('/aging-report')} className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline font-medium">
                <ArrowRight className="h-4 w-4" />Ver Aging para detalhamento por prazo
              </button>
            )}
          </CardContent>
        </Card>

        {/* Tabela por Convênio */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" />Faturamento por Convênio</CardTitle></CardHeader>
          <CardContent>
            {dataByConvenio.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Nenhum faturamento encontrado no período.</p></div>) : (
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Convênio</TableHead><TableHead className="text-right">Faturado</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Glosado</TableHead><TableHead className="text-right">Em Recurso</TableHead><TableHead className="text-right">Em Aberto</TableHead><TableHead className="text-right">Taxa Glosa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dataByConvenio.map((row) => {
                      const glossRate = row.billed > 0 ? (row.glossed / row.billed) * 100 : 0;
                      return (<TableRow key={row.source}><TableCell className="font-medium">{row.source}</TableCell><TableCell className="text-right">{formatCurrency(row.billed)}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(row.received)}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(row.glossed)}</TableCell><TableCell className="text-right text-amber-600">{formatCurrency(row.inAppeal)}</TableCell><TableCell className="text-right text-orange-600">{formatCurrency(row.open)}</TableCell><TableCell className="text-right"><Badge variant={glossRate > 10 ? "destructive" : glossRate > 5 ? "secondary" : "outline"}>{glossRate.toFixed(1)}%</Badge></TableCell></TableRow>);
                    })}
                  </TableBody>
                  <TableFooter><TableRow className="bg-muted/50 font-semibold"><TableCell>Total</TableCell><TableCell className="text-right">{formatCurrency(stats.totalBilled)}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(stats.totalReceived)}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(stats.totalGlossed)}</TableCell><TableCell className="text-right text-amber-600">{formatCurrency(stats.totalInAppeal)}</TableCell><TableCell className="text-right text-orange-600">{formatCurrency(stats.totalOpen)}</TableCell><TableCell className="text-right"><Badge variant={stats.glossRate > 10 ? "destructive" : "secondary"}>{stats.glossRate.toFixed(1)}%</Badge></TableCell></TableRow></TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela por Unidade */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" />Faturamento por Unidade</CardTitle></CardHeader>
          <CardContent>
            {dataByUnit.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Nenhum faturamento encontrado no período.</p></div>) : (
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead className="text-right">Faturado</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Glosado</TableHead><TableHead className="text-right">Em Aberto</TableHead><TableHead className="text-right">Taxa Recebimento</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dataByUnit.map((row) => {
                      const receiptRate = row.billed > 0 ? (row.received / row.billed) * 100 : 0;
                      return (<TableRow key={row.unit}><TableCell className="font-medium">{formatUnitDisplayName(row.unit)}</TableCell><TableCell className="text-right">{formatCurrency(row.billed)}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(row.received)}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(row.glossed)}</TableCell><TableCell className="text-right text-orange-600">{formatCurrency(row.open)}</TableCell><TableCell className="text-right"><Badge variant={receiptRate > 80 ? "default" : receiptRate > 60 ? "secondary" : "destructive"}>{receiptRate.toFixed(1)}%</Badge></TableCell></TableRow>);
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========== AÇÕES RECOMENDADAS (NBA) ========== */}
        {recommendedActions.length > 0 && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Ações Recomendadas</CardTitle>
                  <p className="text-sm font-medium text-primary mt-0.5">Próxima Melhor Ação (NBA)</p>
                </div>
              </div>
              <CardDescription>Sugestões automáticas com foco em impacto financeiro imediato (somente leitura)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendedActions.map((action, index) => (
                  <div key={index} className={`flex items-start gap-3 p-3 rounded-lg border ${getPriorityColor(action.priority)}`}>
                    <Target className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getPriorityColor(action.priority)}>
                          Prioridade {action.priority}
                        </Badge>
                        {index === 0 && action.priority === 'alta' && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            <Zap className="h-3 w-3 mr-1" />
                            Ação Prioritária
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">{action.action}</p>
                      <p className="text-sm opacity-80">{action.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Relatório somente leitura — não altera dados do sistema</p>
          <p>Período: {format(parseISO(startDate), "dd/MM/yyyy", { locale: ptBR })} a {format(parseISO(endDate), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
