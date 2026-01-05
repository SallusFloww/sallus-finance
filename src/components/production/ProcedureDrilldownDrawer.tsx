import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Stethoscope, Calendar, TrendingUp } from "lucide-react";
import { Production } from "@/types";
import { format, parseISO, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface ProcedureDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedureName: string;
  productions: Production[];
  startDate: string;
  endDate: string;
}

// Format unit name for display
function formatUnitName(unit: string): string {
  const unitLabels: Record<string, string> = {
    oncologia: "Oncologia",
    "pronto-socorro": "Pronto Socorro",
    "centro-clinico": "Centro Clínico",
    centroclinico: "Centro Clínico",
  };
  const normalized = unit.toLowerCase().replace(/\s+/g, "-");
  return unitLabels[normalized] || unit;
}

export function ProcedureDrilldownDrawer({
  open,
  onOpenChange,
  procedureName,
  productions,
  startDate,
  endDate,
}: ProcedureDrilldownDrawerProps) {
  // Distribution by unit
  const byUnit = useMemo(() => {
    const map: Record<string, number> = {};
    productions.forEach((p) => {
      map[p.unit] = (map[p.unit] || 0) + p.quantity;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([unit, qty]) => ({
        name: formatUnitName(unit),
        quantity: qty,
        percentage: total > 0 ? (qty / total) * 100 : 0,
      }));
  }, [productions]);

  // Distribution by convenio
  const byConvenio = useMemo(() => {
    const map: Record<string, number> = {};
    productions.forEach((p) => {
      const conv = p.convenio || "PARTICULAR";
      map[conv] = (map[conv] || 0) + p.quantity;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([convenio, qty]) => ({
        name: convenio,
        quantity: qty,
        percentage: total > 0 ? (qty / total) * 100 : 0,
      }));
  }, [productions]);

  // Distribution by specialty
  const bySpecialty = useMemo(() => {
    const map: Record<string, number> = {};
    productions.forEach((p) => {
      const spec = p.specialty || p.unit;
      map[spec] = (map[spec] || 0) + p.quantity;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([specialty, qty]) => ({
        name: formatUnitName(specialty),
        quantity: qty,
        percentage: total > 0 ? (qty / total) * 100 : 0,
      }));
  }, [productions]);

  // Time series (weekly)
  const timeSeries = useMemo(() => {
    if (!startDate || !endDate || productions.length === 0) return [];

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekProductions = productions.filter((p) => {
        const prodDate = parseISO(p.productionDate);
        return isWithinInterval(prodDate, { start: weekStart, end: weekEnd });
      });
      const qty = weekProductions.reduce((sum, p) => sum + p.quantity, 0);

      return {
        date: format(weekStart, "dd/MM", { locale: ptBR }),
        quantidade: qty,
      };
    });
  }, [productions, startDate, endDate]);

  // Total quantity
  const totalQty = useMemo(() => {
    return productions.reduce((sum, p) => sum + p.quantity, 0);
  }, [productions]);

  // Sample records (last 20)
  const sampleRecords = useMemo(() => {
    return [...productions]
      .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())
      .slice(0, 20);
  }, [productions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold truncate" title={procedureName}>
            {procedureName}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {totalQty.toLocaleString("pt-BR")} registro(s) no período
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <Tabs defaultValue="distribuicao" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="distribuicao" className="text-xs">Distribuição</TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs">Evolução</TabsTrigger>
              <TabsTrigger value="registros" className="text-xs">Registros</TabsTrigger>
            </TabsList>

            <TabsContent value="distribuicao" className="space-y-4">
              {/* By Unit */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Por Unidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {byUnit.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  ) : (
                    byUnit.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-xs">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{item.quantity.toLocaleString("pt-BR")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* By Convenio */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                    Por Convênio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {byConvenio.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  ) : (
                    byConvenio.slice(0, 8).map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-xs truncate max-w-[150px]" title={item.name}>{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{item.quantity.toLocaleString("pt-BR")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* By Specialty */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5 text-green-600" />
                    Por Especialidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bySpecialty.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  ) : (
                    bySpecialty.slice(0, 8).map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-xs">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{item.quantity.toLocaleString("pt-BR")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evolucao" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Evolução Semanal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timeSeries.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
                  ) : (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeSeries}>
                          <defs>
                            <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={35}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="quantidade"
                            stroke="hsl(var(--primary))"
                            fillOpacity={1}
                            fill="url(#colorQty)"
                            name="Quantidade"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="registros" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Últimos Registros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sampleRecords.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem registros</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs h-8">Data</TableHead>
                          <TableHead className="text-xs h-8">Unidade</TableHead>
                          <TableHead className="text-xs h-8">Convênio</TableHead>
                          <TableHead className="text-xs h-8 text-right">Qtd</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleRecords.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs py-2">
                              {format(parseISO(p.productionDate), "dd/MM/yy")}
                            </TableCell>
                            <TableCell className="text-xs py-2">{formatUnitName(p.unit)}</TableCell>
                            <TableCell className="text-xs py-2 truncate max-w-[100px]">
                              {p.convenio || "PARTICULAR"}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-medium">
                              {p.quantity.toLocaleString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
