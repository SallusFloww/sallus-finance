import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HealthReport {
  timestamp: string;
  totalErrors24h: number;
  totalAlerts: number;
  criticalAlerts: number;
  tableGrowth: Record<string, number>;
  financialStatus: "OK" | "WARNING" | "ERROR" | "UNKNOWN";
  systemStatus: "SYSTEM_OK" | "SYSTEM_WARNING" | "SYSTEM_ERROR";
}

const MONITORED_TABLES = [
  "financial_entries",
  "receivables",
  "productions",
  "audit_logs",
] as const;

const GROWTH_THRESHOLD = 10_000;

/**
 * Generates a comprehensive system health report.
 */
export function useSystemHealthReport() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentCompany } = useAuth();

  const generateReport = useCallback(async () => {
    setLoading(true);
    let systemStatus: HealthReport["systemStatus"] = "SYSTEM_OK";

    // 1. Count errors in last 24h
    let totalErrors24h = 0;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await (supabase as any)
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      totalErrors24h = count || 0;
    } catch (_) {}

    // 2. Count alerts
    let totalAlerts = 0;
    let criticalAlerts = 0;
    try {
      const { data } = await (supabase as any)
        .from("system_alerts")
        .select("severity")
        .eq("resolved", false);
      totalAlerts = data?.length || 0;
      criticalAlerts = data?.filter((a: any) => a.severity === "CRITICAL").length || 0;
    } catch (_) {}

    if (criticalAlerts > 0) systemStatus = "SYSTEM_ERROR";
    else if (totalAlerts > 0 || totalErrors24h > 10) systemStatus = "SYSTEM_WARNING";

    // 3. Table growth
    const tableGrowth: Record<string, number> = {};
    for (const table of MONITORED_TABLES) {
      try {
        const { count } = await (supabase as any)
          .from(table)
          .select("*", { count: "exact", head: true });
        tableGrowth[table] = count || 0;
        if ((count || 0) > GROWTH_THRESHOLD && systemStatus === "SYSTEM_OK") {
          systemStatus = "SYSTEM_WARNING";
        }
      } catch (_) {
        tableGrowth[table] = -1;
      }
    }

    // 4. Financial integrity check (basic)
    let financialStatus: HealthReport["financialStatus"] = "UNKNOWN";
    if (currentCompany) {
      try {
        const { data: settings } = await supabase
          .from("company_financial_settings")
          .select("initial_balance")
          .eq("company_id", currentCompany.id)
          .maybeSingle();

        const initialBalance = settings?.initial_balance ?? 0;

        const { data: entries } = await supabase
          .from("financial_entries")
          .select("type, valor")
          .eq("company_id", currentCompany.id)
          .eq("status", "recebido");

        let income = 0, expense = 0;
        for (const e of entries || []) {
          if (e.type === "entrada") income += Number(e.valor);
          else expense += Number(e.valor);
        }

        const balance = initialBalance + income - expense;
        financialStatus = isNaN(balance) ? "ERROR" : "OK";
      } catch (_) {
        financialStatus = "ERROR";
      }
    }

    if (financialStatus === "ERROR") systemStatus = "SYSTEM_ERROR";

    const healthReport: HealthReport = {
      timestamp: new Date().toISOString(),
      totalErrors24h,
      totalAlerts,
      criticalAlerts,
      tableGrowth,
      financialStatus,
      systemStatus,
    };

    // Save to system_metrics
    try {
      await (supabase as any).from("system_metrics").insert({
        metric_name: "health_report",
        value: systemStatus === "SYSTEM_OK" ? 1 : systemStatus === "SYSTEM_WARNING" ? 0.5 : 0,
        context: healthReport,
      });
    } catch (_) {}

    setReport(healthReport);
    setLoading(false);
    return healthReport;
  }, [currentCompany?.id]);

  return { report, loading, generateReport };
}
