import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { secureInvoke } from "@/hooks/useSecureInvoke";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { generateInviteUrl, getAppBaseUrl } from "@/utils/appUrl";
import {
  Users as UsersIcon,
  UserPlus,
  Mail,
  MoreHorizontal,
  Loader2,
  Clock,
  XCircle,
  Send,
  Trash2,
  UserCheck,
  UserX,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/utils/formatters";
import { RoleSelector, ROLE_CONFIGS, RoleSummaryCards, UserFilters } from "@/components/users";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Type for send-invite response
interface SendInviteResponse {
  success: boolean;
  emailSent?: boolean;
  inviteUrl?: string;
  emailError?: string;
  error?: string;
  reactivated?: boolean;
  message?: string;
  userId?: string;
}

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  roleId: z.string().uuid("Selecione um perfil"),
});

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  last_login: string | null;
  role_id: string;
  role_name: string;
  is_active: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  full_name: string;
  role_name: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export default function Users() {
  const { currentCompany, hasPermission, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [inviteForm, setInviteForm] = useState({
    email: "",
    fullName: "",
    roleId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  // Copy invite link to clipboard - uses centralized URL util
  const copyInviteLink = async (invite: PendingInvite) => {
    // We need to get the token from the invite - fetch it
    const { data, error } = await supabase
      .from("user_invites")
      .select("token")
      .eq("id", invite.id)
      .single();
    
    if (error || !data?.token) {
      toast.error("Erro ao obter link do convite");
      return;
    }

    // Use centralized invite URL generator (always uses production domain)
    const inviteUrl = generateInviteUrl(data.token);
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteId(invite.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const canManageUsers = hasPermission("CREATE_USERS") || hasPermission("EDIT_USERS");
  const canDeleteUsers = hasPermission("DELETE_USERS");

  // Fetch system roles (Admin, Gestor, Visualizador)
  const { data: roles = [] } = useQuery({
    queryKey: ["system-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, description")
        .eq("is_system", true)
        .order("name");
      if (error) throw error;
      // Filter to get unique roles by name (in case of duplicates)
      const uniqueRoles = data.reduce((acc: typeof data, role) => {
        if (!acc.find(r => r.name === role.name)) {
          acc.push(role);
        }
        return acc;
      }, []);
      return uniqueRoles;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch company users - separate queries since no FK between user_company_roles and profiles
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["company-users", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // First get user_company_roles with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_company_roles")
        .select(`
          user_id,
          role_id,
          is_active,
          roles(name)
        `)
        .eq("company_id", currentCompany.id);

      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(rolesData.map((r: any) => r.user_id))];

      // Then fetch profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, status, last_login")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles by id
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      // Combine the data
      return rolesData.map((item: any) => {
        const profile = profilesMap.get(item.user_id);
        return {
          id: profile?.id || item.user_id,
          email: profile?.email || "",
          full_name: profile?.full_name,
          status: profile?.status || "active",
          last_login: profile?.last_login,
          role_id: item.role_id,
          role_name: item.roles?.name || "Sem perfil",
          is_active: item.is_active ?? true,
        };
      }) as UserWithRole[];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch pending invites
  const { data: pendingInvites = [], isLoading: isLoadingInvites } = useQuery({
    queryKey: ["pending-invites", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("user_invites")
        .select(`
          id,
          email,
          full_name,
          status,
          expires_at,
          created_at,
          roles(name)
        `)
        .eq("company_id", currentCompany.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        email: item.email,
        full_name: item.full_name,
        role_name: item.roles?.name || "Sem perfil",
        status: item.status,
        expires_at: item.expires_at,
        created_at: item.created_at,
      })) as PendingInvite[];
    },
    enabled: !!currentCompany?.id,
  });

  // Send invite mutation (via edge function with robust error handling)
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; fullName: string; roleId: string }) => {
      if (!currentCompany?.id) throw new Error("Empresa não selecionada");

      const role = roles.find(r => r.id === data.roleId);
      
      try {
        const { data: result, error } = await secureInvoke<SendInviteResponse>("send-invite", {
          body: {
            email: data.email,
            fullName: data.fullName,
            companyId: currentCompany.id,
            roleId: data.roleId,
            companyName: currentCompany.name,
            roleName: role?.name || "Usuário",
            invitedByName: profile?.full_name || profile?.email || "Administrador",
          },
        });

        if (error) throw error;

        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro ao enviar convite";
        console.error("Erro no convite:", err);
        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setIsInviteOpen(false);
      setInviteForm({ email: "", fullName: "", roleId: "" });
      
      // Check if user was reactivated (existing user added to company)
      if (data?.reactivated) {
        toast.success(data.message || "Usuário adicionado à empresa com sucesso!");
        setActiveTab("users");
        return;
      }
      
      // Check if email was sent or not (new invite flow)
      setActiveTab("invites");
      if (data?.emailSent === false && data?.inviteUrl) {
        // Extract token from the URL returned by edge function
        const tokenMatch = data.inviteUrl.match(/\/i\/([a-f0-9-]+)/i) || 
                          data.inviteUrl.match(/invite=([a-f0-9-]+)/i);
        const token = tokenMatch?.[1];
        
        // Generate safe URL using centralized util (always production domain)
        const safeInviteUrl = token ? generateInviteUrl(token) : data.inviteUrl;
        
        toast("Convite criado. Copie o link abaixo e envie no WhatsApp.", {
          description: "O e-mail não foi enviado pois o SMTP não está configurado.",
          action: {
            label: "Copiar link",
            onClick: async () => {
              await navigator.clipboard.writeText(safeInviteUrl);
              toast.success("Link copiado!");
            },
          },
          duration: 10000,
        });
      } else {
        toast.success("Convite enviado por e-mail com sucesso!");
      }
    },
    onError: (error: Error) => {
      console.error("inviteMutation.onError:", error);
      toast.error(error.message || "Erro ao enviar convite");
    },
  });

  // Cancel invite mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("user_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      toast.success("Convite cancelado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao cancelar convite");
    },
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (invite: PendingInvite) => {
      try {
        // First cancel the old invite
        await supabase
          .from("user_invites")
          .update({ status: "cancelled" })
          .eq("id", invite.id);

        // Then create a new one via edge function
        const role = roles.find(r => r.name === invite.role_name);
        
        const { data: result, error } = await secureInvoke<SendInviteResponse>("send-invite", {
          body: {
            email: invite.email,
            fullName: invite.full_name,
            companyId: currentCompany?.id,
            roleId: role?.id,
            companyName: currentCompany?.name,
            roleName: invite.role_name,
            invitedByName: profile?.full_name || profile?.email || "Administrador",
          },
        });

        if (error) throw error;

        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro ao reenviar convite";
        console.error("Erro ao reenviar convite:", err);
        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      
      // Check if email was sent or not
      if (data?.emailSent === false && data?.inviteUrl) {
        // Extract token from the URL returned by edge function
        const tokenMatch = data.inviteUrl.match(/\/i\/([a-f0-9-]+)/i) || 
                          data.inviteUrl.match(/invite=([a-f0-9-]+)/i);
        const token = tokenMatch?.[1];
        
        // Generate safe URL using centralized util (always production domain)
        const safeInviteUrl = token ? generateInviteUrl(token) : data.inviteUrl;
        
        toast("Convite reenviado. Copie o link abaixo e envie no WhatsApp.", {
          description: "O e-mail não foi enviado pois o SMTP não está configurado.",
          action: {
            label: "Copiar link",
            onClick: async () => {
              await navigator.clipboard.writeText(safeInviteUrl);
              toast.success("Link copiado!");
            },
          },
          duration: 10000,
        });
      } else {
        toast.success("Convite reenviado por e-mail com sucesso!");
      }
    },
    onError: (error: Error) => {
      console.error("resendInviteMutation.onError:", error);
      toast.error(error.message || "Erro ao reenviar convite");
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!currentCompany?.id) throw new Error("Empresa não selecionada");

      const { error } = await supabase
        .from("user_company_roles")
        .update({ role_id: roleId })
        .eq("user_id", userId)
        .eq("company_id", currentCompany.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar perfil");
    },
  });

  // Remove user mutation (soft-delete: set is_active = false instead of physical delete)
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentCompany?.id) throw new Error("Empresa não selecionada");

      // Soft-delete: inactivate the user-company role instead of deleting
      const { error } = await supabase
        .from("user_company_roles")
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("company_id", currentCompany.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Usuário removido da empresa");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover usuário");
    },
  });

  // Toggle user active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      if (!currentCompany?.id) throw new Error("Empresa não selecionada");

      const { error } = await supabase
        .from("user_company_roles")
        .update({ is_active: isActive })
        .eq("user_id", userId)
        .eq("company_id", currentCompany.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success(variables.isActive ? "Usuário ativado" : "Usuário desativado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao alterar status do usuário");
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inviteSchema.safeParse(inviteForm);
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

    inviteMutation.mutate({
      email: result.data.email,
      fullName: result.data.fullName,
      roleId: result.data.roleId,
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  // Filter users based on search, role and status
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = user.full_name?.toLowerCase().includes(search);
        const matchesEmail = user.email.toLowerCase().includes(search);
        if (!matchesName && !matchesEmail) return false;
      }
      
      // Role filter
      if (filterRole && user.role_name !== filterRole) return false;
      
      // Status filter
      if (filterStatus === "active" && !user.is_active) return false;
      if (filterStatus === "inactive" && user.is_active) return false;
      
      return true;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  // Handle role card click to filter
  const handleRoleCardClick = (role: string | undefined) => {
    setFilterRole(role);
    setActiveTab("users");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <UsersIcon className="h-6 w-6 text-primary" />
              Gestão de Usuários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os usuários e convites da empresa {currentCompany?.name}
            </p>
          </div>

          {canManageUsers && (
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Convidar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Convidar Novo Usuário
                  </DialogTitle>
                  <DialogDescription>
                    O usuário receberá um email para criar sua senha e acessar o sistema.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleInvite} className="space-y-6">
                  {/* User info section */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={inviteForm.fullName}
                        onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                        placeholder="Nome do usuário"
                        disabled={inviteMutation.isPending}
                      />
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        placeholder="email@exemplo.com"
                        disabled={inviteMutation.isPending}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </div>

                  {/* Role selection with visual cards */}
                  <ScrollArea className="max-h-[400px] pr-4">
                    <RoleSelector
                      roles={roles}
                      selectedRoleId={inviteForm.roleId}
                      onSelect={(roleId) => setInviteForm({ ...inviteForm, roleId })}
                      disabled={inviteMutation.isPending}
                      error={errors.roleId}
                    />
                  </ScrollArea>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInviteOpen(false)}
                      disabled={inviteMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={inviteMutation.isPending || !inviteForm.roleId}
                    >
                      {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Enviar Convite
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Role Summary Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Perfis de Acesso</h2>
            <span className="text-sm text-muted-foreground">
              Clique em um perfil para filtrar
            </span>
          </div>
          <RoleSummaryCards
            users={users}
            selectedRole={filterRole}
            onRoleSelect={handleRoleCardClick}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <UsersIcon className="h-4 w-4" />
              Usuários ({users.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Mail className="h-4 w-4" />
              Convites Pendentes ({pendingInvites.filter(i => !isExpired(i.expires_at)).length})
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Usuários</CardTitle>
                    <CardDescription>
                      Lista de todos os usuários com acesso à {currentCompany?.name}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="self-start sm:self-auto">
                    {filteredUsers.length} de {users.length} usuários
                  </Badge>
                </div>
                
                {/* Filters */}
                <div className="pt-4">
                  <UserFilters
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    selectedRole={filterRole}
                    onRoleChange={setFilterRole}
                    selectedStatus={filterStatus}
                    onStatusChange={setFilterStatus}
                    roles={roles}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {users.length === 0 ? (
                      <>
                        <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum usuário encontrado</p>
                        <p className="text-sm mt-1">Clique em "Convidar Usuário" para adicionar</p>
                      </>
                    ) : (
                      <>
                        <p>Nenhum usuário corresponde aos filtros</p>
                        <Button 
                          variant="link" 
                          onClick={() => {
                            setSearchTerm("");
                            setFilterRole(undefined);
                            setFilterStatus(undefined);
                          }}
                        >
                          Limpar filtros
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Último Acesso</TableHead>
                        {canManageUsers && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const roleConfig = ROLE_CONFIGS[user.role_name];
                        return (
                          <TableRow key={user.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-full font-medium text-sm",
                                  roleConfig?.badgeClass || "bg-primary/10 text-primary"
                                )}>
                                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{user.full_name || "Sem nome"}</div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {canManageUsers ? (
                                      <Select
                                        value={user.role_id}
                                        onValueChange={(value) =>
                                          updateRoleMutation.mutate({ userId: user.id, roleId: value })
                                        }
                                      >
                                        <SelectTrigger className={cn(
                                          "w-36 border-2",
                                          roleConfig?.colorClass || ""
                                        )}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id}>
                                              {ROLE_CONFIGS[role.name]?.name || role.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge className={cn(roleConfig?.badgeClass || "")}>
                                        {roleConfig?.name || user.role_name}
                                      </Badge>
                                    )}
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs p-3">
                                    <p className="font-semibold mb-1">{roleConfig?.name || user.role_name}</p>
                                    <p className="text-xs text-muted-foreground">{roleConfig?.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={user.is_active ? "default" : "secondary"}
                                className={cn(
                                  user.is_active 
                                    ? "bg-success/10 text-success border border-success/20" 
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {user.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.last_login ? formatDate(user.last_login) : "Nunca"}
                            </TableCell>
                            {canManageUsers && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {user.is_active ? (
                                      <DropdownMenuItem
                                        onClick={() => toggleActiveMutation.mutate({ userId: user.id, isActive: false })}
                                      >
                                        <UserX className="h-4 w-4 mr-2" />
                                        Desativar Usuário
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => toggleActiveMutation.mutate({ userId: user.id, isActive: true })}
                                      >
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Ativar Usuário
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteUsers && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => removeMutation.mutate(user.id)}
                                          className="text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Remover da Empresa
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invites Tab */}
          <TabsContent value="invites">
            <Card>
              <CardHeader>
                <CardTitle>Convites Pendentes</CardTitle>
                <CardDescription>
                  Usuários que foram convidados mas ainda não criaram sua conta
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingInvites ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingInvites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum convite pendente</p>
                    <p className="text-sm mt-1">Clique em "Convidar Usuário" para adicionar novos membros</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Convidado</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvites.map((invite) => {
                        const expired = isExpired(invite.expires_at);
                        const roleConfig = ROLE_CONFIGS[invite.role_name];
                        return (
                          <TableRow key={invite.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-full font-medium text-sm",
                                  roleConfig?.badgeClass || "bg-warning/20 text-warning"
                                )}>
                                  {invite.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{invite.full_name}</div>
                                  <div className="text-sm text-muted-foreground">{invite.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(roleConfig?.badgeClass || "")}>
                                {roleConfig?.name || invite.role_name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {expired ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Expirado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                                  <Clock className="h-3 w-3" />
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invite.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyInviteLink(invite)}
                                  title="Copiar link do convite"
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="h-4 w-4 text-success" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => resendInviteMutation.mutate(invite)}
                                  disabled={resendInviteMutation.isPending}
                                  title="Reenviar convite"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => cancelInviteMutation.mutate(invite.id)}
                                  disabled={cancelInviteMutation.isPending}
                                  title="Cancelar convite"
                                  className="text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
