
# Fix: Caixa vs Faturamento Divergence + Missing "Parecer" Entry

## Root Cause Analysis

### Issue 1 — Total Recebido Divergence (R$ 13.892,37 vs R$ 12.992,37 = R$ 900,00 difference)

Two different data sources are being summed independently:

- **Faturamento "Recebido"** card — reads `receivables.received_amount` for records with `status = "RECEBIDO" OR "RECEBIDO_COM_GLOSA"`, filtered by `billingDate` within the period.
- **Caixa "Total de Entradas"** — reads `financial_entries.valor` where `type = "entrada"` and `status = "recebido"`, filtered by `data_prevista` within the period.

The R$ 900,00 gap occurs because some receivables were marked as "Recebido" (updating `received_amount` in the `receivables` table) but either:
1. The corresponding `financial_entry` was not created (the `markAsReceived` flow failed mid-way and rolled back only the entry but not the receivable update), or
2. A receivable was updated directly in the database without going through the application's `markAsReceived` flow, so no matching `financial_entry` exists.

In both cases, the Faturamento card sums from `receivables.received_amount` (showing the full amount), while Caixa only sums the actual `financial_entries` created by the application (missing the amount with no matching entry).

**Verification point**: The two numbers being different by exactly R$ 900,00 is not a calculation bug in the UI — it is a data integrity issue: there is likely one receivable with `received_amount = 900.00` and `status = RECEBIDO` that has no corresponding `financial_entry` in the Caixa. The Faturamento sees it; the Caixa does not.

### Issue 2 — "Parecer" entry not appearing in the Production list

`PARECER` is not in `BASE_PRODUCTION_TYPES` (the hardcoded list: CONSULTA, EXAME, QUIMIOTERAPIA, BOX_PS, SESSAO_TERAPEUTICA, INTERNACAO, MAT_MED, OUTRO). Nor is it in `PRODUCTION_TYPE_LABELS` in `constants.ts`.

When the user typed "Parecer" as a custom type in the form, it was saved via `addProductionType("Parecer")` into the company settings table. The `nonPackageProductionTypes` list in `ProductionForm.tsx` is built from `[...BASE_PRODUCTION_TYPES, ...customProductionTypes]`. The `customProductionTypes` filter removes any name whose lowercase matches a `BASE_PRODUCTION_TYPES` entry or its label — "Parecer" does not match any of those, so it should appear.

The production was inserted into the database with `production_type = "Parecer"` (or `"PARECER"` — unclear from the save path). The `Production.tsx` list filters productions using `filterProductions()` which runs `isWithinInterval(parseISO(p.production_date), ...)`. If `production_date` was saved correctly the entry should appear.

The most likely cause: the Supabase insert **failed silently** (RLS policy denied it, or a column constraint rejected the custom type value), but the optimistic UI update in `useProductionDB.addProduction` temporarily showed it — then on refetch it disappeared. The current code does catch RLS errors and show a toast, but only for specific error messages.

Alternatively, the date filter in `Production.tsx` may use a different month/period than the user expects — the production was entered "now" (February 2026) but the form defaults may have submitted a different date.

## Fix Plan

### Fix 1 — Add Orphan Receivables Reconciliation Tool (Caixa Divergence)

The cleanest fix is to **detect and create the missing `financial_entry`** for any receivable that is `RECEBIDO`/`RECEBIDO_COM_GLOSA` but has no corresponding `financial_entry` (orphaned receivables).

**Location:** `src/hooks/useReceivablesDB.ts`

Add a `reconcileOrphanedReceivables()` function that:
1. Fetches all receivables with status `RECEBIDO` or `RECEBIDO_COM_GLOSA` for the company
2. For each, checks if a `financial_entry` exists with `observacao ILIKE '%receivable_id={id}%'`
3. If not found → creates the missing `financial_entry` with the correct `received_amount`, `actual_receipt_date`, and `observacao` tagging `receivable_id={id}`
4. Updates the `linked_transaction_id` on the receivable

This is also exposed as a button in `Billing.tsx` ("Reconciliar Recebimentos") in the header area, visible only to admins.

### Fix 2 — Add Consistency Warning in Billing Page

In `Billing.tsx`, add a warning alert when the sum of `receivedAmount` from receivables does not match the sum of `financial_entries` for INCOME/recebido in the same period. This makes the divergence visible and actionable.

The `totals.recebido` in Billing is already calculated from `allFiltered.reduce((sum, r) => sum + (r.receivedAmount || 0), 0)`. We need to also fetch the matching financial entries total and compare.

**Location:** `src/pages/Billing.tsx`

Add a `useMemo` that cross-checks receivables totals vs actual cash entries, and show a warning card if they diverge by more than R$ 0.01.

### Fix 3 — Fix Production List Not Showing "Parecer"

**Location:** `src/hooks/useProductionDB.ts`

The `fetchProductions` query returns all records for the company. The filter happens in `filterProductions()`. Check that the date filter in `Production.tsx` includes the current date.

**Location:** `src/pages/Production.tsx`

The date state defaults to `startOfMonth(new Date())` and `endOfMonth(new Date())`. The `filterProductions` call in the list uses these dates. If the production date was saved as today (2026-02-19) and the filter goes to `endOfMonth` (2026-02-28), it should be visible.

The real fix is in `useProductionDB.ts` `filterProductions`:

```typescript
// Current
if (p.productionDate < startOfDay(filters.startDate).toISOString()) return false;
```

The `startOfDay`/`endOfDay` functions from `date-fns` use local time but `production_date` from Supabase is a `DATE` type (no time zone). If the app is in UTC-3 (Brazil), `endOfDay(new Date('2026-02-28'))` in UTC is `2026-02-27T20:59:59Z` — which would exclude records dated `2026-02-28`. This is the UTC shift bug.

**Fix:** Use `parseISO(p.productionDate)` and compare with `startOfDay(filters.startDate)` using date-only comparison (year, month, day) instead of timestamp comparison.

Also add `PARECER` to `PRODUCTION_TYPE_LABELS` in `constants.ts` so it gets a proper display label.

## Technical Changes

### File: `src/utils/constants.ts`
- Add `PARECER: "Parecer"` to `PRODUCTION_TYPE_LABELS`

### File: `src/types/index.ts`
- No change needed (ProductionType is `string`, custom types are supported)

### File: `src/hooks/useProductionDB.ts`
- In `filterProductions`, fix the date comparison to be UTC-safe using `format(parseISO(p.productionDate), 'yyyy-MM-dd')` string comparison instead of timestamp comparison

### File: `src/pages/Billing.tsx`
- Add cross-check `useMemo` that compares `totals.recebido` (from receivables) vs actual entries total
- Display a yellow warning alert when divergence > R$ 0.01 with a "Reconciliar" button
- Add `reconcileOrphanedReceivables` call from hook

### File: `src/hooks/useReceivablesDB.ts`
- Add `reconcileOrphanedReceivables` callback that detects and creates missing `financial_entries` for orphaned RECEBIDO receivables
- Expose it from the hook's return value

## Scope Protection
- No schema changes
- No changes to submit logic, status machine, or RLS policies
- No changes to authentication
- Only adds new detection + reconciliation path to existing hooks/pages
