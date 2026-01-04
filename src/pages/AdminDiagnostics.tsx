// ============================================
// ADMIN DIAGNOSTICS PAGE
// Release freeze: only bugfixes allowed
// 
// Painel de diagnóstico de acesso (somente admin)
// ============================================

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  Building2, 
  Shield, 
  Key,
  RefreshCw,
  Loader2,
  Database
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, RELEASE_MODE } from "@/contracts/version";

interface DiagnosticCheck {
  id: string;
  label: string;
  status: "success" | "warning" | "error" | "loading";
  message: string;
  details?: string;
}

export default function AdminDiagnostics() {
  const { 
    user, 
    profile, 
    currentCompany, 
    currentRole, 
    permissions, 
    isAuthenticated,
    isAdmin 
  } = useAuth();

  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const newChecks: DiagnosticCheck[] = [];

    // 1. Check Authentication
    newChecks.push({
      id: "auth",
      label: "Autenticação",
      status: isAuthenticated ? "success" : "error",
      message: isAuthenticated ? "Usuário autenticado" : "Não autenticado",
      details: user?.email || undefined,
    });

    // 2. Check Profile
    newChecks.push({
      id: "profile",
      label: "Perfil do Usuário",
      status: profile ? "success" : "error",
      message: profile ? `${profile.full_name || profile.email}` : "Perfil não encontrado",
      details: profile?.status === "active" ? "Status: Ativo" : "Status: " + profile?.status,
    });

    // 3. Check Company
    newChecks.push({
      id: "company",
      label: "Empresa Vinculada",
      status: currentCompany ? "success" : "error",
      message: currentCompany ? currentCompany.name : "Nenhuma empresa vinculada",
      details: currentCompany?.status === "active" ? "Status: Ativa" : undefined,
    });

    // 4. Check Role
    newChecks.push({
      id: "role",
      label: "Role Atual",
      status: currentRole?.name === "Admin" ? "success" : currentRole ? "warning" : "error",
      message: currentRole ? currentRole.name : "Sem role definida",
      details: currentRole?.description || undefined,
    });

    // 5. Check Admin Access
    newChecks.push({
      id: "admin",
      label: "Acesso Admin",
      status: isAdmin() ? "success" : "warning",
      message: isAdmin() ? "Acesso administrativo confirmado" : "Sem acesso administrativo",
      details: isAdmin() ? "Pode acessar todas as rotas admin" : "Acesso restrito a rotas públicas",
    });

    // 6. Check Permissions Count
    newChecks.push({
      id: "permissions",
      label: "Permissões Carregadas",
      status: permissions.length > 0 || isAdmin() ? "success" : "warning",
      message: isAdmin() 
        ? "Admin tem todas as permissões" 
        : `${permissions.length} permissão(ões) encontrada(s)`,
      details: isAdmin() ? undefined : permissions.slice(0, 5).map(p => p.permission_code).join(", "),
    });

    // 7. Check Database Connection
    try {
      const { error } = await supabase.from("companies").select("count").limit(1);
      newChecks.push({
        id: "database",
        label: "Conexão com Banco",
        status: error ? "error" : "success",
        message: error ? "Erro de conexão" : "Conexão OK",
        details: error?.message || undefined,
      });
    } catch (err) {
      newChecks.push({
        id: "database",
        label: "Conexão com Banco",
        status: "error",
        message: "Erro ao verificar conexão",
      });
    }

    // 8. Check RLS Policies (via permission function)
    if (user && currentCompany) {
      try {
        const { data, error } = await supabase.rpc("has_permission", {
          _user_id: user.id,
          _company_id: currentCompany.id,
          _permission_code: "VIEW_DASHBOARD",
        });
        newChecks.push({
          id: "rls",
          label: "RLS Policies",
          status: error ? "warning" : "success",
          message: error ? "Erro ao verificar RLS" : "Funções RPC funcionando",
          details: error?.message || `has_permission: ${data ? "true" : "false"}`,
        });
      } catch {
        newChecks.push({
          id: "rls",
          label: "RLS Policies",
          status: "warning",
          message: "Não foi possível verificar RLS",
        });
      }
    }

    // 9. Check Admin Routes Access
    const adminRoutes = ["/settings", "/users", "/admin/diagnostics"];
    newChecks.push({
      id: "routes",
      label: "Rotas Administrativas",
      status: isAdmin() ? "success" : "warning",
      message: isAdmin() 
        ? "Acesso liberado a todas as rotas admin" 
        : "Acesso bloqueado a rotas admin",
      details: adminRoutes.join(", "),
    });

    // 10. Check Company Settings (Onboarding defaults)
    if (currentCompany) {
      try {
        const { data: settings, error } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", currentCompany.id)
          .maybeSingle();
        
        newChecks.push({
          id: "company_settings",
          label: "Configurações da Empresa",
          status: settings ? "success" : error ? "error" : "warning",
          message: settings 
            ? `Segmento: ${settings.segment || 'Não definido'}` 
            : error 
              ? "Erro ao carregar" 
              : "Configurações não encontradas",
          details: settings 
            ? `Moeda: ${settings.currency} | Fuso: ${settings.timezone}` 
            : undefined,
        });
      } catch {
        newChecks.push({
          id: "company_settings",
          label: "Configurações da Empresa",
          status: "warning",
          message: "Não foi possível verificar",
        });
      }
    }

    // 11. Check Onboarding Complete
    newChecks.push({
      id: "onboarding",
      label: "Onboarding Completo",
      status: currentCompany && currentRole ? "success" : "error",
      message: currentCompany && currentRole 
        ? "Usuário vinculado a empresa com role" 
        : "Onboarding incompleto",
      details: currentCompany 
        ? `Empresa: ${currentCompany.name} | Role: ${currentRole?.name || 'Sem role'}` 
        : "Sem empresa vinculada",
    });

    // 12. Check Dashboard Ready
    const dashboardReady = isAuthenticated && currentCompany && currentRole;
    newChecks.push({
      id: "dashboard",
      label: "Dashboard Pronto",
      status: dashboardReady ? "success" : "error",
      message: dashboardReady 
        ? "Dashboard carrega sem erros" 
        : "Pré-requisitos não atendidos",
      details: !dashboardReady 
        ? `Auth: ${isAuthenticated ? '✓' : '✗'} | Empresa: ${currentCompany ? '✓' : '✗'} | Role: ${currentRole ? '✓' : '✗'}` 
        : undefined,
    });

    // 13. Version Check
    newChecks.push({
      id: "version",
      label: "Versão do Sistema",
      status: "success",
      message: `v${APP_VERSION}`,
      details: `Modo: ${RELEASE_MODE === "production" ? "Produção" : "Desenvolvimento"}`,
    });

    setChecks(newChecks);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, [isAuthenticated, profile, currentCompany, currentRole, permissions]);

  const getStatusIcon = (status: DiagnosticCheck["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "loading":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: DiagnosticCheck["status"]) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-500">OK</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-amber-500 text-white">Atenção</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "loading":
        return <Badge variant="outline">Verificando...</Badge>;
    }
  };

  const successCount = checks.filter(c => c.status === "success").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const errorCount = checks.filter(c => c.status === "error").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Diagnóstico de Acesso
            </h1>
            <p className="text-sm text-muted-foreground">
              Verificação de autenticação, permissões e políticas de segurança
            </p>
          </div>
          <Button onClick={runDiagnostics} disabled={isRunning} variant="outline" className="gap-2">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Executar Novamente
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Usuário</p>
                  <p className="font-semibold truncate">{profile?.full_name || profile?.email || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-semibold truncate">{currentCompany?.name || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Key className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-semibold">{currentRole?.name || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Versão</p>
                  <p className="font-semibold">v{APP_VERSION}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resumo do Diagnóstico</span>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-500">{successCount} OK</Badge>
                {warningCount > 0 && (
                  <Badge variant="secondary" className="bg-amber-500 text-white">{warningCount} Atenção</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} Erro</Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {checks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <p className="font-medium">{check.label}</p>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                      {check.details && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{check.details}</p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(check.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permissions List */}
        {permissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Permissões Detalhadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {permissions.map((perm) => (
                  <Badge key={perm.permission_code} variant="outline" className="justify-start">
                    {perm.permission_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}