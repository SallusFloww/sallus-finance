import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import sallusLogo from "@/assets/logo-sallusfinance.svg";

// UUID v4 regex validation
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const InviteRedirect = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setIsValid(false);
      return;
    }

    const valid = UUID_V4_REGEX.test(token);
    setIsValid(valid);

    if (valid) {
      // Small delay to show loading state, then redirect
      const timeout = setTimeout(() => {
        navigate(`/auth?invite=${token}`, { replace: true });
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [token, navigate]);

  // Loading state (while validating or redirecting)
  if (isValid === null || isValid === true) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <img src={sallusLogo} alt="SallusFinance" className="h-12 w-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Carregando convite…
            </h1>
            <p className="text-muted-foreground text-sm">
              Aguarde, estamos preparando seu acesso.
            </p>
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Error state (invalid token)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <img src={sallusLogo} alt="SallusFinance" className="h-12 w-auto" />
        
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            Convite inválido ou expirado
          </h1>
          <p className="text-muted-foreground text-sm">
            O link que você acessou não é válido. Solicite um novo convite ao administrador do sistema.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button asChild>
            <Link to="/auth">Ir para o Login</Link>
          </Button>
          <Button variant="outline" asChild>
            <a 
              href="https://wa.me/5562999999999?text=Olá, preciso de ajuda com meu convite do SallusFinance" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Suporte
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InviteRedirect;
