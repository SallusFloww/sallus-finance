/**
 * GlobalRealtimeProvider - Provedor único de sincronização em tempo real
 * 
 * Este provider implementa um listener global para as tabelas críticas:
 * - financial_entries
 * - productions
 * - receivables
 * 
 * Utiliza abordagem de VERSIONAMENTO:
 * - Quando qualquer mudança ocorre, incrementa uma versão global
 * - Os hooks observam essa versão e decidem quando refetch
 * - Elimina race conditions e garante sincronização determinística
 * 
 * IMPORTANTE: Este é o ÚNICO listener global. Não criar duplicados.
 */

import React, { createContext, useContext, useEffect, useCallback, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GlobalRealtimeContextType {
  /** Força atualização de todos os dados */
  refreshAll: () => void;
  /** Timestamp da última atualização */
  lastUpdate: number;
  /** Versão global - incrementa a cada mudança detectada */
  version: number;
}

const GlobalRealtimeContext = createContext<GlobalRealtimeContextType | undefined>(undefined);

export function GlobalRealtimeProvider({ children }: { children: ReactNode }) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  
  // Versão global - incrementa a cada mudança detectada
  const [version, setVersion] = useState(0);
  const lastUpdateRef = useRef<number>(Date.now());

  // Notificar mudança - apenas incrementa a versão
  const notifyAll = useCallback(() => {
    lastUpdateRef.current = Date.now();
    setVersion(v => v + 1);
  }, []);

  // Função para forçar refresh de todos os dados
  const refreshAll = useCallback(() => {
    console.log("[GlobalRealtime] Forçando refresh global...");
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
        console.log("[GlobalRealtime] Aba ganhou foco, sinalizando atualização...");
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
        refreshAll,
        lastUpdate: lastUpdateRef.current,
        version,
      }}
    >
      {children}
    </GlobalRealtimeContext.Provider>
  );
}

/**
 * Hook para acessar o contexto de realtime global
 * Retorna valores padrão seguros se estiver fora do Provider
 */
export function useGlobalRealtime(): GlobalRealtimeContextType {
  const context = useContext(GlobalRealtimeContext);
  // Retorna valores padrão seguros se estiver fora do Provider
  if (context === undefined) {
    return {
      refreshAll: () => {},
      lastUpdate: Date.now(),
      version: 0,
    };
  }
  return context;
}
