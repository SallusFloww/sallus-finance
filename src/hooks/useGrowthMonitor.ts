import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TableGrowthInfo {
  table: string;
  count: number;
  warning: boolean;
}

const MONITORED_TABLES = [
  "financial_entries",
  "receivables",
  "productions",
  "audit_logs",
] as const;

const THRESHOLD = 10_000;

/**
 * Monitors table sizes and warns when > 10k rows.
 */
export function useGrowthMonitor() {
  const [tables, setTables] = useState<TableGrowthInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const checkGrowth = useCallback(async () => {
    setLoading(true);
    const results: TableGrowthInfo[] = [];

    for (const table of MONITORED_TABLES) {
      try {
        const { count } = await (supabase as any)
          .from(table)
          .select("*", { count: "exact", head: true });
        results.push({
          table,
          count: count || 0,
          warning: (count || 0) > THRESHOLD,
        });
      } catch (_) {
        results.push({ table, count: -1, warning: false });
      }
    }

    setTables(results);
    setLoading(false);
    return results;
  }, []);

  const hasWarnings = tables.some((t) => t.warning);

  return { tables, loading, checkGrowth, hasWarnings };
}
