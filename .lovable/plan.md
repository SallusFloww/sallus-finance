

# Auditoria e Correcao: Split Receipt por Data de Producao

## Problema Identificado

A funcionalidade "Receber por data de producao" cria **N movimentacoes financeiras** (uma por data), mas o receivable so armazena **um unico** `linked_transaction_id` (o primeiro). Isso causa uma divergencia sistematica no calculo de consistencia entre Faturamento e Caixa.

### Causa Raiz

O calculo de `fetchCaixaTotal` em `Billing.tsx` (linhas 244-287) busca entradas financeiras **apenas pelo campo `linked_transaction_id`** dos receivables:

```text
const entryIds = receivedInPeriod
  .map((r) => r.linkedTransactionId)
  .filter(Boolean) as string[];

const { data } = await supabase
  .from("financial_entries")
  .select("valor")
  .in("id", entryIds)
  .neq("status", "cancelado");
```

Quando um receivable tem 3 entradas (split), so a primeira e encontrada. As outras 2 ficam "invisiveis" para o calculo, gerando a divergencia de R$ 9.350,00 mostrada no alerta.

## Correcoes Necessarias

### 1. Corrigir `fetchCaixaTotal` em `Billing.tsx`

**Problema**: So busca por `id IN (linked_transaction_ids)`.

**Solucao**: Buscar tambem por `observacao` contendo `receivable_id=<id>` para capturar todas as entradas criadas pelo split receipt. A observacao ja contem essa informacao (ex: `Origem: receivable_id=xxx | Data producao: ...`).

Logica corrigida:
- Para receivables com `linkedTransactionId`, buscar por ID (rapido)
- Adicionalmente, buscar por `observacao` contendo os IDs dos receivables recebidos
- Unificar os resultados sem duplicar (usar Set de IDs)

### 2. Corrigir `reconcileOrphanedReceivables` em `useReceivablesDB.ts`

**Problema**: A funcao verifica se o receivable e orfao checando apenas `linked_transaction_id`. Para split receipts, o receivable tem o primeiro ID vinculado mas as outras entradas nao sao contabilizadas.

**Solucao**: A reconciliacao ja usa `ilike("observacao", ...)` para encontrar entradas existentes, entao a logica de deteccao de orfaos esta correta. Porem, ao contar o total no `fetchCaixaTotal`, as entradas extras nao sao vistas. A correcao do item 1 resolve isso.

### 3. Adicionar validacao de valor no split receipt (`Billing.tsx`)

**Problema**: O total das producoes agrupadas pode diferir do `billedAmount` do receivable. Nao ha aviso ao usuario.

**Solucao**: Mostrar aviso quando o total do split difere do valor faturado, similar ao aviso existente para valor inferior no modo simples.

### 4. Proteger contra split com valor zero

**Problema**: Se uma producao tiver `total_value = 0`, ela entra no grupo com valor zero, o que viola a validacao `amount > 0` no hook.

**Solucao**: Filtrar producoes com `total_value > 0` ao construir os grupos em `openReceiveDialog`.

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Billing.tsx` | Corrigir `fetchCaixaTotal` para buscar por observacao; adicionar aviso de valor divergente no split; filtrar producoes com valor zero |
| `src/hooks/useReceivablesDB.ts` | Nenhuma alteracao necessaria - a logica do hook esta correta |

## O que NAO muda

- Nenhum schema de banco de dados
- Nenhuma RLS, trigger ou RPC
- O modo de recebimento simples (data unica) continua identico
- A logica de criacao de entradas no `markAsReceivedMultipleDates` esta correta
- A logica de idempotencia e rollback esta correta
- Nenhum outro dialog ou pagina e afetado

## Teste de Validacao

Apos a correcao:
1. Abrir Faturamento com receivables que usaram split receipt
2. Verificar que o alerta de divergencia **desaparece** (ou mostra valor correto)
3. Testar novo split receipt e confirmar que o calculo de consistencia reflete todas as entradas
4. Testar recebimento simples (data unica) e confirmar que continua funcionando

