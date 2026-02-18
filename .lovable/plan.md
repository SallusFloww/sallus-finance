
## Root Cause: Invalid Category in `markAsReceived`

### What is happening

When the user clicks "Receber" on a billing entry, the `markAsReceived` function in `src/hooks/useReceivablesDB.ts` (lines 449–471) automatically infers the `categoria` for the new `financial_entries` record from the `production_type` of linked productions.

For the failing receivable (`MAT_MED – PRONTO_SO...`), the linked production has `production_type = "MAT_MED"`. The code then tries to insert a `financial_entries` record with `categoria: "MAT_MED"`.

The database has a **trigger on `financial_entries`** (not visible in migrations because it lives in the live database, added via Supabase Studio) that validates `categoria` against the company's stored category list in `company_financial_settings.categories`. Since `"MAT_MED"` is not a registered category code for this company, the insert is rejected with a 400 error, and the frontend shows **"Erro ao criar movimentação no caixa"**.

### Evidence

1. In `useReceivablesDB.ts` line 499–503:
```typescript
if (insertError) {
  console.error("Erro ao criar movimentação:", insertError);
  toast.error("Erro ao criar movimentação no caixa"); // ← this is the toast in the screenshot
  return null;
}
```

2. The `inferredCategory` logic at lines 459–471 blindly uses `production_type` as the category code:
```typescript
if (uniqueTypes.length === 1) {
  inferredCategory = uniqueTypes[0]; // "MAT_MED" — may not exist as category
}
```

3. Previous successful cases used `"EXAME"` and `"CONSULTA"` — those happen to exist as registered categories. `"MAT_MED"` does not.

### Fix Strategy

The fix must be applied inside `src/hooks/useReceivablesDB.ts`, in the `markAsReceived` function. The category inference must **validate** the inferred production_type against the company's actual registered category codes before using it. If no match is found, it must fall back to `"RECEBIMENTO_FATURAMENTO"` (the safe universal default).

This requires loading the company's categories at the time of inference and checking against them. The simplest and most robust approach is to **fetch the company's categories directly from the database** inside `markAsReceived` (same pattern already used by the other Supabase queries in this function), so no additional hook dependency is needed.

### Exact Change — `src/hooks/useReceivablesDB.ts`

**Where:** Lines 449–471 (the `inferredCategory` block)

**Current code logic:**
```typescript
// Inferir CATEGORIA a partir dos production_type vinculados ao receivable
let inferredCategory: string = "RECEBIMENTO_FATURAMENTO";
...
if (uniqueTypes.length === 1) {
  inferredCategory = uniqueTypes[0]; // ← blindly uses production_type as category
}
```

**New logic (3-step approach):**

1. After fetching `uniqueTypes`, do a quick lookup to fetch the company's registered categories from `company_financial_settings`:
```typescript
const { data: settingsData } = await supabase
  .from("company_financial_settings")
  .select("categories")
  .eq("company_id", currentCompany.id)
  .maybeSingle();

const validCategoryCodes = new Set(
  (Array.isArray(settingsData?.categories) ? settingsData.categories as any[] : [])
    .map((c: any) => String(c.code || c.id || c.name || "").toUpperCase())
    .filter(Boolean)
);
```

2. Only use `uniqueTypes[0]` as `inferredCategory` if it exists in `validCategoryCodes`:
```typescript
if (uniqueTypes.length === 1 && validCategoryCodes.has(uniqueTypes[0].toUpperCase())) {
  inferredCategory = uniqueTypes[0];
} else if (uniqueTypes.length === 1) {
  // production_type not registered as category — log it but fall back
  typeNote = ` | Tipo produção: ${uniqueTypes[0]} (não mapeado como categoria)`;
  inferredCategory = "RECEBIMENTO_FATURAMENTO";
}
```

3. This way:
   - `CONSULTA` → exists as category → used as-is ✅
   - `EXAME` → exists as category → used as-is ✅
   - `MAT_MED` → NOT a registered category → safely falls back to `RECEBIMENTO_FATURAMENTO` ✅
   - Historical entries with `RECEBIMENTO_FATURAMENTO` → unaffected ✅

### Safety Guarantees

- **No schema changes** — purely frontend/hook logic change
- **No breaking changes** — successful cases continue to work identically
- **Backward compatible** — `typeNote` preserves the original `production_type` in `observacao` for audit trail
- **Single file changed:** `src/hooks/useReceivablesDB.ts`
- **No regression risk** to any other feature

### Technical Summary

| File | Change |
|---|---|
| `src/hooks/useReceivablesDB.ts` | Add category validation before using `inferredCategory`. Fetch valid codes from DB and fall back to `"RECEBIMENTO_FATURAMENTO"` if `production_type` is not a registered category. |
