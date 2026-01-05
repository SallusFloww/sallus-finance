import { useMemo } from "react";
import { Transaction, Settings } from "@/types";
import { format, parseISO } from "date-fns";
import { DREData } from "./useDRE";
import { isRealized } from "@/utils/statusHelpers";

export type ConsistencyStatus = "consistent" | "warning" | "error";

export interface ConsistencyIssue {
  type: "period" | "score" | "dre" | "signal" | "classification";
  severity: "error" | "warning";
  message: string;
  details?: string;
}

export interface ConsistencyCheckResult {
  status: ConsistencyStatus;
  label: string;
  issues: ConsistencyIssue[];
  validations: {
    period: boolean;
    score: boolean;
    dre: boolean;
    signals: boolean;
    classification: boolean;
  };
  summary: string;
}

interface ConsistencyCheckParams {
  transactions: Transaction[];
  settings: Settings;
  dreData: DREData | null;
  periodStart: Date;
  periodEnd: Date;
  unitFilter?: string;
}

export function useConsistencyCheck({
  transactions,
  settings,
  dreData,
  periodStart,
  periodEnd,
  unitFilter
}: ConsistencyCheckParams): ConsistencyCheckResult {
  return useMemo(() => {
    const issues: ConsistencyIssue[] = [];

    // Filter transactions for the period
    const periodTransactions = transactions.filter((t) => {
      const txDate = parseISO(t.date);
      return txDate >= periodStart && txDate <= periodEnd;
    });

    // Apply unit filter if specified
    const filteredTransactions = unitFilter && unitFilter !== "all"
      ? periodTransactions.filter((t) => t.unit === unitFilter)
      : periodTransactions;

    // Helper to get financial category with backwards compatibility
    const getFinancialCategory = (t: Transaction): string => {
      if (t.financialCategory) return t.financialCategory;
      return "OPERACIONAL";
    };

    // =====================================================
    // 1️⃣ VALIDAÇÃO DE PERÍODO
    // =====================================================
    let periodValid = true;
    
    if (!periodStart || !periodEnd) {
      periodValid = false;
      issues.push({
        type: "period",
        severity: "error",
        message: "Período não definido para análise",
        details: "Selecione um período válido para validar os dados."
      });
    }

    // =====================================================
    // 2️⃣ VALIDAÇÃO DO SCORE MENSAL
    // =====================================================
    let scoreValid = true;

    // Check: Only REALIZADO status should be considered (usando helper robusto)
    const nonRealizadoTransactions = filteredTransactions.filter(
      (t) => !isRealized(t.status)
    );
    
    if (nonRealizadoTransactions.length > 0) {
      scoreValid = false;
      issues.push({
        type: "score",
        severity: "error",
        message: `${nonRealizadoTransactions.length} movimentação(ões) com status diferente de 'Realizado'`,
        details: "O Score Mensal considera apenas movimentações com status 'Realizado'."
      });
    }

    // Score calculation should only use OPERACIONAL transactions
    const operacionalTransactions = filteredTransactions.filter(
      (t) => getFinancialCategory(t) === "OPERACIONAL"
    );

    const nonOperacionalInScore = filteredTransactions.filter(
      (t) => getFinancialCategory(t) !== "OPERACIONAL"
    );

    // Verify that we can reproduce active days per unit
    const activeUnits = settings.units.filter((u) => u.active);
    const unitActiveDays: Record<string, Set<string>> = {};

    activeUnits.forEach((unit) => {
      unitActiveDays[unit.id] = new Set();
    });

    operacionalTransactions.forEach((t) => {
      if (t.unit && unitActiveDays[t.unit]) {
        unitActiveDays[t.unit].add(format(parseISO(t.date), "yyyy-MM-dd"));
      }
    });

    // Check if any unit has suspicious data
    activeUnits.forEach((unit) => {
      const days = unitActiveDays[unit.id]?.size || 0;
      const unitTxns = operacionalTransactions.filter((t) => t.unit === unit.id);
      
      if (unitTxns.length > 0 && days === 0) {
        scoreValid = false;
        issues.push({
          type: "score",
          severity: "error",
          message: `Unidade ${unit.name}: movimentações sem dias ativos calculáveis`,
          details: "Verifique as datas das movimentações desta unidade."
        });
      }
    });

    // =====================================================
    // 3️⃣ VALIDAÇÃO DO DRE GERENCIAL
    // =====================================================
    let dreValid = true;

    if (dreData) {
      // Calculate expected values from transactions
      const receitasOperacionais = filteredTransactions.filter(
        (t) => t.type === "INCOME" && getFinancialCategory(t) === "OPERACIONAL"
      );
      const expectedReceitaOperacional = receitasOperacionais.reduce(
        (sum, t) => sum + t.amount, 0
      );

      const custosOperacionais = filteredTransactions.filter(
        (t) => t.type === "EXPENSE" && getFinancialCategory(t) === "OPERACIONAL"
      );
      const expectedCustoOperacional = custosOperacionais.reduce(
        (sum, t) => sum + t.amount, 0
      );

      const custosCompartilhados = filteredTransactions.filter(
        (t) => t.type === "EXPENSE" && getFinancialCategory(t) === "COMPARTILHADO"
      );
      const expectedCustoCompartilhado = custosCompartilhados.reduce(
        (sum, t) => sum + t.amount, 0
      );

      const receitasNaoOp = filteredTransactions.filter(
        (t) => t.type === "INCOME" && 
               getFinancialCategory(t) === "NAO_OPERACIONAL" &&
               t.nonOperationalSubtype !== "EVENTO_EXTRAORDINARIO" &&
               t.nonOperationalSubtype !== "APORTE_SOCIO"
      );
      const expectedReceitaNaoOp = receitasNaoOp.reduce(
        (sum, t) => sum + t.amount, 0
      );

      const despesasNaoOp = filteredTransactions.filter(
        (t) => t.type === "EXPENSE" && 
               getFinancialCategory(t) === "NAO_OPERACIONAL" &&
               t.nonOperationalSubtype !== "EVENTO_EXTRAORDINARIO"
      );
      const expectedDespesaNaoOp = despesasNaoOp.reduce(
        (sum, t) => sum + t.amount, 0
      );

      // Compare with DRE values (allow small tolerance for rounding)
      const tolerance = 0.01;

      if (Math.abs(dreData.receitaBrutaOperacional - expectedReceitaOperacional) > tolerance) {
        dreValid = false;
        issues.push({
          type: "dre",
          severity: "error",
          message: "Divergência em Receita Bruta Operacional",
          details: `DRE: R$ ${dreData.receitaBrutaOperacional.toFixed(2)} | Movimentações: R$ ${expectedReceitaOperacional.toFixed(2)}`
        });
      }

      if (Math.abs(dreData.custosOperacionaisDiretos - expectedCustoOperacional) > tolerance) {
        dreValid = false;
        issues.push({
          type: "dre",
          severity: "error",
          message: "Divergência em Custos Operacionais Diretos",
          details: `DRE: R$ ${dreData.custosOperacionaisDiretos.toFixed(2)} | Movimentações: R$ ${expectedCustoOperacional.toFixed(2)}`
        });
      }

      if (Math.abs(dreData.custosCompartilhados - expectedCustoCompartilhado) > tolerance) {
        dreValid = false;
        issues.push({
          type: "dre",
          severity: "error",
          message: "Divergência em Custos Compartilhados",
          details: `DRE: R$ ${dreData.custosCompartilhados.toFixed(2)} | Movimentações: R$ ${expectedCustoCompartilhado.toFixed(2)}`
        });
      }

      if (Math.abs(dreData.receitasNaoOperacionais - expectedReceitaNaoOp) > tolerance) {
        dreValid = false;
        issues.push({
          type: "dre",
          severity: "warning",
          message: "Divergência em Receitas Não Operacionais",
          details: `DRE: R$ ${dreData.receitasNaoOperacionais.toFixed(2)} | Movimentações: R$ ${expectedReceitaNaoOp.toFixed(2)}`
        });
      }

      if (Math.abs(dreData.despesasNaoOperacionais - expectedDespesaNaoOp) > tolerance) {
        dreValid = false;
        issues.push({
          type: "dre",
          severity: "warning",
          message: "Divergência em Despesas Não Operacionais",
          details: `DRE: R$ ${dreData.despesasNaoOperacionais.toFixed(2)} | Movimentações: R$ ${expectedDespesaNaoOp.toFixed(2)}`
        });
      }
    }

    // =====================================================
    // 4️⃣ VALIDAÇÃO DE SINAIS E CLASSIFICAÇÃO
    // =====================================================
    let signalsValid = true;

    // Check: Entradas should have positive amounts
    const negativeIncomes = filteredTransactions.filter(
      (t) => t.type === "INCOME" && t.amount < 0
    );
    
    if (negativeIncomes.length > 0) {
      signalsValid = false;
      issues.push({
        type: "signal",
        severity: "error",
        message: `${negativeIncomes.length} entrada(s) com valor negativo`,
        details: "Entradas devem ter valores positivos. Verifique os lançamentos."
      });
    }

    // Check: Saídas should have positive amounts (stored as positive, displayed as negative)
    const negativeExpenses = filteredTransactions.filter(
      (t) => t.type === "EXPENSE" && t.amount < 0
    );
    
    if (negativeExpenses.length > 0) {
      signalsValid = false;
      issues.push({
        type: "signal",
        severity: "error",
        message: `${negativeExpenses.length} saída(s) com valor negativo`,
        details: "Saídas devem ter valores positivos no cadastro. Verifique os lançamentos."
      });
    }

    // =====================================================
    // 5️⃣ VALIDAÇÃO DE CLASSIFICAÇÃO
    // =====================================================
    let classificationValid = true;

    // Check: NAO_OPERACIONAL should not impact Resultado Operacional Assistencial
    // This is a structural check - we verify the DRE logic is correct
    if (dreData && nonOperacionalInScore.length > 0) {
      // Calculate operational result only from OPERACIONAL transactions
      const opReceitas = filteredTransactions.filter(
        (t) => t.type === "INCOME" && getFinancialCategory(t) === "OPERACIONAL"
      ).reduce((sum, t) => sum + t.amount, 0);
      
      const opCustos = filteredTransactions.filter(
        (t) => t.type === "EXPENSE" && getFinancialCategory(t) === "OPERACIONAL"
      ).reduce((sum, t) => sum + t.amount, 0);
      
      const expectedResultadoAssistencial = opReceitas - opCustos;
      
      if (Math.abs(dreData.resultadoOperacionalAssistencial - expectedResultadoAssistencial) > 0.01) {
        classificationValid = false;
        issues.push({
          type: "classification",
          severity: "error",
          message: "Não Operacional impactando Resultado Operacional Assistencial",
          details: "Transações não operacionais estão afetando o resultado assistencial indevidamente."
        });
      }
    }

    // Check for transactions without proper classification
    const unclassifiedTransactions = filteredTransactions.filter(
      (t) => !t.financialCategory
    );
    
    if (unclassifiedTransactions.length > 0) {
      issues.push({
        type: "classification",
        severity: "warning",
        message: `${unclassifiedTransactions.length} movimentação(ões) sem classificação financeira explícita`,
        details: "Classificadas como 'Operacional – Unidade' por padrão."
      });
    }

    // =====================================================
    // RESULTADO FINAL
    // =====================================================
    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");

    let status: ConsistencyStatus;
    let label: string;
    let summary: string;

    if (hasErrors) {
      status = "error";
      label = "Inconsistência detectada";
      summary = `${issues.filter(i => i.severity === "error").length} erro(s) encontrado(s). Verifique os lançamentos antes de exportar.`;
    } else if (hasWarnings) {
      status = "warning";
      label = "Atenção – Verificar lançamentos";
      summary = `${issues.filter(i => i.severity === "warning").length} alerta(s). Dados utilizáveis, mas recomenda-se verificação.`;
    } else {
      status = "consistent";
      label = "Dados Consistentes – Período validado";
      summary = "Score, DRE e Movimentações estão 100% alinhados. Seguro para uso gerencial.";
    }

    return {
      status,
      label,
      issues,
      validations: {
        period: periodValid,
        score: scoreValid,
        dre: dreValid,
        signals: signalsValid,
        classification: classificationValid
      },
      summary
    };
  }, [transactions, settings, dreData, periodStart, periodEnd, unitFilter]);
}
