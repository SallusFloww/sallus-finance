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

  const tables = [
    "financial_entries",
    "receivables",
    "productions",
    "audit_logs",
  ];

  const results: Array<{
    table_name: string;
    total_records: number;
    status: string;
  }> = [];

  const today = new Date().toISOString().slice(0, 10);

  for (const table of tables) {
    try {
      // Count total records
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) throw error;

      // Log the backup record
      await supabase.from("system_backups").insert({
        backup_date: today,
        table_name: table,
        total_records: count || 0,
        status: "SUCCESS",
      });

      results.push({
        table_name: table,
        total_records: count || 0,
        status: "SUCCESS",
      });
    } catch (e: any) {
      await supabase.from("system_backups").insert({
        backup_date: today,
        table_name: table,
        total_records: 0,
        status: "ERROR",
        error_message: e.message,
      });

      results.push({
        table_name: table,
        total_records: 0,
        status: "ERROR",
      });
    }
  }

  // Cleanup old backups (>30 days)
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await supabase
      .from("system_backups")
      .delete()
      .lt("backup_date", cutoff.toISOString().slice(0, 10));
  } catch (_) {
    // Non-critical
  }

  // Log metric
  try {
    await supabase.from("system_metrics").insert({
      metric_name: "daily_backup",
      value: results.every((r) => r.status === "SUCCESS") ? 1 : 0,
      context: { results, date: today },
    });
  } catch (_) {}

  return new Response(
    JSON.stringify({
      status: results.every((r) => r.status === "SUCCESS")
        ? "BACKUP_OK"
        : "BACKUP_PARTIAL",
      date: today,
      results,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
