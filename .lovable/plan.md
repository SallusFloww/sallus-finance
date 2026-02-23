
# Corrigir Erro ao Cancelar Producao

## Problema

O erro no console e:
```
new row for relation "productions" violates check constraint "productions_status_check"
```

A tabela `productions` possui uma constraint `CHECK` no campo `status` que so aceita: `PRODUZIDO`, `FATURADO`, `GLOSADO`, `RECEBIDO`. O valor `CANCELADO` nao esta na lista permitida.

## Solucao

Uma unica migracao SQL para alterar a constraint, adicionando `CANCELADO` aos valores permitidos:

```sql
ALTER TABLE productions DROP CONSTRAINT productions_status_check;
ALTER TABLE productions ADD CONSTRAINT productions_status_check 
  CHECK (status = ANY (ARRAY['PRODUZIDO','FATURADO','GLOSADO','RECEBIDO','CANCELADO']));
```

## O que muda

| Local | Alteracao |
|-------|-----------|
| Migracao SQL | Atualiza constraint para incluir "CANCELADO" |

## O que NAO muda

- Nenhum arquivo de codigo (o frontend e hook ja estao implementados corretamente)
- Nenhuma RLS ou trigger
- Nenhum outro schema ou tabela
- Dados existentes nao sao afetados

## Risco

**Minimo**. Apenas adiciona um valor valido a constraint existente. Nenhum dado e alterado.
