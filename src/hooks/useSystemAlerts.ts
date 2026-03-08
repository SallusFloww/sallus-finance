import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface SystemAlert {
  id: string;
  created_at: string;
  severity: AlertSeverity;
  message: string;
  context: Record<string, any> | null;
  resolved: boolean;
}

/**
 * Hook to manage system alerts (read, create, resolve).
 */
export function useSystemAlerts() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async (onlyUnresolved = true) => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (onlyUnresolved) {
        query = query.eq("resolved", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
      return data as SystemAlert[];
    } catch (_) {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createAlert = useCallback(
    async (severity: AlertSeverity, message: string, context?: Record<string, any>) => {
      try {
        await (supabase as any).from("system_alerts").insert({
          severity,
          message,
          context: context || null,
          resolved: false,
        });
      } catch (_) {
        // Silent
      }
    },
    []
  );

  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      await (supabase as any)
        .from("system_alerts")
        .update({ resolved: true })
        .eq("id", alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (_) {
      // Silent
    }
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = alerts.filter((a) => a.severity === "WARNING").length;

  return { alerts, loading, fetchAlerts, createAlert, resolveAlert, criticalCount, warningCount };
}

/**
 * Standalone alert creator (no hook context required).
 */
export async function createAlertStandalone(
  severity: AlertSeverity,
  message: string,
  context?: Record<string, any>
) {
  try {
    await (supabase as any).from("system_alerts").insert({
      severity,
      message,
      context: context || null,
      resolved: false,
    });
  } catch (_) {
    // Silent
  }
}
