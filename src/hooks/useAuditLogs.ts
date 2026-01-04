import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay } from "date-fns";

export interface AuditLog {
  id: string;
  user_id: string | null;
  company_id: string | null;
  action: string;
  module: string | null;
  details: Record<string, unknown> | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface AuditFilters {
  search?: string;
  userId?: string;
  module?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditStats {
  totalLogs: number;
  logsToday: number;
  criticalActions: number;
  financialActions: number;
  systemActions: number;
}

// Actions considered critical
const CRITICAL_ACTIONS = [
  "DELETE_TRANSACTION",
  "DELETE_PRODUCTION",
  "UPDATE_SETTINGS",
  "ERROR_CRITICAL",
];

// Actions considered financial
const FINANCIAL_ACTIONS = [
  "CREATE_TRANSACTION",
  "UPDATE_TRANSACTION",
  "DELETE_TRANSACTION",
  "CREATE_BILLING",
  "UPDATE_BILLING",
  "RECEIVE_BILLING",
  "APPLY_GLOSS",
  "EXPORT_EXCEL",
  "EXPORT_PDF",
];

export function useAuditLogs(filters: AuditFilters = {}) {
  const { currentCompany } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalLogs: 0,
    logsToday: 0,
    criticalActions: 0,
    financialActions: 0,
    systemActions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!currentCompany?.id) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false })
        .limit(500);

      // Apply date filters
      if (filters.startDate) {
        query = query.gte("created_at", startOfDay(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        query = query.lte("created_at", endOfDay(filters.endDate).toISOString());
      }

      // Apply user filter
      if (filters.userId && filters.userId !== "all") {
        query = query.eq("user_id", filters.userId);
      }

      // Apply module filter
      if (filters.module && filters.module !== "all") {
        query = query.eq("module", filters.module);
      }

      // Apply action filter
      if (filters.action && filters.action !== "all") {
        query = query.eq("action", filters.action);
      }

      const { data: logsData, error: logsError } = await query;

      if (logsError) {
        throw logsError;
      }

      // Get unique user IDs
      const userIds = [...new Set((logsData || []).map(log => log.user_id).filter(Boolean))];

      // Fetch user profiles
      let profilesMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = {
              name: profile.full_name || profile.email,
              email: profile.email,
            };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      // Enrich logs with user info
      const enrichedLogs: AuditLog[] = (logsData || []).map(log => ({
        ...log,
        details: log.details as Record<string, unknown> | null,
        user_name: log.user_id ? profilesMap[log.user_id]?.name || "Usuário desconhecido" : "Sistema",
        user_email: log.user_id ? profilesMap[log.user_id]?.email : undefined,
      }));

      // Apply search filter (client-side for flexibility)
      let filteredLogs = enrichedLogs;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredLogs = enrichedLogs.filter(log =>
          log.action.toLowerCase().includes(searchLower) ||
          log.module?.toLowerCase().includes(searchLower) ||
          log.user_name?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.details || {}).toLowerCase().includes(searchLower)
        );
      }

      setLogs(filteredLogs);

      // Calculate stats
      const today = startOfDay(new Date());
      const statsData: AuditStats = {
        totalLogs: filteredLogs.length,
        logsToday: filteredLogs.filter(log => new Date(log.created_at) >= today).length,
        criticalActions: filteredLogs.filter(log => CRITICAL_ACTIONS.includes(log.action)).length,
        financialActions: filteredLogs.filter(log => FINANCIAL_ACTIONS.includes(log.action)).length,
        systemActions: filteredLogs.filter(log => log.module === "SISTEMA").length,
      };
      setStats(statsData);

      // Update unique users list
      const uniqueUsers = Object.entries(profilesMap).map(([id, data]) => ({
        id,
        name: data.name,
        email: data.email,
      }));
      setUsers(uniqueUsers);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id, filters.startDate, filters.endDate, filters.userId, filters.module, filters.action, filters.search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    users,
    stats,
    isLoading,
    error,
    refetch: fetchLogs,
  };
}
