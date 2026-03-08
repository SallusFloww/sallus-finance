/**
 * GlobalRealtimeProvider - Provedor único de sincronização em tempo real
 * 
 * Utiliza abordagem de VERSIONAMENTO:
 * - Quando qualquer mudança ocorre, incrementa uma versão global
 * - Os hooks observam essa versão e decidem quando refetch
 * 
 * IMPORTANTE: Este é o ÚNICO listener global. Não criar duplicados.
 */

import React, { createContext, useContext, useEffect, useCallback, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GlobalRealtimeContextType {
  refreshAll: () => void;
  lastUpdate: number;
  version: number;
}

const GlobalRealtimeContext = createContext<GlobalRealtimeContextType | undefined>(undefined);

export function GlobalRealtimeProvider({ children }: { children: ReactNode }) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  
  const [version, setVersion] = useState(0);
  const lastUpdateRef = useRef<number>(Date.now());

  const notifyAll = useCallback(() => {
    lastUpdateRef.current = Date.now();
    setVersion(v => v + 1);
  }, []);

  const refreshAll = useCallback(() => {
    if (import.meta.env.DEV) console.log("[GlobalRealtime] Forçando refresh global...");
    notifyAll();
  }, [notifyAll]);

  // Listener global único para todas as tabelas críticas
  useEffect(() => {
    if (!companyId) return;

    if (import.meta.env.DEV) console.log("[GlobalRealtime] Iniciando listener para company:", companyId);

    const channel = supabase
      .channel("global-financial-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_entries", filter: `company_id=eq.${companyId}` }, () => notifyAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "productions", filter: `company_id=eq.${companyId}` }, () => notifyAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "receivables", filter: `company_id=eq.${companyId}` }, () => notifyAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "company_financial_settings", filter: `company_id=eq.${companyId}` }, () => notifyAll())
      .subscribe((status) => {
        if (import.meta.env.DEV) console.log("[GlobalRealtime] Status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, notifyAll]);

  // Auto-refresh quando aba ganha foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && companyId) {
        setTimeout(() => notifyAll(), 100);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [companyId, notifyAll]);

  // Polling de 30s REMOVIDO — realtime + visibilitychange são suficientes

  return (
    <GlobalRealtimeContext.Provider value={{ refreshAll, lastUpdate: lastUpdateRef.current, version }}>
      {children}
    </GlobalRealtimeContext.Provider>
  );
}

export function useGlobalRealtime(): GlobalRealtimeContextType {
  const context = useContext(GlobalRealtimeContext);
  if (context === undefined) {
    return { refreshAll: () => {}, lastUpdate: Date.now(), version: 0 };
  }
  return context;
}
