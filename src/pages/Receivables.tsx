import { useState, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CalendarIcon,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Filter,
  Gavel,
  History,
  TrendingUp,
  TrendingDown,
  Scale,
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
  DialogTrigger,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, parseMoneyBR } from "@/utils/formatters";
import { Receivable, ReceivableStatus, GlossType, AppealStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ReceivableStatus, { label: string; color: string; icon: any }> = {
  FATURADO: { label: "Faturado", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  RECEBIDO: { label: "Recebido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle },
  RECEBIDO_COM_GLOSA: { label: "Recebido c/ Glosa", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: AlertTriangle },
  GLOSADO: { label: "Glosado", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: XCircle },
};

const APPEAL_STATUS_CONFIG: Record<AppealStatus, { label: string; color: string; icon: any }> = {
  NAO_INICIADO: { label: "Recurso não iniciado", color: "bg-muted text-muted-foreground", icon: Scale },
  EM_RECURSO: { label: "Em recurso", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Gavel },
  DEFERIDO: { label: "Recurso deferido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: TrendingUp },
  INDEFERIDO: { label: "Recurso indeferido", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: TrendingDown },
};

const CONVENIOS = ["IPASGO", "UNIMED", "BRADESCO", "GEAP", "SUS", "PARTICULAR"];

export default function Receivables() {
  const { transactions } = useApp();
  const { settings } = transactions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  
  const {
    receivables,
    addReceivable,
    markAsReceived,
    markAsGlossed,
    initiateAppeal,
    approveAppeal,
    rejectAppeal,
    getStats,
    filterReceivables,
    uniqueSources,
    loading: receivablesLoading,
  } = useReceivablesDB();

  // Estados de filtro
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Estados do formulário
  const [isFormOpen, setIsFormOpen] = useState(false);
  const currentMonth = format(new Date(), "MM/yyyy");
  const [formData, setFormData] = useState({
    billingDate: format(new Date(), "yyyy-MM-dd"),
    competencia: currentMonth,
    unit: "",
    source: "",
    description: "",
    billedAmount: "",
    expectedReceiptDays: "30",
    notes: "",
  });

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

  // Função para formatar competência (MM/AAAA)
  const formatCompetencia = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    const limited = numbers.slice(0, 6);
    if (limited.length > 2) {
      return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    }
    return limited;
  };

  // Validação de competência
  const validateCompetencia = (value: string): boolean => {
    const regex = /^(0[1-9]|1[0-2])\/\d{4}$/;
    if (!regex.test(value)) return false;
    const [month, year] = value.split("/").map(Number);
    return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
  };

  // Dados filtrados
  const filteredReceivables = useMemo(() => {
    let result = filterReceivables({
      startDate: dateRange.start,
      endDate: dateRange.end,
      unit: unitFilter !== "all" ? unitFilter : undefined,
      status: statusFilter !== "all" ? (statusFilter as ReceivableStatus) : undefined,
      search: searchQuery,
    });
    return result.sort((a, b) => new Date(b.billingDate).getTime() - new Date(a.billingDate).getTime());
  }, [filterReceivables, dateRange, unitFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => getStats(dateRange.start, dateRange.end), [getStats, dateRange]);

  const activeUnits = settings.units.filter((u) => u.active);

  // Handlers
  const handleAddReceivable = () => {
    if (!formData.unit || !formData.source || !formData.billedAmount || !formData.competencia) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!validateCompetencia(formData.competencia)) {
      toast.error("Competência inválida. Use o formato MM/AAAA (ex: 09/2025)");
      return;
    }

    addReceivable({
      billingDate: formData.billingDate,
      competencia: formData.competencia,
      unit: formData.unit,
      source: formData.source,
      description: formData.description,
      billedAmount: parseMoneyBR(formData.billedAmount),
      status: "FATURADO",
      expectedReceiptDays: parseInt(formData.expectedReceiptDays) || 30,
      notes: formData.notes,
      createdBy: user?.name || "Sistema",
    });

    toast.success("Faturamento registrado com sucesso");
    setIsFormOpen(false);
    resetForm();
  };

  const handleMarkReceived = () => {
    if (!selectedReceivable || !receiveData.amount || !receiveData.date) {
      toast.error("Preencha o valor e data de recebimento");
      return;
    }

    const result = markAsReceived(
      selectedReceivable.id,
      parseMoneyBR(receiveData.amount),
      receiveData.date,
      user?.name || "Sistema"
    );

    if (result) {
      toast.success("Recebimento registrado! Movimentação criada automaticamente.");
    } else {
      toast.error("Erro ao registrar recebimento");
    }

    setReceiveDialogOpen(false);
    setSelectedReceivable(null);
    setReceiveData({ amount: "", date: format(new Date(), "yyyy-MM-dd") });
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

    const result = markAsGlossed(
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
      toast.success(`Glosa parcial registrada! Movimentação de ${formatCurrency(netValue)} criada automaticamente.`);
    } else {
      toast.success("Glosa total registrada. Nenhuma movimentação gerada.");
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

      const result = approveAppeal(
        selectedReceivable.id,
        recoveredAmount,
        resolveAppealData.date,
        user?.name || "Sistema"
      );

      if (result) {
        toast.success(`Recurso deferido! Movimentação de ${formatCurrency(recoveredAmount)} criada automaticamente.`);
      }
    } else {
      rejectAppeal(selectedReceivable.id, user?.name || "Sistema");
      toast.success("Recurso indeferido. Valor registrado como perda definitiva.");
    }

    setResolveAppealDialogOpen(false);
    setSelectedReceivable(null);
    setResolveAppealData({ approved: true, recoveredAmount: "", date: format(new Date(), "yyyy-MM-dd") });
  };

  const resetForm = () => {
    setFormData({
      billingDate: format(new Date(), "yyyy-MM-dd"),
      competencia: currentMonth,
      unit: "",
      source: "",
      description: "",
      billedAmount: "",
      expectedReceiptDays: "30",
      notes: "",
    });
  };

  // Helper para formatação de prazo executiva
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
    if (!isOverdue && receivable.expectedReceiptDays && daysOpen <= receivable.expectedReceiptDays) {
      return { text: `${daysOpen} dias`, isOverdue: false };
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" />
              Faturamento & Produção
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão completa de produção, faturamento, glosas e recursos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                        className="rounded-lg border"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Data Final</p>
                      <Calendar
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
          </div>
        </div>

        {/* Conteúdo do Faturamento */}
        <div className="space-y-6">
          {/* Botão Novo Faturamento */}
          <div className="flex justify-end">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                  <Button className="gap-2 gradient-primary">
                    <Plus className="h-4 w-4" />
                    Novo Faturamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Registrar Faturamento</DialogTitle>
                    <DialogDescription>
                      Registre um valor faturado que ainda não foi recebido.
                    </DialogDescription>
                  </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data do Faturamento *</Label>
                      <Input
                        type="date"
                        value={formData.billingDate}
                        onChange={(e) => setFormData({ ...formData, billingDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Competência *</Label>
                      <Input
                        placeholder="MM/AAAA"
                        value={formData.competencia}
                        onChange={(e) => setFormData({ ...formData, competencia: formatCompetencia(e.target.value) })}
                        maxLength={7}
                      />
                      <p className="text-xs text-muted-foreground">
                        Período em que o serviço foi prestado (ex: 09/2025)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Prazo estimado (dias)</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={formData.expectedReceiptDays}
                      onChange={(e) => setFormData({ ...formData, expectedReceiptDays: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Unidade *</Label>
                      <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Convênio / Origem *</Label>
                      <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONVENIOS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição *</Label>
                    <Input
                      placeholder="Ex: Procedimentos Junho/2024"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Valor Faturado (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.billedAmount}
                      onChange={(e) => setFormData({ ...formData, billedAmount: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Informações adicionais..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddReceivable} className="gradient-primary">Registrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>

        {/* Cards de Resumo - Visão Executiva */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">💰 Total Faturado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalBilled)}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.count} faturamentos</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">✅ Total Recebido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalReceived)}</p>
              <p className="text-xs text-muted-foreground mt-1">Convertido em caixa</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">⏳ Em Aberto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalOpen)}</p>
              <p className="text-xs text-muted-foreground mt-1">Aguardando recebimento</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">⚖️ Em Recurso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalInAppeal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Pode virar dinheiro</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">❌ Perda Definitiva</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-rose-600">{formatCurrency(stats.totalDefinitiveLoss)}</p>
              <p className="text-xs text-muted-foreground mt-1">Glosa sem recurso/indeferido</p>
            </CardContent>
          </Card>
        </div>

        {/* Segunda linha de cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Recuperado via Recurso</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalRecovered)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-orange-500/20 bg-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Glosado</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalGlossed)}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-muted">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Prazo Médio</p>
                  <p className="text-xl font-bold text-foreground">{stats.averageReceiptDays} dias</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerta informativo */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">Valores faturados e ainda não recebidos</p>
            <p className="text-muted-foreground mt-0.5">
              Estes valores <strong>não compõem o saldo de caixa</strong> até o efetivo recebimento. 
              Ao marcar como "Recebido" ou ao deferir um recurso, uma movimentação de entrada será gerada automaticamente.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-border bg-card">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou convênio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {activeUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="FATURADO">Faturado</SelectItem>
              <SelectItem value="RECEBIDO">Recebido</SelectItem>
              <SelectItem value="RECEBIDO_COM_GLOSA">Recebido c/ Glosa</SelectItem>
              <SelectItem value="GLOSADO">Glosado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela com Bloco Financeiro */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Fat.</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Convênio</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">💰 Faturado</TableHead>
                    <TableHead className="text-right">✅ Recebido</TableHead>
                    <TableHead className="text-right">❌ Glosado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        Nenhum faturamento encontrado no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReceivables.map((receivable) => {
                      const StatusIcon = STATUS_CONFIG[receivable.status].icon;
                      const unitName = settings.units.find((u) => u.id === receivable.unit)?.name || receivable.unit;
                      const prazo = formatPrazoExecutivo(receivable);
                      const appealConfig = receivable.appealStatus ? APPEAL_STATUS_CONFIG[receivable.appealStatus] : null;
                      const AppealIcon = appealConfig?.icon;

                      return (
                        <TableRow key={receivable.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(receivable.billingDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {receivable.competencia || "—"}
                          </TableCell>
                          <TableCell>{unitName}</TableCell>
                          <TableCell>{receivable.source}</TableCell>
                          <TableCell className="max-w-[150px]">
                            <div className="truncate" title={receivable.description}>
                              {receivable.description}
                            </div>
                          </TableCell>
                          {/* Bloco Financeiro Obrigatório */}
                          <TableCell className="text-right font-medium">
                            {formatCurrency(receivable.billedAmount)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatCurrency(receivable.receivedAmount || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-rose-600">
                            {formatCurrency(receivable.glossedAmount || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("gap-1", STATUS_CONFIG[receivable.status].color)}>
                              <StatusIcon className="h-3 w-3" />
                              {STATUS_CONFIG[receivable.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {appealConfig && receivable.appealStatus !== "NAO_INICIADO" ? (
                              <Badge variant="outline" className={cn("gap-1 text-xs", appealConfig.color)}>
                                {AppealIcon && <AppealIcon className="h-3 w-3" />}
                                {appealConfig.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn("text-sm", prazo.isOverdue && "text-rose-500 font-medium")}>
                              {prazo.text} {prazo.isOverdue && "⚠️"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">Ações</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {/* Histórico sempre disponível */}
                                <DropdownMenuItem onClick={() => openHistoryDialog(receivable)}>
                                  <History className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Ver Histórico
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                
                                {/* Ações para FATURADO */}
                                {receivable.status === "FATURADO" && (
                                  <>
                                    <DropdownMenuItem onClick={() => openReceiveDialog(receivable)}>
                                      <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
                                      Marcar como Recebido
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openGlossDialog(receivable)}>
                                      <XCircle className="h-4 w-4 mr-2 text-rose-500" />
                                      Registrar Glosa
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {/* Ações para itens com glosa */}
                                {(receivable.status === "GLOSADO" || receivable.status === "RECEBIDO_COM_GLOSA") && (
                                  <>
                                    {/* Iniciar recurso se não iniciado */}
                                    {(!receivable.appealStatus || receivable.appealStatus === "NAO_INICIADO") && (
                                      <DropdownMenuItem onClick={() => openAppealDialog(receivable)}>
                                        <Gavel className="h-4 w-4 mr-2 text-blue-500" />
                                        Iniciar Recurso
                                      </DropdownMenuItem>
                                    )}

                                    {/* Resolver recurso se em andamento */}
                                    {receivable.appealStatus === "EM_RECURSO" && (
                                      <DropdownMenuItem onClick={() => openResolveAppealDialog(receivable)}>
                                        <Scale className="h-4 w-4 mr-2 text-purple-500" />
                                        Resolver Recurso
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totalizadores */}
        {filteredReceivables.length > 0 && (
          <div className="flex flex-wrap justify-end gap-6 text-sm">
            <div className="text-muted-foreground">
              Faturado: <span className="font-semibold text-foreground">{formatCurrency(stats.totalBilled)}</span>
            </div>
            <div className="text-muted-foreground">
              Recebido: <span className="font-semibold text-emerald-600">{formatCurrency(stats.totalReceived)}</span>
            </div>
            <div className="text-muted-foreground">
              Em Aberto: <span className="font-semibold text-amber-600">{formatCurrency(stats.totalOpen)}</span>
            </div>
            <div className="text-muted-foreground">
              Em Recurso: <span className="font-semibold text-blue-600">{formatCurrency(stats.totalInAppeal)}</span>
            </div>
          </div>
        )}

        {/* Rodapé de governança */}
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground border-t border-border">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Fase 2: Faturamento a Receber • Valores não impactam Caixa, DRE ou Score até recebimento efetivo</span>
            </div>
        </div>
      </div>

      {/* Dialog de Recebimento */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
            <DialogDescription>
              Confirme os dados do recebimento efetivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">Faturamento:</p>
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-muted-foreground mt-1">
                Valor faturado: <span className="font-medium">{formatCurrency(selectedReceivable?.billedAmount || 0)}</span>
              </p>
              {selectedReceivable?.competencia && (
                <p className="text-muted-foreground mt-1">
                  Competência: <span className="font-medium">{selectedReceivable.competencia}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Recebimento</Label>
                <Input
                  type="date"
                  value={receiveData.date}
                  onChange={(e) => setReceiveData({ ...receiveData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Recebido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={receiveData.amount}
                  onChange={(e) => setReceiveData({ ...receiveData, amount: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Ao confirmar, será criada automaticamente uma movimentação de entrada no Fluxo de Caixa.</span>
            </div>
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleMarkReceived} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Recebimento
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Glosa */}
      <Dialog open={glossDialogOpen} onOpenChange={setGlossDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Glosa</DialogTitle>
            <DialogDescription>
              Informe o tipo e valor da glosa do convênio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">Faturamento:</p>
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-muted-foreground mt-1">
                Valor faturado: <span className="font-medium">{formatCurrency(selectedReceivable?.billedAmount || 0)}</span>
              </p>
            </div>

            {/* Tipo de Glosa */}
            <div className="space-y-2">
              <Label>Tipo de Glosa *</Label>
              <Select 
                value={glossData.type} 
                onValueChange={(v) => {
                  const newType = v as GlossType;
                  setGlossData({ 
                    ...glossData, 
                    type: newType,
                    amount: newType === "TOTAL" ? (selectedReceivable?.billedAmount || 0).toString() : glossData.amount
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARCIAL">Parcial (recebeu parte)</SelectItem>
                  <SelectItem value="TOTAL">Total (nada recebido)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor Glosado */}
            <div className="space-y-2">
              <Label>Valor Glosado (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={glossData.amount}
                onChange={(e) => setGlossData({ ...glossData, amount: e.target.value })}
                disabled={glossData.type === "TOTAL"}
              />
              {glossData.type === "PARCIAL" && glossData.amount && selectedReceivable && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <p className="text-emerald-600 font-medium">
                    Valor líquido a receber: {formatCurrency(selectedReceivable.billedAmount - (parseFloat(glossData.amount) || 0))}
                  </p>
                </div>
              )}
            </div>

            {/* Data do Recebimento (só para glosa parcial) */}
            {glossData.type === "PARCIAL" && (
              <div className="space-y-2">
                <Label>Data do Recebimento *</Label>
                <Input
                  type="date"
                  value={glossData.date}
                  onChange={(e) => setGlossData({ ...glossData, date: e.target.value })}
                />
              </div>
            )}

            {/* Motivo da Glosa */}
            <div className="space-y-2">
              <Label>Motivo da Glosa *</Label>
              <Textarea
                placeholder="Descreva o motivo da glosa..."
                value={glossData.reason}
                onChange={(e) => setGlossData({ ...glossData, reason: e.target.value })}
                rows={3}
              />
            </div>

            {/* Opção de iniciar recurso */}
            <div className="flex items-center space-x-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <Checkbox
                id="initiateAppeal"
                checked={glossData.initiateAppeal}
                onCheckedChange={(checked) => setGlossData({ ...glossData, initiateAppeal: checked as boolean })}
              />
              <label htmlFor="initiateAppeal" className="text-sm cursor-pointer">
                <span className="font-medium text-blue-600">Iniciar recurso automaticamente</span>
                <p className="text-xs text-muted-foreground">O valor glosado será encaminhado para recurso</p>
              </label>
            </div>
          </div>

          {/* Alertas informativos */}
          <div className="space-y-2">
            {glossData.type === "PARCIAL" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Será criada uma movimentação de entrada com o valor líquido recebido.</span>
              </div>
            )}
            {glossData.type === "TOTAL" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-rose-500/5 p-2 rounded border border-rose-500/20">
                <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>Glosa total: nenhuma movimentação será gerada. O caixa não será alterado.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGlossDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMarkGlossed} variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Registrar Glosa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Iniciar Recurso */}
      <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Recurso de Glosa</DialogTitle>
            <DialogDescription>
              Informe o valor que será recorrido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">Faturamento:</p>
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-muted-foreground mt-1">
                Valor glosado: <span className="font-medium text-rose-600">{formatCurrency(selectedReceivable?.glossedAmount || 0)}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Valor do Recurso (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={appealData.amount}
                onChange={(e) => setAppealData({ ...appealData, amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Pode ser o valor total glosado ou um valor parcial.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-500/5 p-2 rounded border border-blue-500/20">
              <Gavel className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>O recurso ficará pendente até ser marcado como deferido ou indeferido.</span>
            </div>
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={() => setAppealDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleInitiateAppeal} className="bg-blue-600 hover:bg-blue-700">
                <Gavel className="h-4 w-4 mr-2" />
                Iniciar Recurso
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Resolver Recurso */}
      <Dialog open={resolveAppealDialogOpen} onOpenChange={setResolveAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Recurso de Glosa</DialogTitle>
            <DialogDescription>
              Informe o resultado do recurso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">Faturamento:</p>
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-muted-foreground mt-1">
                Valor em recurso: <span className="font-medium text-blue-600">{formatCurrency(selectedReceivable?.appealAmount || selectedReceivable?.glossedAmount || 0)}</span>
              </p>
            </div>

            {/* Resultado do recurso */}
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
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Deferido (valor recuperado)
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                      Indeferido (perda definitiva)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resolveAppealData.approved && (
              <>
                <div className="space-y-2">
                  <Label>Valor Recuperado (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={resolveAppealData.recoveredAmount}
                    onChange={(e) => setResolveAppealData({ ...resolveAppealData, recoveredAmount: e.target.value })}
                  />
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

          {/* Alertas informativos */}
          <div className="space-y-2">
            {resolveAppealData.approved ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Será criada uma movimentação de entrada com o valor recuperado.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-rose-500/5 p-2 rounded border border-rose-500/20">
                <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>O valor será registrado como perda definitiva. Nenhuma movimentação será gerada.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveAppealDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleResolveAppeal} 
              className={resolveAppealData.approved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {resolveAppealData.approved ? (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Deferir Recurso
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Indeferir Recurso
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico - Timeline Melhorada */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico do Faturamento
            </DialogTitle>
            <DialogDescription>
              Rastreabilidade completa de todas as ações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Resumo visual do status */}
            {selectedReceivable && (
              <>
                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
                  <p className="font-medium">{selectedReceivable.description}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Faturado</p>
                      <p className="font-bold text-foreground">{formatCurrency(selectedReceivable.billedAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Recebido</p>
                      <p className="font-bold text-emerald-600">{formatCurrency(selectedReceivable.receivedAmount || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Glosado</p>
                      <p className="font-bold text-rose-600">{formatCurrency(selectedReceivable.glossedAmount || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline visual simples do fluxo */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  {/* Criado */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Criado</span>
                  </div>
                  
                  <div className={cn(
                    "flex-1 h-1 mx-2 rounded",
                    (selectedReceivable.glossedAmount || 0) > 0 || (selectedReceivable.receivedAmount || 0) > 0
                      ? "bg-blue-500"
                      : "bg-muted"
                  )} />
                  
                  {/* Glosa (condicional) */}
                  {(selectedReceivable.glossedAmount || 0) > 0 && (
                    <>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Glosa</span>
                      </div>
                      
                      <div className={cn(
                        "flex-1 h-1 mx-2 rounded",
                        selectedReceivable.appealStatus === "DEFERIDO" ? "bg-emerald-500" 
                          : selectedReceivable.appealStatus === "EM_RECURSO" ? "bg-blue-500"
                          : selectedReceivable.appealStatus === "INDEFERIDO" ? "bg-rose-500"
                          : "bg-muted"
                      )} />
                    </>
                  )}
                  
                  {/* Recurso (condicional) */}
                  {selectedReceivable.appealStatus && selectedReceivable.appealStatus !== "NAO_INICIADO" && (
                    <>
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          selectedReceivable.appealStatus === "DEFERIDO" ? "bg-emerald-500/20"
                            : selectedReceivable.appealStatus === "INDEFERIDO" ? "bg-rose-500/20"
                            : "bg-blue-500/20"
                        )}>
                          <Gavel className={cn(
                            "h-4 w-4",
                            selectedReceivable.appealStatus === "DEFERIDO" ? "text-emerald-600"
                              : selectedReceivable.appealStatus === "INDEFERIDO" ? "text-rose-600"
                              : "text-blue-600"
                          )} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedReceivable.appealStatus === "DEFERIDO" ? "Deferido"
                            : selectedReceivable.appealStatus === "INDEFERIDO" ? "Indeferido"
                            : "Recurso"}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "flex-1 h-1 mx-2 rounded",
                        (selectedReceivable.receivedAmount || 0) > 0 ? "bg-emerald-500" : "bg-muted"
                      )} />
                    </>
                  )}
                  
                  {/* Recebido */}
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      (selectedReceivable.receivedAmount || 0) > 0 
                        ? "bg-emerald-500/20" 
                        : "bg-muted"
                    )}>
                      <CheckCircle className={cn(
                        "h-4 w-4",
                        (selectedReceivable.receivedAmount || 0) > 0 
                          ? "text-emerald-600" 
                          : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Recebido</span>
                  </div>
                </div>
              </>
            )}

            {/* Timeline de eventos detalhada */}
            <div>
              <p className="text-sm font-medium mb-3">Histórico detalhado</p>
              <div className="space-y-3">
                {selectedReceivable?.history && selectedReceivable.history.length > 0 ? (
                  selectedReceivable.history.map((entry, index) => {
                    // Ícone e cor baseado na ação
                    const getActionConfig = (action: string) => {
                      switch (action) {
                        case "CRIADO":
                          return { icon: FileText, color: "bg-blue-500", label: "Faturamento criado" };
                        case "RECEBIDO":
                          return { icon: CheckCircle, color: "bg-emerald-500", label: "Recebimento confirmado" };
                        case "GLOSA_REGISTRADA":
                          return { icon: AlertTriangle, color: "bg-orange-500", label: "Glosa registrada" };
                        case "RECURSO_INICIADO":
                          return { icon: Gavel, color: "bg-blue-500", label: "Recurso iniciado" };
                        case "RECURSO_DEFERIDO":
                          return { icon: TrendingUp, color: "bg-emerald-500", label: "Recurso deferido" };
                        case "RECURSO_INDEFERIDO":
                          return { icon: TrendingDown, color: "bg-rose-500", label: "Recurso indeferido" };
                        default:
                          return { icon: Clock, color: "bg-muted-foreground", label: action };
                      }
                    };
                    
                    const config = getActionConfig(entry.action);
                    const ActionIcon = config.icon;
                    
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn("w-3 h-3 rounded-full", config.color)} />
                          {index < (selectedReceivable.history?.length || 0) - 1 && (
                            <div className="w-px flex-1 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            <ActionIcon className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{entry.description}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{format(parseISO(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            <span>•</span>
                            <span>{entry.userName}</span>
                            {entry.amount && entry.amount > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground">{formatCurrency(entry.amount)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum histórico disponível
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
