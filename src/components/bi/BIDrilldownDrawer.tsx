import * as React from "react";
import { X, ExternalLink, ArrowRight, Search, Download, Copy, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader as THeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

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

/**
 * ✅ BIDrilldownDrawer — Power BI Premium Table
 * - Pesquisa instantânea (Ctrl/Cmd + F foca)
 * - Ordenação clicável por Valor / Data / Dias
 * - Header sticky + scroll confortável
 * - Ações rápidas: Aplicar filtro, Copiar, Exportar CSV
 * - KPIs rápidos no topo (Total, Itens, Média)
 */
export function BIDrilldownDrawer({ data, isLoading }: BIDrilldownDrawerProps) {
  const { drilldownContext, closeDrilldown, setFilter } = useBIFilters();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement | null>(null);

  type SortKey = "value" | "date" | "daysOpen" | "description";
  const [sortKey, setSortKey] = React.useState<SortKey>("value");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const [page, setPage] = React.useState(1);
  const pageSize = 50;

  React.useEffect(() => {
    // reset paging on new drilldown
    setPage(1);
    setQuery("");
    setSortKey("value");
    setSortDir("desc");
  }, [drilldownContext?.title]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!drilldownContext) return;

      // ESC fecha
      if (e.key === "Escape") {
        closeDrilldown();
        return;
      }

      // Ctrl/Cmd + F foca busca
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (metaOrCtrl && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrilldown, drilldownContext]);

  if (!drilldownContext) return null;

  const navigationLinks = getNavigationLinks(drilldownContext);

  const totalValue = React.useMemo(() => data.reduce((sum, row) => sum + (row.value || 0), 0), [data]);
  const avgValue = React.useMemo(() => (data.length ? totalValue / data.length : 0), [data.length, totalValue]);

  const columns = React.useMemo(() => {
    const hasDate = data.some((r) => !!r.date);
    const hasUnit = data.some((r) => !!r.unit);
    const hasPayer = data.some((r) => !!r.payer);
    const hasDays = data.some((r) => r.daysOpen !== undefined);
    return { hasDate, hasUnit, hasPayer, hasDays };
  }, [data]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((r) => {
      const hay = [r.description, r.unit, r.payer, r.status, r.date, String(r.value ?? ""), String(r.daysOpen ?? "")]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [data, query]);

  const sortValue = React.useCallback(
    (a: DrilldownRow, b: DrilldownRow) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "value") return (a.value - b.value) * dir;

      if (sortKey === "daysOpen") return ((a.daysOpen ?? -1) - (b.daysOpen ?? -1)) * dir;

      if (sortKey === "description") {
        return (a.description || "").localeCompare(b.description || "") * dir;
      }

      if (sortKey === "date") {
        // tenta ISO, depois dd/MM/yyyy
        const parse = (d?: string) => {
          if (!d) return 0;
          const iso = Date.parse(d);
          if (!Number.isNaN(iso)) return iso;
          const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (m) {
            const dd = Number(m[1]);
            const mm = Number(m[2]) - 1;
            const yy = Number(m[3]);
            return new Date(yy, mm, dd).getTime();
          }
          return 0;
        };
        return (parse(a.date) - parse(b.date)) * dir;
      }

      return 0;
    },
    [sortDir, sortKey],
  );

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort(sortValue);
    return arr;
  }, [filtered, sortValue]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = React.useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [pageSafe, sorted]);

  const handleNavigate = (path: string) => {
    closeDrilldown();
    navigate(path);
  };

  const handleApplyFilter = () => {
    if (drilldownContext.filters) {
      Object.entries(drilldownContext.filters).forEach(([key, value]) => {
        if (value !== undefined) setFilter(key as any, value);
      });
    }
    closeDrilldown();

    toast({
      title: "Filtro aplicado",
      description: "Seleção aplicada no BI (Power BI Mode).",
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const copyVisible = async () => {
    try {
      const lines = paged.map((r) => {
        const parts = [
          r.description ?? "",
          r.date ?? "",
          r.unit ?? "",
          r.payer ?? "",
          r.daysOpen !== undefined ? String(r.daysOpen) : "",
          String(r.value ?? 0),
        ];
        return parts.join("\t");
      });
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Copiado", description: "Tabela visível copiada (TSV)." });
    } catch {
      toast({ title: "Falhou", description: "Não consegui copiar. Tente novamente.", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    const header = ["Descrição", "Data", "Unidade", "Pagador", "Dias", "Valor"];
    const rows = sorted.map((r) => [
      safeCsv(r.description),
      safeCsv(r.date),
      safeCsv(r.unit),
      safeCsv(r.payer),
      r.daysOpen !== undefined ? String(r.daysOpen) : "",
      String(r.value ?? 0),
    ]);

    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `drilldown_${slugify(drilldownContext.type)}.csv`;
    a.click();

    URL.revokeObjectURL(url);

    toast({ title: "Exportado", description: "CSV gerado com sucesso." });
  };

  const visibleCountLabel = `${filtered.length.toLocaleString("pt-BR")} itens`;

  return (
    <Sheet open={!!drilldownContext} onOpenChange={() => closeDrilldown()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border bg-white">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <SheetTitle className="text-lg leading-tight">{drilldownContext.title}</SheetTitle>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {drilldownContext.value}
                  </Badge>

                  <span className="text-xs text-muted-foreground">
                    {visibleCountLabel} • Total: <b className="text-foreground">{formatCurrency(totalValue)}</b> •
                    Média: <b className="text-foreground">{formatCurrency(avgValue)}</b>
                  </span>
                </div>
              </div>

              <Button variant="ghost" size="icon" onClick={closeDrilldown} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="default" size="sm" onClick={handleApplyFilter} className="text-xs h-8">
              Aplicar como filtro
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>

            <Button variant="outline" size="sm" onClick={copyVisible} className="text-xs h-8">
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>

            <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs h-8">
              <Download className="h-3.5 w-3.5 mr-1" />
              Exportar CSV
            </Button>

            {navigationLinks.map((link) => (
              <Button
                key={link.path}
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate(link.path)}
                className="text-xs h-8"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {link.label}
              </Button>
            ))}
          </div>

          <Separator className="mt-4" />

          {/* Search + sort info */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar (descrição, pagador, unidade...)"
                className="pl-9 h-9"
              />
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Ordenação: {labelSort(sortKey)} • {sortDir === "asc" ? "↑" : "↓"}
              </Badge>
              <span>Ctrl/Cmd + F • ESC fecha</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="h-[70vh] bg-white">
          <div className="px-5 py-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Nenhum registro encontrado</div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <THeader className="sticky top-0 z-10 bg-white">
                    <TableRow className="hover:bg-white">
                      <TableHead className="text-xs">
                        <HeaderSortButton
                          active={sortKey === "description"}
                          dir={sortDir}
                          onClick={() => toggleSort("description")}
                        >
                          Descrição
                        </HeaderSortButton>
                      </TableHead>

                      {columns.hasDate && (
                        <TableHead className="text-xs">
                          <HeaderSortButton
                            active={sortKey === "date"}
                            dir={sortDir}
                            onClick={() => toggleSort("date")}
                          >
                            Data
                          </HeaderSortButton>
                        </TableHead>
                      )}

                      {columns.hasUnit && <TableHead className="text-xs">Unidade</TableHead>}
                      {columns.hasPayer && <TableHead className="text-xs">Pagador</TableHead>}

                      {columns.hasDays && (
                        <TableHead className="text-xs">
                          <HeaderSortButton
                            active={sortKey === "daysOpen"}
                            dir={sortDir}
                            onClick={() => toggleSort("daysOpen")}
                          >
                            Dias
                          </HeaderSortButton>
                        </TableHead>
                      )}

                      <TableHead className="text-xs text-right">
                        <HeaderSortButton
                          active={sortKey === "value"}
                          dir={sortDir}
                          onClick={() => toggleSort("value")}
                          align="right"
                        >
                          Valor
                        </HeaderSortButton>
                      </TableHead>
                    </TableRow>
                  </THeader>

                  <TableBody>
                    {paged.map((row) => (
                      <TableRow key={row.id} className={cn("hover:bg-muted/40 transition-colors")}>
                        <TableCell className="text-xs font-medium max-w-[320px] truncate">{row.description}</TableCell>

                        {columns.hasDate && (
                          <TableCell className="text-xs text-muted-foreground">{row.date ?? "—"}</TableCell>
                        )}

                        {columns.hasUnit && <TableCell className="text-xs">{row.unit ?? "—"}</TableCell>}

                        {columns.hasPayer && <TableCell className="text-xs">{row.payer ?? "—"}</TableCell>}

                        {columns.hasDays && (
                          <TableCell className="text-xs">
                            {row.daysOpen !== undefined ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] rounded-full px-2",
                                  row.daysOpen > 90 && "border-red-500 text-red-600",
                                  row.daysOpen > 60 && row.daysOpen <= 90 && "border-orange-500 text-orange-600",
                                  row.daysOpen > 30 && row.daysOpen <= 60 && "border-yellow-500 text-yellow-700",
                                )}
                              >
                                {row.daysOpen}d
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}

                        <TableCell className="text-xs text-right font-semibold">{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && sorted.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Página <b className="text-foreground">{pageSafe}</b> de{" "}
                  <b className="text-foreground">{totalPages}</b> • Exibindo{" "}
                  <b className="text-foreground">{paged.length}</b> de{" "}
                  <b className="text-foreground">{sorted.length}</b>
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageSafe >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function HeaderSortButton(props: {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const { children, active, dir, onClick, align = "left" } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        align === "right" && "ml-auto",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      title="Ordenar"
    >
      {children}
      <ArrowUpDown className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-60")} />
      {active && <span className="text-[10px] opacity-70">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

function labelSort(key: "value" | "date" | "daysOpen" | "description") {
  switch (key) {
    case "value":
      return "Valor";
    case "date":
      return "Data";
    case "daysOpen":
      return "Dias";
    case "description":
      return "Descrição";
    default:
      return "—";
  }
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
      return [{ label: "Ir para Transações", path: "/transactions" }];
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

function safeCsv(value?: string) {
  const v = value ?? "";
  // escapa aspas e quebra de linha
  const escaped = v.replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${escaped}"`;
}

function slugify(v: string) {
  return (v || "drilldown")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
