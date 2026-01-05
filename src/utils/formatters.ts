import { format } from "date-fns";

// ============================================
// HELPER SEGURO PARA PARSE DE DATAS (HOTFIX TIMEZONE P0)
// ============================================
// Strings "YYYY-MM-DD" são interpretadas como UTC pelo new Date(),
// causando shift de 1 dia em UTC-3 (Brasil). Este helper força parse local.
// ============================================

/**
 * Parse seguro de string de data para Date local (Brasil)
 * - Se dateString for "YYYY-MM-DD", interpreta como data local (00:00)
 * - Caso contrário, usa new Date() padrão
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Verifica se é formato ISO date-only: YYYY-MM-DD
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateOnly.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    // Retorna data local às 00:00 para comparações corretas
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  // Para outros formatos (ISO completo, etc), usa parse padrão
  return new Date(dateString);
}

/**
 * Normaliza uma data para início do dia (00:00:00.000)
 * Usado para comparações date-only
 */
export function toStartOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Formata Date para string "yyyy-MM-dd" usando date-fns (evita UTC shift)
 * NÃO usar toISOString().split("T")[0] pois isso converte para UTC primeiro
 * Usa toStartOfDay para garantir consistência
 */
export function formatLocalISODate(date: Date): string {
  return format(toStartOfDay(date), "yyyy-MM-dd");
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(dateString: string): string {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function isToday(dateString: string): boolean {
  const date = toStartOfDay(parseLocalDate(dateString));
  const today = toStartOfDay(new Date());
  return date.getTime() === today.getTime();
}

export function isFutureDate(dateString: string): boolean {
  const date = toStartOfDay(parseLocalDate(dateString));
  const today = toStartOfDay(new Date());
  return date > today;
}

export function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return formatCurrency(value);
}

// ============================================
// UTILITÁRIO PADRONIZADO DE DINHEIRO (BRL)
// ============================================
// REGRA: Valores são armazenados em REAIS (decimal com 2 casas)
// NÃO usar centavos (inteiro) para evitar conversões desnecessárias
// Exemplo: R$ 450,00 => armazena 450.00
// ============================================

/**
 * Parseia uma string de valor monetário brasileiro para número
 * Aceita: "450", "450,00", "450.00", "R$ 450,00", "R$450", etc.
 * Retorna: número em reais (ex: 450.00)
 * 
 * IMPORTANTE: Não multiplica por 100! Mantém o valor em reais.
 */
export function parseMoneyBR(value: string | number): number {
  if (typeof value === "number") {
    return Math.round(value * 100) / 100; // Arredonda para 2 casas
  }
  
  if (!value || typeof value !== "string") {
    return 0;
  }

  // Remove prefixo R$ e espaços
  let cleaned = value.trim().replace(/^R\$\s*/i, "").trim();
  
  // Remove pontos de milhar (ex: 1.234,56 => 1234,56)
  // Detecta formato brasileiro: pontos antes da vírgula são milhares
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Formato brasileiro: 1.234,56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Apenas vírgula: 450,00 => 450.00
    cleaned = cleaned.replace(",", ".");
  }
  // Se só tem ponto, assume formato internacional (450.00)
  
  // Remove caracteres não numéricos exceto ponto e hífen
  cleaned = cleaned.replace(/[^\d.-]/g, "");
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return 0;
  }
  
  // Arredonda para 2 casas decimais
  return Math.round(parsed * 100) / 100;
}

/**
 * Formata número para exibição em formato BRL
 * Entrada: número em reais (ex: 450.00)
 * Saída: "R$ 450,00"
 */
export function formatMoneyBR(value: number): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "R$ 0,00";
  }
  return formatCurrency(value);
}

/**
 * Valida e normaliza valor monetário para armazenamento
 * Garante que o valor está no formato correto (decimal com 2 casas)
 * 
 * IMPORTANTE: Esta função NÃO converte para centavos!
 * Mantém o valor em reais para consistência com o schema existente.
 */
export function normalizeMoneyValue(value: string | number): number {
  return parseMoneyBR(value);
}

/**
 * Verifica se dois valores monetários são iguais (com tolerância de centavos)
 */
export function isMoneyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

/**
 * Soma valores monetários com precisão
 */
export function sumMoney(...values: number[]): number {
  const sum = values.reduce((acc, val) => acc + (val || 0), 0);
  return Math.round(sum * 100) / 100;
}

// ============================================
// DISPLAY LABEL UTILITIES
// ============================================
// Converte slugs/códigos internos para labels bonitos
// Usado para exibir unidades, especialidades, convênios, etc.
// ============================================

/**
 * Converte uma string slug/código para label de exibição bonito.
 * Regras:
 * 1. Substitui underscores por espaços
 * 2. Remove duplicidade de espaços
 * 3. Aplica Title Case (primeira letra de cada palavra maiúscula)
 * 4. NÃO aplica uppercase global
 * 
 * Exemplos:
 * - "PRONTO_SOCORRO" → "Pronto Socorro"
 * - "centro_clinico" → "Centro Clínico"
 * - "OFTALMOLOGIA" → "Oftalmologia"
 * - "   some__weird___string  " → "Some Weird String"
 */
export function displayLabel(value: string | null | undefined): string {
  if (!value) return "";
  
  // Substitui underscores por espaços
  let result = value.replace(/_/g, " ");
  
  // Remove múltiplos espaços e trim
  result = result.replace(/\s+/g, " ").trim();
  
  // Aplica Title Case
  result = result
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  return result;
}

/**
 * Map de unidades com nomes customizados conhecidos.
 * Usado para normalizar nomes de unidades comuns.
 * Inclui variações de slug, código e nome para garantir match.
 */
const UNIT_DISPLAY_NAMES: Record<string, string> = {
  // Oncologia
  oncologia: "Oncologia",
  onco: "Oncologia",
  
  // Pronto Socorro
  "pronto-socorro": "Pronto Socorro",
  "pronto_socorro": "Pronto Socorro",
  prontosocorro: "Pronto Socorro",
  "pronto socorro": "Pronto Socorro",
  ps: "Pronto Socorro",
  
  // Centro Clínico
  "centro-clinico": "Centro Clínico",
  "centro_clinico": "Centro Clínico",
  centroclinico: "Centro Clínico",
  "centro clinico": "Centro Clínico",
  cc: "Centro Clínico",
};

/**
 * Formata nome de unidade para exibição.
 * Primeiro tenta um lookup em nomes conhecidos, depois aplica displayLabel como fallback.
 * 
 * REGRA: Nunca exibir slug/código com underscore para o usuário.
 */
export function formatUnitDisplayName(unit: string | null | undefined): string {
  if (!unit) return "";
  
  // Normaliza para lookup: lowercase, substitui underscores e espaços por hífen
  const normalizedKey = unit.toLowerCase().replace(/[_\s]+/g, "-").replace(/-+/g, "-");
  const normalizedKeyNoHyphen = unit.toLowerCase().replace(/[_\s-]+/g, "");
  
  // Tenta match direto, com hífen normalizado, e sem separadores
  const knownName = 
    UNIT_DISPLAY_NAMES[unit.toLowerCase()] || 
    UNIT_DISPLAY_NAMES[normalizedKey] || 
    UNIT_DISPLAY_NAMES[normalizedKeyNoHyphen];
  
  if (knownName) return knownName;
  
  // Fallback para displayLabel (converte PRONTO_SOCORRO -> Pronto Socorro)
  return displayLabel(unit);
}

/**
 * Formata nome de especialidade para exibição.
 * Simplesmente aplica displayLabel pois especialidades seguem o padrão title case.
 */
export function formatSpecialtyDisplayName(specialty: string | null | undefined): string {
  if (!specialty) return "Sem especialidade";
  return displayLabel(specialty);
}

/**
 * Formata nome de convênio para exibição.
 * Preserva siglas conhecidas em maiúsculas.
 */
export function formatConvenioDisplayName(convenio: string | null | undefined): string {
  if (!convenio) return "";
  
  // Siglas conhecidas que devem permanecer em maiúsculas
  const SIGLAS = ["SUS", "UNIMED", "IPASGO", "GEAP", "BRADESCO", "AMIL", "HAPVIDA"];
  
  const upper = convenio.toUpperCase().trim();
  if (SIGLAS.includes(upper)) {
    return upper;
  }
  
  return displayLabel(convenio);
}

// ============================================
// TESTES RÁPIDOS (executar em console se necessário)
// ============================================
// console.log("Teste parseMoneyBR:");
// console.log("  '450' =>", parseMoneyBR("450")); // 450
// console.log("  '450,00' =>", parseMoneyBR("450,00")); // 450
// console.log("  '450.00' =>", parseMoneyBR("450.00")); // 450
// console.log("  'R$ 450,00' =>", parseMoneyBR("R$ 450,00")); // 450
// console.log("  '1.234,56' =>", parseMoneyBR("1.234,56")); // 1234.56
// console.log("  'R$ 1.234,56' =>", parseMoneyBR("R$ 1.234,56")); // 1234.56
// console.log("Teste formatMoneyBR:");
// console.log("  450 =>", formatMoneyBR(450)); // "R$ 450,00"
// console.log("  1234.56 =>", formatMoneyBR(1234.56)); // "R$ 1.234,56"
