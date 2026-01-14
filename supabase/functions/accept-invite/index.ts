/**
 * =====================================================
 * ACCEPT-INVITE EDGE FUNCTION
 * =====================================================
 * Fluxo corrigido e robusto para aceite de convites.
 * 
 * REGRAS CRÍTICAS:
 * 1. NÃO marcar convite como "accepted" até que TODO o processo seja concluído
 * 2. Falhas intermediárias NÃO queimam o token
 * 3. Idempotência: usuário pode tentar novamente com mesmo token
 * 4. Commit final apenas no sucesso total
 * =====================================================
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
};

// Error codes padronizados
const ErrorCodes = {
  MISSING_PARAMS: "MISSING_PARAMS",
  INVALID_INVITE_TOKEN: "INVALID_INVITE_TOKEN",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_ALREADY_ACCEPTED: "INVITE_ALREADY_ACCEPTED",
  INVITE_CANCELLED: "INVITE_CANCELLED",
  USER_CREATION_FAILED: "USER_CREATION_FAILED",
  COMPANY_LINK_FAILED: "COMPANY_LINK_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  USER_EXISTS_LINKED: "USER_EXISTS_LINKED",
} as const;

function errorResponse(code: string, message: string, status: number, extras: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ error: message, code, ...extras }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function successResponse(data: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables");
      return errorResponse(ErrorCodes.INTERNAL_ERROR, "Configuração do servidor incompleta", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body - accept both formats
    const body = await req.json();
    const token = body.token || body.inviteToken;
    const password = body.password;

    // =====================================================
    // STEP 1: VALIDAÇÃO INICIAL (READ-ONLY)
    // =====================================================
    if (!token || !password) {
      return errorResponse(
        ErrorCodes.MISSING_PARAMS,
        "Token e senha são obrigatórios",
        400
      );
    }

    console.log("[accept-invite] Processing token:", token.substring(0, 8) + "...");

    // Buscar convite diretamente (não usar RPC que pode ter problemas de mapeamento)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("user_invites")
      .select("id, email, full_name, company_id, role_id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("[accept-invite] DB error fetching invite:", inviteError);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, "Erro ao buscar convite", 500);
    }

    if (!invite) {
      console.log("[accept-invite] Token not found");
      return errorResponse(ErrorCodes.INVALID_INVITE_TOKEN, "Token de convite inválido", 400);
    }

    // Verificar status do convite
    if (invite.status === "accepted") {
      console.log("[accept-invite] Invite already accepted");
      return errorResponse(
        ErrorCodes.INVITE_ALREADY_ACCEPTED,
        "Este convite já foi utilizado. Faça login com seu email e senha.",
        400,
        { userExists: true }
      );
    }

    if (invite.status === "cancelled") {
      console.log("[accept-invite] Invite was cancelled");
      return errorResponse(ErrorCodes.INVITE_CANCELLED, "Este convite foi cancelado", 400);
    }

    if (invite.status !== "pending") {
      console.log("[accept-invite] Invite has invalid status:", invite.status);
      return errorResponse(ErrorCodes.INVALID_INVITE_TOKEN, "Convite inválido", 400);
    }

    // Verificar expiração
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < new Date()) {
      console.log("[accept-invite] Invite expired at:", expiresAt);
      return errorResponse(ErrorCodes.INVITE_EXPIRED, "Este convite expirou", 400);
    }

    const { id: inviteId, email, full_name: fullName, company_id: companyId, role_id: roleId } = invite;

    console.log("[accept-invite] Valid invite for:", email, "company:", companyId);

    // =====================================================
    // STEP 2: VERIFICAR SE USUÁRIO JÁ EXISTE
    // =====================================================
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log("[accept-invite] User already exists:", existingUser.id);
      userId = existingUser.id;

      // Verificar se já tem vínculo com esta empresa
      const { data: existingUCR } = await supabaseAdmin
        .from("user_company_roles")
        .select("id, is_active")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingUCR) {
        if (existingUCR.is_active) {
          // Usuário já ativo nesta empresa - marcar convite como aceito e informar
          console.log("[accept-invite] User already active in company");
          
          // COMMIT: marcar convite como aceito (usuário já está vinculado)
          await supabaseAdmin
            .from("user_invites")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", inviteId);

          return errorResponse(
            ErrorCodes.USER_EXISTS_LINKED,
            "Você já está cadastrado nesta empresa. Faça login com sua senha existente.",
            400,
            { userExists: true }
          );
        } else {
          // Reativar vínculo inativo
          const { error: reactivateError } = await supabaseAdmin
            .from("user_company_roles")
            .update({ is_active: true, role_id: roleId, updated_at: new Date().toISOString() })
            .eq("id", existingUCR.id);

          if (reactivateError) {
            console.error("[accept-invite] Error reactivating user:", reactivateError);
            return errorResponse(ErrorCodes.COMPANY_LINK_FAILED, "Erro ao reativar acesso", 500);
          }

          console.log("[accept-invite] Reactivated existing user link");
        }
      } else {
        // Criar novo vínculo para usuário existente
        const { error: linkError } = await supabaseAdmin
          .from("user_company_roles")
          .insert({
            user_id: userId,
            company_id: companyId,
            role_id: roleId,
            is_primary: false,
            is_active: true,
          });

        if (linkError) {
          console.error("[accept-invite] Error linking existing user:", linkError);
          return errorResponse(ErrorCodes.COMPANY_LINK_FAILED, "Erro ao vincular à empresa", 500);
        }

        console.log("[accept-invite] Linked existing user to company");
      }

      // COMMIT FINAL: Marcar convite como aceito
      const { error: updateError } = await supabaseAdmin
        .from("user_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", inviteId);

      if (updateError) {
        console.error("[accept-invite] Error updating invite status:", updateError);
        // Não falhar aqui - o vínculo já foi criado
      }

      return successResponse({
        userId,
        email,
        message: "Acesso concedido. Faça login com sua senha existente.",
        userExists: true,
      });
    }

    // =====================================================
    // STEP 3: CRIAR NOVO USUÁRIO
    // =====================================================
    console.log("[accept-invite] Creating new user:", email);

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created?.user) {
      console.error("[accept-invite] User creation failed:", createError);
      
      // Verificar se é erro de duplicidade (race condition)
      if (createError?.message?.toLowerCase().includes("already") ||
          createError?.message?.toLowerCase().includes("duplicate")) {
        return errorResponse(
          ErrorCodes.USER_CREATION_FAILED,
          "Este email já está cadastrado. Faça login com sua senha.",
          400,
          { userExists: true }
        );
      }

      return errorResponse(
        ErrorCodes.USER_CREATION_FAILED,
        createError?.message || "Erro ao criar usuário",
        500
      );
    }

    userId = created.user.id;
    console.log("[accept-invite] User created:", userId);

    // =====================================================
    // STEP 4: CRIAR/VERIFICAR PROFILE
    // =====================================================
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email.toLowerCase(),
        full_name: fullName,
        status: "active",
      }, { onConflict: "id" });

    if (profileError) {
      console.error("[accept-invite] Profile creation warning:", profileError);
      // Não falhar - o trigger pode ter criado automaticamente
    }

    // =====================================================
    // STEP 5: CRIAR VÍNCULO COM EMPRESA
    // =====================================================
    // Verificar se já existe (idempotência)
    const { data: existingLink } = await supabaseAdmin
      .from("user_company_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!existingLink) {
      const { error: ucrError } = await supabaseAdmin
        .from("user_company_roles")
        .insert({
          user_id: userId,
          company_id: companyId,
          role_id: roleId,
          is_primary: true,
          is_active: true,
        });

      if (ucrError) {
        console.error("[accept-invite] Error creating company link:", ucrError);
        // CRITICAL: Usuário foi criado mas não vinculado - NÃO marcar convite como aceito
        return errorResponse(
          ErrorCodes.COMPANY_LINK_FAILED,
          "Usuário criado, mas erro ao vincular à empresa. Tente novamente.",
          500
        );
      }

      console.log("[accept-invite] Company link created");
    } else {
      console.log("[accept-invite] Company link already exists");
    }

    // =====================================================
    // STEP 6: COMMIT FINAL - MARCAR CONVITE COMO ACEITO
    // Somente aqui, após TODO o processo ter sido concluído
    // =====================================================
    const { error: finalUpdateError } = await supabaseAdmin
      .from("user_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (finalUpdateError) {
      console.error("[accept-invite] Error marking invite as accepted:", finalUpdateError);
      // Não falhar - o usuário foi criado e vinculado com sucesso
    }

    console.log("[accept-invite] SUCCESS - Invite fully processed for:", email);

    return successResponse({
      userId,
      email,
      message: "Conta criada com sucesso!",
    });

  } catch (error) {
    console.error("[accept-invite] Unhandled error:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Erro interno ao processar convite. Tente novamente.",
      500
    );
  }
});
