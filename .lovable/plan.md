
# Corrigir Registros Antigos com "RECEBIMENTO_FATURAMENTO"

## Problema

Existem registros antigos na tabela `financial_entries` com `categoria = 'RECEBIMENTO_FATURAMENTO'` que deveriam ter o nome correto do tipo de producao (ex: o codigo da "Oxigenoterapia Hiperbarica", "MAT_MED", etc.).

## Solucao

Executar um **UPDATE no banco de dados** que:

1. Busca todas as `financial_entries` com `categoria = 'RECEBIMENTO_FATURAMENTO'`
2. Para cada uma, extrai o `receivable_id` do campo `observacao`
3. Busca as `productions` vinculadas a esse receivable (via `linked_receivable_id`)
4. Se houver **um unico** `production_type`, atualiza a `categoria` da financial_entry com esse tipo
5. Se houver multiplos tipos ou nenhuma producao vinculada, mantem como esta

## SQL a ser executado (via insert tool)

```sql
UPDATE financial_entries fe
SET categoria = sub.production_type
FROM (
  SELECT
    fe2.id AS entry_id,
    MIN(p.production_type) AS production_type,
    COUNT(DISTINCT p.production_type) AS type_count
  FROM financial_entries fe2
  JOIN receivables r ON fe2.observacao LIKE '%receivable_id=' || r.id::text || '%'
  JOIN productions p ON p.linked_receivable_id = r.id
    AND p.company_id = fe2.company_id
  WHERE fe2.categoria = 'RECEBIMENTO_FATURAMENTO'
    AND fe2.status != 'cancelado'
  GROUP BY fe2.id
  HAVING COUNT(DISTINCT p.production_type) = 1
) sub
WHERE fe.id = sub.entry_id;
```

Esta query:
- So atualiza quando ha exatamente 1 tipo de producao vinculado (seguro)
- Mantem RECEBIMENTO_FATURAMENTO quando ha multiplos tipos (correto)
- Nao altera registros cancelados
- Nao modifica nenhum schema, trigger ou RLS

## O que NAO muda

- Nenhum arquivo de codigo (a correcao anterior no useReceivablesDB.ts ja previne novos registros com esse problema)
- Nenhum schema de banco
- Nenhuma RLS ou trigger
- Registros com multiplos tipos de producao permanecem como "RECEBIMENTO_FATURAMENTO" (exibido como "Recebimento de Faturamento" pelo resolveCategoryLabel)

## Risco

**Baixo**. O UPDATE so altera o campo `categoria` de registros que ja possuem producoes vinculadas com tipo unico. O `financial_entries_category_guard` trigger validara que o novo codigo existe nas categories da empresa -- se nao existir, o UPDATE falhara silenciosamente para aquele registro (seguro). Os registros que nao puderem ser atualizados continuarao exibindo "Recebimento de Faturamento" (label legivel).

## Verificacao pos-execucao

Conferir na aba Movimentacoes que os registros agora exibem nomes corretos (ex: "Oxigenoterapia Hiperbarica" em vez de "Recebimento de Faturamento").
