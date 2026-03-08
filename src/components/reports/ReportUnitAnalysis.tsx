import { FileBarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { UnitAnalysisItem } from "./types";

interface ReportUnitAnalysisProps {
  unitAnalysisDetailed: UnitAnalysisItem[];
  directorMode: boolean;
  getUnitExecutiveSummary: (unit: UnitAnalysisItem) => string;
  getParticipationTag: (percentage: number) => { label: string; color: string };
}

export function ReportUnitAnalysis({
  unitAnalysisDetailed,
  directorMode,
  getUnitExecutiveSummary,
  getParticipationTag,
}: ReportUnitAnalysisProps) {
  if (directorMode) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileBarChart className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Análise por Unidade (Detalhada)</h3>
      </div>
      <div className="space-y-6">
        {unitAnalysisDetailed.map((u) => (
          <div key={u.unit} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-lg text-foreground">{u.name}</h4>
              <span className={cn(
                "text-sm font-semibold px-2 py-1 rounded",
                u.netBalance >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                Saldo: {formatCurrency(u.netBalance)}
              </span>
            </div>

            <div className="mb-4 p-2 rounded bg-primary/5 border-l-2 border-primary">
              <p className="text-xs text-foreground italic">{getUnitExecutiveSummary(u)}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-2 rounded bg-success/10">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="text-sm font-bold text-success">{formatCurrency(u.totalIncome)}</p>
              </div>
              <div className="text-center p-2 rounded bg-destructive/10">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="text-sm font-bold text-destructive">{formatCurrency(u.totalExpense)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Particular</p>
                <p className="text-sm font-bold text-foreground">{u.particular.percentage.toFixed(1)}%</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Convênios</p>
                <p className="text-sm font-bold text-foreground">{u.convenio.percentage.toFixed(1)}%</p>
              </div>
            </div>

            {/* Specialties for Centro Clínico */}
            {u.unit === "CENTRO_CLINICO" && u.specialties && (
              <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-semibold text-primary mb-3">📋 Detalhamento por Especialidade</p>
                <div className="space-y-3">
                  {u.specialties.map((spec) => (
                    <div
                      key={spec.specialty}
                      className={cn(
                        "p-3 rounded border",
                        spec.hasMovement
                          ? "bg-card border-border/50"
                          : "bg-muted/20 border-dashed border-muted-foreground/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium text-sm",
                            spec.hasMovement ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {spec.name}
                          </span>
                          {(() => {
                            const tag = getParticipationTag(spec.percentage);
                            return (
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", tag.color)}>
                                {tag.label}
                              </span>
                            );
                          })()}
                          {!spec.hasMovement && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Sem movimentação no período
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded",
                            !spec.hasMovement
                              ? "bg-muted text-muted-foreground"
                              : spec.netBalance >= 0
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                          )}>
                            {spec.hasMovement ? (spec.netBalance < 0 ? "Saldo negativo: " : "") : ""}
                            {formatCurrency(spec.netBalance)}
                          </span>
                          {spec.netBalance < 0 && u.netBalance >= 0 && spec.hasMovement && (
                            <span className="text-[9px] text-muted-foreground italic">
                              Compensado por outras especialidades
                            </span>
                          )}
                        </div>
                      </div>

                      {spec.hasMovement ? (
                        <>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Entradas</p>
                              <p className="font-semibold text-success">{formatCurrency(spec.totalIncome)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Saídas</p>
                              <p className="font-semibold text-destructive">{formatCurrency(spec.totalExpense)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ticket Médio</p>
                              <p className="font-semibold text-foreground">{formatCurrency(spec.avgTicket)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">% da Unidade</p>
                              <p className="font-semibold text-foreground">{spec.percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                          {spec.categories.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground mb-1">Categorias:</p>
                              <div className="flex flex-wrap gap-1">
                                {spec.categories.slice(0, 3).map((cat) => (
                                  <span key={cat.category} className="text-xs bg-muted px-2 py-0.5 rounded">
                                    {cat.categoryName}: {formatCurrency(cat.value)} ({cat.percentage.toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                          <div><p>Entradas</p><p className="font-semibold">R$ 0,00</p></div>
                          <div><p>Saídas</p><p className="font-semibold">R$ 0,00</p></div>
                          <div><p>Ticket Médio</p><p className="font-semibold">R$ 0,00</p></div>
                          <div><p>% da Unidade</p><p className="font-semibold">0%</p></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {u.categories.length > 0 && (
              <div className="mt-3 p-3 rounded bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top 5 categorias da unidade</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left text-muted-foreground font-medium">Categoria</th>
                        <th className="pb-2 text-right text-muted-foreground font-medium">Valor</th>
                        <th className="pb-2 text-right text-muted-foreground font-medium">%</th>
                        <th className="pb-2 text-right text-muted-foreground font-medium">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.categories.slice(0, 5).map((cat) => (
                        <tr key={cat.category} className="border-b border-border/50 last:border-0">
                          <td className="py-2 text-foreground">{cat.categoryName}</td>
                          <td className="py-2 text-right text-success">{formatCurrency(cat.value)}</td>
                          <td className="py-2 text-right text-muted-foreground">{cat.percentage.toFixed(1)}%</td>
                          <td className="py-2 text-right text-foreground">{formatCurrency(cat.avgTicket || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
