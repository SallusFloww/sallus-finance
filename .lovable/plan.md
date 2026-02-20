

# Adicionar coluna "Data" na tabela de producoes do modal de faturamento sugerido

## O que sera feito

No modal "Confirmar Faturamento Sugerido", na tabela "Producoes a incluir no faturamento:", sera adicionada uma coluna "Data" exibindo a data de producao de cada item, facilitando a verificacao antes de confirmar o faturamento.

## Arquivo: `src/pages/SuggestedBilling.tsx`

### Alteracao 1 - Header da tabela (linha 1071-1075)

Adicionar coluna "Data" apos a coluna "Descricao":

De:
```text
<TableHead className="w-10"></TableHead>
<TableHead>Descricao</TableHead>
<TableHead className="text-center">Status</TableHead>
<TableHead className="text-right">Qtd</TableHead>
<TableHead className="text-right">Valor</TableHead>
```

Para:
```text
<TableHead className="w-10"></TableHead>
<TableHead>Descricao</TableHead>
<TableHead className="text-center">Data</TableHead>
<TableHead className="text-center">Status</TableHead>
<TableHead className="text-right">Qtd</TableHead>
<TableHead className="text-right">Valor</TableHead>
```

### Alteracao 2 - Corpo da tabela (apos linha 1112, antes da celula de Status)

Adicionar celula com a data formatada em dd/MM/yyyy:

```text
<TableCell className="text-center text-sm text-muted-foreground">
  {format(parseISO(p.productionDate), "dd/MM/yyyy")}
</TableCell>
```

## O que NAO muda

- Nenhuma outra tabela ou modal
- Nenhum calculo ou logica de faturamento
- Nenhum schema, RPC ou RLS
- As funcoes `format` e `parseISO` ja estao importadas no arquivo

## Resultado visual

A tabela passara a ter as colunas: [checkbox] | Descricao | Data | Status | Qtd | Valor

