import { format } from "date-fns";
import { CalendarIcon, Filter, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Operadora } from "@/types";

interface UnitConfig {
  id: string;
  name: string;
  active: boolean;
}

interface CategoryConfig {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface ReportFiltersProps {
  dateRange: { start: Date; end: Date };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: Date; end: Date }>>;
  selectedUnit: string;
  setSelectedUnit: (v: string) => void;
  selectedType: string;
  setSelectedType: (v: string) => void;
  selectedReceiptType: string;
  setSelectedReceiptType: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedOperadora: string;
  setSelectedOperadora: (v: string) => void;
  directorMode: boolean;
  setDirectorMode: (v: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  activeUnits: UnitConfig[];
  incomeCategories: CategoryConfig[];
  operadoras: Array<{ id: string; name: string }>;
  appliedFiltersText: string;
}

export function ReportFilters({
  dateRange,
  setDateRange,
  selectedUnit,
  setSelectedUnit,
  selectedType,
  setSelectedType,
  selectedReceiptType,
  setSelectedReceiptType,
  selectedCategory,
  setSelectedCategory,
  selectedOperadora,
  setSelectedOperadora,
  directorMode,
  setDirectorMode,
  hasActiveFilters,
  clearFilters,
  activeUnits,
  incomeCategories,
  operadoras,
  appliedFiltersText,
}: ReportFiltersProps) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDirectorMode(!directorMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                directorMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Modo Diretor
            </button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Período Inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.start, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.start}
                  onSelect={(d) => d && setDateRange((prev) => ({ ...prev, start: d }))}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Período Final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.end, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.end}
                  onSelect={(d) => d && setDateRange((prev) => ({ ...prev, end: d }))}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Unidade</label>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {activeUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="INCOME">Entrada</SelectItem>
                <SelectItem value="EXPENSE">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo Recebimento</label>
            <Select value={selectedReceiptType} onValueChange={setSelectedReceiptType}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PARTICULAR">Particular</SelectItem>
                <SelectItem value="CONVENIO">Convênios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {incomeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedReceiptType === "CONVENIO" && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="space-y-2 max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">Operadora</label>
              <Select value={selectedOperadora} onValueChange={setSelectedOperadora}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {operadoras.map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <p className="text-sm text-foreground">
            <span className="font-medium">Relatório filtrado por:</span>{" "}
            <span className="text-muted-foreground">{appliedFiltersText}</span>
          </p>
        </div>
      )}
    </>
  );
}
