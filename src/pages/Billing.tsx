import { useState, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CalendarIcon,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Gavel,
  History,
  TrendingUp,
  TrendingDown,
  Scale,
  MoreHorizontal,
  Receipt,
  Banknote,
  CircleDot,
  ArrowRight,
  Info,
  Eye,
  Edit3,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, parseMoneyBR } from "@/utils/formatters";
import { Receivable, ReceivableStatus, GlossType, AppealStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const STATUS_CONFIG: Record<ReceivableStatus, { label: string; color: string; icon: any; semanticLabel: string }> = {
  FATURADO: { 
    label: "Faturado", 
    semanticLabel: "Faturado (aguardando recebimento)",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20", 
    icon: Clock 
  },
  RECEBIDO: { 
    label: "Recebido", 
    semanticLabel: "Recebido",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", 
    icon: CheckCircle 
  },
  RECEBIDO_COM_GLOSA: { 
    label: "Recebido c/ Glosa", 
    semanticLabel: "Recebido com glosa",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20", 
    icon: AlertTriangle 
  },
  GLOSADO: { 
    label: "Glosado", 
    semanticLabel: "Glosado (não recebido)",
    color: "bg-rose-500/10 text-rose-600 border-rose-500/20", 
    icon: XCircle 
  },
};

const APPEAL_STATUS_CONFIG: Record<AppealStatus, { label: string; color: string; icon: any }> = {
  NAO_INICIADO: { label: "Sem recurso", color: "bg-muted text-muted-foreground", icon: Scale },
  EM_RECURSO: { label: "Em recurso", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Gavel },
  DEFERIDO: { label: "Deferido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: TrendingUp },
  INDEFERIDO: { label: "Indeferido", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: TrendingDown },
};

const TAB_TOOLTIPS = {
  pendentes: "Faturado, mas ainda não recebido",
  faturados: "Recebidos com ou sem glosa aplicada",
  glosados: "Faturamento com glosa registrada",
  recebidos: "Valor já entrou no caixa",
};

export default function Billing() {
  const { transactions } = useApp();
  const { settings } = transactions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  
  const navigate = useNavigate();
  const {
    receivables,
    markAsReceived,
    markAsGlossed,
    initiateAppeal,
    approveAppeal,
    rejectAppeal,
    filterReceivables,
    uniqueSources,
    loading: receivablesLoading,
  } = useReceivablesDB();

  // Tab ativa
  const [activeTab, setActiveTab] = useState<string>("pendentes");

  // Filtros
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Estados de ações
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [glossDialogOpen, setGlossDialogOpen] = useState(false);
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [resolveAppealDialogOpen, setResolveAppealDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [receiveData, setReceiveData] = useState({ amount: "", date: format(new Date(), "yyyy-MM-dd") });
  const [glossData, setGlossData] = useState<{ 
    type: GlossType; 
    reason: string; 
    amount: string; 
    date: string;
    initiateAppeal: boolean;
  }>({ type: "PARCIAL", reason: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), initiateAppeal: false });
  const [appealData, setAppealData] = useState({ amount: "" });
  const [resolveAppealData, setResolveAppealData] = useState({ 
    approved: true, 
    recoveredAmount: "", 
    date: format(new Date(), "yyyy-MM-dd") 
  });

  // Dados filtrados por status
  const allFiltered = useMemo(() => {
    return filterReceivables({
      startDate: dateRange.start,
      endDate: dateRange.end,
      unit: unitFilter !== "all" ? unitFilter : undefined,
      search: searchQuery,
    }).sort((a, b) => new Date(b.billingDate).getTime() - new Date(a.billingDate).getTime());
  }, [filterReceivables, dateRange, unitFilter, searchQuery]);

  const pendentes = useMemo(() => allFiltered.filter(r => r.status === "FATURADO"), [allFiltered]);
  const faturados = useMemo(() => allFiltered.filter(r => r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA"), [allFiltered]);
  const glosados = useMemo(() => allFiltered.filter(r => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA"), [allFiltered]);
  const recebidos = useMemo(() => allFiltered.filter(r => r.status === "RECEBIDO"), [allFiltered]);

  // Totais operacionais
  const totals = useMemo(() => {
    return {
      quantidade: allFiltered.length,
      faturado: allFiltered.reduce((sum, r) => sum + r.billedAmount, 0),
      glosado: allFiltered.reduce((sum, r) => sum + (r.glossedAmount || 0), 0),
      recebido: allFiltered.reduce((sum, r) => sum + (r.receivedAmount || 0), 0),
      pendente: pendentes.reduce((sum, r) => sum + r.billedAmount, 0),
    };
  }, [allFiltered, pendentes]);

  const activeUnits = settings.units.filter((u) => u.active);

  // Handlers
  const handleMarkReceived = async () => {
    if (!selectedReceivable || !receiveData.amount || !receiveData.date) {
      toast.error("Preencha o valor e data de recebimento");
      return;
    }

    try {
      const result = await markAsReceived(
        selectedReceivable.id,
        parseMoneyBR(receiveData.amount),
        receiveData.date,
        user?.name || "Sistema"
      );

      if (result) {
        toast.success("Recebimento registrado! Movimentação criada automaticamente no Caixa.");
      }
    } catch (error) {
      console.error("Erro ao marcar como recebido:", error);
      toast.error("Erro ao registrar recebimento");
    } finally {
      setReceiveDialogOpen(false);
      setSelectedReceivable(null);
      setReceiveData({ amount: "", date: format(new Date(), "yyyy-MM-dd") });
    }
  };

  const handleMarkGlossed = () => {
    if (!selectedReceivable || !glossData.reason) {
      toast.error("Informe o motivo da glosa");
      return;
    }

    const glossAmount = parseMoneyBR(glossData.amount);
    
    if (glossAmount <= 0) {
      toast.error("Informe o valor da glosa");
      return;
    }
    if (glossAmount > selectedReceivable.billedAmount) {
      toast.error("Valor da glosa não pode ser maior que o valor faturado");
      return;
    }

    markAsGlossed(
      selectedReceivable.id,
      glossData.type,
      glossData.reason,
      glossAmount,
      glossData.date,
      user?.name || "Sistema",
      glossData.initiateAppeal
    );

    if (glossData.type === "PARCIAL") {
      const netValue = selectedReceivable.billedAmount - glossAmount;
      toast.success(`Glosa parcial registrada! Movimentação de ${formatCurrency(netValue)} criada.`);
    } else {
      toast.success("Glosa total registrada.");
    }

    if (glossData.initiateAppeal) {
      toast.info("Recurso iniciado automaticamente.");
    }

    setGlossDialogOpen(false);
    setSelectedReceivable(null);
    setGlossData({ type: "PARCIAL", reason: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), initiateAppeal: false });
  };

  const handleInitiateAppeal = () => {
    if (!selectedReceivable) return;
    
    const appealAmount = parseMoneyBR(appealData.amount) || selectedReceivable.glossedAmount || 0;
    
    if (appealAmount <= 0) {
      toast.error("Informe o valor do recurso");
      return;
    }

    initiateAppeal(selectedReceivable.id, appealAmount, user?.name || "Sistema");
    toast.success("Recurso iniciado com sucesso");
    
    setAppealDialogOpen(false);
    setSelectedReceivable(null);
    setAppealData({ amount: "" });
  };

  const handleResolveAppeal = () => {
    if (!selectedReceivable) return;

    if (resolveAppealData.approved) {
      const recoveredAmount = parseMoneyBR(resolveAppealData.recoveredAmount);
      
      if (recoveredAmount <= 0) {
        toast.error("Informe o valor recuperado");
        return;
      }

      approveAppeal(
        selectedReceivable.id,
        recoveredAmount,
        resolveAppealData.date,
        user?.name || "Sistema"
      );
      toast.success(`Recurso deferido! Movimentação de ${formatCurrency(recoveredAmount)} criada.`);
    } else {
      rejectAppeal(selectedReceivable.id, user?.name || "Sistema");
      toast.success("Recurso indeferido. Perda definitiva registrada.");
    }

    setResolveAppealDialogOpen(false);
    setSelectedReceivable(null);
    setResolveAppealData({ approved: true, recoveredAmount: "", date: format(new Date(), "yyyy-MM-dd") });
  };

  // Helpers
  const formatPrazoExecutivo = (receivable: Receivable): { text: string; isOverdue: boolean } => {
    if ((receivable.status === "RECEBIDO" || receivable.status === "RECEBIDO_COM_GLOSA") && receivable.actualReceiptDate) {
      const days = differenceInDays(parseISO(receivable.actualReceiptDate), parseISO(receivable.billingDate));
      return { text: `${days} dias`, isOverdue: false };
    }
    if (receivable.status === "GLOSADO") {
      return { text: "—", isOverdue: false };
    }
    const daysOpen = differenceInDays(new Date(), parseISO(receivable.billingDate));
    const isOverdue = receivable.expectedReceiptDays ? daysOpen > receivable.expectedReceiptDays : false;
    
    if (daysOpen === 0) return { text: "Hoje", isOverdue: false };
    if (daysOpen < 0) return { text: "Futuro", isOverdue: false };
    return { text: `${daysOpen} dias`, isOverdue };
  };

  const openReceiveDialog = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setReceiveData({ amount: receivable.billedAmount.toString(), date: format(new Date(), "yyyy-MM-dd") });
    setReceiveDialogOpen(true);
  };

  const openGlossDialog = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setGlossData({ type: "PARCIAL", reason: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), initiateAppeal: false });
    setGlossDialogOpen(true);
  };

  const openAppealDialog = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setAppealData({ amount: (receivable.glossedAmount || 0).toString() });
    setAppealDialogOpen(true);
  };

  const openResolveAppealDialog = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setResolveAppealData({ 
      approved: true, 
      recoveredAmount: (receivable.appealAmount || receivable.glossedAmount || 0).toString(),
      date: format(new Date(), "yyyy-MM-dd")
    });
    setResolveAppealDialogOpen(true);
  };

  const openHistoryDialog = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setHistoryDialogOpen(true);
  };

  // Renderizar tabela de faturamentos
  const renderTable = (items: Receivable[], showActions: boolean = true) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nenhum registro encontrado</p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Convênio</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Faturado</TableHead>
              <TableHead className="text-right">Glosado</TableHead>
              <TableHead className="text-right">Recebido</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Prazo</TableHead>
              {showActions && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const statusConfig = STATUS_CONFIG[item.status];
              const StatusIcon = statusConfig.icon;
              const prazo = formatPrazoExecutivo(item);
              
              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">
                    {format(parseISO(item.billingDate), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {item.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.unit}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{item.description}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.billedAmount)}</TableCell>
                  <TableCell className="text-right text-rose-600">
                    {item.glossedAmount ? formatCurrency(item.glossedAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {item.receivedAmount ? formatCurrency(item.receivedAmount) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={cn("gap-1 text-xs cursor-help w-fit", statusConfig.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{statusConfig.semanticLabel}</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Sinalização visual adicional */}
                      {item.status === "RECEBIDO" && !item.glossedAmount && (
                        <span className="text-[10px] text-emerald-600 font-medium">Integral</span>
                      )}
                      {item.status === "RECEBIDO_COM_GLOSA" && (
                        <span className="text-[10px] text-orange-600 font-medium">Com Glosa</span>
                      )}
                      {item.status === "GLOSADO" && item.glossType === "TOTAL" && (
                        <span className="text-[10px] text-rose-600 font-medium">Glosa Total</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-xs", prazo.isOverdue && "text-rose-600 font-medium")}>
                      {prazo.text}
                    </span>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-popover">
                          {/* Ver detalhes sempre disponível */}
                          <DropdownMenuItem onClick={() => openHistoryDialog(item)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Ações para FATURADO */}
                          {item.status === "FATURADO" && (
                            <>
                              <DropdownMenuItem onClick={() => openReceiveDialog(item)}>
                                <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                Marcar como recebido
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openGlossDialog(item)}>
                                <XCircle className="h-4 w-4 mr-2 text-rose-600" />
                                Registrar glosa
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {/* Ações para GLOSADO ou RECEBIDO_COM_GLOSA */}
                          {(item.status === "GLOSADO" || item.status === "RECEBIDO_COM_GLOSA") && (
                            <>
                              {item.appealStatus === "NAO_INICIADO" && (
                                <DropdownMenuItem onClick={() => openAppealDialog(item)}>
                                  <Gavel className="h-4 w-4 mr-2 text-blue-600" />
                                  Iniciar recurso
                                </DropdownMenuItem>
                              )}
                              {item.appealStatus === "EM_RECURSO" && (
                                <DropdownMenuItem onClick={() => openResolveAppealDialog(item)}>
                                  <Scale className="h-4 w-4 mr-2 text-amber-600" />
                                  Resolver recurso
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openHistoryDialog(item)}>
                            <History className="h-4 w-4 mr-2" />
                            Histórico
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl flex items-center gap-3">
                <Receipt className="h-7 w-7 text-primary" />
                Faturamento
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestão operacional de faturamentos: pendentes, faturados, glosados e recebidos.
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5 w-fit">
                <Info className="h-3.5 w-3.5" />
                <span>Valores só impactam o Caixa quando marcados como "Recebido".</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => navigate("/suggested-billing")}
              >
                <ArrowRight className="h-4 w-4" />
                Faturamento Sugerido
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(dateRange.start, "dd/MM")} - {format(dateRange.end, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-popover" align="end">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Data Inicial</p>
                        <Calendar
                          mode="single"
                          selected={dateRange.start}
                          onSelect={(d) => d && setDateRange((prev) => ({ ...prev, start: d }))}
                          className="rounded-lg border pointer-events-auto"
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Data Final</p>
                        <Calendar
                          mode="single"
                          selected={dateRange.end}
                          onSelect={(d) => d && setDateRange((prev) => ({ ...prev, end: d }))}
                          className="rounded-lg border pointer-events-auto"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Totais Operacionais */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  Quantidade
                </div>
                <p className="text-2xl font-bold">{totals.quantidade}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Títulos emitidos no período</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  Pendente
                </div>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pendente)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Aguardando recebimento (não impacta caixa)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Receipt className="h-3.5 w-3.5" />
                        Faturado
                      </div>
                      <p className="text-2xl font-bold">{formatCurrency(totals.faturado)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Títulos emitidos (não impacta caixa)</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">O valor faturado representa títulos emitidos aos convênios. Esses valores só entram no caixa quando marcados como "Recebido".</p>
                  </TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Glosado
                </div>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(totals.glosado)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Valor contestado (parcial ou total)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Recebido
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.recebido)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Efetivamente recebido (impacta caixa)</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">Apenas valores marcados como "Recebido" entram no caixa e compõem o saldo disponível.</p>
                  </TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por convênio, descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Todas Unidades</SelectItem>
                {activeUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.name}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs por Status */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid h-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="pendentes" className={cn("gap-2 py-2.5", activeTab === "pendentes" && "ring-2 ring-primary/30")}>
                    <Clock className="h-4 w-4" />
                    Pendentes
                    <Badge variant="secondary" className="ml-1">{pendentes.length}</Badge>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{TAB_TOOLTIPS.pendentes}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="faturados" className={cn("gap-2 py-2.5", activeTab === "faturados" && "ring-2 ring-primary/30")}>
                    <Receipt className="h-4 w-4" />
                    Faturados
                    <Badge variant="secondary" className="ml-1">{faturados.length}</Badge>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{TAB_TOOLTIPS.faturados}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="glosados" className={cn("gap-2 py-2.5", activeTab === "glosados" && "ring-2 ring-primary/30")}>
                    <XCircle className="h-4 w-4" />
                    Glosados
                    <Badge variant="secondary" className="ml-1">{glosados.length}</Badge>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{TAB_TOOLTIPS.glosados}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="recebidos" className={cn("gap-2 py-2.5", activeTab === "recebidos" && "ring-2 ring-primary/30")}>
                    <CheckCircle className="h-4 w-4" />
                    Recebidos
                    <Badge variant="secondary" className="ml-1">{recebidos.length}</Badge>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{TAB_TOOLTIPS.recebidos}</p>
                </TooltipContent>
              </Tooltip>
            </TabsList>

            <TabsContent value="pendentes" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Faturamentos Pendentes de Recebimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(pendentes)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faturados" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    Faturamentos Recebidos (com ou sem glosa)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(faturados)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="glosados" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-rose-600" />
                    Faturamentos com Glosa
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(glosados)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recebidos" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Faturamentos Recebidos Integralmente
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(recebidos, false)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Rodapé de Governança */}
          <div className="border-t pt-4 mt-6">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Governança Financeira
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                  Faturamento não impacta Caixa automaticamente
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                  Apenas registros marcados como "Recebido" entram no Caixa
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                  Glosas não recebidas não impactam saldo
                </li>
              </ul>
            </div>
          </div>

        {/* Dialog: Marcar Recebido */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Recebimento</DialogTitle>
              <DialogDescription>
                Informe o valor e data do recebimento. Uma movimentação de entrada será criada automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Valor Recebido *</Label>
                <Input
                  placeholder="0,00"
                  value={receiveData.amount}
                  onChange={(e) => setReceiveData({ ...receiveData, amount: e.target.value })}
                />
                {selectedReceivable && (
                  <p className="text-xs text-muted-foreground">
                    Valor faturado: {formatCurrency(selectedReceivable.billedAmount)}
                  </p>
                )}
                {/* Regra assistiva: sugerir glosa parcial se valor recebido < faturado */}
                {selectedReceivable && receiveData.amount && (
                  (() => {
                    const receivedValue = parseMoneyBR(receiveData.amount);
                    const billedValue = selectedReceivable.billedAmount;
                    const difference = billedValue - receivedValue;
                    
                    if (receivedValue > 0 && receivedValue < billedValue) {
                      return (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md mt-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-medium text-amber-700">Valor inferior ao faturado</p>
                            <p className="text-amber-600 mt-0.5">
                              Diferença de {formatCurrency(difference)}. Considere registrar uma <strong>glosa parcial</strong> para manter a rastreabilidade do valor não recebido.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </div>
              <div className="space-y-2">
                <Label>Data do Recebimento *</Label>
                <Input
                  type="date"
                  value={receiveData.date}
                  onChange={(e) => setReceiveData({ ...receiveData, date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleMarkReceived} className="gradient-primary">
                Confirmar Recebimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Registrar Glosa */}
        <Dialog open={glossDialogOpen} onOpenChange={setGlossDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Glosa</DialogTitle>
              <DialogDescription>
                Glosa parcial gera movimentação do valor líquido. Glosa total não gera movimentação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Glosa *</Label>
                <Select 
                  value={glossData.type} 
                  onValueChange={(v) => setGlossData({ ...glossData, type: v as GlossType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="TOTAL">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor da Glosa *</Label>
                <Input
                  placeholder="0,00"
                  value={glossData.amount}
                  onChange={(e) => setGlossData({ ...glossData, amount: e.target.value })}
                />
                {selectedReceivable && (
                  <p className="text-xs text-muted-foreground">
                    Valor faturado: {formatCurrency(selectedReceivable.billedAmount)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Motivo da Glosa *</Label>
                <Textarea
                  placeholder="Descreva o motivo da glosa..."
                  value={glossData.reason}
                  onChange={(e) => setGlossData({ ...glossData, reason: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Glosa *</Label>
                <Input
                  type="date"
                  value={glossData.date}
                  onChange={(e) => setGlossData({ ...glossData, date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="initiateAppeal" 
                  checked={glossData.initiateAppeal}
                  onCheckedChange={(c) => setGlossData({ ...glossData, initiateAppeal: c === true })}
                />
                <Label htmlFor="initiateAppeal" className="text-sm font-normal cursor-pointer">
                  Iniciar recurso automaticamente
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGlossDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleMarkGlossed} variant="destructive">
                Registrar Glosa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Iniciar Recurso */}
        <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Iniciar Recurso de Glosa</DialogTitle>
              <DialogDescription>
                Informe o valor a ser contestado no recurso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Valor do Recurso *</Label>
                <Input
                  placeholder="0,00"
                  value={appealData.amount}
                  onChange={(e) => setAppealData({ amount: e.target.value })}
                />
                {selectedReceivable && (
                  <p className="text-xs text-muted-foreground">
                    Valor glosado: {formatCurrency(selectedReceivable.glossedAmount || 0)}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAppealDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInitiateAppeal} className="gradient-primary">
                Iniciar Recurso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Resolver Recurso */}
        <Dialog open={resolveAppealDialogOpen} onOpenChange={setResolveAppealDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Recurso</DialogTitle>
              <DialogDescription>
                Defira (recupera valor) ou indefira (perda definitiva) o recurso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Resultado do Recurso *</Label>
                <Select 
                  value={resolveAppealData.approved ? "approved" : "rejected"} 
                  onValueChange={(v) => setResolveAppealData({ ...resolveAppealData, approved: v === "approved" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Deferido (recuperar valor)</SelectItem>
                    <SelectItem value="rejected">Indeferido (perda definitiva)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {resolveAppealData.approved && (
                <>
                  <div className="space-y-2">
                    <Label>Valor Recuperado *</Label>
                    <Input
                      placeholder="0,00"
                      value={resolveAppealData.recoveredAmount}
                      onChange={(e) => setResolveAppealData({ ...resolveAppealData, recoveredAmount: e.target.value })}
                    />
                    {selectedReceivable && (
                      <p className="text-xs text-muted-foreground">
                        Valor em recurso: {formatCurrency(selectedReceivable.appealAmount || selectedReceivable.glossedAmount || 0)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Data do Recebimento *</Label>
                    <Input
                      type="date"
                      value={resolveAppealData.date}
                      onChange={(e) => setResolveAppealData({ ...resolveAppealData, date: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveAppealDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleResolveAppeal} 
                className={resolveAppealData.approved ? "gradient-primary" : ""}
                variant={resolveAppealData.approved ? "default" : "destructive"}
              >
                {resolveAppealData.approved ? "Deferir Recurso" : "Indeferir Recurso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Histórico */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico do Faturamento
              </DialogTitle>
              <DialogDescription>
                {selectedReceivable?.description}
              </DialogDescription>
            </DialogHeader>
            
            {/* Resumo de Valores */}
            {selectedReceivable && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Valor Original</p>
                  <p className="font-semibold text-sm">{formatCurrency(selectedReceivable.billedAmount)}</p>
                </div>
                <div className="text-center border-x">
                  <p className="text-xs text-muted-foreground mb-0.5">Valor Glosado</p>
                  <p className="font-semibold text-sm text-rose-600">
                    {selectedReceivable.glossedAmount ? formatCurrency(selectedReceivable.glossedAmount) : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Valor Líquido</p>
                  <p className="font-semibold text-sm text-emerald-600">
                    {formatCurrency(selectedReceivable.billedAmount - (selectedReceivable.glossedAmount || 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Sinalização Visual do Status */}
            {selectedReceivable && (
              <div className="flex items-center gap-2">
                {selectedReceivable.status === "RECEBIDO" && !selectedReceivable.glossedAmount && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Recebido Integral
                  </Badge>
                )}
                {selectedReceivable.status === "RECEBIDO_COM_GLOSA" && (
                  <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Recebido com Glosa
                  </Badge>
                )}
                {selectedReceivable.status === "GLOSADO" && (
                  <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 gap-1">
                    <XCircle className="h-3 w-3" />
                    Glosa Total
                  </Badge>
                )}
                {selectedReceivable.status === "FATURADO" && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                    <Clock className="h-3 w-3" />
                    Aguardando Recebimento
                  </Badge>
                )}
                {selectedReceivable.appealStatus === "EM_RECURSO" && (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                    <Gavel className="h-3 w-3" />
                    Em Recurso
                  </Badge>
                )}
              </div>
            )}
            
            {/* Timeline de Histórico */}
            <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline de Eventos</p>
              {selectedReceivable?.history?.length ? (
                selectedReceivable.history.map((entry, idx) => {
                  const getActionIcon = (action: string) => {
                    switch (action) {
                      case "CRIADO": return <FileText className="h-3.5 w-3.5 text-blue-500" />;
                      case "RECEBIDO": return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
                      case "GLOSA_REGISTRADA": return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
                      case "RECURSO_INICIADO": return <Gavel className="h-3.5 w-3.5 text-blue-500" />;
                      case "RECURSO_DEFERIDO": return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
                      case "RECURSO_INDEFERIDO": return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
                      default: return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />;
                    }
                  };

                  const getActionLabel = (action: string) => {
                    switch (action) {
                      case "CRIADO": return "Faturamento Criado";
                      case "RECEBIDO": return "Recebimento Registrado";
                      case "GLOSA_REGISTRADA": return "Glosa Registrada";
                      case "RECURSO_INICIADO": return "Recurso Iniciado";
                      case "RECURSO_DEFERIDO": return "Recurso Deferido";
                      case "RECURSO_INDEFERIDO": return "Recurso Indeferido";
                      case "EDITADO": return "Registro Editado";
                      default: return action;
                    }
                  };

                  return (
                    <div key={entry.id || idx} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1 hover:bg-muted/20 rounded-r-md transition-colors">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(entry.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{getActionLabel(entry.action)}</p>
                          {entry.amount && (
                            <Badge variant="outline" className="text-xs">
                              {formatCurrency(entry.amount)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(parseISO(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            •
                            {entry.userName}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sem histórico disponível</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
