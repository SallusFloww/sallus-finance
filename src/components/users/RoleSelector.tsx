import { RoleCard, ROLE_CONFIGS } from "./RoleCard";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
  disabled?: boolean;
  error?: string;
}

export function RoleSelector({
  roles,
  selectedRoleId,
  onSelect,
  disabled,
  error,
}: RoleSelectorProps) {
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isHighAccess = selectedRole?.name === "Admin";

  // Sort roles by access level
  const sortedRoles = [...roles].sort((a, b) => {
    const order = ["Admin", "Gestor", "Operacional", "Financeiro", "Leitura"];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Perfis de Acesso</h3>
        <span className="text-xs text-muted-foreground">
          Selecione o nível de permissão
        </span>
      </div>

      {/* Role cards grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sortedRoles.map((role) => (
          <RoleCard
            key={role.id}
            roleId={role.id}
            roleName={role.name}
            isSelected={selectedRoleId === role.id}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </p>
      )}

      {/* High access warning */}
      {isHighAccess && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Atenção: Acesso elevado</p>
            <p className="text-muted-foreground mt-0.5">
              Este perfil concede acesso total ao sistema, incluindo gerenciamento de usuários e configurações.
            </p>
          </div>
        </div>
      )}

      {/* Selection confirmation */}
      {selectedRoleId && selectedRole && (
        <div className={cn(
          "p-3 rounded-lg border text-sm",
          isHighAccess 
            ? "bg-primary/5 border-primary/30 text-primary" 
            : "bg-muted/50 border-border text-muted-foreground"
        )}>
          <p>
            <span className="font-medium">Confirmação:</span> Este usuário terá acesso às funcionalidades do perfil{" "}
            <span className="font-semibold">{ROLE_CONFIGS[selectedRole.name]?.name || selectedRole.name}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
