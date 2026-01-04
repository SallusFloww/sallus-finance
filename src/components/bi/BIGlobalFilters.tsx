import { useState } from "react";
import { CalendarIcon, Eye, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBIFilters, PeriodPreset } from "@/contexts/BIFilterContext";
import { Settings } from "@/types";

interface BIGlobalFiltersProps {
  settings: Settings;
  uniquePayers: string[];
  uniqueCategories: string[];
}

export function BIGlobalFilters({ settings, uniquePayers, uniqueCategories }: BIGlobalFiltersProps) {
  const {
    filters,
    setPeriodPreset,
    setCustomDateRange,
    setFilter,
    lastUpdated,
    clearAllFilters,
  } = useBIFilters();

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: filters.startDate,
    to: filters.endDate,
  });

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      setDateRange({ from: range.from, to: range.to });
      setCustomDateRange(range.from, range.to);
    }
  };

  const periodButtons: { preset: PeriodPreset; label: string }[] = [
    { preset: "current", label: "Mês Atual" },
    { preset: "3m", label: "3 meses" },
    { preset: "6m", label: "6 meses" },
    { preset: "12m", label: "12 meses" },
  ];

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
            <Eye className="h-3 w-3 mr-1" />
            Read-only
          </Badge>
          <span className="text-xs text-muted-foreground">
            Dados consolidados até: {format(lastUpdated, "dd/MM HH:mm")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={clearAllFilters}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Resetar
        </Button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        {/* Period Presets */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          {periodButtons.map(({ preset, label }) => (
            <Button
              key={preset}
              variant={filters.periodPreset === preset ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setPeriodPreset(preset)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 justify-start text-left font-normal min-w-[200px]",
                filters.periodPreset === "custom" && "border-primary"
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              <span className="text-xs">
                {format(filters.startDate, "dd/MM/yy", { locale: ptBR })} -{" "}
                {format(filters.endDate, "dd/MM/yy", { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => handleDateRangeChange(range || {})}
              numberOfMonths={2}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Unit Filter */}
        <Select value={filters.unit} onValueChange={(v) => setFilter("unit", v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Unidades</SelectItem>
            {settings.units
              .filter((u) => u.active)
              .map((unit) => (
                <SelectItem key={unit.id} value={unit.name}>
                  {unit.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Payer Filter */}
        <Select value={filters.payer} onValueChange={(v) => setFilter("payer", v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Pagador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Pagadores</SelectItem>
            {uniquePayers.map((payer) => (
              <SelectItem key={payer} value={payer}>
                {payer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select value={filters.category} onValueChange={(v) => setFilter("category", v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {uniqueCategories.slice(0, 20).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Aging Filter */}
        <Select value={filters.agingRange} onValueChange={(v) => setFilter("agingRange", v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Aging" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Faixas</SelectItem>
            <SelectItem value="0-30">0-30 dias</SelectItem>
            <SelectItem value="31-60">31-60 dias</SelectItem>
            <SelectItem value="61-90">61-90 dias</SelectItem>
            <SelectItem value="90+">90+ dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
