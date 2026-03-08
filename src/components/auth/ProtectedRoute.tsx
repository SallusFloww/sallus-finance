import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  allowNoCompany?: boolean;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  allowNoCompany = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, currentCompany, dataLoaded, signOut } = useAuth();
  const location = useLocation();

  // Show loading state while auth is being determined
  if (isLoading || !dataLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Usuário logado mas ainda sem empresa selecionada/associada
  if (!currentCompany) {
    if (allowNoCompany) {
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <Clock className="h-12 w-12 mx-auto mb-4 text-warning" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Aguardando Aprovação</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta foi criada com sucesso! Um administrador precisa aprovar seu acesso antes que você possa utilizar o sistema.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Verificar novamente
            </Button>
            <Button
              variant="ghost"
              onClick={() => signOut()}
              className="w-full text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Checar permissão só quando já existe empresa
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => window.history.back()}
            className="text-primary hover:underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
