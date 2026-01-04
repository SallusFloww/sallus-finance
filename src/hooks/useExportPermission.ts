import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canExport } from "@/utils/exportUtils";

export type ExportType = "all" | "reports" | "data";

/**
 * Hook to check export permissions based on user role
 * Admin → exporta tudo
 * Gestor → exporta relatórios
 * Leitor → sem exportação
 */
export function useExportPermission() {
  const { currentRole, isAdmin } = useAuth();

  const roleName = useMemo(() => {
    return currentRole?.name || "Leitor";
  }, [currentRole]);

  const canExportAll = useMemo(() => {
    return isAdmin() || roleName.toLowerCase() === "admin";
  }, [isAdmin, roleName]);

  const canExportReports = useMemo(() => {
    const role = roleName.toLowerCase();
    return role === "admin" || role === "gestor";
  }, [roleName]);

  const canExportData = useMemo(() => {
    const role = roleName.toLowerCase();
    return role === "admin" || role === "gestor";
  }, [roleName]);

  const checkExportPermission = useCallback(
    (exportType: ExportType): boolean => {
      return canExport(roleName, exportType);
    },
    [roleName]
  );

  return {
    roleName,
    canExportAll,
    canExportReports,
    canExportData,
    checkExportPermission,
  };
}
