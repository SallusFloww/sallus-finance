import { format } from "date-fns";
import { Download, FileSpreadsheet, FileText, CheckCircle2, CalendarIcon, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/formatters";

interface ReportExportsProps {
  exportCSV: () => void;
  exportPDF: () => void;
  exportBackup: () => void;
  dateRange: { start: Date; end: Date };
  userName: string;
}

export function ReportExports({ exportCSV, exportPDF, exportBackup, dateRange, userName }: ReportExportsProps) {
  return (
    <>
      {/* Fechamento */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Fechamento do Relatório
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Status do Relatório</p>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Caixa conciliado</span>
              </div>
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Valores realizados</span>
              </div>
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Sem previsões</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>Período: {formatDate(dateRange.start.toISOString())} a {formatDate(dateRange.end.toISOString())}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Usuário: {userName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button variant="outline" onClick={exportCSV} className="h-auto flex-col gap-2 p-6">
          <FileSpreadsheet className="h-8 w-8 text-success" />
          <span className="font-semibold">Exportar CSV</span>
          <span className="text-xs text-muted-foreground">Dados brutos para análise contábil</span>
        </Button>

        <Button variant="outline" onClick={exportPDF} className="h-auto flex-col gap-2 p-6">
          <FileText className="h-8 w-8 text-primary" />
          <span className="font-semibold">Gerar Relatório PDF</span>
          <span className="text-xs text-muted-foreground">Relatório gerencial completo</span>
        </Button>

        <Button variant="outline" onClick={exportBackup} className="h-auto flex-col gap-2 p-6">
          <Download className="h-8 w-8 text-warning" />
          <span className="font-semibold">Backup Completo</span>
          <span className="text-xs text-muted-foreground">Arquivo JSON com todos os dados</span>
        </Button>
      </div>
    </>
  );
}
