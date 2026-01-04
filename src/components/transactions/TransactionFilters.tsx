import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TransactionStatus, Specialty, ReceiptType, Operadora, FinancialCategory } from "@/types";
import { 
  STATUS_LABELS, 
  BUSINESS_UNITS,
  SPECIALTIES,
  RECEIPT_TYPES,
  OPERADORAS,
  FINANCIAL_CATEGORIES
} from "@/utils/constants";
import { Badge } from "@/components/ui/badge";

interface FiltersState {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  specialty?: Specialty;
  receiptType?: ReceiptType;
  operadora?: Operadora;
  status?: TransactionStatus;
  type?: "INCOME" | "EXPENSE";
  financialCategory?: FinancialCategory;
  search?: string;
}

interface TransactionFiltersProps {
  onFilterChange: (filters: FiltersState) => void;
}

export function TransactionFilters({ onFilterChange }: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FiltersState>({});
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    const newFilters = { ...filters, [key]: value };
    
    // Limpar campos dependentes
    if (key === "unit" && value !== "CENTRO_CLINICO") {
      newFilters.specialty = undefined;
    }
    if (key === "type" && value !== "INCOME") {
      newFilters.receiptType = undefined;
      newFilters.operadora = undefined;
    }
    if (key === "receiptType") {
      if (value !== "CONVENIO") {
        newFilters.operadora = undefined;
      }
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== ""
  );

  // Campos condicionais
  const showSpecialty = filters.unit === "CENTRO_CLINICO";
  const showReceiptType = filters.type === "INCOME";
  const showOperadora = filters.type === "INCOME" && filters.receiptType === "CONVENIO";

  // Get financial category badge color
  const getFinancialCategoryColor = (category: FinancialCategory) => {
    switch (category) {
      case "OPERACIONAL": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "COMPARTILHADO": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "NAO_OPERACIONAL": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoria, referência..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="pl-10"
          />
        </div>

        <Button
          variant={showFilters ? "secondary" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              !
            </span>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.financialCategory && (
            <Badge 
              variant="outline" 
              className={cn("gap-1", getFinancialCategoryColor(filters.financialCategory))}
            >
              {FINANCIAL_CATEGORIES.find(c => c.id === filters.financialCategory)?.icon}
              {FINANCIAL_CATEGORIES.find(c => c.id === filters.financialCategory)?.name}
              <X 
                className="h-3 w-3 cursor-pointer ml-1" 
                onClick={() => updateFilter("financialCategory", undefined)}
              />
            </Badge>
          )}
          {filters.type && (
            <Badge variant="outline" className="gap-1">
              {filters.type === "INCOME" ? "Entradas" : "Saídas"}
              <X 
                className="h-3 w-3 cursor-pointer ml-1" 
                onClick={() => updateFilter("type", undefined)}
              />
            </Badge>
          )}
          {filters.unit && (
            <Badge variant="outline" className="gap-1">
              {BUSINESS_UNITS.find(u => u.id === filters.unit)?.name}
              <X 
                className="h-3 w-3 cursor-pointer ml-1" 
                onClick={() => updateFilter("unit", undefined)}
              />
            </Badge>
          )}
        </div>
      )}

      {showFilters && (
        <div className="animate-slide-up space-y-4 rounded-xl border border-border bg-card p-4">
          {/* Linha 0: Classificação Financeira */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-primary">Classificação Financeira</label>
            <Select
              value={filters.financialCategory || "all"}
              onValueChange={(v) =>
                updateFilter("financialCategory", v === "all" ? undefined : (v as FinancialCategory))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classificações</SelectItem>
                {FINANCIAL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 1: Datas e Tipo */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(d) => updateFilter("startDate", d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(d) => updateFilter("endDate", d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select
                value={filters.type || "all"}
                onValueChange={(v) =>
                  updateFilter("type", v === "all" ? undefined : (v as "INCOME" | "EXPENSE"))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INCOME">Entradas</SelectItem>
                  <SelectItem value="EXPENSE">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) =>
                  updateFilter("status", v === "all" ? undefined : (v as TransactionStatus))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Hierarquia de Negócio */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-primary">Unidade de Negócio</label>
              <Select
                value={filters.unit || "all"}
                onValueChange={(v) => updateFilter("unit", v === "all" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {BUSINESS_UNITS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showSpecialty && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-xs font-medium text-primary">Especialidade</label>
                <Select
                  value={filters.specialty || "all"}
                  onValueChange={(v) => updateFilter("specialty", v === "all" ? undefined : (v as Specialty))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showReceiptType && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-xs font-medium text-primary">Tipo de Recebimento</label>
                <Select
                  value={filters.receiptType || "all"}
                  onValueChange={(v) => updateFilter("receiptType", v === "all" ? undefined : (v as ReceiptType))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {RECEIPT_TYPES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showOperadora && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-xs font-medium text-primary">Operadora</label>
                <Select
                  value={filters.operadora || "all"}
                  onValueChange={(v) => updateFilter("operadora", v === "all" ? undefined : (v as Operadora))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {OPERADORAS.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}