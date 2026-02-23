
# Corrigir Vinculacao de Medico na Importacao CSV

## Problema

A RPC `import_productions_batch` recebe `doctor_id` tanto no contexto quanto nas linhas individuais do CSV, mas **nunca extrai nem insere esse campo** na tabela `productions`. O frontend envia corretamente, porem o banco ignora.

## Causa raiz

Na funcao `import_productions_batch`:
- O contexto envia `doctor_id` mas a RPC nao faz `_doctor_id := _context->>'doctor_id'`
- Cada linha envia `doctor_id` mas a RPC nao faz `_row->>'doctor_id'`
- O INSERT em `productions` nao inclui a coluna `doctor_id`

## Solucao

Atualizar a RPC `import_productions_batch` via migracao SQL para:

1. Extrair `_doctor_id` do contexto (medico padrao do lote)
2. Dentro do loop de cada linha, extrair `doctor_id` da linha (medico individual)
3. Usar prioridade: medico da linha > medico do contexto > null
4. Incluir `doctor_id` no INSERT de `productions`

## Migracao SQL

```sql
-- Dentro das variaveis DECLARE, adicionar:
_doctor_id UUID;
_row_doctor_id UUID;

-- Apos extrair contexto, adicionar:
_doctor_id := NULLIF(TRIM(_context->>'doctor_id'), '')::UUID;

-- Dentro do loop, antes do INSERT:
BEGIN
  _row_doctor_id := NULLIF(TRIM(_row->>'doctor_id'), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  _row_doctor_id := NULL;
END;

-- No INSERT, adicionar coluna doctor_id com valor:
COALESCE(_row_doctor_id, _doctor_id)
```

## Dados existentes

A producao de Quimioterapia ja importada ficou sem `doctor_id`. Sera necessario atualizar manualmente esse registro OU re-importar. Nao ha como corrigir automaticamente registros antigos sem saber qual medico vincular (a menos que o usuario informe).

## Arquivos alterados

| Local | Alteracao |
|-------|-----------|
| Migracao SQL (RPC `import_productions_batch`) | Adicionar extracao e insercao de `doctor_id` (contexto + linha) |

## O que NAO muda

- Nenhum arquivo frontend (ja envia `doctor_id` corretamente)
- Nenhuma RLS ou trigger
- Nenhum outro schema
- Lancamentos manuais nao sao afetados (ja funcionam)
- Fluxo de faturamento/recebimento nao e afetado

## Risco

**Muito baixo**. A coluna `doctor_id` ja existe na tabela `productions` e aceita NULL. A unica mudanca e passar a preenche-la durante a importacao CSV.
