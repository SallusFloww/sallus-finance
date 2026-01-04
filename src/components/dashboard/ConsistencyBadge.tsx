import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  FileCheck,
  Calculator,
  FileSpreadsheet,
  ArrowRightLeft,
  Tag
} from "lucide-react";
import { ConsistencyCheckResult, ConsistencyIssue } from "@/hooks/useConsistencyCheck";
import { cn } from "@/lib/utils";

interface ConsistencyBadgeProps {
  result: ConsistencyCheckResult;
  showDetails?: boolean;
  className?: string;
}

const statusConfig = {
  consistent: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeVariant: "default" as const,
    badgeClass: "bg-emerald-500 hover:bg-emerald-600"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    badgeVariant: "secondary" as const,
    badgeClass: "bg-amber-500 hover:bg-amber-600 text-white"
  },
  error: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeVariant: "destructive" as const,
    badgeClass: ""
  }
};

const validationIcons = {
  period: FileCheck,
  score: Calculator,
  dre: FileSpreadsheet,
  signals: ArrowRightLeft,
  classification: Tag
};

const validationLabels = {
  period: "Período",
  score: "Score Mensal",
  dre: "DRE Gerencial",
  signals: "Sinais (+/-)",
  classification: "Classificação"
};

function IssueItem({ issue }: { issue: ConsistencyIssue }) {
  const Icon = issue.severity === "error" ? XCircle : AlertTriangle;
  const colorClass = issue.severity === "error" ? "text-red-600" : "text-amber-600";

  return (
    <div className="flex gap-2 py-2 border-b border-border/50 last:border-0">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", colorClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{issue.message}</p>
        {issue.details && (
          <p className="text-xs text-muted-foreground mt-0.5">{issue.details}</p>
        )}
      </div>
    </div>
  );
}

export function ConsistencyBadge({ result, showDetails = true, className }: ConsistencyBadgeProps) {
  const config = statusConfig[result.status];
  const StatusIcon = config.icon;

  if (!showDetails) {
    return (
      <Badge className={cn(config.badgeClass, "gap-1.5", className)}>
        <StatusIcon className="h-3.5 w-3.5" />
        {result.status === "consistent" ? "🟢" : result.status === "warning" ? "🟡" : "🔴"} {result.label}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border",
            config.bgColor,
            config.borderColor,
            config.color,
            "hover:opacity-90",
            className
          )}
        >
          <StatusIcon className="h-4 w-4" />
          <span className="font-medium">
            {result.status === "consistent" ? "🟢" : result.status === "warning" ? "🟡" : "🔴"} {result.label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className={cn("px-4 py-3 border-b", config.bgColor)}>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", config.color)} />
            <div>
              <h4 className={cn("font-semibold", config.color)}>
                {result.label}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Validation Status Grid */}
        <div className="p-4 border-b">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Validações
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(result.validations) as Array<keyof typeof result.validations>).map((key) => {
              const isValid = result.validations[key];
              const Icon = validationIcons[key];
              const label = validationLabels[key];

              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm",
                    isValid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1 truncate">{label}</span>
                  {isValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues List */}
        {result.issues.length > 0 && (
          <div className="p-4 max-h-64 overflow-y-auto">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Detalhamento ({result.issues.length})
            </h5>
            <div className="space-y-0">
              {result.issues.map((issue, index) => (
                <IssueItem key={index} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {result.issues.length === 0 && (
          <div className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma inconsistência encontrada.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
