import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  AlertTriangle,
  Target,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthData {
  score: number | null;
  isEligible: boolean;
  status: "excellent" | "healthy" | "attention" | "risk" | "critical" | "ineligible";
  daysActive: number;
  recurrence: number;
  concentration: number;
}

interface AnnualScoreboardProps {
  monthsData: MonthData[];
  currentYear: string;
}

export function AnnualScoreboard({ monthsData, currentYear }: AnnualScoreboardProps) {
  // Filtrar apenas meses válidos (elegíveis com score)
  const validMonths = monthsData.filter(m => m.isEligible && m.score !== null);
  const hasEnoughData = validMonths.length >= 3;

  // 1️⃣ SCORE MÉDIO ANUAL
  const averageScore = hasEnoughData 
    ? Math.round(validMonths.reduce((sum, m) => sum + (m.score || 0), 0) / validMonths.length)
    : null;

  const getScoreClassification = (score: number) => {
    if (score >= 85) return { label: "Excelente", emoji: "🟢", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/40", borderColor: "border-green-400" };
    if (score >= 70) return { label: "Saudável", emoji: "🟢", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/40", borderColor: "border-green-400" };
    if (score >= 55) return { label: "Atenção", emoji: "🟡", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-950/40", borderColor: "border-yellow-400" };
    if (score >= 40) return { label: "Risco", emoji: "🟠", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/40", borderColor: "border-orange-400" };
    return { label: "Crítico", emoji: "🔴", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/40", borderColor: "border-red-400" };
  };

  const classification = averageScore ? getScoreClassification(averageScore) : null;

  // 2️⃣ DISTRIBUIÇÃO ANUAL
  const healthyMonths = validMonths.filter(m => m.status === "excellent" || m.status === "healthy").length;
  const attentionMonths = validMonths.filter(m => m.status === "attention").length;
  const criticalMonths = validMonths.filter(m => m.status === "risk" || m.status === "critical").length;
  
  const totalValidMonths = validMonths.length;
  const healthyPct = totalValidMonths > 0 ? Math.round((healthyMonths / totalValidMonths) * 100) : 0;
  const attentionPct = totalValidMonths > 0 ? Math.round((attentionMonths / totalValidMonths) * 100) : 0;
  const criticalPct = totalValidMonths > 0 ? Math.round((criticalMonths / totalValidMonths) * 100) : 0;

  // 3️⃣ TENDÊNCIA MACRO
  const getMacroTrend = () => {
    if (validMonths.length < 2) return { label: "Dados insuficientes", icon: Minus, color: "text-muted-foreground", emoji: "➖" };
    
    const scores = validMonths.map(m => m.score || 0);
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.ceil(scores.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = avgSecond - avgFirst;
    
    if (diff > 5) return { label: "Evolução positiva", icon: TrendingUp, color: "text-green-600", emoji: "⬆️" };
    if (diff < -5) return { label: "Deterioração", icon: TrendingDown, color: "text-red-600", emoji: "⬇️" };
    return { label: "Estável", icon: Minus, color: "text-muted-foreground", emoji: "➖" };
  };

  const macroTrend = getMacroTrend();

  // 4️⃣ RISCO ESTRUTURAL DOMINANTE
  const getDominantRisk = () => {
    if (!hasEnoughData) return null;

    // Contar ocorrências de cada tipo de risco
    let lowRegularity = 0;
    let lowRecurrence = 0;
    let highConcentration = 0;

    validMonths.forEach(m => {
      if (m.daysActive < 5) lowRegularity++;
      if (m.recurrence < 20) lowRecurrence++;
      if (m.concentration > 60) highConcentration++;
    });

    const risks = [
      { name: "Regularidade", count: lowRegularity, emoji: "📅", description: "Baixa frequência de dias ativos" },
      { name: "Recorrência", count: lowRecurrence, emoji: "🔄", description: "Baixa previsibilidade operacional" },
      { name: "Concentração", count: highConcentration, emoji: "📊", description: "Dependência de poucos dias de faturamento" }
    ];

    const maxRisk = risks.reduce((max, r) => r.count > max.count ? r : max, risks[0]);
    
    if (maxRisk.count === 0) {
      return { name: "Nenhum risco estrutural dominante", emoji: "🟢", description: "Indicadores distribuídos de forma equilibrada" };
    }

    return maxRisk;
  };

  const dominantRisk = getDominantRisk();

  // 5️⃣ DECISÃO ESTRATÉGICA ANUAL
  const getStrategicDecision = () => {
    if (!hasEnoughData || !dominantRisk) return null;

    if (dominantRisk.name === "Regularidade") {
      return "Ampliar a distribuição de faturamento ao longo do mês, atingindo mínimo de 5 dias ativos mensais.";
    }
    if (dominantRisk.name === "Recorrência") {
      return "Estruturar fluxo operacional para garantir movimentação recorrente em pelo menos 20% dos dias.";
    }
    if (dominantRisk.name === "Concentração") {
      return "Diversificar fontes e momentos de receita para reduzir dependência de picos isolados.";
    }
    return "Manter monitoramento contínuo dos indicadores e consolidar práticas atuais.";
  };

  const strategicDecision = getStrategicDecision();

  if (!hasEnoughData) {
    return (
      <Card className="border-2 border-muted-foreground/30">
        <CardHeader className="pb-3 bg-muted/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Scoreboard Global Anual — Visão Conselho</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Análise anual: {currentYear}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              Visão anual em formação — dados insuficientes
            </p>
            <p className="text-sm text-muted-foreground mt-3 max-w-md">
              Este painel será ativado automaticamente após a consolidação de no mínimo 3 meses válidos de Score Mensal.
            </p>
            
            {/* Indicador de progresso */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border w-full max-w-xs">
              <p className="text-xs font-medium text-muted-foreground mb-2">Progresso de Maturidade</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold text-primary">{validMonths.length}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-2xl font-bold text-muted-foreground">3</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">meses válidos consolidados</p>
              
              {/* Barra de progresso visual */}
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min((validMonths.length / 3) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-2 shadow-lg",
      classification?.borderColor || "border-muted-foreground/30"
    )}>
      <CardHeader className={cn(
        "pb-3",
        classification?.bgColor || "bg-muted/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Scoreboard Global Anual — Visão Conselho</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Consolidado Anual
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Análise anual: {currentYear} ({validMonths.length} meses válidos)
        </p>
      </CardHeader>

      <CardContent className="pt-6">
        {/* 1️⃣ SCORE MÉDIO ANUAL */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className={cn(
            "flex h-28 w-28 items-center justify-center rounded-full border-4 mb-3 shadow-lg",
            classification?.borderColor,
            classification?.bgColor
          )}>
            <span className={cn("text-4xl font-black", classification?.color)}>
              {averageScore}
            </span>
          </div>
          <Badge className={cn(
            "text-base px-4 py-1.5 font-bold",
            classification?.color === "text-green-600" && "bg-green-500 text-white",
            classification?.color === "text-yellow-600" && "bg-yellow-500 text-white",
            classification?.color === "text-orange-600" && "bg-orange-500 text-white",
            classification?.color === "text-red-600" && "bg-red-500 text-white"
          )}>
            {classification?.emoji} {classification?.label}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            Score médio anual baseado em {validMonths.length} meses válidos
          </p>
        </div>

        <Separator className="my-4" />

        {/* 2️⃣ DISTRIBUIÇÃO ANUAL + 3️⃣ TENDÊNCIA MACRO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Distribuição */}
          <div className="p-4 rounded-lg bg-muted/30 border">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribuição Anual
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Saudáveis
                </span>
                <span className="font-bold text-green-600">{healthyMonths} ({healthyPct}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  Atenção
                </span>
                <span className="font-bold text-yellow-600">{attentionMonths} ({attentionPct}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Críticos
                </span>
                <span className="font-bold text-red-600">{criticalMonths} ({criticalPct}%)</span>
              </div>
            </div>
          </div>

          {/* Tendência Macro */}
          <div className="p-4 rounded-lg bg-muted/30 border">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <macroTrend.icon className={cn("h-4 w-4", macroTrend.color)} />
              Tendência Macro
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{macroTrend.emoji}</span>
              <span className={cn("text-lg font-bold", macroTrend.color)}>
                {macroTrend.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Comparação entre primeira e segunda metade do período analisado
            </p>
          </div>
        </div>

        <Separator className="my-4" />

        {/* 4️⃣ RISCO ESTRUTURAL DOMINANTE */}
        {dominantRisk && (
          <div className={cn(
            "p-4 rounded-lg mb-6",
            dominantRisk.name === "Nenhum risco estrutural dominante" 
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
              : "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
          )}>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risco Estrutural Dominante
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{dominantRisk.emoji}</span>
              <div>
                <span className={cn(
                  "text-lg font-bold",
                  dominantRisk.name === "Nenhum risco estrutural dominante" 
                    ? "text-green-700 dark:text-green-300"
                    : "text-orange-700 dark:text-orange-300"
                )}>
                  {dominantRisk.name}
                </span>
                <p className="text-xs text-muted-foreground">{dominantRisk.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* 5️⃣ DECISÃO ESTRATÉGICA ANUAL */}
        {strategicDecision && (
          <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-primary mb-2">Prioridade estratégica do ano:</p>
                <p className="text-base font-semibold leading-relaxed">
                  "{strategicDecision}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Governança */}
        <p className="text-[10px] text-muted-foreground text-center mt-6">
          Este Score é uma métrica gerencial consolidada. Não substitui relatórios contábeis ou demonstrações oficiais.
        </p>
      </CardContent>
    </Card>
  );
}
