import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, AlertTriangle, TrendingDown, ArrowUp, ArrowDown, Minus, BarChart3 } from "lucide-react";
import { Transaction, SpecialtyConfig } from "@/types";
import { format, startOfMonth, endOfMonth, parseISO, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isRealized } from "@/utils/statusHelpers";
interface SpecialtyRankingProps {
  transactions: Transaction[];
  specialties: SpecialtyConfig[];
}

interface SpecialtyScore {
  id: string;
  name: string;
  score: number;
  status: "healthy" | "attention" | "critical";
  trend: "improving" | "stable" | "declining";
  regularityScore: number;
  concentrationScore: number;
  recurrenceScore: number;
  trendScore: number;
  daysActive: number;
  transactionCount: number;
}

export function SpecialtyRanking({ transactions, specialties }: SpecialtyRankingProps) {
  const rankingData = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const totalDays = currentMonthEnd.getDate();

    // Filter only Centro Clínico transactions (apenas REALIZADOS; cancelados nunca entram)
    const centroClinicoTransactions = transactions.filter(
      (t) => t.unit === "CENTRO_CLINICO" && isRealized(t.status)
    );

    // Calculate score for each active specialty
    const specialtyScores: SpecialtyScore[] = [];

    for (const specialty of specialties.filter(s => s.active)) {
      // Get current month transactions for this specialty
      const specTransactions = centroClinicoTransactions.filter(t => {
        const tDate = parseISO(t.date);
        return t.specialty === specialty.id && 
               tDate >= currentMonthStart && 
               tDate <= currentMonthEnd;
      });

      // Skip if no transactions
      if (specTransactions.length === 0) continue;

      // Calculate metrics
      const income = specTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const daysWithMovement = new Set(
        specTransactions.map(t => format(parseISO(t.date), "yyyy-MM-dd"))
      ).size;

      const recurrenceIndex = totalDays > 0 ? (daysWithMovement / totalDays) * 100 : 0;

      // Concentration
      const dailyIncomes: Record<string, number> = {};
      specTransactions
        .filter(t => t.type === "INCOME")
        .forEach(t => {
          const dayKey = format(parseISO(t.date), "yyyy-MM-dd");
          dailyIncomes[dayKey] = (dailyIncomes[dayKey] || 0) + t.amount;
        });

      const maxDayIncome = Math.max(0, ...Object.values(dailyIncomes));
      const concentrationPercentage = income > 0 ? (maxDayIncome / income) * 100 : 0;

      // Calculate score components (same as Monthly Score)
      let regularityScore = 0;
      if (daysWithMovement >= 15) regularityScore = 30;
      else if (daysWithMovement >= 10) regularityScore = 24;
      else if (daysWithMovement >= 5) regularityScore = 18;
      else if (daysWithMovement >= 3) regularityScore = 10;

      let recurrenceScore = 0;
      if (recurrenceIndex >= 40) recurrenceScore = 25;
      else if (recurrenceIndex >= 30) recurrenceScore = 20;
      else if (recurrenceIndex >= 20) recurrenceScore = 15;
      else if (recurrenceIndex >= 10) recurrenceScore = 5;

      let concentrationScore = 0;
      if (concentrationPercentage <= 25) concentrationScore = 25;
      else if (concentrationPercentage <= 40) concentrationScore = 18;
      else if (concentrationPercentage <= 60) concentrationScore = 10;
      else if (concentrationPercentage <= 80) concentrationScore = 5;

      // Historical trend for this specialty
      const monthsInterval = eachMonthOfInterval({
        start: subMonths(startOfMonth(now), 2),
        end: subMonths(startOfMonth(now), 1)
      });

      const historicalScores: number[] = [];
      for (const monthDate of monthsInterval) {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthTransactions = centroClinicoTransactions.filter(t => {
          const tDate = parseISO(t.date);
          return t.specialty === specialty.id && 
                 tDate >= monthStart && 
                 tDate <= monthEnd;
        });

        if (monthTransactions.length > 0) {
          const mDaysActive = new Set(
            monthTransactions.map(t => format(parseISO(t.date), "yyyy-MM-dd"))
          ).size;
          const mRecurrence = (mDaysActive / monthEnd.getDate()) * 100;
          const mRegularity = mDaysActive >= 15 ? 30 : mDaysActive >= 10 ? 24 : mDaysActive >= 5 ? 18 : mDaysActive >= 3 ? 10 : 0;
          const mRecurrenceScore = mRecurrence >= 40 ? 25 : mRecurrence >= 30 ? 20 : mRecurrence >= 20 ? 15 : mRecurrence >= 10 ? 5 : 0;
          historicalScores.push(mRegularity + mRecurrenceScore + 12 + 10); // Simplified concentration + trend
        }
      }

      let trendScore = 0;
      let trend: "improving" | "stable" | "declining" = "stable";
      
      if (historicalScores.length >= 2) {
        const lastScore = historicalScores[historicalScores.length - 1];
        const prevScore = historicalScores[historicalScores.length - 2];
        if (lastScore > prevScore + 5) {
          trend = "improving";
          trendScore = 20;
        } else if (lastScore < prevScore - 5) {
          trend = "declining";
          trendScore = 7;
        } else {
          trendScore = 14;
        }
      } else if (historicalScores.length === 1) {
        trendScore = 10;
      }

      const totalScore = Math.round(regularityScore + recurrenceScore + concentrationScore + trendScore);

      let status: "healthy" | "attention" | "critical";
      if (totalScore >= 70) status = "healthy";
      else if (totalScore >= 55) status = "attention";
      else status = "critical";

      specialtyScores.push({
        id: specialty.id,
        name: specialty.name,
        score: totalScore,
        status,
        trend,
        regularityScore,
        concentrationScore,
        recurrenceScore,
        trendScore,
        daysActive: daysWithMovement,
        transactionCount: specTransactions.length
      });
    }

    // Sort by score descending
    specialtyScores.sort((a, b) => b.score - a.score);

    // Identify highlights
    const best = specialtyScores[0] || null;
    const mostVulnerable = [...specialtyScores].sort((a, b) => a.score - b.score)[0] || null;
    const deteriorating = specialtyScores.find(s => s.trend === "declining") || null;

    return {
      rankings: specialtyScores,
      best,
      mostVulnerable: mostVulnerable && mostVulnerable !== best ? mostVulnerable : null,
      deteriorating: deteriorating && deteriorating !== best && deteriorating !== mostVulnerable ? deteriorating : null,
      currentMonth: format(now, "MMMM/yyyy", { locale: ptBR })
    };
  }, [transactions, specialties]);

  const getStatusBadge = (status: "healthy" | "attention" | "critical") => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">🟢 Saudável</Badge>;
      case "attention":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">🟡 Atenção</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">🔴 Crítico</Badge>;
    }
  };

  const getTrendIcon = (trend: "improving" | "stable" | "declining") => {
    switch (trend) {
      case "improving":
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case "declining":
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (rankingData.rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Ranking Comparativo de Especialidades
              </CardTitle>
              <CardDescription>Centro Clínico — {rankingData.currentMonth}</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Visão Comparativa Analítica</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma especialidade com movimentação no período atual.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ranking Comparativo de Especialidades
            </CardTitle>
            <CardDescription>
              Centro Clínico — {rankingData.currentMonth} • Ordenado por Score (previsibilidade, não faturamento)
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Visão Comparativa Analítica</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Highlights */}
        <div className="flex flex-wrap gap-2 pb-2">
          {rankingData.best && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <Trophy className="h-3.5 w-3.5 text-yellow-600" />
              <span className="text-xs">Melhor: {rankingData.best.name}</span>
            </Badge>
          )}
          {rankingData.mostVulnerable && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
              <span className="text-xs">Mais vulnerável: {rankingData.mostVulnerable.name}</span>
            </Badge>
          )}
          {rankingData.deteriorating && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              <span className="text-xs">Em deterioração: {rankingData.deteriorating.name}</span>
            </Badge>
          )}
        </div>

        {/* Ranking Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Faixa</TableHead>
                <TableHead className="text-center">Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingData.rankings.map((specialty, index) => (
                <TableRow key={specialty.id}>
                  <TableCell className="text-center font-medium">
                    {index + 1}
                    {index === 0 && <span className="ml-1">🏆</span>}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{specialty.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({specialty.daysActive} dias ativos)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${
                      specialty.score >= 70 ? "text-green-600" :
                      specialty.score >= 55 ? "text-yellow-600" :
                      "text-red-600"
                    }`}>
                      {specialty.score}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(specialty.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(specialty.trend)}
                      <span className="text-xs text-muted-foreground">
                        {specialty.trend === "improving" ? "↑" : specialty.trend === "declining" ? "↓" : "→"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Score baseado em Regularidade, Concentração, Recorrência e Tendência Histórica — não considera faturamento bruto.
        </p>
      </CardContent>
    </Card>
  );
}
