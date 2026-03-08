import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Mail, Lock, LogIn, Loader2, KeyRound, ArrowLeft, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoSallusFinance from "@/assets/logo-sallusfinance.svg";

// Validation schemas
const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
});

const resetSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
});

// Strong password schema with security requirements
const passwordSchema = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(100, "Senha muito longa")
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Senha deve conter pelo menos um caractere especial");

const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

const invitePasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

type AuthMode = "login" | "signup" | "forgot" | "reset" | "invite";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

interface InviteData {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  role_name: string;
  is_valid: boolean;
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, resetPassword, updatePassword, isAuthenticated, isLoading: authLoading, reloadUserData } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Invite state
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Form state
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" });
  const [inviteForm, setInviteForm] = useState({ password: "", confirmPassword: "" });

  // Check for invite token or reset mode from URL
  useEffect(() => {
    const mode = searchParams.get("mode");
    const invite = searchParams.get("invite");

    if (invite) {
      setInviteToken(invite);
      setActiveTab("invite");
      loadInviteData(invite);
    } else if (mode === "reset") {
      setActiveTab("reset");
    }
  }, [searchParams]);

  // Limpar errors quando activeTab mudar (higiene de estado)
  useEffect(() => {
    setErrors({});
  }, [activeTab]);

  // Load invite data
  const loadInviteData = async (token: string) => {
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_invite_token", {
        _token: token,
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        const inviteRow = data[0];
        // Mapear para InviteData - a RPC retorna status/expires_at, consideramos válido se retornou
        const invite: InviteData = {
          id: inviteRow.id,
          email: inviteRow.email,
          full_name: inviteRow.full_name,
          company_name: inviteRow.company_name,
          role_name: inviteRow.role_name,
          is_valid: true, // Se retornou, é válido (a query já filtra)
        };
        setInviteData(invite);
      } else {
        toast.error("Convite não encontrado ou expirado");
        setActiveTab("login");
      }
    } catch (err: any) {
      toast.error("Erro ao carregar convite");
      setActiveTab("login");
    } finally {
      setInviteLoading(false);
    }
  };

  // Redirect if already authenticated (except for password reset and invite)
  useEffect(() => {
    if (isAuthenticated && !authLoading && activeTab !== "reset" && activeTab !== "invite") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Confirme seu email antes de fazer login");
      } else if (error.message.includes("Conta inativa")) {
        toast.error("Conta inativa. Contate o administrador do sistema.");
      } else {
        toast.error(error.message || "Erro ao fazer login");
      }
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate("/", { replace: true });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = resetSchema.safeParse(forgotForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(forgotForm.email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message || "Erro ao enviar email de recuperação");
      return;
    }

    toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    setActiveTab("login");
    setForgotForm({ email: "" });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = newPasswordSchema.safeParse(resetForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(resetForm.password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message || "Erro ao redefinir senha");
      return;
    }

    toast.success("Senha redefinida com sucesso!");
    setActiveTab("login");
    setResetForm({ password: "", confirmPassword: "" });
    navigate("/auth", { replace: true });
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!inviteData || !inviteToken) {
      toast.error("Dados do convite inválidos");
      return;
    }

    const result = invitePasswordSchema.safeParse(inviteForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function to create user and link to company
      const { data: acceptResult, error: acceptError } = await supabase.functions.invoke("accept-invite", {
        body: {
          inviteToken: inviteToken,
          password: inviteForm.password,
        },
      });

      // Handle HTTP errors (network, 500, etc)
      if (acceptError) {
        throw new Error(acceptError.message || "Erro ao processar convite");
      }

      // REGRA: Tratar erros exclusivamente via acceptResult.code
      // Se success !== true, NÃO continuar o fluxo
      if (acceptResult?.success !== true) {
        const errorCode = acceptResult?.code;
        
        if (errorCode === "USER_EXISTS_LINKED") {
          toast.error("Este email já está cadastrado nesta empresa. Faça login com sua senha existente.");
          setActiveTab("login");
          setLoginForm({ email: inviteData.email, password: "" });
          setIsLoading(false);
          return;
        }
        
        if (errorCode === "INVITE_ALREADY_ACCEPTED") {
          toast.error("Este convite já foi utilizado. Faça login normalmente.");
          setActiveTab("login");
          setLoginForm({ email: inviteData.email, password: "" });
          setIsLoading(false);
          return;
        }
        
        if (errorCode === "INVITE_EXPIRED") {
          toast.error("Este convite expirou. Solicite um novo convite ao administrador.");
          setActiveTab("login");
          setIsLoading(false);
          return;
        }
        
        if (errorCode === "COMPANY_LINK_FAILED") {
          // Erro recuperável - usuário pode tentar novamente com o mesmo link
          toast.error("Sua conta foi criada, mas houve um erro ao vincular à empresa. Você pode tentar novamente com o mesmo link ou contatar o suporte.");
          setIsLoading(false);
          // NÃO redirecionar - permitir nova tentativa
          return;
        }
        
        // Outros erros
        throw new Error(acceptResult?.error || "Erro desconhecido ao processar convite");
      }

      // Invite accepted successfully

      // Verificar se usuário já existia (precisa fazer login com senha existente)
      if (acceptResult.userExists) {
        toast.success(acceptResult.message || "Acesso concedido! Faça login com sua senha.");
        setActiveTab("login");
        setLoginForm({ email: inviteData.email, password: "" });
        setIsLoading(false);
        return;
      }

      // NOVO FLUXO: NÃO fazer auto-login para evitar race conditions
      // Mostrar mensagem de sucesso e redirecionar para login
      toast.success("Conta criada com sucesso! Faça login para continuar.");
      setActiveTab("login");
      setLoginForm({ email: inviteData.email, password: "" });
      setInviteData(null);
      setInviteToken(null);

    } catch (err: any) {
      // Error accepting invite logged silently
      toast.error(err.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {inviteLoading ? "Carregando convite..." : "Carregando..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="animate-scale-in rounded-2xl border border-border bg-card p-8 shadow-soft">
          {/* Header */}
          <div className="mb-8 text-center">
            <img 
              src={logoSallusFinance} 
              alt="Sallus Finance" 
              className="mx-auto mb-4 h-16 w-auto"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="text-2xl font-bold text-foreground">
              <span className="text-primary">Sallus</span>
              <span className="text-secondary">Finance</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão Financeira Inteligente
            </p>
          </div>

          {/* Invite Accept Form */}
          {activeTab === "invite" && inviteData && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <UserPlus className="h-10 w-10 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Bem-vindo!</h2>
                <p className="text-sm text-muted-foreground">
                  Complete seu cadastro para acessar o sistema
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{inviteData.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium">{inviteData.company_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Perfil:</span>
                  <span className="font-medium">{inviteData.role_name}</span>
                </div>
              </div>

              <form onSubmit={handleAcceptInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Criar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="invite-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial
                  </p>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-confirm">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="invite-confirm"
                      type="password"
                      placeholder="Repita a senha"
                      value={inviteForm.confirmPassword}
                      onChange={(e) => setInviteForm({ ...inviteForm, confirmPassword: e.target.value })}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" className="w-full gradient-primary" disabled={isLoading || inviteLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Criar Conta
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    setInviteData(null);
                    setInviteToken(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Já tenho uma conta
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password Form */}
          {activeTab === "forgot" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <KeyRound className="h-10 w-10 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Esqueceu sua senha?</h2>
                <p className="text-sm text-muted-foreground">
                  Digite seu email para receber um link de recuperação
                </p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotForm.email}
                      onChange={(e) => setForgotForm({ email: e.target.value })}
                      className="pl-10"
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Enviar Link
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setActiveTab("login")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </form>
            </div>
          )}

          {/* Reset Password Form */}
          {activeTab === "reset" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Lock className="h-10 w-10 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Redefinir Senha</h2>
                <p className="text-sm text-muted-foreground">
                  Digite sua nova senha
                </p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-password">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={resetForm.password}
                      onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-confirm">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-confirm"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <KeyRound className="h-4 w-4 mr-2" />
                  )}
                  Redefinir Senha
                </Button>
              </form>
            </div>
          )}

          {/* Login Form (no signup tab) */}
          {activeTab === "login" && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="pl-10"
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Senha</Label>
                    <button
                      type="button"
                      onClick={() => setActiveTab("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-10"
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogIn className="h-4 w-4 mr-2" />
                  )}
                  Entrar
                </Button>
              </form>

              <div className="text-center pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Acesso restrito. Solicite um convite ao administrador do sistema.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
