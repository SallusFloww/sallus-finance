import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDRE, DREData } from "@/hooks/useDRE";
import { useApp } from "@/contexts/AppContext";
import { useConsistencyCheck } from "@/hooks/useConsistencyCheck";
import { ConsistencyBadge } from "@/components/dashboard/ConsistencyBadge";
import { formatCurrency } from "@/utils/formatters";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Banknote, 
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  Calendar,
  FileText,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles
} from "lucide-react";
import { DREManagerialReading } from "@/components/dashboard/DREManagerialReading";
import { cn } from "@/lib/utils";

// Componente de KPI resumido
function KPICard({ 
  label, 
  value, 
  trend,
  icon: Icon,
  colorClass 
}: { 
  label: string; 
  value: number; 
  trend?: "up" | "down" | "neutral";
  icon: React.ElementType;
  colorClass: string;
}) {
  const isPositive = value >= 0;
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 shadow-soft transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5",
      colorClass
    )}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
        <Icon className="w-full h-full" />
      </div>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-foreground/70 uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-2xl font-bold tracking-tight",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          )}>
            {formatCurrency(value)}
          </p>
          {trend && (
            <span className={cn(
              "p-1 rounded-full",
              trend === "up" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
              trend === "down" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
              trend === "neutral" && "bg-muted text-muted-foreground"
            )}>
              {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
              {trend === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
              {trend === "neutral" && <Minus className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de linha do DRE
function DRERow({ 
  label, 
  value, 
  isTotal = false, 
  isSubtotal = false, 
  indent = 0,
  showSign = false,
  tooltip,
  className
}: { 
  label: string; 
  value: number; 
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
  showSign?: boolean;
  tooltip?: string;
  className?: string;
}) {
  const isPositive = value >= 0;
  const displayValue = showSign 
    ? `${isPositive ? "+" : ""}${formatCurrency(value)}`
    : formatCurrency(Math.abs(value));
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between py-3 px-4 transition-colors duration-200",
        isTotal && "bg-gradient-to-r from-primary/10 to-primary/5 font-bold text-base rounded-lg my-2",
        isSubtotal && "bg-muted/40 font-semibold rounded-md",
        !isTotal && !isSubtotal && "hover:bg-muted/30 border-b border-border/30",
        className
      )}
      style={{ paddingLeft: `${16 + indent * 20}px` }}
    >
      <div className="flex items-center gap-2">
        {indent > 0 && (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted/50">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <span className={cn(
          "transition-colors",
          indent > 0 && "text-muted-foreground text-sm"
        )}>
          {label}
        </span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <span className={cn(
        "font-mono text-sm tabular-nums",
        isTotal && "text-base",
        isTotal && (isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"),
        isSubtotal && (isPositive ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-destructive/90"),
        showSign && !isTotal && !isSubtotal && isPositive && "text-emerald-600 dark:text-emerald-400",
        showSign && !isTotal && !isSubtotal && !isPositive && "text-destructive"
      )}>
        {displayValue}
      </span>
    </div>
  );
}

// Componente de bloco do DRE
function DREBlock({ 
  title, 
  icon: Icon, 
  colorClass,
  borderColor,
  tooltip,
  children 
}: { 
  title: string; 
  icon: React.ElementType;
  colorClass: string;
  borderColor: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "mb-6 rounded-xl border-l-4 bg-card/50 backdrop-blur-sm overflow-hidden animate-fade-in",
      borderColor
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border/30",
        colorClass
      )}>
        <div className={cn(
          "p-2 rounded-lg",
          colorClass.replace("text-", "bg-").replace("600", "100").replace("500", "100"),
          "dark:bg-opacity-20"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm uppercase tracking-wide">{title}</span>
        <Tooltip>
          <TooltipTrigger className="ml-auto">
            <HelpCircle className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="p-2">
        {children}
      </div>
    </div>
  );
}

// Componente de margem com visual moderno
function MarginCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const isPositive = value >= 0;
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
      "bg-gradient-to-r from-background to-muted/20 hover:shadow-soft"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          isPositive 
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" 
            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-foreground/80">{label}</span>
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          "font-mono text-sm px-3 py-1 border-2",
          isPositive 
            ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" 
            : "border-destructive/50 text-destructive"
        )}
      >
        {value.toFixed(1)}%
      </Badge>
    </div>
  );
}

// Componente principal do DRE
function DREStatement({ dre, title }: { dre: DREData; title: string }) {
  return (
    <div className="space-y-6">
      {/* KPIs Resumidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Receita Operacional"
          value={dre.receitaBrutaOperacional}
          trend="up"
          icon={TrendingUp}
          colorClass="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20"
        />
        <KPICard
          label="Custos Diretos"
          value={-dre.custosOperacionaisDiretos}
          trend="down"
          icon={TrendingDown}
          colorClass="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20"
        />
        <KPICard
          label="Resultado Operacional"
          value={dre.resultadoOperacionalTotal}
          trend={dre.resultadoOperacionalTotal >= 0 ? "up" : "down"}
          icon={Building2}
          colorClass="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
        />
        <KPICard
          label="Resultado Gerencial"
          value={dre.resultadoGerencial}
          trend={dre.resultadoGerencial >= 0 ? "up" : "down"}
          icon={Sparkles}
          colorClass="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20"
        />
      </div>

      {/* Card Principal do DRE */}
      <Card className="border-0 shadow-soft overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Demonstração do Resultado do Exercício</p>
              </div>
            </div>
            <Badge variant="secondary" className="font-normal gap-1.5">
              <Calendar className="h-3 w-3" />
              {dre.transactionCount} lançamentos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* BLOCO 1: OPERACIONAL ASSISTENCIAL */}
          <DREBlock
            title="Operacional Assistencial"
            icon={Building2}
            colorClass="text-emerald-600 dark:text-emerald-400"
            borderColor="border-l-emerald-500"
            tooltip="Receitas e custos diretamente ligados à operação assistencial das unidades"
          >
            <DRERow 
              label="1. Receita Bruta Operacional" 
              value={dre.receitaBrutaOperacional}
              isSubtotal
              tooltip="Soma de todas as entradas classificadas como Operacional – Unidade"
            />
            {dre.receitaBrutaOperacionalItems.map((item, i) => (
              <DRERow key={i} label={item.label} value={item.value} indent={1} />
            ))}
            
            {dre.deducoesOperacionais > 0 && (
              <DRERow 
                label="2. (-) Deduções Operacionais" 
                value={-dre.deducoesOperacionais}
                tooltip="Repasses médicos, impostos sobre serviços (preparado para futuro)"
              />
            )}
            
            <DRERow 
              label="3. = Receita Líquida Operacional" 
              value={dre.receitaLiquidaOperacional}
              isSubtotal
            />
            
            <DRERow 
              label="4. (-) Custos Operacionais Diretos" 
              value={-dre.custosOperacionaisDiretos}
              isSubtotal
              tooltip="Saídas classificadas como Operacional – Unidade (médicos, insumos, etc.)"
            />
            {dre.custosOperacionaisDiretosItems.map((item, i) => (
              <DRERow key={i} label={item.label} value={-item.value} indent={1} />
            ))}
            
            <DRERow 
              label="5. = RESULTADO OPERACIONAL ASSISTENCIAL" 
              value={dre.resultadoOperacionalAssistencial}
              isTotal
              showSign
              tooltip="A operação assistencial se sustenta sozinha?"
            />
          </DREBlock>

          {/* BLOCO 2: CUSTOS COMPARTILHADOS */}
          <DREBlock
            title="Operacional Compartilhado"
            icon={Banknote}
            colorClass="text-purple-600 dark:text-purple-400"
            borderColor="border-l-purple-500"
            tooltip="Custos operacionais necessários para manter a empresa, não atribuídos diretamente às unidades"
          >
            <DRERow 
              label="6. (-) Custos Operacionais Compartilhados" 
              value={-dre.custosCompartilhados}
              isSubtotal
              tooltip="Saídas classificadas como Operacional – Compartilhado (energia, água, manutenção, etc.)"
            />
            {dre.custosCompartilhadosItems.map((item, i) => (
              <DRERow key={i} label={item.label} value={-item.value} indent={1} />
            ))}
            
            <DRERow 
              label="7. = RESULTADO OPERACIONAL TOTAL" 
              value={dre.resultadoOperacionalTotal}
              isTotal
              showSign
            />
          </DREBlock>

          {/* BLOCO 3: NÃO OPERACIONAL */}
          <DREBlock
            title="Não Operacional / Financeiro"
            icon={dre.resultadoNaoOperacional >= 0 ? TrendingUp : TrendingDown}
            colorClass="text-blue-600 dark:text-blue-400"
            borderColor="border-l-blue-500"
            tooltip="Receitas e despesas financeiras da empresa que não representam performance assistencial"
          >
            <DRERow 
              label="8. (+) Receitas Não Operacionais" 
              value={dre.receitasNaoOperacionais}
              isSubtotal
              tooltip="Entradas classificadas como Não Operacional – Financeira (aluguel, royalties, etc.)"
            />
            {dre.receitasNaoOperacionaisItems.map((item, i) => (
              <DRERow key={i} label={item.label} value={item.value} indent={1} />
            ))}
            
            <DRERow 
              label="9. (-) Despesas Não Operacionais" 
              value={-dre.despesasNaoOperacionais}
              isSubtotal
              tooltip="Saídas classificadas como Não Operacional – Financeira (juros, multas, etc.)"
            />
            {dre.despesasNaoOperacionaisItems.map((item, i) => (
              <DRERow key={i} label={item.label} value={-item.value} indent={1} />
            ))}
            
            <DRERow 
              label="10. = RESULTADO NÃO OPERACIONAL" 
              value={dre.resultadoNaoOperacional}
              isTotal
              showSign
            />
          </DREBlock>

          {/* BLOCO 4: EXTRAORDINÁRIO */}
          {dre.eventosExtraordinariosItems.length > 0 && (
            <DREBlock
              title="Eventos Extraordinários"
              icon={AlertTriangle}
              colorClass="text-amber-600 dark:text-amber-400"
              borderColor="border-l-amber-500"
              tooltip="Eventos pontuais não recorrentes que não representam operação normal"
            >
              {dre.eventosExtraordinariosItems.map((item, i) => (
                <DRERow 
                  key={i} 
                  label={item.label} 
                  value={item.value} 
                  showSign
                  tooltip={item.tooltip}
                />
              ))}
              
              <DRERow 
                label="11. (+/-) TOTAL EXTRAORDINÁRIO" 
                value={dre.eventosExtraordinarios}
                isTotal
                showSign
              />
            </DREBlock>
          )}

          {/* RESULTADO FINAL */}
          <div className={cn(
            "rounded-xl p-6 mt-6",
            "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent",
            "border border-primary/20"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Linha 12</p>
                  <p className="font-bold text-lg">RESULTADO GERENCIAL DO PERÍODO</p>
                </div>
              </div>
              <div className={cn(
                "text-3xl font-bold font-mono tabular-nums",
                dre.resultadoGerencial >= 0 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-destructive"
              )}>
                {dre.resultadoGerencial >= 0 ? "+" : ""}{formatCurrency(dre.resultadoGerencial)}
              </div>
            </div>
          </div>

          {/* MARGENS */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Indicadores de Margem</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MarginCard 
                label="Margem Assistencial" 
                value={dre.margemOperacionalAssistencial} 
                icon={Building2}
              />
              <MarginCard 
                label="Margem Operacional" 
                value={dre.margemOperacionalTotal} 
                icon={Banknote}
              />
              <MarginCard 
                label="Margem Gerencial" 
                value={dre.margemGerencial} 
                icon={Sparkles}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Comparativo mensal modernizado
function MonthlyComparison({ months }: { months: DREData[] }) {
  if (months.length < 2) return null;

  const formatMonth = (date: Date) => format(date, "MMM/yy", { locale: ptBR });

  const rows = [
    { label: "Receita Bruta Operacional", key: "receitaBrutaOperacional" as const },
    { label: "Custos Operacionais Diretos", key: "custosOperacionaisDiretos" as const, negative: true },
    { label: "Resultado Op. Assistencial", key: "resultadoOperacionalAssistencial" as const, highlight: true },
    { label: "Custos Compartilhados", key: "custosCompartilhados" as const, negative: true },
    { label: "Resultado Op. Total", key: "resultadoOperacionalTotal" as const, highlight: true },
    { label: "Resultado Não Operacional", key: "resultadoNaoOperacional" as const },
    { label: "Eventos Extraordinários", key: "eventosExtraordinarios" as const },
    { label: "Resultado Gerencial", key: "resultadoGerencial" as const, total: true },
  ];

  return (
    <Card className="border-0 shadow-soft overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Comparativo Mensal</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Linha</th>
                {months.map((m, i) => (
                  <th key={i} className="text-right py-4 px-6 font-mono font-semibold text-muted-foreground">
                    {formatMonth(m.period.start)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr 
                  key={row.key} 
                  className={cn(
                    "transition-colors",
                    row.total && "bg-gradient-to-r from-primary/10 to-primary/5 font-bold",
                    row.highlight && "bg-muted/20 font-semibold",
                    !row.total && !row.highlight && "hover:bg-muted/30",
                    rowIndex !== rows.length - 1 && "border-b border-border/30"
                  )}
                >
                  <td className="py-4 px-6">{row.label}</td>
                  {months.map((m, i) => {
                    const value = m[row.key];
                    const displayValue = row.negative ? -value : value;
                    return (
                      <td 
                        key={i} 
                        className={cn(
                          "text-right py-4 px-6 font-mono tabular-nums",
                          (row.highlight || row.total) && value >= 0 && "text-emerald-600 dark:text-emerald-400",
                          (row.highlight || row.total) && value < 0 && "text-destructive"
                        )}
                      >
                        {formatCurrency(displayValue)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DRE() {
  const { calculateDRE, getMonthlyComparison, availableUnits } = useDRE();
  const { transactions: txContext } = useApp();
  const { transactions, settings } = txContext;
  const [selectedMonth, setSelectedMonth] = useState<string>("current");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [includeCancelled, setIncludeCancelled] = useState<boolean>(false);

  // Gerar opções de meses
  const monthOptions = useMemo(() => {
    const options = [{ value: "current", label: "Mês Atual" }];
    const now = new Date();
    for (let i = 1; i <= 11; i++) {
      const month = subMonths(now, i);
      options.push({
        value: format(month, "yyyy-MM"),
        label: format(month, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  // Calcular período baseado na seleção
  const period = useMemo(() => {
    if (selectedMonth === "current") {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    }
    const [year, month] = selectedMonth.split("-").map(Number);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0),
    };
  }, [selectedMonth]);

  // Calcular DRE - excluir cancelados por padrão
  const dreConsolidado = useMemo(() => 
    calculateDRE(period.start, period.end, "all", includeCancelled),
    [calculateDRE, period, includeCancelled]
  );

  const dreUnit = useMemo(() => 
    selectedUnit !== "all" ? calculateDRE(period.start, period.end, selectedUnit, includeCancelled) : null,
    [calculateDRE, period, selectedUnit, includeCancelled]
  );

  // Comparativo mensal
  const monthlyComparison = useMemo(() => 
    getMonthlyComparison(3, selectedUnit !== "all" ? selectedUnit : undefined, includeCancelled),
    [getMonthlyComparison, selectedUnit, includeCancelled]
  );

  // Checagem de consistência
  const consistencyResult = useConsistencyCheck({
    transactions,
    settings,
    dreData: selectedUnit === "all" ? dreConsolidado : dreUnit,
    periodStart: period.start,
    periodEnd: period.end,
    unitFilter: selectedUnit
  });

  const periodTitle = format(period.start, "MMMM yyyy", { locale: ptBR });

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl gradient-primary">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                DRE Gerencial
              </h1>
            </div>
            <p className="text-muted-foreground ml-14">
              Demonstração do Resultado do Exercício — <span className="font-medium text-foreground capitalize">{periodTitle}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <ConsistencyBadge result={consistencyResult} />
            
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] bg-card border-border/50 shadow-sm">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-[180px] bg-card border-border/50 shadow-sm">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Consolidado IMEC
                </SelectItem>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle para incluir cancelados (auditoria) */}
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border/50 shadow-sm">
              <Switch
                id="include-cancelled"
                checked={includeCancelled}
                onCheckedChange={setIncludeCancelled}
              />
              <Label 
                htmlFor="include-cancelled" 
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Incluir cancelados
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Movimentações canceladas não compõem os totais por padrão.
                    Ative esta opção apenas para fins de auditoria.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Alerta quando incluindo cancelados */}
        {includeCancelled && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">Modo Auditoria Ativo</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Os valores exibidos incluem movimentações canceladas. Este modo é apenas para fins de auditoria e não representa a posição real.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de validação */}
        {dreConsolidado.transactionCount > 0 && 
         dreConsolidado.receitaBrutaOperacional === 0 && 
         dreConsolidado.custosOperacionaisDiretos === 0 &&
         dreConsolidado.receitasNaoOperacionais === 0 &&
         dreConsolidado.despesasNaoOperacionais === 0 &&
         dreConsolidado.eventosExtraordinarios === 0 && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de consolidação</AlertTitle>
            <AlertDescription>
              Foram detectados {dreConsolidado.transactionCount} lançamentos no período, mas nenhum está refletido no DRE. 
              Verifique se os lançamentos possuem a Classificação Financeira definida corretamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="consolidated" className="space-y-6">
          <TabsList className="bg-card border shadow-sm p-1">
            <TabsTrigger value="consolidated" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4 mr-2" />
              Consolidado
            </TabsTrigger>
            <TabsTrigger value="comparison" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              Comparativo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consolidated" className="space-y-6 mt-6">
            {selectedUnit === "all" ? (
              <>
                <DREStatement 
                  dre={dreConsolidado} 
                  title={`DRE Consolidado IMEC Saúde — ${periodTitle}`}
                />
                <DREManagerialReading dre={dreConsolidado} />
              </>
            ) : (
              dreUnit && (
                <>
                  <DREStatement 
                    dre={dreUnit} 
                    title={`DRE ${availableUnits.find(u => u.id === selectedUnit)?.name} — ${periodTitle}`}
                  />
                  <DREManagerialReading dre={dreUnit} />
                </>
              )
            )}
          </TabsContent>

          <TabsContent value="comparison" className="mt-6">
            <MonthlyComparison months={monthlyComparison} />
          </TabsContent>
        </Tabs>

        {/* Rodapé de Governança */}
        <Card className="bg-muted/20 border-dashed border-muted-foreground/20">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Este DRE é gerencial e baseado em dados operacionais e financeiros classificados no sistema.
              Não substitui demonstrações contábeis oficiais.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
