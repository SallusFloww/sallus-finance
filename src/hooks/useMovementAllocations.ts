import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UnitApportionment, ApportionmentCriteria } from "@/types";
import { toast } from "sonner";

interface MovementAllocation {
  id: string;
  company_id: string;
  movement_id: string;
  unit_id: string;
  unit_name: string;
  allocation_percent: number;
  allocation_amount: number;
  criterion: string;
  criterion_value: number;
  created_at: string;
  updated_at: string;
}

interface AllocationInsert {
  movement_id: string;
  unit_id: string;
  unit_name: string;
  allocation_percent: number;
  allocation_amount: number;
  criterion: string;
  criterion_value?: number;
}

export function useMovementAllocations() {
  const { user, currentCompany } = useAuth();
  const currentCompanyId = currentCompany?.id;

  // Fetch allocations for a specific movement
  const fetchAllocations = useCallback(
    async (movementId: string): Promise<UnitApportionment[]> => {
      if (!currentCompanyId) return [];

      try {
        const { data, error } = await supabase
          .from("movement_allocations")
          .select("*")
          .eq("movement_id", movementId)
          .eq("company_id", currentCompanyId);

        if (error) throw error;

        return (data || []).map((a: MovementAllocation) => ({
          unitId: a.unit_id,
          unitName: a.unit_name,
          criterionValue: a.allocation_percent,
          apportionedAmount: a.allocation_amount,
        }));
      } catch (err) {
        console.error("Error fetching allocations:", err);
        return [];
      }
    },
    [currentCompanyId]
  );

  // Save allocations for a movement (replaces existing)
  // Note: movement_allocations is an auxiliary table, physical delete is acceptable
  // The parent financial_entry is protected by anti-delete triggers
  const saveAllocations = useCallback(
    async (
      movementId: string,
      apportionments: UnitApportionment[],
      criterion: ApportionmentCriteria
    ): Promise<boolean> => {
      if (!currentCompanyId || !user) {
        console.error("No company or user");
        return false;
      }

      try {
        // Delete existing allocations first (safe - this is auxiliary data)
        const { error: deleteError } = await supabase
          .from("movement_allocations")
          .delete()
          .eq("movement_id", movementId)
          .eq("company_id", currentCompanyId);

        if (deleteError) throw deleteError;

        // If no apportionments, we're done
        if (apportionments.length === 0) {
          return true;
        }

        // Insert new allocations
        const inserts = apportionments.map((a) => ({
          company_id: currentCompanyId,
          movement_id: movementId,
          unit_id: a.unitId,
          unit_name: a.unitName,
          allocation_percent: a.criterionValue,
          allocation_amount: a.apportionedAmount,
          criterion: criterion,
          criterion_value: a.criterionValue,
        }));

        const { error: insertError } = await supabase
          .from("movement_allocations")
          .insert(inserts);

        if (insertError) throw insertError;

        return true;
      } catch (err: any) {
        console.error("Error saving allocations:", err);
        if (err.message?.includes("row-level security")) {
          toast.error("Você não tem permissão para salvar o rateio");
        }
        return false;
      }
    },
    [currentCompanyId, user]
  );

  // Delete allocations for a movement
  // Note: This is auxiliary data, physical delete is acceptable here
  const deleteAllocations = useCallback(
    async (movementId: string): Promise<boolean> => {
      if (!currentCompanyId) return false;

      try {
        const { error } = await supabase
          .from("movement_allocations")
          .delete()
          .eq("movement_id", movementId)
          .eq("company_id", currentCompanyId);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Error deleting allocations:", err);
        return false;
      }
    },
    [currentCompanyId]
  );

  // Get allocations summary for reports (by unit)
  const getAllocationsByUnit = useCallback(
    async (
      startDate?: string,
      endDate?: string
    ): Promise<Record<string, number>> => {
      if (!currentCompanyId) return {};

      try {
        let query = supabase
          .from("movement_allocations")
          .select("unit_id, allocation_amount")
          .eq("company_id", currentCompanyId);

        // Note: We'll need to join with financial_entries to filter by date
        // For now, return all allocations
        const { data, error } = await query;

        if (error) throw error;

        const result: Record<string, number> = {};
        (data || []).forEach((a: any) => {
          result[a.unit_id] = (result[a.unit_id] || 0) + Number(a.allocation_amount);
        });

        return result;
      } catch (err) {
        console.error("Error fetching allocations by unit:", err);
        return {};
      }
    },
    [currentCompanyId]
  );

  return {
    fetchAllocations,
    saveAllocations,
    deleteAllocations,
    getAllocationsByUnit,
  };
}
