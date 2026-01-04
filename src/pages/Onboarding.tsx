// ============================================
// ONBOARDING PAGE - SAAS MULTIEMPRESA
// Release freeze: only bugfixes allowed
// ============================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Building2, ArrowRight, Loader2, Check, Briefcase, Heart, Factory, Sparkles, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const companySchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  cnpj: z.string().trim().optional(),
  segment: z.enum(["saude", "servicos", "industria", "outro"]),
});

const SEGMENTS = [
  { id: "saude", name: "Saúde", icon: Heart, description: "Clínicas, hospitais, laboratórios" },
  { id: "servicos", name: "Serviços", icon: Briefcase, description: "Consultorias, agências, escritórios" },
  { id: "industria", name: "Indústria", icon: Factory, description: "Manufatura, produção" },
  { id: "outro", name: "Outro", icon: Sparkles, description: "Outros segmentos" },
] as const;

type OnboardingStep = "loading" | "welcome" | "company" | "creating" | "complete" | "error";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, currentCompany, isLoading: authLoading, reloadUserData, signOut, dataLoaded } = useAuth();
  const hasNavigated = useRef(false);

  const [step, setStep] = useState<OnboardingStep>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("Verificando seu acesso...");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    cnpj: "",
    segment: "saude" as "saude" | "servicos" | "industria" | "outro",
  });

  // Gatekeeper: Check user status on mount
  useEffect(() => {
    // Prevent duplicate navigation
    if (hasNavigated.current) return;

    if (authLoading || !dataLoaded) {
      setStep("loading");
      setStatusMessage("Finalizando seu acesso...");
      return;
    }

    if (!user) {
      hasNavigated.current = true;
      navigate("/auth", { replace: true });
      return;
    }

    if (currentCompany) {
      hasNavigated.current = true;
      setStatusMessage("Tudo certo! Entrando no painel...");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 300);
      return;
    }

    // User has no company - show welcome
    setStep("welcome");
  }, [authLoading, user, currentCompany, navigate, dataLoaded]);

  const handleRetry = () => {
    setStep("company");
    setErrorDetails(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setErrorDetails(null);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      navigate("/auth", { replace: true });
      return;
    }

    const result = companySchema.safeParse(companyForm);
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
    setStep("creating");
    setStatusMessage("Criando sua empresa...");

    try {
      // 1. Create company
      setStatusMessage("Registrando empresa...");
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: companyForm.name.trim(),
          cnpj: companyForm.cnpj.trim() || null,
        })
        .select()
        .single();

      if (companyError) {
        throw new Error(`Erro ao criar empresa: ${companyError.message}`);
      }

      if (!company) {
        throw new Error("Empresa não foi criada corretamente");
      }

      // 2. Update company_settings with segment (created by trigger)
      setStatusMessage("Configurando preferências...");
      const { error: settingsError } = await supabase
        .from("company_settings")
        .update({ segment: companyForm.segment })
        .eq("company_id", company.id);

      if (settingsError) {
        // Non-fatal, continue
      }

      // 3. Create Admin role for this company
      setStatusMessage("Criando perfis de acesso...");
      const { data: role, error: roleError } = await supabase
        .from("roles")
        .insert({
          company_id: company.id,
          name: "Admin",
          description: "Administrador com acesso total",
          is_system: true,
        })
        .select()
        .single();

      if (roleError) {
        throw new Error(`Erro ao criar perfil de administrador: ${roleError.message}`);
      }

      if (!role) {
        throw new Error("Perfil de administrador não foi criado");
      }

      // 4. Create additional roles (non-blocking)
      try {
        await supabase
          .from("roles")
          .insert([
            {
              company_id: company.id,
              name: "Gestor",
              description: "Gestor com acesso operacional",
              is_system: true,
            },
            {
              company_id: company.id,
              name: "Leitor",
              description: "Acesso apenas para visualização",
              is_system: true,
            },
          ]);
      } catch (e) {
        // Non-fatal warning suppressed
      }

      // 5. Assign current user as Admin
      setStatusMessage("Vinculando seu usuário...");
      const { error: assignError } = await supabase
        .from("user_company_roles")
        .insert({
          user_id: user.id,
          company_id: company.id,
          role_id: role.id,
          is_primary: true,
        });

      if (assignError) {
        throw new Error(`Erro ao vincular usuário: ${assignError.message}`);
      }

      // 6. Get all permissions and assign to Admin role (non-blocking)
      setStatusMessage("Configurando permissões...");
      try {
        const { data: permissions } = await supabase
          .from("permissions")
          .select("id");

        if (permissions && permissions.length > 0) {
          const rolePermissions = permissions.map((p) => ({
            role_id: role.id,
            permission_id: p.id,
          }));

          await supabase
            .from("role_permissions")
            .insert(rolePermissions);
        }
      } catch (e) {
        // Non-fatal warning suppressed
      }

      setStep("complete");
      setStatusMessage("Tudo pronto!");
      toast.success("Empresa criada com sucesso!");

      // Reload user data to get the new company
      await reloadUserData();
      
      // Navigate after data is loaded
      setTimeout(() => {
        hasNavigated.current = true;
        window.location.href = "/";
      }, 1500);

    } catch (error: any) {
      setStep("error");
      
      // User-friendly error messages
      let errorMessage = "Erro ao criar empresa. Tente novamente.";
      if (error.message?.includes("row-level security") || error.message?.includes("permission")) {
        errorMessage = "Erro de permissão. Por favor, saia e entre novamente.";
      } else if (error.message?.includes("duplicate")) {
        errorMessage = "Uma empresa com este nome já existe.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrorDetails(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (step === "loading" || step === "creating") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Loader2 className="h-10 w-10 animate-spin text-primary-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground mb-2">{statusMessage}</p>
          <p className="text-sm text-muted-foreground">Aguarde um momento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-destructive/50 bg-card p-8 shadow-soft text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Ops! Algo deu errado
            </h2>
            <p className="text-muted-foreground mb-4">
              {errorDetails || "Não foi possível criar sua empresa."}
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleRetry} className="w-full gradient-primary gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={handleLogout} variant="outline" className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sair e entrar novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="animate-scale-in rounded-2xl border border-border bg-card p-8 shadow-soft">
          {/* Welcome Step */}
          {step === "welcome" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <span className="text-3xl font-bold text-primary-foreground">IM</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Bem-vindo ao IMEC Saúde!
              </h1>
              <p className="text-muted-foreground mb-2">
                Olá, {profile?.full_name || user?.email?.split('@')[0] || "usuário"}!
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Vamos criar sua empresa para começar a usar o sistema.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => setStep("company")} className="gradient-primary gap-2">
                  Começar
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          )}

          {/* Company Step */}
          {step === "company" && (
            <div>
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Cadastre sua Empresa</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Informe os dados para continuar
                </p>
              </div>

              <form onSubmit={handleCreateCompany} className="space-y-5">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nome da Empresa *</Label>
                  <Input
                    id="company-name"
                    type="text"
                    placeholder="Nome da sua empresa"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    disabled={isLoading}
                    autoFocus
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                {/* CNPJ */}
                <div className="space-y-2">
                  <Label htmlFor="company-cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="company-cnpj"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })}
                    disabled={isLoading}
                  />
                  {errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj}</p>}
                </div>

                {/* Segment */}
                <div className="space-y-3">
                  <Label>Segmento</Label>
                  <RadioGroup
                    value={companyForm.segment}
                    onValueChange={(value) => setCompanyForm({ ...companyForm, segment: value as any })}
                    className="grid grid-cols-2 gap-3"
                  >
                    {SEGMENTS.map((segment) => {
                      const Icon = segment.icon;
                      const isSelected = companyForm.segment === segment.id;
                      return (
                        <Label
                          key={segment.id}
                          htmlFor={`segment-${segment.id}`}
                          className={`
                            flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all
                            ${isSelected 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }
                          `}
                        >
                          <RadioGroupItem value={segment.id} id={`segment-${segment.id}`} className="sr-only" />
                          <Icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {segment.name}
                          </span>
                          <span className="text-xs text-muted-foreground text-center">
                            {segment.description}
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                  {errors.segment && <p className="text-sm text-destructive">{errors.segment}</p>}
                </div>

                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Criar e Entrar
                </Button>

                <div className="text-center">
                  <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground">
                    <LogOut className="h-4 w-4 mr-2" />
                    Usar outra conta
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Tudo pronto!
              </h2>
              <p className="text-muted-foreground mb-4">
                Sua empresa foi criada com sucesso. Entrando no painel...
              </p>
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
