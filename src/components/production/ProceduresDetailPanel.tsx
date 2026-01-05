import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Eye, 
  Layers, 
  Award,
  BarChart3,
  Stethoscope,
  FlaskConical,
  Syringe,
  Heart,
  Activity,
  Bed,
  HelpCircle,
  TrendingUp,
  Info,
  DollarSign,
  Filter,
} from "lucide-react";
import { Production } from "@/types";
import { ProcedureDrilldownDrawer } from "./ProcedureDrilldownDrawer";

interface ProceduresDetailPanelProps {
  productions: Production[];
  startDate: string;
  endDate: string;
}

// Normalize procedure name for grouping
function normalizeProcedureName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Production type icons
const PRODUCTION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONSULTA: Stethoscope,
  EXAME: FlaskConical,
  QUIMIOTERAPIA: Syringe,
  BOX_PS: Heart,
  SESSAO_TERAPEUTICA: Activity,
  INTERNACAO: Bed,
  OUTRO: HelpCircle,
};

// Production type labels
const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  EXAME: "Exame",
  QUIMIOTERAPIA: "Quimio",
  BOX_PS: "Box/PS",
  SESSAO_TERAPEUTICA: "Sessão",
  INTERNACAO: "Internação",
  OUTRO: "Outro",
};

export interface AggregatedProcedure {
  name: string;
  nameNorm: string;
  type: string;
  quantity: number;
  percentage: number;
  estimatedValue: number;
  valuePercentage: number;
  productions: Production[];
}

export function ProceduresDetailPanel({
  productions,
  startDate,
  endDate,
}: ProceduresDetailPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"quantidade" | "participacao">("quantidade");
  const [groupByNorm, setGroupByNorm] = useState(true);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<AggregatedProcedure | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [paretoMode, setParetoMode] = useState<"quantidade" | "valor">("quantidade");

  // Check if we have estimated values
  const hasEstimatedValues = useMemo(() => {
    return productions.some(p => p.estimatedValue && p.estimatedValue > 0);
  }, [productions]);

  // Unique production types
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    productions.forEach((p) => types.add(p.productionType));
    return Array.from(types).sort();
  }, [productions]);

  // Filter by type first
  const typeFilteredProductions = useMemo(() => {
    if (selectedType === "all") return productions;
    return productions.filter(p => p.productionType === selectedType);
  }, [productions, selectedType]);

  // Aggregate procedures
  const aggregatedProcedures = useMemo(() => {
    const map = new Map<string, AggregatedProcedure>();

    typeFilteredProductions.forEach((p) => {
      const key = groupByNorm
        ? normalizeProcedureName(p.description)
        : p.description;

      if (!map.has(key)) {
        map.set(key, {
          name: p.description,
          nameNorm: normalizeProcedureName(p.description),
          type: p.productionType,
          quantity: 0,
          percentage: 0,
          estimatedValue: 0,
          valuePercentage: 0,
          productions: [],
        });
      }

      const entry = map.get(key)!;
      entry.quantity += p.quantity;
      entry.estimatedValue += p.estimatedValue || 0;
      entry.productions.push(p);
    });

    const totalQty = typeFilteredProductions.reduce((sum, p) => sum + p.quantity, 0);
    const totalValue = typeFilteredProductions.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

    return Array.from(map.values())
      .map((proc) => ({
        ...proc,
        percentage: totalQty > 0 ? (proc.quantity / totalQty) * 100 : 0,
        valuePercentage: totalValue > 0 ? (proc.estimatedValue / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [typeFilteredProductions, groupByNorm]);

  // Filter by search
  const filteredProcedures = useMemo(() => {
    if (!searchTerm) return aggregatedProcedures;
    const term = searchTerm.toLowerCase();
    return aggregatedProcedures.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.nameNorm.toLowerCase().includes(term)
    );
  }, [aggregatedProcedures, searchTerm]);

  // Top 15 for display
  const top15 = useMemo(() => {
    const sorted = [...filteredProcedures];
    if (paretoMode === "valor" && hasEstimatedValues) {
      sorted.sort((a, b) => b.estimatedValue - a.estimatedValue);
    }
    return sorted.slice(0, 15);
  }, [filteredProcedures, paretoMode, hasEstimatedValues]);

  // Stats cards
  const stats = useMemo(() => {
    const uniqueCount = aggregatedProcedures.length;
    const topProcedure = aggregatedProcedures[0];
    
    // Concentration: Top 10 percentage
    const top10Total = aggregatedProcedures
      .slice(0, 10)
      .reduce((sum, p) => sum + p.percentage, 0);

    return {
      uniqueCount,
      topProcedure: topProcedure ? {
        name: topProcedure.name,
        quantity: topProcedure.quantity,
        percentage: topProcedure.percentage,
      } : null,
      top10Concentration: top10Total,
    };
  }, [aggregatedProcedures]);

  // Open drilldown
  const handleOpenDrilldown = (procedure: AggregatedProcedure) => {
    setSelectedProcedure(procedure);
    setDrilldownOpen(true);
  };

  // Get icon for type
  const getTypeIcon = (type: string) => {
    const IconComponent = PRODUCTION_TYPE_ICONS[type] || Activity;
    return IconComponent;
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Detalhamento por Procedimentos
              </CardTitle>
              <CardDescription className="text-xs">
                Hierarquia: Tipo → Procedimento • Clique no olho para drill-down
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="pareto-mode"
                        checked={paretoMode === "valor"}
                        onCheckedChange={(checked) => setParetoMode(checked ? "valor" : "quantidade")}
                        disabled={!hasEstimatedValues}
                      />
                      <Label htmlFor="pareto-mode" className="text-xs cursor-pointer">
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        Pareto por Valor
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[200px]">
                    <p className="text-xs">
                      {hasEstimatedValues 
                        ? "Alterna ranking entre quantidade e valor estimado"
                        : "Valores estimados não configurados para esta produção"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[250px]">
                    <p className="text-xs">
                      Agrupamento normalizado: nomes são padronizados (maiúsculas, sem acentos) 
                      para evitar duplicidades como "Consulta" vs "CONSULTA".
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Procedimentos únicos</p>
              <p className="text-xl font-bold text-primary">{stats.uniqueCount}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Top 1 procedimento</p>
              <p className="text-sm font-medium truncate" title={stats.topProcedure?.name}>
                {stats.topProcedure?.name || "-"}
              </p>
              {stats.topProcedure && (
                <p className="text-xs text-muted-foreground">
                  {stats.topProcedure.quantity.toLocaleString("pt-BR")} ({stats.topProcedure.percentage.toFixed(1)}%)
                </p>
              )}
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Concentração Top 10</p>
              <p className="text-xl font-bold text-amber-600">{stats.top10Concentration.toFixed(1)}%</p>
            </div>
          </div>

          {/* Type Filter + Search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-9 w-[150px] text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PRODUCTION_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar procedimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quantidade" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Top por {paretoMode === "valor" && hasEstimatedValues ? "Valor" : "Quantidade"}
              </TabsTrigger>
              <TabsTrigger value="participacao" className="text-xs">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Top por Participação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quantidade" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-9 w-8">#</TableHead>
                    <TableHead className="text-xs h-9">Procedimento</TableHead>
                    <TableHead className="text-xs h-9 w-16">Tipo</TableHead>
                    <TableHead className="text-xs h-9 text-right w-20">Qtd</TableHead>
                    {hasEstimatedValues && (
                      <TableHead className="text-xs h-9 text-right w-24">Valor Est.</TableHead>
                    )}
                    <TableHead className="text-xs h-9 text-right w-14">%</TableHead>
                    <TableHead className="text-xs h-9 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top15.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasEstimatedValues ? 7 : 6} className="text-center text-xs text-muted-foreground py-8">
                        Nenhum procedimento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    top15.map((proc, idx) => {
                      const TypeIcon = getTypeIcon(proc.type);
                      return (
                        <TableRow key={proc.nameNorm} className="hover:bg-muted/50">
                          <TableCell className="text-xs text-muted-foreground py-2">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            <span className="truncate block max-w-[200px]" title={proc.name}>
                              {proc.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <TypeIcon className="h-3 w-3" />
                              {PRODUCTION_TYPE_LABELS[proc.type] || proc.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right font-medium">
                            {proc.quantity.toLocaleString("pt-BR")}
                          </TableCell>
                          {hasEstimatedValues && (
                            <TableCell className="text-xs py-2 text-right text-muted-foreground">
                              {formatCurrency(proc.estimatedValue)}
                            </TableCell>
                          )}
                          <TableCell className="text-xs py-2 text-right text-muted-foreground">
                            {(paretoMode === "valor" && hasEstimatedValues ? proc.valuePercentage : proc.percentage).toFixed(1)}%
                          </TableCell>
                          <TableCell className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleOpenDrilldown(proc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="participacao" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-9 w-8">#</TableHead>
                    <TableHead className="text-xs h-9">Procedimento</TableHead>
                    <TableHead className="text-xs h-9 w-16">Tipo</TableHead>
                    <TableHead className="text-xs h-9 text-right w-14">%</TableHead>
                    <TableHead className="text-xs h-9 text-right w-20">Qtd</TableHead>
                    <TableHead className="text-xs h-9 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top15.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                        Nenhum procedimento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...top15]
                      .sort((a, b) => b.percentage - a.percentage)
                      .map((proc, idx) => {
                        const TypeIcon = getTypeIcon(proc.type);
                        return (
                          <TableRow key={proc.nameNorm} className="hover:bg-muted/50">
                            <TableCell className="text-xs text-muted-foreground py-2">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              <span className="truncate block max-w-[200px]" title={proc.name}>
                                {proc.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <TypeIcon className="h-3 w-3" />
                                {PRODUCTION_TYPE_LABELS[proc.type] || proc.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-medium text-primary">
                              {proc.percentage.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right text-muted-foreground">
                              {proc.quantity.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenDrilldown(proc)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Drilldown Drawer */}
      {selectedProcedure && (
        <ProcedureDrilldownDrawer
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          procedureName={selectedProcedure.name}
          productions={selectedProcedure.productions}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </>
  );
}
