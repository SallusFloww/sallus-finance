import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

function toPackagePricingRule(db: DBPackagePricingRule): PackagePricingRule {
  return {
    id: db.id,
    companyId: db.company_id,
    planId: db.plan_id,
    packageType: db.package_type as PackageType,
    consultDefaultAmount: Number(db.consult_default_amount),
    feeDefaultAmount: Number(db.fee_default_amount),
    effectiveFrom: db.effective_from,
    isActive: db.is_active,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    createdBy: db.created_by,
    notes: db.notes,
  };
}

export interface PackageComponents {
  consultAmount: number;
  feeAmount: number;
  matmedAmount: number;
  totalAmount: number;
}

export function usePackagePricing() {
  const { currentCompany, profile } = useAuth();
  const [rules, setRules] = useState<PackagePricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all rules
  const fetchRules = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("package_pricing_rules")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("plan_id", { ascending: true })
        .order("package_type", { ascending: true })
        .order("effective_from", { ascending: false });

      if (fetchError) throw fetchError;

      setRules((data || []).map((d) => toPackagePricingRule(d as DBPackagePricingRule)));
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar regras de pacote:", err);
      setError("Erro ao carregar regras de pacote");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Get effective rule for a specific plan, package type, and date
  const getEffectiveRule = useCallback(
    (planId: string, packageType: PackageType, referenceDate: string): PackagePricingRule | null => {
      const refDate = new Date(referenceDate);
      
      const matchingRules = rules
        .filter(
          (r) =>
            r.planId === planId &&
            r.packageType === packageType &&
            r.isActive &&
            new Date(r.effectiveFrom) <= refDate
        )
        .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

      return matchingRules[0] || null;
    },
    [rules]
  );

  // Calculate package components from total
  const calculateComponents = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string
    ): PackageComponents => {
      const rule = getEffectiveRule(planId, packageType, referenceDate);

      if (!rule) {
        // Se não há regra, tudo vai para Mat/Med
        return {
          consultAmount: 0,
          feeAmount: 0,
          matmedAmount: totalAmount,
          totalAmount,
        };
      }

      const consultAmount = rule.consultDefaultAmount;
      const feeAmount = rule.feeDefaultAmount;
      let matmedAmount = totalAmount - consultAmount - feeAmount;

      // Arredondar para 2 casas decimais
      matmedAmount = Math.round(matmedAmount * 100) / 100;

      // Se Mat/Med ficou negativo, há problema
      if (matmedAmount < 0) {
        matmedAmount = 0;
      }

      return {
        consultAmount,
        feeAmount,
        matmedAmount,
        totalAmount,
      };
    },
    [getEffectiveRule]
  );

  // Validate if total is sufficient
  const validateTotal = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string
    ): { valid: boolean; message?: string; minRequired?: number } => {
      const rule = getEffectiveRule(planId, packageType, referenceDate);

      if (!rule) {
        return { valid: true }; // Sem regra, qualquer valor é válido
      }

      const minRequired = rule.consultDefaultAmount + rule.feeDefaultAmount;

      if (totalAmount < minRequired) {
        return {
          valid: false,
          message: `Total menor que Consulta + Taxa do pacote. Mínimo: R$ ${minRequired.toFixed(2)}`,
          minRequired,
        };
      }

      return { valid: true };
    },
    [getEffectiveRule]
  );

  // Add new rule
  const addRule = useCallback(
    async (data: {
      planId: string;
      packageType: PackageType;
      consultDefaultAmount: number;
      feeDefaultAmount: number;
      effectiveFrom: string;
      notes?: string;
    }): Promise<PackagePricingRule | null> => {
      if (!currentCompany?.id || !profile?.id) {
        toast.error("Usuário não autenticado");
        return null;
      }

      try {
        const { data: inserted, error: insertError } = await supabase
          .from("package_pricing_rules")
          .insert([
            {
              company_id: currentCompany.id,
              plan_id: data.planId,
              package_type: data.packageType,
              consult_default_amount: data.consultDefaultAmount,
              fee_default_amount: data.feeDefaultAmount,
              effective_from: data.effectiveFrom,
              is_active: true,
              created_by: profile.id,
              notes: data.notes || null,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchRules();
        toast.success("Regra de pacote criada com sucesso");
        return toPackagePricingRule(inserted as DBPackagePricingRule);
      } catch (err) {
        console.error("Erro ao criar regra:", err);
        toast.error("Erro ao criar regra de pacote");
        return null;
      }
    },
    [currentCompany?.id, profile?.id, fetchRules]
  );

  // Update rule (mainly for inactivating)
  const updateRule = useCallback(
    async (id: string, data: Partial<PackagePricingRule>): Promise<boolean> => {
      if (!currentCompany?.id) {
        toast.error("Empresa não selecionada");
        return false;
      }

      try {
        const updateData: Record<string, unknown> = {};
        
        if (data.consultDefaultAmount !== undefined) {
          updateData.consult_default_amount = data.consultDefaultAmount;
        }
        if (data.feeDefaultAmount !== undefined) {
          updateData.fee_default_amount = data.feeDefaultAmount;
        }
        if (data.isActive !== undefined) {
          updateData.is_active = data.isActive;
        }
        if (data.notes !== undefined) {
          updateData.notes = data.notes;
        }

        const { error: updateError } = await supabase
          .from("package_pricing_rules")
          .update(updateData)
          .eq("id", id)
          .eq("company_id", currentCompany.id);

        if (updateError) throw updateError;

        await fetchRules();
        toast.success("Regra atualizada");
        return true;
      } catch (err) {
        console.error("Erro ao atualizar regra:", err);
        toast.error("Erro ao atualizar regra");
        return false;
      }
    },
    [currentCompany?.id, fetchRules]
  );

  // Inactivate rule (soft-delete)
  const inactivateRule = useCallback(
    async (id: string): Promise<boolean> => {
      return updateRule(id, { isActive: false });
    },
    [updateRule]
  );

  // Derived: active rules grouped by plan
  const activeRulesByPlan = useMemo(() => {
    const grouped: Record<string, PackagePricingRule[]> = {};
    
    rules
      .filter((r) => r.isActive)
      .forEach((rule) => {
        if (!grouped[rule.planId]) {
          grouped[rule.planId] = [];
        }
        grouped[rule.planId].push(rule);
      });

    return grouped;
  }, [rules]);

  // Available plans (distinct from rules)
  const availablePlans = useMemo(() => {
    return [...new Set(rules.map((r) => r.planId))].sort();
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
