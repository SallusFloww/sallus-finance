import { X, ExternalLink, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBIFilters, DrilldownContext } from "@/contexts/BIFilterContext";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface DrilldownRow {
  id: string;
  description: string;
  value: number;
  date?: string;
  unit?: string;
  payer?: string;
  status?: string;
  daysOpen?: number;
}

interface BIDrilldownDrawerProps {
  data: DrilldownRow[];
  isLoading?: boolean;
}

export function BIDrilldownDrawer({ data, isLoading }: BIDrilldownDrawerProps) {
  const { drilldownContext, closeDrilldown, setFilter } = useBIFilters();
  const navigate = useNavigate();

  if (!drilldownContext) return null;

  const navigationLinks = getNavigationLinks(drilldownContext);
  const totalValue = data.reduce((sum, row) => sum + row.value, 0);

  const handleNavigate = (path: string) => {
    closeDrilldown();
    navigate(path);
  };

  const handleApplyFilter = () => {
    if (drilldownContext.filters) {
      Object.entries(drilldownContext.filters).forEach(([key, value]) => {
        if (value !== undefined) {
          setFilter(key as any, value);
        }
      });
    }
    closeDrilldown();
  };

  return (
    <Sheet open={!!drilldownContext} onOpenChange={() => closeDrilldown()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">{drilldownContext.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {drilldownContext.value}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {data.length} itens • Total: {formatCurrency(totalValue)}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 py-4 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyFilter}
            className="text-xs"
          >
            Aplicar como Filtro
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          {navigationLinks.map((link) => (
            <Button
              key={link.path}
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate(link.path)}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {link.label}
            </Button>
          ))}
        </div>

        {/* Data Table */}
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Descrição</TableHead>
                  {data[0]?.date && <TableHead className="text-xs">Data</TableHead>}
                  {data[0]?.unit && <TableHead className="text-xs">Unidade</TableHead>}
                  {data[0]?.payer && <TableHead className="text-xs">Pagador</TableHead>}
                  {data[0]?.daysOpen !== undefined && <TableHead className="text-xs">Dias</TableHead>}
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 50).map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">
                      {row.description}
                    </TableCell>
                    {row.date && <TableCell className="text-xs">{row.date}</TableCell>}
                    {row.unit && <TableCell className="text-xs">{row.unit}</TableCell>}
                    {row.payer && <TableCell className="text-xs">{row.payer}</TableCell>}
                    {row.daysOpen !== undefined && (
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            row.daysOpen > 90 && "border-red-500 text-red-600",
                            row.daysOpen > 60 && row.daysOpen <= 90 && "border-orange-500 text-orange-600",
                            row.daysOpen > 30 && row.daysOpen <= 60 && "border-yellow-500 text-yellow-600"
                          )}
                        >
                          {row.daysOpen}d
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(row.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data.length > 50 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Exibindo 50 de {data.length} registros
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getNavigationLinks(context: DrilldownContext): { label: string; path: string }[] {
  switch (context.type) {
    case "payer":
    case "aging":
      return [
        { label: "Ir para Aging", path: "/aging-report" },
        { label: "Ir para Faturamento", path: "/billing-report" },
      ];
    case "category":
      return [
        { label: "Ir para Transações", path: "/transactions" },
      ];
    case "unit":
      return [
        { label: "Ir para Produção", path: "/production-report" },
        { label: "Ir para Faturamento", path: "/billing-report" },
      ];
    case "funnel":
      return [
        { label: "Ir para Produção", path: "/production" },
        { label: "Ir para Faturamento Sugerido", path: "/suggested-billing" },
      ];
    default:
      return [];
  }
}
