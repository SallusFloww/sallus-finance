// ============================================
// BI STATES - ESTADOS PADRONIZADOS
// Release freeze: only bugfixes allowed
// 
// Estados unificados para loading, empty e error
// Proibido: tela em branco, NaN, undefined, null na UI
// ============================================

import { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// LOADING STATES
// ============================================

interface BILoadingProps {
  message?: string;
  className?: string;
}

/**
 * Loading padrão para blocos do BI
 */
export function BILoadingState({ message = "Carregando dados...", className }: BILoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-8 gap-3", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Skeleton para KPI cards
 */
export function BIKPISkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton para gráficos
 */
export function BIChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="h-[200px] flex items-end gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="flex-1" 
              style={{ height: `${30 + Math.random() * 70}%` }} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para Score Hero
 */
export function BIScoreSkeleton() {
  return (
    <Card className="border-2 border-border">
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EMPTY STATES
// ============================================

interface BIEmptyProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Empty state padrão para blocos do BI
 */
export function BIEmptyState({
  title = "Nenhum dado disponível",
  description = "Não há dados para exibir no período selecionado.",
  action,
  className,
  size = "md",
}: BIEmptyProps) {
  const sizeClasses = {
    sm: "py-4",
    md: "py-8",
    lg: "py-12",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/60 bg-muted/10",
        sizeClasses[size],
        className
      )}
    >
      <div className="rounded-full bg-muted/30 p-3 mb-3">
        <Inbox className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Empty state específico para gráficos
 */
export function BIChartEmpty({ title = "Sem dados para o gráfico" }: { title?: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center">
      <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70">Ajuste os filtros ou aguarde novos dados</p>
    </div>
  );
}

// ============================================
// ERROR STATES
// ============================================

interface BIErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state padrão para blocos do BI
 */
export function BIErrorState({
  title = "Erro ao carregar dados",
  description = "Ocorreu um problema ao processar as informações.",
  onRetry,
  className,
}: BIErrorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4 rounded-lg border border-dashed border-destructive/30 bg-destructive/5",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3 mb-3">
        <AlertCircle className="h-8 w-8 text-destructive/70" />
      </div>
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

// ============================================
// DATA VALIDATION WRAPPER
// ============================================

interface BIDataWrapperProps {
  isLoading?: boolean;
  hasError?: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
  loadingComponent?: ReactNode;
  className?: string;
}

/**
 * Wrapper que gerencia estados de loading/empty/error
 * Garante que nunca exibirá tela em branco
 */
export function BIDataWrapper({
  isLoading = false,
  hasError = false,
  isEmpty = false,
  errorMessage,
  emptyMessage,
  onRetry,
  children,
  loadingComponent,
  className,
}: BIDataWrapperProps) {
  if (isLoading) {
    return <div className={className}>{loadingComponent || <BILoadingState />}</div>;
  }

  if (hasError) {
    return (
      <div className={className}>
        <BIErrorState 
          description={errorMessage} 
          onRetry={onRetry || (() => window.location.reload())} 
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <BIEmptyState description={emptyMessage} />
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================
// VALUE DISPLAY HELPERS
// ============================================

/**
 * Exibe valor ou placeholder seguro
 * Nunca retorna NaN, undefined, null ou string vazia
 */
export function SafeValue({
  value,
  formatter,
  fallback = "—",
  showConsolidation = false,
}: {
  value: number | null | undefined;
  formatter?: (v: number) => string;
  fallback?: string;
  showConsolidation?: boolean;
}) {
  // Validação rigorosa
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">{showConsolidation ? "Em consolidação" : fallback}</span>;
  }
  
  if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
    return <span className="text-muted-foreground">{showConsolidation ? "Em consolidação" : fallback}</span>;
  }

  const formatted = formatter ? formatter(value) : String(value);
  return <>{formatted}</>;
}
