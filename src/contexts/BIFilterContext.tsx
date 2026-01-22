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

// ✅ Produção / Mix (padronize conforme seu app)
export type ProductionType = "CONSULTA" | "EXAME" | "BOX" | "MAT_MED" | "PACOTE_BOX" | "PACOTE_GTA" | "all";

export interface BIGlobalFilters {
  // Date range
  startDate: Date;
  endDate: Date;
  periodPreset: PeriodPreset;

  // Dimension filters
  unit: string; // "all" or unit id
  payer: string; // "all" or payer name
  category: string; // "all" or category name

  // ✅ NOVOS
  doctorId: string; // "all" or doctors.id
  productionType: ProductionType;

  // Status / meta
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

export interface DrilldownContext {
  type: "payer" | "category" | "aging" | "unit" | "funnel" | "transaction" | "doctor" | "productionType";
  title: string;
  value: string;
  filters: Partial<BIGlobalFilters>;
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
  setLoading: (value: boolean) => void;
}

const DEFAULT_FILTERS: BIGlobalFilters = {
  startDate: startOfMonth(new Date()),
  endDate: endOfMonth(new Date()),
  periodPreset: "current",

  unit: "all",
  payer: "all",
  category: "all",

  // ✅ NOVOS
  doctorId: "all",
  productionType: "all",

  agingRange: "all",
  receiptStatus: "all",
  origin: "all",
  viewType: "all",
};

const BIFilterContext = createContext<BIFilterContextValue | null>(null);

// Labels (mantém tudo consistente e bonito nos chips)
const rangeLabels: Record<AgingRange, string> = {
  "0-30": "0-30 dias",
  "31-60": "31-60 dias",
  "61-90": "61-90 dias",
  "90+": ">90 dias",
  all: "Todas",
};

const statusLabels: Record<ReceiptStatus, string> = {
  recebido: "Recebido",
  em_aberto: "Em Aberto",
  glosa: "Glosa",
  all: "Todos",
};

const originLabels: Record<DataOrigin, string> = {
  producao: "Produção",
  faturamento: "Faturamento",
  recebimento: "Recebimento",
  caixa: "Caixa",
  all: "Todos",
};

const viewLabels: Record<ViewType, string> = {
  caixa: "Caixa",
  competencia: "Competência",
  all: "Todos",
};

const productionTypeLabels: Record<ProductionType, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  BOX: "Box/Taxa",
  MAT_MED: "Mat/Med",
  PACOTE_BOX: "Pacote BOX",
  PACOTE_GTA: "Pacote GTA",
  all: "Todos",
};

export function BIFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<BIGlobalFilters>(DEFAULT_FILTERS);
  const [drilldownContext, setDrilldownContext] = useState<DrilldownContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const touchUpdated = useCallback(() => setLastUpdated(new Date()), []);

  // Helper: toggle para ficar Power BI (clicou de novo, limpa)
  const toggleFilter = useCallback(
    <K extends keyof BIGlobalFilters>(key: K, value: BIGlobalFilters[K]) => {
      setFiltersState((prev) => {
        const nextValue = prev[key] === value ? DEFAULT_FILTERS[key] : value;
        return { ...prev, [key]: nextValue };
      });
      touchUpdated();
    },
    [touchUpdated],
  );

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

    // ✅ NOVOS
    if (filters.doctorId !== "all") {
      active.push({
        key: "doctorId",
        label: "Médico",
        value: filters.doctorId,
        displayValue: "Selecionado",
      });
    }
    if (filters.productionType !== "all") {
      active.push({
        key: "productionType",
        label: "Tipo",
        value: String(filters.productionType),
        displayValue: productionTypeLabels[filters.productionType],
      });
    }

    if (filters.agingRange !== "all") {
      active.push({
        key: "agingRange",
        label: "Aging",
        value: filters.agingRange,
        displayValue: rangeLabels[filters.agingRange],
      });
    }
    if (filters.receiptStatus !== "all") {
      active.push({
        key: "receiptStatus",
        label: "Status",
        value: filters.receiptStatus,
        displayValue: statusLabels[filters.receiptStatus],
      });
    }
    if (filters.origin !== "all") {
      active.push({
        key: "origin",
        label: "Origem",
        value: filters.origin,
        displayValue: originLabels[filters.origin],
      });
    }
    if (filters.viewType !== "all") {
      active.push({
        key: "viewType",
        label: "Visão",
        value: filters.viewType,
        displayValue: viewLabels[filters.viewType],
      });
    }

    return active;
  }, [filters]);

  const setFilter = useCallback(
    <K extends keyof BIGlobalFilters>(key: K, value: BIGlobalFilters[K]) => {
      setFiltersState((prev) => ({ ...prev, [key]: value }));
      touchUpdated();
    },
    [touchUpdated],
  );

  const setFilters = useCallback(
    (updates: Partial<BIGlobalFilters>) => {
      setFiltersState((prev) => ({ ...prev, ...updates }));
      touchUpdated();
    },
    [touchUpdated],
  );

  const clearFilter = useCallback(
    (key: keyof BIGlobalFilters) => {
      setFiltersState((prev) => ({ ...prev, [key]: DEFAULT_FILTERS[key] }));
      touchUpdated();
    },
    [touchUpdated],
  );

  const clearAllFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    touchUpdated();
  }, [touchUpdated]);

  const setPeriodPreset = useCallback(
    (preset: PeriodPreset) => {
      const now = new Date();
      let start: Date;
      const end: Date = endOfMonth(now);

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

      setFiltersState((prev) => ({
        ...prev,
        startDate: start,
        endDate: end,
        periodPreset: preset,
      }));
      touchUpdated();
    },
    [touchUpdated],
  );

  const setCustomDateRange = useCallback(
    (start: Date, end: Date) => {
      setFiltersState((prev) => ({
        ...prev,
        startDate: start,
        endDate: end,
        periodPreset: "custom",
      }));
      touchUpdated();
    },
    [touchUpdated],
  );

  // Cross-filter handler - maps chart clicks to filter updates (Power BI style toggle)
  const onChartClick = useCallback(
    (type: string, value: string) => {
      switch (type) {
        case "payer":
          toggleFilter("payer", value);
          break;

        case "category":
          toggleFilter("category", value);
          break;

        case "aging": {
          const agingMap: Record<string, AgingRange> = {
            "0-30 dias": "0-30",
            "31-60 dias": "31-60",
            "61-90 dias": "61-90",
            "90+ dias": "90+",
            ">90 dias": "90+",
          };
          toggleFilter("agingRange", agingMap[value] || "all");
          break;
        }

        case "unit":
          toggleFilter("unit", value);
          break;

        case "funnel": {
          const originMap: Record<string, DataOrigin> = {
            Produzido: "producao",
            Faturado: "faturamento",
            Recebido: "recebimento",
            "Em Aberto": "faturamento",
            Caixa: "caixa",
          };
          toggleFilter("origin", originMap[value] || "all");
          break;
        }

        case "status": {
          const statusMap: Record<string, ReceiptStatus> = {
            Recebido: "recebido",
            "Em Aberto": "em_aberto",
            Glosa: "glosa",
          };
          toggleFilter("receiptStatus", statusMap[value] || "all");
          break;
        }

        // ✅ NOVOS (Power BI Mode)
        case "doctor":
          toggleFilter("doctorId", value);
          break;

        case "productionType":
          // value esperado: CONSULTA/EXAME/BOX/MAT_MED/PACOTE_BOX/PACOTE_GTA
          toggleFilter("productionType", (value as ProductionType) || "all");
          break;

        case "viewType":
          toggleFilter("viewType", (value as ViewType) || "all");
          break;

        default:
          // Se surgir um clique novo de gráfico, só ignora sem quebrar.
          break;
      }
    },
    [toggleFilter],
  );

  const openDrilldown = useCallback((context: DrilldownContext) => {
    setDrilldownContext(context);
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldownContext(null);
  }, []);

  const setLoading = useCallback((value: boolean) => {
    setIsLoading(value);
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
    setLoading,
  };

  return <BIFilterContext.Provider value={value}>{children}</BIFilterContext.Provider>;
}

export function useBIFilters() {
  const context = useContext(BIFilterContext);
  if (!context) {
    throw new Error("useBIFilters must be used within a BIFilterProvider");
  }
  return context;
}
