import { cn } from "@/lib/utils";
import { Shield, Settings, User, Wallet, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoleSummaryCardProps {
  roleName: string;
  count: number;
  isHighlighted?: boolean;
  onClick?: () => void;
}

const ROLE_SUMMARY_CONFIG: Record<string, {
  name: string;
  icon: React.ElementType;
  description: string;
  permissions: string[];
  colorClass: string;
  iconBgClass: string;
  badgeClass: string;
}> = {
  Admin: {
    name: "Administrador",
    icon: Shield,
    description: "Acesso total ao sistema",
    permissions: ["Gerencia usuários", "Acessa todas as áreas", "Controla permissões"],
    colorClass: "border-role-admin/30 hover:border-role-admin/60 hover:shadow-md",
    iconBgClass: "bg-role-admin text-role-admin-foreground",
    badgeClass: "bg-role-admin/10 text-role-admin border-role-admin/20",
  },
  Gestor: {
    name: "Gestor",
    icon: Settings,
    description: "Gerencia operações e relatórios",
    permissions: ["Acessa dados operacionais", "Visualiza relatórios", "Não gerencia usuários"],
    colorClass: "border-role-gestor/30 hover:border-role-gestor/60 hover:shadow-md",
    iconBgClass: "bg-role-gestor text-role-gestor-foreground",
    badgeClass: "bg-role-gestor/10 text-role-gestor border-role-gestor/20",
  },
  Operacional: {
    name: "Operacional",
    icon: User,
    description: "Executa tarefas operacionais",
    permissions: ["Insere e consulta dados", "Sem acesso administrativo"],
    colorClass: "border-role-operacional/30 hover:border-role-operacional/60 hover:shadow-md",
    iconBgClass: "bg-role-operacional text-role-operacional-foreground",
    badgeClass: "bg-role-operacional/10 text-role-operacional border-role-operacional/20",
  },
  Financeiro: {
    name: "Financeiro",
    icon: Wallet,
    description: "Módulos financeiros",
    permissions: ["Visualiza relatórios financeiros", "Acompanha indicadores"],
    colorClass: "border-role-financeiro/30 hover:border-role-financeiro/60 hover:shadow-md",
    iconBgClass: "bg-role-financeiro text-role-financeiro-foreground",
    badgeClass: "bg-role-financeiro/10 text-role-financeiro border-role-financeiro/20",
  },
  Leitura: {
    name: "Leitura",
    icon: Eye,
    description: "Somente visualização",
    permissions: ["Visualiza dados básicos", "Sem permissão de edição"],
    colorClass: "border-role-leitura/30 hover:border-role-leitura/60 hover:shadow-md",
    iconBgClass: "bg-role-leitura text-role-leitura-foreground",
    badgeClass: "bg-role-leitura/10 text-role-leitura border-role-leitura/20",
  },
};

function RoleSummaryCard({ roleName, count, isHighlighted, onClick }: RoleSummaryCardProps) {
  const config = ROLE_SUMMARY_CONFIG[roleName];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "relative flex flex-col items-center p-4 rounded-xl border-2 bg-card transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              config.colorClass,
              isHighlighted && "ring-2 ring-ring ring-offset-2 shadow-lg"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center mb-3 shadow-sm",
              config.iconBgClass
            )}>
              <Icon className="h-6 w-6" />
            </div>

            {/* Title */}
            <h3 className="font-semibold text-foreground text-center">
              {config.name}
            </h3>

            {/* Description */}
            <p className="text-xs text-muted-foreground text-center mt-1 line-clamp-2">
              {config.description}
            </p>

            {/* Count badge */}
            <Badge 
              variant="outline" 
              className={cn("mt-3 text-sm font-bold", config.badgeClass)}
            >
              {count} {count === 1 ? "usuário" : "usuários"}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-3">
          <p className="font-semibold mb-2">{config.name}</p>
          <ul className="space-y-1 text-sm">
            {config.permissions.map((perm, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {perm}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RoleSummaryCardsProps {
  users: Array<{ role_name: string }>;
  selectedRole?: string;
  onRoleSelect?: (role: string | undefined) => void;
}

export function RoleSummaryCards({ users, selectedRole, onRoleSelect }: RoleSummaryCardsProps) {
  const roleCounts: Record<string, number> = {
    Admin: 0,
    Gestor: 0,
    Operacional: 0,
    Financeiro: 0,
    Leitura: 0,
  };

  users.forEach(user => {
    if (roleCounts[user.role_name] !== undefined) {
      roleCounts[user.role_name]++;
    }
  });

  const handleClick = (role: string) => {
    if (onRoleSelect) {
      onRoleSelect(selectedRole === role ? undefined : role);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {Object.keys(ROLE_SUMMARY_CONFIG).map(role => (
        <RoleSummaryCard
          key={role}
          roleName={role}
          count={roleCounts[role]}
          isHighlighted={selectedRole === role}
          onClick={() => handleClick(role)}
        />
      ))}
    </div>
  );
}
