import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

interface LogErrorParams {
  page?: string;
  action: string;
  error_message: string;
  stack_trace?: string;
  severity?: ErrorSeverity;
}

/**
 * Hook to log errors to the error_logs table.
 * Silently captures — never throws or blocks UI.
 */
export function useErrorLogger() {
  const { profile, currentCompany } = useAuth();

  const logError = useCallback(
    async (params: LogErrorParams) => {
      try {
        await (supabase as any).from("error_logs").insert({
          user_id: profile?.id || null,
          company_id: currentCompany?.id || null,
          page: params.page || window.location.pathname,
          action: params.action,
          error_message: params.error_message.slice(0, 2000),
          stack_trace: params.stack_trace?.slice(0, 5000) || null,
          severity: params.severity || "medium",
        });
      } catch (_) {
        // Silent — logging should never crash the app
      }
    },
    [profile?.id, currentCompany?.id]
  );

  return { logError };
}

/**
 * Standalone error logger (no hook context required).
 * Used by ErrorBoundary and global error handlers.
 */
export async function logErrorStandalone(params: LogErrorParams & { user_id?: string; company_id?: string }) {
  try {
    await (supabase as any).from("error_logs").insert({
      user_id: params.user_id || null,
      company_id: params.company_id || null,
      page: params.page || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
      action: params.action,
      error_message: params.error_message.slice(0, 2000),
      stack_trace: params.stack_trace?.slice(0, 5000) || null,
      severity: params.severity || "medium",
    });
  } catch (_) {
    // Silent
  }
}
