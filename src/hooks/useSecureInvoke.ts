import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

/**
 * Securely invokes a Supabase Edge Function with proper JWT handling.
 * - Gets fresh session before invoking
 * - Retries once with refreshed session on 401
 * - Provides clear error messages for auth issues
 */
export async function secureInvoke<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  // Get current session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !sessionData?.session?.access_token) {
    return {
      data: null,
      error: new Error("Sessão expirada. Faça login novamente."),
    };
  }

  let accessToken = sessionData.session.access_token;

  // First attempt
  const invokeWithToken = async (token: string) => {
    return await supabase.functions.invoke<T>(functionName, {
      body: options.body,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let result = await invokeWithToken(accessToken);

  // If 401, try refreshing session once
  if (result.error) {
    const errorMessage = result.error.message?.toLowerCase() || "";
    const is401 =
      errorMessage.includes("401") ||
      errorMessage.includes("jwt") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("não autorizado");

    if (is401) {
      console.log("Token may be expired, attempting refresh...");
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData?.session?.access_token) {
        return {
          data: null,
          error: new Error("Sessão expirada. Faça login novamente."),
        };
      }

      // Retry with new token
      accessToken = refreshData.session.access_token;
      result = await invokeWithToken(accessToken);
    }
  }

  // Check for errors in response body
  if (!result.error && result.data && typeof result.data === "object") {
    const responseData = result.data as Record<string, unknown>;
    if (responseData.error && typeof responseData.error === "string") {
      return {
        data: null,
        error: new Error(responseData.error),
      };
    }
  }

  return {
    data: result.data as T,
    error: result.error,
  };
}
