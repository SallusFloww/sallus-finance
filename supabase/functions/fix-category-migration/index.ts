import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find financial_entries with RECEBIMENTO_FATURAMENTO that have a receivable_id in observacao
  const { data: entries, error: fetchErr } = await supabase
    .from("financial_entries")
    .select("id, observacao")
    .eq("categoria", "RECEBIMENTO_FATURAMENTO")
    .like("observacao", "%receivable_id=%");

  if (fetchErr) return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });

  let updated = 0;
  let skipped = 0;

  for (const entry of entries || []) {
    const match = entry.observacao?.match(/receivable_id=([a-f0-9-]{36})/);
    if (!match) { skipped++; continue; }

    const receivableId = match[1];

    // Find productions linked to this receivable
    const { data: prods } = await supabase
      .from("productions")
      .select("production_type")
      .eq("linked_receivable_id", receivableId);

    if (!prods || prods.length === 0) { skipped++; continue; }

    const uniqueTypes = [...new Set(prods.map(p => p.production_type).filter(Boolean))];
    if (uniqueTypes.length !== 1) { skipped++; continue; }

    const newCategory = uniqueTypes[0];

    const { error: updateErr } = await supabase
      .from("financial_entries")
      .update({ categoria: newCategory })
      .eq("id", entry.id);

    if (!updateErr) updated++;
    else skipped++;
  }

  return new Response(JSON.stringify({ updated, skipped, total: entries?.length || 0 }));
});
