import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/formatters";
import { ProductionStats as ProductionStatsType } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, FileText, CheckCircle, Clock, ArrowRight, Hash, UserRound } from "lucide-react";

interface ProductionStatsProps {
  stats: ProductionStatsType;
}

export function ProductionStats({ stats }: ProductionStatsProps) {
  // =========================
  // Médicos(as) (nome por ID)
  // =========================
  const { currentCompany, profile } = useAuth();
  const companyId = (currentCompany as any)?.id || (profile as any)?.company_id;

  const [doctorNameById, setDoctorNameById] = useState<Record<string, string>>({});

  const [doctorMetric, setDoctorMetric] = useState<"quantity" | "value">("quantity");

  useEffect(() => {
    const fetchDoctorNames = async () => {
      if (!companyId) {
        setDoctorNameById({});
        return;
      }

      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, company_id")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setDoctorNameById({});
        return;
      }

      const map: Record<string, string> = {};
      (data ?? []).forEach((d: any) => {
        if (d?.id && d?.name) map[String(d.id)] = String(d.name).trim();
      });

      setDoctorNameById(map);
    };

    fetchDoctorNames();
  }, [companyId]);

  const topDoctors = useMemo(() => {
    const byDoctor = ((stats as any)?.byDoctor ?? {}) as Record<string, any>;

    return Object.entries(byDoctor)
      .map(([doctorId, data]) => ({
        doctorId,
        name: doctorNameById[doctorId] || "Médico não encontrado",
        count: Number((data as any)?.count ?? 0),
        quantity: Number((data as any)?.quantity ?? 0),
        value: Number((data as any)?.value ?? 0),
      }))
      .sort((a, b) => {
        const aMetric = doctorMetric === "value" ? a.value : a.quantity;
        const bMetric = doctorMetric === "value" ? b.value : b.quantity;
        return bMetric - aMetric;
      })
      .slice(0, 7);
  }, [(stats as any)?.byDoctor, doctorNameById, doctorMetric]);

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
            <p className="text-3xl font-bold text-blue-600">{stats.billingRate.toFixed(0)}%</p>
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
            <p className="text-3xl font-bold text-emerald-600">{stats.conversionRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalQuantityReceived} convertidos em caixa</p>
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

      {/* Distribuição - QUANTIDADE */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              {Object.values(stats.byProductionType).every((d) => d.quantity === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma produção no período</p>
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
                    width:
                      stats.totalQuantityProduced > 0
                        ? `${(stats.byPayerTypeQuantity.convenio / stats.totalQuantityProduced) * 100}%`
                        : "0%",
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
                    width:
                      stats.totalQuantityProduced > 0
                        ? `${(stats.byPayerTypeQuantity.particular / stats.totalQuantityProduced) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                Por Médico(a)
              </CardTitle>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={doctorMetric === "quantity" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setDoctorMetric("quantity")}
                >
                  Qtde
                </Button>
                <Button
                  size="sm"
                  variant={doctorMetric === "value" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setDoctorMetric("value")}
                >
                  R$
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDoctors.length > 0 ? (
                topDoctors.map((d) => (
                  <div key={d.doctorId} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-muted-foreground truncate">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-5">
                        {doctorMetric === "value" ? formatCurrency(d.value) : d.quantity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">({d.count} reg.)</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma produção vinculada a médico no período
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores financeiros de referência (secundário) */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Valores Financeiros (Referência)</CardTitle>
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
    BOX_PS: "Box",
    ATENDIMENTO_URGENCIA: "Atend. Urgência",
    INTERNACAO: "Internações",
    CIRURGIA: "Cirurgias",
    SESSAO_TERAPEUTICA: "Sessões Terapêuticas",
    OUTRO: "Outros",
    MAT_MED: "Mat/Med",
  };
  return labels[type] || type;
}
