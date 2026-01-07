import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Production, ProductionStatus, ProductionType, UnitConfig } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ProductionStatus, { 
  label: string; 
  color: string; 
  icon: any;
  description: string;
}> = {
  PRODUZIDO: { 
    label: "Produzido", 
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20", 
    icon: Activity,
    description: "Aguardando faturamento. Não impacta o caixa."
  },
  FATURADO: { 
    label: "Faturado", 
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
    icon: FileText,
    description: "Vinculado a faturamento. Aguardando recebimento."
  },
  GLOSADO: { 
    label: "Glosado", 
    color: "bg-rose-500/10 text-rose-600 border-rose-500/20", 
    icon: XCircle,
    description: "Glosa aplicada pelo convênio."
  },
  RECEBIDO: { 
    label: "Recebido", 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", 
    icon: CheckCircle,
    description: "Recebimento confirmado. Valor no caixa."
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

interface ProductionListProps {
  productions: Production[];
  units: UnitConfig[];
  onDelete?: (id: string) => void;
  onViewHistory?: (production: Production) => void;
}

export function ProductionList({ 
  productions, 
  units,
  onDelete,
  onViewHistory,
}: ProductionListProps) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState<Production | null>(null);

  const getUnitName = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    return unit?.name || unitId;
  };

  const openHistoryDialog = (production: Production) => {
    setSelectedProduction(production);
    setHistoryDialogOpen(true);
  };

  if (productions.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhuma produção encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">
          Registre a primeira produção assistencial
        </p>
      </div>
    );
  }

  // AUDIT_FIX: Calculate totals using effectiveQty for packages
  // Nota: ProductionStatus não tem "CANCELADO" - todos os status são válidos para contagem
  // effectiveQty = packageQty (se pacote) ?? quantity (padrão) para consistência com relatórios
  const totals = productions.reduce(
    (acc, p) => {
      const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
      const effectiveQty = isPackage ? (p.packageQty ?? p.quantity ?? 1) : p.quantity;
      return {
        quantity: acc.quantity + effectiveQty,
        estimatedValue: acc.estimatedValue + p.estimatedValue,
        records: acc.records + 1,
      };
    },
    { quantity: 0, estimatedValue: 0, records: 0 }
  );

  return (
    <TooltipProvider>
      <>
        {/* Alerta educativo sobre produção e caixa */}
        <div className="flex items-start gap-3 p-3 mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5">
          <Info className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-violet-600">Produção não gera caixa.</strong> O valor só impacta o caixa quando o faturamento for marcado como "Recebido".
          </p>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[90px]">Data</TableHead>
                <TableHead>Procedimento/Exame</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-center w-[80px]">Qtde</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[140px]">Vínculo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productions.map((production) => {
                const statusConfig = STATUS_CONFIG[production.status];
                const StatusIcon = statusConfig.icon;
                const hasLinkedReceivable = production.linkedReceivableIds && production.linkedReceivableIds.length > 0;
                const isAlreadyBilled = production.status !== "PRODUZIDO";

                return (
                  <TableRow key={production.id} className="group">
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-sm">{format(parseISO(production.productionDate), "dd/MM/yy")}</p>
                        <p className="text-xs text-muted-foreground">{production.competencia}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[220px]">{production.description}</p>
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
                        <p className="text-sm">{production.payerType === "CONVENIO" ? production.convenio : "Particular"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {/* AUDIT_FIX: Exibir effectiveQty para pacotes */}
                      {(() => {
                        const isPackage = production.isPackage || production.productionType === "PACOTE_BOX" || production.productionType === "PACOTE_GTA";
                        const displayQty = isPackage ? (production.packageQty ?? production.quantity ?? 1) : production.quantity;
                        return (
                          <span className="text-lg font-bold text-violet-600">
                            {displayQty}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
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
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/20"
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
                          <DropdownMenuItem onClick={() => openHistoryDialog(production)}>
                            <History className="h-4 w-4 mr-2" />
                            Ver histórico
                          </DropdownMenuItem>
                          {production.status === "PRODUZIDO" && onDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onDelete(production.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals row - quantity focused */}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={4} className="text-right">
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
          
          {/* Production Summary */}
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
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {" · "}
                        {entry.userName}
                      </p>
                      {entry.amount !== undefined && entry.amount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Valor: {formatCurrency(entry.amount)}
                        </p>
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
      </>
    </TooltipProvider>
  );
}
