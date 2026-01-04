import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
} from "@/types";
import type { Json } from "@/integrations/supabase/types";

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
  units: [],
  categories: [],
  paymentMethods: ["PIX", "TRANSFER", "CASH", "CARD"],
  initialBalance: 0,
};

const DEFAULT_EXTENDED: ExpandedSettings = {
  ...DEFAULT_SETTINGS,
  productionTypes: [],
  examTypes: [],
  payers: [],
  systemParameters: undefined,
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

        // Parse units
        const units: UnitConfig[] = Array.isArray(data.units) 
          ? (data.units as unknown as UnitConfig[])
          : [];

        // Parse categories
        const categories: Category[] = Array.isArray(data.categories)
          ? (data.categories as unknown as Category[])
          : [];

        // Parse payment methods
        const paymentMethods: PaymentMethod[] = Array.isArray(data.payment_methods)
          ? (data.payment_methods as unknown as PaymentMethod[])
          : ["PIX", "TRANSFER", "CASH", "CARD"];

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

        // Parse extended settings (stored in a JSON field or derived)
        // For now, extended settings are stored alongside in same row
        const rawExtended = data as any;
        const extended: ExpandedSettings = {
          ...baseSettings,
          productionTypes: rawExtended.production_types || [],
          examTypes: rawExtended.exam_types || [],
          payers: rawExtended.payers || [],
          systemParameters: rawExtended.system_parameters || undefined,
        };

        setExtendedSettings(extended);
      } else {
        // No settings found - create default
        const { data: newData, error: insertError } = await supabase
          .from("company_financial_settings")
          .insert({
            company_id: currentCompany.id,
            units: [] as unknown as Json,
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
        const { error } = await supabase
          .from("company_financial_settings")
          .update(dbUpdate)
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
    [currentCompany?.id, settingsId, settings]
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

      // Extended settings are stored in the same row for simplicity
      // In a more complex system, you might use a separate table
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
    [currentCompany?.id, settingsId, extendedSettings]
  );

  // Get saved suggestions (exam types, therapy types, production types)
  // These are stored in memory after loading from extended settings
  const getSavedExamTypes = useCallback((): string[] => {
    return extendedSettings.examTypes?.map((e) => e.name) || [];
  }, [extendedSettings.examTypes]);

  const getSavedTherapyTypes = useCallback((): string[] => {
    // Filter exam types that are therapy-related
    return extendedSettings.examTypes
      ?.filter((e) => e.category === "TERAPIA")
      .map((e) => e.name) || [];
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
    [extendedSettings.examTypes, updateExtendedSettings]
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
    [extendedSettings.examTypes, updateExtendedSettings]
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
    [extendedSettings.productionTypes, updateExtendedSettings]
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
