import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Settings, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  HelpCircle,
  Info
} from "lucide-react";
import { formatUnitDisplayName, formatConvenioDisplayName } from "@/utils/formatters";
import type { ConciliationSettings as SettingsType, ConciliationItem, Divergence } from "@/hooks/useConciliation";

interface ConciliationSettingsProps {
  settings: SettingsType;
  onUpdateSettings: (updates: Partial<SettingsType>) => void;
  conciliationItems: ConciliationItem[];
  divergences: Divergence[];
}

interface AuditFinding {
  type: "label" | "integrity";
  severity: "info" | "warning" | "error";
  message: string;
  count: number;
  details?: string[];
}

export function ConciliationSettings({ 
  settings, 
  onUpdateSettings,
  conciliationItems,
  divergences
}: ConciliationSettingsProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  // Run audit checks - audit unitLabel/sourceLabel (display values)
  const labelFindings = useMemo((): AuditFinding[] => {
    const findings: AuditFinding[] = [];
    const underscorePattern = /_/;

    // Check for underscores in unitLabel (display value should NOT have underscores)
    const unitsWithUnderscores = conciliationItems
      .filter(item => underscorePattern.test(item.unitLabel))
      .map(item => item.unitLabel);
    
    const uniqueUnitsWithUnderscores = [...new Set(unitsWithUnderscores)];
    if (uniqueUnitsWithUnderscores.length > 0) {
      findings.push({
        type: "label",
        severity: "warning",
        message: "Unidades com underscore no label de exibição",
        count: uniqueUnitsWithUnderscores.length,
        details: uniqueUnitsWithUnderscores.slice(0, 5).map(u => `"${u}" → esperado sem underscore`),
      });
    }

    // Check for underscores in sourceLabel (display value should NOT have underscores)
    const conveniosWithUnderscores = conciliationItems
      .filter(item => underscorePattern.test(item.sourceLabel))
      .map(item => item.sourceLabel);
    
    const uniqueConveniosWithUnderscores = [...new Set(conveniosWithUnderscores)];
    if (uniqueConveniosWithUnderscores.length > 0) {
      findings.push({
        type: "label",
        severity: "warning",
        message: "Convênios com underscore no label de exibição",
        count: uniqueConveniosWithUnderscores.length,
        details: uniqueConveniosWithUnderscores.slice(0, 5).map(c => `"${c}" → esperado sem underscore`),
      });
    }

    return findings;
  }, [conciliationItems]);

  const integrityFindings = useMemo((): AuditFinding[] => {
    const findings: AuditFinding[] = [];

    // Items without unit
    const noUnit = conciliationItems.filter(i => !i.unitKey || i.unitKey.trim() === "");
    if (noUnit.length > 0) {
      findings.push({
        type: "integrity",
        severity: "warning",
        message: "Itens sem unidade definida",
        count: noUnit.length,
      });
    }

    // Items without convenio
    const noSource = conciliationItems.filter(i => !i.source || i.source.trim() === "");
    if (noSource.length > 0) {
      findings.push({
        type: "integrity",
        severity: "warning",
        message: "Itens sem convênio definido",
        count: noSource.length,
      });
    }

    // Zero or negative values
    const invalidValues = conciliationItems.filter(i => i.billedAmount <= 0);
    if (invalidValues.length > 0) {
      findings.push({
        type: "integrity",
        severity: "error",
        message: "Itens com valor faturado inválido (≤ 0)",
        count: invalidValues.length,
      });
    }

    // Orphan receivables (>60 days old)
    const oldOrphans = conciliationItems.filter(i => 
      i.status === "EM_ABERTO" && i.ageInDays > 60
    );
    if (oldOrphans.length > 0) {
      findings.push({
        type: "integrity",
        severity: "error",
        message: "Faturamentos em aberto há mais de 60 dias",
        count: oldOrphans.length,
      });
    }

    // Divergence summary
    const highSeverityDivs = divergences.filter(d => d.severity === "ALTA");
    if (highSeverityDivs.length > 0) {
      findings.push({
        type: "integrity",
        severity: "error",
        message: "Divergências de alta severidade não resolvidas",
        count: highSeverityDivs.length,
      });
    }

    return findings;
  }, [conciliationItems, divergences]);
  const allFindings = useMemo(() => [...labelFindings, ...integrityFindings], [labelFindings, integrityFindings]);

  const handleSettingChange = useCallback((key: keyof SettingsType, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    onUpdateSettings(localSettings);
    setHasChanges(false);
  }, [onUpdateSettings, localSettings]);

  const handleReset = useCallback(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Regras de Conciliação
          </CardTitle>
          <CardDescription>
            Configurações para o engine de sugestão de match
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateWindow">Janela de Data (dias)</Label>
              <Input
                id="dateWindow"
                type="number"
                min={1}
                max={30}
                value={localSettings.dateWindowDays}
                onChange={(e) => handleSettingChange("dateWindowDays", parseInt(e.target.value) || 3)}
              />
              <p className="text-xs text-muted-foreground">
                Tolerância de dias para considerar datas compatíveis
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueTolerance">Tolerância de Valor (R$)</Label>
              <Input
                id="valueTolerance"
                type="number"
                min={0}
                step={0.01}
                value={localSettings.valueToleranceAmount}
                onChange={(e) => handleSettingChange("valueToleranceAmount", parseFloat(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Diferença máxima em reais para considerar valores compatíveis
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueTolerancePercent">Tolerância de Valor (%)</Label>
              <Input
                id="valueTolerancePercent"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={localSettings.valueTolerancePercent}
                onChange={(e) => handleSettingChange("valueTolerancePercent", parseFloat(e.target.value) || 0.5)}
              />
              <p className="text-xs text-muted-foreground">
                Diferença percentual máxima
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Modo Conservador</Label>
                <p className="text-xs text-muted-foreground">
                  Sugere apenas matches de alta confiança
                </p>
              </div>
              <Switch
                checked={localSettings.conservativeMode}
                onCheckedChange={(checked) => handleSettingChange("conservativeMode", checked)}
              />
            </div>
          </div>

          {hasChanges && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar Configurações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auditoria
          </CardTitle>
          <CardDescription>
            Verificações automáticas de labels e integridade dos dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {allFindings.filter(f => f.severity === "error").length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {allFindings.filter(f => f.severity === "error").length} erros
              </Badge>
            )}
            {allFindings.filter(f => f.severity === "warning").length > 0 && (
              <Badge variant="outline" className="border-warning text-warning gap-1">
                <FileWarning className="h-3 w-3" />
                {allFindings.filter(f => f.severity === "warning").length} avisos
              </Badge>
            )}
            {allFindings.length === 0 && (
              <Badge variant="outline" className="border-success text-success gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Nenhum problema detectado
              </Badge>
            )}
          </div>

          <Accordion type="multiple" className="w-full">
            {/* Label Audit */}
            <AccordionItem value="labels">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Auditoria de Labels
                  {labelFindings.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {labelFindings.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {labelFindings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    ✓ Nenhum slug ou underscore detectado nos labels
                  </p>
                ) : (
                  <div className="space-y-3">
                    {labelFindings.map((finding, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={finding.severity === "error" ? "destructive" : "outline"}
                            className={finding.severity === "warning" ? "border-warning text-warning" : ""}
                          >
                            {finding.count}
                          </Badge>
                          <span className="text-sm font-medium">{finding.message}</span>
                        </div>
                        {finding.details && (
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            {finding.details.map((detail, i) => (
                              <li key={i}>• {detail}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Os labels são automaticamente formatados na exibição. Dados de origem não são alterados.
                    </p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Integrity Audit */}
            <AccordionItem value="integrity">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Auditoria de Integridade
                  {integrityFindings.length > 0 && (
                    <Badge 
                      variant={integrityFindings.some(f => f.severity === "error") ? "destructive" : "secondary"} 
                      className="ml-2"
                    >
                      {integrityFindings.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {integrityFindings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    ✓ Todos os dados passaram nas verificações de integridade
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Problema</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrityFindings.map((finding, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge 
                              variant={finding.severity === "error" ? "destructive" : "outline"}
                              className={finding.severity === "warning" ? "border-warning text-warning" : ""}
                            >
                              {finding.severity === "error" ? "ERRO" : "AVISO"}
                            </Badge>
                          </TableCell>
                          <TableCell>{finding.message}</TableCell>
                          <TableCell className="text-right font-medium">
                            {finding.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Guia Rápido — Fluxo Diário Recomendado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <div>
                <strong>Filtrar período</strong>
                <p className="text-muted-foreground">Selecione o mês ou semana de referência nos filtros</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <div>
                <strong>Ver Críticos &gt; 15 dias</strong>
                <p className="text-muted-foreground">Priorize pendências antigas com maior impacto no caixa</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <div>
                <strong>Abrir item, registrar nota</strong>
                <p className="text-muted-foreground">Documente ações tomadas e próximos passos</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
              <div>
                <strong>Sugerir/confirmar match</strong>
                <p className="text-muted-foreground">Quando houver recebimento candidato, valide a sugestão</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">5</span>
              <div>
                <strong>Exportar pendências do dia</strong>
                <p className="text-muted-foreground">Gere relatório para cobrança ou análise externa</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
