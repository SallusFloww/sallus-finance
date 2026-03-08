import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Records page load time and provides a function to record custom metrics.
 * Batches writes to avoid excessive DB calls.
 */
export function usePerformanceMetrics(pageName?: string) {
  const { currentCompany } = useAuth();
  const loadStartRef = useRef(performance.now());

  // Record page load time
  useEffect(() => {
    if (!pageName) return;
    const timeout = setTimeout(() => {
      const loadTime = Math.round(performance.now() - loadStartRef.current);
      recordMetric("page_load_ms", loadTime, {
        page: pageName,
        company_id: currentCompany?.id,
      });
    }, 100); // Defer to not block rendering

    return () => clearTimeout(timeout);
  }, [pageName, currentCompany?.id]);

  const recordQueryTime = useCallback(
    (queryName: string, durationMs: number) => {
      recordMetric("query_time_ms", durationMs, {
        query: queryName,
        company_id: currentCompany?.id,
      });
    },
    [currentCompany?.id]
  );

  return { recordQueryTime };
}

// Metrics buffer to batch writes
let metricsBuffer: Array<{
  metric_name: string;
  value: number;
  context: Record<string, any>;
}> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function recordMetric(
  metric_name: string,
  value: number,
  context: Record<string, any>
) {
  metricsBuffer.push({ metric_name, value, context });

  if (!flushTimer) {
    flushTimer = setTimeout(flushMetrics, 5000); // Flush every 5s
  }
}

async function flushMetrics() {
  flushTimer = null;
  if (metricsBuffer.length === 0) return;

  const batch = [...metricsBuffer];
  metricsBuffer = [];

  try {
    await (supabase as any).from("system_metrics").insert(batch);
  } catch (_) {
    // Silent — metrics should never crash the app
  }
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushMetrics);
}
