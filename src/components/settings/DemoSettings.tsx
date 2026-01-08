import { useState } from "react";
import { AlertTriangle, RefreshCw, Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function DemoSettings() {
  const { isAdmin, isDemo, switchCompany, companies, currentCompany, resetDemoCompany, reloadUserData } = useAuth();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [lastResetResult, setLastResetResult] = useState<{
    deleted?: Record<string, number>;
    seeded?: Record<string, number>;
  } | null>(null);

  // Find demo company
  const demoCompany = companies.find((c) => c.company.is_demo === true);
  const realCompanies = companies.filter((c) => !c.company.is_demo);
  const isCurrentlyDemo = isDemo();

  if (!isAdmin()) {
    return null;
  }

  const handleEnterDemo = async () => {
    if (demoCompany) {
      await switchCompany(demoCompany.company.id);
      toast.success("Modo DEMO ativado");
    }
  };

  const handleExitDemo = async () => {
    const firstReal = realCompanies[0];
    if (firstReal) {
      await switchCompany(firstReal.company.id);
      toast.success("Voltou para empresa real");
    }
  };

  const handleResetDemo = async () => {
    if (confirmText.toLowerCase().trim() !== "reset demo") {
      toast.error("Digite 'RESET DEMO' para confirmar");
      return;
    }

    setIsResetting(true);
    setLastResetResult(null);

    try {
      const result = await resetDemoCompany(confirmText);

      if (result.ok) {
        setLastResetResult({
          deleted: result.deleted,
          seeded: result.seeded,
        });
        toast.success("Empresa DEMO resetada com sucesso!");
        setConfirmText("");
        
        // Invalidar todas as queries para forçar refetch dos dados
        await queryClient.invalidateQueries();
        
        // Reload auth data
        await reloadUserData();
      } else {
        toast.error(result.error || "Erro ao resetar DEMO");
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          Modo Demonstração
        </CardTitle>
        <CardDescription>
          Ambiente seguro para testes. Os dados são fictícios e podem ser resetados a qualquer momento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status atual */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
          <div className={`h-3 w-3 rounded-full ${isCurrentlyDemo ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span className="font-medium">
            Empresa atual: {currentCompany?.name}
          </span>
          {isCurrentlyDemo && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
              DEMO
            </span>
          )}
        </div>

        {/* Botões de troca */}
        <div className="flex flex-wrap gap-2">
          {!isCurrentlyDemo && demoCompany && (
            <Button variant="outline" onClick={handleEnterDemo} className="border-amber-500 text-amber-600 hover:bg-amber-50">
              <Play className="h-4 w-4 mr-2" />
              Entrar no Modo DEMO
            </Button>
          )}

          {isCurrentlyDemo && realCompanies.length > 0 && (
            <Button variant="outline" onClick={handleExitDemo} className="border-emerald-500 text-emerald-600 hover:bg-emerald-50">
              <CheckCircle className="h-4 w-4 mr-2" />
              Voltar para Empresa Real
            </Button>
          )}
        </div>

        {/* Reset DEMO (só aparece se estiver no modo demo) */}
        {isCurrentlyDemo && (
          <div className="space-y-3 pt-4 border-t">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> O reset irá apagar todos os dados transacionais da empresa DEMO e criar um novo conjunto de dados fictícios.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Input
                placeholder='Digite "RESET DEMO" para confirmar'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="destructive"
                onClick={handleResetDemo}
                disabled={isResetting || confirmText.toLowerCase().trim() !== "reset demo"}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resetar DEMO
                  </>
                )}
              </Button>
            </div>

            {/* Resultado do último reset */}
            {lastResetResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                <p className="font-medium text-emerald-800 mb-2">✅ Reset concluído!</p>
                <div className="grid grid-cols-2 gap-2 text-emerald-700">
                  <div>
                    <p className="font-medium">Registros removidos:</p>
                    <ul className="list-disc list-inside text-xs">
                      {Object.entries(lastResetResult.deleted || {}).map(([table, count]) => (
                        <li key={table}>{table}: {count}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Registros criados:</p>
                    <ul className="list-disc list-inside text-xs">
                      {Object.entries(lastResetResult.seeded || {}).map(([table, count]) => (
                        <li key={table}>{table}: {count}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aviso se não existe empresa DEMO */}
        {!demoCompany && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Empresa DEMO não configurada. Entre em contato com o suporte.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
