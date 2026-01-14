import { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PackageType = "PACOTE_BOX" | "PACOTE_GTA";

export interface PackagePricingRule {
  id: string;
  companyId: string;
  planId: string;
  packageType: PackageType;
  consultDefaultAmount: number;
  feeDefaultAmount: number;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  notes: string | null;
}

export interface PackageComponents {
  consultAmount: number;
  feeAmount: number;
  matmedAmount: number;
  totalAmount: number;
}

interface DBPackagePricingRule {
  id: string;
  company_id: string;
  plan_id: string;
  package_type: string;
  consult_default_amount: number;
  fee_default_amount: number;
  effective_from: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  notes: string | null;
}

function mapDBToRule(dbRule: DBPackagePricingRule): PackagePricingRule {
  return {
    id: dbRule.id,
    companyId: dbRule.company_id,
    planId: dbRule.plan_id,
    packageType: dbRule.package_type as PackageType,
    consultDefaultAmount: Number(dbRule.consult_default_amount) || 0,
    feeDefaultAmount: Number(dbRule.fee_default_amount) || 0,
    effectiveFrom: dbRule.effective_from,
    isActive: dbRule.is_active,
    createdAt: dbRule.created_at,
    updatedAt: dbRule.updated_at,
    createdBy: dbRule.created_by,
    notes: dbRule.notes,
  };
}

export function usePackagePricing() {
  const { currentCompany, user } = useAuth();
  const [rules, setRules] = useState<PackagePricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all rules for the current company
  const fetchRules = useCallback(async () => {
    if (!currentCompany) {
      setRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase
        .from("package_pricing_rules") as any)
        .select("*")
        .eq("company_id", currentCompany)
        .order("effective_from", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const rows = (data || []) as DBPackagePricingRule[];
      const mapped = rows.map(mapDBToRule);
      setRules(mapped);
    } catch (err: any) {
      console.error("Error fetching package pricing rules:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  // Initial fetch
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Get effective rule for a given plan, package type, and date
  const getEffectiveRule = useCallback(
    (planId: string, packageType: PackageType, referenceDate: string): PackagePricingRule | null => {
      const applicableRules = rules.filter(
        (r) =>
          r.isActive &&
          r.planId === planId &&
          r.packageType === packageType &&
          r.effectiveFrom <= referenceDate
      );

      if (applicableRules.length === 0) return null;

      // Return the most recent effective rule
      return applicableRules.sort(
        (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
      )[0];
    },
    [rules]
  );

  // Calculate package components from total amount
  const calculateComponents = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string,
      packageQty: number = 1
    ): PackageComponents => {
      const safeTotal = Number(totalAmount) || 0;
      const rule = getEffectiveRule(planId, packageType, referenceDate);

      if (!rule) {
        // No rule: everything goes to matmed
        return {
          consultAmount: 0,
          feeAmount: 0,
          matmedAmount: Math.round(safeTotal * 100) / 100,
          totalAmount: Math.round(safeTotal * 100) / 100,
        };
      }

      const consultAmount = Math.round(rule.consultDefaultAmount * packageQty * 100) / 100;
      const feeAmount = Math.round(rule.feeDefaultAmount * packageQty * 100) / 100;
      const matmedAmount = Math.max(0, Math.round((safeTotal - consultAmount - feeAmount) * 100) / 100);

      return {
        consultAmount,
        feeAmount,
        matmedAmount,
        totalAmount: Math.round((consultAmount + feeAmount + matmedAmount) * 100) / 100,
      };
    },
    [getEffectiveRule]
  );

  // Validate that total is sufficient for fixed components
  const validateTotal = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string,
      packageQty: number = 1
    ): { valid: boolean; message?: string; minRequired?: number } => {
      const rule = getEffectiveRule(planId, packageType, referenceDate);
      if (!rule) return { valid: true };

      const minRequired = (rule.consultDefaultAmount + rule.feeDefaultAmount) * packageQty;
      const safeTotal = Number(totalAmount) || 0;

      if (safeTotal < minRequired) {
        return {
          valid: false,
          message: `Valor mínimo para este pacote: R$ ${minRequired.toFixed(2).replace(".", ",")}`,
          minRequired,
        };
      }

      return { valid: true };
    },
    [getEffectiveRule]
  );

  // Add a new rule
  const addRule = useCallback(
    async (data: {
      planId: string;
      packageType: PackageType;
      consultDefaultAmount: number;
      feeDefaultAmount: number;
      effectiveFrom: string;
      notes?: string;
    }): Promise<PackagePricingRule | null> => {
      if (!currentCompany) {
        toast.error("Empresa não selecionada");
        return null;
      }

      try {
        const insertData = {
          company_id: currentCompany,
          plan_id: data.planId,
          package_type: data.packageType,
          consult_default_amount: data.consultDefaultAmount,
          fee_default_amount: data.feeDefaultAmount,
          effective_from: data.effectiveFrom,
          notes: data.notes || null,
          created_by: user?.id || null,
        };

        const { data: inserted, error: insertError } = await (supabase
          .from("package_pricing_rules") as any)
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        const newRule = mapDBToRule(inserted as unknown as DBPackagePricingRule);
        setRules((prev) => [newRule, ...prev]);
        toast.success("Regra de pacote criada com sucesso");
        return newRule;
      } catch (err: any) {
        console.error("Error adding package pricing rule:", err);
        toast.error("Erro ao criar regra: " + err.message);
        return null;
      }
    },
    [currentCompany, user]
  );

  // Update a rule
  const updateRule = useCallback(
    async (id: string, data: Partial<PackagePricingRule>): Promise<boolean> => {
      try {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (data.consultDefaultAmount !== undefined) {
          updateData.consult_default_amount = data.consultDefaultAmount;
        }
        if (data.feeDefaultAmount !== undefined) {
          updateData.fee_default_amount = data.feeDefaultAmount;
        }
        if (data.effectiveFrom !== undefined) {
          updateData.effective_from = data.effectiveFrom;
        }
        if (data.isActive !== undefined) {
          updateData.is_active = data.isActive;
        }
        if (data.notes !== undefined) {
          updateData.notes = data.notes;
        }

        const { error: updateError } = await (supabase
          .from("package_pricing_rules") as any)
          .update(updateData)
          .eq("id", id);

        if (updateError) {
          throw updateError;
        }

        setRules((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...data,
                  updatedAt: updateData.updated_at,
                }
              : r
          )
        );

        toast.success("Regra atualizada com sucesso");
        return true;
      } catch (err: any) {
        console.error("Error updating package pricing rule:", err);
        toast.error("Erro ao atualizar regra: " + err.message);
        return false;
      }
    },
    []
  );

  // Inactivate a rule
  const inactivateRule = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await updateRule(id, { isActive: false });
      if (result) {
        toast.success("Regra inativada com sucesso");
      }
      return result;
    },
    [updateRule]
  );

  // Derived: active rules grouped by plan
  const activeRulesByPlan = useMemo(() => {
    const grouped: Record<string, PackagePricingRule[]> = {};
    for (const rule of rules) {
      if (rule.isActive) {
        if (!grouped[rule.planId]) {
          grouped[rule.planId] = [];
        }
        grouped[rule.planId].push(rule);
      }
    }
    return grouped;
  }, [rules]);

  // Available plans from active rules
  const availablePlans = useMemo(() => {
    const plans = new Set<string>();
    for (const rule of rules) {
      if (rule.isActive) {
        plans.add(rule.planId);
      }
    }
    return Array.from(plans).sort();
  }, [rules]);

  return {
    rules,
    loading,
    error,
    fetchRules,
    getEffectiveRule,
    calculateComponents,
    validateTotal,
    addRule,
    updateRule,
    inactivateRule,
    activeRulesByPlan,
    availablePlans,
  };
}
