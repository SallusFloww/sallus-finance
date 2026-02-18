
## Problem

In the "Movimentações" screen, entries created from billing receipts display the raw internal code `RECEBIMENTO_FATURAMENTO` as the transaction title (the `category` field shown at line 225 of `TransactionList.tsx`). When `MAT_MED` is not a registered category, the system correctly falls back to `RECEBIMENTO_FATURAMENTO` as the `categoria` code to pass DB validation — but that same code leaks through to the display.

## Root Cause

The data flow is:
```
useReceivablesDB.markAsReceived
  → inserts financial_entry with:
      descricao = "Recebimento faturamento • source • description"
      categoria = "RECEBIMENTO_FATURAMENTO"  ← raw code (needed for DB trigger)

useTransactionsDB.entryToTransaction
  → maps: category = entry.categoria  ← uses raw code directly

TransactionList
  → renders: {transaction.category}   ← shows "RECEBIMENTO_FATURAMENTO"
```

## Fix Strategy

Two changes across two files:

### 1. `src/hooks/useReceivablesDB.ts` — Improve `descricao` with human-readable production type name

In `markAsReceived`, when building the `descricao` field for the `financial_entries` insert, include the human-readable production type name (from `PRODUCTION_TYPE_LABELS`) instead of just the generic phrase. This way `descricao` carries the meaningful label ("Mat/Med") even when `categoria` must be `RECEBIMENTO_FATURAMENTO` for DB validation.

Import `PRODUCTION_TYPE_LABELS` from constants and build a readable label:

```typescript
// When uniqueTypes.length === 1 but not a valid category (e.g. MAT_MED):
const readableType = PRODUCTION_TYPE_LABELS[uniqueTypes[0]] || uniqueTypes[0];
// descricao will be: "Mat/Med • Recebimento faturamento • ..."
```

### 2. `src/hooks/useTransactionsDB.ts` — Map `categoria` code to display label

In `entryToTransaction`, instead of using the raw `categoria` code as-is, resolve it to a human-readable label. The approach:

- Check if `entry.categoria` is a known production type code → use `PRODUCTION_TYPE_LABELS[entry.categoria]`
- Otherwise try to match against `DEFAULT_CATEGORIES` by `id` → use `cat.name`
- As final fallback, use `entry.categoria` itself (for custom categories already stored with their names/codes)

A concise lookup map:

```typescript
import { PRODUCTION_TYPE_LABELS, DEFAULT_CATEGORIES } from "@/utils/constants";

function resolveCategoryLabel(categoria: string | null): string {
  if (!categoria) return "";
  // Try production type labels first (e.g. MAT_MED → "Mat/Med")
  if (PRODUCTION_TYPE_LABELS[categoria]) return PRODUCTION_TYPE_LABELS[categoria];
  // Try default categories by id (e.g. "salario" → "Salário")
  const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === categoria || c.id.toUpperCase() === categoria.toUpperCase());
  if (defaultCat) return defaultCat.name;
  // Return as-is (custom categories or display names stored directly)
  return categoria;
}
```

This function is called in `entryToTransaction` replacing `entry.categoria || ""`.

## What does NOT change

- The `categoria` field stored in the DB remains `"RECEBIMENTO_FATURAMENTO"` — the DB trigger continues to validate correctly
- No schema or database changes
- No changes to filtering logic (filters still use the raw `categoria` code)
- All other components that use `transaction.category` (DRE, BI, charts) benefit from the readable label automatically
- Existing entries in DB with `categoria = "CONSULTA"` or `"EXAME"` (already stored as production type codes) will resolve correctly via `PRODUCTION_TYPE_LABELS`

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useReceivablesDB.ts` | Import `PRODUCTION_TYPE_LABELS`; build human-readable label for `descricao` field using the production type name when falling back to `RECEBIMENTO_FATURAMENTO` |
| `src/hooks/useTransactionsDB.ts` | Import `PRODUCTION_TYPE_LABELS` and `DEFAULT_CATEGORIES`; add `resolveCategoryLabel()` helper; use it in `entryToTransaction` for the `category` field |

## Safety

- No breaking changes to filters, stats calculations, or DB writes
- Purely a display-layer fix in `entryToTransaction` + an informational improvement to `descricao`
- Fully backward-compatible with existing entries already in the database
