import { Navigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isLoading, currentRole, currentCompany, dataLoaded, signOut } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  const isAdmin = currentRole?.name === "Admin";

  // Show toast once when access is denied
  useEffect(() => {
    if (!isLoading && dataLoaded && isAuthenticated && currentCompany && !isAdmin && !toastShown.current) {
      toastShown.current = true;
      toast.error("Acesso restrito. Apenas administradores podem acessar esta área.");
    }
  }, [isLoading, dataLoaded, isAuthenticated, isAdmin, currentCompany]);

  // Show loading state
  if (isLoading || !dataLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Show no access if user has no company
  if (!currentCompany) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Indisponível</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta não está vinculada a nenhuma empresa ativa ou foi desativada.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // Redirect to dashboard if not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}