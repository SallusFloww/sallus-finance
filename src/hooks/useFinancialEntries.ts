import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Types for financial entries
export type FinancialEntryType = "entrada" | "saida";
export type FinancialEntryStatus = "previsto" | "recebido" | "cancelado";

export interface FinancialEntry {
  id: string;
  company_id: string;
  type: FinancialEntryType;
  status: FinancialEntryStatus;
  descricao: string;
  categoria: string | null;
  valor: number;
  data_prevista: string;
  data_recebimento: string | null;
  observacao: string | null;
  unit_id: string | null;
  payment_method: string | null;
  receipt_type: string | null;
  operadora: string | null;
  created_by: string | null;
  updated_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialEntryInsert {
  type: FinancialEntryType;
  status?: FinancialEntryStatus;
  descricao: string;
  categoria?: string;
  valor: number;
  data_prevista: string;
  data_recebimento?: string;
  observacao?: string;
  unit_id?: string;
  payment_method?: string;
  receipt_type?: string;
  operadora?: string;
}

export interface FinancialEntryUpdate {
  status?: FinancialEntryStatus;
  descricao?: string;
  categoria?: string;
  valor?: number;
  data_prevista?: string;
  data_recebimento?: string;
  observacao?: string;
  unit_id?: string;
  payment_method?: string;
  receipt_type?: string;
  operadora?: string;
}

export interface FinancialFilters {
  startDate?: Date;
  endDate?: Date;
  type?: FinancialEntryType;
  status?: FinancialEntryStatus;
  unit_id?: string;
  categoria?: string;
  search?: string;
}

export interface FinancialStats {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  entradasPrevistas: number;
  entradasRecebidas: number;
  entradasCanceladas: number;
  countPrevistas: number;
  countRecebidas: number;
  countCanceladas: number;
}

export function useFinancialEntries() {
  const { user, currentCompany } = useAuth();
  const currentCompanyId = currentCompany?.id;
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch entries from database
  const fetchEntries = useCallback(async () => {
    if (!currentCompanyId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("company_id", currentCompanyId)
        .order("data_prevista", { ascending: false });

      if (fetchError) throw fetchError;

      setEntries(data || []);
    } catch (err) {
      setError("Erro ao carregar movimentações financeiras");
      toast.error("Erro ao carregar movimentações");
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchEntries();

    // Subscribe to realtime changes - handle specific events for better performance
    const channel = supabase
      .channel("financial_entries_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "financial_entries",
          filter: currentCompanyId ? `company_id=eq.${currentCompanyId}` : undefined,
        },
        (payload) => {
          // Only add if not already in state (avoid duplicates from optimistic update)
          const newEntry = payload.new as FinancialEntry;
          setEntries(prev => {
            if (prev.some(e => e.id === newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "financial_entries",
          filter: currentCompanyId ? `company_id=eq.${currentCompanyId}` : undefined,
        },
        (payload) => {
          const updatedEntry = payload.new as FinancialEntry;
          setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "financial_entries",
          filter: currentCompanyId ? `company_id=eq.${currentCompanyId}` : undefined,
        },
        (payload) => {
          const deletedId = (payload.old as FinancialEntry).id;
          setEntries(prev => prev.filter(e => e.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, currentCompanyId]);

  // Add new entry with optimistic update
  const addEntry = useCallback(
    async (entry: FinancialEntryInsert): Promise<FinancialEntry | null> => {
      if (!currentCompanyId || !user) {
        toast.error("Usuário ou empresa não identificados");
        return null;
      }

      try {
        const { data, error: insertError } = await supabase
          .from("financial_entries")
          .insert({
            ...entry,
            company_id: currentCompanyId,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Optimistic update - add to local state immediately
        if (data) {
          setEntries(prev => [data, ...prev]);
        }

        toast.success(`${entry.type === "entrada" ? "Entrada" : "Saída"} registrada com sucesso`);
        return data;
      } catch (err: any) {
        if (err.message?.includes("row-level security")) {
          toast.error("Você não tem permissão para criar movimentações");
        } else {
          toast.error("Erro ao registrar movimentação");
        }
        return null;
      }
    },
    [currentCompanyId, user]
  );

  // Update entry with optimistic update
  const updateEntry = useCallback(
    async (id: string, updates: FinancialEntryUpdate): Promise<boolean> => {
      if (!user) {
        toast.error("Usuário não identificado");
        return false;
      }

      try {
        const { data, error: updateError } = await supabase
          .from("financial_entries")
          .update({
            ...updates,
            updated_by: user.id,
          })
          .eq("id", id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Optimistic update - update local state immediately
        if (data) {
          setEntries(prev => prev.map(e => e.id === id ? data : e));
        }

        toast.success("Movimentação atualizada com sucesso");
        return true;
      } catch (err: any) {
        if (err.message?.includes("row-level security")) {
          toast.error("Você não tem permissão para editar movimentações");
        } else {
          toast.error("Erro ao atualizar movimentação");
        }
        return false;
      }
    },
    [user]
  );

  // Cancel entry (instead of delete) with optimistic update
  const cancelEntry = useCallback(
    async (id: string, reason?: string): Promise<boolean> => {
      if (!user) {
        toast.error("Usuário não identificado");
        return false;
      }

      const cancelledAt = new Date().toISOString();
      const cancelReason = reason || "Cancelado pelo usuário";

      try {
        const { data, error: updateError } = await supabase
          .from("financial_entries")
          .update({
            status: "cancelado",
            cancelled_by: user.id,
            cancelled_at: cancelledAt,
            cancel_reason: cancelReason,
          })
          .eq("id", id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Optimistic update - update local state immediately
        if (data) {
          setEntries(prev => prev.map(e => e.id === id ? data : e));
        }

        toast.success("Movimentação cancelada");
        return true;
      } catch (err: any) {
        if (err.message?.includes("row-level security")) {
          toast.error("Você não tem permissão para cancelar movimentações");
        } else {
          toast.error("Erro ao cancelar movimentação");
        }
        return false;
      }
    },
    [user]
  );

  // Mark as received
  const markAsReceived = useCallback(
    async (id: string, dataRecebimento: string): Promise<boolean> => {
      return updateEntry(id, {
        status: "recebido",
        data_recebimento: dataRecebimento,
      });
    },
    [updateEntry]
  );

  // Filter entries
  const filterEntries = useCallback(
    (filters: FinancialFilters): FinancialEntry[] => {
      return entries.filter((entry) => {
        // Date filter
        if (filters.startDate) {
          const entryDate = new Date(entry.data_prevista);
          if (entryDate < filters.startDate) return false;
        }
        if (filters.endDate) {
          const entryDate = new Date(entry.data_prevista);
          if (entryDate > filters.endDate) return false;
        }

        // Type filter
        if (filters.type && entry.type !== filters.type) return false;

        // Status filter
        if (filters.status && entry.status !== filters.status) return false;

        // Unit filter
        if (filters.unit_id && entry.unit_id !== filters.unit_id) return false;

        // Category filter
        if (filters.categoria && entry.categoria !== filters.categoria) return false;

        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesDescricao = entry.descricao.toLowerCase().includes(searchLower);
          const matchesCategoria = entry.categoria?.toLowerCase().includes(searchLower);
          const matchesObservacao = entry.observacao?.toLowerCase().includes(searchLower);
          if (!matchesDescricao && !matchesCategoria && !matchesObservacao) return false;
        }

        return true;
      });
    },
    [entries]
  );

  // Calculate stats
  const getStats = useCallback(
    (filters?: FinancialFilters): FinancialStats => {
      const filteredEntries = filters ? filterEntries(filters) : entries;

      const stats: FinancialStats = {
        totalEntradas: 0,
        totalSaidas: 0,
        saldo: 0,
        entradasPrevistas: 0,
        entradasRecebidas: 0,
        entradasCanceladas: 0,
        countPrevistas: 0,
        countRecebidas: 0,
        countCanceladas: 0,
      };

      filteredEntries.forEach((entry) => {
        if (entry.type === "entrada") {
          if (entry.status === "previsto") {
            stats.entradasPrevistas += entry.valor;
            stats.countPrevistas++;
          } else if (entry.status === "recebido") {
            stats.entradasRecebidas += entry.valor;
            stats.countRecebidas++;
            stats.totalEntradas += entry.valor;
          } else if (entry.status === "cancelado") {
            stats.entradasCanceladas += entry.valor;
            stats.countCanceladas++;
          }
        } else if (entry.type === "saida") {
          // Only "recebido" (executed) exits impact balance
          if (entry.status === "recebido") {
            stats.totalSaidas += entry.valor;
          }
        }
      });

      stats.saldo = stats.totalEntradas - stats.totalSaidas;

      return stats;
    },
    [entries, filterEntries]
  );

  // Recent entries (last 10)
  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [entries]);

  // Entries by type
  const entradas = useMemo(() => entries.filter((e) => e.type === "entrada"), [entries]);
  const saidas = useMemo(() => entries.filter((e) => e.type === "saida"), [entries]);

  return {
    entries,
    entradas,
    saidas,
    loading,
    error,
    addEntry,
    updateEntry,
    cancelEntry,
    markAsReceived,
    filterEntries,
    getStats,
    recentEntries,
    refetch: fetchEntries,
  };
}
