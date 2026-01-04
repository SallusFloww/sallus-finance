import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlobalScoreData } from "@/hooks/useWeightedScore";
import { cn } from "@/lib/utils";

interface BIScoreCardProps {
  scoreData: GlobalScoreData;
}

export function BIScoreCard({ scoreData }: BIScoreCardProps) {
  const statusColors = {
    excellent: "text-success bg-success/10 border-success/30",
    healthy: "text-primary bg-primary/10 border-primary/30",
    attention: "text-warning bg-warning/10 border-warning/30",
    risk: "text-orange-500 bg-orange-500/10 border-orange-500/30",
    critical: "text-destructive bg-destructive/10 border-destructive/30",
    ineligible: "text-muted-foreground bg-muted border-border",
  };

  const progressColors = {
    excellent: "bg-success",
    healthy: "bg-primary",
    attention: "bg-warning",
    risk: "bg-orange-500",
    critical: "bg-destructive",
    ineligible: "bg-muted-foreground",
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Score Financeiro
          </CardTitle>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-secondary/30 text-secondary">
            Competência
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-6">
          {/* Score Principal */}
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "relative w-24 h-24 rounded-full border-4 flex items-center justify-center",
              statusColors[scoreData.globalStatus]
            )}>
              <span className="text-3xl font-bold">{scoreData.globalScore}</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn("text-xs", statusColors[scoreData.globalStatus])}
            >
              {scoreData.globalLabel}
            </Badge>
          </div>

          {/* Breakdown */}
          <div className="flex-1 space-y-3">
            {scoreData.unitScores.slice(0, 4).map((unit) => (
              <div key={unit.unitId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[100px]">{unit.unitName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{unit.score}</span>
                    {unit.components.trend > 14 ? (
                      <TrendingUp className="h-3 w-3 text-success" />
                    ) : unit.components.trend < 7 ? (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <Progress 
                  value={unit.score} 
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <p className="mt-4 text-xs text-muted-foreground line-clamp-2">
          {scoreData.explanation}
        </p>
      </CardContent>
    </Card>
  );
}
