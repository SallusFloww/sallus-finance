import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatUnitDisplayName, formatConvenioDisplayName } from "@/utils/formatters";
import type { ConciliationFilters as FiltersType, ConciliationStatus } from "@/hooks/useConciliation";

interface ConciliationFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  availableUnits: string[];
  availableSources: string[];
}

const STATUS_OPTIONS: { value: ConciliationStatus; label: string }[] = [
  { value: "CONCILIADO", label: "Conciliado" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "EM_ABERTO", label: "Em Aberto" },
  { value: "GLOSADO", label: "Glosado" },
  { value: "DIVERGENTE", label: "Divergente" },
  { value: "SEM_VINCULO", label: "Sem Vínculo" },
  { value: "EM_ANALISE", label: "Em Análise" },
];

export function ConciliationFilters({ 
  filters, 
  onFiltersChange, 
  availableUnits, 
  availableSources 
}: ConciliationFiltersProps) {
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = 
    filters.startDate || 
    filters.endDate || 
    filters.unitKey || 
    filters.source || 
    filters.status ||
    filters.search;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Start Date */}
        <div className="space-y-2">
          <Label className="text-xs">Data Início</Label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? (
                  format(filters.startDate, "dd/MM/yyyy")
                ) : (
                  <span>Selecionar</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => {
                  // If endDate exists and new startDate > endDate, adjust endDate
                  if (date && filters.endDate && date > filters.endDate) {
                    onFiltersChange({ ...filters, startDate: date, endDate: date });
                  } else {
                    onFiltersChange({ ...filters, startDate: date });
                  }
                  setStartDateOpen(false);
                }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <Label className="text-xs">Data Fim</Label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? (
                  format(filters.endDate, "dd/MM/yyyy")
                ) : (
                  <span>Selecionar</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => {
                  // If startDate exists and new endDate < startDate, adjust startDate
                  if (date && filters.startDate && date < filters.startDate) {
                    onFiltersChange({ ...filters, startDate: date, endDate: date });
                  } else {
                    onFiltersChange({ ...filters, endDate: date });
                  }
                  setEndDateOpen(false);
                }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Unit */}
        <div className="space-y-2">
          <Label className="text-xs">Unidade</Label>
          <Select
            value={filters.unitKey || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              unitKey: value === "all" ? undefined : value 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {availableUnits.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {formatUnitDisplayName(unit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source/Convenio */}
        <div className="space-y-2">
          <Label className="text-xs">Convênio</Label>
          <Select
            value={filters.source || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              source: value === "all" ? undefined : value 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {availableSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {formatConvenioDisplayName(source)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs">Status</Label>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              status: value === "all" ? undefined : value as ConciliationStatus 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label className="text-xs">Busca</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Paciente/guia/valor..."
              value={filters.search || ""}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
