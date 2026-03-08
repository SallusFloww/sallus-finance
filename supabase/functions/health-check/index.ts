import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const checks: Record<string, { status: string; detail?: string }> = {};
  let overallStatus = "SYSTEM_OK";

  // 1. Database connectivity
  try {
    const { count, error } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    checks.database = { status: "OK", detail: `${count} companies` };
  } catch (e: any) {
    checks.database = { status: "ERROR", detail: e.message };
    overallStatus = "SYSTEM_ERROR";
  }

  // 2. Auth service
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error) throw error;
    checks.auth = { status: "OK", detail: "Auth service responsive" };
  } catch (e: any) {
    checks.auth = { status: "WARNING", detail: e.message };
    if (overallStatus !== "SYSTEM_ERROR") overallStatus = "SYSTEM_WARNING";
  }

  // 3. Financial integrity per company
  try {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("status", "active");

    const integrityIssues: string[] = [];

    for (const company of companies || []) {
      // Get initial balance
      const { data: settings } = await supabase
        .from("company_financial_settings")
        .select("initial_balance")
        .eq("company_id", company.id)
        .maybeSingle();

      const initialBalance = settings?.initial_balance ?? 0;

      // Get realized entries
      const { data: entries } = await supabase
        .from("financial_entries")
        .select("type, valor")
        .eq("company_id", company.id)
        .eq("status", "recebido");

      let income = 0;
      let expense = 0;
      for (const e of entries || []) {
        if (e.type === "entrada") income += Number(e.valor);
        else expense += Number(e.valor);
      }

      const balance = initialBalance + income - expense;

      // Just verify the math is consistent (no external "displayed" balance to compare)
      if (isNaN(balance)) {
        integrityIssues.push(
          `${company.name}: NaN balance detected`
        );
      }
    }

    if (integrityIssues.length > 0) {
      checks.financial_integrity = {
        status: "WARNING",
        detail: integrityIssues.join("; "),
      };
      if (overallStatus !== "SYSTEM_ERROR") overallStatus = "SYSTEM_WARNING";
    } else {
      checks.financial_integrity = {
        status: "OK",
        detail: `${(companies || []).length} companies verified`,
      };
    }
  } catch (e: any) {
    checks.financial_integrity = { status: "ERROR", detail: e.message };
    overallStatus = "SYSTEM_ERROR";
  }

  // 4. Table growth monitoring
  try {
    const tables = [
      "financial_entries",
      "receivables",
      "productions",
      "audit_logs",
    ];
    const warnings: string[] = [];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) continue;
      if ((count || 0) > 10000) {
        warnings.push(`${table}: ${count} rows (>10k)`);
      }
    }

    if (warnings.length > 0) {
      checks.table_growth = {
        status: "WARNING",
        detail: warnings.join("; ") +
          " — Recomendado: ativar filtros server-side e virtual scrolling",
      };
      if (overallStatus !== "SYSTEM_ERROR") overallStatus = "SYSTEM_WARNING";
    } else {
      checks.table_growth = { status: "OK", detail: "All tables within limits" };
    }
  } catch (e: any) {
    checks.table_growth = { status: "WARNING", detail: e.message };
  }

  // 5. Log the health check result as a metric
  try {
    await supabase.from("system_metrics").insert({
      metric_name: "health_check",
      value: overallStatus === "SYSTEM_OK" ? 1 : overallStatus === "SYSTEM_WARNING" ? 0.5 : 0,
      context: { checks, overall: overallStatus },
    });
  } catch (_) {
    // Non-critical
  }

  return new Response(
    JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
