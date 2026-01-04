import { useMemo } from "react";
import { LogOut, User, Calendar, Building2, ChevronDown, Settings, Shield, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/formatters";
import sallusFinanceLogo from "@/assets/logo-sallusfinance.svg";

export function Header() {
  const navigate = useNavigate();
  const { 
    profile, 
    currentCompany, 
    currentRole, 
    companies, 
    signOut, 
    switchCompany,
    isAuthenticated 
  } = useAuth();
  
  const formattedDate = useMemo(() => formatDate(new Date().toISOString()), []);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <img src={sallusFinanceLogo} alt="Sallus Finance" className="h-10 w-auto" />
        </div>

        <div className="flex items-center gap-3">
          {/* Current Company Badge */}
          {currentCompany && (
            <div className="hidden items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm lg:flex">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">{currentCompany.name}</span>
            </div>
          )}

          {/* Date */}
          <div className="hidden items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground md:flex">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>

          {/* User Dropdown */}
          {isAuthenticated && profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-muted">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {profile.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.full_name || "Avatar"} 
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {profile.full_name || profile.email}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {currentRole?.name || "Usuário"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-lg z-[100]">
                {/* User Info */}
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile.full_name || "Usuário"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Current Company & Role */}
                {currentCompany && (
                  <>
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{currentCompany.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Shield className="h-3 w-3" />
                        <span>{currentRole?.name || "Sem perfil"}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Switch Company (if multiple) */}
                {companies.length > 1 && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4" />
                        Trocar Empresa
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="bg-popover border border-border shadow-lg z-[100]">
                          {companies.map((companyRole) => (
                            <DropdownMenuItem
                              key={companyRole.company.id}
                              onClick={() => switchCompany(companyRole.company.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col">
                                  <span className="text-sm">{companyRole.company.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {companyRole.role.name}
                                  </span>
                                </div>
                                {currentCompany?.id === companyRole.company.id && (
                                  <Check className="h-4 w-4 text-primary ml-2" />
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Profile & Settings (Admin only) */}
                {currentRole?.name === "Admin" && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => navigate("/settings")}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate("/admin/diagnostics")}
                      className="cursor-pointer"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Diagnóstico de Acesso
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Logout */}
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
