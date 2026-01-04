import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { useBIFilters } from "@/contexts/BIFilterContext";

interface BIScoreHeroProps {
  score: number;
  label: string;
  factors: string[];
  isInFormation?: boolean;
}

export function BIScoreHero({ score, label, factors, isInFormation }: BIScoreHeroProps) {
  const getScoreColor = () => {
    if (isInFormation) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    if (score >= 85) return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
    if (score >= 70) return "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400";
    if (score >= 55) return "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400";
    if (score >= 40) return "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400";
    return "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400";
  };

  const getBorderColor = () => {
    if (isInFormation) return "border-slate-200 dark:border-slate-700";
    if (score >= 70) return "border-green-200 dark:border-green-900";
    if (score >= 55) return "border-amber-200 dark:border-amber-900";
    return "border-red-200 dark:border-red-900";
  };

  return (
    <Card className={cn("relative overflow-hidden border-2", getBorderColor())}>
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center gap-6">
          {/* Score Circle */}
          <div className={cn("flex flex-col items-center justify-center w-24 h-24 rounded-xl", getScoreColor())}>
            {isInFormation ? (
              <>
                <span className="text-2xl font-bold">—</span>
                <span className="text-[10px] font-medium uppercase tracking-wide">Em Formação</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold">{score}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide">Score</span>
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">Score Financeiro Consolidado</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      {isInFormation 
                        ? "Base de dados ainda insuficiente para cálculo consolidado. O score será calculado automaticamente conforme o histórico evoluir."
                        : "Calculado com base em: taxa de recebimento, risco de inadimplência, conversão produção→caixa e saúde do fluxo de caixa."
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {isInFormation ? (
              <p className="text-sm text-muted-foreground">
                Dados ainda em consolidação para cálculo completo do indicador.
              </p>
            ) : (
              <>
                <Badge 
                  variant={score >= 70 ? "default" : score >= 55 ? "secondary" : "destructive"}
                  className="mb-2"
                >
                  {label}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  {factors.slice(0, 3).map((factor, idx) => (
                    <span key={idx} className="text-xs text-muted-foreground">
                      • {factor}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BIKPIGridProps {
  kpis: {
    saldoFinal: number;
    entradas: number;
    saidas: number;
    produzido: number;
    faturado: number;
    recebido: number;
    emAberto: number;
    glosado: number;
    taxaRecebimento: number;
    taxaFaturamento: number;
  };
}

export function BIKPIGrid({ kpis }: BIKPIGridProps) {
  const getVariant = (value: number, goodThreshold: number, warnThreshold: number): "success" | "warning" | "danger" => {
    if (isNaN(value)) return "warning";
    if (value >= goodThreshold) return "success";
    if (value >= warnThreshold) return "warning";
    return "danger";
  };

  // Verificar se há dados suficientes para exibir taxas
  const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
  const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
  const hasCashData = kpis.entradas > 0 || kpis.saidas > 0;

  const items: MiniKPICardProps[] = [
    { 
      label: "Saldo Final", 
      value: kpis.saldoFinal, 
      type: "caixa", 
      variant: kpis.saldoFinal >= 0 ? "success" : "danger",
      tooltip: "Saldo atual de caixa após todas as movimentações realizadas.",
      isDataAvailable: hasCashData || kpis.saldoFinal !== 0
    },
    { 
      label: "Entradas", 
      value: kpis.entradas, 
      type: "caixa", 
      variant: "success",
      tooltip: "Total de receitas efetivamente recebidas no período.",
      isDataAvailable: hasCashData
    },
    { 
      label: "Saídas", 
      value: kpis.saidas, 
      type: "caixa", 
      variant: "danger",
      tooltip: "Total de despesas pagas no período.",
      isDataAvailable: hasCashData
    },
    { 
      label: "Produção", 
      value: kpis.produzido, 
      type: "competencia",
      tooltip: "Valor total dos procedimentos produzidos no período.",
      isDataAvailable: hasProductionData
    },
    { 
      label: "Faturado", 
      value: kpis.faturado, 
      type: "competencia",
      tooltip: "Valor total das faturas emitidas no período.",
      isDataAvailable: hasProductionData
    },
    { 
      label: "Recebido", 
      value: kpis.recebido, 
      type: "caixa", 
      variant: "success",
      tooltip: "Valor efetivamente recebido de convênios e particulares.",
      isDataAvailable: hasBillingData
    },
    { 
      label: "Em Aberto", 
      value: kpis.emAberto, 
      type: "competencia", 
      variant: kpis.emAberto > 0 ? "warning" : undefined,
      tooltip: "Valores faturados que ainda não foram recebidos.",
      isDataAvailable: hasBillingData
    },
    { 
      label: "Glosa", 
      value: kpis.glosado, 
      type: "competencia", 
      variant: kpis.glosado > 0 ? "danger" : undefined,
      tooltip: "Valores glosados por convênios.",
      isDataAvailable: hasBillingData
    },
    { 
      label: "Taxa Recebimento", 
      value: kpis.taxaRecebimento, 
      type: "competencia", 
      isPercent: true, 
      variant: hasBillingData ? getVariant(kpis.taxaRecebimento, 80, 60) : undefined,
      tooltip: "Percentual do faturado que foi efetivamente recebido (Recebido ÷ Faturado).",
      isDataAvailable: hasBillingData && kpis.faturado > 0
    },
    { 
      label: "Taxa Faturamento", 
      value: kpis.taxaFaturamento, 
      type: "competencia", 
      isPercent: true, 
      variant: hasProductionData ? getVariant(kpis.taxaFaturamento, 90, 70) : undefined,
      tooltip: "Percentual da produção que foi faturada (Faturado ÷ Produzido).",
      isDataAvailable: hasProductionData && kpis.produzido > 0
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {items.map((item) => (
        <MiniKPICard key={item.label} {...item} />
      ))}
    </div>
  );
}

interface MiniKPICardProps {
  label: string;
  value: number;
  type: "caixa" | "competencia";
  variant?: "success" | "warning" | "danger";
  isPercent?: boolean;
  tooltip?: string;
  isDataAvailable?: boolean;
}

function MiniKPICard({ label, value, type, variant, isPercent, tooltip, isDataAvailable = true }: MiniKPICardProps) {
  // REGRA: Nunca exibir 0 quando dados ausentes
  const isValidValue = isDataAvailable && !isNaN(value) && value !== null && value !== undefined;
  const showConsolidation = !isValidValue && value === 0;
  
  const displayValue = showConsolidation 
    ? "—"
    : isPercent 
      ? `${Math.min(999, Math.max(0, isNaN(value) ? 0 : value)).toFixed(1)}%` 
      : formatCurrency(isNaN(value) ? 0 : value);

  const borderClass = {
    success: "border-l-green-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
    undefined: type === "caixa" ? "border-l-primary" : "border-l-secondary",
  };

  const textClass = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    undefined: "text-foreground",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn("border-l-4 cursor-help transition-shadow hover:shadow-sm", borderClass[variant || "undefined"])}>
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                {label}
              </p>
              {showConsolidation ? (
                <p className="text-sm font-medium text-muted-foreground mt-1">
                  Em consolidação
                </p>
              ) : (
                <p className={cn("text-lg font-bold truncate", textClass[variant || "undefined"])}>
                  {displayValue}
                </p>
              )}
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] h-4 px-1 mt-1",
                  type === "caixa" ? "border-primary/30 text-primary" : "border-secondary/30 text-secondary"
                )}
              >
                {type === "caixa" ? "Caixa" : "Competência"}
              </Badge>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            {showConsolidation 
              ? "Dados ainda em consolidação para este período."
              : tooltip || `${label}: ${displayValue}`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
