import { useState, useMemo, useEffect, useCallback } from "react";
import { format, parseISO, min, max } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  ChevronDown,
  ChevronRight,
  Send,
  Building2,
  Users,
  Calendar,
  Activity,
  Banknote,
  Info,
  Filter,
  AlertCircle,
  Hourglass,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useProductionDB } from "@/hooks/useProductionDB";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, parseMoneyBR } from "@/utils/formatters";
import { Production } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

// Labels para tipos de produção OFICIAIS
const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  QUIMIOTERAPIA: "Quimioterapia",
  BOX_PS: "Box / Atendimento PS",
  SESSAO_TERAPEUTICA: "Sessão Terapêutica",
  INTERNACAO: "Internação",
  OUTRO: "Outro",
};

function getProductionTypeLabel(type: string): string {
  return PRODUCTION_TYPE_LABELS[type] || type;
}

// Configuração de alertas
const ALERT_DAYS_THRESHOLD = 15;

// Agrupamento sugerido - AGRUPAMENTO INTELIGENTE
// Critérios: Unidade + Competência + Tipo de Produção + Pagador + Convênio
interface SuggestedBillingGroup {
  key: string;
  unit: string;
  convenio: string;
  competencia: string;
  productionType: string; // Tipo único por grupo
  payerType: string; // PARTICULAR ou CONVENIO
  productions: Production[];
  totalQuantity: number;
  estimatedValue: number;
  oldestProductionDate: string;
  newestProductionDate: string;
  daysOld: number;
  // Status do grupo baseado em vínculo
  billingStatus: "not_billed" | "partially_billed" | "fully_billed";
  billedCount: number;
  linkedCount: number;
}

const CONVENIOS = ["IPASGO", "UNIMED", "BRADESCO", "GEAP", "SUS", "PARTICULAR"];

export default function SuggestedBilling() {
  const { transactions } = useApp();
  const { settings } = transactions;
  const { profile } = useAuth();

  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };

  const {
    productions,
    openProductions,
    linkToReceivable,
    uniqueConvenios,
    refetch: refetchProductions,
  } = useProductionDB();
  const { addReceivable, receivables, refetch: refetchReceivables } = useReceivablesDB();

  // Refetch quando a página ganha foco (cinto + suspensório para realtime)
  useEffect(() => {
    const handleFocus = () => {
      refetchProductions?.();
      refetchReceivables?.();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchProductions, refetchReceivables]);

  // Filtros
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedConvenio, setSelectedConvenio] = useState<string>("all");
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("all");

  // Estados do modal de confirmação
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isPreConfirmOpen, setIsPreConfirmOpen] = useState(false);
  const [isBillingSubmitting, setIsBillingSubmitting] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SuggestedBillingGroup | null>(null);
  const [selectedProductionIds, setSelectedProductionIds] = useState<Set<string>>(new Set());
  const [billingFormData, setBillingFormData] = useState({
    billingDate: format(new Date(), "yyyy-MM-dd"),
    description: "",
    billedAmount: "",
    expectedReceiptDays: "30",
    notes: "",
  });

  // Expandir grupo
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Unidades únicas das produções
  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    productions.forEach((p) => units.add(p.unit));
    return Array.from(units).sort();
  }, [productions]);

  // Competências únicas
  const uniqueCompetencias = useMemo(() => {
    const comps = new Set<string>();
    productions.forEach((p) => {
      if (p.competencia) comps.add(p.competencia);
    });
    return Array.from(comps).sort().reverse();
  }, [productions]);

  // Helper para verificar se produção está vinculada
  const isLinkedToReceivable = (production: Production): boolean => {
    return production.linkedReceivableIds && production.linkedReceivableIds.length > 0;
  };

  // Helper para determinar status de produção individual
  const getProductionStatus = (production: Production): "livre" | "vinculada" | "faturada" => {
    if (production.status === "FATURADO" && isLinkedToReceivable(production)) {
      return "faturada";
    }
    if (isLinkedToReceivable(production)) {
      return "vinculada";
    }
    return "livre";
  };

  // Agrupar produções não faturadas - AGRUPAMENTO INTELIGENTE
  // Critérios: Unidade + Competência + Tipo de Produção + Pagador + Convênio
  const suggestedGroups = useMemo(() => {
    // Filtrar apenas produções com status PRODUZIDO (não faturadas)
    let filteredProductions = productions.filter((p) => p.status === "PRODUZIDO");

    // Aplicar filtros
    if (selectedUnit !== "all") {
      filteredProductions = filteredProductions.filter((p) => p.unit === selectedUnit);
    }
    if (selectedConvenio !== "all") {
      if (selectedConvenio === "PARTICULAR") {
        filteredProductions = filteredProductions.filter((p) => p.payerType === "PARTICULAR");
      } else {
        filteredProductions = filteredProductions.filter((p) => p.convenio === selectedConvenio);
      }
    }
    if (selectedCompetencia !== "all") {
      filteredProductions = filteredProductions.filter((p) => p.competencia === selectedCompetencia);
    }

    // AGRUPAMENTO INTELIGENTE: Unidade + Competência + Tipo + Pagador + Convênio
    const groups: Record<string, SuggestedBillingGroup> = {};

    filteredProductions.forEach((p) => {
      const convenioKey = p.payerType === "PARTICULAR" ? "PARTICULAR" : p.convenio || "OUTROS";
      const payerKey = p.payerType || "CONVENIO";

      // Chave composta com TODOS os critérios obrigatórios
      const key = `${p.unit}|${p.competencia}|${p.productionType}|${payerKey}|${convenioKey}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          unit: p.unit,
          convenio: convenioKey,
          competencia: p.competencia,
          productionType: p.productionType,
          payerType: payerKey,
          productions: [],
          totalQuantity: 0,
          estimatedValue: 0,
          oldestProductionDate: p.productionDate,
          newestProductionDate: p.productionDate,
          daysOld: 0,
          billingStatus: "not_billed",
          billedCount: 0,
          linkedCount: 0,
        };
      }

      groups[key].productions.push(p);
      groups[key].totalQuantity += p.quantity;
      groups[key].estimatedValue += p.estimatedValue;

      // Encontrar produção mais antiga e mais recente
      if (p.productionDate < groups[key].oldestProductionDate) {
        groups[key].oldestProductionDate = p.productionDate;
      }
      if (p.productionDate > groups[key].newestProductionDate) {
        groups[key].newestProductionDate = p.productionDate;
      }

      // Contar vinculadas
      if (isLinkedToReceivable(p)) {
        groups[key].linkedCount++;
      }
    });

    // Calcular dias de atraso e status de faturamento
    const today = new Date();
    const result = Object.values(groups).map((g) => {
      const daysOld = differenceInDays(today, parseISO(g.oldestProductionDate));

      // Determinar status de faturamento do grupo
      let billingStatus: "not_billed" | "partially_billed" | "fully_billed" = "not_billed";
      if (g.linkedCount === g.productions.length && g.linkedCount > 0) {
        billingStatus = "fully_billed";
      } else if (g.linkedCount > 0) {
        billingStatus = "partially_billed";
      }

      return {
        ...g,
        daysOld,
        billingStatus,
      };
    });

    // Ordenar por dias (mais antigos primeiro)
    return result.sort((a, b) => b.daysOld - a.daysOld);
  }, [productions, selectedUnit, selectedConvenio, selectedCompetencia]);

  // Estatísticas
  const stats = useMemo(() => {
    const totalGroups = suggestedGroups.length;
    const totalQuantity = suggestedGroups.reduce((sum, g) => sum + g.totalQuantity, 0);
    const totalValue = suggestedGroups.reduce((sum, g) => sum + g.estimatedValue, 0);
    const criticalGroups = suggestedGroups.filter((g) => g.daysOld > 15).length;
    const attentionGroups = suggestedGroups.filter((g) => g.daysOld > 7 && g.daysOld <= 15).length;

    return { totalGroups, totalQuantity, totalValue, criticalGroups, attentionGroups };
  }, [suggestedGroups]);

  // Alerta de produções antigas sem faturamento
  const oldUnbilledAlert = useMemo(() => {
    const oldProductions = suggestedGroups.filter(
      (g) => g.daysOld > ALERT_DAYS_THRESHOLD && g.billingStatus === "not_billed",
    );
    return oldProductions.length > 0 ? oldProductions : null;
  }, [suggestedGroups]);

  // Handlers
  const toggleGroupExpand = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const openPreConfirm = (group: SuggestedBillingGroup) => {
    setSelectedGroup(group);
    setIsPreConfirmOpen(true);
  };

  const proceedToConfirmDialog = () => {
    if (!selectedGroup) return;

    setIsPreConfirmOpen(false);

    // Selecionar todas as produções livres por padrão
    const freeProductions = selectedGroup.productions.filter((p) => !isLinkedToReceivable(p));
    setSelectedProductionIds(new Set(freeProductions.map((p) => p.id)));

    // Gerar descrição sugerida - agora com tipo único
    const typeLabel = getProductionTypeLabel(selectedGroup.productionType);
    const suggestedDesc = `${typeLabel} – ${selectedGroup.unit} – ${selectedGroup.convenio} – ${selectedGroup.competencia}`;

    // Calcular valor com precisão: soma de (quantity * unitValue) ou estimatedValue
    const freeValue = freeProductions.reduce((sum, p) => {
      const prodValue = p.estimatedValue || p.quantity * p.unitValue;
      return sum + prodValue;
    }, 0);

    setBillingFormData({
      billingDate: format(new Date(), "yyyy-MM-dd"),
      description: suggestedDesc,
      billedAmount: freeValue.toFixed(2),
      expectedReceiptDays: "30",
      notes: `Faturamento sugerido com base em ${freeProductions.length} procedimentos. Valor unitário médio: ${formatCurrency(freeValue / Math.max(1, freeProductions.length))}.`,
    });

    setIsConfirmDialogOpen(true);
  };

  const toggleProductionSelection = (id: string) => {
    const newSelected = new Set(selectedProductionIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProductionIds(newSelected);

    // Recalcular valor estimado com precisão de centavos
    if (selectedGroup) {
      const selectedProds = selectedGroup.productions.filter((p) => newSelected.has(p.id));
      // Soma exata: quantity * unitValue para cada produção
      const newValue = selectedProds.reduce((sum, p) => {
        const prodValue = p.estimatedValue || p.quantity * p.unitValue;
        return sum + prodValue;
      }, 0);
      setBillingFormData((prev) => ({
        ...prev,
        billedAmount: newValue.toFixed(2),
      }));
    }
  };

  const handleConfirmBilling = async () => {
    if (isBillingSubmitting) {
      toast.error("Faturamento já está sendo processado. Aguarde...");
      return;
    }
    if (!selectedGroup || selectedProductionIds.size === 0) {
      toast.error("Selecione pelo menos uma produção para faturar");
      return;
    }

    if (!billingFormData.description || !billingFormData.billedAmount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validação robusta de valor faturado usando utilitário padronizado
    const billedAmount = parseMoneyBR(billingFormData.billedAmount);
    if (billedAmount <= 0) {
      toast.error("Valor faturado deve ser maior que zero");
      return;
    }

    // Validar se valor não diverge excessivamente das produções
    const selectedProds = selectedGroup.productions.filter((p) => selectedProductionIds.has(p.id));
    const expectedValue = selectedProds.reduce((sum, p) => sum + p.estimatedValue, 0);

    if (Math.abs(billedAmount - expectedValue) > expectedValue * 0.5) {
      toast.warning(
        `Atenção: Valor faturado (${formatCurrency(billedAmount)}) difere significativamente do estimado (${formatCurrency(expectedValue)})`,
      );
    }

    setIsBillingSubmitting(true);
    try {
      // Criar chave de idempotência (sempre igual para o mesmo faturamento)
      // Isso evita duplicar receivable quando há clique duplo, retry, refetch, etc.
      const productionIdsArray = Array.from(selectedProductionIds).sort();
      const idempotencyKey = [
        "FATURAMENTO",
        billingFormData.billingDate,
        selectedGroup.competencia,
        selectedGroup.unit,
        selectedGroup.convenio,
        billedAmount.toFixed(2),
        productionIdsArray.join("|"),
      ].join("::");

      // Criar o Receivable (Faturamento a Receber)
      const newReceivable = await addReceivable({
        billingDate: billingFormData.billingDate,
        competencia: selectedGroup.competencia,
        unit: selectedGroup.unit,
        source: selectedGroup.convenio,
        description: billingFormData.description,
        billedAmount,
        status: "FATURADO" as const,
        expectedReceiptDays: parseInt(billingFormData.expectedReceiptDays) || 30,
        notes: billingFormData.notes,
        createdBy: user?.name || "Sistema",
        idempotencyKey,
      });

      if (!newReceivable) {
        toast.error("Erro ao criar faturamento");
        return;
      }

      // Vincular as produções selecionadas ao faturamento
      await linkToReceivable(productionIdsArray, newReceivable.id, billedAmount, user?.name || "Sistema");

      toast.success(`Faturamento criado! ${productionIdsArray.length} produção(ões) vinculada(s).`);

      // Fechar modal e resetar estados
      setIsConfirmDialogOpen(false);
      setSelectedGroup(null);
      setSelectedProductionIds(new Set());
      setBillingFormData({
        billingDate: format(new Date(), "yyyy-MM-dd"),
        description: "",
        billedAmount: "",
        expectedReceiptDays: "30",
        notes: "",
      });
    } finally {
      setIsBillingSubmitting(false);
    }
  };

  // Badge de tempo (linguagem gerencial)
  const getTimeBadge = (daysOld: number) => {
    if (daysOld > 15) {
      return (
        <Badge className="gap-1 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800">
          <AlertTriangle className="h-3 w-3" />
          Crítico
        </Badge>
      );
    }
    if (daysOld > 7) {
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
          <Clock className="h-3 w-3" />
          Atenção
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
        <CircleDot className="h-3 w-3" />
        Recente
      </Badge>
    );
  };

  // Badge de status de faturamento do grupo
  const getBillingStatusBadge = (status: "not_billed" | "partially_billed" | "fully_billed") => {
    switch (status) {
      case "fully_billed":
        return (
          <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Já faturado
          </Badge>
        );
      case "partially_billed":
        return (
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
            <AlertCircle className="h-3 w-3" />
            Parcialmente faturado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 border-muted-foreground/50 text-muted-foreground">
            <Hourglass className="h-3 w-3" />
            Não faturado
          </Badge>
        );
    }
  };

  // Badge de status individual da produção
  const getProductionStatusBadge = (production: Production) => {
    const status = getProductionStatus(production);
    switch (status) {
      case "faturada":
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          >
            Faturada
          </Badge>
        );
      case "vinculada":
        return (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            Vinculada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Livre
          </Badge>
        );
    }
  };

  // Formatar período coberto
  const formatDateRange = (oldest: string, newest: string) => {
    const oldDate = parseISO(oldest);
    const newDate = parseISO(newest);

    if (oldest === newest) {
      return format(oldDate, "dd/MM/yyyy");
    }

    return `${format(oldDate, "dd/MM")} a ${format(newDate, "dd/MM/yyyy")}`;
  };

  // Remover função getTypeSummary - não mais necessária com agrupamento inteligente

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <Send className="h-6 w-6 text-primary" />
                Faturamento Sugerido
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Produções prontas para faturar — usuário decide, sistema registra
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Info className="h-3 w-3" />
                Nada é faturado automaticamente
              </Badge>
            </div>
          </div>

          {/* Alerta de produções antigas */}
          {oldUnbilledAlert && (
            <Card className="border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-700 dark:text-orange-400">
                      Produções sem faturamento há mais de {ALERT_DAYS_THRESHOLD} dias
                    </p>
                    <p className="mt-1 text-orange-600/80 dark:text-orange-400/80">
                      Existem {oldUnbilledAlert.length} grupo(s) de produção aguardando faturamento. Revise para evitar
                      perda de faturamento.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerta de governança */}
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-400">Regras de Governança</p>
                  <ul className="mt-1 text-blue-600/80 dark:text-blue-400/80 space-y-0.5">
                    <li>
                      • Produção <strong>não impacta</strong> Caixa, DRE ou Score
                    </li>
                    <li>
                      • Faturamento sugerido <strong>não impacta</strong> Caixa ou DRE
                    </li>
                    <li>
                      • <strong>Somente</strong> ao marcar "Recebido" no Faturamento a Receber o valor entra no Caixa
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Grupos Pendentes</p>
                    <p className="text-3xl font-bold text-foreground">{stats.totalGroups}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Quantidade Total</p>
                    <p className="text-3xl font-bold text-foreground">{stats.totalQuantity.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">procedimentos</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor Estimado</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">referência</p>
                  </div>
                  <Banknote className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-l-4",
                stats.criticalGroups > 0
                  ? "border-l-orange-500"
                  : stats.attentionGroups > 0
                    ? "border-l-amber-500"
                    : "border-l-muted",
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Requer Atenção</p>
                    <p className="text-3xl font-bold text-foreground">{stats.criticalGroups + stats.attentionGroups}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.criticalGroups > 0 && `${stats.criticalGroups} crítico(s)`}
                      {stats.criticalGroups > 0 && stats.attentionGroups > 0 && " • "}
                      {stats.attentionGroups > 0 && `${stats.attentionGroups} em atenção`}
                      {stats.criticalGroups === 0 && stats.attentionGroups === 0 && "nenhum"}
                    </p>
                  </div>
                  <AlertTriangle
                    className={cn(
                      "h-8 w-8 opacity-80",
                      stats.criticalGroups > 0
                        ? "text-orange-500"
                        : stats.attentionGroups > 0
                          ? "text-amber-500"
                          : "text-muted",
                    )}
                  />
                </div>
              </CardContent>
            </Card>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Convênio</Label>
                  <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="PARTICULAR">PARTICULAR</SelectItem>
                      {uniqueConvenios.map((convenio) => (
                        <SelectItem key={convenio} value={convenio}>
                          {convenio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Competência</Label>
                  <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueCompetencias.map((comp) => (
                        <SelectItem key={comp} value={comp}>
                          {comp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Grupos Sugeridos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Produção Pronta para Faturar
              </CardTitle>
              <CardDescription>
                Blocos consolidados por Unidade, Competência, Tipo de Produção, Pagador e Convênio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestedGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma produção pendente de faturamento</p>
                  <p className="text-sm">Todas as produções já foram faturadas ou não há registros.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestedGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.key);
                    const freeProductions = group.productions.filter((p) => !isLinkedToReceivable(p));

                    return (
                      <Collapsible key={group.key} open={isExpanded} onOpenChange={() => toggleGroupExpand(group.key)}>
                        <div className="border rounded-lg overflow-hidden">
                          {/* Header do grupo - MELHORADO */}
                          <CollapsibleTrigger asChild>
                            <div className="p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                {/* Lado esquerdo - Info principal */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                  )}

                                  <div className="flex-1 min-w-0 space-y-2">
                                    {/* Linha 1: Tipo de Produção (destaque) */}
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-primary/10 text-primary border-primary/30">
                                        <Activity className="h-3 w-3 mr-1" />
                                        {getProductionTypeLabel(group.productionType)}
                                      </Badge>
                                      <span className="text-sm font-medium text-muted-foreground">
                                        ({group.totalQuantity} procedimentos)
                                      </span>
                                    </div>

                                    {/* Linha 2: Unidade, Pagador/Convênio, Competência */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-semibold">{group.unit}</span>
                                      </div>
                                      <Badge variant="outline">
                                        <Users className="h-3 w-3 mr-1" />
                                        {group.convenio}
                                      </Badge>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>{group.competencia}</span>
                                      </div>
                                    </div>

                                    {/* Linha 3: Período coberto e valor estimado */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      <span>
                                        Produções de{" "}
                                        {formatDateRange(group.oldestProductionDate, group.newestProductionDate)}
                                      </span>
                                      <span className="font-medium text-foreground/80">
                                        {formatCurrency(group.estimatedValue)} estimado
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Lado direito - Status e ações */}
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 flex-shrink-0">
                                  {/* Badges de status */}
                                  <div className="flex flex-col gap-1.5">
                                    {getTimeBadge(group.daysOld)}
                                    {getBillingStatusBadge(group.billingStatus)}
                                  </div>

                                  {/* Botões de ação */}
                                  <div className="flex gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleGroupExpand(group.key);
                                          }}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <span className="ml-1 hidden sm:inline">Revisar</span>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Revisar produções</TooltipContent>
                                    </Tooltip>

                                    <Button
                                      size="sm"
                                      disabled={freeProductions.length === 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openPreConfirm(group);
                                      }}
                                    >
                                      <Send className="h-4 w-4 mr-1" />
                                      <span className="hidden sm:inline">Gerar</span> Faturamento
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          {/* Detalhes expandidos - MELHORADO */}
                          <CollapsibleContent>
                            <div className="p-4 border-t bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-right">Valor Est.</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.productions.map((p) => (
                                    <TableRow key={p.id} className={isLinkedToReceivable(p) ? "opacity-60" : ""}>
                                      <TableCell className="text-sm">
                                        {format(parseISO(p.productionDate), "dd/MM/yyyy")}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary" className="text-xs">
                                          {getProductionTypeLabel(p.productionType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm max-w-[200px] truncate">{p.description}</TableCell>
                                      <TableCell className="text-center">{getProductionStatusBadge(p)}</TableCell>
                                      <TableCell className="text-right font-medium">{p.quantity}</TableCell>
                                      <TableCell className="text-right text-sm">
                                        {formatCurrency(p.estimatedValue)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>

                              {/* Legenda */}
                              <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-muted border"></span>
                                  Livre: disponível para faturamento
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                  Vinculada: em processo de faturamento
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                  Faturada: faturamento concluído
                                </span>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Pré-Confirmação com aviso forte de governança */}
          <AlertDialog open={isPreConfirmOpen} onOpenChange={setIsPreConfirmOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Confirmar Faturamento
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>Você irá gerar um faturamento para:</p>
                    {selectedGroup && (
                      <>
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                          <p className="font-semibold text-foreground">
                            {getProductionTypeLabel(selectedGroup.productionType)}
                          </p>
                          <div className="text-sm space-y-1">
                            <p>
                              <span className="text-muted-foreground">Unidade:</span> {selectedGroup.unit}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Pagador:</span> {selectedGroup.convenio}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Competência:</span> {selectedGroup.competencia}
                            </p>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-lg font-bold text-primary">
                              {selectedGroup.productions.filter((p) => !isLinkedToReceivable(p)).length} procedimento(s)
                            </p>
                            <p className="text-sm font-medium">
                              {formatCurrency(selectedGroup.estimatedValue)} valor estimado
                            </p>
                          </div>
                        </div>

                        {/* Aviso fixo de governança */}
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-semibold text-amber-700 dark:text-amber-400">
                                Este faturamento NÃO altera o caixa.
                              </p>
                              <p className="text-amber-600/90 dark:text-amber-400/80 mt-1">
                                O impacto no saldo ocorre <strong>somente</strong> ao marcar como "Recebido" em
                                Faturamento a Receber.
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <p className="text-sm">Deseja continuar para revisar os detalhes?</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={proceedToConfirmDialog}>Revisar e Faturar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Modal de Confirmação/Detalhes */}
          <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Confirmar Faturamento Sugerido
                </DialogTitle>
                <DialogDescription>
                  Revise e ajuste os dados antes de gerar o faturamento. Você pode excluir itens.
                </DialogDescription>
              </DialogHeader>

              {selectedGroup && (
                <div className="space-y-6">
                  {/* Info do grupo - incluindo tipo de produção */}
                  <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg">
                    <Badge className="gap-1 bg-primary/10 text-primary border-primary/30">
                      <Activity className="h-3 w-3" />
                      {getProductionTypeLabel(selectedGroup.productionType)}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      {selectedGroup.unit}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {selectedGroup.convenio}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {selectedGroup.competencia}
                    </Badge>
                  </div>

                  {/* Alerta para produções já vinculadas */}
                  {selectedGroup.linkedCount > 0 && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-blue-700 dark:text-blue-400">
                            {selectedGroup.linkedCount} produção(ões) já vinculada(s)
                          </p>
                          <p className="text-blue-600/80 dark:text-blue-400/80">
                            Estas produções já estão associadas a um faturamento e não podem ser faturadas novamente.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seleção de produções */}
                  <div>
                    <Label className="mb-2 block">Produções a incluir no faturamento:</Label>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup.productions.map((p) => {
                            const isLinked = isLinkedToReceivable(p);
                            return (
                              <TableRow key={p.id} className={isLinked ? "opacity-50 bg-muted/30" : ""}>
                                <TableCell>
                                  {isLinked ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center w-4 h-4">
                                          <AlertCircle className="h-4 w-4 text-amber-500" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Esta produção já está vinculada a um faturamento.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Checkbox
                                      checked={selectedProductionIds.has(p.id)}
                                      onCheckedChange={() => toggleProductionSelection(p.id)}
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span className="font-medium">{getProductionTypeLabel(p.productionType)}</span>
                                  <span className="text-muted-foreground"> - {p.description}</span>
                                  {isLinked && (
                                    <Badge
                                      variant="outline"
                                      className="ml-2 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    >
                                      Já faturado
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">{getProductionStatusBadge(p)}</TableCell>
                                <TableCell className="text-right">{p.quantity}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(p.estimatedValue)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedProductionIds.size} de{" "}
                      {selectedGroup.productions.filter((p) => !isLinkedToReceivable(p)).length} produções livres
                      selecionadas
                    </p>
                  </div>

                  {/* Formulário de faturamento */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data do Faturamento *</Label>
                        <Input
                          type="date"
                          value={billingFormData.billingDate}
                          onChange={(e) =>
                            setBillingFormData((prev) => ({
                              ...prev,
                              billingDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Prazo Recebimento (dias)</Label>
                        <Input
                          type="number"
                          value={billingFormData.expectedReceiptDays}
                          onChange={(e) =>
                            setBillingFormData((prev) => ({
                              ...prev,
                              expectedReceiptDays: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição *</Label>
                      <Input
                        value={billingFormData.description}
                        onChange={(e) =>
                          setBillingFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Ex: Produção Oncologia – Nov/2025"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Valor Faturado (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={billingFormData.billedAmount}
                        onChange={(e) =>
                          setBillingFormData((prev) => ({
                            ...prev,
                            billedAmount: e.target.value,
                          }))
                        }
                        placeholder="0,00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Valor estimado das produções selecionadas. Ajuste conforme o valor real faturado.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        value={billingFormData.notes}
                        onChange={(e) =>
                          setBillingFormData((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Notas adicionais..."
                      />
                    </div>
                  </div>

                  {/* Alerta de governança reforçado */}
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          Importante: Este faturamento NÃO altera o caixa
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400/80 mt-1">
                          O valor só entrará no caixa quando você marcar como "Recebido" em Faturamento a Receber.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmBilling}
                  disabled={selectedProductionIds.size === 0 || isBillingSubmitting}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isBillingSubmitting ? "Processando..." : "Confirmar Faturamento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
