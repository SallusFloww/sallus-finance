import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  Filter,
  RefreshCcw,
  TrendingUp,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  TriangleAlert,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * BI v2 — PowerBI-like (layout e interação)
 * - 1 linha de filtros
 * - 6 KPIs com variação
 * - 2 linhas de visuais (macro + drivers)
 *
 * Obs: Aqui está pronto para plugar seus dados reais.
 * Hoje ele roda com mock para você ver “cara de Power BI” já.
 */

type PeriodPreset = "MES_ATUAL" | "3M" | "6M" | "12M" | "CUSTOM";

type Filters = {
  preset: PeriodPreset;
  dateLabel: string; // simplificado por enquanto
  unit: string;
  payer: string;
  specialty: string;
};

type Kpi = {
  key: string;
  title: string;
  value: string;
  deltaPct: number; // +/-
  hint?: string;
  icon: React.ReactNode;
};

function Delta({ pct }: { pct: number }) {
  const isUp = pct >= 0;
  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", isUp ? "text-emerald-600" : "text-red-600")}>
      {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      <span>{Math.abs(pct).toFixed(1)}%</span>
      <span className="text-muted-foreground font-normal">vs período anterior</span>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}

export default function BIV2() {
  // -----------------------------
  // filtros (cross-filter core)
  // -----------------------------
  const [filters, setFilters] = useState<Filters>({
    preset: "MES_ATUAL",
    dateLabel: "01/01/26 - 31/01/26",
    unit: "Todas Unidades",
    payer: "Todos Pagadores",
    specialty: "Todas Especialidades",
  });

  const [activeChips, setActiveChips] = useState<Record<string, string>>({});

  const resetAll = () => {
    setFilters({
      preset: "MES_ATUAL",
      dateLabel: "01/01/26 - 31/01/26",
      unit: "Todas Unidades",
      payer: "Todos Pagadores",
      specialty: "Todas Especialidades",
    });
    setActiveChips({});
  };

  // -----------------------------
  // dados (mock) — plugar real depois
  // -----------------------------
  const kpis: Kpi[] = useMemo(
    () => [
      {
        key: "saldo",
        title: "Saldo (Caixa)",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Base Caixa",
        icon: <Wallet className="h-4 w-4 text-muted-foreground" />,
      },
      {
        key: "recebido",
        title: "Receita (Recebido)",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Recebimentos",
        icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      },
      {
        key: "producao",
        title: "Produção",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Competência",
        icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
      },
      {
        key: "faturado",
        title: "Faturado",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Competência",
        icon: <Receipt className="h-4 w-4 text-muted-foreground" />,
      },
      {
        key: "saidas",
        title: "Saídas (Pagas)",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Caixa",
        icon: <Receipt className="h-4 w-4 text-muted-foreground" />,
      },
      {
        key: "margem",
        title: "Resultado",
        value: "R$ 0,00",
        deltaPct: 0,
        hint: "Operacional",
        icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      },
    ],
    [],
  );

  // Exemplo de “cross-filter”: clique em blocos para adicionar chip de filtro
  const applyChip = (key: string, value: string) => {
    setActiveChips((prev) => ({ ...prev, [key]: value }));
  };

  const removeChip = (key: string) => {
    setActiveChips((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // -----------------------------
  // render
  // -----------------------------
  const hasData = false; // quando plugar real, vira (kpis etc) > 0
  const chipsEntries = Object.entries(activeChips);

  return (
    <div className="space-y-4">
      {/* Header do BI v2 */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">BI — Executivo (PowerBI-like)</h1>
            <Badge variant="secondary" className="text-[10px]">
              BETA
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Painel integrado com cross-filter • 1 tela • foco em decisão (menos enfeite, mais leitura).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Somente leitura</Badge>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Resetar
          </Button>
        </div>
      </div>

      {/* Barra única de filtros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filtros
            <span className="text-xs text-muted-foreground font-normal">• Dados consolidados até: 19/01 01:42</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Presets + período */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border bg-muted/20 p-1">
              {[
                { key: "MES_ATUAL", label: "Mês atual" },
                { key: "3M", label: "3 meses" },
                { key: "6M", label: "6 meses" },
                { key: "12M", label: "12 meses" },
              ].map((p) => {
                const active = filters.preset === (p.key as PeriodPreset);
                return (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className="h-8"
                    onClick={() => setFilters((prev) => ({ ...prev, preset: p.key as PeriodPreset }))}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>

            <Separator orientation="vertical" className="h-8" />

            <Button variant="outline" size="sm" className="h-8">
              <Calendar className="mr-2 h-4 w-4" />
              {filters.dateLabel}
            </Button>

            <Separator orientation="vertical" className="h-8" />

            {/* “Fake selects” por enquanto — você pluga nos selects reais depois */}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() =>
                setFilters((p) => ({ ...p, unit: p.unit === "Todas Unidades" ? "Oncologia" : "Todas Unidades" }))
              }
            >
              {filters.unit}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() =>
                setFilters((p) => ({ ...p, payer: p.payer === "Todos Pagadores" ? "Unimed" : "Todos Pagadores" }))
              }
            >
              {filters.payer}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  specialty: p.specialty === "Todas Especialidades" ? "Oncologia" : "Todas Especialidades",
                }))
              }
            >
              {filters.specialty}
            </Button>
          </div>

          {/* Chips ativos (cross-filter) */}
          {chipsEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {chipsEntries.map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => removeChip(k)}
                  className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted/30"
                  title="Clique para remover"
                >
                  <span className="text-muted-foreground">{k}:</span>
                  <span className="font-medium">{v}</span>
                  <span className="text-muted-foreground">✕</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas inteligentes (compacto, sem poluição) */}
      {!hasData && (
        <Card className="border-amber-200/60 bg-amber-50/40">
          <CardContent className="flex items-start gap-3 py-4">
            <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-900">Dados insuficientes no período</div>
              <div className="text-xs text-amber-900/70">
                Ajuste o período (3/6/12 meses) ou aguarde consolidação. O BI v2 evita “cartões vazios” espalhados.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs (máximo 6, estilo Power BI) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card
            key={k.key}
            className="cursor-pointer hover:shadow-sm transition"
            onClick={() => applyChip("kpi", k.title)}
            title="Clique para aplicar filtro (demo)"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground">{k.title}</CardTitle>
                {k.icon}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">{k.value}</div>
              <Delta pct={k.deltaPct} />
              {k.hint && <div className="text-[10px] text-muted-foreground">{k.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visuais principais (PowerBI-like) */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução do Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-[260px]"> {/* aqui entra o gráfico real */}</div>
            ) : (
              <EmptyState
                title="Sem dados para plotar o período"
                subtitle="Quando plugar os dados reais, este bloco vira o gráfico principal do caixa (linha/área)."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Funil: Produção → Faturado → Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-[260px]" />
            ) : (
              <EmptyState
                title="Sem dados no período"
                subtitle="Este bloco vira um funil em barras para entender gargalo (produção vs faturado vs recebido)."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Pagadores / Convênios</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-[260px]" />
            ) : (
              <EmptyState
                title="Sem dados para ranking"
                subtitle="Vira barras horizontais com cross-filter (clicou no convênio, tudo filtra)."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Categorias de Saída</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-[260px]" />
            ) : (
              <EmptyState
                title="Sem dados para despesas"
                subtitle="Vira barras horizontais por categoria de saída (DRE/contas)."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Aging — Recebíveis por Faixa</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-[260px]" />
            ) : (
              <EmptyState
                title="Sem dados de aging"
                subtitle="Vira colunas por faixa (0-30, 31-60, 61-90, 90+), com drill."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
