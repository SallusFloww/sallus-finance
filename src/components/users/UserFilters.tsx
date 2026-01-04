import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UserFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedRole: string | undefined;
  onRoleChange: (value: string | undefined) => void;
  selectedStatus: string | undefined;
  onStatusChange: (value: string | undefined) => void;
  roles: Array<{ id: string; name: string }>;
}

export function UserFilters({
  searchTerm,
  onSearchChange,
  selectedRole,
  onRoleChange,
  selectedStatus,
  onStatusChange,
  roles,
}: UserFiltersProps) {
  const hasFilters = searchTerm || selectedRole || selectedStatus;

  const clearFilters = () => {
    onSearchChange("");
    onRoleChange(undefined);
    onStatusChange(undefined);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role filter */}
        <Select 
          value={selectedRole || "__all__"} 
          onValueChange={(v) => onRoleChange(v === "__all__" ? undefined : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os perfis</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.name}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select 
          value={selectedStatus || "__all__"} 
          onValueChange={(v) => onStatusChange(v === "__all__" ? undefined : v)}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          
          {searchTerm && (
            <Badge variant="secondary" className="gap-1">
              Busca: "{searchTerm}"
              <button onClick={() => onSearchChange("")} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedRole && (
            <Badge variant="secondary" className="gap-1">
              Perfil: {selectedRole}
              <button onClick={() => onRoleChange(undefined)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedStatus && (
            <Badge variant="secondary" className="gap-1">
              Status: {selectedStatus === "active" ? "Ativo" : "Inativo"}
              <button onClick={() => onStatusChange(undefined)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="text-muted-foreground hover:text-destructive"
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
