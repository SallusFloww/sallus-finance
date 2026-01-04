import { ReactNode } from "react";
import { LucideIcon, Inbox, FileX, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "secondary" | "outline";
  };
  className?: string;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
  size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-6",
    md: "py-10",
    lg: "py-16",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/60 bg-muted/20",
        sizeClasses[size],
        className
      )}
    >
      <div className="rounded-full bg-muted/50 p-3 mb-3">
        <Icon className={cn("text-muted-foreground/50", iconSizes[size])} />
      </div>
      <h3 className={cn("font-medium text-foreground", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p className={cn("text-muted-foreground mt-1 max-w-sm", size === "sm" ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || "default"}
          size={size === "sm" ? "sm" : "default"}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

// Variantes pré-definidas para casos comuns
export function NoDataState({
  title = "Nenhum dado encontrado",
  description = "Não há registros para exibir no momento.",
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Inbox} title={title} description={description} {...props} />;
}

export function NoSearchResultsState({
  title = "Nenhum resultado",
  description = "Tente ajustar os filtros ou termos de busca.",
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Search} title={title} description={description} {...props} />;
}

export function ErrorState({
  title = "Erro ao carregar",
  description = "Ocorreu um problema. Tente novamente.",
  action,
  ...props
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={action || { label: "Tentar novamente", onClick: () => window.location.reload() }}
      {...props}
    />
  );
}

export function NoFileState({
  title = "Nenhum arquivo",
  description = "Selecione ou arraste um arquivo para começar.",
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={FileX} title={title} description={description} {...props} />;
}
