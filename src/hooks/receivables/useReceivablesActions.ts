import { supabase } from "@/integrations/supabase/client";
import { Receivable, GlossType } from "@/types";
import { toast } from "sonner";
import { toReceivable, createHistoryEntry, DBReceivable } from "./types";

export interface ReceivablesActionsDeps {
  receivables: Receivable[];
  currentCompany: { id: string } | null;
  profile: { id: string; full_name: string | null } | null;
  fetchReceivables: () => Promise<void>;
  refreshAll: () => void;
  processingIdsRef: React.MutableRefObject<Set<string>>;
  checkPlanLimit?: () => Promise<boolean>;
}

export function createReceivablesActions(deps: ReceivablesActionsDeps) {
  const { receivables, currentCompany, profile, fetchReceivables, refreshAll, processingIdsRef, checkPlanLimit } = deps;

  // Add receivable
  const addReceivable = async (
    data: Omit<Receivable, "id" | "createdAt" | "receivedAmount" | "glossedAmount"> & {
      idempotencyKey?: string;
    },
  ) => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    // Plan limit guard
    if (checkPlanLimit) {
      const allowed = await checkPlanLimit();
      if (!allowed) return null;
    }

    const history = [
      createHistoryEntry(
        "CRIADO",
        `Faturamento registrado: R$ ${data.billedAmount.toFixed(2)}`,
        profile.full_name || "system",
        data.billedAmount,
      ),
    ];

    const lockKey = `add-receivable::${currentCompany.id}::${data.idempotencyKey || `${data.billingDate}|${data.unit}|${data.source}|${data.description}|${data.billedAmount}`}`;
    if (processingIdsRef.current.has(lockKey)) {
      toast.error("Criação de faturamento já está em processamento. Aguarde...");
      return null;
    }
    processingIdsRef.current.add(lockKey);

    try {
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
        await fetchReceivables();
        return toReceivable(existingSimilar as unknown as DBReceivable);
      }

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

      const payloadWithIdempotency = data.idempotencyKey
        ? { ...basePayload, idempotency_key: data.idempotencyKey }
        : basePayload;

      let insertedRow: unknown = null;

      {
        const { data: inserted, error: insertError } = await (supabase as any)
          .from("receivables")
          .insert([payloadWithIdempotency] as any)
          .select()
          .single();

        if (!insertError) {
          insertedRow = inserted;
        } else {
          const msg = String((insertError as any)?.message || "");
          const code = String((insertError as any)?.code || "");

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

      await fetchReceivables();
      toast.success("Recebível criado com sucesso");
      return toReceivable(insertedRow as unknown as DBReceivable);
    } finally {
      processingIdsRef.current.delete(lockKey);
    }
  };

  // Update receivable
  const updateReceivable = async (id: string, data: Partial<Receivable>, userName: string) => {
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
        editLogs.push({ field, previousValue, newValue, editedAt, editedBy: userName });
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

    await fetchReceivables();
    toast.success("Recebível atualizado");
  };

  // Mark as received
  const markAsReceived = async (
    id: string,
    receivedAmount: number,
    actualReceiptDate: string,
    userName: string,
  ): Promise<{ id: string; transactionId?: string } | null> => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    const receivable = receivables.find((r) => r.id === id);
    if (!receivable) { toast.error("Recebível não encontrado"); return null; }
    if (receivable.status !== "FATURADO") { toast.error("Apenas recebíveis FATURADO podem ser marcados como recebidos"); return null; }
    if (receivable.linkedTransactionId) { toast.error("Este recebível já está vinculado a uma movimentação. Use estorno/cancelamento se necessário."); return null; }
    if (receivedAmount <= 0) { toast.error("Valor recebido deve ser maior que zero"); return null; }

    if (processingIdsRef.current.has(id)) {
      toast.error("Recebimento já está sendo processado. Aguarde...");
      return null;
    }
    processingIdsRef.current.add(id);

    let createdTransactionId: string | null = null;

    try {
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

      // Single consolidated query instead of 3 separate N+1 queries
      let inferredSpecialty: string | null = null;
      let specialtyNote = "";
      let inferredCategory: string = "RECEBIMENTO_FATURAMENTO";
      let typeNote = "";

      const { data: linkedProds, error: linkedProdErr } = await supabase
        .from("productions")
        .select("specialty, production_type")
        .eq("company_id", currentCompany.id)
        .eq("linked_receivable_id", id);

      if (!linkedProdErr && Array.isArray(linkedProds)) {
        // Specialty inference
        const cleanedSpecs = linkedProds
          .map((p: any) => (typeof p.specialty === "string" ? p.specialty.trim() : ""))
          .filter((s: string) => s.length > 0 && s !== "SEM_ESPECIALIDADE");
        const uniqueSpecs = Array.from(new Set(cleanedSpecs));
        if (uniqueSpecs.length === 1) {
          inferredSpecialty = uniqueSpecs[0];
        } else if (uniqueSpecs.length > 1) {
          inferredSpecialty = null;
          specialtyNote = ` | Especialidade: múltiplas (${uniqueSpecs.join(", ").substring(0, 120)})`;
        }

        // Category inference
        const cleanedTypes = linkedProds
          .map((p: any) => (typeof p.production_type === "string" ? p.production_type.trim() : ""))
          .filter((t: string) => t.length > 0);
        const uniqueTypes = Array.from(new Set(cleanedTypes));

        if (uniqueTypes.length === 1) {
          inferredCategory = uniqueTypes[0];
        } else if (uniqueTypes.length > 1) {
          inferredCategory = "RECEBIMENTO_FATURAMENTO";
          typeNote = ` | Tipos: múltiplos (${uniqueTypes.join(", ").substring(0, 120)})`;
        }
      }

      const { PRODUCTION_TYPE_LABELS: PROD_LABELS } = await import("@/utils/constants");

      let readableTypePrefix = "";
      if (inferredCategory === "RECEBIMENTO_FATURAMENTO") {
        // Reuse data from the consolidated query above
        if (Array.isArray(linkedProds) && linkedProds.length > 0) {
          const types = Array.from(new Set(linkedProds.map((p: any) => p.production_type).filter(Boolean)));
          if (types.length === 1) {
            readableTypePrefix = `${PROD_LABELS[types[0] as string] || types[0]} • `;
          } else if (types.length > 1) {
            readableTypePrefix = "Recebimento Faturamento • ";
          }
        }
      } else {
        readableTypePrefix = `${PROD_LABELS[inferredCategory] || inferredCategory} • `;
      }

      const descricao = `${readableTypePrefix}${receivable.source} • ${receivable.description}`.substring(0, 200);

      const { data: insertedEntry, error: insertError } = await supabase
        .from("financial_entries")
        .insert([{
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
        }])
        .select()
        .single();

      if (insertError) {
        if (import.meta.env.DEV) console.error("Erro ao criar movimentação:", insertError);
        toast.error("Erro ao criar movimentação no caixa");
        return null;
      }

      createdTransactionId = insertedEntry.id;

      const history = [...(receivable.history || [])];
      history.push(
        createHistoryEntry("RECEBIDO", `Recebimento integral: R$ ${receivedAmount.toFixed(2)} - Movimentação ${createdTransactionId} criada`, userName, receivedAmount, createdTransactionId),
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
        if (import.meta.env.DEV) console.error("Erro ao atualizar receivable, aplicando rollback:", updateError);
        await supabase.from("financial_entries").update({
          status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: profile.id,
          cancel_reason: `Rollback automático: falha ao vincular com receivable ${id}`,
        }).eq("id", createdTransactionId);
        toast.error("Erro ao atualizar recebível. Movimentação cancelada automaticamente.");
        return null;
      }

      await fetchReceivables();
      refreshAll();
      return { id, transactionId: createdTransactionId };
    } catch (error) {
      if (import.meta.env.DEV) console.error("Erro inesperado em markAsReceived:", error);
      if (createdTransactionId) {
        await supabase.from("financial_entries").update({
          status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: profile.id,
          cancel_reason: `Rollback automático: erro inesperado ao processar receivable ${id}`,
        }).eq("id", createdTransactionId);
      }
      toast.error("Erro inesperado ao processar recebimento");
      return null;
    } finally {
      processingIdsRef.current.delete(id);
    }
  };

  // Mark as glossed
  const markAsGlossed = async (
    id: string, glossType: GlossType, glossReason: string, glossAmount: number,
    actualReceiptDate: string, userName: string, initiateAppealFlag: boolean = false,
  ) => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    const receivable = receivables.find((r) => r.id === id);
    if (!receivable || receivable.status !== "FATURADO") {
      toast.error("Apenas recebíveis FATURADO podem ser glosados");
      return null;
    }

    const now = new Date().toISOString();
    const history = [...(receivable.history || [])];
    const netReceivedAmount = glossType === "PARCIAL" ? receivable.billedAmount - glossAmount : 0;

    history.push(
      createHistoryEntry("GLOSA_REGISTRADA",
        glossType === "PARCIAL"
          ? `Glosa parcial: R$ ${glossAmount.toFixed(2)} - ${glossReason}. Valor líquido: R$ ${netReceivedAmount.toFixed(2)}`
          : `Glosa total: R$ ${receivable.billedAmount.toFixed(2)} - ${glossReason}`,
        userName, glossAmount),
    );

    if (initiateAppealFlag) {
      history.push(createHistoryEntry("RECURSO_INICIADO", `Recurso iniciado para o valor de R$ ${glossAmount.toFixed(2)}`, userName, glossAmount));
    }

    // P0 FIX: Create financial entry for partial gloss net received amount
    let createdTransactionId: string | null = null;
    if (glossType === "PARCIAL" && netReceivedAmount > 0) {
      const descricao = `Recebimento parcial (glosa) • ${receivable.source} • ${receivable.description}`.substring(0, 200);

      const { data: insertedEntry, error: insertError } = await supabase
        .from("financial_entries")
        .insert([{
          company_id: currentCompany.id,
          created_by: profile.id,
          type: "entrada" as const,
          status: "recebido" as const,
          valor: netReceivedAmount,
          data_prevista: actualReceiptDate,
          data_recebimento: actualReceiptDate,
          descricao,
          categoria: "RECEBIMENTO_FATURAMENTO",
          unit_id: receivable.unit || null,
          receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
          payment_method: "TRANSFER",
          operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
          observacao: `Origem: receivable_id=${id} | Glosa parcial: R$ ${glossAmount.toFixed(2)} | Competência: ${receivable.competencia || "N/A"}`,
        }])
        .select()
        .single();

      if (insertError) {
        if (import.meta.env.DEV) console.error("Erro ao criar movimentação para glosa parcial:", insertError);
        toast.error("Erro ao criar movimentação no caixa para valor líquido");
        return null;
      }

      createdTransactionId = insertedEntry.id;
      history.push(
        createHistoryEntry("RECEBIDO", `Movimentação criada para valor líquido: R$ ${netReceivedAmount.toFixed(2)}`, userName, netReceivedAmount, createdTransactionId),
      );
    }

    const { error: updateError } = await (supabase as any)
      .from("receivables")
      .update({
        status: glossType === "TOTAL" ? "GLOSADO" : "RECEBIDO_COM_GLOSA",
        gloss_type: glossType, gloss_reason: glossReason,
        glossed_amount: glossType === "TOTAL" ? receivable.billedAmount : glossAmount,
        received_amount: netReceivedAmount, actual_receipt_date: actualReceiptDate,
        appeal_status: initiateAppealFlag ? "EM_RECURSO" : "NAO_INICIADO",
        appeal_amount: initiateAppealFlag ? glossAmount : null,
        appeal_start_date: initiateAppealFlag ? now : null,
        linked_transaction_id: createdTransactionId || receivable.linkedTransactionId || null,
        updated_at: now, history: JSON.parse(JSON.stringify(history)),
      })
      .eq("id", id);

    if (updateError) {
      // Rollback financial entry if receivable update fails
      if (createdTransactionId) {
        await supabase.from("financial_entries").update({
          status: "cancelado" as const, cancelled_at: now, cancelled_by: profile.id,
          cancel_reason: `Rollback automático: falha ao atualizar receivable ${id} após glosa parcial`,
        }).eq("id", createdTransactionId);
      }
      toast.error("Erro ao registrar glosa");
      return null;
    }

    await fetchReceivables();
    refreshAll();
    toast.success(createdTransactionId
      ? `Glosa registrada — Movimentação de R$ ${netReceivedAmount.toFixed(2)} criada no caixa`
      : "Glosa registrada");
    return { id, transactionId: createdTransactionId };
  };

  // Initiate appeal
  const initiateAppeal = async (id: string, appealAmount: number, userName: string) => {
    const receivable = receivables.find((r) => r.id === id);
    if (!receivable) return;
    if (receivable.status !== "RECEBIDO_COM_GLOSA" && receivable.status !== "GLOSADO") return;
    if (receivable.appealStatus === "EM_RECURSO" || receivable.appealStatus === "DEFERIDO") return;

    const history = [...(receivable.history || [])];
    history.push(createHistoryEntry("RECURSO_INICIADO", `Recurso iniciado para o valor de R$ ${appealAmount.toFixed(2)}`, userName, appealAmount));

    const { error: updateError } = await (supabase as any)
      .from("receivables")
      .update({
        appeal_status: "EM_RECURSO", appeal_amount: appealAmount,
        appeal_start_date: new Date().toISOString(), updated_at: new Date().toISOString(),
        history: JSON.parse(JSON.stringify(history)),
      })
      .eq("id", id);

    if (updateError) { toast.error("Erro ao iniciar recurso"); return; }
    await fetchReceivables();
    toast.success("Recurso iniciado");
  };

  // Approve appeal
  const approveAppeal = async (id: string, recoveredAmount: number, receiptDate: string, userName: string) => {
    const receivable = receivables.find((r) => r.id === id);
    if (!receivable || receivable.appealStatus !== "EM_RECURSO") {
      toast.error("Apenas recursos EM_RECURSO podem ser deferidos");
      return null;
    }

    const newReceivedAmount = (receivable.receivedAmount || 0) + recoveredAmount;
    const newGlossedAmount = Math.max(0, (receivable.glossedAmount || 0) - recoveredAmount);
    const history = [...(receivable.history || [])];
    history.push(createHistoryEntry("RECURSO_DEFERIDO", `Recurso deferido: R$ ${recoveredAmount.toFixed(2)} recuperados`, userName, recoveredAmount));
    const newStatus = newGlossedAmount <= 0 ? "RECEBIDO" : receivable.status;

    const { error: updateError } = await (supabase as any)
      .from("receivables")
      .update({
        status: newStatus, received_amount: newReceivedAmount, glossed_amount: newGlossedAmount,
        appeal_status: "DEFERIDO", appeal_recovered_amount: recoveredAmount,
        appeal_resolved_date: new Date().toISOString(), updated_at: new Date().toISOString(),
        history: JSON.parse(JSON.stringify(history)),
      })
      .eq("id", id);

    if (updateError) { toast.error("Erro ao deferir recurso"); return null; }
    await fetchReceivables();
    toast.success("Recurso deferido");
    return { id, recoveredAmount };
  };

  // Reject appeal
  const rejectAppeal = async (id: string, userName: string) => {
    const receivable = receivables.find((r) => r.id === id);
    if (!receivable || receivable.appealStatus !== "EM_RECURSO") return;

    const history = [...(receivable.history || [])];
    history.push(createHistoryEntry("RECURSO_INDEFERIDO",
      `Recurso indeferido. Valor de R$ ${(receivable.appealAmount || receivable.glossedAmount).toFixed(2)} registrado como perda definitiva.`,
      userName, receivable.appealAmount || receivable.glossedAmount));

    const { error: updateError } = await (supabase as any)
      .from("receivables")
      .update({
        appeal_status: "INDEFERIDO", appeal_resolved_date: new Date().toISOString(),
        updated_at: new Date().toISOString(), history: JSON.parse(JSON.stringify(history)),
      })
      .eq("id", id);

    if (updateError) { toast.error("Erro ao indeferir recurso"); return; }
    await fetchReceivables();
    toast.success("Recurso indeferido");
  };

  // Reconcile orphaned receivables
  const reconcileOrphanedReceivables = async (): Promise<{ fixed: number; errors: number; skipped: number }> => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return { fixed: 0, errors: 0, skipped: 0 };
    }

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
    const findCategory = (code: string) => categories.find((c: any) => String(c.code || "").toUpperCase() === code.toUpperCase());

    let defaultCategory =
      findCategory("RECEBIMENTO_FATURAMENTO")?.code ||
      findCategory("RECEBIMENTO")?.code ||
      categories.find((c: any) => !c.entryType || c.entryType === "entrada")?.code ||
      null;

    if (!defaultCategory) {
      toast.error("Nenhuma categoria de entrada válida encontrada. Cadastre ao menos uma categoria em Configurações antes de reconciliar.");
      return { fixed: 0, errors: 0, skipped: 0 };
    }

    defaultCategory = String(defaultCategory).toUpperCase().replace(/\s+/g, "_");

    const trueOrphans = receivables.filter(
      (r) => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.receivedAmount > 0 && !r.linkedTransactionId,
    );

    const candidatesWithLink = receivables.filter(
      (r) => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.receivedAmount > 0 && r.linkedTransactionId,
    );

    let cancelledEntryIds = new Set<string>();
    if (candidatesWithLink.length > 0) {
      const linkedIds = candidatesWithLink.map((r) => r.linkedTransactionId as string);
      const { data: cancelledEntries } = await supabase
        .from("financial_entries").select("id").in("id", linkedIds).eq("status", "cancelado");
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

    let fixed = 0, errors = 0, skipped = 0;

    for (const receivable of orphans) {
      try {
        const isBrokenLink = !!(receivable.linkedTransactionId && cancelledEntryIds.has(receivable.linkedTransactionId));

        if (isBrokenLink) {
          await (supabase as any).from("receivables").update({
            linked_transaction_id: null, updated_at: new Date().toISOString(), updated_by: profile.id,
          }).eq("id", receivable.id);
        }

        const { data: existing, error: existingErr } = await supabase
          .from("financial_entries").select("id")
          .eq("company_id", currentCompany.id)
          .ilike("observacao", `%receivable_id=${receivable.id}%`)
          .neq("status", "cancelado").limit(1);

        if (existingErr) {
          if (import.meta.env.DEV) console.error(`Erro ao verificar entry para receivable ${receivable.id}:`, existingErr);
          errors++; continue;
        }

        if (existing && existing.length > 0) {
          await (supabase as any).from("receivables").update({
            linked_transaction_id: existing[0].id, updated_at: new Date().toISOString(), updated_by: profile.id,
          }).eq("id", receivable.id);
          skipped++; continue;
        }

        const receiptDate = receivable.actualReceiptDate || receivable.billingDate;
        const descricao = `Recebimento Faturamento • ${receivable.source} • ${receivable.description}`.substring(0, 200);

        const { data: insertedEntry, error: insertError } = await supabase
          .from("financial_entries")
          .insert([{
            company_id: currentCompany.id, created_by: profile.id, type: "entrada", status: "recebido",
            valor: receivable.receivedAmount, data_prevista: receivable.billingDate, data_recebimento: receiptDate,
            descricao, categoria: defaultCategory, unit_id: receivable.unit || null,
            receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
            payment_method: "TRANSFER",
            operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
            observacao: `[RECONCILIADO] Origem: receivable_id=${receivable.id} | Competência: ${receivable.competencia || "N/A"}`,
          }])
          .select("id").single();

        if (insertError || !insertedEntry) {
          if (import.meta.env.DEV) console.error(`Erro ao criar entry para receivable ${receivable.id}:`, insertError);
          errors++; continue;
        }

        await (supabase as any).from("receivables").update({
          linked_transaction_id: insertedEntry.id, updated_at: new Date().toISOString(), updated_by: profile.id,
        }).eq("id", receivable.id);

        fixed++;
      } catch (err: any) {
        if (import.meta.env.DEV) console.error(`Erro ao reconciliar receivable ${receivable.id}:`, err);
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
  };

  // Mark as received with multiple dates
  const markAsReceivedMultipleDates = async (
    id: string, entries: Array<{ date: string; amount: number }>, userName: string,
  ): Promise<{ id: string; transactionIds: string[] } | null> => {
    if (!currentCompany?.id || !profile?.id) { toast.error("Usuário não autenticado"); return null; }

    const receivable = receivables.find((r) => r.id === id);
    if (!receivable) { toast.error("Recebível não encontrado"); return null; }
    if (receivable.status !== "FATURADO") { toast.error("Apenas recebíveis FATURADO podem ser marcados como recebidos"); return null; }
    if (receivable.linkedTransactionId) { toast.error("Este recebível já está vinculado a uma movimentação."); return null; }
    if (entries.length === 0 || entries.some(e => e.amount <= 0)) { toast.error("Todos os valores devem ser maiores que zero"); return null; }

    if (processingIdsRef.current.has(id)) { toast.error("Recebimento já está sendo processado. Aguarde..."); return null; }
    processingIdsRef.current.add(id);

    const createdTransactionIds: string[] = [];

    try {
      const { data: existing, error: existingErr } = await supabase
        .from("financial_entries").select("id, status")
        .eq("company_id", currentCompany.id)
        .ilike("observacao", `%receivable_id=${id}%`)
        .neq("status", "cancelado").order("created_at", { ascending: false }).limit(1);

      if (!existingErr && existing && existing.length > 0) {
        toast.error("Movimentação deste recebimento já existe. Evitando duplicidade.");
        return { id, transactionIds: [existing[0].id] };
      }

      let inferredSpecialty: string | null = null;
      let specialtyNote = "";
      const { data: prodSpecs } = await supabase.from("productions").select("specialty").eq("company_id", currentCompany.id).eq("linked_receivable_id", id);
      if (Array.isArray(prodSpecs)) {
        const cleaned = prodSpecs.map((p: any) => (typeof p.specialty === "string" ? p.specialty.trim() : "")).filter((s: string) => s.length > 0 && s !== "SEM_ESPECIALIDADE");
        const unique = Array.from(new Set(cleaned));
        if (unique.length === 1) inferredSpecialty = unique[0];
        else if (unique.length > 1) specialtyNote = ` | Especialidade: múltiplas (${unique.join(", ").substring(0, 120)})`;
      }

      let inferredCategory = "RECEBIMENTO_FATURAMENTO";
      let typeNote = "";
      const { data: prodTypes } = await supabase.from("productions").select("production_type").eq("company_id", currentCompany.id).eq("linked_receivable_id", id);
      if (Array.isArray(prodTypes)) {
        const cleanedTypes = prodTypes.map((p: any) => (typeof p.production_type === "string" ? p.production_type.trim() : "")).filter((t: string) => t.length > 0);
        const uniqueTypes = Array.from(new Set(cleanedTypes));
        if (uniqueTypes.length === 1) inferredCategory = uniqueTypes[0];
        else if (uniqueTypes.length > 1) typeNote = ` | Tipos: múltiplos (${uniqueTypes.join(", ").substring(0, 120)})`;
      }

      const { PRODUCTION_TYPE_LABELS: PROD_LABELS } = await import("@/utils/constants");
      let readableTypePrefix = "";
      if (inferredCategory === "RECEBIMENTO_FATURAMENTO") {
        const { data: prodTypesForLabel } = await supabase.from("productions").select("production_type").eq("company_id", currentCompany.id).eq("linked_receivable_id", id);
        if (Array.isArray(prodTypesForLabel) && prodTypesForLabel.length > 0) {
          const types = Array.from(new Set(prodTypesForLabel.map((p: any) => p.production_type).filter(Boolean)));
          if (types.length === 1) readableTypePrefix = `${PROD_LABELS[types[0] as string] || types[0]} • `;
          else readableTypePrefix = "Recebimento Faturamento • ";
        }
      } else {
        readableTypePrefix = `${PROD_LABELS[inferredCategory] || inferredCategory} • `;
      }

      const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const descricao = `${readableTypePrefix}${receivable.source} • ${receivable.description} (${i + 1}/${entries.length})`.substring(0, 200);

        const { data: insertedEntry, error: insertError } = await supabase
          .from("financial_entries")
          .insert([{
            company_id: currentCompany.id, created_by: profile.id, type: "entrada", status: "recebido",
            valor: entry.amount, data_prevista: entry.date, data_recebimento: entry.date, descricao,
            categoria: inferredCategory, unit_id: receivable.unit || null,
            receipt_type: receivable.source === "PARTICULAR" ? "PARTICULAR" : "CONVENIO",
            payment_method: "TRANSFER",
            operadora: receivable.source !== "PARTICULAR" ? receivable.source : null,
            specialty: inferredSpecialty,
            observacao: `Origem: receivable_id=${id} | Data produção: ${entry.date} | Parcela ${i + 1}/${entries.length} | Competência: ${receivable.competencia || "N/A"}${specialtyNote}${typeNote}`,
          }])
          .select().single();

        if (insertError) {
          if (import.meta.env.DEV) console.error(`Erro ao criar entry ${i + 1}/${entries.length}:`, insertError);
          for (const txId of createdTransactionIds) {
            await supabase.from("financial_entries").update({
              status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: profile.id,
              cancel_reason: `Rollback automático: falha parcial ao criar múltiplas entradas para receivable ${id}`,
            }).eq("id", txId);
          }
          toast.error("Erro ao criar movimentações. Todas foram canceladas automaticamente.");
          return null;
        }
        createdTransactionIds.push(insertedEntry.id);
      }

      const history = [...(receivable.history || [])];
      history.push(createHistoryEntry("RECEBIDO", `Recebimento por data de produção: ${entries.length} movimentações criadas (total R$ ${totalAmount.toFixed(2)})`, userName, totalAmount, createdTransactionIds[0]));

      const { error: updateError } = await (supabase as any)
        .from("receivables")
        .update({
          status: "RECEBIDO", received_amount: totalAmount, glossed_amount: 0,
          actual_receipt_date: entries[0].date, linked_transaction_id: createdTransactionIds[0],
          updated_at: new Date().toISOString(), updated_by: profile.id,
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        for (const txId of createdTransactionIds) {
          await supabase.from("financial_entries").update({
            status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: profile.id,
            cancel_reason: `Rollback automático: falha ao vincular receivable ${id}`,
          }).eq("id", txId);
        }
        toast.error("Erro ao atualizar recebível. Movimentações canceladas automaticamente.");
        return null;
      }

      await fetchReceivables();
      refreshAll();
      return { id, transactionIds: createdTransactionIds };
    } catch (error) {
      if (import.meta.env.DEV) console.error("Erro inesperado em markAsReceivedMultipleDates:", error);
      for (const txId of createdTransactionIds) {
        await supabase.from("financial_entries").update({
          status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: profile.id,
          cancel_reason: `Rollback automático: erro inesperado ao processar receivable ${id}`,
        }).eq("id", txId);
      }
      toast.error("Erro inesperado ao processar recebimento");
      return null;
    } finally {
      processingIdsRef.current.delete(id);
    }
  };

  return {
    addReceivable,
    updateReceivable,
    markAsReceived,
    markAsReceivedMultipleDates,
    markAsGlossed,
    initiateAppeal,
    approveAppeal,
    rejectAppeal,
    reconcileOrphanedReceivables,
  };
}
