

# Plano de Implementacao — Correcoes da Auditoria

Este plano cobre as correcoes priorizadas por impacto e seguranca, organizadas em 5 fases para garantir estabilidade a cada passo.

---

## FASE 1 — Seguranca (Migracao SQL)

Uma unica migracao SQL para:

1. **Habilitar RLS em `health_plans`** com policies SELECT (por empresa) e ALL (Admin/Gestor)
2. **Habilitar RLS em `receivables_dupes_20260108`** e `company_financial_settings_categories_backup` (sem policies = ninguem acessa)
3. **Corrigir RLS de `doctors`** — remover policies auto-referenciais quebradas, criar novas usando `get_user_companies()`
4. **Criar indices de performance** nas 7 colunas mais consultadas (productions, financial_entries, receivables, health_plans, doctors)

---

## FASE 2 — Bug Fixes no Codigo

### 2.1 Remover fetch ipify.org (`useAuditLogDB.ts`)
- Eliminar o bloco try/catch que busca IP externo (linhas 46-53)
- Setar `ipAddress` como `null` diretamente
- **Impacto**: Remove 200-500ms de latencia em cada acao auditada

### 2.2 Corrigir `entryToTransaction` (`useTransactionsDB.ts`)
- Derivar `financialCategory` a partir de `entry.categoria` em vez de hardcodar "OPERACIONAL"
- Popular `paymentMethodParticular` a partir de `entry.payment_method` quando `receipt_type === "PARTICULAR"`
- **Impacto**: Corrige DRE, breakdown por metodo de pagamento e relatorios financeiros

### 2.3 Corrigir editLog inflado (`useProductionDB.ts` linha 393)
- Em `updateProduction`, armazenar apenas os campos alterados no `previousValue` em vez de `JSON.stringify(production)` inteiro
- **Impacto**: Previne crescimento exponencial da coluna `edit_logs`

---

## FASE 3 — Performance

### 3.1 Remover polling 30s do `GlobalRealtimeProvider.tsx`
- Deletar o `useEffect` com `setInterval(30000)` (linhas ~140-155)
- Manter o listener Supabase realtime (funciona bem) e o visibilitychange como fallback
- **Impacto**: Elimina 3 queries desnecessarias a cada 30s por aba aberta

### 3.2 Remover console.logs de producao
- `useFinancialEntries.ts` linha 131: remover `console.log("[useFinancialEntries]...")`
- `GlobalRealtimeProvider.tsx`: envolver todos os `console.log` em `if (import.meta.env.DEV)`
- `useProductionDB.ts` linha 188: remover `console.error(err)`

---

## FASE 4 — Arquitetura

### 4.1 Lazy loading de rotas (`App.tsx`)
- Converter todos os imports de pagina para `React.lazy()`
- Envolver `AppRoutes` em `<Suspense>` com fallback de loading
- **Impacto**: Reduz bundle inicial significativamente

### 4.2 Error Boundary nas rotas (`App.tsx`)
- Envolver o conteudo de `AppRoutes` com `<ErrorBoundary>`
- Um erro em uma pagina nao derruba mais toda a aplicacao

---

## FASE 5 — Estabilizacao

### 5.1 `filterTransactions` excluir cancelados por padrao (`useTransactionsDB.ts`)
- Adicionar `includeCancelled?: boolean` ao `TransactionFilters`
- Excluir cancelados por padrao (mesmo padrao ja aplicado em `filterProductions`)

---

## Resumo de Arquivos Alterados

| Arquivo | Tipo de Mudanca |
|---------|----------------|
| Migracao SQL | RLS + indices |
| `src/hooks/useAuditLogDB.ts` | Remover ipify fetch |
| `src/hooks/useTransactionsDB.ts` | Fix financialCategory + paymentMethodParticular + includeCancelled |
| `src/hooks/useProductionDB.ts` | Fix editLog inflado + remover console.error |
| `src/contexts/GlobalRealtimeProvider.tsx` | Remover polling 30s + wrap console.logs |
| `src/hooks/useFinancialEntries.ts` | Remover console.log |
| `src/App.tsx` | Lazy loading + Error Boundary + Suspense |

## Detalhes Tecnicos

**Lazy loading pattern:**
```typescript
const Dashboard = lazy(() => import("./pages/Dashboard"));
// ... todas as paginas
<Suspense fallback={<LoadingFallback />}>
  <ErrorBoundary>
    <AppRoutes />
  </ErrorBoundary>
</Suspense>
```

**financialCategory fix:**
```typescript
// Mapear categoria DB para FinancialCategory
financialCategory: (entry.categoria?.startsWith("NAO_OP") ? "NAO_OPERACIONAL" 
  : entry.categoria?.startsWith("COMP") ? "COMPARTILHADO" 
  : "OPERACIONAL") as FinancialCategory,
paymentMethodParticular: entry.receipt_type === "PARTICULAR" ? entry.payment_method as any : undefined,
```

**editLog fix:**
```typescript
const changedFields: Record<string, {prev: unknown, next: unknown}> = {};
if (data.description !== undefined && data.description !== production.description) 
  changedFields.description = {prev: production.description, next: data.description};
// ... etc
const editLog = { field: "multiple", previousValue: JSON.stringify(changedFields), ... };
```

