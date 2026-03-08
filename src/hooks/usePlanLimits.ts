import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanLimits {
  plan: string;
  maxUsers: number;
  maxRecords: number;
  currentUsers: number;
  currentRecords: number;
}

const DEFAULT_LIMITS: PlanLimits = {
  plan: "FREE",
  maxUsers: 3,
  maxRecords: 1000,
  currentUsers: 0,
  currentRecords: 0,
};

export function usePlanLimits() {
  const { currentCompany } = useAuth();
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(false);

  const fetchLimits = useCallback(async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_company_plan_limits", {
        _company_id: currentCompany.id,
      });

      if (error || !data) {
        setLimits(DEFAULT_LIMITS);
        return;
      }

      setLimits({
        plan: data.plan || "FREE",
        maxUsers: data.max_users ?? 3,
        maxRecords: data.max_records ?? 1000,
        currentUsers: data.current_users ?? 0,
        currentRecords: data.current_records ?? 0,
      });
    } catch {
      setLimits(DEFAULT_LIMITS);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const canCreateRecord = limits.currentRecords < limits.maxRecords;
  const canAddUser = limits.currentUsers < limits.maxUsers;
  const needsUpgrade = !canCreateRecord || !canAddUser;
  const usagePercent = limits.maxRecords > 0 ? Math.round((limits.currentRecords / limits.maxRecords) * 100) : 0;

  return {
    limits,
    loading,
    canCreateRecord,
    canAddUser,
    needsUpgrade,
    usagePercent,
    refetch: fetchLimits,
  };
}
