import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

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

/**
 * Hook stub para package_pricing_rules
 * A tabela package_pricing_rules não existe no banco atual.
 * Este hook retorna operações no-op para evitar erros de build.
 * Implementação completa requer migration para criar a tabela.
 */
export function usePackagePricing() {
  const { currentCompany } = useAuth();
  const [rules] = useState<PackagePricingRule[]>([]);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // Fetch all rules - no-op
  const fetchRules = useCallback(async () => {
    console.warn("usePackagePricing: tabela package_pricing_rules não existe ainda");
  }, []);

  // Get effective rule - retorna null
  const getEffectiveRule = useCallback(
    (planId: string, packageType: PackageType, referenceDate: string): PackagePricingRule | null => {
      return null;
    },
    []
  );

  // Calculate package components - tudo vai para Mat/Med
  const calculateComponents = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string,
      packageQty: number = 1
    ): PackageComponents => {
      const safeTotal = Number(totalAmount) || 0;
      return {
        consultAmount: 0,
        feeAmount: 0,
        matmedAmount: Math.round(safeTotal * 100) / 100,
        totalAmount: Math.round(safeTotal * 100) / 100,
      };
    },
    []
  );

  // Validate total - sempre válido
  const validateTotal = useCallback(
    (
      totalAmount: number,
      planId: string,
      packageType: PackageType,
      referenceDate: string,
      packageQty: number = 1
    ): { valid: boolean; message?: string; minRequired?: number } => {
      return { valid: true };
    },
    []
  );

  // Add rule - no-op
  const addRule = useCallback(
    async (data: {
      planId: string;
      packageType: PackageType;
      consultDefaultAmount: number;
      feeDefaultAmount: number;
      effectiveFrom: string;
      notes?: string;
    }): Promise<PackagePricingRule | null> => {
      console.warn("usePackagePricing: addRule não disponível (tabela não existe)");
      return null;
    },
    []
  );

  // Update rule - no-op
  const updateRule = useCallback(
    async (id: string, data: Partial<PackagePricingRule>): Promise<boolean> => {
      console.warn("usePackagePricing: updateRule não disponível (tabela não existe)");
      return false;
    },
    []
  );

  // Inactivate rule - no-op
  const inactivateRule = useCallback(
    async (id: string): Promise<boolean> => {
      return updateRule(id, { isActive: false });
    },
    [updateRule]
  );

  // Derived: active rules grouped by plan
  const activeRulesByPlan = useMemo(() => {
    return {} as Record<string, PackagePricingRule[]>;
  }, []);

  // Available plans
  const availablePlans = useMemo(() => {
    return [] as string[];
  }, []);

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
