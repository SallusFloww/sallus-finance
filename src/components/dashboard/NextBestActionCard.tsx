import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Target, 
  TrendingUp, 
  Shield,
  AlertTriangle,
  Flame,
  Info,
  ArrowRight,
  Star,
  Layers,
  Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NextBestAction, NextBestActionsData, ConsolidatedAction, PMACategory } from "@/hooks/useNextBestAction";

interface NextBestActionCardProps {
  action: NextBestAction | ConsolidatedAction;
  showUnitName?: boolean;
  compact?: boolean;
  category?: PMACategory;
}

export function NextBestActionCard({ action, showUnitName = false, compact = false, category }: NextBestActionCardProps) {
  const consolidatedAction = action as ConsolidatedAction;
  const displayCategory = category || consolidatedAction.category;
  
  const getImpactIcon = () => {
    switch (action.impactLevel) {
      case "high": return <Flame className="h-4 w-4 text-orange-500" />;
      case "medium": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "preventive": return <Shield className="h-4 w-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = () => {
    switch (displayCategory) {
      case "principal": return <Star className="h-3 w-3" />;
      case "complementar": return <Layers className="h-3 w-3" />;
      case "estrategica": return <Lightbulb className="h-3 w-3" />;
      default: return null;
    }
  };

  const getCategoryLabel = () => {
    switch (displayCategory) {
      case "principal": return "Ação Principal";
      case "complementar": return "Ação Complementar";
      case "estrategica": return "Ação Estratégica";
      default: return "Próxima Melhor Ação";
    }
  };

  const getCategoryStyle = () => {
    switch (displayCategory) {
      case "principal": return {
        border: "border-orange-400 dark:border-orange-600",
        bg: "from-orange-50 to-orange-25 dark:from-orange-950/40",
        badge: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200",
        iconBg: "bg-orange-100 dark:bg-orange-900/50"
      };
      case "complementar": return {
        border: "border-blue-300 dark:border-blue-600",
        bg: "from-blue-50 to-transparent dark:from-blue-950/30",
        badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200",
        iconBg: "bg-blue-100 dark:bg-blue-900/50"
      };
      case "estrategica": return {
        border: "border-purple-300 dark:border-purple-600",
        bg: "from-purple-50 to-transparent dark:from-purple-950/30",
        badge: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200",
        iconBg: "bg-purple-100 dark:bg-purple-900/50"
      };
      default: return {
        border: "border-muted",
        bg: "from-muted/20 to-transparent",
        badge: "bg-muted text-muted-foreground",
        iconBg: "bg-muted"
      };
    }
  };

  const style = getCategoryStyle();

  const getImpactBadgeClass = () => {
    switch (action.impactLevel) {
      case "high": return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200";
      case "preventive": return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200";
    }
  };

  const getProgressBarClass = () => {
    switch (displayCategory) {
      case "principal": return "[&>div]:bg-orange-500";
      case "complementar": return "[&>div]:bg-blue-500";
      case "estrategica": return "[&>div]:bg-purple-500";
      default: return "[&>div]:bg-primary";
    }
  };

  if (compact) {
    return (
      <div className={cn(
        "p-3 rounded-lg border-2 bg-gradient-to-r",
        style.bg,
        style.border
      )}>
        <div className="flex items-start gap-3">
          <div className={cn("p-1.5 rounded-full shrink-0", style.iconBg)}>
            {getImpactIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={cn("text-xs flex items-center gap-1", style.badge)}>
                {getCategoryIcon()}
                {getCategoryLabel()}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", getImpactBadgeClass())}>
                {action.impactLevelEmoji} {action.impactLevelLabel}
              </Badge>
              {consolidatedAction.consolidatedCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {consolidatedAction.consolidatedCount} unidades
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold mb-1">{action.title}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
            
            {action.progress && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{action.progress.label}</span>
                </div>
                <Progress 
                  value={action.progress.percentage} 
                  className={cn("h-1.5", getProgressBarClass())}
                />
              </div>
            )}
            
            {/* Score Impact - executive summary */}
            <div className="mt-2 pt-2 border-t border-dashed">
              <p className="text-xs">
                <span className="text-muted-foreground">Impacto: </span>
                <span className="font-medium">
                  {action.globalScoreImpact || action.unitScoreImpact}
                </span>
              </p>
              {(action as ConsolidatedAction).completionEffect && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-primary" />
                  {(action as ConsolidatedAction).completionEffect}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-4 rounded-lg border-2 bg-gradient-to-r",
      style.bg,
      style.border
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-full", style.iconBg)}>
            {getImpactIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className={cn("text-xs flex items-center gap-1", style.badge)}>
                {getCategoryIcon()}
                {getCategoryLabel()}
              </Badge>
              {consolidatedAction.consolidatedCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  Afeta {consolidatedAction.consolidatedCount} unidades
                </Badge>
              )}
            </div>
            <p className="font-bold">{action.title}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-xs font-medium", getImpactBadgeClass())}>
          {action.impactLevelEmoji} {action.impactLevelLabel}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">{action.description}</p>

      {/* Progress */}
      {action.progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso da ação</span>
            <span className="font-semibold">{action.progress.label}</span>
          </div>
          <Progress 
            value={action.progress.percentage} 
            className={cn("h-2", getProgressBarClass())}
          />
        </div>
      )}

      {/* Impact Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-2 rounded bg-white/50 dark:bg-black/20">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="h-3 w-3" />
            O que fazer
          </p>
          <p className="text-sm font-medium">{action.title}</p>
        </div>
        
        <div className={cn(
          "p-2 rounded",
          action.isUnlockAction 
            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" 
            : "bg-white/50 dark:bg-black/20"
        )}>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Por que fazer
          </p>
          <p className={cn(
            "text-sm font-medium",
            action.isUnlockAction && "text-green-700 dark:text-green-300"
          )}>
            {action.globalScoreImpact || action.unitScoreImpact}
          </p>
        </div>
      </div>

      {/* Criterion Badge */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Critério impactado:</span>
        <Badge variant="outline" className="text-xs">
          {action.criterionLabel}
        </Badge>
      </div>
    </div>
  );
}

// Summary component for global view - consolidated and deduplicated
interface NextBestActionsSummaryProps {
  data: NextBestActionsData;
}

export function NextBestActionsSummary({ data }: NextBestActionsSummaryProps) {
  if (data.consolidatedActions.length === 0) return null;

  const { consolidatedActions, principalAction } = data;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Próximas Melhores Ações</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {consolidatedActions.length} {consolidatedActions.length === 1 ? 'ação' : 'ações'} priorizadas
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ações consolidadas por causa raiz, priorizadas por impacto e urgência
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Principal Action Highlight */}
        {principalAction && (
          <div className={cn(
            "p-4 rounded-lg border-2",
            principalAction.impactLevel === "high" 
              ? "bg-gradient-to-r from-orange-50 to-orange-25 dark:from-orange-950/40 border-orange-400 dark:border-orange-600"
              : "bg-gradient-to-r from-primary/5 to-transparent border-primary/30"
          )}>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                  Ação Principal
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 text-xs">
                  🔥 Prioridade do mês
                </Badge>
                {principalAction.isUnlockAction && (
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                    🔓 Desbloqueia Score Global
                  </Badge>
                )}
              </div>
            </div>
            <p className="font-bold text-lg mb-1">{principalAction.title}</p>
            <p className="text-sm text-muted-foreground mb-3">{principalAction.description}</p>
            
            {principalAction.progress && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold">{principalAction.progress.label}</span>
                </div>
                <Progress value={principalAction.progress.percentage} className="h-2 [&>div]:bg-orange-500" />
              </div>
            )}
            
            <div className="flex items-center gap-4 text-xs mb-3">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Impacto:</span>
                <span className="font-medium">{principalAction.globalScoreImpact || principalAction.unitScoreImpact}</span>
              </span>
              {principalAction.consolidatedCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  Afeta {principalAction.consolidatedCount} unidades
                </Badge>
              )}
            </div>
            
            {/* Completion Effect CTA */}
            {principalAction.completionEffect && (
              <div className="p-2 rounded bg-white/70 dark:bg-black/20 border border-dashed border-orange-300 dark:border-orange-700">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-orange-500" />
                  <span className="font-medium text-foreground">{principalAction.completionEffect}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Secondary Actions (complementar + estrategica) */}
        {consolidatedActions.filter(a => a.category !== "principal").length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ações Secundárias
            </p>
            {consolidatedActions
              .filter(a => a.category !== "principal")
              .map(action => (
                <NextBestActionCard 
                  key={action.actionKey} 
                  action={action} 
                  showUnitName={true}
                  compact={true}
                  category={action.category}
                />
              ))}
          </div>
        )}

        {/* Governance Note */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Ações consolidadas por causa raiz. Quando múltiplas unidades têm o mesmo problema, exibimos uma única ação. 
              Atualização automática ao corrigir critérios ou virada de mês.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
