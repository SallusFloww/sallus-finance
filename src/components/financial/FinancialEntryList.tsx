import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Pencil,
  CheckCircle2,
  Ban,
  Clock,
  XCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FinancialEntry, useFinancialEntries } from "@/hooks/useFinancialEntries";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { UNIT_LABELS } from "@/utils/constants";
import { FinancialEntryForm } from "./FinancialEntryForm";
import { useAuth } from "@/contexts/AuthContext";

interface FinancialEntryListProps {
  entries: FinancialEntry[];
}

export function FinancialEntryList({ entries }: FinancialEntryListProps) {
  const { cancelEntry, markAsReceived } = useFinancialEntries();
  const { hasPermission, isAdmin } = useAuth();

  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [entryToCancel, setEntryToCancel] = useState<FinancialEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const canEdit = isAdmin() || hasPermission("MANAGE_TRANSACTIONS");

  const handleCancelClick = (entry: FinancialEntry) => {
    if (entry.status === "cancelado") return;
    setEntryToCancel(entry);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (entryToCancel) {
      await cancelEntry(entryToCancel.id, cancelReason || "Cancelado pelo usuário");
      setCancelDialogOpen(false);
      setEntryToCancel(null);
      setCancelReason("");
    }
  };

  const handleMarkAsReceived = async (entry: FinancialEntry) => {
    await markAsReceived(entry.id, new Date().toISOString().split("T")[0]);
  };

  const getStatusBadge = (entry: FinancialEntry) => {
    if (entry.status === "cancelado") {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground bg-muted border-muted-foreground/20">
          <XCircle className="h-3 w-3" />
          Cancelado
        </Badge>
      );
    }
    if (entry.status === "previsto") {
      return (
        <Badge variant="outline" className="gap-1 text-amber-600 bg-amber-500/10 border-amber-500/20">
          <Clock className="h-3 w-3" />
          Previsto
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-success bg-success/10 border-success/20">
        <CheckCircle2 className="h-3 w-3" />
        Recebido
      </Badge>
    );
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-foreground">Nenhuma movimentação</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre sua primeira movimentação para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {entries.map((entry, index) => {
          const isIncome = entry.type === "entrada";
          const isCancelled = entry.status === "cancelado";
          const isPending = entry.status === "previsto";

          return (
            <div
              key={entry.id}
              className={cn(
                "animate-slide-up group rounded-xl border p-4 shadow-soft transition-all",
                isCancelled 
                  ? "border-muted bg-muted/30 opacity-60" 
                  : isPending
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border bg-card hover:shadow-glow"
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    isCancelled 
                      ? "bg-muted" 
                      : isPending
                        ? "bg-amber-500/10"
                        : isIncome ? "bg-success/10" : "bg-destructive/10"
                  )}
                >
                  {isCancelled ? (
                    <Ban className="h-6 w-6 text-muted-foreground" />
                  ) : isPending ? (
                    <Clock className="h-6 w-6 text-amber-500" />
                  ) : isIncome ? (
                    <ArrowUpRight className="h-6 w-6 text-success" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-destructive" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn(
                      "font-semibold",
                      isCancelled ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                      {entry.descricao}
                    </h3>
                    {getStatusBadge(entry)}
                  </div>

                  {/* Categoria e Unidade */}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {entry.categoria && (
                      <Badge variant="secondary" className="text-xs">
                        {entry.categoria}
                      </Badge>
                    )}
                    {entry.unit_id && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}>
                        <Building2 className="h-3 w-3" />
                        {UNIT_LABELS[entry.unit_id] || entry.unit_id}
                      </span>
                    )}
                  </div>

                  {/* Motivo de cancelamento */}
                  {isCancelled && entry.cancel_reason && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Motivo:</span>
                      <span>{entry.cancel_reason}</span>
                    </div>
                  )}

                  {/* Data */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{formatDate(entry.data_prevista)}</span>
                    {entry.data_recebimento && (
                      <>
                        <span>•</span>
                        <span>Recebido: {formatDate(entry.data_recebimento)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-lg font-bold",
                        isCancelled 
                          ? "text-muted-foreground line-through" 
                          : isIncome ? "text-success" : "text-destructive"
                      )}
                    >
                      {isIncome ? "+" : "-"} {formatCurrency(entry.valor)}
                    </p>
                  </div>

                  {canEdit && !isCancelled && (
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
                      <DropdownMenuContent align="end">
                        {isPending && (
                          <DropdownMenuItem onClick={() => handleMarkAsReceived(entry)}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                            Marcar como Recebido
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditingEntry(entry)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleCancelClick(entry)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Movimentação</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <FinancialEntryForm 
              editingEntry={editingEntry} 
              onClose={() => setEditingEntry(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Movimentação</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O valor não será mais considerado no saldo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">Motivo do cancelamento</Label>
            <Textarea
              id="cancelReason"
              placeholder="Informe o motivo..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
