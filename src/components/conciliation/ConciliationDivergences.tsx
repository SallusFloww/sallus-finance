import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Eye, 
  Search, 
  AlertTriangle,
  FileX2,
  ArrowLeftRight,
  Clock,
  Ban
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency, formatUnitDisplayName, formatConvenioDisplayName } from "@/utils/formatters";
import type { Divergence, DivergenceType } from "@/hooks/useConciliation";

interface ConciliationDivergencesProps {
  divergences: Divergence[];
}

const DIVERGENCE_CONFIG: Record<DivergenceType, { label: string; icon: React.ReactNode; color: string }> = {
  VALOR_DIFERENTE: { 
    label: "Valor Diferente", 
    icon: <ArrowLeftRight className="h-4 w-4" />,
    color: "text-warning"
  },
  DATA_FORA_JANELA: { 
    label: "Data Fora da Janela", 
    icon: <Clock className="h-4 w-4" />,
    color: "text-muted-foreground"
  },
  RECEBIDO_SEM_FATURAMENTO: { 
    label: "Recebido sem Faturamento", 
    icon: <FileX2 className="h-4 w-4" />,
    color: "text-warning"
  },
  FATURADO_SEM_RECEBIDO: { 
    label: "Faturado sem Recebido", 
    icon: <Ban className="h-4 w-4" />,
    color: "text-destructive"
  },
  GLOSA_PARCIAL: { 
    label: "Glosa Parcial", 
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-warning"
  },
  GLOSA_TOTAL: { 
    label: "Glosa Total", 
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-destructive"
  },
};

const SEVERITY_VARIANT: Record<string, "destructive" | "outline" | "secondary"> = {
  ALTA: "destructive",
  MEDIA: "outline",
  BAIXA: "secondary",
};

export function ConciliationDivergences({ divergences }: ConciliationDivergencesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<DivergenceType | "all">("all");
  const [selectedDivergence, setSelectedDivergence] = useState<Divergence | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Count by type
  const countByType = divergences.reduce((acc, div) => {
    acc[div.type] = (acc[div.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter divergences
  const filteredDivergences = divergences.filter(div => {
    if (typeFilter !== "all" && div.type !== typeFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        div.description.toLowerCase().includes(search) ||
        div.item.source.toLowerCase().includes(search) ||
        div.item.unit.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const handleViewDivergence = (div: Divergence) => {
    setSelectedDivergence(div);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Type Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
          >
            Todas ({divergences.length})
          </Button>
          {Object.entries(DIVERGENCE_CONFIG).map(([type, config]) => {
            const count = countByType[type] || 0;
            if (count === 0) return null;
            return (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type as DivergenceType)}
                className="gap-1"
              >
                {config.icon}
                {config.label.substring(0, 15)}... ({count})
              </Button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar divergência..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <div className="text-2xl font-bold">
                  {divergences.filter(d => d.severity === "ALTA").length}
                </div>
                <div className="text-sm text-muted-foreground">Alta Severidade</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <div className="text-2xl font-bold">
                  {divergences.filter(d => d.severity === "MEDIA").length}
                </div>
                <div className="text-sm text-muted-foreground">Média Severidade</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileX2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">
                  {divergences.filter(d => d.severity === "BAIXA").length}
                </div>
                <div className="text-sm text-muted-foreground">Baixa Severidade</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Idade</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDivergences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Nenhuma divergência encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredDivergences.slice(0, 50).map((div) => {
                  const config = DIVERGENCE_CONFIG[div.type];
                  return (
                    <TableRow key={div.id}>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${config.color}`}>
                          {config.icon}
                          <span className="text-sm">{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY_VARIANT[div.severity]}>
                          {div.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatUnitDisplayName(div.item.unit)}</TableCell>
                      <TableCell>{formatConvenioDisplayName(div.item.source)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(div.item.billedAmount || div.item.receivedAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{div.item.ageInDays}d</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={div.description}>
                        {div.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDivergence(div)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredDivergences.length > 50 && (
            <div className="border-t p-2 text-center text-sm text-muted-foreground">
              Exibindo 50 de {filteredDivergences.length} divergências
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhe da Divergência</SheetTitle>
            <SheetDescription>
              Investigação e comparação lado a lado
            </SheetDescription>
          </SheetHeader>

          {selectedDivergence && (
            <div className="mt-6 space-y-6">
              {/* Divergence Header */}
              <div className="flex items-center gap-3">
                <div className={DIVERGENCE_CONFIG[selectedDivergence.type].color}>
                  {DIVERGENCE_CONFIG[selectedDivergence.type].icon}
                </div>
                <div>
                  <h4 className="font-medium">
                    {DIVERGENCE_CONFIG[selectedDivergence.type].label}
                  </h4>
                  <Badge variant={SEVERITY_VARIANT[selectedDivergence.severity]}>
                    Severidade: {selectedDivergence.severity}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                <p className="text-sm">{selectedDivergence.description}</p>
              </div>

              {/* Item Details */}
              <div className="space-y-3">
                <h4 className="font-medium">Dados do Item</h4>
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span>{format(new Date(selectedDivergence.item.date), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unidade:</span>
                    <span>{formatUnitDisplayName(selectedDivergence.item.unit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Convênio:</span>
                    <span>{formatConvenioDisplayName(selectedDivergence.item.source)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descrição:</span>
                    <span className="text-right max-w-[200px]">{selectedDivergence.item.description}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Faturado:</span>
                    <span>{formatCurrency(selectedDivergence.item.billedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recebido:</span>
                    <span className="text-success">{formatCurrency(selectedDivergence.item.receivedAmount)}</span>
                  </div>
                  {selectedDivergence.valueDiff !== undefined && (
                    <div className="flex justify-between text-destructive">
                      <span>Diferença:</span>
                      <span>{formatCurrency(selectedDivergence.valueDiff)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="font-medium">Recomendação</h4>
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  {selectedDivergence.type === "FATURADO_SEM_RECEBIDO" && (
                    <p>Verificar status da cobrança junto ao convênio e agendar follow-up.</p>
                  )}
                  {selectedDivergence.type === "RECEBIDO_SEM_FATURAMENTO" && (
                    <p>Identificar origem do recebimento e vincular ao faturamento correspondente ou registrar novo.</p>
                  )}
                  {selectedDivergence.type === "GLOSA_PARCIAL" && (
                    <p>Avaliar possibilidade de recurso para recuperação do valor glosado.</p>
                  )}
                  {selectedDivergence.type === "GLOSA_TOTAL" && (
                    <p>Priorizar análise para recurso ou identificar causa raiz para prevenção.</p>
                  )}
                  {selectedDivergence.type === "VALOR_DIFERENTE" && (
                    <p>Comparar valores faturados vs recebidos e identificar causa da diferença.</p>
                  )}
                  {selectedDivergence.type === "DATA_FORA_JANELA" && (
                    <p>Revisar se há atraso justificado ou necessidade de ajuste no prazo esperado.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
