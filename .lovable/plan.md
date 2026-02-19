
# Fix: Reconciliation Flow — Root Cause Diagnosis & Repair

## Root Causes Found

### Bug 1 — `variant="warning"` does not exist on the Button component
The "Reconciliar" button uses `variant="warning"` which is not defined in `src/components/ui/button.tsx` (confirmed — no match found). This causes the button to silently render without the correct styling, and in some React/Tailwind setups can cause a rendering warning or suppress the click handler. This must be changed to a valid variant (`default` or a styled `className`).

### Bug 2 — Orphan filter skips receivables that already have `linked_transaction_id` set
The current orphan detection loop iterates all RECEBIDO/RECEBIDO_COM_GLOSA receivables and then queries Supabase to check if a `financial_entry` exists with `observacao ILIKE '%receivable_id={id}%'`. However, it **does not first skip** records that have `linkedTransactionId` set. So every RECEBIDO receivable is queried, but if the entry was created via the normal `markAsReceived` flow (which sets `linked_transaction_id`), it will be found in the DB via the `ilike` check and skipped correctly. The actual orphans are those with NO `linked_transaction_id` — but the DB check is still correct. However this causes unnecessary N+1 queries.

More critically: The filter at line 963 reads from `receivables` which is the **in-memory state at the time the hook was called**. If `dateRange` in Billing restricts what's displayed (e.g. only Feb 2026), but `useReceivablesDB` fetches ALL receivables for the company, the reconciliation operates on ALL receivables — this is actually correct behavior. However the **caixa total fetch** at line 228-238 filters by `data_prevista` in the dateRange, but the entries created during reconciliation use `receiptDate = actual_receipt_date || billing_date` which could be outside the current month filter. So reconciled entries from January won't be counted in the February caixa total — creating a false impression that reconciliation did nothing.

### Bug 3 — `fetchCaixaTotal` filter is period-scoped, reconciliation inserts entries outside period
When reconciling ALL orphaned receivables (not just the current period), entries from previous months are created with their original `billing_date` as `data_prevista`. The `fetchCaixaTotal` query filters `gte data_prevista >= startStr` and `lte data_prevista <= endStr`. So entries from other months won't appear in the caixa total for the current period, even though the Faturamento total (`totals.recebido`) also filters by `billingDate` within the current `dateRange`. This creates a permanent "false divergence" for entries from different months.

**Key realization**: The `totals.recebido` in Billing sums `receivedAmount` of ALL receivables filtered by `billingDate` in the current dateRange. But `caixaTotal` sums `financial_entries.valor` filtered by `data_prevista` in the same dateRange. The divergence calculation is: `|totals.recebido - caixaTotal|`. If some receivables in the period have their corresponding entries with `data_prevista` outside the period, both sides are inconsistent.

**The fix**: After reconciliation, `fetchCaixaTotal` should NOT be period-scoped — OR the reconciliation should create entries with `data_prevista` matching `billing_date` of the receivable (which is within the period). Currently `receiptDate = actual_receipt_date || billing_date`. The `actual_receipt_date` might be in a different month than `billing_date`. To match Faturamento's filter (which uses `billingDate`), the entries should use `billing_date` as `data_prevista`.

## Fix Plan

### Fix 1 — Remove invalid `variant="warning"` from the Reconciliar button
**File**: `src/pages/Billing.tsx` line ~682

Change:
```tsx
variant="warning"
```
To:
```tsx
className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
```
(keeping `size="sm"` and `onClick={handleReconcile}`)

### Fix 2 — Use `billing_date` as `data_prevista` in reconciled entries
**File**: `src/hooks/useReceivablesDB.ts` line ~1012

Change:
```typescript
const receiptDate = receivable.actualReceiptDate || receivable.billingDate;
// ...
data_prevista: receiptDate,
data_recebimento: receiptDate,
```

To:
```typescript
const receiptDate = receivable.actualReceiptDate || receivable.billingDate;
// data_prevista must match billingDate so it appears in the same period filter as the receivable
data_prevista: receivable.billingDate,
data_recebimento: receiptDate,
```

This ensures the `financial_entry` sits in the same month as its parent receivable — matching how `filterReceivables` works.

### Fix 3 — Add explicit `refreshAll()` + `fetchReceivables()` + `fetchCaixaTotal()` in the right order with proper await in `handleReconcile`
**File**: `src/pages/Billing.tsx` lines 258-273

The current `handleReconcile` already awaits `reconcileOrphanedReceivables()` and then calls `fetchCaixaTotal()` and `refetchReceivables()`. However `reconcileOrphanedReceivables` itself calls `refreshAll()` and `fetchReceivables()` at the end. This means there are two parallel refresh paths that can race.

**Fix**: Remove the internal `refreshAll()` and `fetchReceivables()` calls from inside `reconcileOrphanedReceivables` in the hook (so the hook is a pure data function), and do all refresh logic in `handleReconcile` in Billing.tsx, with explicit sequencing:

```typescript
const handleReconcile = async () => {
  setReconciling(true);
  try {
    const result = await reconcileOrphanedReceivables();
    if (result.fixed > 0 || result.skipped > 0) {
      // Wait for DB propagation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Refresh in sequence: receivables first, then caixa total
      await refetchReceivables();
      await fetchCaixaTotal();
    }
  } catch (err) {
    console.error("Erro inesperado na reconciliação:", err);
    toast.error("Erro inesperado na reconciliação");
  } finally {
    setReconciling(false);
  }
};
```

And in `useReceivablesDB.ts`, remove the `refreshAll()` + `fetchReceivables()` calls at lines 1064-1065 (inside `reconcileOrphanedReceivables`), since those now happen in the caller.

### Fix 4 — Guard the divergence display while caixaTotal is loading
**File**: `src/pages/Billing.tsx` line 659

Change:
```tsx
{caixaLoading && caixaTotal === null ? null : hasDivergence ? (
```
To:
```tsx
{caixaLoading ? null : hasDivergence ? (
```

This prevents the alert from flickering in/out during refetch.

## Summary of File Changes

| File | Lines | Change |
|---|---|---|
| `src/pages/Billing.tsx` | ~258-273 | `handleReconcile` — explicit await chain, remove duplicate refresh paths |
| `src/pages/Billing.tsx` | ~682 | `variant="warning"` → valid `className` with amber styling |
| `src/pages/Billing.tsx` | ~659 | Guard `caixaLoading` to prevent flicker |
| `src/hooks/useReceivablesDB.ts` | ~1012 | Use `billingDate` as `data_prevista` in reconciled entries |
| `src/hooks/useReceivablesDB.ts` | ~1062-1065 | Remove internal `refreshAll()` + `fetchReceivables()` — delegated to caller |

No schema changes, no RLS changes, no auth changes. All changes are UI/hook logic only.
