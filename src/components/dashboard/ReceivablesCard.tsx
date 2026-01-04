import { FileText, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReceivablesDB } from "@/hooks/useReceivablesDB";
import { formatCurrency } from "@/utils/formatters";
import { useNavigate } from "react-router-dom";

export function ReceivablesCard() {
  const navigate = useNavigate();
  const { getStats, openReceivables } = useReceivablesDB();
  
  const stats = getStats();
  
  if (!openReceivables || openReceivables.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-500" />
          Faturamento a Receber
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(stats.totalOpen)}
            </p>
            <p className="text-xs text-muted-foreground">
              {openReceivables.length} faturamento(s) em aberto
            </p>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Prazo médio: <span className="font-medium text-foreground">{stats.averageReceiptDays} dias</span>
            </span>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-2">
              Valores faturados e ainda não recebidos. <strong>Não compõem o saldo de caixa.</strong>
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              onClick={() => navigate("/receivables")}
            >
              Ver detalhes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
