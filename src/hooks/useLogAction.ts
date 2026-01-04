import { useCallback } from "react";
import { useAuditLogDB, AuditAction } from "./useAuditLogDB";
import type { Json } from "@/integrations/supabase/types";

// Types for compatibility
export type AuditModule = 
  | "CAIXA"
  | "MOVIMENTACOES"
  | "PRODUCAO"
  | "FATURAMENTO_SUGERIDO"
  | "FATURAMENTO_RECEBER"
  | "CONFIGURACOES"
  | "IMPORTACAO"
  | "SISTEMA";

export type AuditActionType =
  | "CRIAR_MOVIMENTACAO"
  | "EDITAR_MOVIMENTACAO"
  | "CANCELAR_MOVIMENTACAO"
  | "CONFIRMAR_MOVIMENTACAO"
  | "CRIAR_FATURAMENTO"
  | "EDITAR_FATURAMENTO"
  | "MARCAR_RECEBIDO"
  | "APLICAR_GLOSA_PARCIAL"
  | "APLICAR_GLOSA_TOTAL"
  | "INICIAR_RECURSO"
  | "DEFERIR_RECURSO"
  | "INDEFERIR_RECURSO"
  | "CRIAR_PRODUCAO"
  | "EDITAR_PRODUCAO"
  | "EXCLUIR_PRODUCAO"
  | "VINCULAR_FATURAMENTO"
  | "FATURAR_TUDO"
  | "CRIAR_UNIDADE"
  | "EDITAR_UNIDADE"
  | "INATIVAR_UNIDADE"
  | "CRIAR_CATEGORIA"
  | "EDITAR_CATEGORIA"
  | "INATIVAR_CATEGORIA"
  | "CRIAR_PAGADOR"
  | "EDITAR_PAGADOR"
  | "INATIVAR_PAGADOR"
  | "CRIAR_TIPO_PRODUCAO"
  | "EDITAR_TIPO_PRODUCAO"
  | "INATIVAR_TIPO_PRODUCAO"
  | "CRIAR_TIPO_EXAME"
  | "EDITAR_TIPO_EXAME"
  | "INATIVAR_TIPO_EXAME"
  | "AJUSTAR_SALDO_INICIAL"
  | "ATUALIZAR_PARAMETROS"
  | "LOGIN"
  | "LOGOUT"
  | "IMPORTAR_DADOS"
  | "EXPORTAR_DADOS";

// Map legacy action types to new DB action types
const mapActionToDBAction = (action: AuditActionType): AuditAction => {
  const mapping: Record<AuditActionType, AuditAction> = {
    CRIAR_MOVIMENTACAO: "CREATE_TRANSACTION",
    EDITAR_MOVIMENTACAO: "UPDATE_TRANSACTION",
    CANCELAR_MOVIMENTACAO: "DELETE_TRANSACTION",
    CONFIRMAR_MOVIMENTACAO: "UPDATE_TRANSACTION",
    CRIAR_FATURAMENTO: "CREATE_BILLING",
    EDITAR_FATURAMENTO: "UPDATE_BILLING",
    MARCAR_RECEBIDO: "RECEIVE_BILLING",
    APLICAR_GLOSA_PARCIAL: "APPLY_GLOSS",
    APLICAR_GLOSA_TOTAL: "APPLY_GLOSS",
    INICIAR_RECURSO: "UPDATE_BILLING",
    DEFERIR_RECURSO: "UPDATE_BILLING",
    INDEFERIR_RECURSO: "UPDATE_BILLING",
    CRIAR_PRODUCAO: "CREATE_PRODUCTION",
    EDITAR_PRODUCAO: "UPDATE_PRODUCTION",
    EXCLUIR_PRODUCAO: "DELETE_PRODUCTION",
    VINCULAR_FATURAMENTO: "UPDATE_PRODUCTION",
    FATURAR_TUDO: "CREATE_BILLING",
    CRIAR_UNIDADE: "UPDATE_SETTINGS",
    EDITAR_UNIDADE: "UPDATE_SETTINGS",
    INATIVAR_UNIDADE: "UPDATE_SETTINGS",
    CRIAR_CATEGORIA: "UPDATE_SETTINGS",
    EDITAR_CATEGORIA: "UPDATE_SETTINGS",
    INATIVAR_CATEGORIA: "UPDATE_SETTINGS",
    CRIAR_PAGADOR: "UPDATE_SETTINGS",
    EDITAR_PAGADOR: "UPDATE_SETTINGS",
    INATIVAR_PAGADOR: "UPDATE_SETTINGS",
    CRIAR_TIPO_PRODUCAO: "UPDATE_SETTINGS",
    EDITAR_TIPO_PRODUCAO: "UPDATE_SETTINGS",
    INATIVAR_TIPO_PRODUCAO: "UPDATE_SETTINGS",
    CRIAR_TIPO_EXAME: "UPDATE_SETTINGS",
    EDITAR_TIPO_EXAME: "UPDATE_SETTINGS",
    INATIVAR_TIPO_EXAME: "UPDATE_SETTINGS",
    AJUSTAR_SALDO_INICIAL: "UPDATE_SETTINGS",
    ATUALIZAR_PARAMETROS: "UPDATE_SETTINGS",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    IMPORTAR_DADOS: "UPDATE_SETTINGS",
    EXPORTAR_DADOS: "EXPORT_EXCEL",
  };
  return mapping[action] || "UPDATE_SETTINGS";
};

export interface LogParams {
  userId: string;
  userName: string;
  module: AuditModule;
  action: AuditActionType;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  amount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Helper hook para registrar logs de auditoria
 * Simplifica a integração de logs em outros hooks
 */
export function useLogAction(userName: string = "Sistema") {
  const { logAction: dbLogAction } = useAuditLogDB();

  const logAction = useCallback((params: Omit<LogParams, "userId" | "userName">) => {
    const dbAction = mapActionToDBAction(params.action);
    const details: Json = {
      legacyAction: params.action,
      description: params.description,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      entityName: params.entityName || null,
      amount: params.amount || null,
      previousState: params.previousState ? JSON.stringify(params.previousState) : null,
      newState: params.newState ? JSON.stringify(params.newState) : null,
      ...(params.metadata ? Object.fromEntries(
        Object.entries(params.metadata).map(([k, v]) => [k, v === undefined ? null : v])
      ) : {}),
    };
    
    return dbLogAction({
      action: dbAction,
      module: params.module,
      details,
    });
  }, [dbLogAction]);

  const logMovimentacao = useCallback((
    action: Extract<AuditActionType, "CRIAR_MOVIMENTACAO" | "EDITAR_MOVIMENTACAO" | "CANCELAR_MOVIMENTACAO" | "CONFIRMAR_MOVIMENTACAO">,
    description: string,
    entityId?: string,
    entityName?: string,
    amount?: number,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>
  ) => {
    return logAction({
      module: "MOVIMENTACOES",
      action,
      description,
      entityType: "transaction",
      entityId,
      entityName,
      amount,
      previousState,
      newState,
    });
  }, [logAction]);

  const logFaturamento = useCallback((
    action: Extract<AuditActionType, 
      | "CRIAR_FATURAMENTO" 
      | "EDITAR_FATURAMENTO" 
      | "MARCAR_RECEBIDO" 
      | "APLICAR_GLOSA_PARCIAL" 
      | "APLICAR_GLOSA_TOTAL" 
      | "INICIAR_RECURSO" 
      | "DEFERIR_RECURSO" 
      | "INDEFERIR_RECURSO"
    >,
    description: string,
    entityId?: string,
    entityName?: string,
    amount?: number,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>
  ) => {
    return logAction({
      module: "FATURAMENTO_RECEBER",
      action,
      description,
      entityType: "receivable",
      entityId,
      entityName,
      amount,
      previousState,
      newState,
    });
  }, [logAction]);

  const logProducao = useCallback((
    action: Extract<AuditActionType, 
      | "CRIAR_PRODUCAO" 
      | "EDITAR_PRODUCAO" 
      | "EXCLUIR_PRODUCAO" 
      | "VINCULAR_FATURAMENTO" 
      | "FATURAR_TUDO"
    >,
    description: string,
    entityId?: string,
    entityName?: string,
    amount?: number,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>
  ) => {
    return logAction({
      module: "PRODUCAO",
      action,
      description,
      entityType: "production",
      entityId,
      entityName,
      amount,
      previousState,
      newState,
    });
  }, [logAction]);

  const logConfiguracao = useCallback((
    action: Extract<AuditActionType, 
      | "CRIAR_UNIDADE" 
      | "EDITAR_UNIDADE" 
      | "INATIVAR_UNIDADE" 
      | "CRIAR_CATEGORIA" 
      | "EDITAR_CATEGORIA" 
      | "INATIVAR_CATEGORIA" 
      | "CRIAR_PAGADOR" 
      | "EDITAR_PAGADOR" 
      | "INATIVAR_PAGADOR" 
      | "CRIAR_TIPO_PRODUCAO" 
      | "EDITAR_TIPO_PRODUCAO" 
      | "INATIVAR_TIPO_PRODUCAO" 
      | "CRIAR_TIPO_EXAME" 
      | "EDITAR_TIPO_EXAME" 
      | "INATIVAR_TIPO_EXAME" 
      | "AJUSTAR_SALDO_INICIAL" 
      | "ATUALIZAR_PARAMETROS"
    >,
    description: string,
    entityId?: string,
    entityName?: string,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>
  ) => {
    return logAction({
      module: "CONFIGURACOES",
      action,
      description,
      entityType: "config",
      entityId,
      entityName,
      previousState,
      newState,
    });
  }, [logAction]);

  const logSistema = useCallback((
    action: Extract<AuditActionType, "LOGIN" | "LOGOUT" | "IMPORTAR_DADOS" | "EXPORTAR_DADOS">,
    description: string,
    metadata?: Record<string, unknown>
  ) => {
    return logAction({
      module: "SISTEMA",
      action,
      description,
      metadata,
    });
  }, [logAction]);

  return {
    logAction,
    logMovimentacao,
    logFaturamento,
    logProducao,
    logConfiguracao,
    logSistema,
  };
}
