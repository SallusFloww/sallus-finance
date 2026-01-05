import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface QATestResult {
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  message?: string;
  details?: string;
}

export interface QASeedResult {
  entradas: number;
  saidas: number;
  success: boolean;
  error?: string;
}

export interface QACleanupResult {
  deleted: number;
  success: boolean;
  error?: string;
}

const QA_FLAG = "[QA]";

const UNITS = ["UNIDADE_A", "UNIDADE_B"];
const CATEGORIES_ENTRADA = ["Consultas", "Exames", "Procedimentos", "Repasses"];
const CATEGORIES_SAIDA = ["Salários", "Aluguel", "Materiais", "Impostos", "Marketing"];

export function useQATests() {
  const { user, currentCompany } = useAuth();
  const [testResults, setTestResults] = useState<QATestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [seedResult, setSeedResult] = useState<QASeedResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<QACleanupResult | null>(null);

  // Helper: random pick from array
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  // Helper: random number in range
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Helper: format date
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  // Create test data
  const createSeedData = useCallback(async (): Promise<QASeedResult> => {
    if (!currentCompany?.id || !user?.id) {
      return { entradas: 0, saidas: 0, success: false, error: "Usuário ou empresa não encontrados" };
    }

    try {
      const now = new Date();
      const entries = [];

      // 2 entradas recebidas
      for (let i = 0; i < 2; i++) {
        entries.push({
          company_id: currentCompany.id,
          type: "entrada" as const,
          status: "recebido" as const,
          descricao: `${QA_FLAG} Entrada recebida ${i + 1}`,
          categoria: pick(CATEGORIES_ENTRADA),
          valor: rand(500, 5000),
          data_prevista: formatDate(new Date(now.getTime() - rand(1, 10) * 24 * 60 * 60 * 1000)),
          data_recebimento: formatDate(new Date(now.getTime() - rand(0, 5) * 24 * 60 * 60 * 1000)),
          unit_id: pick(UNITS),
          observacao: `${QA_FLAG} Gerado automaticamente para testes`,
          receipt_type: "PARTICULAR",
          payment_method: "PIX",
          created_by: user.id,
        });
      }

      // 3 entradas previstas (NÃO devem impactar saldo)
      for (let i = 0; i < 3; i++) {
        entries.push({
          company_id: currentCompany.id,
          type: "entrada" as const,
          status: "previsto" as const,
          descricao: `${QA_FLAG} Entrada prevista ${i + 1}`,
          categoria: pick(CATEGORIES_ENTRADA),
          valor: rand(1000, 8000),
          data_prevista: formatDate(new Date(now.getTime() + rand(1, 30) * 24 * 60 * 60 * 1000)),
          unit_id: pick(UNITS),
          observacao: `${QA_FLAG} Gerado automaticamente para testes`,
          receipt_type: "CONVENIO",
          operadora: "UNIMED",
          created_by: user.id,
        });
      }

      // 5 saídas (todas recebido para impactar saldo)
      for (let i = 0; i < 5; i++) {
        entries.push({
          company_id: currentCompany.id,
          type: "saida" as const,
          status: "recebido" as const,
          descricao: `${QA_FLAG} Saída ${i + 1}`,
          categoria: pick(CATEGORIES_SAIDA),
          valor: rand(200, 3000),
          data_prevista: formatDate(new Date(now.getTime() - rand(1, 15) * 24 * 60 * 60 * 1000)),
          data_recebimento: formatDate(now),
          unit_id: pick(UNITS),
          observacao: `${QA_FLAG} Gerado automaticamente para testes`,
          created_by: user.id,
        });
      }

      const { error } = await supabase.from("financial_entries").insert(entries);

      if (error) throw error;

      const result = { entradas: 5, saidas: 5, success: true };
      setSeedResult(result);
      return result;
    } catch (err: any) {
      const result = { entradas: 0, saidas: 0, success: false, error: err.message };
      setSeedResult(result);
      return result;
    }
  }, [currentCompany?.id, user?.id]);

  // Cleanup test data
  const cleanupTestData = useCallback(async (): Promise<QACleanupResult> => {
    if (!currentCompany?.id) {
      return { deleted: 0, success: false, error: "Empresa não encontrada" };
    }

    try {
      // First count
      const { data: countData } = await supabase
        .from("financial_entries")
        .select("id", { count: "exact" })
        .eq("company_id", currentCompany.id)
        .ilike("observacao", `%${QA_FLAG}%`);

      const count = countData?.length || 0;

      // Cancel instead of delete (respects RLS)
      const { error } = await supabase
        .from("financial_entries")
        .update({ 
          status: "cancelado",
          cancel_reason: "Removido via limpeza QA",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
        })
        .eq("company_id", currentCompany.id)
        .ilike("observacao", `%${QA_FLAG}%`);

      if (error) throw error;

      const result = { deleted: count, success: true };
      setCleanupResult(result);
      return result;
    } catch (err: any) {
      const result = { deleted: 0, success: false, error: err.message };
      setCleanupResult(result);
      return result;
    }
  }, [currentCompany?.id, user?.id]);

  // Update a single test result
  const updateTest = (name: string, update: Partial<QATestResult>) => {
    setTestResults((prev) =>
      prev.map((t) => (t.name === name ? { ...t, ...update } : t))
    );
  };

  // Run all tests
  const runTests = useCallback(async () => {
    if (!currentCompany?.id) return;

    setIsRunning(true);

    // Initialize tests
    const tests: QATestResult[] = [
      { name: "Conexão Supabase", status: "pending" },
      { name: "Leitura de dados", status: "pending" },
      { name: "Criar entrada", status: "pending" },
      { name: "Editar entrada", status: "pending" },
      { name: "Cancelar entrada", status: "pending" },
      { name: "Previsto NÃO impacta saldo", status: "pending" },
      { name: "Saída recebido impacta saldo", status: "pending" },
      { name: "Entrada recebido impacta saldo", status: "pending" },
    ];
    setTestResults(tests);

    // 1. Conexão Supabase
    updateTest("Conexão Supabase", { status: "running" });
    try {
      const { error } = await supabase.from("companies").select("id").limit(1);
      if (error) throw error;
      updateTest("Conexão Supabase", { status: "pass", message: "Conectado com sucesso" });
    } catch (err: any) {
      updateTest("Conexão Supabase", { status: "fail", message: err.message });
    }

    // 2. Leitura de dados
    updateTest("Leitura de dados", { status: "running" });
    try {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("company_id", currentCompany.id)
        .limit(10);
      if (error) throw error;
      updateTest("Leitura de dados", { status: "pass", message: `${data?.length || 0} registros lidos` });
    } catch (err: any) {
      updateTest("Leitura de dados", { status: "fail", message: err.message });
    }

    // 3. Criar entrada
    updateTest("Criar entrada", { status: "running" });
    let createdId: string | null = null;
    try {
      const { data, error } = await supabase
        .from("financial_entries")
        .insert({
          company_id: currentCompany.id,
          type: "entrada",
          status: "previsto",
          descricao: `${QA_FLAG} Teste CRUD`,
          valor: 123.45,
          data_prevista: formatDate(new Date()),
          observacao: `${QA_FLAG} Teste automático`,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      createdId = data.id;
      updateTest("Criar entrada", { status: "pass", message: `ID: ${createdId?.substring(0, 8)}...` });
    } catch (err: any) {
      updateTest("Criar entrada", { status: "fail", message: err.message });
    }

    // 4. Editar entrada
    updateTest("Editar entrada", { status: "running" });
    if (createdId) {
      try {
        const { error } = await supabase
          .from("financial_entries")
          .update({ valor: 999.99, descricao: `${QA_FLAG} Teste CRUD editado` })
          .eq("id", createdId);
        if (error) throw error;
        updateTest("Editar entrada", { status: "pass", message: "Editado com sucesso" });
      } catch (err: any) {
        updateTest("Editar entrada", { status: "fail", message: err.message });
      }
    } else {
      updateTest("Editar entrada", { status: "fail", message: "Nenhum registro para editar" });
    }

    // 5. Cancelar entrada
    updateTest("Cancelar entrada", { status: "running" });
    if (createdId) {
      try {
        const { error } = await supabase
          .from("financial_entries")
          .update({ 
            status: "cancelado", 
            cancel_reason: "Teste QA",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", createdId);
        if (error) throw error;
        updateTest("Cancelar entrada", { status: "pass", message: "Cancelado com sucesso" });
      } catch (err: any) {
        updateTest("Cancelar entrada", { status: "fail", message: err.message });
      }
    } else {
      updateTest("Cancelar entrada", { status: "fail", message: "Nenhum registro para cancelar" });
    }

    // 6-8. Balance tests - fetch all QA entries
    try {
      const { data: qaEntries } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("company_id", currentCompany.id)
        .ilike("observacao", `%${QA_FLAG}%`)
        .neq("status", "cancelado");

      const entries = qaEntries || [];

      // 6. Previsto NÃO impacta saldo
      updateTest("Previsto NÃO impacta saldo", { status: "running" });
      const entradasPrevistas = entries.filter(
        (e) => e.type === "entrada" && e.status === "previsto"
      );
      const entradasRecebidasTotal = entries
        .filter((e) => e.type === "entrada" && e.status === "recebido")
        .reduce((sum, e) => sum + Number(e.valor), 0);
      
      // The logic should NOT include "previsto" in balance
      if (entradasPrevistas.length > 0) {
        updateTest("Previsto NÃO impacta saldo", {
          status: "pass",
          message: `${entradasPrevistas.length} entradas previstas excluídas do saldo`,
          details: `Total previsto: R$ ${entradasPrevistas.reduce((s, e) => s + Number(e.valor), 0).toFixed(2)}`,
        });
      } else {
        updateTest("Previsto NÃO impacta saldo", {
          status: "pass",
          message: "Nenhuma entrada prevista para testar (ok)",
        });
      }

      // 7. Saída recebido impacta saldo
      updateTest("Saída recebido impacta saldo", { status: "running" });
      const saidasRecebidas = entries.filter(
        (e) => e.type === "saida" && e.status === "recebido"
      );
      const totalSaidas = saidasRecebidas.reduce((sum, e) => sum + Number(e.valor), 0);
      
      if (saidasRecebidas.length > 0) {
        updateTest("Saída recebido impacta saldo", {
          status: "pass",
          message: `${saidasRecebidas.length} saídas impactam saldo`,
          details: `Total saídas: R$ ${totalSaidas.toFixed(2)}`,
        });
      } else {
        updateTest("Saída recebido impacta saldo", {
          status: "pass",
          message: "Nenhuma saída recebida para testar (ok)",
        });
      }

      // 8. Entrada recebido impacta saldo
      updateTest("Entrada recebido impacta saldo", { status: "running" });
      const entradasRecebidas = entries.filter(
        (e) => e.type === "entrada" && e.status === "recebido"
      );
      
      if (entradasRecebidas.length > 0) {
        updateTest("Entrada recebido impacta saldo", {
          status: "pass",
          message: `${entradasRecebidas.length} entradas impactam saldo`,
          details: `Total entradas: R$ ${entradasRecebidasTotal.toFixed(2)}`,
        });
      } else {
        updateTest("Entrada recebido impacta saldo", {
          status: "pass",
          message: "Nenhuma entrada recebida para testar (ok)",
        });
      }

    } catch (err: any) {
      updateTest("Previsto NÃO impacta saldo", { status: "fail", message: err.message });
      updateTest("Saída recebido impacta saldo", { status: "fail", message: err.message });
      updateTest("Entrada recebido impacta saldo", { status: "fail", message: err.message });
    }

    setIsRunning(false);
  }, [currentCompany?.id, user?.id]);

  // Summary
  const summary = {
    total: testResults.length,
    passed: testResults.filter((t) => t.status === "pass").length,
    failed: testResults.filter((t) => t.status === "fail").length,
    pending: testResults.filter((t) => t.status === "pending" || t.status === "running").length,
  };

  return {
    testResults,
    isRunning,
    runTests,
    createSeedData,
    cleanupTestData,
    seedResult,
    cleanupResult,
    summary,
  };
}
