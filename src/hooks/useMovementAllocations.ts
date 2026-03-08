import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UnitApportionment, ApportionmentCriteria } from "@/types";

/**
 * Hook stub para movement_allocations
 * A tabela movement_allocations não existe no banco atual.
 * Este hook retorna operações no-op para evitar erros de build.
 * Implementação completa requer migration para criar a tabela.
 */
export function useMovementAllocations() {
  const { currentCompany } = useAuth();

  // Fetch allocations - retorna array vazio (tabela não existe)
  const fetchAllocations = useCallback(
    async (movementId: string): Promise<UnitApportionment[]> => {
      if (!currentCompany?.id) return [];
      // Tabela movement_allocations não existe - retornar vazio
      return [];
    },
    [currentCompany?.id]
  );

  // Save allocations - no-op
  const saveAllocations = useCallback(
    async (
      movementId: string,
      apportionments: UnitApportionment[],
      criterion: ApportionmentCriteria
    ): Promise<boolean> => {
      
      return true; // Retorna sucesso para não bloquear fluxo
    },
    []
  );

  // Delete allocations - no-op
  const deleteAllocations = useCallback(
    async (movementId: string): Promise<boolean> => {
      console.warn("useMovementAllocations: deleteAllocations não disponível (tabela não existe)");
      return true;
    },
    []
  );

  // Get allocations by unit - retorna objeto vazio
  const getAllocationsByUnit = useCallback(
    async (
      startDate?: string,
      endDate?: string
    ): Promise<Record<string, number>> => {
      console.warn("useMovementAllocations: getAllocationsByUnit não disponível (tabela não existe)");
      return {};
    },
    []
  );

  return {
    fetchAllocations,
    saveAllocations,
    deleteAllocations,
    getAllocationsByUnit,
  };
}
