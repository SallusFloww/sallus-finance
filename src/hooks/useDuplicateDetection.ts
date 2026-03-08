import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logErrorStandalone } from "./useErrorLogger";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingId?: string;
  message?: string;
}

/**
 * Preventive duplicate detection for financial entries and receivables.
 * Runs BEFORE inserts to avoid duplicity.
 */
export function useDuplicateDetection() {
  const { currentCompany, profile } = useAuth();

  /**
   * Check for duplicate financial entry within a 2-minute window.
   */
  const checkFinancialDuplicate = useCallback(
    async (params: {
      descricao: string;
      valor: number;
      data_prevista: string;
      type: string;
      request_id?: string;
    }): Promise<DuplicateCheckResult> => {
      if (!currentCompany?.id) return { isDuplicate: false };

      try {
        // 1. Check request_id uniqueness first (strongest signal)
        if (params.request_id) {
          const { data: byRequestId } = await (supabase as any)
            .from("financial_entries")
            .select("id")
            .eq("company_id", currentCompany.id)
            .eq("request_id", params.request_id)
            .maybeSingle();

          if (byRequestId) {
            return {
              isDuplicate: true,
              existingId: byRequestId.id,
              message: "Lançamento já registrado (request_id duplicado)",
            };
          }
        }

        // 2. Fuzzy duplicate: same description + value + date within 2 min
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: similar } = await (supabase as any)
          .from("financial_entries")
          .select("id")
          .eq("company_id", currentCompany.id)
          .eq("descricao", params.descricao)
          .eq("valor", params.valor)
          .eq("data_prevista", params.data_prevista)
          .eq("type", params.type)
          .neq("status", "cancelado")
          .gte("created_at", twoMinAgo)
          .limit(1)
          .maybeSingle();

        if (similar) {
          return {
            isDuplicate: true,
            existingId: similar.id,
            message:
              "Lançamento similar encontrado nos últimos 2 minutos. Verifique se não é duplicado.",
          };
        }

        return { isDuplicate: false };
      } catch (e: any) {
        await logErrorStandalone({
          action: "duplicate_check_financial",
          error_message: e.message,
          severity: "low",
          user_id: profile?.id,
          company_id: currentCompany?.id,
        });
        return { isDuplicate: false }; // On error, don't block the user
      }
    },
    [currentCompany?.id, profile?.id]
  );

  /**
   * Check for duplicate receivable.
   */
  const checkReceivableDuplicate = useCallback(
    async (params: {
      billing_date: string;
      unit: string;
      source: string;
      description: string;
      billed_amount: number;
      idempotency_key?: string;
    }): Promise<DuplicateCheckResult> => {
      if (!currentCompany?.id) return { isDuplicate: false };

      try {
        // Check idempotency key
        if (params.idempotency_key) {
          const { data: byKey } = await (supabase as any)
            .from("receivables")
            .select("id")
            .eq("company_id", currentCompany.id)
            .eq("idempotency_key", params.idempotency_key)
            .maybeSingle();

          if (byKey) {
            return {
              isDuplicate: true,
              existingId: byKey.id,
              message: "Recebível já registrado (chave de idempotência duplicada)",
            };
          }
        }

        // Fuzzy check
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: similar } = await (supabase as any)
          .from("receivables")
          .select("id")
          .eq("company_id", currentCompany.id)
          .eq("billing_date", params.billing_date)
          .eq("unit", params.unit)
          .eq("source", params.source)
          .eq("description", params.description)
          .eq("billed_amount", params.billed_amount)
          .neq("status", "CANCELADO")
          .gte("created_at", twoMinAgo)
          .limit(1)
          .maybeSingle();

        if (similar) {
          return {
            isDuplicate: true,
            existingId: similar.id,
            message:
              "Recebível similar encontrado nos últimos 2 minutos. Verifique se não é duplicado.",
          };
        }

        return { isDuplicate: false };
      } catch (e: any) {
        await logErrorStandalone({
          action: "duplicate_check_receivable",
          error_message: e.message,
          severity: "low",
          user_id: profile?.id,
          company_id: currentCompany?.id,
        });
        return { isDuplicate: false };
      }
    },
    [currentCompany?.id, profile?.id]
  );

  return { checkFinancialDuplicate, checkReceivableDuplicate };
}
