import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Building2,
  Stethoscope,
  CreditCard,
  Building,
  XCircle,
  Ban,
  Clock,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Transaction, FinancialCategory, TransactionOrigin } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { 
  UNIT_LABELS, 
  PAYMENT_METHOD_LABELS,
  SPECIALTY_LABELS,
  RECEIPT_TYPE_LABELS,
  PAYMENT_METHOD_PARTICULAR_LABELS,
  OPERADORA_LABELS,
  FINANCIAL_CATEGORY_LABELS,
  NON_OPERATIONAL_SUBTYPE_LABELS,
  TRANSACTION_ORIGIN_LABELS,
  TRANSACTION_ORIGIN_ICONS
} from "@/utils/constants";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionForm } from "./TransactionForm";
import { toast } from "sonner";

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  const { transactions: transactionActions, auditLog } = useApp();
  const { cancelTransaction, deleteTransaction } = transactionActions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  const addAuditLog = (_action: string, _details: string, _meta?: unknown) => {};

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const handleCancelClick = (transaction: Transaction) => {
    // Não permite cancelar transações já canceladas
    if (transaction.status === "CANCELADO") {
      toast.error("Esta movimentação já está cancelada");
      return;
    }
    setTransactionToCancel(transaction);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (transactionToCancel) {
      cancelTransaction(
        transactionToCancel.id, 
        user?.name || "Usuário", 
        cancelReason || "Movimentação cancelada pelo usuário"
      );
      addAuditLog(
        "DELETE_TRANSACTION",
        `Transação ${transactionToCancel.id} cancelada: ${cancelReason || "Sem motivo informado"}`,
        { transactionId: transactionToCancel.id, reason: cancelReason }
      );
      toast.success("Movimentação cancelada. Valor não compõe mais o saldo.");
      setCancelDialogOpen(false);
      setTransactionToCancel(null);
      setCancelReason("");
    }
  };

  // Helper para obter informações de pagamento/recebimento
  const getPaymentInfo = (transaction: Transaction) => {
    if (transaction.type === "INCOME") {
      if (transaction.receiptType === "PARTICULAR" && transaction.paymentMethodParticular) {
        return PAYMENT_METHOD_PARTICULAR_LABELS[transaction.paymentMethodParticular] || "";
      }
      if (transaction.receiptType === "CONVENIO" && transaction.operadora) {
        return OPERADORA_LABELS[transaction.operadora] || "";
      }
      return RECEIPT_TYPE_LABELS[transaction.receiptType || ""] || "";
    }
    return PAYMENT_METHOD_LABELS[transaction.paymentMethod] || "";
  };

  // Helper para obter badge de classificação financeira (robusto para dados legados)
  const getFinancialCategoryBadge = (category: unknown) => {
    const configs: Record<FinancialCategory, { icon: string; className: string }> = {
      OPERACIONAL: {
        icon: "🟢",
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      },
      COMPARTILHADO: {
        icon: "🟣",
        className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      },
      NAO_OPERACIONAL: {
        icon: "🔵",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      },
    };

    const key = typeof category === "string" ? category : "";
    const config = (configs as Record<string, { icon: string; className: string }>)[key];

    if (!config) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          ⚪ Classificação (legado)
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className={cn("text-xs gap-1", config.className)}>
        {config.icon} {FINANCIAL_CATEGORY_LABELS[key as FinancialCategory]}
      </Badge>
    );
  };

  if (transactions.length === 0) {
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
        {transactions.map((transaction, index) => {
          const isIncome = transaction.type === "INCOME";
          const isCancelled = transaction.status === "CANCELADO";
          const isPending = transaction.status === "PENDENTE";

          return (
            <div
              key={transaction.id}
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
                      {transaction.category}
                    </h3>
                    {getFinancialCategoryBadge(transaction.financialCategory)}
                    
                    {/* Status Badge */}
                    {isCancelled ? (
                      <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground bg-muted border-muted-foreground/20">
                        <XCircle className="h-3 w-3" />
                        Cancelado
                      </span>
                    ) : isPending ? (
                      <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-amber-600 bg-amber-500/10 border-amber-500/20">
                        <Clock className="h-3 w-3" />
                        Pendente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-success bg-success/10 border-success/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Realizado
                      </span>
                    )}

                    {/* Origin Badge - Rastreabilidade */}
                    {transaction.origin && transaction.origin !== "MANUAL" && (
                      <span className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        transaction.origin === "FATURAMENTO_RECEBIDO" && "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
                        transaction.origin === "FATURAMENTO_GLOSA_PARCIAL" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        transaction.origin === "RECURSO_GLOSA" && "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
                        transaction.origin === "IMPORTACAO" && "bg-slate-500/10 text-slate-600 border-slate-500/20",
                        transaction.origin === "MIGRACAO" && "bg-gray-500/10 text-gray-600 border-gray-500/20"
                      )}>
                        {TRANSACTION_ORIGIN_ICONS[transaction.origin as TransactionOrigin]} {TRANSACTION_ORIGIN_LABELS[transaction.origin as TransactionOrigin]}
                      </span>
                    )}
                  </div>

                  {/* Mensagem de cancelamento */}
                  {isCancelled && transaction.cancelledReason && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Motivo:</span>
                      <span>{transaction.cancelledReason}</span>
                    </div>
                  )}

                  {/* Linha de classificação hierárquica */}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {/* Unidade (apenas para Operacional) */}
                    {transaction.financialCategory === "OPERACIONAL" && transaction.unit && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}>
                        <Building2 className="h-3 w-3" />
                        {UNIT_LABELS[transaction.unit] || transaction.unit}
                      </span>
                    )}

                    {/* Badge corporativo para Não Operacional */}
                    {transaction.financialCategory === "NAO_OPERACIONAL" && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-blue-500/10 text-blue-600"
                      )}>
                        🏢 Corporativo
                      </span>
                    )}

                    {/* Badge para Compartilhado */}
                    {transaction.financialCategory === "COMPARTILHADO" && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-purple-500/10 text-purple-600"
                      )}>
                        🏗️ Custo Compartilhado
                      </span>
                    )}

                    {/* Unidade opcional para Compartilhado */}
                    {transaction.financialCategory === "COMPARTILHADO" && transaction.unit && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-purple-500/5 text-purple-500"
                      )}>
                        <Building2 className="h-3 w-3" />
                        {UNIT_LABELS[transaction.unit] || transaction.unit}
                      </span>
                    )}

                    {/* Subtipo para Não Operacional */}
                    {transaction.financialCategory === "NAO_OPERACIONAL" && transaction.nonOperationalSubtype && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-blue-500/5 text-blue-500"
                      )}>
                        {NON_OPERATIONAL_SUBTYPE_LABELS[transaction.nonOperationalSubtype] || transaction.nonOperationalSubtype}
                      </span>
                    )}

                    {/* Subtipo Evento Extraordinário no Não Operacional */}
                    {transaction.financialCategory === "NAO_OPERACIONAL" && 
                     transaction.nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" && 
                     transaction.adjustmentReason && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium max-w-xs truncate",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-600"
                      )}>
                        ⚡ {transaction.adjustmentReason}
                      </span>
                    )}

                    {/* Especialidade (apenas Centro Clínico + Operacional) */}
                    {transaction.financialCategory === "OPERACIONAL" && transaction.specialty && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
                      )}>
                        <Stethoscope className="h-3 w-3" />
                        {SPECIALTY_LABELS[transaction.specialty]}
                      </span>
                    )}

                    {/* Tipo de Recebimento / Pagamento (apenas Operacional) */}
                    {transaction.financialCategory === "OPERACIONAL" && isIncome && transaction.receiptType && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled 
                          ? "bg-muted text-muted-foreground"
                          : transaction.receiptType === "PARTICULAR" 
                            ? "bg-success/10 text-success" 
                            : "bg-accent text-accent-foreground"
                      )}>
                        {transaction.receiptType === "PARTICULAR" ? (
                          <CreditCard className="h-3 w-3" />
                        ) : (
                          <Building className="h-3 w-3" />
                        )}
                        {RECEIPT_TYPE_LABELS[transaction.receiptType]}
                      </span>
                    )}

                    {/* Forma de Pagamento ou Operadora (apenas Operacional) */}
                    {transaction.financialCategory === "OPERACIONAL" && getPaymentInfo(transaction) && transaction.receiptType && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        isCancelled ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {transaction.receiptType === "PARTICULAR" 
                          ? PAYMENT_METHOD_PARTICULAR_LABELS[transaction.paymentMethodParticular || ""]
                          : OPERADORA_LABELS[transaction.operadora || ""]
                        }
                      </span>
                    )}
                  </div>

                  {/* Data e referência */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.reference && (
                      <>
                        <span>•</span>
                        <span>Ref: {transaction.reference}</span>
                      </>
                    )}
                    {isCancelled && transaction.cancelledAt && (
                      <>
                        <span>•</span>
                        <span className="text-destructive/70">Cancelado em {formatDate(transaction.cancelledAt)}</span>
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
                    {isIncome ? "+" : "-"} {formatCurrency(transaction.amount)}
                    </p>
                    {isCancelled && (
                      <p className="text-xs text-muted-foreground">Não compõe o saldo</p>
                    )}
                    {isPending && (
                      <p className="text-xs text-amber-600">Aguardando realização</p>
                    )}
                  </div>

                  {!isCancelled && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Marcar como Realizado (se PENDENTE) */}
                        {isPending && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => {
                                transactionActions.updateTransaction(
                                  transaction.id, 
                                  { status: "REALIZADO" as any },
                                  user?.name || "Sistema"
                                );
                                addAuditLog(
                                  "UPDATE_TRANSACTION",
                                  `Movimentação ${transaction.id} marcada como REALIZADA`,
                                  { transactionId: transaction.id }
                                );
                                toast.success("Movimentação marcada como Realizada. Valor agora compõe o saldo.");
                              }}
                              className="text-success focus:text-success"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Marcar como Realizado
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => setEditingTransaction(transaction)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleCancelClick(transaction)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Cancelar Movimentação
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
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Movimentação</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <TransactionForm
              editingTransaction={editingTransaction}
              onClose={() => setEditingTransaction(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog (Soft Delete) */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Ban className="h-5 w-5 text-amber-600" />
              </div>
              Cancelar movimentação?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  A movimentação será marcada como <strong>Cancelada</strong> e não comporá mais o saldo de caixa.
                </p>
                
                {/* Impacto Financeiro */}
                {transactionToCancel && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    transactionToCancel.type === "INCOME"
                      ? "bg-rose-500/10 border-rose-500/20"
                      : "bg-emerald-500/10 border-emerald-500/20"
                  )}>
                    <p className="text-sm font-medium text-foreground">Impacto no Saldo</p>
                    <p className={cn(
                      "text-lg font-bold",
                      transactionToCancel.type === "INCOME" ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {transactionToCancel.type === "INCOME" 
                        ? `- ${formatCurrency(transactionToCancel.amount)}` 
                        : `+ ${formatCurrency(transactionToCancel.amount)}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transactionToCancel.type === "INCOME" 
                        ? "A entrada será removida do saldo" 
                        : "A saída será removida do saldo"
                      }
                    </p>
                  </div>
                )}

                <Alert>
                  <AlertDescription>
                    <strong>O registro permanecerá visível no histórico para auditoria.</strong>
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
                  <Textarea
                    id="cancel-reason"
                    placeholder="Informe o motivo do cancelamento..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-amber-600 hover:bg-amber-700">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
