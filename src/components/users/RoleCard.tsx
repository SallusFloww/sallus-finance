import { cn } from "@/lib/utils";
import { Check, X, Shield, Settings, User, Wallet, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface RolePermission {
  text: string;
  allowed: boolean;
}

export interface RoleConfig {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: React.ElementType;
  permissions: RolePermission[];
  colorClass: string;
  badgeClass: string;
  iconBgClass: string;
  level: "alto" | "medio" | "basico";
}

export const ROLE_CONFIGS: Record<string, Omit<RoleConfig, "id">> = {
  Admin: {
    name: "Administrador",
    description: "Acesso total ao sistema",
    badge: "ADMIN",
    icon: Shield,
    level: "alto",
    colorClass: "border-role-admin/30 bg-role-admin/5 hover:bg-role-admin/10",
    badgeClass: "bg-role-admin text-role-admin-foreground",
    iconBgClass: "bg-role-admin text-role-admin-foreground",
    permissions: [
      { text: "Gerencia usuários", allowed: true },
      { text: "Acessa todas as áreas", allowed: true },
      { text: "Controla permissões", allowed: true },
      { text: "Configura parâmetros do sistema", allowed: true },
      { text: "Visualiza relatórios completos", allowed: true },
    ],
  },
  Gestor: {
    name: "Gestor",
    description: "Gerencia operações e relatórios",
    badge: "GESTOR",
    icon: Settings,
    level: "medio",
    colorClass: "border-role-gestor/30 bg-role-gestor/5 hover:bg-role-gestor/10",
    badgeClass: "bg-role-gestor text-role-gestor-foreground",
    iconBgClass: "bg-role-gestor text-role-gestor-foreground",
    permissions: [
      { text: "Acessa dados operacionais", allowed: true },
      { text: "Visualiza relatórios", allowed: true },
      { text: "Acompanha desempenho", allowed: true },
      { text: "Gerenciar usuários", allowed: false },
      { text: "Alterar configurações globais", allowed: false },
    ],
  },
  Operacional: {
    name: "Operacional",
    description: "Executa tarefas operacionais",
    badge: "OPERACIONAL",
    icon: User,
    level: "medio",
    colorClass: "border-role-operacional/30 bg-role-operacional/5 hover:bg-role-operacional/10",
    badgeClass: "bg-role-operacional text-role-operacional-foreground",
    iconBgClass: "bg-role-operacional text-role-operacional-foreground",
    permissions: [
      { text: "Insere e consulta dados", allowed: true },
      { text: "Consulta informações operacionais", allowed: true },
      { text: "Sem acesso administrativo", allowed: false },
      { text: "Acessar configurações", allowed: false },
      { text: "Visualizar dados sensíveis", allowed: false },
    ],
  },
  Financeiro: {
    name: "Financeiro",
    description: "Acesso a módulos financeiros",
    badge: "FINANCEIRO",
    icon: Wallet,
    level: "medio",
    colorClass: "border-role-financeiro/30 bg-role-financeiro/5 hover:bg-role-financeiro/10",
    badgeClass: "bg-role-financeiro text-role-financeiro-foreground",
    iconBgClass: "bg-role-financeiro text-role-financeiro-foreground",
    permissions: [
      { text: "Visualiza relatórios financeiros", allowed: true },
      { text: "Acompanha indicadores", allowed: true },
      { text: "Alterar cadastros", allowed: false },
      { text: "Acessar dados operacionais", allowed: false },
      { text: "Gerenciar usuários", allowed: false },
    ],
  },
  Leitura: {
    name: "Leitura",
    description: "Acesso somente leitura",
    badge: "LEITURA",
    icon: Eye,
    level: "basico",
    colorClass: "border-role-leitura/30 bg-role-leitura/5 hover:bg-role-leitura/10",
    badgeClass: "bg-role-leitura text-role-leitura-foreground",
    iconBgClass: "bg-role-leitura text-role-leitura-foreground",
    permissions: [
      { text: "Visualiza dados básicos", allowed: true },
      { text: "Criar, editar ou excluir dados", allowed: false },
      { text: "Acessar configurações", allowed: false },
      { text: "Gerenciar usuários", allowed: false },
    ],
  },
};

interface RoleCardProps {
  roleId: string;
  roleName: string;
  isSelected: boolean;
  onSelect: (roleId: string) => void;
  disabled?: boolean;
}

export function RoleCard({ roleId, roleName, isSelected, onSelect, disabled }: RoleCardProps) {
  const config = ROLE_CONFIGS[roleName];
  
  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(roleId)}
      disabled={disabled}
      className={cn(
        "relative w-full p-4 rounded-xl border-2 text-left transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        config.colorClass,
        isSelected && "ring-2 ring-ring ring-offset-2 shadow-md",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center shadow-sm",
          config.iconBgClass
        )}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{config.name}</h3>
            <Badge className={cn("text-xs", config.badgeClass)}>
              {config.badge}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {config.description}
          </p>
        </div>
      </div>

      {/* Permissions list */}
      <div className="space-y-1.5">
        {config.permissions.map((perm, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-2 text-sm",
              perm.allowed ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {perm.allowed ? (
              <Check className="h-4 w-4 text-success flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 text-destructive/60 flex-shrink-0" />
            )}
            <span className={cn(!perm.allowed && "line-through opacity-70")}>
              {perm.text}
            </span>
          </div>
        ))}
      </div>

      {/* Level indicator */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Nível de acesso:</span>
          <span className={cn(
            "font-medium uppercase tracking-wide",
            config.level === "alto" && "text-primary",
            config.level === "medio" && "text-warning",
            config.level === "basico" && "text-muted-foreground"
          )}>
            {config.level}
          </span>
        </div>
      </div>
    </button>
  );
}
