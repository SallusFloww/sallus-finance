import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface BIInsight {
  id: string;
  type: "opportunity" | "risk" | "success" | "action";
  fact: string;
  impact: string;
  action: string;
  priority: "high" | "medium" | "low";
}

interface BIInsightsCardProps {
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
  agingCritical?: number;
}

export function BIInsightsCard({ kpis, agingCritical = 0 }: BIInsightsCardProps) {
  const insights = useMemo((): BIInsight[] => {
    const result: BIInsight[] = [];

    // Verificar se há dados suficientes para análise
    const hasProductionData = kpis.produzido > 0 || kpis.faturado > 0;
    const hasBillingData = kpis.faturado > 0 || kpis.recebido > 0;
    const hasCashData = kpis.entradas > 0 || kpis.saidas > 0;

    // REGRA: Dados insuficientes para análise
    if (!hasProductionData && !hasBillingData && !hasCashData) {
      result.push({
        id: "insufficient-data",
        type: "action",
        fact: "Dados insuficientes para análise completa",
        impact: "Aguarde consolidação do período selecionado",
        action: "Verifique os filtros aplicados ou selecione outro período",
        priority: "low",
      });
      return result;
    }

    // Produção não faturada
    if (hasProductionData) {
      const producaoNaoFaturada = kpis.produzido - kpis.faturado;
      if (producaoNaoFaturada > 1000 && kpis.taxaFaturamento < 90) {
        result.push({
          id: "prod-nao-fat",
          type: "opportunity",
          fact: `Produção sem faturamento: ${formatCurrency(producaoNaoFaturada)}`,
          impact: `Taxa de conversão em ${kpis.taxaFaturamento.toFixed(0)}%`,
          action: "Priorizar emissão para melhorar fluxo",
          priority: producaoNaoFaturada > 50000 ? "high" : "medium",
        });
      }
    }

    // Taxa de recebimento baixa
    if (hasBillingData && kpis.taxaRecebimento < 70 && kpis.faturado > 0) {
      result.push({
        id: "taxa-receb-baixa",
        type: "risk",
        fact: `Taxa de recebimento em ${kpis.taxaRecebimento.toFixed(0)}%`,
        impact: `${formatCurrency(kpis.emAberto)} em aberto`,
        action: "Intensificar cobrança dos títulos pendentes",
        priority: kpis.taxaRecebimento < 50 ? "high" : "medium",
      });
    }

    // Glosa elevada
    if (hasBillingData) {
      const glossaPercentual = kpis.faturado > 0 ? (kpis.glosado / kpis.faturado) * 100 : 0;
      if (glossaPercentual > 5 && kpis.glosado > 0) {
        result.push({
          id: "glosa-elevada",
          type: "risk",
          fact: `Glosa em ${glossaPercentual.toFixed(1)}% do faturado`,
          impact: `Perda de ${formatCurrency(kpis.glosado)}`,
          action: "Revisar processos de autorização e documentação",
          priority: glossaPercentual > 10 ? "high" : "medium",
        });
      }
    }

    // Aging crítico
    if (agingCritical > 0) {
      result.push({
        id: "aging-critico",
        type: "risk",
        fact: `Valores críticos (>60d): ${formatCurrency(agingCritical)}`,
        impact: "Risco elevado de inadimplência",
        action: "Priorizar cobrança imediata",
        priority: "high",
      });
    }

    // Saldo negativo
    if (hasCashData && kpis.saldoFinal < 0) {
      result.push({
        id: "saldo-negativo",
        type: "risk",
        fact: `Saldo de caixa negativo: ${formatCurrency(kpis.saldoFinal)}`,
        impact: "Risco operacional imediato",
        action: "Avaliar antecipação de recebíveis ou renegociação",
        priority: "high",
      });
    }

    // Boa performance
    if (hasBillingData && hasProductionData && kpis.taxaRecebimento >= 85 && kpis.taxaFaturamento >= 95) {
      result.push({
        id: "boa-performance",
        type: "success",
        fact: "Conversão excelente no período",
        impact: `Recebimento em ${kpis.taxaRecebimento.toFixed(0)}%`,
        action: "Manter práticas atuais",
        priority: "low",
      });
    }

    // Resultado positivo
    if (hasCashData && kpis.entradas > kpis.saidas && kpis.saldoFinal > 0) {
      result.push({
        id: "resultado-positivo",
        type: "success",
        fact: `Resultado líquido: ${formatCurrency(kpis.entradas - kpis.saidas)}`,
        impact: "Fluxo de caixa saudável",
        action: "Avaliar oportunidades de investimento",
        priority: "low",
      });
    }

    // Sem alertas relevantes
    if (result.length === 0) {
      result.push({
        id: "sem-alertas",
        type: "success",
        fact: "Nenhum risco relevante identificado",
        impact: "Operação dentro dos parâmetros",
        action: "Continuar monitoramento",
        priority: "low",
      });
    }

    return result.slice(0, 6);
  }, [kpis, agingCritical]);

  const getIcon = (type: BIInsight["type"]) => {
    switch (type) {
      case "opportunity": return TrendingUp;
      case "risk": return AlertTriangle;
      case "success": return CheckCircle;
      case "action": return Lightbulb;
    }
  };

  const getColors = (type: BIInsight["type"]) => {
    switch (type) {
      case "opportunity": return "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900";
      case "risk": return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900";
      case "success": return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900";
      case "action": return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900";
    }
  };

  const getIconColors = (type: BIInsight["type"]) => {
    switch (type) {
      case "opportunity": return "text-blue-600 dark:text-blue-400";
      case "risk": return "text-red-600 dark:text-red-400";
      case "success": return "text-green-600 dark:text-green-400";
      case "action": return "text-amber-600 dark:text-amber-400";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights e Próximas Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight) => {
          const Icon = getIcon(insight.type);
          return (
            <div
              key={insight.id}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                getColors(insight.type)
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", getIconColors(insight.type))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{insight.fact}</p>
                    {insight.priority === "high" && (
                      <Badge variant="destructive" className="text-[9px] h-4 px-1">
                        Alta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.impact}</p>
                  <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-primary">
                    <ArrowRight className="h-3 w-3" />
                    {insight.action}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
