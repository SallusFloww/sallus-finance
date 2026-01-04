import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInviteRequest {
  inviteToken: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AcceptInviteRequest = await req.json();
    const { inviteToken, password } = body;

    console.log("Accepting invite with token:", inviteToken);

    // Validate required fields
    if (!inviteToken || !password) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Token e senha são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1. Validate invite token
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from("user_invites")
      .select(`
        id,
        email,
        full_name,
        company_id,
        role_id,
        status,
        expires_at,
        companies(name),
        roles(name)
      `)
      .eq("token", inviteToken)
      .single();

    if (inviteError || !inviteData) {
      console.error("Invalid invite token:", inviteError);
      return new Response(
        JSON.stringify({ error: "Convite não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if invite is still valid
    if (inviteData.status !== "pending") {
      console.error("Invite already used:", inviteData.status);
      return new Response(
        JSON.stringify({ error: "Este convite já foi utilizado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (new Date(inviteData.expires_at) < new Date()) {
      console.error("Invite expired:", inviteData.expires_at);
      return new Response(
        JSON.stringify({ error: "Este convite expirou. Solicite um novo convite ao administrador." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const email = inviteData.email;
    const fullName = inviteData.full_name;
    const companyId = inviteData.company_id;
    const roleId = inviteData.role_id;

    console.log("Creating user for:", email, "in company:", companyId);

    // 2. Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log("User already exists, linking to company:", existingUser.id);
      userId = existingUser.id;
      
      // Update the user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );
      
      if (updateError) {
        console.error("Error updating user password:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar senha" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // 3. Create new user in auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta: " + createError.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userId = newUser.user.id;
      console.log("New user created:", userId);

      // 4. Create profile record (in case trigger didn't fire)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          email: email.toLowerCase(),
          full_name: fullName,
          status: "active",
        }, { onConflict: "id" });

      if (profileError) {
        console.error("Error creating profile (non-fatal):", profileError);
      }
    }

    // 5. Create/update user_company_roles link
    const { error: roleError } = await supabaseAdmin
      .from("user_company_roles")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role_id: roleId,
        is_active: true,
        is_primary: true,
      }, { onConflict: "user_id,company_id" });

    if (roleError) {
      console.error("Error linking user to company:", roleError);
      return new Response(
        JSON.stringify({ error: "Erro ao vincular usuário à empresa" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User linked to company successfully");

    // 6. Mark invite as accepted
    const { error: updateError } = await supabaseAdmin
      .from("user_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteData.id);

    if (updateError) {
      console.error("Error updating invite status (non-fatal):", updateError);
    }

    console.log("Invite accepted successfully for:", email);

    // 7. Return success with user data for auto-login
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email,
        fullName,
        companyId,
        companyName: (inviteData.companies as any)?.name || "",
        roleName: (inviteData.roles as any)?.name || "",
        message: "Conta criada com sucesso!",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in accept-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
