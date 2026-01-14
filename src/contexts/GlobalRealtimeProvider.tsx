/**
 * GlobalRealtimeProvider - Provedor único de sincronização em tempo real
 * 
 * Este provider implementa um listener global para as tabelas críticas:
 * - financial_entries
 * - productions
 * - receivables
 * 
 * Quando qualquer mudança ocorre, notifica TODOS os hooks dependentes
 * para que se atualizem automaticamente, eliminando a necessidade de F5.
 * 
 * IMPORTANTE: Este é o ÚNICO listener global. Não criar duplicados.
 */

import React, { createContext, useContext, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GlobalRealtimeContextType {
  /** Registra um callback para ser chamado quando houver mudanças */
  registerRefetch: (key: string, callback: () => void) => void;
  /** Remove um callback registrado */
  unregisterRefetch: (key: string) => void;
  /** Força atualização de todos os dados */
  refreshAll: () => void;
  /** Timestamp da última atualização */
  lastUpdate: number;
}

const GlobalRealtimeContext = createContext<GlobalRealtimeContextType | undefined>(undefined);

export function GlobalRealtimeProvider({ children }: { children: ReactNode }) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  
  // Mapa de callbacks registrados
  const refetchCallbacks = useRef<Map<string, () => void>>(new Map());
  const lastUpdateRef = useRef<number>(Date.now());
  const [, forceRender] = React.useState({});

  // Registrar callback de refetch
  const registerRefetch = useCallback((key: string, callback: () => void) => {
    refetchCallbacks.current.set(key, callback);
  }, []);

  // Remover callback
  const unregisterRefetch = useCallback((key: string) => {
    refetchCallbacks.current.delete(key);
  }, []);

  // Notificar todos os callbacks
  const notifyAll = useCallback(() => {
    lastUpdateRef.current = Date.now();
    forceRender({});
    
    // Chamar todos os callbacks registrados
    refetchCallbacks.current.forEach((callback, key) => {
      try {
        callback();
      } catch (error) {
        console.error(`[GlobalRealtime] Erro ao executar refetch para ${key}:`, error);
      }
    });
  }, []);

  // Função para forçar refresh de todos os dados
  const refreshAll = useCallback(() => {
    console.log("[GlobalRealtime] Forçando refresh de todos os dados...");
    notifyAll();
  }, [notifyAll]);

  // Listener global único para todas as tabelas críticas
  useEffect(() => {
    if (!companyId) return;

    console.log("[GlobalRealtime] Iniciando listener global para company:", companyId);

    const channel = supabase
      .channel("global-financial-realtime")
      // financial_entries - Movimentações financeiras
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_entries",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log("[GlobalRealtime] financial_entries alterado:", payload.eventType);
          notifyAll();
        }
      )
      // productions - Produções
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productions",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log("[GlobalRealtime] productions alterado:", payload.eventType);
          notifyAll();
        }
      )
      // receivables - Recebíveis/Faturamento
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receivables",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log("[GlobalRealtime] receivables alterado:", payload.eventType);
          notifyAll();
        }
      )
      .subscribe((status) => {
        console.log("[GlobalRealtime] Status do canal:", status);
      });

    return () => {
      console.log("[GlobalRealtime] Removendo canal global");
      supabase.removeChannel(channel);
    };
  }, [companyId, notifyAll]);

  // Auto-refresh quando aba ganha foco (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && companyId) {
        console.log("[GlobalRealtime] Aba ganhou foco, atualizando dados...");
        // Pequeno delay para evitar conflitos
        setTimeout(() => {
          notifyAll();
        }, 100);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [companyId, notifyAll]);

  // Polling leve como fallback (30s), só quando aba visível
  useEffect(() => {
    if (!companyId) return;

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        console.log("[GlobalRealtime] Polling fallback...");
        notifyAll();
      }
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [companyId, notifyAll]);

  return (
    <GlobalRealtimeContext.Provider
      value={{
        registerRefetch,
        unregisterRefetch,
        refreshAll,
        lastUpdate: lastUpdateRef.current,
      }}
    >
      {children}
    </GlobalRealtimeContext.Provider>
  );
}

/**
 * Hook para acessar o contexto de realtime global
 */
export function useGlobalRealtime() {
  const context = useContext(GlobalRealtimeContext);
  if (context === undefined) {
    throw new Error("useGlobalRealtime must be used within a GlobalRealtimeProvider");
  }
  return context;
}

/**
 * Hook para registrar um callback de refetch que será chamado
 * automaticamente quando houver mudanças em qualquer tabela crítica
 */
export function useRealtimeRefetch(key: string, refetchFn: () => void) {
  const { registerRefetch, unregisterRefetch } = useGlobalRealtime();

  useEffect(() => {
    registerRefetch(key, refetchFn);
    return () => {
      unregisterRefetch(key);
    };
  }, [key, refetchFn, registerRefetch, unregisterRefetch]);
}
