import { useState, useEffect } from "react";
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
import { BUSINESS_UNITS, RECEIPT_TYPES, PAYMENT_METHODS_PARTICULAR, OPERADORAS } from "@/utils/constants";
import { parseMoneyBR, formatCurrency } from "@/utils/formatters";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FinancialEntryFormProps {
  editingEntry?: FinancialEntry;
  onClose?: () => void;
}

export function FinancialEntryForm({ editingEntry, onClose }: FinancialEntryFormProps) {
  const { addEntry, updateEntry } = useFinancialEntries();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
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

  // Reset dependents when type changes
  useEffect(() => {
    if (type === "saida") {
      setReceiptType("");
      setOperadora("");
    }
  }, [type]);

  useEffect(() => {
    if (receiptType === "PARTICULAR") {
      setOperadora("");
    } else if (receiptType === "CONVENIO") {
      setPaymentMethod("");
    }
  }, [receiptType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedValor = parseMoneyBR(valor);
    if (!parsedValor || parsedValor <= 0) {
      return;
    }

    if (!descricao.trim()) {
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
        data_recebimento: status === "recebido" && dataRecebimento 
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

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <Label htmlFor="categoria">Categoria</Label>
        <Input
          id="categoria"
          placeholder="Ex: Consulta, Material, etc."
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        />
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
            {BUSINESS_UNITS.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
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

      {/* Submit */}
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Movimentação</DialogTitle>
        </DialogHeader>
        {FormContent}
      </DialogContent>
    </Dialog>
  );
}
