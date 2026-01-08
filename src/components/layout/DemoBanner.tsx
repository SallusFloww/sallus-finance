import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function DemoBanner() {
  const { isDemo } = useAuth();

  if (!isDemo()) {
    return null;
  }

  return (
    <div className="bg-amber-500 text-amber-950 py-2 px-4 text-center text-sm font-medium sticky top-0 z-[60] shadow-md">
      <div className="container flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>🟡 MODO DEMO — DADOS FICTÍCIOS</span>
        <AlertTriangle className="h-4 w-4" />
      </div>
    </div>
  );
}
