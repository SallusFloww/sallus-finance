import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseISO, format } from "date-fns";
import { Production, ProductionStatus, ProductionType, ProductionStats, ProductionHistoryEntry } from "@/types";
import { toast } from "sonner";
import { useGlobalRealtime } from "@/contexts/GlobalRealtimeProvider";

export interface ProductionFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: ProductionStatus;
  productionType?: ProductionType;
  payerType?: "CONVENIO" | "PARTICULAR";
  convenio?: string;
  competencia?: string;
  search?: string;
  includeCancelled?: boolean;
}

interface DBProduction {
  id: string;
  company_id: string;
  production_date: string;
  competencia: string;
  unit: string;
  specialty: string | null;

  doctor_id: string | null;

  payer_type: string;
  health_plan_id: string | null;
  payment_method: string | null;
  production_type: string;
  description: string;
  procedure_code: string | null;
  quantity: number;
  unit_value: number;
  total_value: number;
  billed_value: number | null;
  received_value: number | null;
  glossed_value: number | null;
  status: string;
  linked_receivable_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  history: any;
  edit_logs: Array<{
    field: string;
    previousValue: string;
    newValue: string;
    editedAt: string;
    editedBy: string;
  }>;

  is_package: boolean | null;
  package_type: string | null;
  package_qty: number | null;
  consult_amount: number | null;
  fee_amount: number | null;
  matmed_amount: number | null;

  paciente_nome: string | null;
  import_batch_id: string | null;
  import_row_number: number | null;
  import_source: string;
}

function normalizeProcedureName(
  description: string | null | undefined,
  productionType: string | null | undefined,
  patientName?: string | null,
): string {
  const patient = (patientName || "").trim();
  const typeRaw = (productionType || "").trim();

  const fromType =
    typeRaw === "CONSULTA"
      ? "Consulta Médica"
      : typeRaw
        ? typeRaw
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "—";

  const raw = (description || "").trim() || fromType;
  const safe = raw && patient && raw.trim() === patient.trim() ? fromType : raw;
  const normalized = safe.trim().toLowerCase() === "consulta" ? "Consulta Médica" : safe;

  return normalized || fromType || "—";
}

function toProduction(db: DBProduction): Production {
  const isPackage =
    db.is_package === true || db.production_type === "PACOTE_BOX" || db.production_type === "PACOTE_GTA";

  const normalizedDescription = normalizeProcedureName(db.description, db.production_type, db.paciente_nome);

  return {
    id: db.id,
    productionDate: db.production_date,
    competencia: db.competencia,
    unit: db.unit,
    specialty: typeof db.specialty === "string" && db.specialty.trim().length > 0 ? db.specialty : "SEM_ESPECIALIDADE",

    doctorId: db.doctor_id || undefined,

    payerType: db.payer_type as "CONVENIO" | "PARTICULAR",
    convenio: db.health_plan_id || undefined,
    paymentMethod: db.payment_method || undefined,
    productionType: db.production_type,
    description: normalizedDescription,
    procedureCode: db.procedure_code || undefined,
    quantity: Number(db.quantity),
    unitValue: Number(db.unit_value),
    estimatedValue: Number(db.total_value),
    billedValue: db.billed_value ? Number(db.billed_value) : undefined,
    receivedValue: db.received_value ? Number(db.received_value) : undefined,
    glossedValue: db.glossed_value ? Number(db.glossed_value) : undefined,
    status: db.status as ProductionStatus,
    linkedReceivableIds: db.linked_receivable_id ? [db.linked_receivable_id] : [],
    createdBy: db.created_by || "system",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    history: db.history || [],
    editLogs: db.edit_logs || [],

    isPackage,
    packageType: (db.package_type ?? undefined) as "PACOTE_BOX" | "PACOTE_GTA" | undefined,
    consultAmount: Number(db.consult_amount ?? 0),
    feeAmount: Number(db.fee_amount ?? 0),
    matmedAmount: Number(db.matmed_amount ?? 0),
    packageQty: Number(db.package_qty ?? db.quantity ?? 1),

    patientName: db.paciente_nome || undefined,
    importBatchId: db.import_batch_id || undefined,
    importRowNumber: db.import_row_number ?? undefined,
    importSource: db.import_source || "manual",
  };
}

function createHistoryEntry(
  action: ProductionHistoryEntry["action"],
  description: string,
  userName: string,
  amount?: number,
  linkedReceivableId?: string,
): ProductionHistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    description,
    timestamp: new Date().toISOString(),
    userName,
    amount,
    linkedReceivableId,
  };
}

export function useProductionDB() {
  const { currentCompany, profile } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { version: globalVersion } = useGlobalRealtime();

  const fetchProductions = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from("productions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("production_date", { ascending: false });

      if (fetchError) throw fetchError;

      setProductions((data || []).map((d) => toProduction(d as unknown as DBProduction)));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar produções");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchProductions();
  }, [fetchProductions, globalVersion]);

  const addProduction = useCallback(
    async (data: Omit<Production, "id" | "createdAt" | "status" | "history">): Promise<Production | null> => {
      if (!currentCompany?.id || !profile?.id) {
        toast.error("Usuário não autenticado");
        return null;
      }

      const totalValue = data.quantity * data.unitValue;

      const history = [
        createHistoryEntry(
          "CRIADO",
          `Produção registrada: ${data.quantity}x ${data.description}`,
          profile.full_name || "system",
          totalValue,
        ),
      ];

      const isPackage =
        data.isPackage === true || data.productionType === "PACOTE_BOX" || data.productionType === "PACOTE_GTA";

      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();

      const optimisticProduction: Production = {
        id: optimisticId,
        productionDate: data.productionDate,
        competencia: data.competencia,
        unit: data.unit,
        specialty: data.specialty,
        doctorId: data.doctorId,
        payerType: data.payerType,
        convenio: data.convenio,
        paymentMethod: data.paymentMethod,
        productionType: data.productionType,
        description: data.description,
        procedureCode: data.procedureCode,
        quantity: data.quantity,
        unitValue: data.unitValue,
        estimatedValue: totalValue,
        status: "PRODUZIDO",
        linkedReceivableIds: [],
        createdBy: profile.id,
        createdAt: now,
        updatedAt: now,
        history,
        editLogs: [],
        isPackage,
        packageType: isPackage ? data.packageType || (data.productionType as "PACOTE_BOX" | "PACOTE_GTA") : undefined,
        consultAmount: isPackage ? data.consultAmount || 0 : 0,
        feeAmount: isPackage ? data.feeAmount || 0 : 0,
        matmedAmount: isPackage ? data.matmedAmount || 0 : 0,
        packageQty: isPackage ? data.packageQty || data.quantity : 1,
      };

      setProductions((prev) => [optimisticProduction, ...prev]);

      const packageQty = isPackage ? data.packageQty || data.quantity : 1;
      const consultAmount = isPackage ? data.consultAmount || 0 : 0;
      const feeAmount = isPackage ? data.feeAmount || 0 : 0;
      const matmedAmount = isPackage ? Math.max(0, totalValue - consultAmount - feeAmount) : 0;

      const safeSpecialty =
        typeof data.specialty === "string" && data.specialty.trim().length > 0 ? data.specialty.trim() : null;

      const safeDoctorId = typeof data.doctorId === "string" && data.doctorId.trim().length > 0 ? data.doctorId : null;

      const insertPayload = {
        company_id: currentCompany.id,
        production_date: data.productionDate,
        competencia: data.competencia,
        unit: data.unit,
        specialty: safeSpecialty ?? "SEM_ESPECIALIDADE",
        doctor_id: safeDoctorId,
        payer_type: data.payerType,
        health_plan_id: data.convenio || null,
        payment_method: data.payerType === "PARTICULAR" ? data.paymentMethod || null : null,
        production_type: data.productionType,
        description: data.description,
        procedure_code: data.procedureCode || null,
        quantity: data.quantity,
        unit_value: data.unitValue,
        total_value: totalValue,
        status: "PRODUZIDO",
        created_by: profile.id,
        history: JSON.parse(JSON.stringify(history)),
        is_package: isPackage,
        package_type: isPackage ? data.packageType || data.productionType : null,
        package_qty: packageQty,
        consult_amount: consultAmount,
        fee_amount: feeAmount,
        matmed_amount: matmedAmount,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("productions")
        .insert([insertPayload])
        .select()
        .single();

      if (insertError) {
        console.error("createProduction insertError:", insertError);

        const errorMsg = insertError.message || "";

        if (errorMsg.includes("row-level security") || errorMsg.includes("permission denied")) {
          setProductions((prev) => prev.filter((p) => p.id !== optimisticId));
          toast.error("Sem permissão para lançar produção nesta empresa. Verifique role Admin/Gestor.");
          return null;
        }

        if (errorMsg.includes("column") && errorMsg.includes("does not exist")) {
          const minimalPayload = {
            company_id: currentCompany.id,
            production_date: data.productionDate,
            competencia: data.competencia,
            unit: data.unit,
            specialty: safeSpecialty,
            doctor_id: safeDoctorId,
            payer_type: data.payerType,
            health_plan_id: data.convenio || null,
            production_type: data.productionType,
            description: data.description,
            procedure_code: data.procedureCode || null,
            quantity: data.quantity,
            unit_value: data.unitValue,
            total_value: totalValue,
            status: "PRODUZIDO",
            created_by: profile.id,
            history: JSON.parse(JSON.stringify(history)),
          };

          const { data: fallbackInserted, error: fallbackError } = await supabase
            .from("productions")
            .insert([minimalPayload])
            .select()
            .single();

          if (fallbackError) {
            setProductions((prev) => prev.filter((p) => p.id !== optimisticId));
            toast.error(fallbackError.message || "Erro ao criar produção");
            return null;
          }

          const fallbackProduction = toProduction(fallbackInserted as unknown as DBProduction);

          setProductions((prev) => {
            const withoutOptimistic = prev.filter((p) => p.id !== optimisticId);
            const alreadyExists = withoutOptimistic.some((p) => p.id === fallbackProduction.id);
            if (alreadyExists) {
              return withoutOptimistic.map((p) => (p.id === fallbackProduction.id ? fallbackProduction : p));
            }
            return [fallbackProduction, ...withoutOptimistic];
          });

          await fetchProductions();
          toast.success("Produção registrada (modo compatível)");
          return fallbackProduction;
        }

        setProductions((prev) => prev.filter((p) => p.id !== optimisticId));
        toast.error(errorMsg || "Erro ao criar produção");
        return null;
      }

      const realProduction = toProduction(inserted as unknown as DBProduction);

      setProductions((prev) => {
        const withoutOptimistic = prev.filter((p) => p.id !== optimisticId);
        const alreadyExists = withoutOptimistic.some((p) => p.id === realProduction.id);
        if (alreadyExists) {
          return withoutOptimistic.map((p) => (p.id === realProduction.id ? realProduction : p));
        }
        return [realProduction, ...withoutOptimistic];
      });

      await fetchProductions();
      toast.success("Produção registrada com sucesso");
      return realProduction;
    },
    [currentCompany?.id, profile, fetchProductions],
  );

  const updateProduction = useCallback(
    async (id: string, data: Partial<Production>, userName: string) => {
      const production = productions.find((p) => p.id === id);

      if (!production || production.status !== "PRODUZIDO") {
        toast.error("Apenas produções com status PRODUZIDO podem ser editadas");
        return;
      }

      const editLog = {
        field: "multiple",
        previousValue: JSON.stringify(production),
        newValue: JSON.stringify(data),
        editedAt: new Date().toISOString(),
        editedBy: userName,
      };

      const history = [...(production.history || [])];
      history.push(createHistoryEntry("EDITADO", "Produção atualizada", userName));

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        edit_logs: [...(production.editLogs || []), editLog],
        history,
      };

      if (data.description !== undefined) updateData.description = data.description;
      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.unitValue !== undefined) updateData.unit_value = data.unitValue;

      if (data.doctorId !== undefined) {
        const safeDoctorId =
          typeof data.doctorId === "string" && data.doctorId.trim().length > 0 ? data.doctorId : null;
        updateData.doctor_id = safeDoctorId;
      }

      // Campos expandidos para edição
      if (data.productionDate !== undefined) updateData.production_date = data.productionDate;
      if (data.competencia !== undefined) updateData.competencia = data.competencia;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.payerType !== undefined) updateData.payer_type = data.payerType;
      if (data.convenio !== undefined) updateData.health_plan_id = data.convenio || null;
      if (data.paymentMethod !== undefined) updateData.payment_method = data.paymentMethod || null;
      if (data.specialty !== undefined) {
        updateData.specialty = typeof data.specialty === "string" && data.specialty.trim().length > 0
          ? data.specialty.trim() : null;
      }
      if (data.procedureCode !== undefined) updateData.procedure_code = data.procedureCode || null;
      if (data.productionType !== undefined) updateData.production_type = data.productionType;

      if (data.quantity !== undefined || data.unitValue !== undefined) {
        const qty = data.quantity ?? production.quantity;
        const val = data.unitValue ?? production.unitValue;
        updateData.total_value = qty * val;
      }

      const isPackage =
        (data.isPackage ?? production.isPackage ?? production.productionType === "PACOTE_BOX") ||
        production.productionType === "PACOTE_GTA";

      const hasPackageFields =
        data.consultAmount !== undefined ||
        data.feeAmount !== undefined ||
        data.matmedAmount !== undefined ||
        data.packageQty !== undefined ||
        data.packageType !== undefined ||
        data.isPackage !== undefined;

      if (isPackage || hasPackageFields) {
        updateData.is_package = data.isPackage ?? production.isPackage ?? isPackage;
        updateData.package_type = data.packageType ?? production.packageType ?? production.productionType;
        updateData.consult_amount = data.consultAmount ?? production.consultAmount ?? 0;
        updateData.fee_amount = data.feeAmount ?? production.feeAmount ?? 0;
        updateData.matmed_amount = data.matmedAmount ?? production.matmedAmount ?? 0;
        updateData.package_qty = data.packageQty ?? production.packageQty ?? production.quantity ?? 1;
      }

      const { error: updateError } = await supabase.from("productions").update(updateData).eq("id", id);

      if (updateError) {
        console.error(updateError);
        toast.error("Erro ao atualizar produção");
        return;
      }

      await fetchProductions();
      toast.success("Produção atualizada");
    },
    [productions, fetchProductions],
  );

  const cancelProduction = useCallback(
    async (id: string, reason?: string) => {
      const production = productions.find((p) => p.id === id);
      if (!production) {
        toast.error("Produção não encontrada");
        return;
      }
      if (production.status !== "PRODUZIDO") {
        toast.error("Apenas produções com status PRODUZIDO podem ser canceladas");
        return;
      }

      const userName = profile?.full_name || "system";
      const history = [...(production.history || [])];
      history.push(
        createHistoryEntry(
          "CANCELADO" as any,
          reason ? `Produção cancelada. Motivo: ${reason}` : "Produção cancelada",
          userName,
        ),
      );

      const { error: updateError } = await supabase
        .from("productions")
        .update({
          status: "CANCELADO",
          updated_at: new Date().toISOString(),
          history: JSON.parse(JSON.stringify(history)),
        })
        .eq("id", id);

      if (updateError) {
        console.error(updateError);
        toast.error("Erro ao cancelar produção");
        return;
      }

      await fetchProductions();
      toast.success("Produção cancelada com sucesso");
    },
    [productions, profile, fetchProductions],
  );

  const deleteProduction = useCallback(
    async (id: string) => {
      await cancelProduction(id);
    },
    [cancelProduction],
  );

  const linkToReceivable = useCallback(
    async (productionIds: string[], receivableId: string, billedValue: number, userName: string) => {
      for (const id of productionIds) {
        const production = productions.find((p) => p.id === id);
        if (!production || production.status !== "PRODUZIDO") continue;

        const history = [...(production.history || [])];
        history.push(
          createHistoryEntry("VINCULADO_FATURAMENTO", "Vinculado ao faturamento", userName, billedValue, receivableId),
        );

        await supabase
          .from("productions")
          .update({
            status: "FATURADO",
            linked_receivable_id: receivableId,
            billed_value: billedValue,
            updated_at: new Date().toISOString(),
            history: JSON.parse(JSON.stringify(history)),
          })
          .eq("id", id);
      }

      await fetchProductions();
      toast.success("Produções vinculadas ao faturamento");
    },
    [productions, fetchProductions],
  );

  const markAsReceived = useCallback(
    async (productionIds: string[], receivedValue: number, userName: string) => {
      for (const id of productionIds) {
        const production = productions.find((p) => p.id === id);
        if (!production || production.status !== "FATURADO") continue;

        const history = [...(production.history || [])];
        history.push(createHistoryEntry("RECEBIDO", "Produção recebida", userName, receivedValue));

        await supabase
          .from("productions")
          .update({
            status: "RECEBIDO",
            received_value: receivedValue,
            updated_at: new Date().toISOString(),
            history: JSON.parse(JSON.stringify(history)),
          })
          .eq("id", id);
      }

      await fetchProductions();
      toast.success("Produções marcadas como recebidas");
    },
    [productions, fetchProductions],
  );

  const markAsGlossed = useCallback(
    async (productionIds: string[], glossedValue: number, userName: string) => {
      for (const id of productionIds) {
        const production = productions.find((p) => p.id === id);
        if (!production || production.status !== "FATURADO") continue;

        const history = [...(production.history || [])];
        history.push(createHistoryEntry("GLOSADO", "Produção glosada", userName, glossedValue));

        await supabase
          .from("productions")
          .update({
            status: "GLOSADO",
            glossed_value: glossedValue,
            updated_at: new Date().toISOString(),
            history: JSON.parse(JSON.stringify(history)),
          })
          .eq("id", id);
      }

      await fetchProductions();
      toast.success("Produções marcadas como glosadas");
    },
    [productions, fetchProductions],
  );

  const filterProductions = useCallback(
    (filters: ProductionFilters): Production[] => {
      return productions.filter((p) => {
        // Excluir cancelados por padrão, a menos que includeCancelled=true ou filtro explícito por CANCELADO
        if (p.status === "CANCELADO" && !filters.includeCancelled && filters.status !== "CANCELADO") return false;

        // UTC-safe date comparison: compare 'yyyy-MM-dd' strings directly
        // to avoid timezone shifts causing off-by-one-day errors in Brazil (UTC-3)
        if (filters.startDate && filters.endDate) {
          const productionDateStr = format(parseISO(p.productionDate), "yyyy-MM-dd");
          const startDateStr = format(filters.startDate, "yyyy-MM-dd");
          const endDateStr = format(filters.endDate, "yyyy-MM-dd");
          if (productionDateStr < startDateStr || productionDateStr > endDateStr) {
            return false;
          }
        }

        if (filters.unit && p.unit !== filters.unit) return false;
        if (filters.status && p.status !== filters.status) return false;
        if (filters.productionType && p.productionType !== filters.productionType) return false;
        if (filters.payerType && p.payerType !== filters.payerType) return false;
        if (filters.convenio && p.convenio !== filters.convenio) return false;
        if (filters.competencia && p.competencia !== filters.competencia) return false;

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesDescription = p.description.toLowerCase().includes(searchLower);
          const matchesConvenio = p.convenio?.toLowerCase().includes(searchLower);
          const matchesCode = p.procedureCode?.toLowerCase().includes(searchLower);
          const matchesPatient = p.patientName?.toLowerCase().includes(searchLower);
          if (!matchesDescription && !matchesConvenio && !matchesCode && !matchesPatient) return false;
        }

        return true;
      });
    },
    [productions],
  );

  const getStats = useCallback(
    (startDate?: Date, endDate?: Date): ProductionStats => {
      const filtered = startDate && endDate ? filterProductions({ startDate, endDate }) : productions;

      const stats: ProductionStats = {
        totalQuantityProduced: 0,
        totalQuantityBilled: 0,
        totalQuantityReceived: 0,
        totalQuantityOpen: 0,
        totalQuantityGlossed: 0,
        totalProduced: 0,
        totalBilled: 0,
        totalReceived: 0,
        totalOpen: 0,
        totalGlossed: 0,
        countProduced: 0,
        countBilled: 0,
        countReceived: 0,
        countOpen: 0,
        billingRate: 0,
        receiptRate: 0,
        conversionRate: 0,
        glossRate: 0,
        byProductionType: {} as Record<string, { count: number; quantity: number; value: number }>,
        byPayerType: { convenio: 0, particular: 0 },
        byPayerTypeQuantity: { convenio: 0, particular: 0 },
        consolidatedConsultas: { value: 0, quantity: 0 },
        consolidatedBoxTaxas: { value: 0, quantity: 0 },
        consolidatedMatMed: { value: 0 },
        byDoctor: {} as Record<string, { count: number; quantity: number; value: number }>,
        bySpecialty: {} as Record<string, number>,
      };

      const ensureType = (type: string) => {
        if (!stats.byProductionType[type]) {
          stats.byProductionType[type] = { count: 0, quantity: 0, value: 0 };
        }
      };

      const ensureDoctor = (doctorId: string) => {
        if (!stats.byDoctor) stats.byDoctor = {};
        if (!stats.byDoctor[doctorId]) {
          stats.byDoctor[doctorId] = { count: 0, quantity: 0, value: 0 };
        }
      };

      filtered.forEach((p) => {
        stats.totalProduced += p.estimatedValue;
        stats.totalQuantityProduced += p.quantity;
        stats.countProduced++;

        const unitNorm = (p.unit ?? "").toLowerCase().replace(/[\s\-_]+/g, "");
        const isCentroClinico = unitNorm === "centroclinico" || unitNorm.includes("centroclinico");

        if (isCentroClinico) {
          const specialtyKey = p.specialty ?? "SEM_ESPECIALIDADE";
          stats.bySpecialty[specialtyKey] = (stats.bySpecialty[specialtyKey] || 0) + p.estimatedValue;
        }

        const isPackage = p.isPackage || p.productionType === "PACOTE_BOX" || p.productionType === "PACOTE_GTA";
        const baseQty = isPackage ? (p.packageQty ?? p.quantity ?? 1) : 0;

        if (isPackage) {
          ensureType("CONSULTA");
          stats.byProductionType["CONSULTA"].count += 1;
          stats.byProductionType["CONSULTA"].quantity += baseQty;
          stats.byProductionType["CONSULTA"].value += p.consultAmount || 0;

          ensureType("BOX_PS");
          stats.byProductionType["BOX_PS"].count += 1;
          stats.byProductionType["BOX_PS"].quantity += baseQty;
          stats.byProductionType["BOX_PS"].value += p.feeAmount || 0;

          ensureType("MAT_MED");
          stats.byProductionType["MAT_MED"].count += 1;
          stats.byProductionType["MAT_MED"].quantity += 0;
          stats.byProductionType["MAT_MED"].value += p.matmedAmount || 0;
        } else {
          const reportType = p.productionType === "BOX_PS" ? "BOX_PS" : p.productionType;
          ensureType(reportType);
          stats.byProductionType[reportType].count++;
          stats.byProductionType[reportType].quantity += p.quantity;
          stats.byProductionType[reportType].value += p.estimatedValue;
        }

        if (p.payerType === "CONVENIO") {
          stats.byPayerType.convenio += p.estimatedValue;
          stats.byPayerTypeQuantity.convenio += p.quantity;
        } else {
          stats.byPayerType.particular += p.estimatedValue;
          stats.byPayerTypeQuantity.particular += p.quantity;
        }

        // Agrupamento por médico(a) (opcional)
        if ((p as any).doctorId) {
          const did = String((p as any).doctorId);
          ensureDoctor(did);
          stats.byDoctor![did].count += 1;
          stats.byDoctor![did].quantity += p.quantity ?? 0;
          stats.byDoctor![did].value += p.estimatedValue ?? 0;
        }

        if (isPackage) {
          stats.consolidatedConsultas.value += p.consultAmount || 0;
          stats.consolidatedConsultas.quantity += baseQty;

          stats.consolidatedBoxTaxas.value += p.feeAmount || 0;
          stats.consolidatedBoxTaxas.quantity += baseQty;

          stats.consolidatedMatMed.value += p.matmedAmount || 0;
        } else {
          if (p.productionType === "CONSULTA") {
            stats.consolidatedConsultas.value += p.estimatedValue;
            stats.consolidatedConsultas.quantity += p.quantity;
          } else if (p.productionType === "BOX_PS") {
            stats.consolidatedBoxTaxas.value += p.estimatedValue;
            stats.consolidatedBoxTaxas.quantity += p.quantity;
          }
        }

        switch (p.status) {
          case "PRODUZIDO":
            stats.totalOpen += p.estimatedValue;
            stats.totalQuantityOpen += p.quantity;
            stats.countOpen++;
            break;
          case "FATURADO":
            stats.totalBilled += p.billedValue || p.estimatedValue;
            stats.totalQuantityBilled += p.quantity;
            stats.countBilled++;
            break;
          case "RECEBIDO":
            stats.totalBilled += p.billedValue || p.estimatedValue;
            stats.totalReceived += p.receivedValue || 0;
            stats.totalQuantityBilled += p.quantity;
            stats.totalQuantityReceived += p.quantity;
            stats.countBilled++;
            stats.countReceived++;
            break;
          case "GLOSADO":
            stats.totalBilled += p.billedValue || p.estimatedValue;
            stats.totalGlossed += p.glossedValue || 0;
            stats.totalQuantityBilled += p.quantity;
            stats.totalQuantityGlossed += p.quantity;
            stats.countBilled++;
            break;
        }
      });

      if (stats.totalQuantityProduced > 0) {
        stats.billingRate = (stats.totalQuantityBilled / stats.totalQuantityProduced) * 100;
        stats.conversionRate = (stats.totalQuantityReceived / stats.totalQuantityProduced) * 100;
      }
      if (stats.totalQuantityBilled > 0) {
        stats.receiptRate = (stats.totalQuantityReceived / stats.totalQuantityBilled) * 100;
        stats.glossRate = (stats.totalQuantityGlossed / stats.totalQuantityBilled) * 100;
      }

      return stats;
    },
    [productions, filterProductions],
  );

  const openProductions = useMemo(() => productions.filter((p) => p.status === "PRODUZIDO"), [productions]);
  const billedProductions = useMemo(() => productions.filter((p) => p.status === "FATURADO"), [productions]);

  const uniqueConvenios = useMemo(() => {
    const convenios = new Set<string>();
    productions.forEach((p) => {
      if (p.convenio) convenios.add(p.convenio);
    });
    return Array.from(convenios).sort();
  }, [productions]);

  const uniqueProcedureCodes = useMemo(() => {
    const codes = new Set<string>();
    productions.forEach((p) => {
      if (p.procedureCode) codes.add(p.procedureCode);
    });
    return Array.from(codes).sort();
  }, [productions]);

  const getProductionsByReceivable = useCallback(
    (receivableId: string): Production[] => {
      return productions.filter((p) => p.linkedReceivableIds?.includes(receivableId));
    },
    [productions],
  );

  return {
    productions,
    loading,
    error,
    refetch: fetchProductions,
    addProduction,
    updateProduction,
    deleteProduction,
    cancelProduction,
    linkToReceivable,
    markAsReceived,
    markAsGlossed,
    filterProductions,
    getStats,
    openProductions,
    billedProductions,
    uniqueConvenios,
    uniqueProcedureCodes,
    getProductionsByReceivable,
  };
}
