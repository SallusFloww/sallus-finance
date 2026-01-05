import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  companyId: string;
  roleId: string;
  companyName: string;
  roleName: string;
  invitedByName: string;
}

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* =========================
       AUTH
    ========================== */
    // Accept different header variations (case-insensitive)
    const authHeader =
      req.headers.get("Authorization") ||
      req.headers.get("authorization") ||
      req.headers.get("x-supabase-authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: "Não autorizado",
          details: "Header Authorization não encontrado" 
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: authData, error: authError } =
      await supabaseAnon.auth.getUser(jwt);

    if (authError || !authData?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ 
          error: "Usuário não autenticado",
          details: authError?.message ?? "JWT inválido ou expirado" 
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = authData.user;

    /* =========================
       BODY
    ========================== */
    const body: InviteRequest = await req.json();
    const {
      email,
      fullName,
      companyId,
      roleId,
      companyName,
      roleName,
      invitedByName,
    } = body;

    if (!email || !fullName || !companyId || !roleId) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios não preenchidos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    /* =========================
       CHECK IF USER EXISTS
    ========================== */
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // If user already exists in Auth, reactivate them instead of creating invite
    if (existingUser) {
      console.log("User already exists in Auth, attempting to reactivate:", existingUser.id);
      
      // Check if user already has a role in this company
      const { data: existingRole } = await supabaseAdmin
        .from("user_company_roles")
        .select("*")
        .eq("user_id", existingUser.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingRole) {
        // User already has role in this company - just reactivate if inactive
        if (!existingRole.is_active) {
          await supabaseAdmin
            .from("user_company_roles")
            .update({ 
              is_active: true, 
              role_id: roleId,
              updated_at: new Date().toISOString() 
            })
            .eq("id", existingRole.id);
          
          console.log("Reactivated existing user role");
          return new Response(
            JSON.stringify({ 
              success: true, 
              reactivated: true,
              message: "Usuário reativado com sucesso",
              userId: existingUser.id
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } else {
          // User is already active in this company
          return new Response(
            JSON.stringify({ error: "Este usuário já está ativo nesta empresa" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        // User exists but not in this company - add them
        const { error: insertError } = await supabaseAdmin
          .from("user_company_roles")
          .insert({
            user_id: existingUser.id,
            company_id: companyId,
            role_id: roleId,
            is_primary: false,
            is_active: true
          });

        if (insertError) {
          console.error("Error adding user to company:", insertError);
          throw insertError;
        }

        // Update profile name if provided
        if (fullName) {
          await supabaseAdmin
            .from("profiles")
            .update({ full_name: fullName })
            .eq("id", existingUser.id);
        }

        console.log("Added existing user to new company");
        return new Response(
          JSON.stringify({ 
            success: true, 
            reactivated: true,
            message: "Usuário adicionado à empresa com sucesso",
            userId: existingUser.id
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    /* =========================
       INVITE
    ========================== */
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: existingInvite } = await supabaseAdmin
      .from("user_invites")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("company_id", companyId)
      .eq("status", "pending")
      .maybeSingle();

    let invite;

    if (existingInvite) {
      const { data, error } = await supabaseAdmin
        .from("user_invites")
        .update({
          full_name: fullName,
          role_id: roleId,
          invited_by: user.id,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingInvite.id)
        .select()
        .single();

      if (error) throw error;
      invite = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("user_invites")
        .insert({
          email: email.toLowerCase(),
          full_name: fullName,
          company_id: companyId,
          role_id: roleId,
          invited_by: user.id,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;
      invite = data;
    }

    /* =========================
       BUILD INVITE URL
    ========================== */
    const fallbackUrl = (Deno.env.get("APP_URL") || "https://finance.sallusflow.com.br").replace(/\/$/, "");
    const origin = req.headers.get("origin") || "";
    let appUrl = (origin || fallbackUrl).replace(/\/$/, "");

    // Blindagem: nunca permitir placeholder ou string inválida
    if (
      !appUrl ||
      appUrl.includes("placeholder_value_to_be_replaced") ||
      !appUrl.startsWith("http")
    ) {
      appUrl = fallbackUrl;
    }

    const inviteUrl = `${appUrl}/i/${invite.token}`;
    console.log("Generated inviteUrl:", inviteUrl);

    /* =========================
       EMAIL (with fallback)
    ========================== */
    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpPortStr = Deno.env.get("SMTP_PORT") || "587";
    const smtpPort = parseInt(smtpPortStr, 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";

    let emailSent = false;
    let emailError: string | null = null;

    // Validate SMTP configuration before attempting to send
    const smtpConfigured = smtpHost && smtpUser && smtpPass && !isNaN(smtpPort) && smtpPort > 0;
    const isValidEmail = smtpUser.includes("@");

    if (!smtpConfigured) {
      console.log("SMTP não configurado, retornando apenas inviteUrl");
      emailError = "SMTP não configurado";
    } else if (!isValidEmail) {
      console.log("SMTP_USER não é um email válido:", smtpUser);
      emailError = "Email remetente inválido";
    } else {
      try {
        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: false, // STARTTLS
            auth: {
              username: smtpUser,
              password: smtpPass,
            },
          },
        });

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Convite SallusFinance</h2>
            <p>Olá, <strong>${fullName}</strong>!</p>
            <p>${invitedByName} convidou você para a empresa <b>${companyName}</b>.</p>
            <p>Perfil: <b>${roleName}</b></p>
            <p style="margin: 24px 0;">
              <a href="${inviteUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                👉 Aceitar convite
              </a>
            </p>
            <p style="font-size: 12px; color: #666;">Este convite expira em 24h.</p>
            <p style="font-size: 11px; color: #999; margin-top: 16px;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${inviteUrl}</p>
          </div>
        `;

        await client.send({
          from: `SallusFinance <${smtpUser}>`,
          to: email,
          subject: `Convite para acessar o SallusFinance`,
          html,
          content: "auto",
        });

        await client.close();
        emailSent = true;
        console.log("Email sent successfully to:", email);
      } catch (err) {
        console.error("Falha ao enviar e-mail de convite:", err);
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    // Sempre retorna sucesso com status do e-mail
    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        inviteUrl,
        ...(emailError ? { emailError } : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("SEND INVITE ERROR:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
