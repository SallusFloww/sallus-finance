import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, AlertTriangle, Info, HelpCircle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Transaction, 
  TransactionType, 
  TransactionStatus,
  PaymentMethod,
  Specialty,
  ReceiptType,
  PaymentMethodParticular,
  Operadora,
  FinancialCategory,
  NonOperationalSubtype,
  ApportionmentCriteria,
  UnitApportionment
} from "@/types";
import { 
  PAYMENT_METHOD_LABELS,
  BUSINESS_UNITS,
  SPECIALTIES,
  RECEIPT_TYPES,
  PAYMENT_METHODS_PARTICULAR,
  OPERADORAS,
  FINANCIAL_CATEGORIES,
  NON_OPERATIONAL_SUBTYPES,
  APPORTIONMENT_CRITERIA,
  SHARED_EXPENSE_CATEGORIES
} from "@/utils/constants";
import { toast } from "sonner";
import { parseMoneyBR } from "@/utils/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
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
import { UnitApportionmentBlock } from "./UnitApportionmentBlock";

interface TransactionFormProps {
  editingTransaction?: Transaction;
  onClose?: () => void;
}

export function TransactionForm({ editingTransaction, onClose }: TransactionFormProps) {
  const { transactions, auditLog } = useApp();
  const { settings, addTransaction, updateTransaction } = transactions;
  const { profile } = useAuth();
  
  // Compatibilidade com código legado
  const user = { name: profile?.full_name || "Sistema" };
  const addAuditLog = (_action: string, _details: string, _meta?: unknown) => {};

  const categories = settings.categories;

  const [open, setOpen] = useState(false);
  const [showAporteConfirmation, setShowAporteConfirmation] = useState(false);
  const [type, setType] = useState<TransactionType>(editingTransaction?.type || "INCOME");
  const [date, setDate] = useState<Date>(
    editingTransaction ? new Date(editingTransaction.date) : new Date()
  );
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || "");
  
  // ============= CLASSIFICAÇÃO FINANCEIRA (3 OPÇÕES) =============
  const [financialCategory, setFinancialCategory] = useState<FinancialCategory>(
    editingTransaction?.financialCategory || "OPERACIONAL"
  );
  const [nonOperationalSubtype, setNonOperationalSubtype] = useState<NonOperationalSubtype | "">(
    editingTransaction?.nonOperationalSubtype || ""
  );
  const [adjustmentReason, setAdjustmentReason] = useState(
    editingTransaction?.adjustmentReason || ""
  );
  const [adjustmentReference, setAdjustmentReference] = useState(
    editingTransaction?.adjustmentReference || ""
  );
  const [apportionmentCriteria, setApportionmentCriteria] = useState<ApportionmentCriteria | "">(
    editingTransaction?.apportionmentCriteria || ""
  );
  const [unitApportionments, setUnitApportionments] = useState<UnitApportionment[]>(
    editingTransaction?.unitApportionments || []
  );
  
  // Nível 1 - Unidade de Negócio
  const [unit, setUnit] = useState<string>(editingTransaction?.unit || "");
  
  // Nível 2 - Especialidade (apenas Centro Clínico)
  const [specialty, setSpecialty] = useState<Specialty | "">(editingTransaction?.specialty || "");
  
  // Nível 3 - Tipo de Recebimento (apenas INCOME)
  const [receiptType, setReceiptType] = useState<ReceiptType | "">(editingTransaction?.receiptType || "");
  
  // Nível 4A - Forma de Pagamento (Particular)
  const [paymentMethodParticular, setPaymentMethodParticular] = useState<PaymentMethodParticular | "">(
    editingTransaction?.paymentMethodParticular || ""
  );
  
  // Nível 4B - Operadora (Convênio)
  const [operadora, setOperadora] = useState<Operadora | "">(editingTransaction?.operadora || "");
  
  const [category, setCategory] = useState(editingTransaction?.category || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    editingTransaction?.paymentMethod || "PIX"
  );
  const [reference, setReference] = useState(editingTransaction?.reference || "");
  const [notes, setNotes] = useState(editingTransaction?.notes || "");
  
  // ============= CONTROLE DE STATUS DE RECEBIMENTO (ENTRADAS) =============
  const [receiptStatus, setReceiptStatus] = useState<TransactionStatus>(
    editingTransaction?.status || "REALIZADO"
  );
  const [receivedAt, setReceivedAt] = useState<Date | undefined>(
    editingTransaction?.receivedAt ? new Date(editingTransaction.receivedAt) : undefined
  );
  const [receiptObservation, setReceiptObservation] = useState(
    editingTransaction?.receiptObservation || ""
  );

  // ============= LÓGICA DE CAMPOS POR CLASSIFICAÇÃO =============
  useEffect(() => {
    // Limpar campos dependentes quando classificação muda
    if (financialCategory !== "NAO_OPERACIONAL") {
      setNonOperationalSubtype("");
      setAdjustmentReason("");
      setAdjustmentReference("");
    }
    if (financialCategory !== "COMPARTILHADO") {
      setApportionmentCriteria("");
      setUnitApportionments([]);
    }
    
    // Regras de unidade por classificação
    if (financialCategory === "OPERACIONAL") {
      // OPERACIONAL — UNIDADE: Unidade OBRIGATÓRIA
      if (!unit) {
        setUnit("ONCOLOGIA");
      }
    } else if (financialCategory === "COMPARTILHADO") {
      // OPERACIONAL — COMPARTILHADO: Unidade DESABILITADA
      setUnit("");
    } else if (financialCategory === "NAO_OPERACIONAL") {
      // NÃO OPERACIONAL: Unidade SEMPRE DESABILITADA
      setUnit("");
    }
    
    // Limpar campos de receita operacional para outras classificações
    if (financialCategory !== "OPERACIONAL") {
      setReceiptType("");
      setPaymentMethodParticular("");
      setOperadora("");
      setSpecialty("");
    }
  }, [financialCategory]);

  // Resetar especialidade quando unidade não é Centro Clínico
  useEffect(() => {
    if (unit !== "CENTRO_CLINICO") {
      setSpecialty("");
    }
  }, [unit]);

  // Resetar campos de receita quando tipo não é INCOME
  // E resetar categoria quando tipo muda para evitar categoria incompatível
  useEffect(() => {
    if (type !== "INCOME") {
      setReceiptType("");
      setPaymentMethodParticular("");
      setOperadora("");
    }
    // Limpar categoria quando tipo muda (será preenchida com opção compatível)
    if (!editingTransaction) {
      setCategory("");
    }
  }, [type, editingTransaction]);

  // Resetar forma de pagamento/operadora quando tipo de recebimento muda
  useEffect(() => {
    if (receiptType === "PARTICULAR") {
      setOperadora("");
    } else if (receiptType === "CONVENIO") {
      setPaymentMethodParticular("");
    } else {
      setPaymentMethodParticular("");
      setOperadora("");
    }
  }, [receiptType]);

  // ============= AUTO-CLASSIFICAÇÃO PARA CATEGORIAS COMPARTILHADAS =============
  // Quando categoria é uma despesa estrutural, sugerir COMPARTILHADO automaticamente
  useEffect(() => {
    if (!editingTransaction && type === "EXPENSE" && category) {
      // Normalizar nome da categoria para comparação
      const normalizedCategory = category.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");
      
      // Verificar se é uma categoria que deve ser compartilhada
      const isSharedCategory = SHARED_EXPENSE_CATEGORIES.some(shared => 
        normalizedCategory.includes(shared) || 
        shared.includes(normalizedCategory) ||
        category.toLowerCase().includes(shared.replace("_", " "))
      );
      
      if (isSharedCategory && financialCategory !== "COMPARTILHADO") {
        setFinancialCategory("COMPARTILHADO");
      }
    }
  }, [category, type, editingTransaction]);

  // Palavras ambíguas que podem indicar receita ao invés de aporte de capital
  const AMBIGUOUS_KEYWORDS = ["royalty", "royalties", "licença", "licenciamento", "aluguel", "renda", "receita"];
  
  const hasAmbiguousDescription = () => {
    const textToCheck = (category + " " + notes + " " + reference).toLowerCase();
    return AMBIGUOUS_KEYWORDS.some(keyword => textToCheck.includes(keyword));
  };

  const processSubmit = async () => {
    const transactionData = {
      date: date.toISOString(),
      type,
      amount: parseMoneyBR(amount),
      financialCategory,
      nonOperationalSubtype: financialCategory === "NAO_OPERACIONAL" 
        ? nonOperationalSubtype as NonOperationalSubtype 
        : undefined,
      adjustmentReason: financialCategory === "NAO_OPERACIONAL" && 
        (nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" || nonOperationalSubtype === "AJUSTE_CONTABIL_POSITIVO" || nonOperationalSubtype === "AJUSTE_CONTABIL_NEGATIVO" || nonOperationalSubtype === "DESPESA_JURIDICA_NAO_RECORRENTE")
        ? adjustmentReason 
        : undefined,
      adjustmentReference: financialCategory === "NAO_OPERACIONAL" && 
        (nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" || nonOperationalSubtype === "AJUSTE_CONTABIL_POSITIVO" || nonOperationalSubtype === "AJUSTE_CONTABIL_NEGATIVO" || nonOperationalSubtype === "DESPESA_JURIDICA_NAO_RECORRENTE")
        ? adjustmentReference 
        : undefined,
      isNonRecurrent: financialCategory === "NAO_OPERACIONAL" && nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" 
        ? true 
        : undefined,
      apportionmentCriteria: financialCategory === "COMPARTILHADO" && apportionmentCriteria
        ? apportionmentCriteria as ApportionmentCriteria
        : undefined,
      unitApportionments: financialCategory === "COMPARTILHADO" && type === "EXPENSE" && unitApportionments.length > 0
        ? unitApportionments
        : undefined,
      unit: financialCategory === "OPERACIONAL" ? unit : undefined,
      specialty: unit === "CENTRO_CLINICO" && financialCategory === "OPERACIONAL" 
        ? specialty as Specialty 
        : undefined,
      receiptType: type === "INCOME" && financialCategory === "OPERACIONAL" 
        ? receiptType as ReceiptType 
        : undefined,
      paymentMethodParticular: type === "INCOME" && receiptType === "PARTICULAR" && financialCategory === "OPERACIONAL"
        ? paymentMethodParticular as PaymentMethodParticular 
        : undefined,
      operadora: type === "INCOME" && receiptType === "CONVENIO" && financialCategory === "OPERACIONAL"
        ? operadora as Operadora 
        : undefined,
      category,
      paymentMethod,
      status: type === "INCOME" ? receiptStatus : "REALIZADO",
      receivedAt: type === "INCOME" && receiptStatus === "REALIZADO" 
        ? (receivedAt?.toISOString() || new Date().toISOString())
        : undefined,
      receiptObservation: type === "INCOME" && receiptObservation 
        ? receiptObservation 
        : undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      createdBy: user?.name || "Sistema",
    };

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, transactionData);
      addAuditLog(
        "UPDATE_TRANSACTION",
        `Transação ${editingTransaction.id} atualizada`,
        { transactionId: editingTransaction.id, ...transactionData }
      );
      toast.success("Movimentação atualizada com sucesso!");
    } else {
      const newTransaction = await addTransaction(transactionData);
      addAuditLog(
        "CREATE_TRANSACTION",
        `Nova ${type === "INCOME" ? "entrada" : "saída"} de ${amount}`,
        { transactionId: newTransaction?.id, ...transactionData }
      );
      toast.success("Movimentação registrada com sucesso!");
    }

    resetForm();
    setOpen(false);
    onClose?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseMoneyBR(amount) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (!category) {
      toast.error("Selecione uma categoria");
      return;
    }

    if (!financialCategory) {
      toast.error("Selecione a classificação financeira");
      return;
    }

    // ============= VALIDAÇÕES POR CLASSIFICAÇÃO =============
    
    // A) OPERACIONAL — UNIDADE: Unidade obrigatória
    if (financialCategory === "OPERACIONAL") {
      if (!unit) {
        toast.error("Selecione a unidade de negócio");
        return;
      }
      
      if (unit === "CENTRO_CLINICO" && !specialty) {
        toast.error("Selecione uma especialidade para o Centro Clínico");
        return;
      }

      if (type === "INCOME" && !receiptType) {
        toast.error("Selecione o tipo de recebimento");
        return;
      }

      if (type === "INCOME" && receiptType === "PARTICULAR" && !paymentMethodParticular) {
        toast.error("Selecione a forma de pagamento");
        return;
      }

      if (type === "INCOME" && receiptType === "CONVENIO" && !operadora) {
        toast.error("Selecione a operadora do convênio");
        return;
      }
    }

    // B) OPERACIONAL — COMPARTILHADO: Não precisa de unidade (já foi limpa)
    // Validação de governança: impedir unidade vinculada
    if (financialCategory === "COMPARTILHADO" && unit) {
      toast.error("Custos compartilhados não podem ter unidade vinculada");
      return;
    }

    // Validação de rateio para despesas compartilhadas
    if (financialCategory === "COMPARTILHADO" && type === "EXPENSE" && apportionmentCriteria) {
      const totalCriterion = unitApportionments.reduce((sum, a) => sum + a.criterionValue, 0);
      
      if (totalCriterion === 0) {
        toast.error("Preencha os valores de rateio para cada unidade");
        return;
      }
      
      // Para percentual, soma deve ser exatamente 100%
      if (apportionmentCriteria === "PERCENTUAL" && Math.abs(totalCriterion - 100) >= 0.01) {
        toast.error(`A soma dos percentuais deve ser exatamente 100%. Atual: ${totalCriterion.toFixed(1)}%`);
        return;
      }
    }

    // C) NÃO OPERACIONAL: Subtipo obrigatório
    if (financialCategory === "NAO_OPERACIONAL") {
      if (!nonOperationalSubtype) {
        toast.error("Selecione o subtipo financeiro");
        return;
      }
      
      // Se for Evento Extraordinário, Ajuste Contábil ou Despesa Jurídica, motivo obrigatório
      if ((nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" || nonOperationalSubtype === "AJUSTE_CONTABIL_POSITIVO" || nonOperationalSubtype === "AJUSTE_CONTABIL_NEGATIVO" || nonOperationalSubtype === "DESPESA_JURIDICA_NAO_RECORRENTE") && !adjustmentReason) {
        toast.error("Informe o motivo do ajuste/evento");
        return;
      }

      // Validação de governança: impedir unidade vinculada
      if (unit) {
        toast.error("Lançamentos não operacionais não podem ter unidade vinculada");
        return;
      }

      // Confirmação para Aporte de Sócio com descrições ambíguas
      if (nonOperationalSubtype === "APORTE_SOCIO" && hasAmbiguousDescription()) {
        setShowAporteConfirmation(true);
        return;
      }
    }

    processSubmit();
  };

  const resetForm = () => {
    setType("INCOME");
    setDate(new Date());
    setAmount("");
    setFinancialCategory("OPERACIONAL");
    setNonOperationalSubtype("");
    setAdjustmentReason("");
    setAdjustmentReference("");
    setApportionmentCriteria("");
    setUnitApportionments([]);
    setUnit("ONCOLOGIA");
    setSpecialty("");
    setReceiptType("");
    setPaymentMethodParticular("");
    setOperadora("");
    setCategory("");
    setPaymentMethod("PIX");
    setReference("");
    setNotes("");
    setReceiptStatus("REALIZADO");
    setReceivedAt(undefined);
    setReceiptObservation("");
  };

  // ============= CAMPOS CONDICIONAIS =============
  // Rateio apenas para despesas compartilhadas com critério definido

  const showSpecialty = unit === "CENTRO_CLINICO" && financialCategory === "OPERACIONAL";
  const showReceiptType = type === "INCOME" && financialCategory === "OPERACIONAL";
  const showPaymentMethodParticular = type === "INCOME" && receiptType === "PARTICULAR" && financialCategory === "OPERACIONAL";
  const showOperadora = type === "INCOME" && receiptType === "CONVENIO" && financialCategory === "OPERACIONAL";
  const showNonOperationalFields = financialCategory === "NAO_OPERACIONAL";
  const showSharedFields = financialCategory === "COMPARTILHADO";
  // Bloco de rateio agora renderizado inline dentro do showSharedFields
  const showUnitField = financialCategory === "OPERACIONAL";
  const showExtraFields = financialCategory === "NAO_OPERACIONAL" && 
    (nonOperationalSubtype === "EVENTO_EXTRAORDINARIO" || nonOperationalSubtype === "AJUSTE_CONTABIL_POSITIVO" || nonOperationalSubtype === "AJUSTE_CONTABIL_NEGATIVO" || nonOperationalSubtype === "DESPESA_JURIDICA_NAO_RECORRENTE");


  // Badge de classificação financeira
  const getFinancialCategoryBadge = () => {
    const cat = FINANCIAL_CATEGORIES.find(c => c.id === financialCategory);
    if (!cat) return null;
    
    const colorClass = financialCategory === "OPERACIONAL" 
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : financialCategory === "COMPARTILHADO"
        ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
        : "bg-blue-500/10 text-blue-600 border-blue-500/20";
    
    return (
      <Badge variant="outline" className={cn("gap-1", colorClass)}>
        {cat.icon} {cat.name}
      </Badge>
    );
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de Movimentação */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === "INCOME" ? "default" : "outline"}
          className={cn(
            "w-full",
            type === "INCOME" && "gradient-success text-success-foreground"
          )}
          onClick={() => setType("INCOME")}
        >
          Entrada
        </Button>
        <Button
          type="button"
          variant={type === "EXPENSE" ? "default" : "outline"}
          className={cn(
            "w-full",
            type === "EXPENSE" && "gradient-destructive text-destructive-foreground"
          )}
          onClick={() => setType("EXPENSE")}
        >
          Saída
        </Button>
      </div>

      {/* ============= STATUS DE RECEBIMENTO (APENAS ENTRADAS) ============= */}
      {type === "INCOME" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-primary font-semibold flex items-center gap-2">
              Status de Recebimento *
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      Apenas entradas com status "Recebido" impactam o saldo em caixa.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={receiptStatus === "PENDENTE" ? "default" : "outline"}
              className={cn(
                "w-full justify-start gap-2",
                receiptStatus === "PENDENTE" && "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              onClick={() => setReceiptStatus("PENDENTE")}
            >
              <Clock className="h-4 w-4" />
              Previsto
            </Button>
            <Button
              type="button"
              variant={receiptStatus === "REALIZADO" ? "default" : "outline"}
              className={cn(
                "w-full justify-start gap-2",
                receiptStatus === "REALIZADO" && "gradient-success text-success-foreground"
              )}
              onClick={() => setReceiptStatus("REALIZADO")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Recebido
            </Button>
          </div>

          {receiptStatus === "PENDENTE" && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                Esta entrada <strong>não impactará o saldo</strong> até ser marcada como "Recebido".
              </AlertDescription>
            </Alert>
          )}

          {receiptStatus === "REALIZADO" && (
            <div className="space-y-2">
              <Label className="text-sm">Data do Recebimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !receivedAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {receivedAt ? format(receivedAt, "dd/MM/yyyy") : "Hoje (padrão)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={receivedAt}
                    onSelect={setReceivedAt}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Observação do Recebimento (opcional)</Label>
            <Input
              placeholder="Ex: Depósito bancário ref. NF 1234"
              value={receiptObservation}
              onChange={(e) => setReceiptObservation(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ============= CLASSIFICAÇÃO FINANCEIRA (3 OPÇÕES) ============= */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-primary font-semibold flex items-center gap-2">
            Classificação Financeira *
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    Define como este lançamento impacta DRE, Score e indicadores operacionais.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          {getFinancialCategoryBadge()}
        </div>
        
        <Select 
          value={financialCategory} 
          onValueChange={(v) => setFinancialCategory(v as FinancialCategory)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a classificação" />
          </SelectTrigger>
          <SelectContent>
            {FINANCIAL_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <div>
                    <span className="font-medium">{cat.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      — {cat.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ============= AVISOS POR CLASSIFICAÇÃO ============= */}
        
        {/* A) OPERACIONAL — UNIDADE */}
        {financialCategory === "OPERACIONAL" && (
          <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 p-3 text-sm">
            <Info className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-emerald-700 dark:text-emerald-300">
              <p className="font-medium">Receita ou custo operacional direto de uma unidade assistencial.</p>
              <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                <li>✅ Impacta: Caixa, DRE Operacional, Score Operacional</li>
                <li>📌 Unidade de Negócio OBRIGATÓRIA</li>
              </ul>
            </div>
          </div>
        )}

        {/* B) OPERACIONAL — COMPARTILHADO */}
        {financialCategory === "COMPARTILHADO" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                🏗️ Despesa estrutural compartilhada entre unidades
              </Badge>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-purple-500/10 p-3 text-sm">
              <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-purple-700 dark:text-purple-300">
                <p className="font-medium">Despesa estrutural compartilhada entre unidades — não atribuída diretamente a nenhuma unidade específica.</p>
                <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                  <li>✅ Impacta: Caixa, DRE (Custos Compartilhados após Margem Assistencial)</li>
                  <li>❌ <strong>NÃO impacta:</strong> Score por unidade, Margem Assistencial</li>
                  <li>📌 Exemplos: Energia, Água, Internet, Limpeza, Manutenção, Segurança</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* C) NÃO OPERACIONAL / FINANCEIRO */}
        {financialCategory === "NAO_OPERACIONAL" && (
          <div className="space-y-2">
            <Alert className="border-blue-500/30 bg-blue-500/10">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                <strong className="block mb-1">⚠️ Movimentação corporativa — não representa desempenho operacional das unidades.</strong>
                <ul className="text-xs space-y-0.5 list-disc list-inside mt-2">
                  <li>✅ Impacta: Caixa, Resultado Não Operacional no DRE</li>
                  <li>❌ <strong>NÃO impacta:</strong> Score Operacional, Ranking ou Indicadores Assistenciais</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* ============= CAMPOS PARA NÃO OPERACIONAL ============= */}
      {showNonOperationalFields && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Nível: Empresa (Corporativo) - Campo visual FIXO e não editável */}
          <div className="space-y-2">
            <Label className="text-muted-foreground font-medium">Nível (fixo)</Label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-blue-500/30 bg-blue-500/10">
              <span className="text-lg">🏢</span>
              <span className="font-semibold text-blue-700 dark:text-blue-300">Empresa (Corporativo)</span>
              <Badge variant="outline" className="ml-auto text-xs bg-blue-500/20 border-blue-500/30 text-blue-600">
                Corporativo
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-primary font-semibold">Subtipo Financeiro *</Label>
            <Select 
              value={nonOperationalSubtype} 
              onValueChange={(v) => setNonOperationalSubtype(v as NonOperationalSubtype)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o subtipo" />
              </SelectTrigger>
              <SelectContent>
                {/* Separador visual por tipo */}
                {type === "INCOME" && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    📥 Receitas Não Operacionais
                  </div>
                )}
                {type === "EXPENSE" && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    📤 Despesas Não Operacionais
                  </div>
                )}
                {NON_OPERATIONAL_SUBTYPES
                  .filter((sub) => sub.type === type)
                  .map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      <span className="flex items-center gap-2">
                        <span>{sub.icon}</span>
                        <span>{sub.name}</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alerta especial para Aporte de Sócio */}
          {nonOperationalSubtype === "APORTE_SOCIO" && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Atenção:</strong> Aporte de Sócio é entrada de capital (não receita).
                <ul className="mt-1 list-disc list-inside">
                  <li>✅ Impacta <strong>apenas o Caixa</strong></li>
                  <li>❌ NÃO entra em Receita, Margem ou Resultado Operacional</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Campos extras para Evento Extraordinário / Ajuste Contábil */}
          {showExtraFields && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <Label className="text-primary font-semibold">Motivo / Descrição *</Label>
                <Textarea
                  placeholder="Ex: Venda de ativo, Indenização, Acordo judicial, Correção contábil..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Referência (opcional)</Label>
                <Input
                  placeholder="Mês/ano ou documento de referência"
                  value={adjustmentReference}
                  onChange={(e) => setAdjustmentReference(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============= CAMPOS PARA COMPARTILHADO ============= */}
      {showSharedFields && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Campo visual de nível - Estrutura Compartilhada */}
          <div className="space-y-2">
            <Label className="text-muted-foreground font-medium">Nível</Label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-purple-500/20 bg-purple-500/5">
              <span className="text-lg">🏗️</span>
              <span className="font-medium text-purple-700 dark:text-purple-300">Estrutura Compartilhada</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Despesa estrutural compartilhada entre unidades — não vinculada a nenhuma unidade assistencial específica.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground font-medium flex items-center gap-2">
              Critério de Rateio {type === "EXPENSE" && "(obrigatório para saídas)"}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Como funciona o rateio?</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5">
                      <li><strong>Fixo:</strong> Valor dividido igualmente entre unidades selecionadas</li>
                      <li><strong>Por m²:</strong> Proporcional à metragem de cada unidade</li>
                      <li><strong>Percentual:</strong> Proporcional ao faturamento de cada unidade</li>
                      <li><strong>Manual:</strong> Você define os valores para cada unidade</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select value={apportionmentCriteria} onValueChange={(v) => setApportionmentCriteria(v as ApportionmentCriteria)}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="Selecione o critério de rateio" />
              </SelectTrigger>
              <SelectContent>
                {APPORTIONMENT_CRITERIA.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bloco de rateio por unidade */}
          {type === "EXPENSE" && financialCategory === "COMPARTILHADO" && apportionmentCriteria !== "" && (
            <UnitApportionmentBlock
              totalAmount={parseMoneyBR(amount)}
              apportionmentCriteria={apportionmentCriteria}
              apportionments={unitApportionments}
              onApportionmentsChange={setUnitApportionments}
            />
          )}
        </div>
      )}

      {/* Data e Valor */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd/MM/yyyy") : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      {/* ============= NÍVEL 1 - UNIDADE DE NEGÓCIO (apenas OPERACIONAL) ============= */}
      {showUnitField && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-primary font-semibold">
            Unidade de Negócio *
          </Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* NÍVEL 2 - Especialidade (apenas Centro Clínico + Operacional) */}
      {showSpecialty && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-primary font-semibold">Especialidade *</Label>
          <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a especialidade" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALTIES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* NÍVEL 3 - Tipo de Recebimento (apenas INCOME + Operacional) */}
      {showReceiptType && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-primary font-semibold">Tipo de Recebimento *</Label>
          <Select value={receiptType} onValueChange={(v) => setReceiptType(v as ReceiptType)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {RECEIPT_TYPES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* NÍVEL 4A - Forma de Pagamento (Particular) */}
      {showPaymentMethodParticular && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-primary font-semibold">Forma de Pagamento *</Label>
          <Select 
            value={paymentMethodParticular} 
            onValueChange={(v) => setPaymentMethodParticular(v as PaymentMethodParticular)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS_PARTICULAR.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* NÍVEL 4B - Operadora (Convênios) */}
      {showOperadora && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-primary font-semibold">Operadora *</Label>
          <Select value={operadora} onValueChange={(v) => setOperadora(v as Operadora)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a operadora" />
            </SelectTrigger>
            <SelectContent>
              {OPERADORAS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Categoria - FILTRADA POR TIPO (entrada vs saída) */}
      <div className="space-y-2">
        <Label>Categoria *</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {categories
              .filter((c) => {
                // Filtra categorias pelo tipo correspondente
                const categoryType = c.type === "INCOME" ? "INCOME" : "EXPENSE";
                return categoryType === type && c.active !== false;
              })
              .map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            {/* Se não houver categorias do tipo, mostrar todas como fallback */}
            {categories.filter((c) => (c.type === "INCOME" ? "INCOME" : "EXPENSE") === type && c.active !== false).length === 0 &&
              categories.filter(c => c.active !== false).map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {type === "EXPENSE" && (
          <p className="text-[10px] text-muted-foreground">
            Mostrando apenas categorias de saída. Métodos de pagamento (PIX, Cartão) não são categorias.
          </p>
        )}
      </div>

      {/* Forma de Pagamento Geral (para saídas) */}
      {type === "EXPENSE" && (
        <div className="space-y-2">
          <Label>Forma de Pagamento *</Label>
          <Select
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings.paymentMethods.map((pm) => (
                <SelectItem key={pm} value={pm}>
                  {PAYMENT_METHOD_LABELS[pm]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Referência */}
      <div className="space-y-2">
        <Label>Referência (opcional)</Label>
        <Input
          placeholder="Número NF, Contrato, etc."
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea
          placeholder="Informações adicionais..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Texto de apoio ao usuário */}
      <Alert className="bg-muted/50 border-muted">
        <HelpCircle className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong>Dica:</strong> Inclua a unidade apenas quando a movimentação refletir desempenho assistencial direto.
          Custos gerais e financeiros devem ser classificados corretamente para evitar distorções no DRE e no Score.
        </AlertDescription>
      </Alert>

      <Button type="submit" className="w-full gradient-primary">
        {editingTransaction ? "Salvar Alterações" : "Registrar Movimentação"}
      </Button>
    </form>
  );

  if (editingTransaction) {
    return (
      <>
        {formContent}
        <AlertDialog open={showAporteConfirmation} onOpenChange={setShowAporteConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirmar classificação
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-3">
                <p>
                  Você está classificando este lançamento como <strong>Aporte de Sócio</strong>, 
                  mas a descrição contém termos que podem indicar outro tipo de movimentação.
                </p>
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Este lançamento é Aporte de Capital (não receita)?
                  </p>
                  <ul className="text-xs mt-2 space-y-1 text-amber-600 dark:text-amber-400">
                    <li>• Aporte = entrada de capital dos sócios (não entra no DRE)</li>
                    <li>• Royalty/Licença = Receita Financeira (entra no DRE)</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Revisar classificação</AlertDialogCancel>
              <AlertDialogAction onClick={processSubmit} className="bg-amber-600 hover:bg-amber-700">
                Sim, é Aporte de Capital
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gradient-primary gap-2">
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showAporteConfirmation} onOpenChange={setShowAporteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar classificação
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                Você está classificando este lançamento como <strong>Aporte de Sócio</strong>, 
                mas a descrição contém termos que podem indicar outro tipo de movimentação.
              </p>
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  Este lançamento é Aporte de Capital (não receita)?
                </p>
                <ul className="text-xs mt-2 space-y-1 text-amber-600 dark:text-amber-400">
                  <li>• Aporte = entrada de capital dos sócios (não entra no DRE)</li>
                  <li>• Royalty/Licença = Receita Financeira (entra no DRE)</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar classificação</AlertDialogCancel>
            <AlertDialogAction onClick={processSubmit} className="bg-amber-600 hover:bg-amber-700">
              Sim, é Aporte de Capital
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}