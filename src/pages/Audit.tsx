import { useState, useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  Search,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  DollarSign,
  Settings,
  FileText,
  Activity,
  Download,
  Calendar,
  ArrowRightLeft,
  Shield,
  Info,
  Loader2,
  RefreshCw,
  Globe,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

// Tipos locais para a página de auditoria
type AuditModule = 
  | "CAIXA"
  | "MOVIMENTACOES"
  | "PRODUCAO"
  | "FATURAMENTO_SUGERIDO"
  | "FATURAMENTO_RECEBER"
  | "CONFIGURACOES"
  | "IMPORTACAO"
  | "SISTEMA"
  | "RELATORIOS";

// Configuração visual por módulo
const MODULE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CAIXA: { label: "Caixa", icon: DollarSign, color: "text-emerald-600 bg-emerald-500/10" },
  MOVIMENTACOES: { label: "Movimentações", icon: ArrowRightLeft, color: "text-blue-600 bg-blue-500/10" },
  PRODUCAO: { label: "Produção", icon: Activity, color: "text-violet-600 bg-violet-500/10" },
  FATURAMENTO_SUGERIDO: { label: "Fat. Sugerido", icon: FileText, color: "text-amber-600 bg-amber-500/10" },
  FATURAMENTO_RECEBER: { label: "Fat. a Receber", icon: FileText, color: "text-blue-600 bg-blue-500/10" },
  CONFIGURACOES: { label: "Configurações", icon: Settings, color: "text-gray-600 bg-gray-500/10" },
  IMPORTACAO: { label: "Importação", icon: Download, color: "text-purple-600 bg-purple-500/10" },
  SISTEMA: { label: "Sistema", icon: Shield, color: "text-gray-600 bg-gray-500/10" },
  RELATORIOS: { label: "Relatórios", icon: FileText, color: "text-blue-600 bg-blue-500/10" },
};

// Configuração visual por action
const ACTION_CONFIG: Record<string, { label: string; isCritical?: boolean; isFinancial?: boolean }> = {
  LOGIN: { label: "Login" },
  LOGOUT: { label: "Logout" },
  EXPORT_PDF: { label: "Exportou PDF", isFinancial: true },
  EXPORT_EXCEL: { label: "Exportou Excel", isFinancial: true },
  SWITCH_COMPANY: { label: "Trocou de empresa" },
  UPDATE_SETTINGS: { label: "Atualizou configurações", isCritical: true },
  CREATE_TRANSACTION: { label: "Criou movimentação", isFinancial: true },
  UPDATE_TRANSACTION: { label: "Editou movimentação", isFinancial: true },
  DELETE_TRANSACTION: { label: "Excluiu movimentação", isCritical: true, isFinancial: true },
  CREATE_PRODUCTION: { label: "Criou produção" },
  UPDATE_PRODUCTION: { label: "Editou produção" },
  DELETE_PRODUCTION: { label: "Excluiu produção", isCritical: true },
  CREATE_BILLING: { label: "Criou faturamento", isFinancial: true },
  UPDATE_BILLING: { label: "Editou faturamento", isFinancial: true },
  RECEIVE_BILLING: { label: "Recebeu faturamento", isFinancial: true },
  APPLY_GLOSS: { label: "Aplicou glosa", isFinancial: true },
  ERROR_CRITICAL: { label: "Erro crítico", isCritical: true },
  ACCESS_DENIED: { label: "Acesso negado", isCritical: true },
};

export default function Audit() {
  // Filtros
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  
  // Logs expandidos
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Buscar logs do banco
  const { logs, users, stats, isLoading, error, refetch } = useAuditLogs({
    search,
    userId: userFilter,
    module: moduleFilter,
    action: actionFilter,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Formatar detalhes para exibição
  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details || Object.keys(details).length === 0) return null;
    return Object.entries(details).map(([key, value]) => (
      <div key={key} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
        <span className="text-muted-foreground">{key}:</span>
        <span className="font-medium text-foreground truncate max-w-[200px]">
          {typeof value === "number" && key.toLowerCase().includes("value") 
            ? formatCurrency(value) 
            : typeof value === "object" 
              ? JSON.stringify(value)
              : String(value ?? "-")}
        </span>
      </div>
    ));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl flex items-center gap-3">
              <History className="h-7 w-7 text-primary" />
              Logs & Auditoria
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rastreabilidade completa de todas as ações do sistema
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Atualizar
            </Button>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              Somente leitura
            </Badge>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Logs</p>
                  <p className="text-2xl font-bold">{stats.totalLogs}</p>
                </div>
                <History className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                  <p className="text-2xl font-bold text-primary">{stats.logsToday}</p>
                </div>
                <Clock className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-rose-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ações Críticas</p>
                  <p className="text-2xl font-bold text-rose-600">{stats.criticalActions}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-rose-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ações Financeiras</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.financialActions}</p>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Sistema</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.systemActions}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerta informativo */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400">Auditoria para Compliance</p>
            <p className="text-muted-foreground mt-0.5">
              Todos os logs são imutáveis e rastreáveis. Responde a: <strong>"Quem fez o quê, quando e com qual impacto?"</strong>
            </p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Busca */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, usuário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Período */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 justify-start">
                    <Calendar className="h-4 w-4" />
                    <span className="truncate">
                      {format(dateRange.start, "dd/MM")} - {format(dateRange.end, "dd/MM")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Início</p>
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.start}
                          onSelect={(d) => d && setDateRange((prev) => ({ ...prev, start: d }))}
                          className="rounded-lg border"
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Fim</p>
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.end}
                          onSelect={(d) => d && setDateRange((prev) => ({ ...prev, end: d }))}
                          className="rounded-lg border"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Usuário */}
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Módulo */}
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos módulos</SelectItem>
                  {Object.entries(MODULE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Contador */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {logs.length} registro(s) encontrado(s)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Estado de Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Carregando logs...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Erro ao carregar logs
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={refetch}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Lista de Logs */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Nenhum registro encontrado
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde novas ações no sistema
            </p>
          </div>
        )}

        {!isLoading && !error && logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log) => {
              const moduleConfig = MODULE_CONFIG[log.module || "SISTEMA"];
              const ModuleIcon = moduleConfig?.icon || History;
              const actionConfig = ACTION_CONFIG[log.action] || { label: log.action };
              const isExpanded = expandedLogs.has(log.id);
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <Collapsible
                  key={log.id}
                  open={isExpanded}
                  onOpenChange={() => hasDetails && toggleExpand(log.id)}
                >
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <CollapsibleTrigger asChild disabled={!hasDetails}>
                      <div className={cn(
                        "p-4 transition-colors",
                        hasDetails && "cursor-pointer hover:bg-muted/30"
                      )}>
                        <div className="flex items-start gap-4">
                          {/* Ícone do módulo */}
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            moduleConfig?.color || "bg-muted"
                          )}>
                            <ModuleIcon className="h-5 w-5" />
                          </div>

                          {/* Conteúdo principal */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">{log.user_name}</span>
                              <span className="text-sm text-muted-foreground">•</span>
                              <span className="text-sm font-medium text-primary">
                                {actionConfig.label}
                              </span>
                              
                              {/* Tags */}
                              {actionConfig.isCritical && (
                                <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20">
                                  Crítica
                                </Badge>
                              )}
                              {actionConfig.isFinancial && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  Financeira
                                </Badge>
                              )}
                            </div>
                            
                            <p className="mt-1 text-sm text-muted-foreground">
                              Módulo: {moduleConfig?.label || log.module || "Sistema"}
                            </p>
                          </div>

                          {/* Lado direito - data e expand */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(log.created_at), "HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                            
                            {hasDetails && (
                              <div className="text-muted-foreground">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Detalhes expandidos */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-0">
                        <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/30 border">
                          {/* Detalhes da ação */}
                          {log.details && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Detalhes da Ação
                              </p>
                              <div className="bg-background rounded p-2">
                                {formatDetails(log.details)}
                              </div>
                            </div>
                          )}
                          
                          {/* Metadados */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Monitor className="h-3 w-3" />
                              Metadados
                            </p>
                            <div className="bg-background rounded p-2 space-y-1">
                              {log.ip_address && (
                                <div className="flex justify-between text-xs py-1 border-b border-border/50">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Globe className="h-3 w-3" /> IP:
                                  </span>
                                  <span className="font-mono text-foreground">{log.ip_address}</span>
                                </div>
                              )}
                              {log.user_agent && (
                                <div className="text-xs py-1">
                                  <span className="text-muted-foreground">Navegador:</span>
                                  <p className="font-mono text-foreground text-[10px] truncate mt-1">
                                    {log.user_agent.slice(0, 80)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
