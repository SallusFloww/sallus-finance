import { X, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBIFilters, ActiveFilter } from "@/contexts/BIFilterContext";
import { cn } from "@/lib/utils";

export function BIActiveFiltersBar() {
  const { activeFilters, clearFilter, clearAllFilters } = useBIFilters();

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="h-3 w-3" />
        <span>Filtros ativos:</span>
      </div>
      
      <div className="flex flex-wrap items-center gap-1.5">
        {activeFilters.map((filter) => (
          <FilterChip
            key={filter.key}
            filter={filter}
            onRemove={() => clearFilter(filter.key)}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={clearAllFilters}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Limpar tudo
      </Button>
    </div>
  );
}

interface FilterChipProps {
  filter: ActiveFilter;
  onRemove: () => void;
}

function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-6 px-2 gap-1 text-xs font-normal cursor-pointer",
        "hover:bg-destructive/10 hover:text-destructive transition-colors"
      )}
    >
      <span className="text-muted-foreground">{filter.label}:</span>
      <span className="font-medium">{filter.displayValue}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
