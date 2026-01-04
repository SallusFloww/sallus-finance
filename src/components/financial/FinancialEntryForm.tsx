import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Clock, CheckCircle2 } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { 
  FinancialEntry, 
  FinancialEntryInsert, 
  FinancialEntryType, 
  FinancialEntryStatus,
  useFinancialEntries 
} from "@/hooks/useFinancialEntries";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { BUSINESS_UNITS, RECEIPT_TYPES, PAYMENT_METHODS_PARTICULAR, OPERADORAS, DEFAULT_CATEGORIES } from "@/utils/constants";
import { parseMoneyBR } from "@/utils/formatters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Payment method keywords to filter out from categories (lowercase, no accents)
const PAYMENT_METHOD_KEYWORDS = [
  "pix", "dinheiro", "debito", "credito", "cartao", "transferencia", "ted", "boleto"
];

// Helper: normalize string removing accents for comparison
const normalizeAccents = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface FinancialEntryFormProps {
  editingEntry?: FinancialEntry;
  onClose?: () => void;
}

export function FinancialEntryForm({ editingEntry, onClose }: FinancialEntryFormProps) {
  const { addEntry, updateEntry } = useFinancialEntries();
  const { settings } = useCompanySettings();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Form fields
  const [type, setType] = useState<FinancialEntryType>(editingEntry?.type || "entrada");
  const [status, setStatus] = useState<FinancialEntryStatus>(editingEntry?.status || "recebido");
  const [descricao, setDescricao] = useState(editingEntry?.descricao || "");
  const [categoria, setCategoria] = useState(editingEntry?.categoria || "");
  const [valor, setValor] = useState(editingEntry?.valor?.toString() || "");
  const [dataPrevista, setDataPrevista] = useState<Date>(
    editingEntry?.data_prevista ? new Date(editingEntry.data_prevista) : new Date()
  );
  const [dataRecebimento, setDataRecebimento] = useState<Date | undefined>(
    editingEntry?.data_recebimento ? new Date(editingEntry.data_recebimento) : undefined
  );
  const [observacao, setObservacao] = useState(editingEntry?.observacao || "");
  const [unitId, setUnitId] = useState(editingEntry?.unit_id || "");
  const [receiptType, setReceiptType] = useState(editingEntry?.receipt_type || "");
  const [paymentMethod, setPaymentMethod] = useState(editingEntry?.payment_method || "");
  const [operadora, setOperadora] = useState(editingEntry?.operadora || "");

  // Helper: tokenize string for exact keyword matching (with accent normalization)
  const tokenize = (str: string): string[] => {
    return normalizeAccents(str).split(/[\s\-_\/\\.,;:]+/).filter(Boolean);
  };

  // Helper: check if any token matches a payment keyword exactly
  const isPaymentMethodCategory = (name: string): boolean => {
    const tokens = tokenize(name);
    return tokens.some(token => PAYMENT_METHOD_KEYWORDS.includes(token));
  };

  // Normalize categories to always return { value: string, label: string }[]
  // Handles: A) Array legacy [{id,name,type}], B) Object {entrada:[...], saida:[...]}, C) Fallback
  // Also ensures current editingEntry.categoria is always included
  const categoryOptions = useMemo((): Array<{ value: string; label: string }> => {
    const raw = settings?.categories;
    let options: Array<{ value: string; label: string }> = [];

    // Case B: Object format { entrada: [...], saida: [...] }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const key = type === "entrada" ? "entrada" : "saida";
      const list = (raw as Record<string, unknown>)[key];
      if (Array.isArray(list)) {
        options = list.map((item: unknown) => {
          if (typeof item === 'string') {
            return { value: item, label: item };
          }
          if (item && typeof item === 'object' && 'name' in item) {
            return { value: String((item as any).name), label: String((item as any).name) };
          }
          return null;
        }).filter(Boolean) as Array<{ value: string; label: string }>;
      }
    }
    // Case A: Array legacy [{id, name, type}]
    else if (Array.isArray(raw) && raw.length > 0) {
      const targetType = type === "entrada" ? "INCOME" : "EXPENSE";
      options = raw
        .filter((cat: any) => cat.type === targetType)
        .map((cat: any) => ({ value: String(cat.name), label: String(cat.name) }));
    }

    // Case C: Fallback to DEFAULT_CATEGORIES
    if (options.length === 0) {
      const targetType = type === "entrada" ? "INCOME" : "EXPENSE";
      options = DEFAULT_CATEGORIES
        .filter(cat => cat.type === targetType)
        .map(cat => ({ value: cat.name, label: cat.name }));
    }

    // Filter out payment method keywords using tokenization (exact match only)
    options = options.filter(opt => !isPaymentMethodCategory(opt.value));

    // Dedupe (case-insensitive) and sort alphabetically
    const seen = new Set<string>();
    const unique = options.filter(opt => {
      const key = opt.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort alphabetically
    const sorted = unique.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    // Ensure current categoria from editingEntry is always included (even if not in settings)
    const currentCat = editingEntry?.categoria;
    if (currentCat && !sorted.some(opt => opt.value.toLowerCase() === currentCat.toLowerCase())) {
      // Add current category at the top with "(atual)" suffix
      sorted.unshift({ value: currentCat, label: `${currentCat} (atual)` });
    }

    return sorted;
  }, [settings?.categories, type, editingEntry?.categoria]);

  // Normalize units: prefer settings.units, fallback to BUSINESS_UNITS
  const unitOptions = useMemo((): Array<{ value: string; label: string }> => {
    const raw = settings?.units;

    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((u: any) => {
        if (typeof u === 'string') {
          return { value: u, label: u };
        }
        if (u && typeof u === 'object') {
          return { value: String(u.id || u.name), label: String(u.name || u.id) };
        }
        return null;
      }).filter(Boolean) as Array<{ value: string; label: string }>;
    }

    // Fallback to BUSINESS_UNITS
    return BUSINESS_UNITS.map(unit => ({ value: unit.id, label: unit.name }));
  }, [settings?.units]);

  // Reset dependents when type changes
  useEffect(() => {
    // Reset category when type changes
    setCategoria("");
    setValidationError(null);
    
    if (type === "saida") {
      // Force status to "recebido" for saida (no "previsto" for expenses)
      setStatus("recebido");
      setReceiptType("");
      setOperadora("");
      setDataRecebimento(undefined);
    }
  }, [type]);

  useEffect(() => {
    // Only clear operadora when switching to PARTICULAR
    // Do NOT clear paymentMethod when switching to CONVENIO (preserve data)
    if (receiptType === "PARTICULAR") {
      setOperadora("");
    }
  }, [receiptType]);

  // Clear validation error when any relevant field changes
  useEffect(() => {
    if (validationError) setValidationError(null);
  }, [valor, descricao, categoria, unitId, receiptType, paymentMethod, operadora, status, type]);

  // Reset form when modal opens (only for new entries, not editing)
  useEffect(() => {
    if (open && !editingEntry) {
      resetForm();
      setValidationError(null);
    }
  }, [open, editingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    
    const parsedValor = parseMoneyBR(valor);
    if (!parsedValor || parsedValor <= 0) {
      setValidationError("Informe um valor válido maior que zero.");
      return;
    }

    if (!descricao.trim()) {
      setValidationError("Informe uma descrição para a movimentação.");
      return;
    }

    setLoading(true);

    try {
      const entryData: FinancialEntryInsert = {
        type,
        status,
        descricao: descricao.trim(),
        categoria: categoria || undefined,
        valor: parsedValor,
        data_prevista: format(dataPrevista, "yyyy-MM-dd"),
        data_recebimento: type === "entrada" && status === "recebido" && dataRecebimento 
          ? format(dataRecebimento, "yyyy-MM-dd") 
          : undefined,
        observacao: observacao || undefined,
        unit_id: unitId || undefined,
        receipt_type: type === "entrada" && receiptType ? receiptType : undefined,
        payment_method: paymentMethod || undefined,
        operadora: type === "entrada" && receiptType === "CONVENIO" && operadora ? operadora : undefined,
      };

      if (editingEntry) {
        await updateEntry(editingEntry.id, entryData);
      } else {
        await addEntry(entryData);
      }

      resetForm();
      setOpen(false);
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType("entrada");
    setStatus("recebido");
    setDescricao("");
    setCategoria("");
    setValor("");
    setDataPrevista(new Date());
    setDataRecebimento(undefined);
    setObservacao("");
    setUnitId("");
    setReceiptType("");
    setPaymentMethod("");
    setOperadora("");
  };

  const FormFields = (
    <div className="space-y-4">
      {/* Validation Error Alert */}
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      {/* Tipo de Movimentação */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === "entrada" ? "default" : "outline"}
          onClick={() => setType("entrada")}
          className={cn(
            type === "entrada" && "bg-success hover:bg-success/90"
          )}
        >
          Entrada
        </Button>
        <Button
          type="button"
          variant={type === "saida" ? "default" : "outline"}
          onClick={() => setType("saida")}
          className={cn(
            type === "saida" && "bg-destructive hover:bg-destructive/90"
          )}
        >
          Saída
        </Button>
      </div>

      {/* Status de Recebimento (apenas para entradas) */}
      {type === "entrada" && (
        <div className="space-y-2">
          <Label>Status de Recebimento</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={status === "previsto" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus("previsto")}
              className={cn(
                "gap-2",
                status === "previsto" && "bg-amber-500 hover:bg-amber-500/90"
              )}
            >
              <Clock className="h-4 w-4" />
              Previsto
            </Button>
            <Button
              type="button"
              variant={status === "recebido" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus("recebido")}
              className={cn(
                "gap-2",
                status === "recebido" && "bg-success hover:bg-success/90"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Recebido
            </Button>
          </div>
          {status === "previsto" && (
            <Alert className="bg-amber-500/10 border-amber-500/20">
              <AlertDescription className="text-amber-600 text-sm">
                Entradas previstas não impactam o saldo até serem confirmadas como recebidas.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Valor */}
      <div className="space-y-2">
        <Label htmlFor="valor">Valor *</Label>
        <Input
          id="valor"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          placeholder="Descrição da movimentação"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
      </div>

      {/* Categoria */}
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger>
            <SelectValue placeholder={`Selecione a categoria (${type === "entrada" ? "Entrada" : "Saída"})`} />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {type === "entrada" 
            ? "Mostrando apenas categorias de entrada (receitas)."
            : "Mostrando apenas categorias de saída. Métodos de pagamento (PIX, Cartão) não são categorias."
          }
        </p>
      </div>

      {/* Data Prevista */}
      <div className="space-y-2">
        <Label>Data {type === "entrada" ? "Prevista" : ""}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dataPrevista && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataPrevista ? format(dataPrevista, "dd/MM/yyyy") : "Selecionar data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataPrevista}
              onSelect={(date) => date && setDataPrevista(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Data de Recebimento (apenas se status = recebido) */}
      {type === "entrada" && status === "recebido" && (
        <div className="space-y-2">
          <Label>Data de Recebimento</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dataRecebimento && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataRecebimento ? format(dataRecebimento, "dd/MM/yyyy") : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataRecebimento}
                onSelect={setDataRecebimento}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Unidade */}
      <div className="space-y-2">
        <Label>Unidade</Label>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo de Recebimento (apenas para entradas) */}
      {type === "entrada" && (
        <div className="space-y-2">
          <Label>Tipo de Recebimento</Label>
          <Select value={receiptType} onValueChange={setReceiptType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {RECEIPT_TYPES.map((rt) => (
                <SelectItem key={rt.id} value={rt.id}>
                  {rt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Forma de Pagamento (Particular) */}
      {type === "entrada" && receiptType === "PARTICULAR" && (
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS_PARTICULAR.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  {pm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Operadora (Convênio) */}
      {type === "entrada" && receiptType === "CONVENIO" && (
        <div className="space-y-2">
          <Label>Operadora</Label>
          <Select value={operadora} onValueChange={setOperadora}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPERADORAS.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Observação */}
      <div className="space-y-2">
        <Label htmlFor="observacao">Observação</Label>
        <Textarea
          id="observacao"
          placeholder="Observações adicionais"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {FormFields}
      {/* Submit - for editing inline form */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : editingEntry ? "Atualizar" : "Registrar"}
      </Button>
    </form>
  );

  if (editingEntry) {
    return FormContent;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Registrar Movimentação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {FormFields}
          </div>
          <DialogFooter className="sticky bottom-0 border-t bg-background px-6 py-4 mt-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { resetForm(); setOpen(false); }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
