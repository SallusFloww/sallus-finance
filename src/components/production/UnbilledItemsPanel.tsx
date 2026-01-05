import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  FileWarning, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  Building2,
  Users,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import { Production } from "@/types";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatUnitDisplayName, formatConvenioDisplayName, formatSpecialtyDisplayName } from "@/utils/formatters";

interface UnbilledItemsPanelProps {
  productions: Production[];
  onNavigateToBilling?: () => void;
}

interface UnbilledItem {
  id: string;
  description: string;
  productionDate: string;
  unit: string;
  convenio: string;
  specialty: string;
  quantity: number;
  ageDays: number;
  status: string;
}

// Use centralized formatUnitDisplayName from formatters.ts

export function UnbilledItemsPanel({ productions, onNavigateToBilling }: UnbilledItemsPanelProps) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Get unbilled items
  const unbilledItems = useMemo(() => {
    const today = new Date();
    return productions
      .filter((p) => p.status === "PRODUZIDO")
      .map((p) => ({
        id: p.id,
        description: p.description,
        productionDate: p.productionDate,
        unit: p.unit,
        convenio: p.convenio || "PARTICULAR",
        specialty: p.specialty || p.unit,
        quantity: p.quantity,
        ageDays: differenceInDays(today, parseISO(p.productionDate)),
        status: p.status,
      }))
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [productions]);

  // Summary stats
  const stats = useMemo(() => {
    const totalQty = unbilledItems.reduce((sum, item) => sum + item.quantity, 0);
    const avgAge = unbilledItems.length > 0
      ? unbilledItems.reduce((sum, item) => sum + item.ageDays, 0) / unbilledItems.length
      : 0;
    const criticalCount = unbilledItems.filter((item) => item.ageDays > 30).length;
    const warningCount = unbilledItems.filter((item) => item.ageDays > 15 && item.ageDays <= 30).length;

    // By unit
    const byUnit: Record<string, number> = {};
    unbilledItems.forEach((item) => {
      byUnit[item.unit] = (byUnit[item.unit] || 0) + item.quantity;
    });

    // By convenio
    const byConvenio: Record<string, number> = {};
    unbilledItems.forEach((item) => {
      byConvenio[item.convenio] = (byConvenio[item.convenio] || 0) + item.quantity;
    });

    return {
      totalItems: unbilledItems.length,
      totalQty,
      avgAge: Math.round(avgAge),
      criticalCount,
      warningCount,
      byUnit: Object.entries(byUnit).sort((a, b) => b[1] - a[1]).slice(0, 5),
      byConvenio: Object.entries(byConvenio).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [unbilledItems]);

  // Age badge variant
  const getAgeBadgeVariant = (days: number) => {
    if (days > 30) return "destructive";
    if (days > 15) return "secondary";
    return "outline";
  };

  // Don't render if no unbilled items
  if (unbilledItems.length === 0) {
    return (
      <Card className="border-dashed border-green-500/30 bg-green-50/30 dark:bg-green-950/10">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">Todos os itens foram faturados no período!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleNavigateToBilling = () => {
    if (onNavigateToBilling) {
      onNavigateToBilling();
    } else {
      navigate("/suggested-billing");
    }
  };

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-amber-600" />
                Itens Não Faturados
                <Badge variant="secondary" className="text-xs">
                  {stats.totalQty.toLocaleString("pt-BR")} itens
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Produção registrada aguardando envio para faturamento
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setDrawerOpen(true)}
              >
                Ver Detalhes
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-xs h-8"
                onClick={handleNavigateToBilling}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Faturamento Sugerido
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2.5 bg-background/80 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Registros</p>
              <p className="text-lg font-bold text-amber-600">{stats.totalItems}</p>
            </div>
            <div className="p-2.5 bg-background/80 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Idade Média</p>
              <p className="text-lg font-bold">{stats.avgAge}d</p>
            </div>
            <div className="p-2.5 bg-background/80 rounded-lg text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Críticos (&gt;30d)</p>
                      <p className="text-lg font-bold text-red-600">{stats.criticalCount}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Itens com mais de 30 dias sem faturar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="p-2.5 bg-background/80 rounded-lg text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Alerta (15-30d)</p>
                      <p className="text-lg font-bold text-amber-500">{stats.warningCount}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Itens entre 15 e 30 dias sem faturar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Distribution Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Por Unidade
              </p>
              {stats.byUnit.map(([unit, qty]) => (
                <div key={unit} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[100px]">{formatUnitDisplayName(unit)}</span>
                  <Badge variant="outline" className="text-[10px]">{qty}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Por Convênio
              </p>
              {stats.byConvenio.map(([conv, qty]) => (
                <div key={conv} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[100px]">{conv}</span>
                  <Badge variant="outline" className="text-[10px]">{qty}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-amber-600" />
              Itens Não Faturados
            </SheetTitle>
            <SheetDescription className="text-xs">
              {stats.totalItems} registros ({stats.totalQty.toLocaleString("pt-BR")} itens) aguardando faturamento
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-160px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-9">Idade</TableHead>
                  <TableHead className="text-xs h-9">Data</TableHead>
                  <TableHead className="text-xs h-9">Procedimento</TableHead>
                  <TableHead className="text-xs h-9">Unidade</TableHead>
                  <TableHead className="text-xs h-9">Convênio</TableHead>
                  <TableHead className="text-xs h-9 text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unbilledItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="py-2">
                      <Badge variant={getAgeBadgeVariant(item.ageDays)} className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {item.ageDays}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {format(parseISO(item.productionDate), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <span className="truncate block max-w-[180px]" title={item.description}>
                        {item.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-2">{formatUnitDisplayName(item.unit)}</TableCell>
                    <TableCell className="text-xs py-2">
                      <span className="truncate block max-w-[80px]" title={formatConvenioDisplayName(item.convenio)}>
                        {formatConvenioDisplayName(item.convenio)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-2 text-right font-medium">
                      {item.quantity.toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="pt-4 border-t mt-4">
            <Button
              className="w-full"
              onClick={handleNavigateToBilling}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir para Faturamento Sugerido
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
