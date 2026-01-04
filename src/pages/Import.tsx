import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/utils/formatters";
import { UNIT_LABELS, STATUS_LABELS } from "@/utils/constants";
import { Transaction, TransactionStatus, PaymentMethod, FinancialCategory } from "@/types";
import { toast } from "sonner";

type ColumnMapping = {
  date: string;
  type: string;
  amount: string;
  unit: string;
  category: string;
  paymentMethod: string;
  status: string;
  reference: string;
  notes: string;
};

export default function Import() {
  const { transactions, auditLog } = useApp();
  const { importTransactions } = transactions;
  const { logAction } = auditLog;
  
  // Compatibilidade com código legado
  const user = { name: "Sistema" };
  const addAuditLog = (_action: string, _details: string, _meta?: unknown) => {};

  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [preview, setPreview] = useState<Partial<Transaction>[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());
      const parsed = lines.map((line) => {
        const cells: string[] = [];
        let current = "";
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if ((char === "," || char === ";") && !inQuotes) {
            cells.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        cells.push(current.trim());
        return cells;
      });

      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setCsvData(parsed.slice(1));
        setStep("map");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleMapColumn = (field: keyof ColumnMapping, column: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: column === "none" ? undefined : column,
    }));
  };

  const processPreview = () => {
    const previewData: Partial<Transaction>[] = csvData.slice(0, 10).map((row) => {
      const getCell = (field: keyof ColumnMapping) => {
        const colName = columnMapping[field];
        if (!colName) return undefined;
        const index = headers.indexOf(colName);
        return index >= 0 ? row[index] : undefined;
      };

      const typeRaw = getCell("type")?.toUpperCase() || "";
      const type: "INCOME" | "EXPENSE" = typeRaw.includes("ENTRADA") || typeRaw.includes("INCOME") || typeRaw.includes("RECEITA")
        ? "INCOME"
        : "EXPENSE";

      const amountRaw = getCell("amount") || "0";
      const amount = parseFloat(amountRaw.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;

      return {
        date: getCell("date") || new Date().toISOString(),
        type,
        amount: Math.abs(amount),
        financialCategory: "OPERACIONAL" as const, // Default para importações
        unit: getCell("unit") || "ONCOLOGIA",
        category: getCell("category") || "Outros",
        paymentMethod: (getCell("paymentMethod")?.toUpperCase() || "PIX") as PaymentMethod,
        status: "REALIZADO" as TransactionStatus,
        reference: getCell("reference"),
        notes: getCell("notes"),
        createdBy: user?.name || "Importação",
      };
    });

    setPreview(previewData);
    setStep("preview");
  };

  const handleImport = () => {
    const allData = csvData.map((row) => {
      const getCell = (field: keyof ColumnMapping) => {
        const colName = columnMapping[field];
        if (!colName) return undefined;
        const index = headers.indexOf(colName);
        return index >= 0 ? row[index] : undefined;
      };

      const typeRaw = getCell("type")?.toUpperCase() || "";
      const type: "INCOME" | "EXPENSE" = typeRaw.includes("ENTRADA") || typeRaw.includes("INCOME") || typeRaw.includes("RECEITA")
        ? "INCOME"
        : "EXPENSE";

      const amountRaw = getCell("amount") || "0";
      const amount = parseFloat(amountRaw.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;

      return {
        date: getCell("date") || new Date().toISOString(),
        type,
        amount: Math.abs(amount),
        financialCategory: "OPERACIONAL" as const, // Default para importações
        unit: getCell("unit") || "ONCOLOGIA",
        category: getCell("category") || "Outros",
        paymentMethod: (getCell("paymentMethod")?.toUpperCase() || "PIX") as PaymentMethod,
        status: "REALIZADO" as TransactionStatus,
        reference: getCell("reference"),
        notes: getCell("notes"),
        createdBy: user?.name || "Importação",
      };
    });

    const count = importTransactions(allData);
    addAuditLog("IMPORT_DATA", `${count} movimentações importadas via CSV`);
    toast.success(`${count} movimentações importadas com sucesso!`);
    setStep("done");
  };

  const downloadTemplate = () => {
    const template = `Data,Tipo,Valor,Unidade,Categoria,Forma Pagamento,Status,Referência,Observações
2024-01-15,ENTRADA,1500.00,ONCOLOGY,Consultas,PIX,CONFIRMED,NF-001,Consulta particular
2024-01-16,SAIDA,500.00,CLINIC,Materiais/Insumos,TRANSFER,CONFIRMED,NF-002,Material cirúrgico`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_sallusflow.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredFields: (keyof ColumnMapping)[] = ["date", "type", "amount", "category"];
  const optionalFields: (keyof ColumnMapping)[] = ["unit", "paymentMethod", "status", "reference", "notes"];
  const fieldLabels: Record<keyof ColumnMapping, string> = {
    date: "Data",
    type: "Tipo (Entrada/Saída)",
    amount: "Valor",
    unit: "Unidade",
    category: "Categoria",
    paymentMethod: "Forma de Pagamento",
    status: "Status",
    reference: "Referência",
    notes: "Observações",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Importar Dados</h1>
            <p className="text-sm text-muted-foreground">
              Importe movimentações a partir de arquivos CSV
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar Template
          </Button>
        </div>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-12">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Selecione um arquivo CSV
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Arraste ou clique para selecionar
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mt-4 cursor-pointer text-sm"
            />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">
                Mapeamento de Colunas
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Associe as colunas do seu arquivo aos campos do sistema
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                {[...requiredFields, ...optionalFields].map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="min-w-[140px] text-sm font-medium text-foreground">
                      {fieldLabels[field]}
                      {requiredFields.includes(field) && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </label>
                    <Select
                      value={columnMapping[field] || "none"}
                      onValueChange={(v) => handleMapColumn(field, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                onClick={processPreview}
                disabled={!requiredFields.every((f) => columnMapping[f])}
                className="gradient-primary"
              >
                Pré-visualizar
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Pré-visualização (10 primeiros registros)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <span
                            className={
                              item.type === "INCOME"
                                ? "text-success"
                                : "text-destructive"
                            }
                          >
                            {item.type === "INCOME" ? "Entrada" : "Saída"}
                          </span>
                        </TableCell>
                        <TableCell>{formatCurrency(item.amount || 0)}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{UNIT_LABELS[item.unit || "CLINIC"]}</TableCell>
                        <TableCell>{STATUS_LABELS[item.status || "CONFIRMED"]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
              <AlertCircle className="h-5 w-5 text-primary" />
              <p className="text-sm text-foreground">
                <strong>{csvData.length}</strong> registros serão importados
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("map")}>
                Voltar
              </Button>
              <Button onClick={handleImport} className="gradient-primary gap-2">
                <Check className="h-4 w-4" />
                Importar Dados
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-success/20 bg-success/10 p-12 text-center">
            <div className="rounded-full bg-success/20 p-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Importação Concluída!
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Os dados foram importados com sucesso
            </p>
            <Button
              onClick={() => {
                setCsvData([]);
                setHeaders([]);
                setColumnMapping({});
                setPreview([]);
                setStep("upload");
              }}
              variant="outline"
              className="mt-4"
            >
              Nova Importação
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
