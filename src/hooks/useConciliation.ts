import { useState, useMemo, useCallback } from "react";
import { useReceivablesDB } from "./useReceivablesDB";
import { useFinancialEntries, FinancialEntry } from "./useFinancialEntries";
import { Receivable } from "@/types";
import { differenceInDays, parseISO } from "date-fns";
import { parseLocalDate } from "@/utils/formatters";

// Conciliation operational status (does NOT alter source data)
export type ConciliationStatus = 
  | "CONCILIADO"       // Fully matched
  | "PARCIAL"          // Partial match
  | "EM_ABERTO"        // Open/pending
  | "GLOSADO"          // Glossed
  | "DIVERGENTE"       // Value/date mismatch
  | "SEM_VINCULO"      // Orphan - no match
  | "EM_ANALISE";      // Under review (internal)

export type DivergenceType = 
  | "VALOR_DIFERENTE"
  | "DATA_FORA_JANELA"
  | "RECEBIDO_SEM_FATURAMENTO"
  | "FATURADO_SEM_RECEBIDO"
  | "GLOSA_PARCIAL"
  | "GLOSA_TOTAL";

export type MatchConfidence = "ALTA" | "MEDIA" | "BAIXA";

export interface ConciliationItem {
  id: string;
  type: "receivable" | "financial_entry";
  sourceId: string;
  date: string;
  unit: string;
  source: string;          // convenio or origin
  description: string;
  identifier?: string;     // guia/NS/atendimento
  billedAmount: number;
  receivedAmount: number;
  openAmount: number;
  glossedAmount: number;
  ageInDays: number;
  status: ConciliationStatus;
  linkedTransactionId?: string;
  originalData: Receivable | FinancialEntry;
}

export interface MatchSuggestion {
  receivable: ConciliationItem;
  financialEntry: FinancialEntry;
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
}

export interface Divergence {
  id: string;
  type: DivergenceType;
  severity: "ALTA" | "MEDIA" | "BAIXA";
  item: ConciliationItem;
  relatedItem?: FinancialEntry | Receivable;
  valueDiff?: number;
  dateDiff?: number;
  description: string;
}

export interface ConciliationFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  source?: string;
  status?: ConciliationStatus;
  type?: "all" | "pending" | "divergent";
  search?: string;
}

export interface ConciliationSettings {
  dateWindowDays: number;       // Default: 3
  valueToleranceAmount: number; // Default: 1.00
  valueTolerancePercent: number; // Default: 0.5%
  conservativeMode: boolean;    // Only suggest high confidence
}

const DEFAULT_SETTINGS: ConciliationSettings = {
  dateWindowDays: 3,
  valueToleranceAmount: 1.00,
  valueTolerancePercent: 0.5,
  conservativeMode: true,
};

// Notes stored locally (could be persisted later)
export interface ConciliationNote {
  id: string;
  itemId: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

export function useConciliation() {
  const { receivables, loading: loadingReceivables } = useReceivablesDB();
  const { entries: financialEntries, loading: loadingEntries } = useFinancialEntries();
  
  const [settings, setSettings] = useState<ConciliationSettings>(DEFAULT_SETTINGS);
  const [localNotes, setLocalNotes] = useState<ConciliationNote[]>([]);
  const [localStatus, setLocalStatus] = useState<Record<string, ConciliationStatus>>({});
  const [filters, setFilters] = useState<ConciliationFilters>({});

  const loading = loadingReceivables || loadingEntries;

  // Convert receivables to conciliation items
  const conciliationItems = useMemo((): ConciliationItem[] => {
    const today = new Date();
    
    return receivables
      .filter(r => {
        const status = r.status?.toString().toUpperCase();
        return status !== "CANCELADO" && status !== "CANCELLED";
      })
      .map((r): ConciliationItem => {
        const billingDate = parseLocalDate(r.billingDate);
        const ageInDays = differenceInDays(today, billingDate);
        const openAmount = r.billedAmount - r.receivedAmount - r.glossedAmount;
        
        // Determine conciliation status
        let status: ConciliationStatus = "EM_ABERTO";
        if (localStatus[r.id]) {
          status = localStatus[r.id];
        } else if (r.status === "RECEBIDO" && openAmount <= 0.01) {
          status = "CONCILIADO";
        } else if (r.status === "RECEBIDO_COM_GLOSA") {
          status = r.receivedAmount > 0 ? "PARCIAL" : "GLOSADO";
        } else if (r.status === "GLOSADO") {
          status = "GLOSADO";
        } else if (r.linkedTransactionId) {
          status = openAmount > 0.01 ? "PARCIAL" : "CONCILIADO";
        }

        return {
          id: `recv-${r.id}`,
          type: "receivable",
          sourceId: r.id,
          date: r.billingDate,
          unit: r.unit,
          source: r.source,
          description: r.description,
          identifier: r.description, // Use description as identifier for now
          billedAmount: r.billedAmount,
          receivedAmount: r.receivedAmount,
          openAmount: Math.max(0, openAmount),
          glossedAmount: r.glossedAmount,
          ageInDays,
          status,
          linkedTransactionId: r.linkedTransactionId,
          originalData: r,
        };
      });
  }, [receivables, localStatus]);

  // Get income entries without link (potential orphans)
  const unlinkedIncomeEntries = useMemo(() => {
    return financialEntries.filter(e => 
      e.type === "entrada" && 
      e.status === "recebido" &&
      !e.observacao?.includes("receivable_id=")
    );
  }, [financialEntries]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return conciliationItems.filter(item => {
      if (filters.startDate) {
        const itemDate = parseLocalDate(item.date);
        if (itemDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const itemDate = parseLocalDate(item.date);
        if (itemDate > filters.endDate) return false;
      }
      if (filters.unit && item.unit !== filters.unit) return false;
      if (filters.source && item.source !== filters.source) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.type === "pending" && item.status === "CONCILIADO") return false;
      if (filters.type === "divergent" && !["DIVERGENTE", "SEM_VINCULO", "PARCIAL", "GLOSADO"].includes(item.status)) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!item.description.toLowerCase().includes(search) &&
            !item.source.toLowerCase().includes(search) &&
            !item.unit.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [conciliationItems, filters]);

  // Pending items (not fully conciliated)
  const pendingItems = useMemo(() => {
    return filteredItems.filter(i => 
      i.status !== "CONCILIADO" && i.openAmount > 0.01
    ).sort((a, b) => b.ageInDays - a.ageInDays);
  }, [filteredItems]);

  // Critical items (> 15 days, > 30 days)
  const criticalItems15 = useMemo(() => pendingItems.filter(i => i.ageInDays > 15), [pendingItems]);
  const criticalItems30 = useMemo(() => pendingItems.filter(i => i.ageInDays > 30), [pendingItems]);

  // Detect divergences
  const divergences = useMemo((): Divergence[] => {
    const divs: Divergence[] = [];
    const today = new Date();

    // Billed without received (orphan receivables)
    conciliationItems
      .filter(i => i.status === "EM_ABERTO" && i.ageInDays > settings.dateWindowDays)
      .forEach(item => {
        divs.push({
          id: `div-orphan-recv-${item.sourceId}`,
          type: "FATURADO_SEM_RECEBIDO",
          severity: item.ageInDays > 30 ? "ALTA" : item.ageInDays > 15 ? "MEDIA" : "BAIXA",
          item,
          description: `Faturado há ${item.ageInDays} dias sem recebimento`,
        });
      });

    // Partial gloss
    conciliationItems
      .filter(i => i.status === "PARCIAL" && i.glossedAmount > 0)
      .forEach(item => {
        divs.push({
          id: `div-glosa-parcial-${item.sourceId}`,
          type: "GLOSA_PARCIAL",
          severity: item.glossedAmount > 1000 ? "ALTA" : "MEDIA",
          item,
          valueDiff: item.glossedAmount,
          description: `Glosa parcial de R$ ${item.glossedAmount.toFixed(2)}`,
        });
      });

    // Total gloss
    conciliationItems
      .filter(i => i.status === "GLOSADO")
      .forEach(item => {
        divs.push({
          id: `div-glosa-total-${item.sourceId}`,
          type: "GLOSA_TOTAL",
          severity: "ALTA",
          item,
          valueDiff: item.billedAmount,
          description: `Glosa total de R$ ${item.billedAmount.toFixed(2)}`,
        });
      });

    // Orphan income entries (received without billing)
    unlinkedIncomeEntries.forEach(entry => {
      const entryDate = parseLocalDate(entry.data_prevista);
      const ageInDays = differenceInDays(today, entryDate);
      
      divs.push({
        id: `div-orphan-entry-${entry.id}`,
        type: "RECEBIDO_SEM_FATURAMENTO",
        severity: entry.valor > 5000 ? "ALTA" : "MEDIA",
        item: {
          id: `entry-${entry.id}`,
          type: "financial_entry",
          sourceId: entry.id,
          date: entry.data_prevista,
          unit: entry.unit_id || "",
          source: entry.operadora || entry.categoria || "",
          description: entry.descricao,
          billedAmount: 0,
          receivedAmount: entry.valor,
          openAmount: 0,
          glossedAmount: 0,
          ageInDays,
          status: "SEM_VINCULO",
          originalData: entry,
        },
        description: `Recebimento de R$ ${entry.valor.toFixed(2)} sem faturamento vinculado`,
      });
    });

    return divs.sort((a, b) => {
      const severityOrder = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [conciliationItems, unlinkedIncomeEntries, settings.dateWindowDays]);

  // Match scoring engine (suggestion only, never auto-matches)
  const suggestMatches = useCallback((item: ConciliationItem): MatchSuggestion[] => {
    if (item.linkedTransactionId || item.status === "CONCILIADO") {
      return [];
    }

    const suggestions: MatchSuggestion[] = [];
    const itemDate = parseLocalDate(item.date);

    unlinkedIncomeEntries.forEach(entry => {
      let score = 0;
      const reasons: string[] = [];
      const entryDate = parseLocalDate(entry.data_prevista);
      const dateDiff = Math.abs(differenceInDays(itemDate, entryDate));
      const valueDiff = Math.abs(item.billedAmount - entry.valor);
      const valueDiffPercent = (valueDiff / item.billedAmount) * 100;

      // Same unit (+20)
      if (entry.unit_id && entry.unit_id === item.unit) {
        score += 20;
        reasons.push("Mesma unidade");
      }

      // Same source/convenio (+20)
      if (entry.operadora && entry.operadora.toLowerCase() === item.source.toLowerCase()) {
        score += 20;
        reasons.push("Mesmo convênio");
      }

      // Date within window (+10)
      if (dateDiff <= settings.dateWindowDays) {
        score += 10;
        reasons.push(`Data dentro de ${settings.dateWindowDays} dias`);
      }

      // Value within tolerance (+10)
      if (valueDiff <= settings.valueToleranceAmount || valueDiffPercent <= settings.valueTolerancePercent) {
        score += 10;
        reasons.push("Valor dentro da tolerância");
      }

      // Exact value match (+20)
      if (valueDiff < 0.01) {
        score += 20;
        reasons.push("Valor exato");
      }

      // Description match (+40 for identifier)
      const descLower = item.description.toLowerCase();
      const entryDescLower = entry.descricao.toLowerCase();
      if (descLower === entryDescLower || 
          descLower.includes(entryDescLower) || 
          entryDescLower.includes(descLower)) {
        score += 40;
        reasons.push("Identificador compatível");
      }

      // Only suggest if score > 20
      if (score > 20) {
        let confidence: MatchConfidence = "BAIXA";
        if (score >= 70) confidence = "ALTA";
        else if (score >= 40) confidence = "MEDIA";

        // In conservative mode, only show high confidence
        if (settings.conservativeMode && confidence !== "ALTA") {
          return;
        }

        suggestions.push({
          receivable: item,
          financialEntry: entry,
          score,
          confidence,
          reasons,
        });
      }
    });

    return suggestions.sort((a, b) => b.score - a.score);
  }, [unlinkedIncomeEntries, settings]);

  // Stats for overview
  const stats = useMemo(() => {
    const allItems = conciliationItems;
    const totalBilled = allItems.reduce((sum, i) => sum + i.billedAmount, 0);
    const totalReceived = allItems.reduce((sum, i) => sum + i.receivedAmount, 0);
    const totalGlossed = allItems.reduce((sum, i) => sum + i.glossedAmount, 0);
    const totalOpen = allItems.reduce((sum, i) => sum + i.openAmount, 0);
    const conciliatedItems = allItems.filter(i => i.status === "CONCILIADO");
    const conciliationRate = allItems.length > 0 
      ? (conciliatedItems.length / allItems.length) * 100 
      : 0;
    const pendingCount = pendingItems.length;
    const avgAge = pendingItems.length > 0
      ? pendingItems.reduce((sum, i) => sum + i.ageInDays, 0) / pendingItems.length
      : 0;

    return {
      totalBilled,
      totalReceived,
      totalGlossed,
      totalOpen,
      conciliationRate,
      pendingCount,
      avgAge: Math.round(avgAge),
      criticalCount15: criticalItems15.length,
      criticalCount30: criticalItems30.length,
      divergenceCount: divergences.length,
    };
  }, [conciliationItems, pendingItems, criticalItems15, criticalItems30, divergences]);

  // Pareto by convenio
  const paretoByConvenio = useMemo(() => {
    const byConvenio: Record<string, { openAmount: number; count: number }> = {};
    
    pendingItems.forEach(item => {
      const key = item.source || "Não informado";
      if (!byConvenio[key]) {
        byConvenio[key] = { openAmount: 0, count: 0 };
      }
      byConvenio[key].openAmount += item.openAmount;
      byConvenio[key].count += 1;
    });

    return Object.entries(byConvenio)
      .map(([convenio, data]) => ({ convenio, ...data }))
      .sort((a, b) => b.openAmount - a.openAmount)
      .slice(0, 10);
  }, [pendingItems]);

  // Add local note
  const addNote = useCallback((itemId: string, note: string, userName: string) => {
    const newNote: ConciliationNote = {
      id: crypto.randomUUID(),
      itemId,
      note,
      createdAt: new Date().toISOString(),
      createdBy: userName,
    };
    setLocalNotes(prev => [...prev, newNote]);
    return newNote;
  }, []);

  // Get notes for item
  const getNotesForItem = useCallback((itemId: string) => {
    return localNotes.filter(n => n.itemId === itemId);
  }, [localNotes]);

  // Set internal status
  const setItemStatus = useCallback((itemId: string, status: ConciliationStatus) => {
    setLocalStatus(prev => ({ ...prev, [itemId]: status }));
  }, []);

  // Update settings
  const updateSettings = useCallback((updates: Partial<ConciliationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    // Data
    conciliationItems,
    filteredItems,
    pendingItems,
    criticalItems15,
    criticalItems30,
    divergences,
    unlinkedIncomeEntries,
    
    // Stats
    stats,
    paretoByConvenio,
    
    // Matching
    suggestMatches,
    
    // Local state management
    addNote,
    getNotesForItem,
    setItemStatus,
    localNotes,
    
    // Settings
    settings,
    updateSettings,
    
    // Filters
    filters,
    setFilters,
    
    // State
    loading,
  };
}
