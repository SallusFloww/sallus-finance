import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CompanyUsage {
  totalUsers: number;
  totalRecords: number;
  financialVolume: number;
  financialEntries: number;
  receivables: number;
  productions: number;
}

export function useCompanyUsage() {
  const { currentCompany } = useAuth();
  const [usage, setUsage] = useState<CompanyUsage | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      // Parallel count queries
      const [usersRes, finRes, recRes, prodRes, volRes] = await Promise.all([
        (supabase as any)
          .from("user_company_roles")
          .select("*", { count: "exact", head: true })
          .eq("company_id", currentCompany.id)
          .eq("is_active", true),
        (supabase as any)
          .from("financial_entries")
          .select("*", { count: "exact", head: true })
          .eq("company_id", currentCompany.id),
        (supabase as any)
          .from("receivables")
          .select("*", { count: "exact", head: true })
          .eq("company_id", currentCompany.id),
        (supabase as any)
          .from("productions")
          .select("*", { count: "exact", head: true })
          .eq("company_id", currentCompany.id),
        supabase
          .from("financial_entries")
          .select("valor")
          .eq("company_id", currentCompany.id)
          .neq("status", "cancelado"),
      ]);

      const financialVolume = (volRes.data || []).reduce(
        (sum: number, e: { valor: number }) => sum + Math.abs(e.valor),
        0
      );

      const result: CompanyUsage = {
        totalUsers: usersRes.count || 0,
        financialEntries: finRes.count || 0,
        receivables: recRes.count || 0,
        productions: prodRes.count || 0,
        totalRecords: (finRes.count || 0) + (recRes.count || 0) + (prodRes.count || 0),
        financialVolume,
      };

      setUsage(result);

      // Upsert daily snapshot
      await (supabase as any).from("company_usage_metrics").upsert(
        {
          company_id: currentCompany.id,
          metric_date: new Date().toISOString().split("T")[0],
          total_users: result.totalUsers,
          total_records: result.totalRecords,
          financial_volume: result.financialVolume,
        },
        { onConflict: "company_id,metric_date" }
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  return { usage, loading, fetchUsage };
}
