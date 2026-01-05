import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Trash2, 
  Database, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { useQATests, QATestResult } from "@/hooks/useQATests";
import { toast } from "sonner";

function TestResultRow({ test }: { test: QATestResult }) {
  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    pass: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    fail: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const statusBadge = {
    pending: <Badge variant="secondary">Aguardando</Badge>,
    running: <Badge variant="default">Executando...</Badge>,
    pass: <Badge className="bg-green-600 hover:bg-green-700">PASS</Badge>,
    fail: <Badge variant="destructive">FAIL</Badge>,
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        {statusIcon[test.status]}
        <div>
          <p className="font-medium text-foreground">{test.name}</p>
          {test.message && (
            <p className="text-sm text-muted-foreground">{test.message}</p>
          )}
          {test.details && (
            <p className="text-xs text-muted-foreground mt-1">{test.details}</p>
          )}
        </div>
      </div>
      {statusBadge[test.status]}
    </div>
  );
}

export default function QA() {
  const {
    testResults,
    isRunning,
    runTests,
    createSeedData,
    cleanupTestData,
    seedResult,
    cleanupResult,
    summary,
  } = useQATests();

  const handleSeed = async () => {
    toast.info("Criando dados de teste...");
    const result = await createSeedData();
    if (result.success) {
      toast.success(`Criados: ${result.entradas} entradas e ${result.saidas} saídas`);
    } else {
      toast.error(`Erro: ${result.error}`);
    }
  };

  const handleCleanup = async () => {
    toast.info("Limpando dados de teste...");
    const result = await cleanupTestData();
    if (result.success) {
      toast.success(`${result.deleted} registros marcados como cancelados`);
    } else {
      toast.error(`Erro: ${result.error}`);
    }
  };

  const handleRunTests = async () => {
    toast.info("Iniciando testes...");
    await runTests();
    toast.success("Testes concluídos!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">QA Automatizado</h1>
          <p className="text-muted-foreground">
            Teste de integridade do sistema financeiro
          </p>
        </div>

        {/* Warning */}
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Ambiente de Teste
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Dados de seed são marcados com <code className="px-1 bg-amber-200 dark:bg-amber-800 rounded">[QA]</code> na observação.
                  Use "Limpar dados QA" para remover apenas esses registros.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Dados de Teste
              </CardTitle>
              <CardDescription>
                Cria 5 entradas e 5 saídas com variações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSeed} className="w-full" disabled={isRunning}>
                <Database className="h-4 w-4 mr-2" />
                Criar dados de teste
              </Button>
              {seedResult && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {seedResult.success 
                    ? `✅ ${seedResult.entradas + seedResult.saidas} registros criados`
                    : `❌ ${seedResult.error}`
                  }
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="h-4 w-4" />
                Testes de Fluxo
              </CardTitle>
              <CardDescription>
                CRUD, permissões e regras de saldo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleRunTests} 
                className="w-full" 
                variant="default"
                disabled={isRunning}
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isRunning ? "Executando..." : "Rodar testes"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Limpeza
              </CardTitle>
              <CardDescription>
                Remove apenas registros [QA]
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCleanup} 
                className="w-full" 
                variant="outline"
                disabled={isRunning}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar dados QA
              </Button>
              {cleanupResult && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {cleanupResult.success 
                    ? `✅ ${cleanupResult.deleted} registros cancelados`
                    : `❌ ${cleanupResult.error}`
                  }
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resultados</CardTitle>
                  <CardDescription>
                    {summary.passed}/{summary.total} testes passaram
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {summary.passed} PASS
                  </Badge>
                  {summary.failed > 0 && (
                    <Badge variant="destructive">
                      {summary.failed} FAIL
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="space-y-1">
                {testResults.map((test) => (
                  <TestResultRow key={test.name} test={test} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {testResults.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum teste executado
              </h3>
              <p className="text-muted-foreground mb-4">
                Clique em "Rodar testes" para verificar a integridade do sistema
              </p>
              <Button onClick={handleRunTests} disabled={isRunning}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar testes
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
