import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { BITransactionRow } from "@/hooks/useBIData";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface BITransactionTableProps {
  transactions: BITransactionRow[];
  title?: string;
}

export function BITransactionTable({ transactions, title = "Últimas Movimentações" }: BITransactionTableProps) {
  const [search, setSearch] = useState("");

  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const searchLower = search.toLowerCase();
    return transactions.filter(t => 
      t.category.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      t.unit.toLowerCase().includes(searchLower)
    );
  }, [transactions, search]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary">
              Caixa
            </Badge>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            {search ? "Nenhuma movimentação encontrada" : "Sem movimentações no período"}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <Table className="table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-[80px]">Unidade</TableHead>
                  <TableHead className="text-right w-[100px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs text-muted-foreground">
                      {transaction.date}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transaction.type === "INCOME" ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="text-xs truncate max-w-[150px]">{transaction.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {transaction.unit}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right text-xs font-medium",
                      transaction.type === "INCOME" ? "text-success" : "text-destructive"
                    )}>
                      {transaction.type === "INCOME" ? "+" : "-"}{formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
