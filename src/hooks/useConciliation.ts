import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useReceivablesDB } from "./useReceivablesDB";
import { useFinancialEntries, FinancialEntry } from "./useFinancialEntries";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "./useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { Receivable } from "@/types";
import { differenceInDays } from "date-fns";
import { 
  parseLocalDate, 
  formatUnitDisplayName,
  formatConvenioDisplayName,
  normalizeKey,
  extractIdentifier 
} from "@/utils/formatters";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export type ConciliationStatus = 
  | "CONCILIADO"
  | "PARCIAL"
  | "EM_ABERTO"
  | "GLOSADO"
  | "DIVERGENTE"
  | "SEM_VINCULO"
  | "EM_ANALISE";

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
  unitKey: string;           // Normalized key for matching/filtering
  unitLabel: string;         // Display label (no underscores)
  source: string;            // convenio or origin (raw)
  sourceKey: string;         // Normalized source for matching
  sourceLabel: string;       // Display label for source
  description: string;
  identifier?: string;       // Extracted guia/NS/atendimento
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
  unitKey?: string;
  source?: string;
  status?: ConciliationStatus;
  type?: "all" | "pending" | "divergent";
  search?: string;
}

export interface ConciliationSettings {
  dateWindowDays: number;
  valueToleranceAmount: number;
  valueTolerancePercent: number;
  conservativeMode: boolean;
}

const DEFAULT_SETTINGS: ConciliationSettings = {
  dateWindowDays: 3,
  valueToleranceAmount: 1.00,
  valueTolerancePercent: 0.5,
  conservativeMode: true,
};

export interface ConciliationNote {
  id: string;
  itemId: string;
  itemType: string;
  sourceId: string;
  note: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

interface DBConciliationStatus {
  id: string;
  company_id: string;
  item_id: string;
  item_type: string;
  source_id: string;
  status: string;
  previous_status: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DBConciliationNote {
  id: string;
  company_id: string;
  item_id: string;
  item_type: string;
  source_id: string;
  note: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

// ============================================
// LOCALSTORAGE QUEUE KEYS
// ============================================
const LS_KEY_STATUSES = "conciliation_offline_statuses";
const LS_KEY_NOTES = "conciliation_offline_notes";

interface OfflineStatus {
  itemId: string;
  status: ConciliationStatus;
  itemType: string;
  sourceId: string;
  previousStatus: string | null;
  timestamp: string;
}

interface OfflineNote extends ConciliationNote {
  timestamp: string;
}

// ============================================
// HOOK
// ============================================

export function useConciliation() {
  const { receivables, loading: loadingReceivables } = useReceivablesDB();
  const { entries: financialEntries, loading: loadingEntries } = useFinancialEntries();
  const { user, profile, currentCompany } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const currentCompanyId = currentCompany?.id;
  
  const [settings, setSettings] = useState<ConciliationSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<ConciliationFilters>({});
  
  // Persistence state
  const [dbStatuses, setDbStatuses] = useState<Record<string, ConciliationStatus>>({});
  const [dbNotes, setDbNotes] = useState<ConciliationNote[]>([]);
  const [localStatuses, setLocalStatuses] = useState<Record<string, ConciliationStatus>>({});
  const [localNotes, setLocalNotes] = useState<ConciliationNote[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingPersistence, setLoadingPersistence] = useState(true);
  
  // Prevent duplicate flush
  const flushingRef = useRef(false);

  const loading = loadingReceivables || loadingEntries;

  // Build unit name map from company settings
  const unitNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (companySettings?.units && Array.isArray(companySettings.units)) {
      for (const unit of companySettings.units) {
        if (unit && typeof unit === 'object' && 'id' in unit && 'name' in unit) {
          map[(unit as any).id] = (unit as any).name;
        }
      }
    }
    return map;
  }, [companySettings?.units]);

  // ============================================
  // LOAD PERSISTED DATA + FLUSH OFFLINE QUEUE
  // ============================================
  useEffect(() => {
    if (!currentCompanyId) {
      setLoadingPersistence(false);
      return;
    }

    const loadPersistedData = async () => {
      try {
        // Load statuses
        const { data: statusData, error: statusError } = await supabase
          .from("conciliation_status")
          .select("*")
          .eq("company_id", currentCompanyId);

        if (statusError) throw statusError;

        const statusMap: Record<string, ConciliationStatus> = {};
        (statusData as DBConciliationStatus[] || []).forEach(s => {
          statusMap[s.item_id] = s.status as ConciliationStatus;
        });
        setDbStatuses(statusMap);

        // Load notes
        const { data: notesData, error: notesError } = await supabase
          .from("conciliation_notes")
          .select("*")
          .eq("company_id", currentCompanyId)
          .order("created_at", { ascending: false });

        if (notesError) throw notesError;

        const notes: ConciliationNote[] = (notesData as DBConciliationNote[] || []).map(n => ({
          id: n.id,
          itemId: n.item_id,
          itemType: n.item_type,
          sourceId: n.source_id,
          note: n.note,
          createdAt: n.created_at,
          createdBy: n.created_by || "",
          createdByName: n.created_by_name || "Usuário",
        }));
        setDbNotes(notes);

        // DB is reachable - flush offline queue
        setIsOfflineMode(false);
        await flushOfflineQueue(statusMap, notes);

      } catch (error) {
        console.error("Failed to load conciliation data, using local mode:", error);
        setIsOfflineMode(true);
        
        // Load from localStorage
        loadFromLocalStorage();
      } finally {
        setLoadingPersistence(false);
      }
    };

    loadPersistedData();
  }, [currentCompanyId]);

  // Load offline data from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const storedStatuses = localStorage.getItem(LS_KEY_STATUSES);
      const storedNotes = localStorage.getItem(LS_KEY_NOTES);
      
      if (storedStatuses) {
        const parsed: OfflineStatus[] = JSON.parse(storedStatuses);
        const statusMap: Record<string, ConciliationStatus> = {};
        parsed.forEach(s => {
          statusMap[s.itemId] = s.status;
        });
        setLocalStatuses(statusMap);
      }
      
      if (storedNotes) {
        const parsed: OfflineNote[] = JSON.parse(storedNotes);
        setLocalNotes(parsed.map(n => ({
          id: n.id,
          itemId: n.itemId,
          itemType: n.itemType,
          sourceId: n.sourceId,
          note: n.note,
          createdAt: n.createdAt,
          createdBy: n.createdBy,
          createdByName: n.createdByName,
        })));
      }
    } catch (e) {
      console.error("Error loading from localStorage:", e);
    }
  }, []);

  // Flush offline queue to DB
  const flushOfflineQueue = useCallback(async (
    existingStatuses: Record<string, ConciliationStatus>,
    existingNotes: ConciliationNote[]
  ) => {
    if (flushingRef.current || !currentCompanyId) return;
    flushingRef.current = true;

    try {
      const storedStatuses = localStorage.getItem(LS_KEY_STATUSES);
      const storedNotes = localStorage.getItem(LS_KEY_NOTES);
      
      let statusesToFlush: OfflineStatus[] = [];
      let notesToFlush: OfflineNote[] = [];
      
      if (storedStatuses) {
        statusesToFlush = JSON.parse(storedStatuses);
      }
      if (storedNotes) {
        notesToFlush = JSON.parse(storedNotes);
      }

      if (statusesToFlush.length === 0 && notesToFlush.length === 0) {
        return;
      }

      let flushedCount = 0;

      // Flush statuses
      for (const s of statusesToFlush) {
        try {
          await supabase
            .from("conciliation_status")
            .upsert({
              company_id: currentCompanyId,
              item_id: s.itemId,
              item_type: s.itemType,
              source_id: s.sourceId,
              status: s.status,
              previous_status: s.previousStatus,
              updated_by: user?.id,
              updated_by_name: profile?.full_name || "Usuário",
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "company_id,item_type,item_id",
            });
          flushedCount++;
        } catch (e) {
          console.error("Error flushing status:", e);
        }
      }

      // Flush notes (skip duplicates by id)
      const existingNoteIds = new Set(existingNotes.map(n => n.id));
      for (const n of notesToFlush) {
        if (existingNoteIds.has(n.id)) continue;
        try {
          await supabase
            .from("conciliation_notes")
            .insert({
              id: n.id,
              company_id: currentCompanyId,
              item_id: n.itemId,
              item_type: n.itemType,
              source_id: n.sourceId,
              note: n.note,
              created_by: n.createdBy || user?.id,
              created_by_name: n.createdByName,
            });
          flushedCount++;
        } catch (e) {
          console.error("Error flushing note:", e);
        }
      }

      // Clear localStorage queue
      localStorage.removeItem(LS_KEY_STATUSES);
      localStorage.removeItem(LS_KEY_NOTES);
      setLocalStatuses({});
      setLocalNotes([]);

      if (flushedCount > 0) {
        toast.success("Dados offline sincronizados", {
          description: `${flushedCount} item(s) foram sincronizados com o servidor.`,
        });
      }

    } catch (e) {
      console.error("Error flushing offline queue:", e);
    } finally {
      flushingRef.current = false;
    }
  }, [currentCompanyId, user?.id, profile?.full_name]);

  // Save to localStorage queue
  const saveStatusToLocalStorage = useCallback((status: OfflineStatus) => {
    try {
      const stored = localStorage.getItem(LS_KEY_STATUSES);
      let queue: OfflineStatus[] = stored ? JSON.parse(stored) : [];
      
      // Update or add
      const idx = queue.findIndex(s => s.itemId === status.itemId);
      if (idx >= 0) {
        queue[idx] = status;
      } else {
        queue.push(status);
      }
      
      localStorage.setItem(LS_KEY_STATUSES, JSON.stringify(queue));
    } catch (e) {
      console.error("Error saving status to localStorage:", e);
    }
  }, []);

  const saveNoteToLocalStorage = useCallback((note: OfflineNote) => {
    try {
      const stored = localStorage.getItem(LS_KEY_NOTES);
      let queue: OfflineNote[] = stored ? JSON.parse(stored) : [];
      queue.push(note);
      localStorage.setItem(LS_KEY_NOTES, JSON.stringify(queue));
    } catch (e) {
      console.error("Error saving note to localStorage:", e);
    }
  }, []);

  // Combined status (DB + local fallback)
  const combinedStatuses = useMemo(() => {
    return { ...dbStatuses, ...localStatuses };
  }, [dbStatuses, localStatuses]);

  // Combined notes (DB + local, deduplicated by id)
  const combinedNotes = useMemo(() => {
    const seen = new Set<string>();
    const result: ConciliationNote[] = [];
    for (const n of [...dbNotes, ...localNotes]) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        result.push(n);
      }
    }
    return result.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [dbNotes, localNotes]);

  // ============================================
  // CONVERT RECEIVABLES TO CONCILIATION ITEMS
  // ============================================
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
        const itemId = `recv-${r.id}`;
        
        // Normalize unit: receivables use unit name directly
        const unitKey = normalizeKey(r.unit);
        const unitLabel = formatUnitDisplayName(r.unit);
        
        // Normalize source
        const sourceKey = normalizeKey(r.source);
        const sourceLabel = formatConvenioDisplayName(r.source);
        
        // Extract identifier from description
        const identifier = extractIdentifier(r.description);
        
        // Determine conciliation status
        let status: ConciliationStatus = "EM_ABERTO";
        if (combinedStatuses[itemId]) {
          status = combinedStatuses[itemId];
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
          id: itemId,
          type: "receivable",
          sourceId: r.id,
          date: r.billingDate,
          unitKey,
          unitLabel,
          source: r.source,
          sourceKey,
          sourceLabel,
          description: r.description,
          identifier,
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
  }, [receivables, combinedStatuses, unitNameMap]);

  // Get income entries without link (potential orphans)
  const unlinkedIncomeEntries = useMemo(() => {
    return financialEntries.filter(e => 
      e.type === "entrada" && 
      e.status === "recebido" &&
      !e.observacao?.includes("receivable_id=")
    );
  }, [financialEntries]);

  // ============================================
  // FILTER ITEMS
  // ============================================
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
      // Use unitKey for filtering
      if (filters.unitKey && item.unitKey !== filters.unitKey) return false;
      if (filters.source && item.sourceKey !== normalizeKey(filters.source)) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.type === "pending" && item.status === "CONCILIADO") return false;
      if (filters.type === "divergent" && !["DIVERGENTE", "SEM_VINCULO", "PARCIAL", "GLOSADO"].includes(item.status)) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!item.description.toLowerCase().includes(search) &&
            !item.sourceLabel.toLowerCase().includes(search) &&
            !item.unitLabel.toLowerCase().includes(search)) {
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

  // Critical items
  const criticalItems15 = useMemo(() => pendingItems.filter(i => i.ageInDays > 15), [pendingItems]);
  const criticalItems30 = useMemo(() => pendingItems.filter(i => i.ageInDays > 30), [pendingItems]);

  // ============================================
  // DIVERGENCES
  // ============================================
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

    // Orphan income entries
    unlinkedIncomeEntries.forEach(entry => {
      const entryDate = parseLocalDate(entry.data_prevista);
      const ageInDays = differenceInDays(today, entryDate);
      
      // Resolve unit for financial entry
      const entryUnitKey = entry.unit_id ? normalizeKey(unitNameMap[entry.unit_id] || entry.unit_id) : "";
      const entryUnitLabel = entry.unit_id ? formatUnitDisplayName(unitNameMap[entry.unit_id] || entry.unit_id) : "";
      
      divs.push({
        id: `div-orphan-entry-${entry.id}`,
        type: "RECEBIDO_SEM_FATURAMENTO",
        severity: entry.valor > 5000 ? "ALTA" : "MEDIA",
        item: {
          id: `entry-${entry.id}`,
          type: "financial_entry",
          sourceId: entry.id,
          date: entry.data_prevista,
          unitKey: entryUnitKey,
          unitLabel: entryUnitLabel,
          source: entry.operadora || entry.categoria || "",
          sourceKey: normalizeKey(entry.operadora || entry.categoria || ""),
          sourceLabel: formatConvenioDisplayName(entry.operadora || entry.categoria || ""),
          description: entry.descricao,
          identifier: extractIdentifier(entry.descricao),
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
  }, [conciliationItems, unlinkedIncomeEntries, settings.dateWindowDays, unitNameMap]);

  // ============================================
  // MATCH SCORING ENGINE (IMPROVED)
  // ============================================
  const suggestMatches = useCallback((item: ConciliationItem): MatchSuggestion[] => {
    if (item.linkedTransactionId || item.status === "CONCILIADO") {
      return [];
    }

    const suggestions: MatchSuggestion[] = [];
    const itemDate = parseLocalDate(item.date);
    const itemIdentifier = item.identifier;

    unlinkedIncomeEntries.forEach(entry => {
      let score = 0;
      const reasons: string[] = [];
      const entryDate = parseLocalDate(entry.data_prevista);
      const dateDiff = Math.abs(differenceInDays(itemDate, entryDate));
      const valueDiff = Math.abs(item.billedAmount - entry.valor);
      const valueDiffPercent = item.billedAmount > 0 ? (valueDiff / item.billedAmount) * 100 : 100;

      // Resolve entry unit key
      const entryUnitKey = entry.unit_id 
        ? normalizeKey(unitNameMap[entry.unit_id] || entry.unit_id)
        : "";
      
      // Same unit (compare keys, NOT unit_id with label!)
      if (entryUnitKey && entryUnitKey === item.unitKey) {
        score += 20;
        reasons.push("Mesma unidade");
      }

      // Same source/convenio (normalized comparison)
      const entrySourceKey = normalizeKey(entry.operadora || "");
      if (entrySourceKey && entrySourceKey === item.sourceKey) {
        score += 20;
        reasons.push("Mesmo convênio");
      }

      // Date within window
      if (dateDiff <= settings.dateWindowDays) {
        score += 10;
        reasons.push(`Data dentro de ${settings.dateWindowDays} dias`);
      }

      // Value within tolerance
      if (valueDiff <= settings.valueToleranceAmount || valueDiffPercent <= settings.valueTolerancePercent) {
        score += 10;
        reasons.push("Valor dentro da tolerância");
      }

      // Exact value match
      if (valueDiff < 0.01) {
        score += 20;
        reasons.push("Valor exato");
      }

      // Identifier match (strong signal)
      const entryIdentifier = extractIdentifier(entry.descricao);
      if (itemIdentifier && entryIdentifier && itemIdentifier === entryIdentifier) {
        score += 40;
        reasons.push("Identificador compatível");
      } else {
        // Fallback: partial description match
        const descLower = item.description.toLowerCase();
        const entryDescLower = entry.descricao.toLowerCase();
        if (descLower.length > 10 && entryDescLower.length > 10) {
          if (descLower.includes(entryDescLower) || entryDescLower.includes(descLower)) {
            score += 15;
            reasons.push("Descrição similar");
          }
        }
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
  }, [unlinkedIncomeEntries, settings, unitNameMap]);

  // ============================================
  // STATS
  // ============================================
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
      const key = item.sourceLabel || "Não informado";
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

  // ============================================
  // ADD NOTE (WITH PERSISTENCE)
  // ============================================
  const addNote = useCallback(async (itemId: string, note: string, userName: string): Promise<ConciliationNote | null> => {
    const sourceId = itemId.replace(/^(recv-|entry-)/, "");
    const itemType = itemId.startsWith("entry-") ? "financial_entry" : "receivable";
    
    const newNote: ConciliationNote = {
      id: crypto.randomUUID(),
      itemId,
      itemType,
      sourceId,
      note,
      createdAt: new Date().toISOString(),
      createdBy: user?.id || "",
      createdByName: userName || profile?.full_name || "Usuário",
    };

    // Try to persist to DB
    if (currentCompanyId && !isOfflineMode) {
      try {
        const { error } = await supabase
          .from("conciliation_notes")
          .insert({
            id: newNote.id,
            company_id: currentCompanyId,
            item_id: itemId,
            item_type: itemType,
            source_id: sourceId,
            note,
            created_by: user?.id,
            created_by_name: newNote.createdByName,
          });

        if (error) throw error;

        setDbNotes(prev => [newNote, ...prev]);
        return newNote;
      } catch (error) {
        console.error("Failed to persist note:", error);
        toast.warning("Modo offline para notas", {
          description: "A nota foi salva localmente e será sincronizada.",
        });
        setIsOfflineMode(true);
      }
    }

    // Save to localStorage queue
    saveNoteToLocalStorage({ ...newNote, timestamp: new Date().toISOString() });
    setLocalNotes(prev => [newNote, ...prev]);
    return newNote;
  }, [currentCompanyId, user?.id, profile?.full_name, isOfflineMode, saveNoteToLocalStorage]);

  // Get notes for item
  const getNotesForItem = useCallback((itemId: string) => {
    return combinedNotes.filter(n => n.itemId === itemId);
  }, [combinedNotes]);

  // ============================================
  // SET ITEM STATUS (WITH PERSISTENCE)
  // ============================================
  const setItemStatus = useCallback(async (itemId: string, status: ConciliationStatus) => {
    const sourceId = itemId.replace(/^(recv-|entry-)/, "");
    const itemType = itemId.startsWith("entry-") ? "financial_entry" : "receivable";
    const previousStatus = combinedStatuses[itemId] || null;

    // Try to persist to DB
    if (currentCompanyId && !isOfflineMode) {
      try {
        const { error } = await supabase
          .from("conciliation_status")
          .upsert({
            company_id: currentCompanyId,
            item_id: itemId,
            item_type: itemType,
            source_id: sourceId,
            status,
            previous_status: previousStatus,
            updated_by: user?.id,
            updated_by_name: profile?.full_name || "Usuário",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "company_id,item_type,item_id",
          });

        if (error) throw error;

        setDbStatuses(prev => ({ ...prev, [itemId]: status }));
        return;
      } catch (error) {
        console.error("Failed to persist status:", error);
        toast.warning("Modo offline para status", {
          description: "O status foi salvo localmente e será sincronizado.",
        });
        setIsOfflineMode(true);
      }
    }

    // Save to localStorage queue
    saveStatusToLocalStorage({
      itemId,
      status,
      itemType,
      sourceId,
      previousStatus,
      timestamp: new Date().toISOString(),
    });
    setLocalStatuses(prev => ({ ...prev, [itemId]: status }));
  }, [currentCompanyId, combinedStatuses, user?.id, profile?.full_name, isOfflineMode, saveStatusToLocalStorage]);

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
    
    // Note & status management
    addNote,
    getNotesForItem,
    setItemStatus,
    localNotes: combinedNotes,
    
    // Settings
    settings,
    updateSettings,
    
    // Filters
    filters,
    setFilters,
    
    // State
    loading: loading || loadingPersistence,
    isOfflineMode,
  };
}
