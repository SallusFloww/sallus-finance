

## Diagnóstico

O erro ao receber Mat/Med na aba de Faturamento é causado pelo trigger `financial_entries_category_guard` no banco de dados. Quando o sistema tenta criar a movimentação financeira, ele usa o `production_type` da produção (ex: `MAT_MED`) como `categoria`. O trigger valida se essa categoria existe em `company_financial_settings.categories` -- se `MAT_MED` não foi cadastrado como categoria (via `upsert_production_type_with_category` ou manualmente), o INSERT é rejeitado.

O mesmo problema afeta tanto `markAsReceived` quanto `markAsReceivedMultipleDates`.

## Solução

Adicionar validação preventiva em ambas as funções: antes de inserir a `financial_entry`, verificar se a `inferredCategory` existe nas categorias da empresa. Se não existir, fazer fallback para `RECEBIMENTO_FATURAMENTO` (que é uma categoria padrão que sempre existe).

### Alteração em `src/hooks/receivables/useReceivablesActions.ts`

1. **Criar função auxiliar `ensureCategoryExists`** que consulta `company_financial_settings.categories` e verifica se o code existe. Se não existir, retorna `RECEBIMENTO_FATURAMENTO`.

2. **Aplicar em `markAsReceived`** (linha ~272-277): após inferir a categoria, chamar `ensureCategoryExists(inferredCategory)` antes de usá-la no insert.

3. **Aplicar em `markAsReceivedMultipleDates`** (linha ~793-800): mesma validação.

Isso resolve o problema sem alterar o banco de dados -- a lógica simplesmente faz fallback para uma categoria segura quando o tipo de produção não tem categoria financeira correspondente.

