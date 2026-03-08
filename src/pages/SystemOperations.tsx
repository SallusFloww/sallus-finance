import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Heart,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  XCircle,
} from "lucide-react";
import { useSystemAlerts, type SystemAlert } from "@/hooks/useSystemAlerts";
import { useSystemHealthReport, type HealthReport } from "@/hooks/useSystemHealthReport";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { useGrowthMonitor } from "@/hooks/useGrowthMonitor";
import { APP_VERSION } from "@/contracts/version";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  if (status === "SYSTEM_OK" || status === "OK")
    return <Badge className="bg-green-600 text-white">{status}</Badge>;
  if (status === "SYSTEM_WARNING" || status === "WARNING")
    return <Badge className="bg-amber-500 text-white">{status}</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "CRITICAL") return <Badge variant="destructive">CRITICAL</Badge>;
  if (severity === "WARNING") return <Badge className="bg-amber-500 text-white">WARNING</Badge>;
  return <Badge variant="secondary">INFO</Badge>;
}

export default function SystemOperations() {
  const { alerts, loading: alertsLoading, fetchAlerts, resolveAlert, criticalCount, warningCount } = useSystemAlerts();
  const { report, loading: reportLoading, generateReport } = useSystemHealthReport();
  const { result: healthResult, loading: healthLoading, runHealthCheck } = useHealthCheck();
  const { tables: growthTables, loading: growthLoading, checkGrowth, hasWarnings: growthWarnings } = useGrowthMonitor();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      Promise.all([fetchAlerts(), generateReport(), checkGrowth()]);
    }
  }, [initialized]);

  const runAll = async () => {
    await Promise.all([fetchAlerts(), generateReport(), runHealthCheck(), checkGrowth()]);
  };

  const isLoading = alertsLoading || reportLoading || healthLoading || growthLoading;

  const overallStatus = report?.systemStatus || "UNKNOWN";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Server className="h-6 w-6 text-primary" />
              System Operations
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento de saúde, alertas e métricas do sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={overallStatus} />
            <Badge variant="outline">v{APP_VERSION}</Badge>
            <Button onClick={runAll} disabled={isLoading} variant="outline" size="sm" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar Tudo
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Heart className={`h-8 w-8 ${overallStatus === "SYSTEM_OK" ? "text-green-500" : overallStatus === "SYSTEM_WARNING" ? "text-amber-500" : "text-destructive"}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-bold text-lg">{overallStatus === "SYSTEM_OK" ? "Saudável" : overallStatus === "SYSTEM_WARNING" ? "Atenção" : "Crítico"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-8 w-8 ${criticalCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Alertas</p>
                  <p className="font-bold text-lg">{criticalCount} críticos / {warningCount} warnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className={`h-8 w-8 ${(report?.totalErrors24h || 0) > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Erros (24h)</p>
                  <p className="font-bold text-lg">{report?.totalErrors24h ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className={`h-8 w-8 ${report?.financialStatus === "OK" ? "text-green-500" : "text-amber-500"}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Integridade Financeira</p>
                  <p className="font-bold text-lg">{report?.financialStatus ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Health Check Results */}
        {healthResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Health Check
                <StatusBadge status={healthResult.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(healthResult.checks).map(([key, check]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {check.status === "OK" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : check.status === "WARNING" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</p>
                        {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
                      </div>
                    </div>
                    <StatusBadge status={check.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Database Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Crescimento do Banco
              {growthWarnings && <Badge variant="destructive">Atenção</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {growthTables.map((t) => (
                <div key={t.table} className={`p-4 rounded-lg border ${t.warning ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                  <p className="text-xs text-muted-foreground font-medium">{t.table}</p>
                  <p className={`text-2xl font-bold ${t.warning ? "text-amber-600" : ""}`}>
                    {t.count >= 0 ? t.count.toLocaleString("pt-BR") : "Erro"}
                  </p>
                  {t.warning && <p className="text-xs text-amber-600 mt-1">⚠️ Acima de 10.000</p>}
                </div>
              ))}
              {growthTables.length === 0 && !growthLoading && (
                <p className="text-sm text-muted-foreground col-span-4">Clique em "Atualizar Tudo" para verificar.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas do Sistema
              {alerts.length > 0 && <Badge variant="secondary">{alerts.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta pendente ✅</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <SeverityBadge severity={alert.severity} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => resolveAlert(alert.id)}>
                      Resolver
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Report Details */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Relatório de Saúde</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Última Verificação</p>
                  <p className="font-medium">{format(new Date(report.timestamp), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Erros (24h)</p>
                  <p className="font-medium">{report.totalErrors24h}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Alertas Ativos</p>
                  <p className="font-medium">{report.totalAlerts} ({report.criticalAlerts} críticos)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Integridade Financeira</p>
                  <p className="font-medium">{report.financialStatus}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status Geral</p>
                  <StatusBadge status={report.systemStatus} />
                </div>
                <div>
                  <p className="text-muted-foreground">Total Registros</p>
                  <p className="font-medium">
                    {Object.values(report.tableGrowth).reduce((a, b) => a + Math.max(b, 0), 0).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
