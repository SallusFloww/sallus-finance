import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT_PDF"
  | "EXPORT_EXCEL"
  | "SWITCH_COMPANY"
  | "UPDATE_SETTINGS"
  | "CREATE_TRANSACTION"
  | "UPDATE_TRANSACTION"
  | "DELETE_TRANSACTION"
  | "CREATE_PRODUCTION"
  | "UPDATE_PRODUCTION"
  | "DELETE_PRODUCTION"
  | "CREATE_BILLING"
  | "UPDATE_BILLING"
  | "RECEIVE_BILLING"
  | "APPLY_GLOSS"
  | "ERROR_CRITICAL";

export interface AuditLogParams {
  action: AuditAction;
  module?: string;
  details?: Json;
}

/**
 * Hook for database-backed audit logging
 * Logs to Supabase audit_logs table
 */
export function useAuditLogDB() {
  const { user, currentCompany } = useAuth();

  const logAction = useCallback(
    async (params: AuditLogParams) => {
      if (!user) {
        return;
      }

      try {
        const { error } = await supabase.from("audit_logs").insert([
          {
            user_id: user.id,
            company_id: currentCompany?.id || null,
            action: params.action,
            module: params.module || null,
            details: params.details || null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            ip_address: null,
          },
        ]);

        if (error) {
          // Silently handle audit log failures in production
        }
      } catch (err) {
        // Silent fail for audit log
      }
    },
    [user, currentCompany]
  );

  // Helper methods for common actions
  const logLogin = useCallback(() => {
    return logAction({ action: "LOGIN", module: "SISTEMA" });
  }, [logAction]);

  const logLogout = useCallback(() => {
    return logAction({ action: "LOGOUT", module: "SISTEMA" });
  }, [logAction]);

  const logExportPDF = useCallback(
    (reportName: string, filters?: Record<string, string>) => {
      return logAction({
        action: "EXPORT_PDF",
        module: "RELATORIOS",
        details: { reportName, filters: filters || null } as Json,
      });
    },
    [logAction]
  );

  const logExportExcel = useCallback(
    (reportName: string, filters?: Record<string, string>) => {
      return logAction({
        action: "EXPORT_EXCEL",
        module: "RELATORIOS",
        details: { reportName, filters: filters || null } as Json,
      });
    },
    [logAction]
  );

  const logSwitchCompany = useCallback(
    (fromCompanyId: string | null, toCompanyId: string, toCompanyName: string) => {
      return logAction({
        action: "SWITCH_COMPANY",
        module: "SISTEMA",
        details: { fromCompanyId, toCompanyId, toCompanyName } as Json,
      });
    },
    [logAction]
  );

  const logSettingsUpdate = useCallback(
    (settingName: string, previousValue: string | number | boolean | null, newValue: string | number | boolean | null) => {
      return logAction({
        action: "UPDATE_SETTINGS",
        module: "CONFIGURACOES",
        details: { settingName, previousValue, newValue } as Json,
      });
    },
    [logAction]
  );

  const logCriticalError = useCallback(
    (errorMessage: string, context?: Record<string, string | number | boolean | null>) => {
      return logAction({
        action: "ERROR_CRITICAL",
        module: "SISTEMA",
        details: { errorMessage, context: context || null } as Json,
      });
    },
    [logAction]
  );

  return {
    logAction,
    logLogin,
    logLogout,
    logExportPDF,
    logExportExcel,
    logSwitchCompany,
    logSettingsUpdate,
    logCriticalError,
  };
}
