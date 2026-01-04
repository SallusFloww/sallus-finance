import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
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
import { BIFilters } from "@/hooks/useBIData";
import { Settings } from "@/types";

interface BIFiltersProps {
  filters: BIFilters;
  onFiltersChange: (filters: BIFilters) => void;
  settings: Settings;
}

export function BIFiltersBar({ filters, onFiltersChange, settings }: BIFiltersProps) {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: filters.startDate,
    to: filters.endDate,
  });

  const handlePeriodChange = (period: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfMonth(now);

    switch (period) {
      case "current":
        start = startOfMonth(now);
        break;
      case "3m":
        start = startOfMonth(subMonths(now, 2));
        break;
      case "6m":
        start = startOfMonth(subMonths(now, 5));
        break;
      case "12m":
        start = startOfMonth(subMonths(now, 11));
        break;
      default:
        start = startOfMonth(now);
    }

    setDateRange({ from: start, to: end });
    onFiltersChange({
      ...filters,
      startDate: start,
      endDate: end,
      period: period as BIFilters["period"],
    });
  };

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      setDateRange({ from: range.from, to: range.to });
      onFiltersChange({
        ...filters,
        startDate: range.from,
        endDate: range.to,
        period: undefined,
      });
    }
  };

  const handleUnitChange = (value: string) => {
    onFiltersChange({
      ...filters,
      unit: value,
    });
  };

  const handlePayerChange = (value: string) => {
    onFiltersChange({
      ...filters,
      payerType: value as BIFilters["payerType"],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-lg shadow-sm">
      {/* Período Rápido */}
      <div className="flex items-center gap-1">
        <Button
          variant={filters.period === "current" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePeriodChange("current")}
        >
          Mês Atual
        </Button>
        <Button
          variant={filters.period === "3m" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePeriodChange("3m")}
        >
          3 meses
        </Button>
        <Button
          variant={filters.period === "6m" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePeriodChange("6m")}
        >
          6 meses
        </Button>
      </div>

      {/* Seletor de Data */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal min-w-[200px]",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                  {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, "dd/MM/yy", { locale: ptBR })
              )
            ) : (
              <span>Selecione o período</span>
            )}
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
          />
        </PopoverContent>
      </Popover>

      {/* Unidade */}
      <Select value={filters.unit || "all"} onValueChange={handleUnitChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Unidades</SelectItem>
          {settings.units
            .filter((u) => u.active)
            .map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Pagador */}
      <Select value={filters.payerType || "all"} onValueChange={handlePayerChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Pagador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="PARTICULAR">Particular</SelectItem>
          <SelectItem value="CONVENIO">Convênio</SelectItem>
          <SelectItem value="SUS">SUS</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
