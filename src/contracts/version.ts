// ============================================
// VERSÃO DO PRODUTO - FEATURE FREEZE
// Release freeze: only bugfixes allowed
// Qualquer mudança que altere métrica/layout exige incremento de versão
// ============================================

/**
 * Versão atual do produto
 * Incrementar apenas em casos de:
 * - 1.0.x: Correções de bugs
 * - 1.x.0: Melhorias menores (sem novas features)
 * - x.0.0: Mudanças significativas (não permitido durante freeze)
 */
export const APP_VERSION = "1.0.0";

/**
 * Modo de release
 * - "production": Congelado, apenas bugfixes
 * - "development": Em desenvolvimento ativo
 */
export const RELEASE_MODE = "production" as const;

/**
 * Data do congelamento
 */
export const FREEZE_DATE = "2024-12-30";

/**
 * Changelog simplificado
 */
export const VERSION_HISTORY = [
  {
    version: "1.0.0",
    date: "2024-12-30",
    type: "release" as const,
    description: "Versão inicial congelada para produção",
    changes: [
      "BI Dashboard consolidado",
      "Sistema de Score Financeiro",
      "Controle de Caixa e Competência",
      "Sistema de Alertas Inteligentes",
      "RBAC implementado",
    ],
  },
];

/**
 * Verifica se o produto está em modo de produção (congelado)
 */
export function isProductionMode(): boolean {
  return RELEASE_MODE === "production";
}

/**
 * Retorna informações completas da versão
 */
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    mode: RELEASE_MODE,
    freezeDate: FREEZE_DATE,
    isProduction: isProductionMode(),
  };
}
