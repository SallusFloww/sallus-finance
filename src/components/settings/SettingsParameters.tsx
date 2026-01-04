import { useState } from "react";
import {
  Settings2,
  Info,
  AlertTriangle,
  Clock,
  Calendar,
  Trash2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { SystemParameters } from "@/types";

interface SettingsParametersProps {
  parameters: SystemParameters;
  onUpdate: (params: SystemParameters) => void;
  onAddLog: (action: string, details: string) => void;
  userName: string;
}

const DEFAULT_PARAMETERS: SystemParameters = {
  daysForBillingAlert: 15,
  allowFutureCompetence: false,
  allowPhysicalDeletion: false,
  criticalActionConfirmation: "SIMPLE",
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help inline-flex">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function SettingsParameters({
  parameters,
  onUpdate,
  onAddLog,
  userName,
}: SettingsParametersProps) {
  const params = { ...DEFAULT_PARAMETERS, ...parameters };
  
  const [localParams, setLocalParams] = useState(params);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = <K extends keyof SystemParameters>(
    key: K,
    value: SystemParameters[K]
  ) => {
    setLocalParams((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updated: SystemParameters = {
      ...localParams,
      updatedAt: new Date().toISOString(),
      updatedBy: userName,
    };
    onUpdate(updated);
    onAddLog("UPDATE_SETTINGS", "Parâmetros do sistema atualizados");
    setHasChanges(false);
    toast.success("Parâmetros salvos!");
  };

  const handleReset = () => {
    setLocalParams(params);
    setHasChanges(false);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Parâmetros do Sistema
            </CardTitle>
            <CardDescription>
              Configurações globais do sistema
            </CardDescription>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleReset}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave}>
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning banner */}
          <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Alterações afetam apenas eventos futuros. Registros existentes não são modificados.
            </p>
          </div>

          {/* Days for billing alert */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Dias para alerta de produção sem faturamento</Label>
                <InfoTooltip text="Produções que ultrapassarem este prazo sem faturamento serão destacadas como 'Atenção' ou 'Crítico'" />
              </div>
              <p className="text-xs text-muted-foreground">
                Produção sem faturamento após este período receberá alerta visual
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                value={localParams.daysForBillingAlert}
                onChange={(e) => handleChange("daysForBillingAlert", parseInt(e.target.value) || 15)}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>

          {/* Allow future competence */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Permitir competência futura</Label>
                <InfoTooltip text="Se ativado, permite registrar produções com competência de meses futuros" />
              </div>
              <p className="text-xs text-muted-foreground">
                Habilita lançamento de produção para competências futuras
              </p>
            </div>
            <Switch
              checked={localParams.allowFutureCompetence}
              onCheckedChange={(c) => handleChange("allowFutureCompetence", c)}
            />
          </div>

          {/* Allow physical deletion */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Trash2 className="h-4 w-4 text-destructive" />
                <Label className="font-medium">Permitir exclusão física de registros</Label>
                <InfoTooltip text="⚠️ RISCO: Se ativado, registros podem ser permanentemente excluídos ao invés de apenas cancelados/inativados" />
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive font-medium">Não recomendado.</span>{" "}
                Prefira cancelamento/inativação para manter histórico
              </p>
            </div>
            <Switch
              checked={localParams.allowPhysicalDeletion}
              onCheckedChange={(c) => handleChange("allowPhysicalDeletion", c)}
            />
          </div>

          {/* Critical action confirmation */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Tipo de confirmação para ações críticas</Label>
                <InfoTooltip text="Define o nível de confirmação exigido para ações como exclusão e cancelamento" />
              </div>
              <p className="text-xs text-muted-foreground">
                Confirmação reforçada exige digitação de texto para confirmar
              </p>
            </div>
            <Select
              value={localParams.criticalActionConfirmation}
              onValueChange={(v) => handleChange("criticalActionConfirmation", v as "SIMPLE" | "REINFORCED")}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLE">Simples</SelectItem>
                <SelectItem value="REINFORCED">Reforçada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Last update info */}
          {params.updatedAt && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Última atualização: {new Date(params.updatedAt).toLocaleString("pt-BR")}
                {params.updatedBy && ` por ${params.updatedBy}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
