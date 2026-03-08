import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  MoreHorizontal,
  FileText,
  Trash2,
  History,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Hash,
  DollarSign,
  Info,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Production, ProductionStatus, ProductionType, UnitConfig } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  ProductionStatus,
  {
    label: string;
    color: string;
    icon: any;
    description: string;
  }
> = {
  PRODUZIDO: {
    label: "Produzido",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    icon: Activity,
    description: "Aguardando faturamento. Não impacta o caixa.",
  },
  FATURADO: {
    label: "Faturado",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: FileText,
    description: "Vinculado a faturamento. Aguardando recebimento.",
  },
  GLOSADO: {
    label: "Glosado",
    color: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    icon: XCircle,
    description: "Glosa aplicada pelo convênio.",
  },
  RECEBIDO: {
    label: "Recebido",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: CheckCircle,
    description: "Recebimento confirmado. Valor no caixa.",
  },
  CANCELADO: {
    label: "Cancelado",
    color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    icon: XCircle,
    description: "Produção cancelada. Não será faturada.",
  },
};

const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  BOX: "Box",
  ATENDIMENTO_URGENCIA: "Atend. Urgência",
  INTERNACAO: "Internação",
  CIRURGIA: "Cirurgia",
  SESSAO_TERAPEUTICA: "Sessão Terapêutica",
  OUTRO: "Outro",
};

const getProductionTypeLabel = (type: string): string => {
  return PRODUCTION_TYPE_LABELS[type] || type;
};

// Mapa de transições de status válidas
const STATUS_TRANSITIONS: Partial<Record<ProductionStatus, { label: string; next: ProductionStatus; color: string }[]>> = {
  PRODUZIDO: [
    { label: "✅ Marcar como Faturado", next: "FATURADO", color: "text-blue-600" },
  ],
  FATURADO: [
    { label: "💰 Marcar como Recebido", next: "RECEBIDO", color: "text-emerald-600" },
    { label: "⚠️ Registrar Glosa", next: "GLOSADO", color: "text-rose-600" },
  ],
  GLOSADO: [
    { label: "↩️ Voltar para Faturado", next: "FATURADO", color: "text-blue-600" },
  ],
};

interface ProductionListProps {
  productions: Production[];
  units: UnitConfig[];
  onDelete?: (id: string) => void;
  onCancel?: (id: string, reason?: string) => Promise<void>;
  onEdit?: (id: string, data: Partial<Production>) => Promise<void>;
  onViewHistory?: (production: Production) => void;
  onStatusChange?: (id: string, newStatus: ProductionStatus) => Promise<void>;
  onBulkStatusChange?: (ids: string[], status: ProductionStatus) => Promise<void>;
}

export function ProductionList({ productions, units, onDelete, onCancel, onEdit, onViewHistory, onStatusChange, onBulkStatusChange }: ProductionListProps) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduction, setEditingProduction] = useState<Production | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingProduction, setCancellingProduction] = useState<Production | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () =>
    setSelectedIds(new Set(
      filteredProductions.filter(p => p.status !== "CANCELADO").map(p => p.id)
    ));

  const clearSelect = () => setSelectedIds(new Set());

  // Médicos(as)
  const { currentCompany, profile } = useAuth();
  const { extendedSettings } = useCompanySettings();
  const companyId = (currentCompany as any)?.id || (profile as any)?.company_id;

  const [doctorNameById, setDoctorNameById] = useState<Record<string, string>>({});
  const [doctorFilter, setDoctorFilter] = useState<string>("ALL");

  useEffect(() => {
    const fetchDoctorNames = async () => {
      if (!companyId) {
        setDoctorNameById({});
        return;
      }

      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, active, company_id")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        if (import.meta.env.DEV) console.error(error);
        setDoctorNameById({});
        return;
      }

      const map: Record<string, string> = {};
      (data ?? []).forEach((d: any) => {
        if (d?.id && d?.name) map[String(d.id)] = String(d.name);
      });

      setDoctorNameById(map);
    };

    fetchDoctorNames();
  }, [companyId]);

  const getDoctorName = (doctorId?: string | null) => {
    if (!doctorId) return null;
    return doctorNameById[doctorId] || "Médico não encontrado";
  };

  const filteredProductions = useMemo(() => {
    if (!doctorFilter || doctorFilter === "ALL") return productions;
    if (doctorFilter === "NONE") {
      return productions.filter((p) => !(p as any).doctorId);
    }
    return productions.filter((p) => String((p as any).doctorId || "") === doctorFilter);
  }, [productions, doctorFilter]);

  const allSelected =
    selectedIds.size > 0 &&
    selectedIds.size === filteredProductions.filter(p => p.status !== "CANCELADO").length;

  const [selectedProduction, setSelectedProduction] = useState<Production | null>(null);

  const getUnitName = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    return unit?.name || unitId;
  };

  const openHistoryDialog = (production: Production) => {
    setSelectedProduction(production);
    setHistoryDialogOpen(true);
  };

  // Edit form state
  const [editForm, setEditForm] = useState({
    productionDate: "",
    competencia: "",
    unit: "",
    doctorId: "",
    payerType: "CONVENIO" as "CONVENIO" | "PARTICULAR",
    convenio: "",
    paymentMethod: "",
    productionType: "",
    description: "",
    procedureCode: "",
    quantity: 1,
    unitValue: 0,
    specialty: "",
  });

  const openEditDialog = (production: Production) => {
    setEditingProduction(production);
    setEditForm({
      productionDate: production.productionDate,
      competencia: production.competencia,
      unit: production.unit,
      doctorId: production.doctorId || "",
      payerType: production.payerType,
      convenio: production.convenio || "",
      paymentMethod: production.paymentMethod || "",
      productionType: production.productionType,
      description: production.description,
      procedureCode: production.procedureCode || "",
      quantity: production.quantity,
      unitValue: production.unitValue,
      specialty: production.specialty || "",
    });
    setEditDialogOpen(true);
  };

  const isCentroClinico = (unitId: string) => {
    const name = (units.find((u) => u.id === unitId)?.name || unitId).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return name.includes("centro clinico") || name.includes("clinico");
  };

  const handleSaveEdit = async () => {
    if (!editingProduction || !onEdit) return;
    setEditSaving(true);
    try {
      const data: Partial<Production> = {};
      if (editForm.productionDate !== editingProduction.productionDate) data.productionDate = editForm.productionDate;
      if (editForm.competencia !== editingProduction.competencia) data.competencia = editForm.competencia;
      if (editForm.unit !== editingProduction.unit) data.unit = editForm.unit;
      if (editForm.doctorId !== (editingProduction.doctorId || "")) data.doctorId = editForm.doctorId || undefined;
      if (editForm.payerType !== editingProduction.payerType) data.payerType = editForm.payerType;
      if (editForm.convenio !== (editingProduction.convenio || "")) data.convenio = editForm.convenio || undefined;
      if (editForm.paymentMethod !== (editingProduction.paymentMethod || "")) data.paymentMethod = editForm.paymentMethod || undefined;
      if (editForm.productionType !== editingProduction.productionType) data.productionType = editForm.productionType;
      if (editForm.description !== editingProduction.description) data.description = editForm.description;
      if (editForm.procedureCode !== (editingProduction.procedureCode || "")) data.procedureCode = editForm.procedureCode || undefined;
      if (editForm.quantity !== editingProduction.quantity) data.quantity = editForm.quantity;
      if (editForm.unitValue !== editingProduction.unitValue) data.unitValue = editForm.unitValue;
      if (editForm.specialty !== (editingProduction.specialty || "")) data.specialty = editForm.specialty || undefined;

      if (Object.keys(data).length === 0) {
        toast.info("Nenhuma alteração detectada");
        setEditDialogOpen(false);
        return;
      }

      await onEdit(editingProduction.id, data);
      setEditDialogOpen(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const editTotal = editForm.quantity * editForm.unitValue;

  if (productions.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhuma produção encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">Registre a primeira produção assistencial</p>
      </div>
    );
  }

  // Totals
  const totals = filteredProductions.reduce(
    (acc, p) => {
      if (p.status === "CANCELADO") return acc;
      const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
      const effectiveQty = isPackage ? (p.packageQty ?? p.quantity ?? 1) : p.quantity;
      return {
        quantity: acc.quantity + effectiveQty,
        estimatedValue: acc.estimatedValue + p.estimatedValue,
        records: acc.records + 1,
      };
    },
    { quantity: 0, estimatedValue: 0, records: 0 },
  );

  const handleOpenCancel = (production: Production) => {
    setCancellingProduction(production);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingProduction) return;
    setCancelSaving(true);
    try {
      if (onCancel) {
        await onCancel(cancellingProduction.id, cancelReason || undefined);
      } else if (onDelete) {
        onDelete(cancellingProduction.id);
      }
      setCancelDialogOpen(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setCancelSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <>
        {/* Alerta educativo sobre produção e caixa */}
        <div className="flex items-start gap-3 p-3 mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5">
          <Info className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-violet-600">Produção não gera caixa.</strong> O valor só impacta o caixa quando o
            faturamento for marcado como "Recebido".
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Filtrar por médico:</Label>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="h-8 w-[240px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="NONE">Sem médico</SelectItem>
                {Object.entries(doctorNameById)
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Mostrando <strong className="text-foreground">{filteredProductions.length}</strong> de{" "}
            <strong className="text-foreground">{productions.length}</strong>
          </p>
        </div>

        {/* Barra de ações em lote */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 mb-3 animate-fade-in">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionados</span>
            <div className="flex-1" />
            {onBulkStatusChange && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBulkStatusChange([...selectedIds], "FATURADO").then(clearSelect)}
                >
                  Faturar todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBulkStatusChange([...selectedIds], "RECEBIDO").then(clearSelect)}
                >
                  Marcar recebidos
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={clearSelect}>
              Cancelar seleção
            </Button>
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => v ? selectAll() : clearSelect()}
                  />
                </TableHead>
                <TableHead className="w-[90px]">Data</TableHead>
                <TableHead>Procedimento/Exame</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead className="text-center w-[80px]">Qtde</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[140px]">Vínculo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProductions.map((production) => {
                const statusConfig = STATUS_CONFIG[production.status] || STATUS_CONFIG.PRODUZIDO;
                const StatusIcon = statusConfig.icon;
                const hasLinkedReceivable = production.linkedReceivableIds && production.linkedReceivableIds.length > 0;
                const isAlreadyBilled = production.status !== "PRODUZIDO";
                const isCancelled = production.status === "CANCELADO";
                const transitions = STATUS_TRANSITIONS[production.status];

                return (
                  <TableRow key={production.id} className={cn("group", isCancelled && "opacity-50")}>
                    <TableCell>
                      {!isCancelled && (
                        <Checkbox
                          checked={selectedIds.has(production.id)}
                          onCheckedChange={() => toggleSelect(production.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-sm">{format(parseISO(production.productionDate), "dd/MM/yy")}</p>
                        <p className="text-xs text-muted-foreground">{production.competencia}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={cn("font-medium truncate max-w-[220px]", isCancelled && "line-through")}>{production.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-5">
                            {getProductionTypeLabel(production.productionType)}
                          </Badge>
                          {production.procedureCode && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {production.procedureCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getUnitName(production.unit)}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {production.payerType === "CONVENIO" ? production.convenio : "Particular"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const name = getDoctorName((production as any).doctorId);
                        if (!name) {
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }
                        return (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {name}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const isPackage =
                          production.isPackage ||
                          production.productionType === "PACOTE_BOX" ||
                          production.productionType === "PACOTE_GTA";
                        const displayQty = isPackage
                          ? (production.packageQty ?? production.quantity ?? 1)
                          : production.quantity;
                        return <span className="text-lg font-bold text-violet-600">{displayQty}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        if (!transitions || isCancelled || !onStatusChange) {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge variant="outline" className={cn("gap-1 cursor-help", statusConfig.color)}>
                                    <StatusIcon className="h-3 w-3" />
                                    {statusConfig.label}
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[200px]">
                                <p className="text-xs">{statusConfig.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex">
                                <Badge variant="outline" className={cn("gap-1 cursor-pointer hover:opacity-80 transition-opacity", statusConfig.color)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </Badge>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" align="center" onOpenAutoFocus={(e) => e.preventDefault()}>
                              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Alterar status</p>
                              {transitions.map((t) => (
                                <button
                                  key={t.next}
                                  onClick={() => onStatusChange(production.id, t.next)}
                                  className={cn(
                                    "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors",
                                    t.color
                                  )}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {hasLinkedReceivable ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] cursor-help",
                                  production.status === "RECEBIDO"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/20",
                                )}
                              >
                                {production.status === "RECEBIDO" ? (
                                  <>
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Recebido
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="h-3 w-3 mr-1" />
                                    Faturado
                                  </>
                                )}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <div className="text-xs space-y-1">
                              <p className="font-medium">Vinculado a faturamento</p>
                              {production.billedValue && (
                                <p>Valor faturado: {formatCurrency(production.billedValue)}</p>
                              )}
                              {production.receivedValue && (
                                <p className="text-emerald-500">Recebido: {formatCurrency(production.receivedValue)}</p>
                              )}
                              <p className="text-muted-foreground pt-1 border-t">
                                Esta produção já não pode ser faturada novamente.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Badge variant="outline" className="text-[10px] cursor-help text-muted-foreground">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Não faturado
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Disponível para faturamento</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {production.status === "PRODUZIDO" && onEdit && (
                            <DropdownMenuItem onClick={() => openEditDialog(production)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openHistoryDialog(production)}>
                            <History className="h-4 w-4 mr-2" />
                            Ver histórico
                          </DropdownMenuItem>
                          {production.status === "PRODUZIDO" && (onCancel || onDelete) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleOpenCancel(production)}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals row */}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell />
                <TableCell colSpan={5} className="text-right">
                  Totais ({totals.records} registros)
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-lg font-bold text-violet-600">{totals.quantity}</span>
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico da Produção
              </DialogTitle>
              <DialogDescription>
                {selectedProduction?.description}
                {selectedProduction?.procedureCode && (
                  <span className="ml-2 text-xs">({selectedProduction.procedureCode})</span>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedProduction && (
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantidade:</span>
                  <span className="font-bold text-violet-600">{selectedProduction.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Estimado:</span>
                  <span>{formatCurrency(selectedProduction.estimatedValue)}</span>
                </div>
                {selectedProduction.billedValue && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Faturado:</span>
                    <span>{formatCurrency(selectedProduction.billedValue)}</span>
                  </div>
                )}
                {selectedProduction.receivedValue && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Recebido:</span>
                    <span className="text-emerald-600">{formatCurrency(selectedProduction.receivedValue)}</span>
                  </div>
                )}
              </div>
            )}

            {selectedProduction?.history && selectedProduction.history.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {selectedProduction.history
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {" · "}
                          {entry.userName}
                        </p>
                        {entry.amount !== undefined && entry.amount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Valor: {formatCurrency(entry.amount)}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum histórico registrado</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Editar Produção
              </DialogTitle>
              <DialogDescription>
                Altere os campos necessários. Somente produções com status "Produzido" podem ser editadas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data da Produção</Label>
                  <Input
                    type="date"
                    value={editForm.productionDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, productionDate: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Competência (YYYY-MM)</Label>
                  <Input
                    value={editForm.competencia}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, competencia: e.target.value }))}
                    placeholder="2026-02"
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={editForm.unit} onValueChange={(v) => setEditForm((prev) => ({ ...prev, unit: v, specialty: isCentroClinico(v) ? prev.specialty : "" }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCentroClinico(editForm.unit) && (
                <div>
                  <Label className="text-xs">Especialidade</Label>
                  <Select value={editForm.specialty} onValueChange={(v) => setEditForm((prev) => ({ ...prev, specialty: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(extendedSettings.specialties && extendedSettings.specialties.length > 0
                        ? extendedSettings.specialties.filter((s: any) => s.active !== false)
                        : []
                      ).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs">Médico</Label>
                <Select value={editForm.doctorId || "NONE"} onValueChange={(v) => setEditForm((prev) => ({ ...prev, doctorId: v === "NONE" ? "" : v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem médico</SelectItem>
                    {Object.entries(doctorNameById)
                      .sort((a, b) => a[1].localeCompare(b[1]))
                      .map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Pagador</Label>
                  <Select value={editForm.payerType} onValueChange={(v) => setEditForm((prev) => ({ ...prev, payerType: v as "CONVENIO" | "PARTICULAR", convenio: v === "PARTICULAR" ? "" : prev.convenio }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONVENIO">Convênio</SelectItem>
                      <SelectItem value="PARTICULAR">Particular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editForm.payerType === "CONVENIO" && (
                  <div>
                    <Label className="text-xs">Convênio</Label>
                    <Select value={editForm.convenio} onValueChange={(v) => setEditForm((prev) => ({ ...prev, convenio: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(extendedSettings.payers || []).filter((p: any) => p.active !== false).map((p: any) => (
                          <SelectItem key={p.id || p.name} value={p.name || p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editForm.payerType === "PARTICULAR" && (
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={editForm.paymentMethod} onValueChange={(v) => setEditForm((prev) => ({ ...prev, paymentMethod: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(extendedSettings.paymentMethodsParticular || []).filter((m: any) => m.active !== false).map((m: any) => (
                          <SelectItem key={m.id || m.name} value={m.name || m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">Tipo de Produção</Label>
                <Select value={editForm.productionType} onValueChange={(v) => setEditForm((prev) => ({ ...prev, productionType: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(extendedSettings.productionTypes || []).filter((t: any) => t.active !== false).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Descrição / Procedimento</Label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cód. Procedimento</Label>
                  <Input
                    value={editForm.procedureCode}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, procedureCode: e.target.value }))}
                    className="h-9"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor Unitário</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.unitValue}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unitValue: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border text-sm flex justify-between">
                <span className="text-muted-foreground">Total calculado:</span>
                <span className="font-bold text-primary">{formatCurrency(editTotal)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel confirmation dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cancelar Produção</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. A produção será marcada como cancelada e não poderá ser faturada.
              </DialogDescription>
            </DialogHeader>
            {cancellingProduction && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 bg-muted/50 text-sm space-y-1">
                  <p><strong>{cancellingProduction.description}</strong></p>
                  <p className="text-muted-foreground">
                    {format(parseISO(cancellingProduction.productionDate), "dd/MM/yyyy")} · {cancellingProduction.quantity}x · {formatCurrency(cancellingProduction.estimatedValue)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
                  <Input
                    id="cancel-reason"
                    placeholder="Ex: Paciente não compareceu"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelSaving}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancel} disabled={cancelSaving}>
                {cancelSaving ? "Cancelando..." : "Confirmar Cancelamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
