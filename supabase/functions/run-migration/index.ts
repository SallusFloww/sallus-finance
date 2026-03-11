import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  // Make health_plan_id nullable
  const { error } = await client.rpc("", {}).maybeSingle();
  
  // Use raw SQL via pg
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  // Import postgres
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
  const sql = postgres(dbUrl);
  
  try {
    await sql`ALTER TABLE public.productions ALTER COLUMN health_plan_id DROP NOT NULL`;
    await sql.end();
    return new Response(JSON.stringify({ success: true, message: "health_plan_id is now nullable" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await sql.end();
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
