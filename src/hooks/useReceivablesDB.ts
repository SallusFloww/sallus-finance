import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, parseISO } from "date-fns";
import {
  Receivable,
  ReceivableStatus,
  GlossType,
  AppealStatus,
  ReceivablesStats,
  ReceivableHistoryEntry,
} from "@/types";
import { toast } from "sonner";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";

interface ReceivablesFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: ReceivableStatus;
  source?: string;
  search?: string;
  competencia?: string;
  appealStatus?: AppealStatus;
}

// Tipo do banco de dados
interface DBReceivable {
  id: string;
  company_id: string;
  billing_date: string;
  competencia: string | null;
  unit: string;
  source: string;
  description: string;
  billed_amount: number;
  received_amount: number;
  glossed_amount: number;
  status: string;
  gloss_type: string | null;
  gloss_reason: string | null;
  appeal_status: string | null;
  appeal_amount: number | null;
  appeal_start_date: string | null;
  appeal_resolved_date: string | null;
  appeal_recovered_amount: number | null;
  appeal_transaction_id: string | null;
  expected_receipt_days: number | null;
  actual_receipt_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  linked_transaction_id: string | null;
  // Pode não existir em bases antigas (migração). Mantemos opcional para compatibilidade.
  idempotency_key?: string | null;
  history: ReceivableHistoryEntry[];
  edit_logs: Array<{
    field: string;
    previousValue: string;
    newValue: string;
    editedAt: string;
    editedBy: string;
  }>;
}

// Converter de DB para domínio
function toReceivable(db: DBReceivable): Receivable {
  return {
    id: db.id,
    billingDate: db.billing_date,
    competencia: db.competencia || undefined,
    unit: db.unit,
    source: db.source,
    description: db.description,
    billedAmount: Number(db.billed_amount),
    receivedAmount: Number(db.received_amount),
    glossedAmount: Number(db.glossed_amount),
    status: db.status as ReceivableStatus,
    glossType: db.gloss_type as GlossType | undefined,
    glossReason: db.gloss_reason || undefined,
    appealStatus: (db.appeal_status || "NAO_INICIADO") as AppealStatus,
    appealAmount: db.appeal_amount ? Number(db.appeal_amount) : undefined,
    appealStartDate: db.appeal_start_date || undefined,
    appealResolvedDate: db.appeal_resolved_date || undefined,
    appealRecoveredAmount: db.appeal_recovered_amount ? Number(db.appeal_recovered_amount) : undefined,
    appealTransactionId: db.appeal_transaction_id || undefined,
    expectedReceiptDays: db.expected_receipt_days || undefined,
    actualReceiptDate: db.actual_receipt_date || undefined,
    notes: db.notes || undefined,
    createdBy: db.created_by || "system",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    linkedTransactionId: db.linked_transaction_id || undefined,
    history: db.history || [],
    editLogs: db.edit_logs || [],
  };
}

// Criar entrada no histórico
function createHistoryEntry(
  action: ReceivableHistoryEntry["action"],
  description: string,
  userName: string,
  amount?: number,
  linkedTransactionId?: string,
): ReceivableHistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    description,
    timestamp: new Date().toISOString(),
    userName,
    amount,
    linkedTransactionId,
  };
}

export function useReceivablesDB() {
  const { currentCompany, profile } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integração com GlobalRealtimeProvider - versão global
  const { version: globalVersion, refreshAll } = useGlobalRealtime();

  // TRAVA ANTI-DUPLO CLIQUE (em memória)
  const processingIdsRef = useRef<Set<string>>(new Set());

  // Fetch receivables
  const fetchReceivables = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);
      // Paginated fetch to support >1000 records
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error: fetchError } = await (supabase as any)
          .from("receivables")
          .select("*")
          .eq("company_id", currentCompany.id)
          .order("billing_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (fetchError) throw fetchError;

        allData = allData.concat(page || []);
        hasMore = (page?.length || 0) === pageSize;
        from += pageSize;
      }

      setReceivables(allData.map((d) => toReceivable(d as unknown as DBReceivable)));
      setError(null);
    } catch (err) {
      setError("Erro ao carregar recebíveis");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Fetch inicial e reativo à versão global
  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables, globalVersion]);

  // Add receivable
  const addReceivable = useCallback(
    async (
      data: Omit<Receivable, "id" | "createdAt" | "receivedAmount" | "glossedAmount"> & {
        /**
         * Chave de idempotência para impedir duplicidade (clique duplo / retry / refetch).
         * Se existir coluna/índice no banco, vira blindagem definitiva.
         */
        idempotencyKey?: string;
      },
    ) => {
      if (!currentCompany?.id || !profile?.id) {
        toast.error("Usuário não autenticado");
        return null;
      }

      const history = [
        createHistoryEntry(
          "CRIADO",
          `Faturamento registrado: R$ ${data.billedAmount.toFixed(2)}`,
          profile.full_name || "system",
          data.billedAmount,
        ),
      ];

      // TRAVA ANTI-DUPLICIDADE (UI): impede clique duplo / submit repetido
      const lockKey = `add-receivable::${currentCompany.id}::${data.idempotencyKey || `${data.billingDate}|${data.unit}|${data.source}|${data.description}|${data.billedAmount}`}`;
      if (processingIdsRef.current.has(lockKey)) {
        toast.error("Criação de faturamento já está em processamento. Aguarde...");
        return null;
      }
      processingIdsRef.current.add(lockKey);

      try {
        // 1) DEDUPE NO BANCO (compatível mesmo sem migração): se já existe igual criado há pouco, não duplica
        // Obs: isso cobre o cenário atual de duplicação mesmo antes de criar coluna/índice de idempotência.
        const twoMinutesAgoIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: existingSimilar, error: existingSimilarErr } = await (supabase as any)
          .from("receivables")
          .select("*")
          .eq("company_id", currentCompany.id)
          .eq("billing_date", data.billingDate)
          .eq("unit", data.unit)
          .eq("source", data.source)
          .eq("description", data.description)
          .eq("billed_amount", data.billedAmount)
          .eq("status", "FATURADO")
          .gte("created_at", twoMinutesAgoIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!existingSimilarErr && existingSimilar) {
          toast.warning("Faturamento idêntico detectado recentemente. Evitando duplicidade.");
          // Refetch para sincronizar a lista local
          await fetchReceivables();
          return toReceivable(existingSimilar as unknown as DBReceivable);
        }

        // 2) INSERT (com suporte opcional à coluna idempotency_key)
        const basePayload: Record<string, unknown> = {
          company_id: currentCompany.id,
          billing_date: data.billingDate,
          competencia: data.competencia || null,
          unit: data.unit,
          source: data.source,
          description: data.description,
          billed_amount: data.billedAmount,
          received_amount: 0,
          glossed_amount: 0,
          status: "FATURADO",
          expected_receipt_days: data.expectedReceiptDays || null,
          notes: data.notes || null,
          created_by: profile.id,
          history: JSON.parse(JSON.stringify(history)),
        };

        // Tenta usar idempotency_key se vier do caller
        const payloadWithIdempotency = data.idempotencyKey
          ? { ...basePayload, idempotency_key: data.idempotencyKey }
          : basePayload;

        let insertedRow: unknown = null;

        // Primeira tentativa: com idempotency_key (se houver)
        {
          const { data: inserted, error: insertError } = await (supabase as any)
            .from("receivables")
            .insert([payloadWithIdempotency] as any)
            .select()
            .single();

          if (!insertError) {
            insertedRow = inserted;
          } else {
            // Se a coluna não existir ainda, faz fallback sem a coluna
            const msg = String((insertError as any)?.message || "");
            const code = String((insertError as any)?.code || "");

            // 23505 = unique_violation (quando tiver índice único por idempotency_key)
            if (code === "23505" && data.idempotencyKey) {
              const { data: existingByKey, error: existingByKeyErr } = await (supabase as any)
                .from("receivables")
                .select("*")
                .eq("company_id", currentCompany.id)
                .eq("idempotency_key", data.idempotencyKey)
                .limit(1)
                .maybeSingle();

              if (!existingByKeyErr && existingByKey) {
                toast.warning("Faturamento já existia (idempotência). Evitando duplicidade.");
                await fetchReceivables();
                return toReceivable(existingByKey as unknown as DBReceivable);
              }
            }

            if (msg.toLowerCase().includes("idempotency_key") && msg.toLowerCase().includes("does not exist")) {
              const { data: insertedFallback, error: insertFallbackErr } = await (supabase as any)
                .from("receivables")
                .insert([basePayload] as any)
                .select()
                .single();

              if (insertFallbackErr) {
                toast.error("Erro ao criar recebível");
                return null;
              }
              insertedRow = insertedFallback;
            } else {
              toast.error("Erro ao criar recebível");
              return null;
            }
          }
        }

        // Refetch para garantir sincronização (cinto + suspensório)
        await fetchReceivables();
        toast.success("Recebível criado com sucesso");
        return toReceivable(insertedRow as unknown as DBReceivable);
      } finally {
        processingIdsRef.current.delete(lockKey);
      }
    },
    [currentCompany?.id, profile, fetchReceivables],
  );

  // Update receivable
  const updateReceivable = useCallback(
    async (id: string, data: Partial<Receivable>, userName: string) => {
      const receivable = receivables.find((r) => r.id === id);
      if (!receivable || receivable.status !== "FATURADO") {
        toast.error("Apenas recebíveis com status FATURADO podem ser editados");
        return;
      }

      const editLogs = [...(receivable.editLogs || [])];
      const editedAt = new Date().toISOString();

      Object.keys(data).forEach((key) => {
        const field = key as keyof Receivable;
        const previousValue = String(receivable[field] || "");
        const newValue = String(data[field] || "");
        if (previousValue !== newValue) {
          editLogs.push({
            field,
            previousValue,
            newValue,
            editedAt,
            editedBy: userName,
          });
        }
      });

      const history = [...(receivable.history || [])];
      history.push(createHistoryEntry("EDITADO", "Dados do faturamento editados", userName));

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
        edit_logs: editLogs,
        history: history,
      };

      if (data.description !== undefined) updateData.description = data.description;
      if (data.billedAmount !== undefined) updateData.billed_amount = data.billedAmount;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.competencia !== undefined) updateData.competencia = data.competencia;

      const { error: updateError } = await (supabase as any).from("receivables").update(updateData).eq("id", id);

      if (updateError) {
        toast.error("Erro ao atualizar recebível");
        return;
      }

      // Refetch para garantir sincronização
      await fetchReceivables();
      toast.success("Recebível atualizado");
    },
    [receivables, profile, fetchReceivables],
  );

  // Mark as received - CRIA MOVIMENTAÇÃO NO CAIXA AUTOMATICAMENTE
  const markAsReceived = useCallback(
    async (
      id: string,
      receivedAmount: number,
      actualReceiptDate: string,
      userName: string,
    ): Promise<{ id: string; transactionId?: string } | null> => {
      // Validações básicas
      if (!currentCompany?.id || !profile?.id) {
        toast.error("Usuário não autenticado");
        return null;
      }

      const receivable = receivables.find((r) => r.id === id);
      if (!receivable) {
        toast.error("Recebível não encontrado");
        return null;
      }

      if (receivable.status !== "FATURADO") {
        toast.error("Apenas recebíveis FATURADO podem ser marcados como recebidos");
        return null;
      }

      // BLOQUEIO DE DUPLICIDADE: se já tem linked_transaction_id, não permite reprocessar
      if (receivable.linkedTransactionId) {
        toast.error("Este recebível já está vinculado a uma movimentação. Use estorno/cancelamento se necessário.");
        return null;
      }

      if (receivedAmount <= 0) {
        toast.error("Valor recebido deve ser maior que zero");
        return null;
      }

      // TRAVA ANTI DUPLICIDADE (clique duplo / execução dupla)
      if (processingIdsRef.current.has(id)) {
        toast.error("Recebimento já está sendo processado. Aguarde...");
        return null;
      }
      processingIdsRef.current.add(id);

      let createdTransactionId: string | null = null;

      try {
        // CHECAGEM NO BANCO (idempotência real): se já existe movimentação para este receivable, NÃO inserir de novo
        // Busca por observacao (receivable_id=...) independente da categoria
        const { data: existing, error: existingErr } = await supabase
          .from("financial_entries")
          .select("id, status")
          .eq("company_id", currentCompany.id)
          .ilike("observacao", `%receivable_id=${id}%`)
          .neq("status", "cancelado")
          .order("created_at", { ascending: false })
          .limit(1);

        if (!existingErr && existing && existing.length > 0) {
          toast.error("Movimentação deste recebimento já existe. Evitando duplicidade.");
          return { id, transactionId: existing[0].id };
        }

        // Inferir ESPECIALIDADE a partir das produções vinculadas a este receivable
        let inferredSpecialty: string | null = null;
        let specialtyNote = "";

        const { data: prodSpecs, error: prodSpecError } = await supabase
          .from("productions")
          .select("specialty")
          .eq("company_id", currentCompany.id)
          .eq("linked_receivable_id", id);

        if (!prodSpecError && Array.isArray(prodSpecs)) {
          const cleaned = prodSpecs
            .map((p: any) => (typeof p.specialty === "string" ? p.specialty.trim() : ""))
            .filter((s: string) => s.length > 0 && s !== "SEM_ESPECIALIDADE");

          const unique = Array.from(new Set(cleaned));

          if (unique.length === 1) {
            inferredSpecialty = unique[0];
          } else if (unique.length > 1) {
            inferredSpecialty = null;
            specialtyNote = ` | Especialidade: múltiplas (${unique.join(", ").substring(0, 120)})`;
          }
        }

        // Inferir CATEGORIA a partir dos production_type vinculados ao receivable
        let inferredCategory: string = "RECEBIMENTO_FATURAMENTO";
        let typeNote = "";

        const { data: prodTypes, error: prodTypeErr } = await supabase
          .from("productions")
          .select("production_type")
          .eq("company_id", currentCompany.id)
          .eq("linked_receivable_id", id);

        if (!prodTypeErr && Array.isArray(prodTypes)) {
          const cleanedTypes = prodTypes
            .map((p: any) => (typeof p.production_type === "string" ? p.production_type.trim() : ""))
            .filter((t: string) => t.length > 0);

          const uniqueTypes = Array.from(new Set(cleanedTypes));

          // Buscar categorias válidas da empresa para validar o production_type
          const { data: settingsData } = await supabase
            .from("company_financial_settings")
            .select("categories")
            .eq("company_id", currentCompany.id)
            .maybeSingle();

          const validCategoryCodes = new Set(
            (Array.isArray(settingsData?.categories) ? settingsData.categories as any[] : [])
              .map((c: any) => String(c.code || c.id || c.name || "").toUpperCase())
              .filter(Boolean)
          );

          if (uniqueTypes.length === 1) {
            // Sempre usar o production_type diretamente como categoria
            // resolveCategoryLabel no useTransactionsDB resolve o label na exibição
            inferredCategory = uniqueTypes[0];
          } else if (uniqueTypes.length > 1) {
            inferredCategory = "RECEBIMENTO_FATURAMENTO";
            typeNote = ` | Tipos: múltiplos (${uniqueTypes.join(", ").substring(0, 120)})`;
          }
        }

        // Importar labels legíveis para o descricao
        const { PRODUCTION_TYPE_LABELS: PROD_LABELS } = await import("@/utils/constants");

        // Construir descricao com nome legível do tipo de produção
        let readableTypePrefix = "";
        if (inferredCategory === "RECEBIMENTO_FATURAMENTO") {
          // Tentar obter label legível do production_type original
          const { data: prodTypesForLabel } = await supabase
            .from("productions")
            .select("production_type")
            .eq("company_id", currentCompany.id)
            .eq("linked_receivable_id", id);
          if (Array.isArray(prodTypesForLabel) && prodTypesForLabel.length > 0) {
            const types = Array.from(new Set(prodTypesForLabel.map((p: any) => p.production_type).filter(Boolean)));
            if (types.length === 1) {
              const label = PROD_LABELS[types[0] as string] || types[0];
              readableTypePrefix = `${label} • `;
            } else if (types.length > 1) {
              readableTypePrefix = "Recebimento Faturamento • ";
            }
          }
        } else {
          // Categoria válida — usar label legível do tipo
          const label = PROD_LABELS[inferredCategory] || inferredCategory;
          readableTypePrefix = `${label} • `;
        }

        const descricao = `${readableTypePrefix}${receivable.source} • ${receivable.description}`.substring(0, 200);

        // STEP 1: Criar entrada no financial_entries (Caixa/Movimentações)
        const { data: insertedEntry, error: insertError } = await supabase
          .from("financial_entries")
          .insert([
            {
              company_id: currentCompany.id,
              created_by: profile.id,
              type: "entrada",
              status: "recebido",
              valor: receivedAmount,
              data_prevista: actualReceiptDate,
              data_recebimento: actualReceiptDate,
              descricao,
              categoria: inferredCategory,
              unit_id: receivable.unit || null,
              receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
              payment_method: "TRANSFER",
              operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
              specialty: inferredSpecialty,
              observacao: `Origem: receivable_id=${id} | Competência: ${receivable.competencia || "N/A"}${specialtyNote}${typeNote}`,
            },
          ])
          .select()
          .single();

        if (insertError) {
          if (import.meta.env.DEV) console.error("Erro ao criar movimentação:", insertError);
          toast.error("Erro ao criar movimentação no caixa");
          return null;
        }

        createdTransactionId = insertedEntry.id;

        // STEP 2: Atualizar o receivable com status RECEBIDO e linked_transaction_id
        const history = [...(receivable.history || [])];
        history.push(
          createHistoryEntry(
            "RECEBIDO",
            `Recebimento integral: R$ ${receivedAmount.toFixed(2)} - Movimentação ${createdTransactionId} criada`,
            userName,
            receivedAmount,
            createdTransactionId,
          ),
        );

        const { error: updateError } = await (supabase as any)
          .from("receivables")
          .update({
            status: "RECEBIDO",
            received_amount: receivedAmount,
            glossed_amount: 0,
            actual_receipt_date: actualReceiptDate,
            linked_transaction_id: createdTransactionId,
            updated_at: new Date().toISOString(),
            updated_by: profile.id,
            history: JSON.parse(JSON.stringify(history)),
          })
          .eq("id", id);

        if (updateError) {
          // ROLLBACK: Cancelar a movimentação criada se falhar ao atualizar o receivable
          if (import.meta.env.DEV) console.error("Erro ao atualizar receivable, aplicando rollback:", updateError);

          await supabase
            .from("financial_entries")
            .update({
              status: "cancelado",
              cancelled_at: new Date().toISOString(),
              cancelled_by: profile.id,
              cancel_reason: `Rollback automático: falha ao vincular com receivable ${id}`,
            })
            .eq("id", createdTransactionId);

          toast.error("Erro ao atualizar recebível. Movimentação cancelada automaticamente.");
          return null;
        }

        // Refetch para garantir sincronização
        await fetchReceivables();
        // Forçar atualização imediata (mata o "preciso dar F5")
        refreshAll();
        // Sucesso completo
        return { id, transactionId: createdTransactionId };
      } catch (error) {
        if (import.meta.env.DEV) console.error("Erro inesperado em markAsReceived:", error);

        // ROLLBACK em caso de erro inesperado
        if (createdTransactionId) {
          await supabase
            .from("financial_entries")
            .update({
              status: "cancelado",
              cancelled_at: new Date().toISOString(),
              cancelled_by: profile.id,
              cancel_reason: `Rollback automático: erro inesperado ao processar receivable ${id}`,
            })
            .eq("id", createdTransactionId);
        }

        toast.error("Erro inesperado ao processar recebimento");
        return null;
      } finally {
        // Liberar trava SEMPRE (sucesso ou erro)
        processingIdsRef.current.delete(id);
      }
    },
    [receivables, currentCompany?.id, profile?.id, fetchReceivables, refreshAll],
  );

  // Mark as glossed
  const markAsGlossed = useCallback(
    async (
      id: string,
      glossType: GlossType,
      glossReason: string,
      glossAmount: number,
      actualReceiptDate: string,
      userName: string,
      initiateAppeal: boolean = false,
    ) => {
      const receivable = receivables.find((r) => r.id === id);
      if (!receivable || receivable.status !== "FATURADO") {
        toast.error("Apenas recebíveis FATURADO podem ser glosados");
        return null;
      }

      const now = new Date().toISOString();
      const history = [...(receivable.history || [])];

      const netReceivedAmount = glossType === "PARCIAL" ? receivable.billedAmount - glossAmount : 0;

      history.push(
        createHistoryEntry(
          "GLOSA_REGISTRADA",
          glossType === "PARCIAL"
            ? `Glosa parcial: R$ ${glossAmount.toFixed(2)} - ${glossReason}. Valor líquido: R$ ${netReceivedAmount.toFixed(2)}`
            : `Glosa total: R$ ${receivable.billedAmount.toFixed(2)} - ${glossReason}`,
          userName,
          glossAmount,
        ),
      );

      if (initiateAppeal) {
        history.push(
          createHistoryEntry(
            "RECURSO_INICIADO",
            `Recurso iniciado para o valor de R$ ${glossAmount.toFixed(2)}`,
            userName,
            glossAmount,
          ),
        );
      }

      const { error: updateError } = await (supabase as any)
        .from("receivables")
        .update({
          status: glossType === "TOTAL" ? "GLOSADO" : "RECEBIDO_COM_GLOSA",
          gloss_type: glossType,
          gloss_reason: glossReason,
          glossed_amount: glossType === "TOTAL" ? receivable.billedAmount : glossAmount,
          received_amount: netReceivedAmount,
          actual_receipt_date: actualReceiptDate,
          appeal_status: initiateAppeal ? "EM_RECURSO" : "NAO_INICIADO",
          appeal_amount: initiateAppeal ? glossAmount : null,
          appeal_start_date: initiateAppeal ? now : null,
          updated_at: now,
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        toast.error("Erro ao registrar glosa");
        return null;
      }

      // Refetch para garantir sincronização
      await fetchReceivables();
      toast.success("Glosa registrada");
      return { id };
    },
    [receivables, fetchReceivables],
  );

  // Initiate appeal
  const initiateAppeal = useCallback(
    async (id: string, appealAmount: number, userName: string) => {
      const receivable = receivables.find((r) => r.id === id);
      if (!receivable) return;
      if (receivable.status !== "RECEBIDO_COM_GLOSA" && receivable.status !== "GLOSADO") return;
      if (receivable.appealStatus === "EM_RECURSO" || receivable.appealStatus === "DEFERIDO") return;

      const history = [...(receivable.history || [])];
      history.push(
        createHistoryEntry(
          "RECURSO_INICIADO",
          `Recurso iniciado para o valor de R$ ${appealAmount.toFixed(2)}`,
          userName,
          appealAmount,
        ),
      );

      const { error: updateError } = await (supabase as any)
        .from("receivables")
        .update({
          appeal_status: "EM_RECURSO",
          appeal_amount: appealAmount,
          appeal_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        toast.error("Erro ao iniciar recurso");
        return;
      }

      // Refetch para garantir sincronização
      await fetchReceivables();
      toast.success("Recurso iniciado");
    },
    [receivables, fetchReceivables],
  );

  // Approve appeal
  const approveAppeal = useCallback(
    async (id: string, recoveredAmount: number, receiptDate: string, userName: string) => {
      const receivable = receivables.find((r) => r.id === id);
      if (!receivable || receivable.appealStatus !== "EM_RECURSO") {
        toast.error("Apenas recursos EM_RECURSO podem ser deferidos");
        return null;
      }

      const newReceivedAmount = (receivable.receivedAmount || 0) + recoveredAmount;
      const newGlossedAmount = Math.max(0, (receivable.glossedAmount || 0) - recoveredAmount);

      const history = [...(receivable.history || [])];
      history.push(
        createHistoryEntry(
          "RECURSO_DEFERIDO",
          `Recurso deferido: R$ ${recoveredAmount.toFixed(2)} recuperados`,
          userName,
          recoveredAmount,
        ),
      );

      const newStatus = newGlossedAmount <= 0 ? "RECEBIDO" : receivable.status;

      const { error: updateError } = await (supabase as any)
        .from("receivables")
        .update({
          status: newStatus,
          received_amount: newReceivedAmount,
          glossed_amount: newGlossedAmount,
          appeal_status: "DEFERIDO",
          appeal_recovered_amount: recoveredAmount,
          appeal_resolved_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        toast.error("Erro ao deferir recurso");
        return null;
      }

      // Refetch para garantir sincronização
      await fetchReceivables();
      toast.success("Recurso deferido");
      return { id, recoveredAmount };
    },
    [receivables, fetchReceivables],
  );

  // Reject appeal
  const rejectAppeal = useCallback(
    async (id: string, userName: string) => {
      const receivable = receivables.find((r) => r.id === id);
      if (!receivable || receivable.appealStatus !== "EM_RECURSO") return;

      const history = [...(receivable.history || [])];
      history.push(
        createHistoryEntry(
          "RECURSO_INDEFERIDO",
          `Recurso indeferido. Valor de R$ ${(receivable.appealAmount || receivable.glossedAmount).toFixed(2)} registrado como perda definitiva.`,
          userName,
          receivable.appealAmount || receivable.glossedAmount,
        ),
      );

      const { error: updateError } = await (supabase as any)
        .from("receivables")
        .update({
          appeal_status: "INDEFERIDO",
          appeal_resolved_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        toast.error("Erro ao indeferir recurso");
        return;
      }

      // Refetch para garantir sincronização
      await fetchReceivables();
      toast.success("Recurso indeferido");
    },
    [receivables, fetchReceivables],
  );

  // Filter receivables
  const filterReceivables = useCallback(
    (filters: ReceivablesFilters): Receivable[] => {
      return receivables.filter((r) => {
        const billingDate = parseISO(r.billingDate);

        if (filters.startDate && billingDate < filters.startDate) return false;
        if (filters.endDate && billingDate > filters.endDate) return false;
        if (filters.unit && filters.unit !== "all" && r.unit !== filters.unit) return false;
        if (filters.status && filters.status !== r.status) return false;
        if (filters.source && r.source !== filters.source) return false;
        if (filters.competencia && r.competencia !== filters.competencia) return false;
        if (filters.appealStatus && r.appealStatus !== filters.appealStatus) return false;
        if (filters.search) {
          const search = filters.search.toLowerCase();
          if (
            !r.description.toLowerCase().includes(search) &&
            !r.source.toLowerCase().includes(search) &&
            !(r.competencia && r.competencia.toLowerCase().includes(search))
          ) {
            return false;
          }
        }
        return true;
      });
    },
    [receivables],
  );

  // Get stats
  const getStats = useCallback(
    (startDate?: Date, endDate?: Date): ReceivablesStats => {
      const filtered = filterReceivables({ startDate, endDate });

      const totalBilled = filtered.reduce((sum, r) => sum + r.billedAmount, 0);
      const totalReceived = filtered.reduce((sum, r) => sum + (r.receivedAmount || 0), 0);
      const totalOpen = filtered.filter((r) => r.status === "FATURADO").reduce((sum, r) => sum + r.billedAmount, 0);
      const totalGlossed = filtered
        .filter((r) => r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA")
        .reduce((sum, r) => sum + (r.glossedAmount || 0), 0);
      const totalInAppeal = filtered
        .filter((r) => r.appealStatus === "EM_RECURSO")
        .reduce((sum, r) => sum + (r.appealAmount || r.glossedAmount || 0), 0);
      const totalRecovered = filtered
        .filter((r) => r.appealStatus === "DEFERIDO")
        .reduce((sum, r) => sum + (r.appealRecoveredAmount || 0), 0);
      const totalDefinitiveLoss = filtered
        .filter(
          (r) =>
            (r.status === "GLOSADO" || r.status === "RECEBIDO_COM_GLOSA") &&
            (r.appealStatus === "INDEFERIDO" || r.appealStatus === "NAO_INICIADO" || !r.appealStatus),
        )
        .reduce((sum, r) => sum + (r.glossedAmount || 0), 0);

      const receivedItems = filtered.filter(
        (r) => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.actualReceiptDate,
      );
      const totalDays = receivedItems.reduce((sum, r) => {
        const days = differenceInDays(parseISO(r.actualReceiptDate!), parseISO(r.billingDate));
        return sum + days;
      }, 0);
      const averageReceiptDays = receivedItems.length > 0 ? Math.round(totalDays / receivedItems.length) : 0;

      return {
        totalBilled,
        totalReceived,
        totalOpen,
        totalGlossed,
        totalInAppeal,
        totalRecovered,
        totalDefinitiveLoss,
        count: filtered.length,
        averageReceiptDays,
      };
    },
    [filterReceivables],
  );

  // Derived state
  const openReceivables = useMemo(() => receivables.filter((r) => r.status === "FATURADO"), [receivables]);

  const receivablesInAppeal = useMemo(() => receivables.filter((r) => r.appealStatus === "EM_RECURSO"), [receivables]);

  const uniqueSources = useMemo(() => [...new Set(receivables.map((r) => r.source))].filter(Boolean), [receivables]);

  /**
   * Detecta recebíveis RECEBIDO/RECEBIDO_COM_GLOSA sem financial_entry correspondente
   * e cria as entradas faltantes no Caixa, resolvendo a divergência entre
   * "Total Recebido" do Faturamento e "Total de Entradas" do Caixa.
   */
  const reconcileOrphanedReceivables = useCallback(async (): Promise<{ fixed: number; errors: number; skipped: number }> => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return { fixed: 0, errors: 0, skipped: 0 };
    }

    // 1) Buscar categoria de entrada válida para esta empresa (necessário por causa do trigger category_guard)
    const { data: settingsData, error: settingsErr } = await supabase
      .from("company_financial_settings")
      .select("categories")
      .eq("company_id", currentCompany.id)
      .maybeSingle();

    if (settingsErr) {
      toast.error("Erro ao carregar configurações da empresa");
      return { fixed: 0, errors: 0, skipped: 0 };
    }

    const categories: any[] = Array.isArray(settingsData?.categories) ? settingsData.categories as any[] : [];

    // Tenta usar RECEBIMENTO_FATURAMENTO, senão pega a primeira categoria do tipo "entrada"
    const findCategory = (code: string) =>
      categories.find((c: any) => String(c.code || "").toUpperCase() === code.toUpperCase());

    let defaultCategory =
      findCategory("RECEBIMENTO_FATURAMENTO")?.code ||
      findCategory("RECEBIMENTO")?.code ||
      categories.find((c: any) => !c.entryType || c.entryType === "entrada")?.code ||
      null;

    if (!defaultCategory) {
      toast.error(
        "Nenhuma categoria de entrada válida encontrada. Cadastre ao menos uma categoria em Configurações antes de reconciliar.",
      );
      return { fixed: 0, errors: 0, skipped: 0 };
    }

    // Normalizar para uppercase (como o trigger espera)
    defaultCategory = String(defaultCategory).toUpperCase().replace(/\s+/g, "_");

    // 1. Órfãos verdadeiros: RECEBIDO/RECEBIDO_COM_GLOSA sem nenhum linkedTransactionId
    const trueOrphans = receivables.filter(
      (r) =>
        (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
        r.receivedAmount > 0 &&
        !r.linkedTransactionId,
    );

    // 2. Links quebrados: têm linkedTransactionId mas a entry está CANCELADA
    // Isso faz o reconciler dizer "consistente" enquanto há divergência real
    const candidatesWithLink = receivables.filter(
      (r) =>
        (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
        r.receivedAmount > 0 &&
        r.linkedTransactionId,
    );

    let cancelledEntryIds = new Set<string>();
    if (candidatesWithLink.length > 0) {
      const linkedIds = candidatesWithLink.map((r) => r.linkedTransactionId as string);
      const { data: cancelledEntries } = await supabase
        .from("financial_entries")
        .select("id")
        .in("id", linkedIds)
        .eq("status", "cancelado");
      if (cancelledEntries) {
        cancelledEntries.forEach((e: { id: string }) => cancelledEntryIds.add(e.id));
      }
    }

    const brokenLinks = candidatesWithLink.filter(
      (r) => r.linkedTransactionId && cancelledEntryIds.has(r.linkedTransactionId),
    );

    const orphans = [...trueOrphans, ...brokenLinks];

    if (orphans.length === 0) {
      toast.success("Caixa consistente. Todos os recebimentos já possuem lançamento vinculado e ativo.");
      return { fixed: 0, errors: 0, skipped: 0 };
    }

    let fixed = 0;
    let errors = 0;
    let skipped = 0;

    for (const receivable of orphans) {
      try {
        const isBrokenLink = !!(receivable.linkedTransactionId && cancelledEntryIds.has(receivable.linkedTransactionId));

        // Para links quebrados: limpar o linked_transaction_id antigo ANTES da busca
        // (evita que o ilike encontre a entry cancelada e ache que já está OK)
        if (isBrokenLink) {
          await (supabase as any)
            .from("receivables")
            .update({
              linked_transaction_id: null,
              updated_at: new Date().toISOString(),
              updated_by: profile.id,
            })
            .eq("id", receivable.id);
        }

        // Verificar se já existe financial_entry ativa para este receivable (por observacao)
        const { data: existing, error: existingErr } = await supabase
          .from("financial_entries")
          .select("id")
          .eq("company_id", currentCompany.id)
          .ilike("observacao", `%receivable_id=${receivable.id}%`)
          .neq("status", "cancelado")
          .limit(1);

        if (existingErr) {
          console.error(`Erro ao verificar entry para receivable ${receivable.id}:`, existingErr);
          errors++;
          continue;
        }

        // Entry ativa encontrada — reparar o link
        if (existing && existing.length > 0) {
          await (supabase as any)
            .from("receivables")
            .update({
              linked_transaction_id: existing[0].id,
              updated_at: new Date().toISOString(),
              updated_by: profile.id,
            })
            .eq("id", receivable.id);
          skipped++;
          continue;
        }

        // Não tem entry — criar a entry faltante
        const receiptDate = receivable.actualReceiptDate || receivable.billingDate;
        // data_prevista usa billingDate para alinhar com o filtro de período do Faturamento
        const descricao = `Recebimento Faturamento • ${receivable.source} • ${receivable.description}`.substring(0, 200);

        const { data: insertedEntry, error: insertError } = await supabase
          .from("financial_entries")
          .insert([
            {
              company_id: currentCompany.id,
              created_by: profile.id,
              type: "entrada",
              status: "recebido",
              valor: receivable.receivedAmount,
              data_prevista: receivable.billingDate,
              data_recebimento: receiptDate,
              descricao,
              categoria: defaultCategory,
              unit_id: receivable.unit || null,
              receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
              payment_method: "TRANSFER",
              operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
              observacao: `[RECONCILIADO] Origem: receivable_id=${receivable.id} | Competência: ${receivable.competencia || "N/A"}`,
            },
          ])
          .select("id")
          .single();

        if (insertError || !insertedEntry) {
          const msg = (insertError as any)?.message || "erro desconhecido";
          console.error(`Erro ao criar entry para receivable ${receivable.id}: ${msg}`, insertError);
          errors++;
          continue;
        }

        // Vincular entry ao receivable
        await (supabase as any)
          .from("receivables")
          .update({
            linked_transaction_id: insertedEntry.id,
            updated_at: new Date().toISOString(),
            updated_by: profile.id,
          })
          .eq("id", receivable.id);

        fixed++;
      } catch (err: any) {
        console.error(`Erro ao reconciliar receivable ${receivable.id}:`, err);
        errors++;
      }
    }

    if (fixed > 0) {
      toast.success(`Reconciliação concluída: ${fixed} entrada(s) criada(s) no Caixa.${skipped > 0 ? ` ${skipped} já estavam corretos.` : ""}`);
    } else if (errors === 0) {
      toast.success(`Caixa consistente. ${skipped} recebimento(s) já possuíam lançamento.`);
    }

    if (errors > 0) {
      toast.error(`${errors} erro(s) durante reconciliação — verifique se as categorias estão cadastradas em Configurações.`);
    }

    return { fixed, errors, skipped };
  }, [currentCompany?.id, profile, receivables]);

  // Mark as received with MULTIPLE dates (one financial entry per date group)
  const markAsReceivedMultipleDates = useCallback(
    async (
      id: string,
      entries: Array<{ date: string; amount: number }>,
      userName: string,
    ): Promise<{ id: string; transactionIds: string[] } | null> => {
      if (!currentCompany?.id || !profile?.id) {
        toast.error("Usuário não autenticado");
        return null;
      }

      const receivable = receivables.find((r) => r.id === id);
      if (!receivable) {
        toast.error("Recebível não encontrado");
        return null;
      }

      if (receivable.status !== "FATURADO") {
        toast.error("Apenas recebíveis FATURADO podem ser marcados como recebidos");
        return null;
      }

      if (receivable.linkedTransactionId) {
        toast.error("Este recebível já está vinculado a uma movimentação.");
        return null;
      }

      if (entries.length === 0 || entries.some(e => e.amount <= 0)) {
        toast.error("Todos os valores devem ser maiores que zero");
        return null;
      }

      // TRAVA ANTI DUPLICIDADE
      if (processingIdsRef.current.has(id)) {
        toast.error("Recebimento já está sendo processado. Aguarde...");
        return null;
      }
      processingIdsRef.current.add(id);

      const createdTransactionIds: string[] = [];

      try {
        // CHECAGEM IDEMPOTÊNCIA
        const { data: existing, error: existingErr } = await supabase
          .from("financial_entries")
          .select("id, status")
          .eq("company_id", currentCompany.id)
          .ilike("observacao", `%receivable_id=${id}%`)
          .neq("status", "cancelado")
          .order("created_at", { ascending: false })
          .limit(1);

        if (!existingErr && existing && existing.length > 0) {
          toast.error("Movimentação deste recebimento já existe. Evitando duplicidade.");
          return { id, transactionIds: [existing[0].id] };
        }

        // Inferir especialidade (same as markAsReceived)
        let inferredSpecialty: string | null = null;
        let specialtyNote = "";

        const { data: prodSpecs } = await supabase
          .from("productions")
          .select("specialty")
          .eq("company_id", currentCompany.id)
          .eq("linked_receivable_id", id);

        if (Array.isArray(prodSpecs)) {
          const cleaned = prodSpecs
            .map((p: any) => (typeof p.specialty === "string" ? p.specialty.trim() : ""))
            .filter((s: string) => s.length > 0 && s !== "SEM_ESPECIALIDADE");
          const unique = Array.from(new Set(cleaned));
          if (unique.length === 1) {
            inferredSpecialty = unique[0];
          } else if (unique.length > 1) {
            specialtyNote = ` | Especialidade: múltiplas (${unique.join(", ").substring(0, 120)})`;
          }
        }

        // Inferir categoria (same as markAsReceived)
        let inferredCategory = "RECEBIMENTO_FATURAMENTO";
        let typeNote = "";

        const { data: prodTypes } = await supabase
          .from("productions")
          .select("production_type")
          .eq("company_id", currentCompany.id)
          .eq("linked_receivable_id", id);

        if (Array.isArray(prodTypes)) {
          const cleanedTypes = prodTypes
            .map((p: any) => (typeof p.production_type === "string" ? p.production_type.trim() : ""))
            .filter((t: string) => t.length > 0);
          const uniqueTypes = Array.from(new Set(cleanedTypes));

          const { data: settingsData } = await supabase
            .from("company_financial_settings")
            .select("categories")
            .eq("company_id", currentCompany.id)
            .maybeSingle();

          const validCategoryCodes = new Set(
            (Array.isArray(settingsData?.categories) ? settingsData.categories as any[] : [])
              .map((c: any) => String(c.code || c.id || c.name || "").toUpperCase())
              .filter(Boolean)
          );

          if (uniqueTypes.length === 1) {
            // Sempre usar o production_type diretamente como categoria
            inferredCategory = uniqueTypes[0];
          } else if (uniqueTypes.length > 1) {
            typeNote = ` | Tipos: múltiplos (${uniqueTypes.join(", ").substring(0, 120)})`;
          }
        }

        const { PRODUCTION_TYPE_LABELS: PROD_LABELS } = await import("@/utils/constants");

        let readableTypePrefix = "";
        if (inferredCategory === "RECEBIMENTO_FATURAMENTO") {
          const { data: prodTypesForLabel } = await supabase
            .from("productions")
            .select("production_type")
            .eq("company_id", currentCompany.id)
            .eq("linked_receivable_id", id);
          if (Array.isArray(prodTypesForLabel) && prodTypesForLabel.length > 0) {
            const types = Array.from(new Set(prodTypesForLabel.map((p: any) => p.production_type).filter(Boolean)));
            if (types.length === 1) {
              readableTypePrefix = `${PROD_LABELS[types[0] as string] || types[0]} • `;
            } else {
              readableTypePrefix = "Recebimento Faturamento • ";
            }
          }
        } else {
          readableTypePrefix = `${PROD_LABELS[inferredCategory] || inferredCategory} • `;
        }

        const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

        // Create one financial entry per date
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const descricao = `${readableTypePrefix}${receivable.source} • ${receivable.description} (${i + 1}/${entries.length})`.substring(0, 200);

          const { data: insertedEntry, error: insertError } = await supabase
            .from("financial_entries")
            .insert([{
              company_id: currentCompany.id,
              created_by: profile.id,
              type: "entrada",
              status: "recebido",
              valor: entry.amount,
              data_prevista: entry.date,
              data_recebimento: entry.date,
              descricao,
              categoria: inferredCategory,
              unit_id: receivable.unit || null,
              receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
              payment_method: "TRANSFER",
              operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
              specialty: inferredSpecialty,
              observacao: `Origem: receivable_id=${id} | Data produção: ${entry.date} | Parcela ${i + 1}/${entries.length} | Competência: ${receivable.competencia || "N/A"}${specialtyNote}${typeNote}`,
            }])
            .select()
            .single();

          if (insertError) {
            console.error(`Erro ao criar entry ${i + 1}/${entries.length}:`, insertError);
            // Rollback all created entries
            for (const txId of createdTransactionIds) {
              await supabase
                .from("financial_entries")
                .update({
                  status: "cancelado",
                  cancelled_at: new Date().toISOString(),
                  cancelled_by: profile.id,
                  cancel_reason: `Rollback automático: falha parcial ao criar múltiplas entradas para receivable ${id}`,
                })
                .eq("id", txId);
            }
            toast.error("Erro ao criar movimentações. Todas foram canceladas automaticamente.");
            return null;
          }

          createdTransactionIds.push(insertedEntry.id);
        }

        // Update receivable
        const history = [...(receivable.history || [])];
        history.push(
          createHistoryEntry(
            "RECEBIDO",
            `Recebimento por data de produção: ${entries.length} movimentações criadas (total R$ ${totalAmount.toFixed(2)})`,
            userName,
            totalAmount,
            createdTransactionIds[0],
          ),
        );

        const { error: updateError } = await (supabase as any)
          .from("receivables")
          .update({
            status: "RECEBIDO",
            received_amount: totalAmount,
            glossed_amount: 0,
            actual_receipt_date: entries[0].date,
            linked_transaction_id: createdTransactionIds[0],
            updated_at: new Date().toISOString(),
            updated_by: profile.id,
            history: JSON.parse(JSON.stringify(history)),
          })
          .eq("id", id);

        if (updateError) {
          // Rollback all
          for (const txId of createdTransactionIds) {
            await supabase
              .from("financial_entries")
              .update({
                status: "cancelado",
                cancelled_at: new Date().toISOString(),
                cancelled_by: profile.id,
                cancel_reason: `Rollback automático: falha ao vincular receivable ${id}`,
              })
              .eq("id", txId);
          }
          toast.error("Erro ao atualizar recebível. Movimentações canceladas automaticamente.");
          return null;
        }

        await fetchReceivables();
        refreshAll();
        return { id, transactionIds: createdTransactionIds };
      } catch (error) {
        console.error("Erro inesperado em markAsReceivedMultipleDates:", error);
        for (const txId of createdTransactionIds) {
          await supabase
            .from("financial_entries")
            .update({
              status: "cancelado",
              cancelled_at: new Date().toISOString(),
              cancelled_by: profile.id,
              cancel_reason: `Rollback automático: erro inesperado ao processar receivable ${id}`,
            })
            .eq("id", txId);
        }
        toast.error("Erro inesperado ao processar recebimento");
        return null;
      } finally {
        processingIdsRef.current.delete(id);
      }
    },
    [receivables, currentCompany?.id, profile?.id, fetchReceivables, refreshAll],
  );

  return {
    receivables,
    loading,
    error,
    refetch: fetchReceivables,
    addReceivable,
    updateReceivable,
    deleteReceivable: async () => {
      toast.error("Exclusão não permitida");
    },
    markAsReceived,
    markAsReceivedMultipleDates,
    markAsGlossed,
    initiateAppeal,
    approveAppeal,
    rejectAppeal,
    filterReceivables,
    getStats,
    openReceivables,
    receivablesInAppeal,
    uniqueSources,
    reconcileOrphanedReceivables,
  };
}
