import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /* =========================
       AUTH
    ========================== */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
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
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
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
       CHECK USER
    ========================== */
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const alreadyExists = users?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (alreadyExists) {
      return new Response(
        JSON.stringify({ error: "Este e-mail já possui conta" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
       EMAIL
    ========================== */
    const appUrl = (
      Deno.env.get("APP_URL") || "https://finance.sallusfinance.com.br"
    ).replace(/\/$/, "");

    const inviteUrl = `${appUrl}/auth?invite_token=${invite.token}`;

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP não configurado");
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: false, // STARTTLS (CORRETO PARA UMBLER)
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    const html = `
      <h2>Convite SallusFinance</h2>
      <p>Olá, <strong>${fullName}</strong></p>
      <p>${invitedByName} convidou você para a empresa <b>${companyName}</b></p>
      <p>Perfil: <b>${roleName}</b></p>
      <p>
        <a href="${inviteUrl}">👉 Aceitar convite</a>
      </p>
      <p>Este convite expira em 24h.</p>
    `;

    await client.send({
      from: `SallusFinance <${smtpUser}>`,
      to: email,
      subject: `Convite para acessar o SallusFinance`,
      html,
      content: "auto",
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
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
