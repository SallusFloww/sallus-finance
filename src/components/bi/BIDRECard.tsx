import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DREData } from "@/hooks/useDRE";
import { formatCurrency, formatPercentage } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BIDRECardProps {
  dreData: DREData;
}

export function BIDRECard({ dreData }: BIDRECardProps) {
  const items = [
    { 
      label: "Receita Operacional", 
      value: dreData.receitaBrutaOperacional, 
      isPositive: true 
    },
    { 
      label: "Custos Diretos", 
      value: -dreData.custosOperacionaisDiretos, 
      isPositive: false 
    },
    { 
      label: "Resultado Assistencial", 
      value: dreData.resultadoOperacionalAssistencial, 
      isHighlight: true,
      margin: dreData.margemOperacionalAssistencial
    },
    { 
      label: "Custos Compartilhados", 
      value: -dreData.custosCompartilhados, 
      isPositive: false 
    },
    { 
      label: "Resultado Operacional", 
      value: dreData.resultadoOperacionalTotal, 
      isHighlight: true,
      margin: dreData.margemOperacionalTotal
    },
    { 
      label: "Resultado Gerencial", 
      value: dreData.resultadoGerencial, 
      isHighlight: true,
      isFinal: true,
      margin: dreData.margemGerencial
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">DRE Resumido</CardTitle>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary">
            Caixa
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {items.map((item, index) => (
          <div 
            key={item.label}
            className={cn(
              "flex items-center justify-between py-1.5 px-2 rounded-md",
              item.isHighlight && "bg-muted/50",
              item.isFinal && "bg-primary/10 border border-primary/20"
            )}
          >
            <span className={cn(
              "text-xs",
              item.isHighlight ? "font-medium" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium",
                item.value >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(Math.abs(item.value))}
              </span>
              {item.margin !== undefined && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] h-4 px-1",
                    item.margin >= 20 ? "border-success/30 text-success" :
                    item.margin >= 10 ? "border-warning/30 text-warning" :
                    "border-destructive/30 text-destructive"
                  )}
                >
                  {item.margin.toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
