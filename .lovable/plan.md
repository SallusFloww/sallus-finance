

## Diagnóstico

O problema tem duas causas:

1. **Registros existentes no banco** — os lançamentos já criados têm `categoria = 'RECEBIMENTO_FATURAMENTO'` no banco de dados. Mesmo com o código novo, esses registros antigos não foram corrigidos.

2. **Caminhos de código que ainda usam hardcoded `RECEBIMENTO_FATURAMENTO`** — as funções de glosa parcial (linha ~456) e recurso de glosa deferido (linha ~572) inserem entries com categoria fixa em vez de inferir do tipo de produção.

## Solução

### 1. Migração SQL para corrigir registros existentes

Rodar um script que atualiza `financial_entries` onde `categoria = 'RECEBIMENTO_FATURAMENTO'` e existe um `receivable_id` na observação que pode ser cruzado com `productions.linked_receivable_id` para obter o `production_type` real:

```sql
UPDATE financial_entries fe
SET categoria = sub.production_type
FROM (
  SELECT DISTINCT ON (fe2.id) fe2.id AS fe_id, p.production_type
  FROM financial_entries fe2
  JOIN productions p ON p.linked_receivable_id = (
    regexp_match(fe2.observacao, 'receivable_id=([a-f0-9-]+)')
  )[1]::uuid
  WHERE fe2.categoria = 'RECEBIMENTO_FATURAMENTO'
    AND fe2.observacao LIKE '%receivable_id=%'
    AND p.production_type IS NOT NULL
  -- Only update when there's a single unique production_type per receivable
  GROUP BY fe2.id, p.production_type
  HAVING COUNT(DISTINCT p.production_type) = 1
) sub
WHERE fe.id = sub.fe_id;
```

### 2. Corrigir caminhos de código restantes em `useReceivablesActions.ts`

- **`markAsReceivedWithGloss`** (~linha 456): adicionar a mesma lógica de inferência de categoria (`inferredCategory` via produções vinculadas + `ensureCategoryExists`) em vez do hardcoded.
- **`resolveAppeal`** (~linha 572): mesma correção.

### Resultado

- Registros antigos terão a categoria correta (ex: `MAT_MED`)
- O `resolveCategoryLabel` já existente em `useTransactionsDB.ts` traduzirá `MAT_MED` → "Mat/Med" na UI
- Novos recebimentos de glosa/recurso também usarão a categoria correta

