import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";
import { toast } from "sonner";
import {
  Settings,
  UnitConfig,
  Category,
  PaymentMethod,
  ExpandedSettings,
  ProductionTypeConfig,
  ExamTypeConfig,
  PayerConfig,
  SystemParameters,
  SpecialtyConfig,
  PaymentMethodParticularConfig,
} from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_UNITS, DEFAULT_PAYMENT_METHODS_PARTICULAR } from "@/utils/constants";

interface CompanyFinancialSettings {
  id: string;
  company_id: string;
  categories: Json;
  units: Json;
  payment_methods: Json;
  initial_balance: number;
  initial_balance_last_update: string | null;
  initial_balance_adjustments: Json;
  extended_settings?: Json;
}

const DEFAULT_SETTINGS: Settings = {
  units: DEFAULT_UNITS,
  categories: [],
  paymentMethods: ["PIX", "TRANSFER", "CASH", "CARD", "BOLETO"],
  initialBalance: 0,
};

const DEFAULT_EXTENDED: ExpandedSettings = {
  ...DEFAULT_SETTINGS,
  productionTypes: [],
  examTypes: [],
  payers: [],
  specialties: [],
  systemParameters: undefined,
  paymentMethodsParticular: DEFAULT_PAYMENT_METHODS_PARTICULAR,
};

/**
 * Hook for managing company settings stored in Supabase
 * Replaces localStorage-based settings with database persistence
 */
export function useCompanySettings() {
  const { currentCompany, isAuthenticated, dataLoaded } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [extendedSettings, setExtendedSettings] = useState<ExpandedSettings>(DEFAULT_EXTENDED);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!currentCompany?.id) {
      setSettings(DEFAULT_SETTINGS);
      setExtendedSettings(DEFAULT_EXTENDED);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("company_financial_settings")
        .select("*")
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error) {
        setLoading(false);
        return;
      }

      if (data) {
        setSettingsId(data.id);

        // Parse units (guardrail: never allow empty / missing defaults)
        const rawUnits = Array.isArray(data.units) ? (data.units as unknown as any[]) : [];

        const normalizedUnits: UnitConfig[] = rawUnits
          .map((u) => {
            if (typeof u === "string") {
              return {
                id: u,
                name: u,
                active: true,
                subunits: [],
              } as UnitConfig;
            }
            if (!u || typeof u !== "object") return null;
            const obj: any = u;
            return {
              id: String(obj.id ?? obj.name ?? ""),
              name: String(obj.name ?? obj.id ?? "Unidade"),
              active: obj.active ?? true,
              subunits: Array.isArray(obj.subunits) ? obj.subunits : [],
              specialties: Array.isArray(obj.specialties) ? obj.specialties : undefined,
            } as UnitConfig;
          })
          .filter(Boolean) as UnitConfig[];

        const byId = new Map(normalizedUnits.map((u) => [u.id, u]));
        DEFAULT_UNITS.forEach((def) => {
          const existing = byId.get(def.id);
          if (existing) {
            byId.set(def.id, {
              ...existing,
              name: existing.name || def.name,
              active: existing.active ?? true,
            });
          } else {
            byId.set(def.id, def);
          }
        });

        const units: UnitConfig[] = Array.from(byId.values());
        // Parse categories
        const categories: Category[] = Array.isArray(data.categories) ? (data.categories as unknown as Category[]) : [];

        // Parse payment methods
        const paymentMethods: PaymentMethod[] = Array.isArray(data.payment_methods)
          ? (data.payment_methods as unknown as PaymentMethod[])
          : ["PIX", "TRANSFER", "CASH", "CARD", "BOLETO"];

        // Parse initial balance adjustments
        const initialBalanceAdjustments = Array.isArray(data.initial_balance_adjustments)
          ? data.initial_balance_adjustments
          : [];

        const baseSettings: Settings = {
          units,
          categories,
          paymentMethods,
          initialBalance: data.initial_balance || 0,
          initialBalanceLastUpdate: data.initial_balance_last_update || undefined,
          initialBalanceAdjustments: initialBalanceAdjustments as any,
        };

        setSettings(baseSettings);

        // Parse extended settings from dedicated columns
        const rawData = data as any;
        const productionTypes = Array.isArray(rawData.production_types)
          ? (rawData.production_types as ProductionTypeConfig[])
          : [];
        const examTypes = Array.isArray(rawData.exam_types) ? (rawData.exam_types as ExamTypeConfig[]) : [];
        const payers = Array.isArray(rawData.payers) ? (rawData.payers as PayerConfig[]) : [];
        // Normalizar specialties: converter string[] legado para SpecialtyConfig[]
        const rawSpecialties = Array.isArray(rawData.specialties) ? rawData.specialties : [];
        const specialties: SpecialtyConfig[] = rawSpecialties
          .map((s: any) => {
            // Se for string legado, converter para objeto
            if (typeof s === "string") {
              const id = s
                .trim()
                .toUpperCase()
                .replace(/\s+/g, "_")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
              return { id, name: s.trim(), active: true };
            }
            // Se for objeto, validar id e name
            if (s && typeof s === "object" && s.id && s.name) {
              return {
                id: String(s.id),
                name: String(s.name),
                active: s.active !== false,
              };
            }
            // Item inválido - ignorar
            return null;
          })
          .filter((s: SpecialtyConfig | null): s is SpecialtyConfig => s !== null);
        const systemParameters = rawData.system_parameters || undefined;

        // Normalizar paymentMethodsParticular: usar padrão se ausente/vazio
        const rawPaymentMethods = Array.isArray(rawData.payment_methods_particular)
          ? rawData.payment_methods_particular
          : [];

        // Normalizar e filtrar items inválidos
        const paymentMethodsParticular: PaymentMethodParticularConfig[] =
          rawPaymentMethods.length > 0
            ? rawPaymentMethods
                .map((m: any) => {
                  if (m && typeof m === "object" && m.id && m.name) {
                    return {
                      id: String(m.id),
                      name: String(m.name),
                      active: m.active !== false,
                    };
                  }
                  return null;
                })
                .filter((m: PaymentMethodParticularConfig | null): m is PaymentMethodParticularConfig => m !== null)
            : DEFAULT_PAYMENT_METHODS_PARTICULAR;

        const extended: ExpandedSettings = {
          ...baseSettings,
          productionTypes,
          examTypes,
          payers,
          specialties,
          systemParameters,
          paymentMethodsParticular,
        };

        setExtendedSettings(extended);
      } else {
        // No settings found - create default
        const { data: newData, error: insertError } = await supabase
          .from("company_financial_settings")
          .insert({
            company_id: currentCompany.id,
            units: DEFAULT_UNITS as unknown as Json,
            categories: [] as unknown as Json,
            payment_methods: ["PIX", "TRANSFER", "CASH", "CARD"] as unknown as Json,
            initial_balance: 0,
            initial_balance_adjustments: [] as unknown as Json,
          })
          .select()
          .single();

        if (insertError) {
          // Silent fail
        } else if (newData) {
          setSettingsId(newData.id);
        }

        setSettings(DEFAULT_SETTINGS);
        setExtendedSettings(DEFAULT_EXTENDED);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [currentCompany?.id]);

  // Load settings when company changes
  useEffect(() => {
    if (isAuthenticated && dataLoaded && currentCompany?.id) {
      loadSettings();
    }
  }, [isAuthenticated, dataLoaded, currentCompany?.id, loadSettings]);

  // React to global realtime version changes (e.g. settings updated in another tab)
  const { version } = useGlobalRealtime();
  useEffect(() => {
    if (initialLoadDone.current && currentCompany?.id) {
      loadSettings();
    }
  }, [version]);

  // Update settings in database
  const updateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      if (!currentCompany?.id || !settingsId) {
        toast.error("Empresa não selecionada");
        return false;
      }

      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);

      // Build update object
      const dbUpdate: Record<string, Json> = {};

      if (updates.units !== undefined) {
        dbUpdate.units = updates.units as unknown as Json;
      }
      if (updates.categories !== undefined) {
        dbUpdate.categories = updates.categories as unknown as Json;
      }
      if (updates.paymentMethods !== undefined) {
        dbUpdate.payment_methods = updates.paymentMethods as unknown as Json;
      }
      if (updates.initialBalance !== undefined) {
        (dbUpdate as any).initial_balance = updates.initialBalance;
        (dbUpdate as any).initial_balance_last_update = new Date().toISOString();
      }
      if (updates.initialBalanceAdjustments !== undefined) {
        dbUpdate.initial_balance_adjustments = updates.initialBalanceAdjustments as unknown as Json;
      }

      try {
        const { error } = await supabase.from("company_financial_settings").update(dbUpdate).eq("id", settingsId);

        if (error) {
          toast.error("Erro ao salvar configurações");
          return false;
        }

        return true;
      } catch (err) {
        toast.error("Erro ao salvar configurações");
        return false;
      }
    },
    [currentCompany?.id, settingsId, settings],
  );

  // Update extended settings (production types, exam types, etc.)
  const updateExtendedSettings = useCallback(
    async (updates: Partial<ExpandedSettings>) => {
      if (!currentCompany?.id || !settingsId) {
        toast.error("Empresa não selecionada");
        return false;
      }

      const newExtended = { ...extendedSettings, ...updates };
      setExtendedSettings(newExtended);

      // Also update base settings if included
      const baseUpdates: Partial<Settings> = {};
      if (updates.units !== undefined) baseUpdates.units = updates.units;
      if (updates.categories !== undefined) baseUpdates.categories = updates.categories;
      if (updates.paymentMethods !== undefined) baseUpdates.paymentMethods = updates.paymentMethods;
      if (updates.initialBalance !== undefined) baseUpdates.initialBalance = updates.initialBalance;

      if (Object.keys(baseUpdates).length > 0) {
        setSettings((prev) => ({ ...prev, ...baseUpdates }));
      }

      // Extended settings are stored in dedicated columns
      const dbUpdate: Record<string, unknown> = {};

      if (updates.units !== undefined) {
        dbUpdate.units = updates.units;
      }
      if (updates.categories !== undefined) {
        dbUpdate.categories = updates.categories;
      }
      if (updates.paymentMethods !== undefined) {
        dbUpdate.payment_methods = updates.paymentMethods;
      }
      if (updates.initialBalance !== undefined) {
        dbUpdate.initial_balance = updates.initialBalance;
        dbUpdate.initial_balance_last_update = new Date().toISOString();
      }
      // Save extended settings to dedicated columns
      if (updates.productionTypes !== undefined) {
        dbUpdate.production_types = updates.productionTypes;
      }
      if (updates.examTypes !== undefined) {
        dbUpdate.exam_types = updates.examTypes;
      }
      if (updates.payers !== undefined) {
        dbUpdate.payers = updates.payers;
      }
      if (updates.specialties !== undefined) {
        dbUpdate.specialties = updates.specialties;
      }
      if (updates.systemParameters !== undefined) {
        dbUpdate.system_parameters = updates.systemParameters;
      }
      if (updates.paymentMethodsParticular !== undefined) {
        dbUpdate.payment_methods_particular = updates.paymentMethodsParticular;
      }

      try {
        const { error } = await supabase
          .from("company_financial_settings")
          .update(dbUpdate as any)
          .eq("id", settingsId);

        if (error) {
          toast.error("Erro ao salvar configurações");
          return false;
        }

        return true;
      } catch (err) {
        toast.error("Erro ao salvar configurações");
        return false;
      }
    },
    [currentCompany?.id, settingsId, extendedSettings],
  );

  // Get saved suggestions (exam types, therapy types, production types)
  // These are stored in memory after loading from extended settings
  const getSavedExamTypes = useCallback((): string[] => {
    return extendedSettings.examTypes?.map((e) => e.name) || [];
  }, [extendedSettings.examTypes]);

  const getSavedTherapyTypes = useCallback((): string[] => {
    // Filter exam types that are therapy-related
    return extendedSettings.examTypes?.filter((e) => e.category === "TERAPIA").map((e) => e.name) || [];
  }, [extendedSettings.examTypes]);

  const getSavedProductionTypes = useCallback((): string[] => {
    return extendedSettings.productionTypes?.map((p) => p.name) || [];
  }, [extendedSettings.productionTypes]);

  // Add a new suggestion (persisted to DB)
  const addExamType = useCallback(
    async (name: string) => {
      const existing = extendedSettings.examTypes || [];
      if (existing.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        return; // Already exists
      }

      const newExam: ExamTypeConfig = {
        id: crypto.randomUUID(),
        name,
        linkedProductionType: "EXAME",
        category: "OUTRO",
        active: true,
        createdAt: new Date().toISOString(),
      };

      await updateExtendedSettings({
        examTypes: [...existing, newExam],
      });
    },
    [extendedSettings.examTypes, updateExtendedSettings],
  );

  const addTherapyType = useCallback(
    async (name: string) => {
      const existing = extendedSettings.examTypes || [];
      if (existing.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        return;
      }

      const newTherapy: ExamTypeConfig = {
        id: crypto.randomUUID(),
        name,
        linkedProductionType: "SESSAO_TERAPEUTICA",
        category: "TERAPIA",
        active: true,
        createdAt: new Date().toISOString(),
      };

      await updateExtendedSettings({
        examTypes: [...existing, newTherapy],
      });
    },
    [extendedSettings.examTypes, updateExtendedSettings],
  );

  const addProductionType = useCallback(
    async (name: string) => {
      const existing = extendedSettings.productionTypes || [];
      if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return;
      }

      const newType: ProductionTypeConfig = {
        id: crypto.randomUUID(),
        name,
        active: true,
        allowBatchEntry: false,
        requiresDetail: false,
        valueModel: "TOTAL",
        createdAt: new Date().toISOString(),
      };

      await updateExtendedSettings({
        productionTypes: [...existing, newType],
      });
    },
    [extendedSettings.productionTypes, updateExtendedSettings],
  );

  return {
    settings,
    extendedSettings,
    loading,
    updateSettings,
    updateExtendedSettings,
    refetch: loadSettings,
    // Suggestion helpers
    getSavedExamTypes,
    getSavedTherapyTypes,
    getSavedProductionTypes,
    addExamType,
    addTherapyType,
    addProductionType,
  };
}
