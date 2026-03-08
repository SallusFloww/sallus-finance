import { useEffect } from "react";
import { logErrorStandalone } from "@/hooks/useErrorLogger";

/**
 * Captures unhandled errors and promise rejections globally.
 * Attach once at the app root.
 */
export function useGlobalErrorCapture() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logErrorStandalone({
        action: "unhandled_error",
        error_message: event.message || "Unknown error",
        stack_trace: event.error?.stack,
        severity: "high",
        page: window.location.pathname,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason?.message || event.reason?.toString() || "Unhandled promise rejection";
      logErrorStandalone({
        action: "unhandled_rejection",
        error_message: message,
        stack_trace: event.reason?.stack,
        severity: "high",
        page: window.location.pathname,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
}
