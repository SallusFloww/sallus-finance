import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate, getStartOfMonth, getEndOfMonth } from "@/utils/formatters";
import { 
  UNIT_LABELS, 
  STATUS_LABELS, 
  PAYMENT_METHOD_LABELS,
  RECEIPT_TYPE_LABELS,
  PAYMENT_METHOD_PARTICULAR_LABELS,
  OPERADORA_LABELS,
  DEFAULT_CATEGORIES,
  OPERADORAS,
  PAYMENT_METHODS_PARTICULAR,
  SPECIALTIES,
  SPECIALTY_LABELS,
  PRODUCTION_TYPE_LABELS,
} from "@/utils/constants";
import { toast } from "sonner";
import { Transaction, ReceiptType, PaymentMethodParticular, Operadora, Specialty } from "@/types";
import { excludeCancelled, isPending, isRealized } from "@/utils/statusHelpers";
import {
  ReportFilters,
  ReportExecutiveSummary,
  ReportAlerts,
  ReportRevenueMap,
  ReportUnitAnalysis,
  ReportConsolidatedTables,
  ReportExports,
} from "@/components/reports";
export default function Reports() {
  const { transactions, auditLog } = useApp();
  const { filterTransactions, getStats, settings } = transactions;
  const { logAction } = auditLog;
  
  // Compatibilidade com código legado
  const auth = { addAuditLog: (_a: string, _b: string, _c?: unknown) => {}, user: { name: "Sistema" } };
  const addAuditLog = auth.addAuditLog;

  const activeUnits = settings.units.filter((u) => u.active);
  const incomeCategories = settings.categories.filter((c) => c.type === "INCOME" && c.active);

  // ============= FILTROS CUMULATIVOS =============
  const [dateRange, setDateRange] = useState({
    start: getStartOfMonth(new Date()),
    end: getEndOfMonth(new Date()),
  });
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedReceiptType, setSelectedReceiptType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedOperadora, setSelectedOperadora] = useState<string>("all");
  const [directorMode, setDirectorMode] = useState<boolean>(false);

  // ============= DADOS FILTRADOS =============
  const filteredTransactions = useMemo(() => {
    let data = filterTransactions({
      startDate: dateRange.start,
      endDate: dateRange.end,
      unit: selectedUnit === "all" ? undefined : selectedUnit,
      type: selectedType === "all" ? undefined : (selectedType as "INCOME" | "EXPENSE"),
    });

    // Filtro por tipo de recebimento
    if (selectedReceiptType !== "all") {
      data = data.filter((t) => t.receiptType === selectedReceiptType);
    }

    // Filtro por categoria
    if (selectedCategory !== "all") {
      data = data.filter((t) => t.category === selectedCategory);
    }

    // Filtro por operadora
    if (selectedOperadora !== "all") {
      data = data.filter((t) => t.operadora === selectedOperadora);
    }

    return data;
  }, [
    filterTransactions,
    dateRange,
    selectedUnit,
    selectedType,
    selectedReceiptType,
    selectedCategory,
    selectedOperadora,
  ]);

  // Base de cálculo do relatório:
  // - Sempre exclui CANCELADOS
  // - Por padrão soma apenas REALIZADOS
  // - Em "Modo Diretor", inclui PENDENTES também (sem incluir CANCELADOS)
  const reportTransactions = useMemo(() => {
    const active = excludeCancelled(filteredTransactions);

    return directorMode
      ? active.filter((t) => isRealized(t.status) || isPending(t.status))
      : active.filter((t) => isRealized(t.status));
  }, [filteredTransactions, directorMode]);

  // ============= CÁLCULOS BASEADOS NOS FILTROS =============
  const filteredStats = useMemo(() => {
    const totalIncome = reportTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = reportTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const currentBalance = settings.initialBalance + totalIncome - totalExpense;

    return {
      initialBalance: settings.initialBalance,
      totalIncome,
      totalExpense,
      currentBalance,
      transactionCount: reportTransactions.length,
    };
  }, [reportTransactions, settings.initialBalance]);

  // ============= HELPER: NORMALIZAÇÃO DE CHAVES =============
  // Remove acentos, converte para uppercase, remove espaços/underscores extras
  const normalizeKey = (str: string | null | undefined): string => {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .toUpperCase()
      .replace(/[\s_-]+/g, "") // remove spaces, underscores, hyphens
      .trim();
  };

  // Resolve specialty value (ID or label) to canonical ID
  const resolveSpecialtyId = (value: string | null | undefined): string => {
    if (!value || value.trim() === "") return "SEM_ESPECIALIDADE";
    
    const normalized = normalizeKey(value);
    
    // Try matching by ID first
    const byId = SPECIALTIES.find(s => normalizeKey(s.id) === normalized);
    if (byId) return byId.id;
    
    // Try matching by name/label
    const byName = SPECIALTIES.find(s => normalizeKey(s.name) === normalized);
    if (byName) return byName.id;
    
    // Try partial match (for edge cases like "Hiperbarica" vs "HIPERBARICA")
    const partial = SPECIALTIES.find(s => 
      normalized.includes(normalizeKey(s.id)) || 
      normalizeKey(s.id).includes(normalized) ||
      normalized.includes(normalizeKey(s.name)) ||
      normalizeKey(s.name).includes(normalized)
    );
    if (partial) return partial.id;
    
    // Fallback: return normalized value or SEM_ESPECIALIDADE
    return normalized || "SEM_ESPECIALIDADE";
  };

  // ============= ANÁLISE POR UNIDADE (DETALHADA) COM ESPECIALIDADES =============
  const unitAnalysisDetailed = useMemo(() => {
    const incomeTransactions = reportTransactions.filter((t) => t.type === "INCOME");

    // [AUDIT_FIN_REPORT] Debug logs (DEV only)
    if (import.meta.env.DEV) {
      console.log("[AUDIT_FIN_REPORT] records_count =", reportTransactions.length);
      if (reportTransactions.length > 0) {
        console.log("[AUDIT_FIN_REPORT] sample_record =", {
          unit: reportTransactions[0]?.unit,
          specialty: reportTransactions[0]?.specialty,
          specialty_resolved: resolveSpecialtyId(reportTransactions[0]?.specialty),
          category: reportTransactions[0]?.category,
          type: reportTransactions[0]?.type,
          status: reportTransactions[0]?.status,
          amount: reportTransactions[0]?.amount,
        });
      }
    }

    return activeUnits
      .map((unit) => {
        const unitIncomeTransactions = incomeTransactions.filter((t) => t.unit === unit.id);
        const totalValue = unitIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const count = unitIncomeTransactions.length;
        const avgTicket = count > 0 ? totalValue / count : 0;

        // [AUDIT_FIN_REPORT] Log unit totals
        if (unit.id === "CENTRO_CLINICO") {
          if (import.meta.env.DEV) {
            console.log("[AUDIT_FIN_REPORT] totals_by_unit =", {
              unit: unit.id,
              incomeCount: count,
              totalIncome: totalValue,
            });
          
            // Log specialty distribution for Centro Clinico using resolved IDs
            const specialtyMap: Record<string, number> = {};
            let nullEmptyCount = 0;
            unitIncomeTransactions.forEach((t) => {
              const resolvedId = resolveSpecialtyId(t.specialty);
              if (resolvedId === "SEM_ESPECIALIDADE") {
                nullEmptyCount++;
              }
              specialtyMap[resolvedId] = (specialtyMap[resolvedId] || 0) + t.amount;
            });
            console.log("[AUDIT_FIN_REPORT] specialty_null_empty_count =", nullEmptyCount);
            console.log("[AUDIT_FIN_REPORT] totals_by_specialty_for_unit('CENTRO_CLINICO') =", specialtyMap);
          
            // Validate: sum of specialties should match unit total
            const specialtySum = Object.values(specialtyMap).reduce((a, b) => a + b, 0);
            console.log("[AUDIT_FIN_REPORT] validation =", {
              unitTotal: totalValue,
              specialtySum,
              match: Math.abs(totalValue - specialtySum) < 0.01,
            });
          
            // Log all transactions with their specialty for debug
            console.log("[AUDIT_FIN_REPORT] all_centro_clinico_transactions =", 
              unitIncomeTransactions.map(t => ({
                id: t.id?.substring(0, 8),
                specialty_raw: t.specialty,
                specialty_resolved: resolveSpecialtyId(t.specialty),
                amount: t.amount,
                status: t.status,
              }))
            );
          }
        }

        // Saídas da unidade
        const unitExpenseTransactions = reportTransactions.filter(
          (t) => t.type === "EXPENSE" && t.unit === unit.id
        );
        const unitExpense = unitExpenseTransactions.reduce((sum, t) => sum + t.amount, 0);

        // Quebra por categoria
        const categoryBreakdown: Record<string, { value: number; count: number }> = {};
        unitIncomeTransactions.forEach((t) => {
          const cat = t.category || "sem_categoria";
          if (!categoryBreakdown[cat]) {
            categoryBreakdown[cat] = { value: 0, count: 0 };
          }
          categoryBreakdown[cat].value += t.amount;
          categoryBreakdown[cat].count += 1;
        });

        const categoriesAnalysis = Object.entries(categoryBreakdown)
          .map(([cat, data]) => ({
            category: cat,
            categoryName: settings.categories.find((c) => c.id === cat || c.code === cat)?.name || PRODUCTION_TYPE_LABELS[cat] || cat,
            value: data.value,
            count: data.count,
            percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
            avgTicket: data.count > 0 ? data.value / data.count : 0,
          }))
          .sort((a, b) => b.value - a.value);

        // Particular x Convênios dentro da unidade
        const particularValue = unitIncomeTransactions
          .filter((t) => t.receiptType === "PARTICULAR")
          .reduce((sum, t) => sum + t.amount, 0);
        const convenioValue = unitIncomeTransactions
          .filter((t) => t.receiptType === "CONVENIO")
          .reduce((sum, t) => sum + t.amount, 0);

        // ESPECIALIDADES (apenas para Centro Clínico)
        let specialtiesAnalysis: Array<{
          specialty: Specialty | "SEM_ESPECIALIDADE";
          name: string;
          totalIncome: number;
          totalExpense: number;
          netBalance: number;
          count: number;
          avgTicket: number;
          percentage: number;
          categories: typeof categoriesAnalysis;
          particular: { value: number; percentage: number };
          convenio: { value: number; percentage: number };
          hasMovement: boolean;
        }> = [];

        if (unit.id === "CENTRO_CLINICO") {
          // Build specialty buckets including "Sem especialidade"
          const allSpecialties: Array<{ id: string; name: string }> = [
            ...SPECIALTIES,
            { id: "SEM_ESPECIALIDADE", name: "Sem especialidade" },
          ];

          specialtiesAnalysis = allSpecialties.map((spec) => {
            // Use resolveSpecialtyId for robust matching
            const specIncomeTransactions = unitIncomeTransactions.filter((t) => {
              const resolvedId = resolveSpecialtyId(t.specialty);
              return resolvedId === spec.id;
            });
            const specExpenseTransactions = unitExpenseTransactions.filter((t) => {
              const resolvedId = resolveSpecialtyId(t.specialty);
              return resolvedId === spec.id;
            });
            const specIncome = specIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
            const specExpense = specExpenseTransactions.reduce((sum, t) => sum + t.amount, 0);
            const specCount = specIncomeTransactions.length;
            const hasMovement = specIncome > 0 || specExpense > 0;

            // Categorias por especialidade
            const specCategoryBreakdown: Record<string, { value: number; count: number }> = {};
            specIncomeTransactions.forEach((t) => {
              const cat = t.category || "sem_categoria";
              if (!specCategoryBreakdown[cat]) {
                specCategoryBreakdown[cat] = { value: 0, count: 0 };
              }
              specCategoryBreakdown[cat].value += t.amount;
              specCategoryBreakdown[cat].count += 1;
            });

            const specCategories = Object.entries(specCategoryBreakdown)
              .map(([cat, data]) => ({
                category: cat,
                categoryName: settings.categories.find((c) => c.id === cat)?.name || cat,
                value: data.value,
                count: data.count,
                percentage: specIncome > 0 ? (data.value / specIncome) * 100 : 0,
                avgTicket: data.count > 0 ? data.value / data.count : 0,
              }))
              .sort((a, b) => b.value - a.value);

            // Particular x Convênios por especialidade
            const specParticular = specIncomeTransactions
              .filter((t) => t.receiptType === "PARTICULAR")
              .reduce((sum, t) => sum + t.amount, 0);
            const specConvenio = specIncomeTransactions
              .filter((t) => t.receiptType === "CONVENIO")
              .reduce((sum, t) => sum + t.amount, 0);

            return {
              specialty: spec.id as Specialty | "SEM_ESPECIALIDADE",
              name: spec.name,
              totalIncome: specIncome,
              totalExpense: specExpense,
              netBalance: specIncome - specExpense,
              count: specCount,
              avgTicket: specCount > 0 ? specIncome / specCount : 0,
              percentage: totalValue > 0 ? (specIncome / totalValue) * 100 : 0,
              categories: specCategories,
              particular: {
                value: specParticular,
                percentage: specIncome > 0 ? (specParticular / specIncome) * 100 : 0,
              },
              convenio: {
                value: specConvenio,
                percentage: specIncome > 0 ? (specConvenio / specIncome) * 100 : 0,
              },
              hasMovement, // Flag para indicar se tem movimentação
            };
          }).sort((a, b) => {
            // Especialidades com movimentação primeiro, depois por receita
            // Keep "Sem especialidade" last among those with movement
            if (a.hasMovement && !b.hasMovement) return -1;
            if (!a.hasMovement && b.hasMovement) return 1;
            if (a.specialty === "SEM_ESPECIALIDADE" && b.specialty !== "SEM_ESPECIALIDADE") return 1;
            if (a.specialty !== "SEM_ESPECIALIDADE" && b.specialty === "SEM_ESPECIALIDADE") return -1;
            return b.totalIncome - a.totalIncome;
          });
        }

        return {
          unit: unit.id,
          name: unit.name,
          totalIncome: totalValue,
          totalExpense: unitExpense,
          netBalance: totalValue - unitExpense,
          count,
          avgTicket,
          categories: categoriesAnalysis,
          particular: {
            value: particularValue,
            percentage: totalValue > 0 ? (particularValue / totalValue) * 100 : 0,
          },
          convenio: {
            value: convenioValue,
            percentage: totalValue > 0 ? (convenioValue / totalValue) * 100 : 0,
          },
          specialties: specialtiesAnalysis,
        };
      })
      .sort((a, b) => b.totalIncome - a.totalIncome);
  }, [reportTransactions, activeUnits, settings.categories]);

  // Alias para compatibilidade
  const unitAnalysis = unitAnalysisDetailed;

  const totalIncomeAllUnits = unitAnalysis.reduce((sum, u) => sum + u.totalIncome, 0);

  // ============= MICRO-RESUMO EXECUTIVO POR UNIDADE =============
  const getUnitExecutiveSummary = (unit: typeof unitAnalysisDetailed[0]) => {
    if (unit.totalIncome === 0 && unit.totalExpense === 0) {
      return "Sem movimentação no período.";
    }

    const parts: string[] = [];

    // Para Centro Clínico, destacar especialidade líder
    if (unit.unit === "CENTRO_CLINICO" && unit.specialties && unit.specialties.length > 0) {
      const activeSpecs = unit.specialties.filter((s) => s.hasMovement);
      if (activeSpecs.length > 0) {
        const topSpec = activeSpecs[0];
        if (topSpec.percentage >= 50) {
          parts.push(
            `Resultado sustentado majoritariamente pela especialidade ${topSpec.name} (${topSpec.percentage.toFixed(0)}% da receita do período).`
          );
        } else if (activeSpecs.length === 1) {
          parts.push(`Receita gerada exclusivamente por ${topSpec.name}.`);
        } else {
          const topNames = activeSpecs
            .slice(0, 2)
            .map((s) => s.name)
            .join(" e ");
          parts.push(`Receita distribuída entre ${topNames}.`);
        }
      } else {
        parts.push("Nenhuma especialidade com movimentação no período.");
      }
    } else {
      // Para outras unidades
      if (unit.categories.length > 0) {
        const topCat = unit.categories[0];
        if (topCat.percentage >= 50) {
          parts.push(
            `Principal fonte: ${topCat.categoryName} (${topCat.percentage.toFixed(0)}% das entradas).`
          );
        }
      }
    }

    // Situação do saldo
    if (unit.netBalance > 0) {
      parts.push(`Superávit de ${formatCurrency(unit.netBalance)}.`);
    } else if (unit.netBalance < 0) {
      parts.push(`Déficit de ${formatCurrency(Math.abs(unit.netBalance))}.`);
    }

    return parts.join(" ");
  };

  // ============= ANÁLISE POR CATEGORIA =============
  const categoryAnalysis = useMemo(() => {
    const incomeTransactions = reportTransactions.filter((t) => t.type === "INCOME");
    const categoryMap: Record<string, { value: number; count: number }> = {};

    incomeTransactions.forEach((t) => {
      const cat = t.category || "sem_categoria";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { value: 0, count: 0 };
      }
      categoryMap[cat].value += t.amount;
      categoryMap[cat].count += 1;
    });

    const totalValue = Object.values(categoryMap).reduce((sum, c) => sum + c.value, 0);

    return Object.entries(categoryMap)
      .map(([cat, data]) => ({
        category: cat,
        categoryName: settings.categories.find((c) => c.id === cat)?.name || cat,
        value: data.value,
        count: data.count,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [reportTransactions, settings.categories]);

  // ============= PARTICULAR x CONVÊNIOS =============
  const receiptTypeAnalysis = useMemo(() => {
    const incomeTransactions = reportTransactions.filter((t) => t.type === "INCOME");

    const particular = incomeTransactions
      .filter((t) => t.receiptType === "PARTICULAR")
      .reduce((sum, t) => sum + t.amount, 0);

    const convenio = incomeTransactions
      .filter((t) => t.receiptType === "CONVENIO")
      .reduce((sum, t) => sum + t.amount, 0);

    const total = particular + convenio;

    return {
      particular: {
        value: particular,
        percentage: total > 0 ? (particular / total) * 100 : 0,
      },
      convenio: {
        value: convenio,
        percentage: total > 0 ? (convenio / total) * 100 : 0,
      },
      total,
    };
  }, [reportTransactions]);

  // ============= ANÁLISE POR OPERADORA =============
  const operadoraAnalysis = useMemo(() => {
    const convenioTransactions = reportTransactions.filter(
      (t) => t.type === "INCOME" && t.receiptType === "CONVENIO"
    );

    const totalConvenio = convenioTransactions.reduce((sum, t) => sum + t.amount, 0);

    return OPERADORAS.map((op) => {
      const value = convenioTransactions
        .filter((t) => t.operadora === op.id)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        id: op.id,
        name: op.name,
        value,
        percentageOfConvenio: totalConvenio > 0 ? (value / totalConvenio) * 100 : 0,
        percentageOfTotal: totalIncomeAllUnits > 0 ? (value / totalIncomeAllUnits) * 100 : 0,
      };
    })
      .filter((op) => op.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [reportTransactions, totalIncomeAllUnits]);

  // ============= ANÁLISE POR MEIO DE PAGAMENTO (PARTICULAR) COM QTD E TICKET MÉDIO =============
  const paymentMethodAnalysis = useMemo(() => {
    const particularTransactions = reportTransactions.filter(
      (t) => t.type === "INCOME" && t.receiptType === "PARTICULAR"
    );

    const totalParticular = particularTransactions.reduce((sum, t) => sum + t.amount, 0);

    return PAYMENT_METHODS_PARTICULAR.map((pm) => {
      const pmTransactions = particularTransactions.filter(
        (t) => t.paymentMethodParticular === pm.id
      );
      const value = pmTransactions.reduce((sum, t) => sum + t.amount, 0);
      const count = pmTransactions.length;

      return {
        id: pm.id,
        name: pm.name,
        value,
        count,
        avgTicket: count > 0 ? value / count : 0,
        percentage: totalParticular > 0 ? (value / totalParticular) * 100 : 0,
      };
    })
      .filter((pm) => pm.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [reportTransactions]);

  // ============= MAPA DE RECEITA (TOP 3 CATEGORIAS POR UNIDADE) =============
  const revenueMap = useMemo(() => {
    const incomeTransactions = reportTransactions.filter((t) => t.type === "INCOME");
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

    const categoryUnitMap: Record<
      string,
      { unit: string; unitName: string; category: string; categoryName: string; value: number }
    > = {};

    incomeTransactions.forEach((t) => {
      const key = `${t.unit}_${t.category}`;
      const unitConfig = settings.units.find((u) => u.id === t.unit);
      const categoryConfig = settings.categories.find((c) => c.id === t.category);

      if (!categoryUnitMap[key]) {
        categoryUnitMap[key] = {
          unit: t.unit,
          unitName: unitConfig?.name || t.unit,
          category: t.category || "sem_categoria",
          categoryName: categoryConfig?.name || t.category || "Sem categoria",
          value: 0,
        };
      }
      categoryUnitMap[key].value += t.amount;
    });

    return Object.values(categoryUnitMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        percentage: totalIncome > 0 ? (item.value / totalIncome) * 100 : 0,
      }));
  }, [reportTransactions, settings.units, settings.categories]);

  // ============= ALERTAS GERENCIAIS COM TIPOS DE RISCO =============
  const managementAlerts = useMemo(() => {
    const alerts: { 
      type: "danger" | "warning" | "info"; 
      riskType: "Financeiro" | "Concentração" | "Dependência";
      riskIcon: string;
      unit?: string;
      specialty?: string;
      title: string; 
      description: string;
      value?: string;
    }[] = [];
    const totalIncome = filteredStats.totalIncome;

    // 1. Unidades com saldo negativo (🔴 Financeiro)
    unitAnalysisDetailed.forEach((u) => {
      if (u.netBalance < 0) {
        alerts.push({
          type: "danger",
          riskType: "Financeiro",
          riskIcon: "🔴",
          unit: u.name,
          title: `${u.name} — Saldo Negativo`,
          description: `Saldo líquido negativo no período filtrado.`,
          value: formatCurrency(u.netBalance),
        });

        // Especialidades com saldo negativo (Centro Clínico)
        if (u.unit === "CENTRO_CLINICO" && u.specialties) {
          u.specialties.forEach((spec) => {
            if (spec.netBalance < 0) {
              alerts.push({
                type: "danger",
                riskType: "Financeiro",
                riskIcon: "🔴",
                unit: u.name,
                specialty: spec.name,
                title: `${spec.name} (Centro Clínico) — Saldo Negativo`,
                description: `Especialidade com saldo líquido negativo.`,
                value: formatCurrency(spec.netBalance),
              });
            }
          });
        }
      }
    });

    // 2. Categorias com alta concentração (>50% do caixa) (🟡 Concentração)
    categoryAnalysis.forEach((c) => {
      if (c.percentage > 50) {
        alerts.push({
          type: "warning",
          riskType: "Concentração",
          riskIcon: "🟡",
          title: `Alta concentração em ${c.categoryName}`,
          description: `${c.percentage.toFixed(1)}% do caixa concentrado em uma única categoria.`,
          value: formatCurrency(c.value),
        });
      }
    });

    // 3. Dependência excessiva de uma única fonte de receita (🔵 Dependência)
    if (receiptTypeAnalysis.particular.percentage > 80) {
      alerts.push({
        type: "info",
        riskType: "Dependência",
        riskIcon: "🔵",
        title: "Alta dependência de Particular",
        description: `${receiptTypeAnalysis.particular.percentage.toFixed(1)}% da receita vem de atendimentos particulares.`,
        value: formatCurrency(receiptTypeAnalysis.particular.value),
      });
    }
    if (receiptTypeAnalysis.convenio.percentage > 80) {
      alerts.push({
        type: "info",
        riskType: "Dependência",
        riskIcon: "🔵",
        title: "Alta dependência de Convênios",
        description: `${receiptTypeAnalysis.convenio.percentage.toFixed(1)}% da receita vem de convênios.`,
        value: formatCurrency(receiptTypeAnalysis.convenio.value),
      });
    }

    // 4. Operadora dominante (🔵 Dependência)
    if (operadoraAnalysis.length > 0 && operadoraAnalysis[0].percentageOfConvenio > 70) {
      alerts.push({
        type: "warning",
        riskType: "Dependência",
        riskIcon: "🔵",
        title: `Dependência de ${operadoraAnalysis[0].name}`,
        description: `${operadoraAnalysis[0].percentageOfConvenio.toFixed(1)}% dos convênios concentrados em uma operadora.`,
        value: formatCurrency(operadoraAnalysis[0].value),
      });
    }

    // 5. Unidade dominante (🟡 Concentração)
    if (unitAnalysisDetailed.length > 0 && totalIncome > 0) {
      const topUnit = unitAnalysisDetailed[0];
      const topUnitPercentage = (topUnit.totalIncome / totalIncome) * 100;
      if (topUnitPercentage > 70) {
        alerts.push({
          type: "warning",
          riskType: "Concentração",
          riskIcon: "🟡",
          unit: topUnit.name,
          title: `${topUnit.name} concentra receita`,
          description: `${topUnitPercentage.toFixed(1)}% da receita vem de uma única unidade.`,
          value: formatCurrency(topUnit.totalIncome),
        });
      }

      // Especialidade dominante no Centro Clínico
      const ccUnit = unitAnalysisDetailed.find((u) => u.unit === "CENTRO_CLINICO");
      if (ccUnit && ccUnit.specialties && ccUnit.specialties.length > 0 && ccUnit.totalIncome > 0) {
        const topSpec = ccUnit.specialties[0];
        if (topSpec.percentage > 60) {
          alerts.push({
            type: "info",
            riskType: "Concentração",
            riskIcon: "🟡",
            unit: "Centro Clínico",
            specialty: topSpec.name,
            title: `${topSpec.name} concentra receita do Centro Clínico`,
            description: `${topSpec.percentage.toFixed(1)}% da receita do Centro Clínico vem desta especialidade.`,
            value: formatCurrency(topSpec.totalIncome),
          });
        }
      }
    }

    return alerts;
  }, [unitAnalysisDetailed, categoryAnalysis, receiptTypeAnalysis, operadoraAnalysis, filteredStats.totalIncome]);

  // ============= SUGESTÕES GERENCIAIS AUTOMÁTICAS =============
  const getManagementSuggestion = (alert: typeof managementAlerts[0]): string => {
    if (alert.riskType === "Financeiro") {
      if (alert.specialty) {
        return `Avaliar viabilidade da especialidade ${alert.specialty}. Considerar renegociação de custos ou reposicionamento de preços.`;
      }
      return `Revisar estrutura de custos da unidade ${alert.unit}. Identificar despesas reduzíveis e oportunidades de aumento de receita.`;
    }
    if (alert.riskType === "Concentração") {
      if (alert.specialty) {
        return `Desenvolver outras especialidades para reduzir dependência. Avaliar potencial de cross-selling entre serviços.`;
      }
      if (alert.unit) {
        return `Diversificar fontes de receita. Avaliar potencial de crescimento em outras unidades.`;
      }
      return `Buscar diversificação de categorias para mitigar risco de concentração.`;
    }
    if (alert.riskType === "Dependência") {
      if (alert.title.includes("Particular")) {
        return `Expandir parcerias com operadoras de saúde para equilibrar mix de receitas.`;
      }
      if (alert.title.includes("Convênios") || alert.title.includes("operadora")) {
        return `Fortalecer atendimento particular. Considerar novos convênios para diluir risco.`;
      }
    }
    return `Monitorar indicador e estabelecer plano de ação preventivo.`;
  };

  // ============= TAG DE PARTICIPAÇÃO NA UNIDADE =============
  const getParticipationTag = (percentage: number): { label: string; color: string } => {
    if (percentage === 0) {
      return { label: "Inativa", color: "bg-muted text-muted-foreground" };
    }
    if (percentage >= 40) {
      return { label: "Estratégica", color: "bg-primary/20 text-primary" };
    }
    if (percentage >= 15) {
      return { label: "Relevante", color: "bg-amber-500/20 text-amber-700" };
    }
    return { label: "Residual", color: "bg-muted text-muted-foreground" };
  };

  // ============= LEITURA EXECUTIVA DO PERÍODO (OBJETIVA) =============
  const executiveSummary = useMemo(() => {
    const insights: string[] = [];
    const totalIncome = filteredStats.totalIncome;
    const totalExpense = filteredStats.totalExpense;
    const netBalance = filteredStats.currentBalance - filteredStats.initialBalance;

    // Filtros ativos
    const hasFilters = selectedUnit !== "all" || selectedType !== "all" || selectedReceiptType !== "all" || selectedCategory !== "all" || selectedOperadora !== "all";

    // Unidade líder
    if (unitAnalysisDetailed.length > 0 && totalIncome > 0) {
      const topUnit = unitAnalysisDetailed[0];
      const topUnitPercentage = (topUnit.totalIncome / totalIncome) * 100;
      insights.push(`Unidade líder: ${topUnit.name} com ${formatCurrency(topUnit.totalIncome)} (${topUnitPercentage.toFixed(1)}% do total).`);
      
      // Especialidade líder (se Centro Clínico)
      if (topUnit.unit === "CENTRO_CLINICO" && topUnit.specialties && topUnit.specialties.length > 0) {
        const topSpec = topUnit.specialties[0];
        insights.push(`Especialidade líder no Centro Clínico: ${topSpec.name} com ${formatCurrency(topSpec.totalIncome)} (${topSpec.percentage.toFixed(1)}% da unidade).`);
      }
    }

    // Categoria líder
    if (categoryAnalysis.length > 0) {
      const topCategory = categoryAnalysis[0];
      insights.push(`Categoria líder: ${topCategory.categoryName} com ${formatCurrency(topCategory.value)} (${topCategory.percentage.toFixed(1)}% das entradas).`);
    }

    // Predominância Particular x Convênios
    if (receiptTypeAnalysis.particular.percentage > receiptTypeAnalysis.convenio.percentage) {
      insights.push(`Predominância: Particular com ${receiptTypeAnalysis.particular.percentage.toFixed(1)}% das entradas (${formatCurrency(receiptTypeAnalysis.particular.value)}).`);
    } else if (receiptTypeAnalysis.convenio.percentage > receiptTypeAnalysis.particular.percentage) {
      insights.push(`Predominância: Convênios com ${receiptTypeAnalysis.convenio.percentage.toFixed(1)}% das entradas (${formatCurrency(receiptTypeAnalysis.convenio.value)}).`);
    } else if (receiptTypeAnalysis.particular.value > 0 || receiptTypeAnalysis.convenio.value > 0) {
      insights.push(`Distribuição equilibrada: Particular ${receiptTypeAnalysis.particular.percentage.toFixed(1)}% / Convênios ${receiptTypeAnalysis.convenio.percentage.toFixed(1)}%.`);
    }

    // Situação final do período
    if (netBalance > 0) {
      insights.push(`Situação final do período: Superávit de ${formatCurrency(netBalance)}.`);
    } else if (netBalance < 0) {
      insights.push(`Situação final do período: Déficit de ${formatCurrency(Math.abs(netBalance))}.`);
    } else {
      insights.push(`Situação final do período: Equilíbrio (entradas = saídas).`);
    }

    // Unidades com saldo negativo
    const negativeUnits = unitAnalysisDetailed.filter((u) => u.netBalance < 0);
    if (negativeUnits.length > 0) {
      const names = negativeUnits.map((u) => `${u.name} (${formatCurrency(u.netBalance)})`).join(", ");
      insights.push(`Atenção: ${negativeUnits.length === 1 ? "Unidade" : "Unidades"} com saldo negativo: ${names}.`);
    }

    return insights;
  }, [filteredStats, unitAnalysisDetailed, categoryAnalysis, receiptTypeAnalysis, selectedUnit, selectedType, selectedReceiptType, selectedCategory, selectedOperadora]);

  // ============= EXPORTAÇÕES =============
  const exportCSV = () => {
    const headers = [
      "Data",
      "Tipo",
      "Valor",
      "Unidade",
      "Categoria",
      "Tipo Recebimento",
      "Operadora",
      "Forma de Pagamento",
      "Status",
      "Referência",
      "Observações",
      "Criado por",
      "Data Criação",
    ];

    const rows = filteredTransactions.map((t) => {
      const unitConfig = settings.units.find((u) => u.id === t.unit);
      return [
        formatDate(t.date),
        t.type === "INCOME" ? "Entrada" : "Saída",
        t.amount.toFixed(2),
        unitConfig?.name || t.unit,
        t.category,
        t.receiptType ? RECEIPT_TYPE_LABELS[t.receiptType] : "",
        t.operadora ? OPERADORA_LABELS[t.operadora] : "",
        t.paymentMethodParticular ? PAYMENT_METHOD_PARTICULAR_LABELS[t.paymentMethodParticular] : PAYMENT_METHOD_LABELS[t.paymentMethod],
        STATUS_LABELS[t.status] || "Realizado",
        t.reference || "",
        t.notes || "",
        t.createdBy,
        formatDate(t.createdAt),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_fluxo_caixa_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addAuditLog("EXPORT_DATA", `Relatório CSV exportado com ${filteredTransactions.length} registros`);
    toast.success("Relatório exportado com sucesso!");
  };

  const getAppliedFiltersText = () => {
    const filters: string[] = [];
    if (selectedUnit !== "all") {
      filters.push(`Unidade: ${settings.units.find(u => u.id === selectedUnit)?.name || selectedUnit}`);
    }
    if (selectedType !== "all") {
      filters.push(`Tipo: ${selectedType === "INCOME" ? "Entrada" : "Saída"}`);
    }
    if (selectedReceiptType !== "all") {
      filters.push(`Recebimento: ${RECEIPT_TYPE_LABELS[selectedReceiptType]}`);
    }
    if (selectedCategory !== "all") {
      filters.push(`Categoria: ${settings.categories.find(c => c.id === selectedCategory)?.name || selectedCategory}`);
    }
    if (selectedOperadora !== "all") {
      filters.push(`Operadora: ${OPERADORA_LABELS[selectedOperadora]}`);
    }
    return filters.length > 0 ? filters.join(" • ") : "Todos os dados";
  };

  const exportPDF = () => {
    // ============= VALIDAÇÃO AUTOMÁTICA ANTES DA GERAÇÃO =============
    // Checklist 1: Validação de dados matemáticos
    const expectedBalance = filteredStats.initialBalance + filteredStats.totalIncome - filteredStats.totalExpense;
    const balanceValidation = Math.abs(expectedBalance - filteredStats.currentBalance) < 0.01;
    
    // Checklist 2: Validação de percentuais (fecham 100%)
    const unitPercentageTotal = unitAnalysisDetailed.reduce((sum, u) => sum + (totalIncomeAllUnits > 0 ? (u.totalIncome / totalIncomeAllUnits) * 100 : 0), 0);
    const unitPercentageValid = totalIncomeAllUnits === 0 || Math.abs(unitPercentageTotal - 100) < 0.5;
    
    const categoryPercentageTotal = categoryAnalysis.reduce((sum, c) => sum + c.percentage, 0);
    const categoryPercentageValid = categoryPercentageTotal === 0 || Math.abs(categoryPercentageTotal - 100) < 0.5;
    
    const receiptTypeTotal = receiptTypeAnalysis.particular.percentage + receiptTypeAnalysis.convenio.percentage;
    const receiptTypeValid = receiptTypeTotal === 0 || Math.abs(receiptTypeTotal - 100) < 0.5;
    
    // Log de validação para auditoria
    const validationPassed = balanceValidation && unitPercentageValid && categoryPercentageValid && receiptTypeValid;
    
    const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const periodText = `${formatDate(dateRange.start.toISOString())} a ${formatDate(dateRange.end.toISOString())}`;
    const netBalance = filteredStats.currentBalance - filteredStats.initialBalance;
    
    // Determinar situação final do caixa
    let situacaoFinal = "Equilíbrio";
    if (netBalance > 0) {
      situacaoFinal = "Superávit";
    } else if (netBalance < 0) {
      situacaoFinal = "Déficit";
    }

    // Determinar predominância
    const totalParticular = unitAnalysisDetailed.reduce((sum, u) => sum + u.particular.value, 0);
    const totalConvenio = unitAnalysisDetailed.reduce((sum, u) => sum + u.convenio.value, 0);
    const predominancia = totalParticular > totalConvenio ? "Particular" : totalConvenio > totalParticular ? "Convênios" : "Equilibrado";
    const predominanciaPercent = totalIncomeAllUnits > 0 ? ((Math.max(totalParticular, totalConvenio) / totalIncomeAllUnits) * 100).toFixed(1) : 0;

    // Unidade e categoria líder
    const topUnit = unitAnalysisDetailed.length > 0 ? unitAnalysisDetailed[0] : null;
    const topCategory = categoryAnalysis.length > 0 ? categoryAnalysis[0] : null;

    // Filtrar Centro Clínico para seção dedicada
    const centroClinico = unitAnalysisDetailed.find(u => u.unit === "CENTRO_CLINICO");
    const outrasUnidades = unitAnalysisDetailed.filter(u => u.unit !== "CENTRO_CLINICO");

    // Numeração dinâmica de seções
    let sectionNum = 1;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Relatório Executivo - SallusFlow</title>
            <style>
              @page { size: A4; margin: 18mm 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 10px; }
              
              /* CAPA */
              .cover { 
                page-break-after: always; 
                height: 100vh; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                align-items: center; 
                text-align: center;
                background: linear-gradient(135deg, #0066b3 0%, #003d6b 100%);
                color: white;
                padding: 40px;
              }
              .cover-logo { font-size: 52px; font-weight: bold; margin-bottom: 15px; letter-spacing: 3px; }
              .cover-subtitle { font-size: 13px; opacity: 0.8; margin-bottom: 80px; text-transform: uppercase; letter-spacing: 5px; }
              .cover-title { font-size: 32px; font-weight: 600; margin-bottom: 15px; line-height: 1.3; }
              .cover-period { font-size: 20px; opacity: 0.95; margin-bottom: 100px; padding: 12px 30px; border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; }
              .cover-meta { font-size: 11px; opacity: 0.75; }
              .cover-meta div { margin: 8px 0; }
              
              /* HEADER/FOOTER GLOBAL */
              .page-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                padding: 12px 0; 
                border-bottom: 2px solid #0066b3; 
                margin-bottom: 20px;
              }
              .page-header-logo { font-size: 16px; font-weight: bold; color: #0066b3; letter-spacing: 1px; }
              .page-header-info { font-size: 9px; color: #666; text-align: right; line-height: 1.4; }
              
              /* SECTIONS */
              .section { margin-bottom: 25px; }
              .section-avoid-break { page-break-inside: avoid; }
              .section-title { 
                font-size: 14px; 
                font-weight: 600; 
                color: #0066b3; 
                margin-bottom: 15px; 
                padding-bottom: 8px;
                border-bottom: 2px solid #e0e0e0; 
                display: flex;
                align-items: center;
                gap: 10px;
              }
              .section-number {
                background: #0066b3;
                color: white;
                min-width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
              }
              
              /* CARDS */
              .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
              .card { padding: 18px 12px; border-radius: 10px; text-align: center; }
              .card-initial { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 1px solid #ddd; }
              .card-income { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 1px solid #4caf50; }
              .card-expense { background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); border: 1px solid #f44336; }
              .card-balance { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border: 1px solid #0066b3; }
              .card-label { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; }
              .card-value { font-size: 18px; font-weight: bold; margin-top: 8px; }
              .card-income .card-value { color: #2e7d32; }
              .card-expense .card-value { color: #c62828; }
              .card-balance .card-value { color: #0066b3; }
              
              /* TABLES */
              table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 10px; }
              thead { display: table-header-group; }
              th { background: #f1f3f4; padding: 10px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; color: #333; font-size: 9px; }
              th:not(:first-child) { text-align: right; }
              td { padding: 9px 8px; border-bottom: 1px solid #eee; }
              td:not(:first-child) { text-align: right; }
              tr:nth-child(even) { background: #fafafa; }
              .positive { color: #2e7d32; font-weight: 500; }
              .negative { color: #c62828; font-weight: 600; }
              
              /* EXECUTIVE BOX */
              .exec-box { 
                background: linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 100%); 
                padding: 18px; 
                border-radius: 10px; 
                border-left: 5px solid #0066b3; 
                margin-bottom: 20px;
              }
              .exec-box h4 { color: #0066b3; font-size: 12px; margin-bottom: 12px; font-weight: 600; }
              .exec-box p { font-size: 10px; margin: 6px 0; color: #333; line-height: 1.5; }
              .exec-highlight { background: #fff; padding: 10px; border-radius: 6px; margin-top: 12px; border: 1px solid #e0e0e0; }
              
              /* ALERT BOX */
              .alert-box { 
                padding: 12px 15px; 
                margin: 10px 0; 
                border-radius: 8px; 
                border-left: 5px solid;
                page-break-inside: avoid;
              }
              .alert-danger { background: #ffebee; border-color: #f44336; }
              .alert-warning { background: #fff8e1; border-color: #ff9800; }
              .alert-info { background: #e3f2fd; border-color: #2196f3; }
              .alert-title { font-size: 10px; font-weight: 600; margin-bottom: 4px; }
              .alert-desc { font-size: 9px; color: #555; line-height: 1.4; }
              .alert-suggestion { font-size: 9px; color: #0066b3; font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; }
              .alerts-centered { display: flex; flex-direction: column; align-items: center; }
              .alerts-centered .alert-box { width: 85%; }
              
              /* REVENUE MAP */
              .revenue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
              .revenue-card { 
                padding: 15px; 
                border-radius: 10px; 
                text-align: center; 
                border: 1px solid #ddd;
              }
              .revenue-card-gold { background: linear-gradient(135deg, #fff8e1 0%, #ffe082 100%); border-color: #ffc107; }
              .revenue-card-silver { background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); }
              .revenue-card-bronze { background: linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%); border-color: #ff9800; }
              .revenue-rank { font-size: 28px; font-weight: bold; color: rgba(0,0,0,0.12); }
              .revenue-cat { font-size: 12px; font-weight: 600; color: #333; margin-top: 5px; }
              .revenue-unit { font-size: 9px; color: #666; margin-top: 3px; }
              .revenue-value { font-size: 16px; font-weight: bold; color: #2e7d32; margin-top: 8px; }
              .revenue-percent { font-size: 9px; color: #666; margin-top: 3px; }
              
              /* STATUS BOX */
              .status-box { 
                display: inline-block;
                padding: 5px 14px; 
                border-radius: 20px; 
                font-size: 11px; 
                font-weight: 600;
              }
              .status-superavit { background: #e8f5e9; color: #2e7d32; }
              .status-deficit { background: #ffebee; color: #c62828; }
              .status-equilibrio { background: #f5f5f5; color: #666; }
              
              /* UNIT CARD */
              .unit-card {
                margin-bottom: 20px; 
                padding: 15px; 
                background: #fafafa; 
                border-radius: 10px; 
                border: 1px solid #e0e0e0;
                page-break-inside: avoid;
              }
              .unit-header {
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
              }
              .unit-title { font-size: 13px; font-weight: 600; color: #333; }
              .unit-summary { 
                font-size: 9px; 
                font-style: italic; 
                color: #0066b3; 
                margin-bottom: 12px; 
                padding: 8px 10px; 
                background: #e3f2fd; 
                border-radius: 6px;
                line-height: 1.4;
              }
              .unit-metrics {
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 10px; 
                margin-bottom: 12px;
              }
              .unit-metric {
                text-align: center; 
                padding: 10px 8px; 
                border-radius: 6px;
              }
              .unit-metric-label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
              .unit-metric-value { font-size: 12px; font-weight: bold; margin-top: 4px; }
              
              /* SPECIALTY TABLE */
              .spec-section { margin-top: 15px; padding-top: 12px; border-top: 1px solid #e0e0e0; }
              .spec-title { font-size: 10px; font-weight: 600; color: #0066b3; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
              .spec-inactive { opacity: 0.5; font-style: italic; }
              .spec-tag { 
                display: inline-block; 
                padding: 3px 8px; 
                border-radius: 4px; 
                font-size: 8px; 
                font-weight: 600;
                margin-left: 6px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
              }
              .tag-estrategica { background: #e3f2fd; color: #0066b3; }
              .tag-relevante { background: #fff8e1; color: #f57c00; }
              .tag-residual { background: #f5f5f5; color: #666; }
              .tag-inativa { background: #eee; color: #999; }
              .no-movement { font-size: 8px; color: #999; font-style: italic; }
              
              /* CONSOLIDATED TABLES */
              .consolidated-section { margin-top: 20px; }
              .consolidated-table { margin-bottom: 25px; }
              .consolidated-table-title { 
                font-size: 11px; 
                font-weight: 600; 
                color: #333; 
                margin-bottom: 10px; 
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 6px;
                border-left: 3px solid #0066b3;
              }
              
              /* PAGE BREAKS */
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
              
              /* FOOTER */
              .report-footer {
                margin-top: 40px; 
                padding: 20px; 
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
                border-radius: 10px; 
                border-top: 4px solid #0066b3;
              }
              .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; font-size: 9px; }
              .footer-status p { margin: 5px 0; display: flex; align-items: center; gap: 6px; }
              .footer-status .check { color: #2e7d32; font-weight: bold; }
              .footer-info { text-align: right; }
              .footer-info p { margin: 5px 0; }
              .footer-copyright { 
                text-align: center; 
                margin-top: 20px; 
                padding-top: 15px; 
                border-top: 1px solid #ddd;
                font-size: 8px; 
                color: #888;
              }
              
              @media print { 
                body { padding: 0; }
                .cover { height: 100vh; margin: -18mm -15mm; padding: 50px; }
                .section { page-break-inside: avoid; }
                thead { display: table-header-group; }
              }
            </style>
          </head>
          <body>
            <!-- ========== CAPA ========== -->
            <div class="cover">
              <div class="cover-logo">SallusFlow</div>
              <div class="cover-subtitle">Gestão Financeira Inteligente</div>
              <div class="cover-title">Relatório Executivo<br/>de Fluxo de Caixa</div>
              <div class="cover-period">${periodText}</div>
              <div class="cover-meta">
                <div>Gerado em: ${generatedAt}</div>
                <div>Responsável: ${auth.user?.name || "Sistema"}</div>
              </div>
            </div>
            
            <!-- ========== PÁGINA: VISÃO GERAL ========== -->
            <div class="page-header">
              <div class="page-header-logo">SallusFlow</div>
              <div class="page-header-info">
                Período: ${periodText}<br/>
                Gerado: ${generatedAt}
              </div>
            </div>
            
            <div class="section section-avoid-break">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Visão Geral do Período
              </div>
              
              <div class="cards">
                <div class="card card-initial">
                  <div class="card-label">Saldo Inicial</div>
                  <div class="card-value">${formatCurrency(filteredStats.initialBalance)}</div>
                </div>
                <div class="card card-income">
                  <div class="card-label">Total Entradas</div>
                  <div class="card-value">${formatCurrency(filteredStats.totalIncome)}</div>
                </div>
                <div class="card card-expense">
                  <div class="card-label">Total Saídas</div>
                  <div class="card-value">${formatCurrency(filteredStats.totalExpense)}</div>
                </div>
                <div class="card card-balance">
                  <div class="card-label">Saldo Final</div>
                  <div class="card-value">${formatCurrency(filteredStats.currentBalance)}</div>
                </div>
              </div>
            </div>
            
            <!-- ========== LEITURA EXECUTIVA ========== -->
            <div class="section section-avoid-break">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Leitura Executiva
              </div>
              
              <div class="exec-box">
                <h4>Análise Gerencial do Período</h4>
                ${topUnit ? `<p><strong>Unidade líder:</strong> ${topUnit.name} — responsável por ${formatCurrency(topUnit.totalIncome)} em entradas (${totalIncomeAllUnits > 0 ? ((topUnit.totalIncome / totalIncomeAllUnits) * 100).toFixed(1) : 0}% do total).</p>` : ''}
                ${topCategory ? `<p><strong>Categoria líder:</strong> ${topCategory.categoryName} — gerou ${formatCurrency(topCategory.value)} (${topCategory.percentage.toFixed(1)}% das entradas).</p>` : ''}
                <p><strong>Predominância:</strong> ${predominancia} (${predominanciaPercent}% das entradas).</p>
                
                <div class="exec-highlight">
                  <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    <strong>Resultado final:</strong> 
                    <span class="status-box ${netBalance > 0 ? 'status-superavit' : netBalance < 0 ? 'status-deficit' : 'status-equilibrio'}">
                      ${situacaoFinal} ${netBalance !== 0 ? `(${formatCurrency(Math.abs(netBalance))})` : ''}
                    </span>
                  </p>
                </div>
              </div>
              
              ${executiveSummary.length > 0 ? `
              <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
                <p style="font-size: 10px; font-weight: 600; color: #333; margin-bottom: 10px;">Destaques do Período:</p>
                ${executiveSummary.map(insight => `<p style="margin: 6px 0; font-size: 10px; color: #444; padding-left: 12px; border-left: 2px solid #0066b3;">• ${insight}</p>`).join('')}
              </div>
              ` : ''}
            </div>
            
            <!-- ========== ALERTAS GERENCIAIS ========== -->
            ${managementAlerts.length > 0 ? `
            <div class="section section-avoid-break">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Alertas Gerenciais (${managementAlerts.length})
              </div>
              <div class="${managementAlerts.length <= 2 ? 'alerts-centered' : ''}">
                ${managementAlerts.map(alert => `
                  <div class="alert-box alert-${alert.type}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                          <span style="font-size: 16px;">${alert.riskIcon}</span>
                          <span style="font-size: 9px; font-weight: 600; background: ${alert.type === 'danger' ? '#ffcdd2' : alert.type === 'warning' ? '#ffe082' : '#bbdefb'}; padding: 3px 10px; border-radius: 4px;">${alert.riskType}</span>
                          ${alert.unit ? `<span style="font-size: 9px; color: #666;">— ${alert.unit}</span>` : ''}
                          ${alert.specialty ? `<span style="font-size: 9px; color: #666;">› ${alert.specialty}</span>` : ''}
                        </div>
                        <div class="alert-title" style="color: ${alert.type === 'danger' ? '#c62828' : alert.type === 'warning' ? '#e65100' : '#1565c0'};">${alert.title}</div>
                        <div class="alert-desc">${alert.description}</div>
                      </div>
                      ${alert.value ? `<div style="font-size: 14px; font-weight: bold; color: ${alert.type === 'danger' ? '#c62828' : alert.type === 'warning' ? '#e65100' : '#1565c0'};">${alert.value}</div>` : ''}
                    </div>
                    <div class="alert-suggestion">💡 <strong>Sugestão:</strong> ${getManagementSuggestion(alert)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            <!-- ========== MAPA DE RECEITA ========== -->
            ${revenueMap.length > 0 ? `
            <div class="section section-avoid-break">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Mapa de Receita (Top 3)
              </div>
              <div class="revenue-grid">
                ${revenueMap.map((item, idx) => `
                  <div class="revenue-card ${idx === 0 ? 'revenue-card-gold' : idx === 1 ? 'revenue-card-silver' : 'revenue-card-bronze'}">
                    <div class="revenue-rank">${item.rank}º</div>
                    <div class="revenue-cat">${item.categoryName}</div>
                    <div class="revenue-unit">${item.unitName}</div>
                    <div class="revenue-value">${formatCurrency(item.value)}</div>
                    <div class="revenue-percent">${item.percentage.toFixed(1)}% do total</div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            <!-- ========== RESUMO POR UNIDADE ========== -->
            <div class="section section-avoid-break">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Resumo Consolidado por Unidade
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Entradas</th>
                    <th>Saídas</th>
                    <th>Saldo Líquido</th>
                    <th>% Particular</th>
                    <th>% Convênios</th>
                    <th>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${unitAnalysisDetailed.map((u) => `
                    <tr>
                      <td style="font-weight: 500;">${u.name}</td>
                      <td class="positive">${formatCurrency(u.totalIncome)}</td>
                      <td class="negative">${formatCurrency(u.totalExpense)}</td>
                      <td class="${u.netBalance >= 0 ? 'positive' : 'negative'}" style="font-weight: 600;">${formatCurrency(u.netBalance)}</td>
                      <td>${u.particular.percentage.toFixed(1)}%</td>
                      <td>${u.convenio.percentage.toFixed(1)}%</td>
                      <td>${totalIncomeAllUnits > 0 ? ((u.totalIncome / totalIncomeAllUnits) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <!-- ========== PÁGINA: ANÁLISE POR UNIDADE ========== -->
            <div class="page-break"></div>
            <div class="page-header">
              <div class="page-header-logo">SallusFlow</div>
              <div class="page-header-info">
                Período: ${periodText}<br/>
                Análise por Unidade
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Análise Detalhada por Unidade
              </div>
              
              ${outrasUnidades.map((u) => `
                <div class="unit-card">
                  <div class="unit-header">
                    <div class="unit-title">${u.name}</div>
                    <span class="status-box ${u.netBalance >= 0 ? 'status-superavit' : 'status-deficit'}">
                      Saldo: ${formatCurrency(u.netBalance)}
                    </span>
                  </div>
                  
                  <div class="unit-summary">${getUnitExecutiveSummary(u)}</div>
                  
                  <div class="unit-metrics">
                    <div class="unit-metric" style="background: #e8f5e9;">
                      <div class="unit-metric-label">Entradas</div>
                      <div class="unit-metric-value" style="color: #2e7d32;">${formatCurrency(u.totalIncome)}</div>
                    </div>
                    <div class="unit-metric" style="background: #ffebee;">
                      <div class="unit-metric-label">Saídas</div>
                      <div class="unit-metric-value" style="color: #c62828;">${formatCurrency(u.totalExpense)}</div>
                    </div>
                    <div class="unit-metric" style="background: #f5f5f5;">
                      <div class="unit-metric-label">Particular</div>
                      <div class="unit-metric-value" style="color: #333;">${u.particular.percentage.toFixed(1)}%</div>
                    </div>
                    <div class="unit-metric" style="background: #f5f5f5;">
                      <div class="unit-metric-label">Convênios</div>
                      <div class="unit-metric-value" style="color: #333;">${u.convenio.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  
                  ${u.categories.length > 0 ? `
                    <div style="margin-top: 12px;">
                      <p style="font-size: 9px; font-weight: 600; color: #666; margin-bottom: 8px;">Categorias:</p>
                      <table>
                        <thead>
                          <tr>
                            <th>Categoria</th>
                            <th>Valor</th>
                            <th>Qtd.</th>
                            <th>Ticket Médio</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${u.categories.map(cat => `
                            <tr>
                              <td>${cat.categoryName}</td>
                              <td class="positive">${formatCurrency(cat.value)}</td>
                              <td>${cat.count}</td>
                              <td>${formatCurrency(cat.avgTicket)}</td>
                              <td>${cat.percentage.toFixed(1)}%</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            
            <!-- ========== PÁGINA: CENTRO CLÍNICO ========== -->
            ${centroClinico ? `
            <div class="page-break"></div>
            <div class="page-header">
              <div class="page-header-logo">SallusFlow</div>
              <div class="page-header-info">
                Período: ${periodText}<br/>
                Centro Clínico — Especialidades
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Centro Clínico — Detalhamento por Especialidade
              </div>
              
              <div class="unit-card" style="border: 2px solid #0066b3;">
                <div class="unit-header">
                  <div class="unit-title" style="color: #0066b3;">Centro Clínico</div>
                  <span class="status-box ${centroClinico.netBalance >= 0 ? 'status-superavit' : 'status-deficit'}">
                    Saldo: ${formatCurrency(centroClinico.netBalance)}
                  </span>
                </div>
                
                <div class="unit-summary">${getUnitExecutiveSummary(centroClinico)}</div>
                
                <div class="unit-metrics">
                  <div class="unit-metric" style="background: #e8f5e9;">
                    <div class="unit-metric-label">Entradas</div>
                    <div class="unit-metric-value" style="color: #2e7d32;">${formatCurrency(centroClinico.totalIncome)}</div>
                  </div>
                  <div class="unit-metric" style="background: #ffebee;">
                    <div class="unit-metric-label">Saídas</div>
                    <div class="unit-metric-value" style="color: #c62828;">${formatCurrency(centroClinico.totalExpense)}</div>
                  </div>
                  <div class="unit-metric" style="background: #f5f5f5;">
                    <div class="unit-metric-label">Particular</div>
                    <div class="unit-metric-value" style="color: #333;">${centroClinico.particular.percentage.toFixed(1)}%</div>
                  </div>
                  <div class="unit-metric" style="background: #f5f5f5;">
                    <div class="unit-metric-label">Convênios</div>
                    <div class="unit-metric-value" style="color: #333;">${centroClinico.convenio.percentage.toFixed(1)}%</div>
                  </div>
                </div>
                
                ${centroClinico.specialties ? `
                  <div class="spec-section">
                    <div class="spec-title">
                      <span>📋</span>
                      Especialidades Médicas
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Especialidade</th>
                          <th>Entradas</th>
                          <th>Saídas</th>
                          <th>Ticket Médio</th>
                          <th>% Unidade</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${centroClinico.specialties.map(spec => {
                          const tag = spec.percentage === 0 ? { label: 'Inativa', css: 'tag-inativa' } :
                                      spec.percentage >= 40 ? { label: 'Estratégica', css: 'tag-estrategica' } :
                                      spec.percentage >= 15 ? { label: 'Relevante', css: 'tag-relevante' } :
                                      { label: 'Residual', css: 'tag-residual' };
                          return `
                            <tr class="${!spec.hasMovement ? 'spec-inactive' : ''}">
                              <td style="text-align: left;">
                                ${spec.name}
                                <span class="spec-tag ${tag.css}">${tag.label}</span>
                                ${!spec.hasMovement ? '<div class="no-movement">Sem movimentação no período</div>' : ''}
                              </td>
                              <td class="${spec.hasMovement ? 'positive' : ''}">${formatCurrency(spec.totalIncome)}</td>
                              <td class="${spec.hasMovement ? 'negative' : ''}">${formatCurrency(spec.totalExpense)}</td>
                              <td>${formatCurrency(spec.avgTicket)}</td>
                              <td>${spec.percentage.toFixed(1)}%</td>
                              <td class="${spec.netBalance >= 0 ? 'positive' : 'negative'}">
                                ${formatCurrency(spec.netBalance)}
                                ${spec.netBalance < 0 && centroClinico.netBalance >= 0 && spec.hasMovement ? '<div class="no-movement">Compensado por outras especialidades</div>' : ''}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}
                
                ${centroClinico.categories.length > 0 ? `
                  <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 9px; font-weight: 600; color: #666; margin-bottom: 8px;">Categorias do Centro Clínico:</p>
                    <table>
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th>Valor</th>
                          <th>Qtd.</th>
                          <th>Ticket Médio</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${centroClinico.categories.map(cat => `
                          <tr>
                            <td>${cat.categoryName}</td>
                            <td class="positive">${formatCurrency(cat.value)}</td>
                            <td>${cat.count}</td>
                            <td>${formatCurrency(cat.avgTicket)}</td>
                            <td>${cat.percentage.toFixed(1)}%</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
            
            <!-- ========== PÁGINA: ANÁLISES CONSOLIDADAS ========== -->
            <div class="page-break"></div>
            <div class="page-header">
              <div class="page-header-logo">SallusFlow</div>
              <div class="page-header-info">
                Período: ${periodText}<br/>
                Análises Consolidadas
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">
                <span class="section-number">${sectionNum++}</span>
                Análises Consolidadas
              </div>
              
              <div class="consolidated-section">
                <!-- Entradas por Unidade -->
                <div class="consolidated-table avoid-break">
                  <div class="consolidated-table-title">Entradas por Unidade</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Valor</th>
                        <th>Transações</th>
                        <th>Ticket Médio</th>
                        <th>% do Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${unitAnalysis.map(u => `
                        <tr>
                          <td style="font-weight: 500;">${u.name}</td>
                          <td class="positive">${formatCurrency(u.totalIncome)}</td>
                          <td>${u.count}</td>
                          <td>${formatCurrency(u.avgTicket)}</td>
                          <td>${totalIncomeAllUnits > 0 ? ((u.totalIncome / totalIncomeAllUnits) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                
                <!-- Análise por Categoria -->
                ${categoryAnalysis.length > 0 ? `
                <div class="consolidated-table avoid-break">
                  <div class="consolidated-table-title">Análise por Categoria</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Valor</th>
                        <th>Qtd.</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${categoryAnalysis.slice(0, 10).map(cat => `
                        <tr>
                          <td>${cat.categoryName}</td>
                          <td class="positive">${formatCurrency(cat.value)}</td>
                          <td>${cat.count}</td>
                          <td>${cat.percentage.toFixed(1)}%</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                ` : ''}
                
                <!-- Distribuição das Entradas -->
                <div class="consolidated-table avoid-break">
                  <div class="consolidated-table-title">Distribuição das Entradas</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>% do Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style="font-weight: 500;">Particular</td>
                        <td class="positive">${formatCurrency(totalParticular)}</td>
                        <td>${totalIncomeAllUnits > 0 ? ((totalParticular / totalIncomeAllUnits) * 100).toFixed(1) : 0}%</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 500;">Convênios</td>
                        <td class="positive">${formatCurrency(totalConvenio)}</td>
                        <td>${totalIncomeAllUnits > 0 ? ((totalConvenio / totalIncomeAllUnits) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <!-- Recebimentos por Operadora -->
                ${operadoraAnalysis.length > 0 ? `
                <div class="consolidated-table avoid-break">
                  <div class="consolidated-table-title">Recebimentos por Operadora</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Operadora</th>
                        <th>Valor</th>
                        <th>% Convênios</th>
                        <th>% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${operadoraAnalysis.slice(0, 8).map(op => `
                        <tr>
                          <td>${op.name}</td>
                          <td class="positive">${formatCurrency(op.value)}</td>
                          <td>${op.percentageOfConvenio.toFixed(1)}%</td>
                          <td>${op.percentageOfTotal.toFixed(1)}%</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                ` : ''}
              </div>
            </div>
            
            <!-- ========== FECHAMENTO ========== -->
            <div class="report-footer">
              <div class="footer-grid">
                <div class="footer-status">
                  <p style="font-weight: 600; margin-bottom: 8px; font-size: 10px;">Status do Relatório</p>
                  <p><span class="check">✓</span> Caixa conciliado</p>
                  <p><span class="check">✓</span> Valores realizados</p>
                  <p><span class="check">✓</span> Sem previsões ou contas a receber</p>
                </div>
                <div class="footer-info">
                  <p><strong>Período:</strong> ${periodText}</p>
                  <p><strong>Usuário:</strong> ${auth.user?.name || "Sistema"}</p>
                  <p><strong>Gerado em:</strong> ${generatedAt}</p>
                  <p style="margin-top: 10px;">
                    <span class="status-box ${netBalance > 0 ? 'status-superavit' : netBalance < 0 ? 'status-deficit' : 'status-equilibrio'}">
                      ${situacaoFinal}
                    </span>
                  </p>
                </div>
              </div>
              <div class="footer-copyright">
                Relatório gerado automaticamente com base em movimentações realizadas<br/>
                SallusFlow — Gestão Financeira Inteligente © ${new Date().getFullYear()}
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    // Log de auditoria com status de validação
    const validationStatus = validationPassed ? "validado" : "com ajustes";
    addAuditLog("EXPORT_DATA", `Relatório PDF Executivo gerado (${validationStatus})`);
    
    if (validationPassed) {
      toast.success("✅ Relatório validado — pronto para uso executivo");
    } else {
      toast.success("⚠️ Relatório validado com pequenos ajustes aplicados automaticamente");
    }
  };

  const exportBackup = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      transactions: filterTransactions({}),
      settings,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_sallusflow_${format(new Date(), "yyyy-MM-dd_HHmmss")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addAuditLog("EXPORT_DATA", "Backup completo do sistema exportado");
    toast.success("Backup exportado com sucesso!");
  };

  const clearFilters = () => {
    setSelectedUnit("all");
    setSelectedType("all");
    setSelectedReceiptType("all");
    setSelectedCategory("all");
    setSelectedOperadora("all");
  };

  const hasActiveFilters = selectedUnit !== "all" || selectedType !== "all" || selectedReceiptType !== "all" || selectedCategory !== "all" || selectedOperadora !== "all";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground">
            Análise operacional do fluxo de caixa realizado
          </p>
        </div>

        <ReportFilters
          dateRange={dateRange}
          setDateRange={setDateRange}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedReceiptType={selectedReceiptType}
          setSelectedReceiptType={setSelectedReceiptType}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedOperadora={selectedOperadora}
          setSelectedOperadora={setSelectedOperadora}
          directorMode={directorMode}
          setDirectorMode={setDirectorMode}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          activeUnits={activeUnits}
          incomeCategories={incomeCategories}
          operadoras={OPERADORAS}
          appliedFiltersText={getAppliedFiltersText()}
        />

        <ReportExecutiveSummary
          filteredStats={filteredStats}
          executiveSummary={executiveSummary}
        />

        <ReportAlerts
          alerts={managementAlerts}
          getManagementSuggestion={getManagementSuggestion}
        />

        <ReportRevenueMap revenueMap={revenueMap} />

        <ReportUnitAnalysis
          unitAnalysisDetailed={unitAnalysisDetailed}
          directorMode={directorMode}
          getUnitExecutiveSummary={getUnitExecutiveSummary}
          getParticipationTag={getParticipationTag}
        />

        <ReportConsolidatedTables
          unitAnalysis={unitAnalysis}
          totalIncomeAllUnits={totalIncomeAllUnits}
          categoryAnalysis={categoryAnalysis}
          receiptTypeAnalysis={receiptTypeAnalysis}
          operadoraAnalysis={operadoraAnalysis}
          paymentMethodAnalysis={paymentMethodAnalysis}
          directorMode={directorMode}
        />

        <ReportExports
          exportCSV={exportCSV}
          exportPDF={exportPDF}
          exportBackup={exportBackup}
          dateRange={dateRange}
          userName={auth.user?.name || "Sistema"}
        />
      </div>
    </DashboardLayout>
  );
}
