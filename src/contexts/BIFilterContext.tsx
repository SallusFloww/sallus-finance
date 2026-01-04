import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

// ============================================
// BI GLOBAL FILTER CONTEXT - POWER BI-LIKE CROSS-FILTER
// ============================================

export type AgingRange = "0-30" | "31-60" | "61-90" | "90+" | "all";
export type ReceiptStatus = "recebido" | "em_aberto" | "glosa" | "all";
export type DataOrigin = "producao" | "faturamento" | "recebimento" | "caixa" | "all";
export type ViewType = "caixa" | "competencia" | "all";
export type PeriodPreset = "current" | "3m" | "6m" | "12m" | "custom";

export interface BIGlobalFilters {
  // Date range
  startDate: Date;
  endDate: Date;
  periodPreset: PeriodPreset;
  
  // Dimension filters
  unit: string; // "all" or unit id
  payer: string; // "all" or payer name
  category: string; // "all" or category name
  agingRange: AgingRange;
  receiptStatus: ReceiptStatus;
  origin: DataOrigin;
  viewType: ViewType;
}

export interface ActiveFilter {
  key: keyof BIGlobalFilters;
  label: string;
  value: string;
  displayValue: string;
}

interface BIFilterContextValue {
  // Current filters
  filters: BIGlobalFilters;
  
  // Active filter chips
  activeFilters: ActiveFilter[];
  
  // Filter actions
  setFilter: <K extends keyof BIGlobalFilters>(key: K, value: BIGlobalFilters[K]) => void;
  setFilters: (updates: Partial<BIGlobalFilters>) => void;
  clearFilter: (key: keyof BIGlobalFilters) => void;
  clearAllFilters: () => void;
  
  // Period shortcuts
  setPeriodPreset: (preset: PeriodPreset) => void;
  setCustomDateRange: (start: Date, end: Date) => void;
  
  // Cross-filter handlers (called by charts)
  onChartClick: (type: string, value: string) => void;
  
  // Drill-down state
  drilldownContext: DrilldownContext | null;
  openDrilldown: (context: DrilldownContext) => void;
  closeDrilldown: () => void;
  
  // Meta
  lastUpdated: Date;
  isLoading: boolean;
}

export interface DrilldownContext {
  type: "payer" | "category" | "aging" | "unit" | "funnel" | "transaction";
  title: string;
  value: string;
  filters: Partial<BIGlobalFilters>;
}

const DEFAULT_FILTERS: BIGlobalFilters = {
  startDate: startOfMonth(new Date()),
  endDate: endOfMonth(new Date()),
  periodPreset: "current",
  unit: "all",
  payer: "all",
  category: "all",
  agingRange: "all",
  receiptStatus: "all",
  origin: "all",
  viewType: "all",
};

const BIFilterContext = createContext<BIFilterContextValue | null>(null);

export function BIFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<BIGlobalFilters>(DEFAULT_FILTERS);
  const [drilldownContext, setDrilldownContext] = useState<DrilldownContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Calculate active filter chips
  const activeFilters = useMemo((): ActiveFilter[] => {
    const active: ActiveFilter[] = [];
    
    if (filters.unit !== "all") {
      active.push({ key: "unit", label: "Unidade", value: filters.unit, displayValue: filters.unit });
    }
    if (filters.payer !== "all") {
      active.push({ key: "payer", label: "Pagador", value: filters.payer, displayValue: filters.payer });
    }
    if (filters.category !== "all") {
      active.push({ key: "category", label: "Categoria", value: filters.category, displayValue: filters.category });
    }
    if (filters.agingRange !== "all") {
      const rangeLabels: Record<AgingRange, string> = {
        "0-30": "0-30 dias",
        "31-60": "31-60 dias",
        "61-90": "61-90 dias",
        "90+": ">90 dias",
        "all": "Todas"
      };
      active.push({ key: "agingRange", label: "Aging", value: filters.agingRange, displayValue: rangeLabels[filters.agingRange] });
    }
    if (filters.receiptStatus !== "all") {
      const statusLabels: Record<ReceiptStatus, string> = {
        "recebido": "Recebido",
        "em_aberto": "Em Aberto",
        "glosa": "Glosa",
        "all": "Todos"
      };
      active.push({ key: "receiptStatus", label: "Status", value: filters.receiptStatus, displayValue: statusLabels[filters.receiptStatus] });
    }
    if (filters.origin !== "all") {
      const originLabels: Record<DataOrigin, string> = {
        "producao": "Produção",
        "faturamento": "Faturamento",
        "recebimento": "Recebimento",
        "caixa": "Caixa",
        "all": "Todos"
      };
      active.push({ key: "origin", label: "Origem", value: filters.origin, displayValue: originLabels[filters.origin] });
    }
    
    return active;
  }, [filters]);

  const setFilter = useCallback(<K extends keyof BIGlobalFilters>(key: K, value: BIGlobalFilters[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
    setLastUpdated(new Date());
  }, []);

  const setFilters = useCallback((updates: Partial<BIGlobalFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates }));
    setLastUpdated(new Date());
  }, []);

  const clearFilter = useCallback((key: keyof BIGlobalFilters) => {
    setFiltersState(prev => ({ ...prev, [key]: DEFAULT_FILTERS[key] }));
    setLastUpdated(new Date());
  }, []);

  const clearAllFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setLastUpdated(new Date());
  }, []);

  const setPeriodPreset = useCallback((preset: PeriodPreset) => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfMonth(now);

    switch (preset) {
      case "current":
        start = startOfMonth(now);
        break;
      case "3m":
        start = startOfMonth(subMonths(now, 2));
        break;
      case "6m":
        start = startOfMonth(subMonths(now, 5));
        break;
      case "12m":
        start = startOfMonth(subMonths(now, 11));
        break;
      default:
        start = startOfMonth(now);
    }

    setFiltersState(prev => ({
      ...prev,
      startDate: start,
      endDate: end,
      periodPreset: preset,
    }));
    setLastUpdated(new Date());
  }, []);

  const setCustomDateRange = useCallback((start: Date, end: Date) => {
    setFiltersState(prev => ({
      ...prev,
      startDate: start,
      endDate: end,
      periodPreset: "custom",
    }));
    setLastUpdated(new Date());
  }, []);

  // Cross-filter handler - maps chart clicks to filter updates
  const onChartClick = useCallback((type: string, value: string) => {
    switch (type) {
      case "payer":
        setFilter("payer", value);
        break;
      case "category":
        setFilter("category", value);
        break;
      case "aging":
        const agingMap: Record<string, AgingRange> = {
          "0-30 dias": "0-30",
          "31-60 dias": "31-60",
          "61-90 dias": "61-90",
          "90+ dias": "90+",
        };
        setFilter("agingRange", agingMap[value] || "all");
        break;
      case "unit":
        setFilter("unit", value);
        break;
      case "funnel":
        const originMap: Record<string, DataOrigin> = {
          "Produzido": "producao",
          "Faturado": "faturamento",
          "Recebido": "recebimento",
          "Em Aberto": "faturamento",
        };
        setFilter("origin", originMap[value] || "all");
        break;
      case "status":
        const statusMap: Record<string, ReceiptStatus> = {
          "Recebido": "recebido",
          "Em Aberto": "em_aberto",
          "Glosa": "glosa",
        };
        setFilter("receiptStatus", statusMap[value] || "all");
        break;
    }
  }, [setFilter]);

  const openDrilldown = useCallback((context: DrilldownContext) => {
    setDrilldownContext(context);
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldownContext(null);
  }, []);

  const value: BIFilterContextValue = {
    filters,
    activeFilters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    setPeriodPreset,
    setCustomDateRange,
    onChartClick,
    drilldownContext,
    openDrilldown,
    closeDrilldown,
    lastUpdated,
    isLoading,
  };

  return (
    <BIFilterContext.Provider value={value}>
      {children}
    </BIFilterContext.Provider>
  );
}

export function useBIFilters() {
  const context = useContext(BIFilterContext);
  if (!context) {
    throw new Error("useBIFilters must be used within a BIFilterProvider");
  }
  return context;
}
