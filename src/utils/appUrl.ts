/**
 * Centralized utility for getting the app base URL
 * 
 * PRODUCTION DOMAIN: https://finance.sallusflow.com.br
 * 
 * This ensures all invite links and redirects use the official domain,
 * regardless of the environment (local, preview, production).
 */

const PRODUCTION_URL = "https://finance.sallusflow.com.br";

/**
 * Returns the base URL for the application.
 * In production, always returns the official domain.
 * Falls back to window.location.origin only in development with localhost.
 */
export function getAppBaseUrl(): string {
  // Check if we have VITE_APP_URL set (for flexibility)
  const envUrl = import.meta.env.VITE_APP_URL;
  
  if (envUrl && isValidProductionUrl(envUrl)) {
    return envUrl.replace(/\/$/, ""); // Remove trailing slash
  }
  
  // In browser context, check if we're on localhost for development
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    
    // Allow localhost for development
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return origin;
    }
    
    // If we're on the production domain, use it
    if (origin.includes("finance.sallusflow.com.br")) {
      return PRODUCTION_URL;
    }
  }
  
  // Default to production URL (never use lovable preview URLs)
  return PRODUCTION_URL;
}

/**
 * Validates that a URL is suitable for production use.
 * Rejects placeholder values, lovable preview URLs, and localhost.
 */
function isValidProductionUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  if (!url.startsWith("http")) return false;
  if (url.includes("placeholder")) return false;
  if (url.includes("lovable")) return false;
  if (url.includes("localhost")) return false;
  if (url.includes("127.0.0.1")) return false;
  
  return true;
}

/**
 * Generates an invite URL using the standardized format: /i/<token>
 */
export function generateInviteUrl(token: string): string {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/i/${token}`;
}

/**
 * Generates an auth URL with invite parameter (for redirects after validation)
 */
export function generateAuthInviteUrl(token: string): string {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/auth?invite=${token}`;
}
