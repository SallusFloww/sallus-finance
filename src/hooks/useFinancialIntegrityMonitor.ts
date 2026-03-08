import { useEffect, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFinancialIntegrity } from "@/hooks/useFinancialIntegrity";
import { logErrorStandalone } from "@/hooks/useErrorLogger";
import { toast } from "sonner";

/**
 * Monitors financial integrity on every transaction change.
 * If inconsistency is detected: logs to error_logs + shows admin alert.
 */
export function useFinancialIntegrityMonitor() {
  const { currentCompany, profile, currentRole } = useAuth();
  const { transactions: txCtx } = useApp();
  const { transactions: allTransactions, settings } = txCtx;

  const integrity = useFinancialIntegrity(allTransactions, settings);
  const lastAlerted = useRef<string | null>(null);

  useEffect(() => {
    if (integrity.isValid) {
      lastAlerted.current = null;
      return;
    }

    // Only alert once per unique error message
    const key = `${integrity.difference.toFixed(2)}`;
    if (lastAlerted.current === key) return;
    lastAlerted.current = key;

    // Log to DB
    logErrorStandalone({
      action: "financial_inconsistency",
      error_message: integrity.errorMessage || "Inconsistência financeira detectada",
      severity: "critical",
      user_id: profile?.id,
      company_id: currentCompany?.id,
    });

    // Show admin toast
    if (currentRole?.name === "Admin") {
      toast.error("⚠️ Inconsistência financeira detectada", {
        description: `Diferença: R$ ${integrity.difference.toFixed(2)}`,
        duration: 10000,
      });
    }
  }, [
    integrity.isValid,
    integrity.difference,
    integrity.errorMessage,
    profile?.id,
    currentCompany?.id,
    currentRole?.name,
  ]);

  return integrity;
}
