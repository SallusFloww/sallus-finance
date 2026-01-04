export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
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
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
