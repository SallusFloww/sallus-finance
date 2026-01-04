import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock, Users, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface BIAlert {
  id: string;
  type: "info" | "warning" | "critical";
  icon: React.ReactNode;
  title: string;
  description: string;
  value?: string;
}

interface BIAlertsCardProps {
  kpis: {
    produzido: number;
    faturado: number;
    recebido: number;
    emAberto: number;
    taxaRecebimento: number;
    taxaFaturamento: number;
  };
  agingData: { range: string; value: number; count: number }[];
  payerData: { payer: string; value: number; percentage: number }[];
}

export function BIAlertsCard({ kpis, agingData, payerData }: BIAlertsCardProps) {
  const alerts = useMemo((): BIAlert[] => {
    const result: BIAlert[] = [];

    // Verificar se há dados suficientes para análise
    const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
    const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
    const hasAgingData = agingData.some(a => a.value > 0);
    const hasPayerData = payerData.length > 0 && payerData.some(p => p.value > 0);

    // REGRA: Dados insuficientes para análise
    if (!hasProductionData && !hasBillingData && !hasAgingData) {
      result.push({
        id: "insufficient-data",
        type: "info",
        icon: <Clock className="h-4 w-4" />,
        title: "Dados insuficientes para análise",
        description: "Aguarde consolidação dos dados do período selecionado para visualizar alertas.",
      });
      return result;
    }

    // Produção > Faturamento
    if (hasProductionData && kpis.produzido > kpis.faturado && kpis.faturado > 0 && kpis.taxaFaturamento < 85) {
      result.push({
        id: "prod-fat",
        type: "warning",
        icon: <TrendingDown className="h-4 w-4" />,
        title: "Produção sem faturamento",
        description: `${((1 - kpis.taxaFaturamento / 100) * 100).toFixed(0)}% da produção ainda não faturada`,
        value: formatCurrency(kpis.produzido - kpis.faturado),
      });
    }

    // Faturamento > Recebimento
    if (hasBillingData && kpis.faturado > kpis.recebido && kpis.recebido > 0 && kpis.taxaRecebimento < 70) {
      result.push({
        id: "fat-receb",
        type: kpis.taxaRecebimento < 50 ? "critical" : "warning",
        icon: <Clock className="h-4 w-4" />,
        title: "Recebimento abaixo do esperado",
        description: `Taxa de recebimento em ${kpis.taxaRecebimento.toFixed(0)}%`,
        value: formatCurrency(kpis.emAberto),
      });
    }

    // Aging crítico (>60 dias)
    if (hasAgingData) {
      const aging6090 = agingData.find(a => a.range === "61-90 dias")?.value || 0;
      const aging90 = agingData.find(a => a.range === "90+ dias")?.value || 0;
      const agingCritical = aging6090 + aging90;
      if (agingCritical > 0) {
        result.push({
          id: "aging-critical",
          type: "critical",
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Valores em atraso crítico",
          description: "Títulos com mais de 60 dias em aberto",
          value: formatCurrency(agingCritical),
        });
      }
    }

    // Concentração de convênio
    if (hasPayerData) {
      const topPayer = payerData[0];
      if (topPayer && topPayer.percentage > 60) {
        result.push({
          id: "concentration",
          type: "info",
          icon: <Users className="h-4 w-4" />,
          title: "Concentração de pagador",
          description: `${topPayer.payer} representa ${topPayer.percentage.toFixed(0)}% dos recebimentos`,
        });
      }
    }

    // Sem alertas
    if (result.length === 0) {
      result.push({
        id: "no-alerts",
        type: "info",
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Operação dentro dos parâmetros",
        description: "Nenhum alerta crítico identificado no período",
      });
    }

    return result;
  }, [kpis, agingData, payerData]);

  const getAlertStyles = (type: BIAlert["type"]) => {
    switch (type) {
      case "critical":
        return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900";
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900";
      case "info":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900";
    }
  };

  const getIconStyles = (type: BIAlert["type"]) => {
    switch (type) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      case "info":
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getBadgeVariant = (type: BIAlert["type"]) => {
    switch (type) {
      case "critical":
        return "destructive";
      case "warning":
        return "secondary";
      case "info":
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertas Inteligentes
          {alerts.some(a => a.type === "critical") && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1">
              {alerts.filter(a => a.type === "critical").length} crítico
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors",
              getAlertStyles(alert.type)
            )}
          >
            <div className={cn("mt-0.5", getIconStyles(alert.type))}>
              {alert.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{alert.title}</p>
                <Badge variant={getBadgeVariant(alert.type)} className="text-[9px] h-4 px-1">
                  {alert.type === "critical" ? "Crítico" : alert.type === "warning" ? "Atenção" : "Info"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
              {alert.value && (
                <p className="text-xs font-medium text-foreground mt-1">{alert.value}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
