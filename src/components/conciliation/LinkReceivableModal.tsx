import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Link2, Loader2, Check, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { formatCurrency } from "@/utils/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ConciliationItem } from "@/hooks/useConciliation";

interface Receivable {
  id: string;
  billing_date: string;
  unit: string;
  source: string;
  description: string;
  billed_amount: number;
  status: string;
  competencia: string | null;
  linked_transaction_id: string | null;
}

interface LinkReceivableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O item de conciliação (financial_entry sem faturamento vinculado) */
  financialEntry: ConciliationItem | null;
  /** Callback chamado após vincular com sucesso */
  onLinked: () => void;
}

export function LinkReceivableModal({
  open,
  onOpenChange,
  financialEntry,
  onLinked,
}: LinkReceivableModalProps) {
  const { currentCompany, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Fetch receivables disponíveis (FATURADO, sem linked_transaction_id)
  const fetchReceivables = useCallback(async () => {
    if (!currentCompany?.id || !financialEntry) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("receivables")
        .select("id, billing_date, unit, source, description, billed_amount, status, competencia, linked_transaction_id")
        .eq("company_id", currentCompany.id)
        .eq("status", "FATURADO")
        .is("linked_transaction_id", null)
        .order("billing_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      setReceivables(data || []);
      setFetched(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Erro ao buscar receivables:", err);
      toast.error("Erro ao carregar faturamentos disponíveis");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, financialEntry]);

  // Fetch quando modal abre (useEffect, não useMemo - side effects)
  useEffect(() => {
    if (open && !fetched) {
      fetchReceivables();
    }
    if (!open) {
      setFetched(false);
      setSelectedId(null);
      setSearchTerm("");
      setReceivables([]); // limpa lista ao fechar (evita cache confuso)
    }
  }, [open, fetched, fetchReceivables]);

  // Normalizador robusto para comparação de unidade/convênio
  const norm = useCallback((s?: string) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[_\s]+/g, " ")
      .trim()
  , []);

  // Score e ordenar sugestões
  const sortedReceivables = useMemo(() => {
    if (!financialEntry) return [];

    const entryValue = financialEntry.receivedAmount;
    const entryDate = parseISO(financialEntry.date);
    const entryUnit = norm(financialEntry.unitKey);
    const entrySource = norm(financialEntry.sourceKey);

    return receivables
      .filter((r) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          r.description.toLowerCase().includes(search) ||
          r.source.toLowerCase().includes(search) ||
          r.unit.toLowerCase().includes(search) ||
          (r.competencia && r.competencia.includes(search))
        );
      })
      .map((r) => {
        // Scoring: menor diferença de valor, data mais próxima, mesma unidade/source
        const valueDiff = Math.abs(r.billed_amount - entryValue);
        const dateDiff = Math.abs(differenceInDays(parseISO(r.billing_date), entryDate));
        const unitMatch = norm(r.unit) === entryUnit;
        const sourceMatch = norm(r.source) === entrySource;

        // Score: menor é melhor
        let score = valueDiff / 100 + dateDiff * 10;
        if (unitMatch) score -= 50;
        if (sourceMatch) score -= 30;

        return { ...r, score, valueDiff, unitMatch, sourceMatch };
      })
      .sort((a, b) => a.score - b.score);
  }, [receivables, financialEntry, searchTerm, norm]);

  // Vincular (sem p_user_id - RPC usa auth.uid())
  const handleLink = async () => {
    if (!selectedId || !financialEntry || !currentCompany?.id) return;

    setLinking(true);
    try {
      const { data, error } = await supabase.rpc("link_receivable_to_existing_entry", {
        _receivable_id: selectedId,
        _financial_entry_id: financialEntry.id,
      });

      if (error) throw error;

      // A função retorna boolean diretamente
      if (!data) {
        toast.error("Falha ao criar vínculo");
        return;
      }

      toast.success("Vínculo criado com sucesso! Divergência resolvida.");
      onLinked();
      onOpenChange(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Erro ao vincular:", err);
      toast.error("Erro ao criar vínculo");
    } finally {
      setLinking(false);
    }
  };

  const selectedReceivable = sortedReceivables.find((r) => r.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular ao Faturamento
          </DialogTitle>
          <DialogDescription>
            Selecione o faturamento (receivable) correspondente a este recebimento.
          </DialogDescription>
        </DialogHeader>

        {/* Entry Info */}
        {financialEntry && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
            <div className="font-medium">Recebimento a vincular:</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">{formatCurrency(financialEntry.receivedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span>{format(parseISO(financialEntry.date), "dd/MM/yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unidade:</span>
              <span>{financialEntry.unitLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Convênio:</span>
              <span>{financialEntry.sourceLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span className="text-right max-w-[250px] truncate">{financialEntry.description}</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, convênio, unidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Receivables List */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px] border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedReceivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <span>Nenhum faturamento disponível para vincular</span>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sortedReceivables.slice(0, 50).map((r) => {
                const isSelected = r.id === selectedId;
                const isExactValue = r.valueDiff < 0.01;
                
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`
                      p-3 rounded-lg border cursor-pointer transition-colors
                      ${isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/50"}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          <span className="font-medium truncate">{r.description}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{format(parseISO(r.billing_date), "dd/MM/yyyy")}</span>
                          <span>•</span>
                          <span>{r.unit}</span>
                          <span>•</span>
                          <span>{r.source}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium">{formatCurrency(r.billed_amount)}</div>
                        {r.unitMatch && r.sourceMatch && isExactValue && (
                          <Badge variant="default" className="text-xs">Match perfeito</Badge>
                        )}
                        {isExactValue && !(r.unitMatch && r.sourceMatch) && (
                          <Badge variant="secondary" className="text-xs">Valor exato</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedReceivables.length > 50 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  Exibindo 50 de {sortedReceivables.length} resultados
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedId || linking}
          >
            {linking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Vincular Faturamento
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Selected summary */}
        {selectedReceivable && financialEntry && (
          <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
            <strong>Diferença de valor:</strong>{" "}
            {formatCurrency(Math.abs(selectedReceivable.billed_amount - financialEntry.receivedAmount))}
            {selectedReceivable.billed_amount !== financialEntry.receivedAmount && (
              <span className="ml-2 text-warning">
                (Faturado: {formatCurrency(selectedReceivable.billed_amount)} | 
                Recebido: {formatCurrency(financialEntry.receivedAmount)})
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
