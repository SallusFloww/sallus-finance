import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Accept both formats: { token, password } or { inviteToken, password }
    const body = await req.json();
    const token = body.token || body.inviteToken;
    const password = body.password;

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token e senha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Validar token via RPC
    const { data: invite, error: inviteError } = await supabaseAdmin.rpc("validate_invite_token", {
      _token: token,
    });

    if (inviteError || !invite) {
      console.error("Invite validation error:", inviteError);
      return new Response(
        JSON.stringify({ error: "Convite inválido ou expirado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // validate_invite_token returns an array, get the first row
    const inviteRow = Array.isArray(invite) ? invite[0] : invite;

    if (!inviteRow || !inviteRow.is_valid) {
      return new Response(
        JSON.stringify({ error: "Este convite já foi utilizado ou expirou." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = inviteRow.email as string;
    const inviteId = inviteRow.id as string;

    // Fetch full invite data to get company_id and role_id
    const { data: fullInvite, error: fullInviteError } = await supabaseAdmin
      .from("user_invites")
      .select("company_id, role_id, full_name, status")
      .eq("id", inviteId)
      .single();

    if (fullInviteError || !fullInvite) {
      console.error("Full invite fetch error:", fullInviteError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar dados do convite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fullInvite.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Este convite já foi utilizado ou cancelado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = fullInvite.company_id as string;
    const roleId = fullInvite.role_id as string;
    const fullName = fullInvite.full_name as string;

    if (!companyId || !roleId) {
      return new Response(
        JSON.stringify({ error: "Convite inválido: company_id/role_id ausente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing invite for:", email, "company:", companyId, "role:", roleId);

    // 2) Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      console.log("User already exists:", existingUser.id);
      
      // Check if user already has access to this company
      const { data: existingUCR } = await supabaseAdmin
        .from("user_company_roles")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingUCR) {
        // User already has access to this company
        return new Response(
          JSON.stringify({ 
            error: "Este email já está cadastrado e já tem acesso a esta empresa. Faça login normalmente.",
            userExists: true 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // User exists but doesn't have access to this company - add them
      const { error: ucrError } = await supabaseAdmin.from("user_company_roles").insert({
        user_id: existingUser.id,
        company_id: companyId,
        role_id: roleId,
        is_primary: false, // Not primary since they already have another company
        is_active: true,
      });

      if (ucrError) {
        console.error("Erro ao vincular usuário existente:", ucrError);
        return new Response(
          JSON.stringify({ error: "Erro ao vincular usuário à empresa." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark invite as accepted
      await supabaseAdmin
        .from("user_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", inviteId);

      return new Response(
        JSON.stringify({ 
          error: "Este email já está cadastrado. Foi vinculado à empresa. Faça login com sua senha existente.",
          userExists: true 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Criar usuário novo
    const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createUserError || !created?.user) {
      console.error("Create user error:", createUserError);
      
      // Check if it's a duplicate error
      if (createUserError?.message?.toLowerCase().includes("already") || 
          createUserError?.message?.toLowerCase().includes("duplicate")) {
        return new Response(
          JSON.stringify({ 
            error: "Este email já está cadastrado. Faça login com sua senha existente.",
            userExists: true 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createUserError?.message || "Erro ao criar usuário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user.id;
    console.log("User created:", userId);

    // 4) Criar profile (se der duplicate, ignora)
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email: email.toLowerCase(),
      full_name: fullName,
      status: "active",
    });

    if (profileError && !String(profileError.message).toLowerCase().includes("duplicate")) {
      console.error("Erro ao criar profile:", profileError);
    }

    // 5) Inserir permissão na tabela CORRETA: user_company_roles
    const { data: existingUCR } = await supabaseAdmin
      .from("user_company_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!existingUCR?.id) {
      const { error: ucrError } = await supabaseAdmin.from("user_company_roles").insert({
        user_id: userId,
        company_id: companyId,
        role_id: roleId,
        is_primary: true,
        is_active: true,
      });

      if (ucrError) {
        console.error("Erro ao inserir user_company_roles:", ucrError);
        return new Response(
          JSON.stringify({ error: "Erro ao atribuir permissão do usuário." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("user_company_roles created for user:", userId);
    } else {
      console.log("user_company_roles already exists for user:", userId);
    }

    // 6) Marcar convite como aceito
    const { error: updateInviteError } = await supabaseAdmin
      .from("user_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (updateInviteError) {
      console.error("Erro ao atualizar convite:", updateInviteError);
    }

    console.log("Invite accepted successfully for:", email);

    return new Response(JSON.stringify({ success: true, userId, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("accept-invite error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao processar convite." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
