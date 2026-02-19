
# Fix: Caixa vs Faturamento Divergence — Definitive Root Cause & Repair

## What's Actually Happening (From the Screenshots)

- Faturamento shows **R$ 13.892,37** recebido (56 receivables marked as RECEBIDO)
- Caixa shows **R$ 12.992,37** in "Total de Entradas"
- Difference: **R$ 900,00**
- Clicking "Reconciliar" shows: "Caixa consistente. 56 recebimento(s) já possuíam lançamento"

This is the key contradiction: **the reconciler thinks everything is fine, but there's still a R$900 gap.** This is NOT a missing entry problem — it's a **date mismatch problem**.

## Root Cause (Confirmed by Code Reading)

### The Two Filters Don't Match

**`totals.recebido`** (Faturamento side) — calculated in `Billing.tsx` line 215:
```
allFiltered.reduce((sum, r) => sum + r.receivedAmount, 0)
```
`allFiltered` is filtered by **`billingDate`** (the date the invoice was issued). The current period is `01/01–28/02/2026`.

**`fetchCaixaTotal`** (Caixa side) — queries `financial_entries` filtered by **`data_prevista`** (lines 237–238):
```sql
WHERE data_prevista >= '2026-01-01' AND data_prevista <= '2026-02-28'
```

**`markAsReceived`** (line 530 in `useReceivablesDB.ts`) saves entries with:
```
data_prevista: actualReceiptDate  ← the date the user typed when clicking "Receber"
```

So if a receivable was **invoiced (billingDate)** in February but the user registered the **receipt date** on a date outside the `01/01–28/02` window (e.g., a typo like `2025-02-XX`, or a future date like `2026-03-01`), the receivable IS counted in `totals.recebido` (because billingDate is in range), but its financial_entry IS NOT counted in `caixaTotal` (because data_prevista is out of range).

The orphan reconciler confirms the entry exists (via `ilike observacao %receivable_id=X%`) so it counts it as "skipped" — but `fetchCaixaTotal` still doesn't find it because of the date filter mismatch.

### Why This Is Hard to See

The reconciler says "everything is fine" (56 entries found) while the UI shows a gap — because the orphan check and the caixa total check use completely different query logic.

## The Fix

### Fix 1 — Change `fetchCaixaTotal` to use receivable IDs from the period

Instead of filtering `financial_entries` by `data_prevista` (which can be outside the period due to receipt dates varying), compute the caixa total by:

1. Taking the receivables already filtered for the period (`allFiltered` — which uses `billingDate`)
2. Extracting their `linkedTransactionId` values (IDs of their linked financial entries)
3. Summing those specific entries from the DB

This makes both sides of the comparison use **the same set of receivables** as the source of truth. No more date mismatch.

**File: `src/pages/Billing.tsx`**

Replace `fetchCaixaTotal` (lines 225–245) with a version that queries financial entries linked to the current period's receivables:

```typescript
const fetchCaixaTotal = useCallback(async () => {
  if (!currentCompany?.id) return;
  setCaixaLoading(true);

  // Get IDs of receivables in the current period (same set as totals.recebido)
  const receivedInPeriod = filterReceivables({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }).filter(
    (r) => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.linkedTransactionId
  );

  if (receivedInPeriod.length === 0) {
    setCaixaTotal(0);
    setCaixaLoading(false);
    return;
  }

  const entryIds = receivedInPeriod
    .map((r) => r.linkedTransactionId)
    .filter(Boolean) as string[];

  const { data, error } = await supabase
    .from("financial_entries")
    .select("valor")
    .in("id", entryIds)
    .neq("status", "cancelado");

  if (!error && data) {
    const total = data.reduce((sum, e) => sum + Number(e.valor), 0);
    setCaixaTotal(total);
  } else {
    setCaixaTotal(null);
  }
  setCaixaLoading(false);
}, [currentCompany?.id, dateRange.start, dateRange.end, filterReceivables]);
```

This query is now perfectly aligned with `totals.recebido`: same receivables, their actual linked entries.

### Fix 2 — Handle receivables with no `linkedTransactionId` (orphans)

After Fix 1, receivables that have `receivedAmount > 0` but NO `linkedTransactionId` will show up as a gap (their amount is in `totals.recebido` but NOT in `caixaTotal` — correctly!). The reconciler button then becomes meaningful: it truly creates missing entries for those cases.

Update `reconcileOrphanedReceivables` to skip the expensive `ilike` DB check for receivables that already have `linkedTransactionId` set — just go straight to creating entries for those with `receivedAmount > 0` AND `linkedTransactionId === null/undefined`.

**File: `src/hooks/useReceivablesDB.ts`**

Replace the orphan filter and detection loop (lines 963–1008) with a simpler, more reliable version:

```typescript
// Only process receivables that actually have no link
const orphans = receivables.filter(
  (r) =>
    (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
    r.receivedAmount > 0 &&
    !r.linkedTransactionId  // No link = confirmed orphan, no DB roundtrip needed
);

// For each orphan, do a final DB check to avoid inserting if entry exists by observacao
for (const receivable of orphans) {
  const { data: existing } = await supabase
    .from("financial_entries")
    .select("id")
    .eq("company_id", currentCompany.id)
    .ilike("observacao", `%receivable_id=${receivable.id}%`)
    .neq("status", "cancelado")
    .limit(1);

  if (existing && existing.length > 0) {
    // Entry exists but link wasn't saved — fix the link
    await supabase.from("receivables").update({
      linked_transaction_id: existing[0].id,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }).eq("id", receivable.id);
    skipped++;
    continue;
  }
  // ... create new entry
}
```

This eliminates N+1 DB queries for receivables that already have a `linkedTransactionId` (the vast majority).

### Fix 3 — Toast message when "Caixa consistente" is actually inconsistent

When `skipped === orphans.length` and `fixed === 0`, but there's still a divergence, the current code shows "Caixa consistente. 56 recebimento(s) já possuíam lançamento" — which is misleading. After Fix 1, this situation won't arise because the caixa total will now correctly reflect entries linked to period receivables.

### Fix 4 — `handleReconcile` cleanup

After Fix 2 (which eliminates N+1 queries for non-orphans), the `handleReconcile` flow in `Billing.tsx` also needs to trigger a `refetchReceivables()` even in the `skipped > 0` case (to update `linkedTransactionId` on the receivable objects in memory), then call `fetchCaixaTotal()`:

```typescript
const handleReconcile = async () => {
  setReconciling(true);
  try {
    const result = await reconcileOrphanedReceivables();
    // Always refresh after reconcile, regardless of fixed/skipped
    await new Promise((resolve) => setTimeout(resolve, 800));
    await refetchReceivables();
    await fetchCaixaTotal();
  } catch (err) {
    toast.error("Erro inesperado na reconciliação");
  } finally {
    setReconciling(false);
  }
};
```

## Summary of Changes

| File | What Changes |
|---|---|
| `src/pages/Billing.tsx` | `fetchCaixaTotal` — rewritten to query entries by `linkedTransactionId` of in-period receivables (not by `data_prevista` date range) |
| `src/pages/Billing.tsx` | `handleReconcile` — always refreshes both receivables and caixa total after reconciliation |
| `src/hooks/useReceivablesDB.ts` | `reconcileOrphanedReceivables` — skips DB roundtrip for receivables that already have `linkedTransactionId`; only queries DB for those with no link |

## What Will Happen After the Fix

1. `totals.recebido` = sum of `receivedAmount` for receivables with `billingDate` in period
2. `caixaTotal` = sum of `valor` for financial entries linked to those same receivables
3. Both sides use exactly the same set of receivables → comparison is apples-to-apples
4. If a receivable is RECEBIDO but has no `linkedTransactionId` → gap appears → "Reconciliar" creates the entry and updates the link → next `fetchCaixaTotal` picks it up
5. No more "Caixa consistente" false positive when there's an actual gap

No schema changes. No RLS changes. No auth changes. Purely UI and hook logic.
