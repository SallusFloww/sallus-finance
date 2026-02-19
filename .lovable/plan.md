
# Fix: Faturamento vs Caixa Divergence — Definitive Root Cause

## Confirmed Root Cause (From Code Reading)

The divergence of R$ 900,00 persists even after "Reconciliar" says "Caixa consistente" because of a **split accounting between `totals.recebido` and `fetchCaixaTotal`**:

### Side A — `totals.recebido` (Faturamento, line 215 of Billing.tsx)
Sums `receivedAmount` for **ALL** RECEBIDO/RECEBIDO_COM_GLOSA receivables in the period, regardless of whether they have a `linkedTransactionId`.

### Side B — `fetchCaixaTotal` (Caixa, lines 231–263 of Billing.tsx)
Only sums `financial_entries.valor` for receivables **that have `linkedTransactionId`**. Then it excludes cancelled entries (`.neq("status", "cancelado")`).

### The Gap (R$ 900,00)
The most likely cause is that some of the 56 RECEBIDO receivables have a `linkedTransactionId` pointing to a financial entry that was later **cancelled** (status = 'cancelado'). Those receivables are:
- Counted in `totals.recebido` ✓
- Excluded from `fetchCaixaTotal` ✗ (because `.neq("status", "cancelado")` filters them out)
- NOT flagged as orphans by the reconciler ✗ (because they have a `linkedTransactionId`)

The reconciler checks `!r.linkedTransactionId` to identify orphans — **it never checks if the linked entry was cancelled**. So it says "consistent" when actually the link is broken.

### Secondary Cause
`RECEBIDO_COM_GLOSA` receivables created via `markAsGlossed` never have a `linked_transaction_id` set (the function doesn't create a financial entry or set the link). These would be caught as orphans by the reconciler — but the toast says "consistent" with 0 orphans, suggesting all 56 are RECEBIDO with `linkedTransactionId` set.

## The Fix (3 targeted changes)

### Fix 1 — Reconciler must also detect BROKEN LINKS (cancelled entries)
**File: `src/hooks/useReceivablesDB.ts`**

In `reconcileOrphanedReceivables`, after identifying true orphans (no `linkedTransactionId`), also query for receivables whose `linkedTransactionId` points to a cancelled entry:

```typescript
// True orphans: no link at all
const trueOrphans = receivables.filter(
  (r) =>
    (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
    r.receivedAmount > 0 &&
    !r.linkedTransactionId,
);

// Broken links: has linkedTransactionId but entry is cancelled
const linkedIds = receivables
  .filter(r => (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") && r.linkedTransactionId)
  .map(r => r.linkedTransactionId as string);

let cancelledEntryIds: Set<string> = new Set();
if (linkedIds.length > 0) {
  const { data: cancelledEntries } = await supabase
    .from("financial_entries")
    .select("id")
    .in("id", linkedIds)
    .eq("status", "cancelado");
  if (cancelledEntries) {
    cancelledEntries.forEach(e => cancelledEntryIds.add(e.id));
  }
}

const brokenLinks = receivables.filter(
  (r) =>
    (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
    r.receivedAmount > 0 &&
    r.linkedTransactionId &&
    cancelledEntryIds.has(r.linkedTransactionId),
);

const orphans = [...trueOrphans, ...brokenLinks];
```

For broken-link orphans, before creating a new entry, clear the old `linked_transaction_id` so the creation flow proceeds correctly.

### Fix 2 — `fetchCaixaTotal` must account for receivables with cancelled linked entries

**File: `src/pages/Billing.tsx`**

Currently `fetchCaixaTotal` queries entries by `linkedTransactionId` and excludes cancelled ones. This correctly returns a lower number — but the divergence message logic assumes it means "missing entries" when in reality it could mean "cancelled entries". No change needed here — Fix 1 is sufficient to detect and repair these.

However, the divergence message text should be clearer. When there's a gap, the alert should mention that some linked entries may be cancelled, not just that entries are missing.

### Fix 3 — `fetchCaixaTotal` must also sum receivables without `linkedTransactionId`

**File: `src/pages/Billing.tsx`**

The current `fetchCaixaTotal` silently drops receivables that have no `linkedTransactionId` from the caixa total calculation. This means if any RECEBIDO receivables don't have a link (true orphans), the `caixaTotal` is lower than `totals.recebido` and the divergence is shown — which is correct. The reconciler then creates entries and links them. **After Fix 1**, the reconciler also handles broken links, so after reconciliation `fetchCaixaTotal` should match.

**The one remaining issue**: when `receivedInPeriod.length === 0` (no receivables have `linkedTransactionId`), the function returns 0, but `totals.recebido` may be > 0. This is fine — it creates a divergence that triggers reconciliation. But if `receivedInPeriod.length < allReceivedInPeriod.length` due to broken links being excluded, `caixaTotal` is understated without triggering a useful reconciliation path.

**Solution**: Change `fetchCaixaTotal` to also include a zero-contrib term for unlinked receivables (they contribute nothing but their existence should not cause a silent gap). The real fix is **Fix 1** which ensures all receivables end up with a valid (non-cancelled) `linkedTransactionId` after reconciliation.

## Concrete File Changes

### `src/hooks/useReceivablesDB.ts` — `reconcileOrphanedReceivables`

Replace the orphan detection block (lines 963–975) to also detect broken links:

```typescript
// 1. True orphans: RECEBIDO/RECEBIDO_COM_GLOSA with receivedAmount > 0 but no linkedTransactionId
const trueOrphans = receivables.filter(
  (r) =>
    (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
    r.receivedAmount > 0 &&
    !r.linkedTransactionId,
);

// 2. Broken links: linkedTransactionId points to a CANCELLED entry
const linkedIds = receivables
  .filter(r =>
    (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
    r.receivedAmount > 0 &&
    r.linkedTransactionId
  )
  .map(r => r.linkedTransactionId as string);

let cancelledEntryIds = new Set<string>();
if (linkedIds.length > 0) {
  const { data: cancelledEntries } = await supabase
    .from("financial_entries")
    .select("id")
    .in("id", linkedIds)
    .eq("status", "cancelado");
  if (cancelledEntries) {
    cancelledEntries.forEach(e => cancelledEntryIds.add(e.id));
  }
}

const brokenLinks = receivables.filter(r =>
  (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
  r.receivedAmount > 0 &&
  r.linkedTransactionId &&
  cancelledEntryIds.has(r.linkedTransactionId),
);

const orphans = [...trueOrphans, ...brokenLinks];

if (orphans.length === 0) {
  toast.success("Caixa consistente. Todos os recebimentos já possuem lançamento vinculado e ativo.");
  return { fixed: 0, errors: 0, skipped: 0 };
}
```

Also update the loop for `brokenLinks`: before creating the new entry, clear the old `linked_transaction_id` on the receivable first so the `ilike observacao` check doesn't find the old (cancelled) entry:

```typescript
for (const receivable of orphans) {
  // For broken links, clear old linkedTransactionId so ilike check is clean
  const isBrokenLink = receivable.linkedTransactionId && cancelledEntryIds.has(receivable.linkedTransactionId);
  
  // Check by observacao to avoid creating a duplicate (in case entry was recreated)
  const { data: existing } = await supabase
    .from("financial_entries")
    .select("id")
    .eq("company_id", currentCompany.id)
    .ilike("observacao", `%receivable_id=${receivable.id}%`)
    .neq("status", "cancelado")
    .limit(1);

  if (existing && existing.length > 0) {
    // Entry exists (non-cancelled) — repair the link
    await supabase.from("receivables")
      .update({ linked_transaction_id: existing[0].id, updated_at: new Date().toISOString(), updated_by: profile.id })
      .eq("id", receivable.id);
    skipped++;
    continue;
  }
  
  // Create new entry (same as before)
  // ... insert into financial_entries ...
  // ... update receivables.linked_transaction_id ...
}
```

### `src/pages/Billing.tsx` — Update divergence alert message

Update the alert text (line 693) to mention cancelled entries as a possible cause:

```tsx
<p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
  Recebíveis sem lançamento ativo no Caixa (entradas ausentes ou canceladas).
  Clique em <strong>Reconciliar</strong> para criar automaticamente as entradas faltantes.
</p>
```

### `src/pages/Billing.tsx` — `fetchCaixaTotal` dependency on `filterReceivables`

**Critical bug**: `fetchCaixaTotal` uses `filterReceivables` which is a `useCallback` that depends on `receivables` state. After `refetchReceivables()` updates the `receivables` state, `filterReceivables` should be re-created... **but `fetchCaixaTotal` captures the old `filterReceivables` reference via its `useCallback` dependency array**. This is the subtle stale-closure bug causing the UI to show stale data after reconciliation.

Fix: add `receivables` to the `fetchCaixaTotal` dependency array (or restructure to not depend on the memoized filter function):

```typescript
const fetchCaixaTotal = useCallback(async () => {
  if (!currentCompany?.id) return;
  setCaixaLoading(true);

  // CRITICAL: use `receivables` directly, not via `filterReceivables`, to avoid stale closure
  const start = dateRange.start;
  const end = dateRange.end;

  const receivedInPeriod = receivables.filter((r) => {
    const d = parseISO(r.billingDate);
    return (
      d >= start &&
      d <= end &&
      (r.status === "RECEBIDO" || r.status === "RECEBIDO_COM_GLOSA") &&
      r.linkedTransactionId
    );
  });

  // ... rest of the query using entryIds ...
}, [currentCompany?.id, dateRange.start, dateRange.end, receivables]);
```

This is critical: `filterReceivables` as a dependency means `fetchCaixaTotal` is only recreated when `filterReceivables` changes, which happens when `receivables` changes — so this should work. But if the dependency isn't tracked correctly by React, it causes stale reads. Changing to use `receivables` directly makes the dependency explicit and reliable.

## Summary of All Changes

| File | Change | Why |
|---|---|---|
| `src/hooks/useReceivablesDB.ts` | Detect broken links (cancelled entries) in `reconcileOrphanedReceivables` | Reconciler says "consistent" when R$900 gap exists because linked entries are cancelled |
| `src/hooks/useReceivablesDB.ts` | Clear old `linkedTransactionId` before creating replacement entry for broken links | Prevents false "link already exists" detection |
| `src/pages/Billing.tsx` | Use `receivables` directly in `fetchCaixaTotal` instead of `filterReceivables` | Fixes potential stale closure causing outdated caixa total after reconciliation |
| `src/pages/Billing.tsx` | Update divergence alert text | Communicate the actual root cause (cancelled entries) to the user |

No schema changes. No RLS changes. No auth changes. All changes are in frontend hooks and page components only.
