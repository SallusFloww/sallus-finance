import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Copy,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  Target,
  Clock,
  Activity,
  Calendar,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { generateMonthlyPDF } from "@/utils/generateMonthlyPDF";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ExportButton } from "@/components/ui/export-button";
import { useAuth } from "@/contexts/AuthContext";

function formatMoney(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { profile, currentCompany } = useAuth();

  const reportData = useMonthlyReport(selectedMonth);

  // Meses disponíveis (últimos 12 meses)
  const availableMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return months;
  }, []);

  const handleDownloadPDF = async () => {
    // Add company and user info to PDF
    generateMonthlyPDF({
      ...reportData,
      // The PDF already has good headers/footers
    });
  };

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(reportData.whatsappText);
    setCopied(true);
    toast.success("Texto copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Verifica se há base suficiente para cálculo do score
  const isScoreInFormation = reportData.score.globalScore === 0 || 
    (reportData.production.totalValue === 0 && reportData.billing.totalBilled === 0);

  const getScoreColor = (score: number) => {
    if (isScoreInFormation) return "text-slate-500";
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-green-500";
    if (score >= 55) return "text-amber-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number) => {
    if (isScoreInFormation) return "bg-slate-100 dark:bg-slate-800/30";
    if (score >= 85) return "bg-green-100 dark:bg-green-950/30";
    if (score >= 70) return "bg-green-50 dark:bg-green-950/20";
    if (score >= 55) return "bg-amber-50 dark:bg-amber-950/20";
    if (score >= 40) return "bg-orange-50 dark:bg-orange-950/20";
    return "bg-red-50 dark:bg-red-950/20";
  };

  // Verifica se há alertas críticos reais
  const hasCriticalAlerts = reportData.alerts.some(
    alert => alert.type === "critical" && reportData.aging.criticalPercentage > 0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Relatório Executivo Mensal
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão consolidada com PDF institucional e texto WhatsApp
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              {reportData.competenciaFormatted.charAt(0).toUpperCase() + reportData.competenciaFormatted.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Seletor de Mês + Ações */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Competência</Label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {availableMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <ExportButton
                  onExportPDF={handleDownloadPDF}
                  reportName="Relatório Executivo Mensal"
                  exportType="reports"
                  filters={{ competencia: selectedMonth }}
                />

                <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        Resumo para WhatsApp
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        value={reportData.whatsappText}
                        readOnly
                        className="min-h-[300px] font-mono text-xs"
                      />
                      <Button onClick={handleCopyWhatsapp} className="w-full gap-2">
                        {copied ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copiar Texto
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Principal */}
        <Card className={`border-2 ${getScoreBgColor(reportData.score.globalScore)}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={`text-center p-6 rounded-xl ${getScoreBgColor(reportData.score.globalScore)}`}>
                  {isScoreInFormation ? (
                    <>
                      <p className="text-3xl font-bold text-slate-500">—</p>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        SCORE EM FORMAÇÃO
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={`text-5xl font-bold ${getScoreColor(reportData.score.globalScore)}`}>
                        {reportData.score.globalScore}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground mt-1">
                        SCORE DO PERÍODO
                      </p>
                    </>
                  )}
                </div>
                <div>
                  {isScoreInFormation ? (
                    <div className="space-y-2">
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Em Formação
                      </Badge>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Dados ainda em consolidação para cálculo completo do indicador.
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        Este score será atualizado automaticamente conforme o histórico do período evoluir.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Badge
                        variant={reportData.score.globalScore >= 70 ? "default" : reportData.score.globalScore >= 55 ? "secondary" : "destructive"}
                        className="mb-2"
                      >
                        {reportData.score.globalLabel}
                      </Badge>
                      <div className="space-y-1">
                        {reportData.score.factors.slice(0, 3).map((factor, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {factor}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isScoreInFormation && (
                <div className="flex gap-4">
                  {reportData.score.unitScores.slice(0, 3).map((unit) => (
                    <div key={unit.unitName} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{unit.score}</p>
                      <p className="text-xs text-muted-foreground">{unit.unitName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Texto explicativo de escopo */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground text-center">
                Este indicador representa a avaliação do desempenho financeiro do período analisado.
              </p>
              <p className="text-xs text-muted-foreground/80 text-center">
                Ele não reflete a saúde financeira global da instituição, que é apurada em relatórios consolidados.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Saldo em Caixa</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatMoney(reportData.cash.currentBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resultado: {reportData.cash.netResult >= 0 ? "+" : ""}{formatMoney(reportData.cash.netResult)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Faturamento</p>
                  <p className="text-xl font-bold">
                    {formatMoney(reportData.billing.totalBilled)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Recebido: {reportData.billing.receiptRate.toFixed(0)}%
                  </p>
                </div>
                <Banknote className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Produção</p>
                  <p className="text-xl font-bold">
                    {formatMoney(reportData.production.totalValue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {reportData.production.totalQuantity} procedimentos
                  </p>
                </div>
                <Activity className="h-8 w-8 text-violet-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Em Aberto</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatMoney(reportData.aging.totalOpen)}
                  </p>
                  {reportData.aging.criticalPercentage > 0 ? (
                    <p className="text-xs text-red-600 mt-1">
                      {reportData.aging.criticalPercentage.toFixed(0)}% crítico ({">"}60d)
                    </p>
                  ) : (
                    <p className="text-xs text-green-600 mt-1">
                      Risco atual: 0% ({">"}60d)
                    </p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversão Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex flex-col">
                    <span>Produção → Faturamento</span>
                    <span className="text-xs text-muted-foreground">Produção realizada que já foi faturada</span>
                  </div>
                  <span className="font-medium">{reportData.operationalKPIs.productionToBillingConversion.toFixed(1)}%</span>
                </div>
                <Progress value={reportData.operationalKPIs.productionToBillingConversion} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex flex-col">
                    <span>Faturamento → Recebimento</span>
                    <span className="text-xs text-muted-foreground">Valores faturados efetivamente recebidos</span>
                  </div>
                  <span className="font-medium">{reportData.operationalKPIs.billingToReceiptConversion.toFixed(1)}%</span>
                </div>
                <Progress value={reportData.operationalKPIs.billingToReceiptConversion} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex flex-col">
                    <span className="font-medium">Conversão Total</span>
                    <span className="text-xs text-muted-foreground">Relação entre produção realizada e valores recebidos no período</span>
                  </div>
                  <span className="font-bold">{reportData.operationalKPIs.totalConversion.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={Math.min(reportData.operationalKPIs.totalConversion, 100)} 
                  className="h-3 [&>div]:bg-green-500"
                />
                {reportData.operationalKPIs.totalConversion > 100 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Inclui recebimentos de períodos anteriores
                  </p>
                )}
              </div>

              {/* Tooltip explicativo */}
              <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/30">
                Percentuais podem ultrapassar 100% quando há recebimento de valores de períodos anteriores.
              </p>

              {reportData.operationalKPIs.lossAmount > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-600 font-medium flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      Perda no Funil
                    </span>
                    <span className="font-bold text-red-600">
                      {formatMoney(reportData.operationalKPIs.lossAmount)} ({reportData.operationalKPIs.lossPercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alertas do Período
          </h2>
          {reportData.alerts.length > 0 && hasCriticalAlerts ? (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <span className="font-medium">Atenção:</span> existem valores relevantes ainda não faturados.
                <span className="block text-sm mt-1 text-amber-700 dark:text-amber-400">
                  Recomenda-se priorizar a regularização para melhorar o desempenho do período.
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Nenhum risco crítico identificado no período analisado.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Próximas Ações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Próximas Melhores Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportData.nextActions.map((action, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    action.priority === "high"
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                      : action.priority === "medium"
                      ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                      : "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      action.priority === "high"
                        ? "bg-red-200 text-red-700"
                        : action.priority === "medium"
                        ? "bg-amber-200 text-amber-700"
                        : "bg-blue-200 text-blue-700"
                    }`}>
                      <span className="font-bold">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">Ação: {action.action}</p>
                      <p className="text-sm text-muted-foreground">Impacto estimado: {action.impact}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      action.priority === "high"
                        ? "destructive"
                        : action.priority === "medium"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    Prioridade: {action.priority === "high" ? "Alta" : action.priority === "medium" ? "Média" : "Baixa"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4 space-y-1 border-t border-border/30 mt-6">
          <p>Relatório gerado automaticamente pelo SallusFlow.</p>
          <p>
            Dados consolidados até {format(new Date(reportData.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
          </p>
          <p className="text-muted-foreground/70">Uso exclusivo para acompanhamento gerencial.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
