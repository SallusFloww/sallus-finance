import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SystemStatus = "SYSTEM_OK" | "SYSTEM_WARNING" | "SYSTEM_ERROR" | "CHECKING" | "UNKNOWN";

export interface HealthCheckResult {
  status: SystemStatus;
  timestamp: string;
  checks: Record<string, { status: string; detail?: string }>;
}

/**
 * Hook for triggering and reading system health checks.
 */
export function useHealthCheck() {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (error) throw error;
      setResult(data as HealthCheckResult);
      return data as HealthCheckResult;
    } catch (e: any) {
      const errorResult: HealthCheckResult = {
        status: "SYSTEM_ERROR",
        timestamp: new Date().toISOString(),
        checks: {
          edge_function: { status: "ERROR", detail: e.message },
        },
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, runHealthCheck };
}
