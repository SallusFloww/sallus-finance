import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, parseISO } from "date-fns";
import {
  Receivable,
  ReceivableStatus,
  AppealStatus,
  ReceivablesStats,
} from "@/types";
import { toast } from "sonner";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";
import { ReceivablesFilters, toReceivable, DBReceivable } from "./receivables/types";
import { createReceivablesActions } from "./receivables/useReceivablesActions";

export function useReceivablesDB() {
  const { currentCompany, profile } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { version: globalVersion, refreshAll } = useGlobalRealtime();
  const processingIdsRef = useRef<Set<string>>(new Set());

  // Fetch receivables
  const fetchReceivables = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);
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

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables, globalVersion]);

  // Create actions from factory
  const actions = useMemo(
    () =>
      createReceivablesActions({
        receivables,
        currentCompany,
        profile,
        fetchReceivables,
        refreshAll,
        processingIdsRef,
      }),
    [receivables, currentCompany, profile, fetchReceivables, refreshAll],
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

  return {
    receivables,
    loading,
    error,
    refetch: fetchReceivables,
    addReceivable: actions.addReceivable,
    updateReceivable: actions.updateReceivable,
    deleteReceivable: async () => {
      toast.error("Exclusão não permitida");
    },
    markAsReceived: actions.markAsReceived,
    markAsReceivedMultipleDates: actions.markAsReceivedMultipleDates,
    markAsGlossed: actions.markAsGlossed,
    initiateAppeal: actions.initiateAppeal,
    approveAppeal: actions.approveAppeal,
    rejectAppeal: actions.rejectAppeal,
    filterReceivables,
    getStats,
    openReceivables,
    receivablesInAppeal,
    uniqueSources,
    reconcileOrphanedReceivables: actions.reconcileOrphanedReceivables,
  };
}
