import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ManagementAlert } from "./types";

interface ReportAlertsProps {
  alerts: ManagementAlert[];
  getManagementSuggestion: (alert: ManagementAlert) => string;
}

export function ReportAlerts({ alerts, getManagementSuggestion }: ReportAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h3 className="font-semibold text-foreground">Alertas Gerenciais</h3>
        <span className="text-xs text-muted-foreground ml-auto">{alerts.length} alerta(s)</span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg border p-3",
              alert.type === "danger" && "border-destructive/30 bg-destructive/10",
              alert.type === "warning" && "border-warning/30 bg-warning/10",
              alert.type === "info" && "border-primary/30 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{alert.riskIcon}</span>
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded",
                alert.type === "danger" && "bg-destructive/20 text-destructive",
                alert.type === "warning" && "bg-warning/20 text-warning",
                alert.type === "info" && "bg-primary/20 text-primary"
              )}>
                {alert.riskType}
              </span>
              {alert.unit && (
                <span className="text-xs text-muted-foreground">— {alert.unit}</span>
              )}
              {alert.specialty && (
                <span className="text-xs text-muted-foreground">› {alert.specialty}</span>
              )}
            </div>
            <p className={cn(
              "font-medium text-sm",
              alert.type === "danger" && "text-destructive",
              alert.type === "warning" && "text-warning",
              alert.type === "info" && "text-primary"
            )}>
              {alert.title}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{alert.description}</p>
              {alert.value && (
                <span className={cn(
                  "text-xs font-semibold",
                  alert.type === "danger" && "text-destructive",
                  alert.type === "warning" && "text-warning",
                  alert.type === "info" && "text-primary"
                )}>
                  {alert.value}
                </span>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="text-xs text-foreground">
                <span className="font-medium text-primary">💡 Sugestão Gerencial:</span>{" "}
                <span className="text-muted-foreground italic">{getManagementSuggestion(alert)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
