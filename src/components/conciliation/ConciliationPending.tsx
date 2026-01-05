import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Eye, 
  Search, 
  FileText, 
  AlertTriangle,
  Clock,
  Ban,
  CheckCircle2,
  ArrowUpDown,
  StickyNote
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency, formatUnitDisplayName, formatConvenioDisplayName } from "@/utils/formatters";
import type { ConciliationItem, ConciliationStatus, MatchSuggestion, ConciliationNote } from "@/hooks/useConciliation";

interface ConciliationPendingProps {
  pendingItems: ConciliationItem[];
  criticalItems15: ConciliationItem[];
  criticalItems30: ConciliationItem[];
  onSuggestMatch: (item: ConciliationItem) => MatchSuggestion[];
  onAddNote: (itemId: string, note: string, userName: string) => void;
  onSetStatus: (itemId: string, status: ConciliationStatus) => void;
  getNotesForItem: (itemId: string) => ConciliationNote[];
  userName: string;
}

const STATUS_CONFIG: Record<ConciliationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  CONCILIADO: { label: "Conciliado", variant: "success" },
  PARCIAL: { label: "Parcial", variant: "warning" },
  EM_ABERTO: { label: "Em Aberto", variant: "outline" },
  GLOSADO: { label: "Glosado", variant: "destructive" },
  DIVERGENTE: { label: "Divergente", variant: "destructive" },
  SEM_VINCULO: { label: "Sem Vínculo", variant: "secondary" },
  EM_ANALISE: { label: "Em Análise", variant: "default" },
};

type FilterSegment = "all" | "critical15" | "critical30" | "sem_vinculo" | "parcial" | "glosado";

export function ConciliationPending({
  pendingItems,
  criticalItems15,
  criticalItems30,
  onSuggestMatch,
  onAddNote,
  onSetStatus,
  getNotesForItem,
  userName,
}: ConciliationPendingProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [segment, setSegment] = useState<FilterSegment>("all");
  const [selectedItem, setSelectedItem] = useState<ConciliationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([]);

  // Filter items based on segment and search
  const filteredItems = pendingItems.filter(item => {
    // Segment filter
    if (segment === "critical15" && item.ageInDays <= 15) return false;
    if (segment === "critical30" && item.ageInDays <= 30) return false;
    if (segment === "sem_vinculo" && item.status !== "SEM_VINCULO" && !item.linkedTransactionId) return true;
    if (segment === "sem_vinculo" && item.linkedTransactionId) return false;
    if (segment === "parcial" && item.status !== "PARCIAL") return false;
    if (segment === "glosado" && item.status !== "GLOSADO") return false;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        item.description.toLowerCase().includes(search) ||
        item.sourceLabel.toLowerCase().includes(search) ||
        item.unitLabel.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const handleViewItem = (item: ConciliationItem) => {
    setSelectedItem(item);
    setMatchSuggestions(onSuggestMatch(item));
    setNoteText("");
    setDrawerOpen(true);
  };

  const handleAddNote = () => {
    if (selectedItem && noteText.trim()) {
      onAddNote(selectedItem.id, noteText.trim(), userName);
      setNoteText("");
    }
  };

  const handleSetStatus = (status: ConciliationStatus) => {
    if (selectedItem) {
      onSetStatus(selectedItem.id, status);
      setSelectedItem({ ...selectedItem, status });
    }
  };

  const itemNotes = selectedItem ? getNotesForItem(selectedItem.id) : [];

  return (
    <div className="space-y-4">
      {/* Filters and Segments */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={segment === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSegment("all")}
          >
            Todas ({pendingItems.length})
          </Button>
          <Button
            variant={segment === "critical30" ? "destructive" : "outline"}
            size="sm"
            onClick={() => setSegment("critical30")}
            className={segment !== "critical30" ? "border-destructive text-destructive" : ""}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            &gt; 30 dias ({criticalItems30.length})
          </Button>
          <Button
            variant={segment === "critical15" ? "default" : "outline"}
            size="sm"
            onClick={() => setSegment("critical15")}
            className={segment !== "critical15" ? "border-warning text-warning" : ""}
          >
            <Clock className="mr-1 h-3 w-3" />
            &gt; 15 dias ({criticalItems15.length})
          </Button>
          <Button
            variant={segment === "parcial" ? "default" : "outline"}
            size="sm"
            onClick={() => setSegment("parcial")}
          >
            Parcial
          </Button>
          <Button
            variant={segment === "glosado" ? "default" : "outline"}
            size="sm"
            onClick={() => setSegment("glosado")}
          >
            Glosado
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Em Aberto</TableHead>
                <TableHead className="text-center">Idade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma pendência encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.slice(0, 50).map((item) => {
                  const config = STATUS_CONFIG[item.status];
                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {format(new Date(item.date), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>{item.unitLabel}</TableCell>
                      <TableCell>{item.sourceLabel}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.billedAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-warning">
                        {formatCurrency(item.openAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={item.ageInDays > 30 ? "destructive" : item.ageInDays > 15 ? "outline" : "secondary"}
                          className={item.ageInDays > 15 && item.ageInDays <= 30 ? "border-warning text-warning" : ""}
                        >
                          {item.ageInDays}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant as any}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewItem(item)}
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
          {filteredItems.length > 50 && (
            <div className="border-t p-2 text-center text-sm text-muted-foreground">
              Exibindo 50 de {filteredItems.length} itens
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhe da Pendência</SheetTitle>
            <SheetDescription>
              Visualize, anote e sugira match para este item
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="mt-6 space-y-6">
              {/* Item Info */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Faturamento
                </h4>
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span>{format(new Date(selectedItem.date), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unidade:</span>
                    <span>{selectedItem.unitLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Convênio:</span>
                    <span>{selectedItem.sourceLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descrição:</span>
                    <span className="text-right max-w-[200px]">{selectedItem.description}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Faturado:</span>
                    <span>{formatCurrency(selectedItem.billedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recebido:</span>
                    <span className="text-success">{formatCurrency(selectedItem.receivedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Glosado:</span>
                    <span className="text-destructive">{formatCurrency(selectedItem.glossedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Em Aberto:</span>
                    <span className="text-warning">{formatCurrency(selectedItem.openAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Match Suggestions */}
              {matchSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Sugestões de Match
                  </h4>
                  <div className="space-y-2">
                    {matchSuggestions.slice(0, 3).map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                        <Badge 
                          variant="outline"
                          className={
                            suggestion.confidence === "ALTA" ? "border-success text-success" : 
                            suggestion.confidence === "MEDIA" ? "border-warning text-warning" : ""
                          }
                        >
                          {suggestion.confidence}
                        </Badge>
                          <span className="text-xs text-muted-foreground">
                            Score: {suggestion.score}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {formatCurrency(suggestion.financialEntry.valor)} em {format(new Date(suggestion.financialEntry.data_prevista), "dd/MM/yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {suggestion.reasons.join(" • ")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Sugestões apenas — não altera dados de origem
                  </p>
                </div>
              )}

              {/* Status Control */}
              <div className="space-y-3">
                <h4 className="font-medium">Status Interno</h4>
                <Select
                  value={selectedItem.status}
                  onValueChange={(value) => handleSetStatus(value as ConciliationStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                    <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="DIVERGENTE">Divergente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Anotações
                </h4>
                {itemNotes.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {itemNotes.map(note => (
                      <div key={note.id} className="rounded border bg-muted/50 p-2 text-sm">
                        <div className="text-xs text-muted-foreground mb-1">
                          {note.createdBy} — {format(new Date(note.createdAt), "dd/MM HH:mm")}
                        </div>
                        {note.note}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Adicionar nota..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="flex-1"
                    rows={2}
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                >
                  Adicionar Nota
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
