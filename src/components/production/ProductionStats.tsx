import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatters";
import { ProductionStats as ProductionStatsType } from "@/types";
import { 
  Activity, 
  FileText, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Hash
} from "lucide-react";

interface ProductionStatsProps {
  stats: ProductionStatsType;
}

export function ProductionStats({ stats }: ProductionStatsProps) {
  return (
    <div className="space-y-4">
      {/* Cards principais - FOCO QUANTITATIVO */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Produzido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-violet-600">{stats.totalQuantityProduced}</p>
            <p className="text-xs text-muted-foreground mt-1">exames/procedimentos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Faturado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {stats.billingRate.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalQuantityBilled} de {stats.totalQuantityProduced} produzidos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              {stats.conversionRate.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalQuantityReceived} convertidos em caixa
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{stats.totalQuantityOpen}</p>
            <p className="text-xs text-muted-foreground mt-1">aguardando faturamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Funil de conversão visual - QUANTITATIVO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Funil de Conversão: Produção → Caixa (Quantidade)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Produzido */}
            <div className="flex-1 min-w-[100px] text-center p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-muted-foreground">Produzido</p>
              <p className="text-2xl font-bold text-violet-600">{stats.totalQuantityProduced}</p>
              <p className="text-xs text-muted-foreground">100%</p>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

            {/* Faturado */}
            <div className="flex-1 min-w-[100px] text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-muted-foreground">Faturado</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalQuantityBilled}</p>
              <p className="text-xs text-muted-foreground">{stats.billingRate.toFixed(0)}%</p>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

            {/* Recebido */}
            <div className="flex-1 min-w-[100px] text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.totalQuantityReceived}</p>
              <p className="text-xs text-muted-foreground">{stats.conversionRate.toFixed(0)}%</p>
            </div>

            {/* Perdas */}
            {stats.totalQuantityGlossed > 0 && (
              <>
                <div className="w-px h-12 bg-border mx-2" />
                <div className="min-w-[80px] text-center p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <p className="text-xs text-muted-foreground">Glosa</p>
                  <p className="text-2xl font-bold text-rose-600">{stats.totalQuantityGlossed}</p>
                  <p className="text-xs text-muted-foreground">{stats.glossRate.toFixed(0)}%</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por tipo - QUANTIDADE */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Por Tipo de Produção (Qtde)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byProductionType)
                .filter(([_, data]) => data.quantity > 0)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{getProductionTypeLabel(type)}</span>
                    <div className="text-right">
                      <span className="font-bold text-violet-600">{data.quantity}</span>
                      <span className="text-xs text-muted-foreground ml-2">({data.count} reg.)</span>
                    </div>
                  </div>
                ))}
              {Object.values(stats.byProductionType).every(d => d.quantity === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma produção no período
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Por Pagador (Qtde)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Convênios</span>
                <span className="font-bold text-violet-600">{stats.byPayerTypeQuantity.convenio}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ 
                    width: stats.totalQuantityProduced > 0 
                      ? `${(stats.byPayerTypeQuantity.convenio / stats.totalQuantityProduced) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">Particular</span>
                <span className="font-bold text-violet-600">{stats.byPayerTypeQuantity.particular}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ 
                    width: stats.totalQuantityProduced > 0 
                      ? `${(stats.byPayerTypeQuantity.particular / stats.totalQuantityProduced) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores financeiros de referência (secundário) */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valores Financeiros (Referência)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Valor Produzido</p>
              <p className="font-medium">{formatCurrency(stats.totalProduced)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Faturado</p>
              <p className="font-medium">{formatCurrency(stats.totalBilled)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Recebido</p>
              <p className="font-medium text-emerald-600">{formatCurrency(stats.totalReceived)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Glosado</p>
              <p className="font-medium text-rose-600">{formatCurrency(stats.totalGlossed)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getProductionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CONSULTA: "Consultas",
    EXAME: "Exames",
    BOX: "Box",
    ATENDIMENTO_URGENCIA: "Atend. Urgência",
    INTERNACAO: "Internações",
    CIRURGIA: "Cirurgias",
    SESSAO_TERAPEUTICA: "Sessões Terapêuticas",
    OUTRO: "Outros",
  };
  return labels[type] || type;
}
