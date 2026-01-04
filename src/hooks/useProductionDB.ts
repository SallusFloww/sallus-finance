import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { 
  Production, 
  ProductionStatus, 
  ProductionType,
  ProductionStats,
  ProductionHistoryEntry 
} from "@/types";
import { toast } from "sonner";

export interface ProductionFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: ProductionStatus;
  productionType?: ProductionType;
  payerType?: "CONVENIO" | "PARTICULAR";
  convenio?: string;
  competencia?: string;
  search?: string;
}

// Tipo do banco de dados
interface DBProduction {
  id: string;
  company_id: string;
  production_date: string;
  competencia: string;
  unit: string;
  specialty: string | null;
  payer_type: string;
  convenio: string | null;
  production_type: string;
  description: string;
  procedure_code: string | null;
  quantity: number;
  unit_value: number;
  total_value: number;
  billed_value: number | null;
  received_value: number | null;
  glossed_value: number | null;
  status: string;
  linked_receivable_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  history: ProductionHistoryEntry[];
  edit_logs: Array<{
    field: string;
    previousValue: string;
    newValue: string;
    editedAt: string;
    editedBy: string;
  }>;
}

// Converter de DB para domínio
function toProduction(db: DBProduction): Production {
  return {
    id: db.id,
    productionDate: db.production_date,
    competencia: db.competencia,
    unit: db.unit,
    specialty: db.specialty || undefined,
    payerType: db.payer_type as "CONVENIO" | "PARTICULAR",
    convenio: db.convenio || undefined,
    productionType: db.production_type,
    description: db.description,
    procedureCode: db.procedure_code || undefined,
    quantity: Number(db.quantity),
    unitValue: Number(db.unit_value),
    estimatedValue: Number(db.total_value),
    billedValue: db.billed_value ? Number(db.billed_value) : undefined,
    receivedValue: db.received_value ? Number(db.received_value) : undefined,
    glossedValue: db.glossed_value ? Number(db.glossed_value) : undefined,
    status: db.status as ProductionStatus,
    linkedReceivableIds: db.linked_receivable_id ? [db.linked_receivable_id] : [],
    createdBy: db.created_by || "system",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    history: db.history || [],
    editLogs: db.edit_logs || [],
  };
}

// Criar entrada no histórico
function createHistoryEntry(
  action: ProductionHistoryEntry["action"],
  description: string,
  userName: string,
  amount?: number,
  linkedReceivableId?: string
): ProductionHistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    description,
    timestamp: new Date().toISOString(),
    userName,
    amount,
    linkedReceivableId,
  };
}

export function useProductionDB() {
  const { currentCompany, profile } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch productions
  const fetchProductions = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("productions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("production_date", { ascending: false });

      if (fetchError) throw fetchError;

      setProductions((data || []).map(d => toProduction(d as unknown as DBProduction)));
      setError(null);
    } catch (err) {
      setError("Erro ao carregar produções");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchProductions();

    if (!currentCompany?.id) return;

    const channel = supabase
      .channel("productions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productions",
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          fetchProductions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, fetchProductions]);

  // Add production
  const addProduction = useCallback(async (
    data: Omit<Production, "id" | "createdAt" | "status" | "history">
  ) => {
    if (!currentCompany?.id || !profile?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    const totalValue = data.quantity * data.unitValue;
    const history = [
      createHistoryEntry(
        "CRIADO",
        `Produção registrada: ${data.quantity}x ${data.description}`,
        profile.full_name || "system",
        totalValue
      ),
    ];

    const { data: inserted, error: insertError } = await supabase
      .from("productions")
      .insert([{
        company_id: currentCompany.id,
        production_date: data.productionDate,
        competencia: data.competencia,
        unit: data.unit,
        specialty: data.specialty || null,
        payer_type: data.payerType,
        convenio: data.convenio || null,
        production_type: data.productionType,
        description: data.description,
        procedure_code: data.procedureCode || null,
        quantity: data.quantity,
        unit_value: data.unitValue,
        total_value: totalValue,
        status: "PRODUZIDO",
        created_by: profile.id,
        history: JSON.parse(JSON.stringify(history)),
      }])
      .select()
      .single();

    if (insertError) {
      toast.error("Erro ao criar produção");
      return null;
    }

    toast.success("Produção registrada com sucesso");
    return toProduction(inserted as unknown as DBProduction);
  }, [currentCompany?.id, profile]);

  // Update production
  const updateProduction = useCallback(async (
    id: string,
    data: Partial<Production>,
    userName: string
  ) => {
    const production = productions.find(p => p.id === id);
    if (!production || production.status !== "PRODUZIDO") {
      toast.error("Apenas produções com status PRODUZIDO podem ser editadas");
      return;
    }

    const editLog = {
      field: "multiple",
      previousValue: JSON.stringify(production),
      newValue: JSON.stringify(data),
      editedAt: new Date().toISOString(),
      editedBy: userName,
    };

    const history = [...(production.history || [])];
    history.push(createHistoryEntry("EDITADO", "Produção atualizada", userName));

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      edit_logs: [...(production.editLogs || []), editLog],
      history: history,
    };

    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unitValue !== undefined) updateData.unit_value = data.unitValue;
    if (data.quantity !== undefined || data.unitValue !== undefined) {
      const qty = data.quantity ?? production.quantity;
      const val = data.unitValue ?? production.unitValue;
      updateData.total_value = qty * val;
    }

    const { error: updateError } = await supabase
      .from("productions")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      toast.error("Erro ao atualizar produção");
      return;
    }

    toast.success("Produção atualizada");
  }, [productions]);

  // Delete production
  const deleteProduction = useCallback(async (id: string) => {
    const production = productions.find(p => p.id === id);
    if (!production || production.status !== "PRODUZIDO") {
      toast.error("Apenas produções com status PRODUZIDO podem ser excluídas");
      return;
    }

    // Soft delete - mark as cancelled (we don't actually delete due to RLS)
    toast.error("Exclusão não permitida. Use cancelamento em vez disso.");
  }, [productions]);

  // Link to receivable
  const linkToReceivable = useCallback(async (
    productionIds: string[],
    receivableId: string,
    billedValue: number,
    userName: string
  ) => {
    for (const id of productionIds) {
      const production = productions.find(p => p.id === id);
      if (!production || production.status !== "PRODUZIDO") continue;

      const history = [...(production.history || [])];
      history.push(createHistoryEntry(
        "VINCULADO_FATURAMENTO",
        `Vinculado ao faturamento`,
        userName,
        billedValue,
        receivableId
      ));

      await supabase
        .from("productions")
        .update({
          status: "FATURADO",
          linked_receivable_id: receivableId,
          billed_value: billedValue,
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);
    }

    toast.success("Produções vinculadas ao faturamento");
  }, [productions]);

  // Mark as received
  const markAsReceived = useCallback(async (
    productionIds: string[],
    receivedValue: number,
    userName: string
  ) => {
    for (const id of productionIds) {
      const production = productions.find(p => p.id === id);
      if (!production || production.status !== "FATURADO") continue;

      const history = [...(production.history || [])];
      history.push(createHistoryEntry("RECEBIDO", `Produção recebida`, userName, receivedValue));

      await supabase
        .from("productions")
        .update({
          status: "RECEBIDO",
          received_value: receivedValue,
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);
    }

    toast.success("Produções marcadas como recebidas");
  }, [productions]);

  // Mark as glossed
  const markAsGlossed = useCallback(async (
    productionIds: string[],
    glossedValue: number,
    userName: string
  ) => {
    for (const id of productionIds) {
      const production = productions.find(p => p.id === id);
      if (!production || production.status !== "FATURADO") continue;

      const history = [...(production.history || [])];
      history.push(createHistoryEntry("GLOSADO", `Produção glosada`, userName, glossedValue));

      await supabase
        .from("productions")
        .update({
          status: "GLOSADO",
          glossed_value: glossedValue,
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);
    }

    toast.success("Produções marcadas como glosadas");
  }, [productions]);

  // Filter productions
  const filterProductions = useCallback((filters: ProductionFilters): Production[] => {
    return productions.filter((p) => {
      if (filters.startDate && filters.endDate) {
        const productionDate = parseISO(p.productionDate);
        if (!isWithinInterval(productionDate, {
          start: startOfDay(filters.startDate),
          end: endOfDay(filters.endDate),
        })) {
          return false;
        }
      }

      if (filters.unit && p.unit !== filters.unit) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.productionType && p.productionType !== filters.productionType) return false;
      if (filters.payerType && p.payerType !== filters.payerType) return false;
      if (filters.convenio && p.convenio !== filters.convenio) return false;
      if (filters.competencia && p.competencia !== filters.competencia) return false;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesDescription = p.description.toLowerCase().includes(searchLower);
        const matchesConvenio = p.convenio?.toLowerCase().includes(searchLower);
        const matchesCode = p.procedureCode?.toLowerCase().includes(searchLower);
        if (!matchesDescription && !matchesConvenio && !matchesCode) return false;
      }

      return true;
    });
  }, [productions]);

  // Get stats
  const getStats = useCallback((startDate?: Date, endDate?: Date): ProductionStats => {
    const filtered = startDate && endDate 
      ? filterProductions({ startDate, endDate })
      : productions;

    const stats: ProductionStats = {
      totalQuantityProduced: 0,
      totalQuantityBilled: 0,
      totalQuantityReceived: 0,
      totalQuantityOpen: 0,
      totalQuantityGlossed: 0,
      totalProduced: 0,
      totalBilled: 0,
      totalReceived: 0,
      totalOpen: 0,
      totalGlossed: 0,
      countProduced: 0,
      countBilled: 0,
      countReceived: 0,
      countOpen: 0,
      billingRate: 0,
      receiptRate: 0,
      conversionRate: 0,
      glossRate: 0,
      byProductionType: {} as Record<string, { count: number; quantity: number; value: number }>,
      byPayerType: { convenio: 0, particular: 0 },
      byPayerTypeQuantity: { convenio: 0, particular: 0 },
    };

    filtered.forEach((p) => {
      stats.totalProduced += p.estimatedValue;
      stats.totalQuantityProduced += p.quantity;
      stats.countProduced++;

      if (!stats.byProductionType[p.productionType]) {
        stats.byProductionType[p.productionType] = { count: 0, quantity: 0, value: 0 };
      }
      stats.byProductionType[p.productionType].count++;
      stats.byProductionType[p.productionType].quantity += p.quantity;
      stats.byProductionType[p.productionType].value += p.estimatedValue;

      if (p.payerType === "CONVENIO") {
        stats.byPayerType.convenio += p.estimatedValue;
        stats.byPayerTypeQuantity.convenio += p.quantity;
      } else {
        stats.byPayerType.particular += p.estimatedValue;
        stats.byPayerTypeQuantity.particular += p.quantity;
      }

      switch (p.status) {
        case "PRODUZIDO":
          stats.totalOpen += p.estimatedValue;
          stats.totalQuantityOpen += p.quantity;
          stats.countOpen++;
          break;
        case "FATURADO":
          stats.totalBilled += p.billedValue || p.estimatedValue;
          stats.totalQuantityBilled += p.quantity;
          stats.countBilled++;
          break;
        case "RECEBIDO":
          stats.totalBilled += p.billedValue || p.estimatedValue;
          stats.totalReceived += p.receivedValue || 0;
          stats.totalQuantityBilled += p.quantity;
          stats.totalQuantityReceived += p.quantity;
          stats.countBilled++;
          stats.countReceived++;
          break;
        case "GLOSADO":
          stats.totalBilled += p.billedValue || p.estimatedValue;
          stats.totalGlossed += p.glossedValue || 0;
          stats.totalQuantityBilled += p.quantity;
          stats.totalQuantityGlossed += p.quantity;
          stats.countBilled++;
          break;
      }
    });

    if (stats.totalQuantityProduced > 0) {
      stats.billingRate = (stats.totalQuantityBilled / stats.totalQuantityProduced) * 100;
      stats.conversionRate = (stats.totalQuantityReceived / stats.totalQuantityProduced) * 100;
    }
    if (stats.totalQuantityBilled > 0) {
      stats.receiptRate = (stats.totalQuantityReceived / stats.totalQuantityBilled) * 100;
      stats.glossRate = (stats.totalQuantityGlossed / stats.totalQuantityBilled) * 100;
    }

    return stats;
  }, [productions, filterProductions]);

  // Derived state
  const openProductions = useMemo(() => 
    productions.filter((p) => p.status === "PRODUZIDO"),
    [productions]
  );

  const billedProductions = useMemo(() => 
    productions.filter((p) => p.status === "FATURADO"),
    [productions]
  );

  const uniqueConvenios = useMemo(() => {
    const convenios = new Set<string>();
    productions.forEach((p) => {
      if (p.convenio) convenios.add(p.convenio);
    });
    return Array.from(convenios).sort();
  }, [productions]);

  const getProductionsByReceivable = useCallback((receivableId: string): Production[] => {
    return productions.filter((p) => 
      p.linkedReceivableIds?.includes(receivableId)
    );
  }, [productions]);

  const uniqueProcedureCodes = useMemo(() => {
    const codes = new Set<string>();
    productions.forEach((p) => {
      if (p.procedureCode) codes.add(p.procedureCode);
    });
    return Array.from(codes).sort();
  }, [productions]);

  return {
    productions,
    loading,
    error,
    refetch: fetchProductions,
    addProduction,
    updateProduction,
    deleteProduction,
    linkToReceivable,
    markAsReceived,
    markAsGlossed,
    filterProductions,
    getStats,
    openProductions,
    billedProductions,
    uniqueConvenios,
    uniqueProcedureCodes,
    getProductionsByReceivable,
  };
}
