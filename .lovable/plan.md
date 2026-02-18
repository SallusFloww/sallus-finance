
## Root Cause Identified

The error `"Categoria inválida: \"SALÁRIO\" não existe nas configurações."` is triggered by a database-side trigger on `financial_entries` that validates the `categoria` field against the company's stored category codes (e.g., `"SAL_RIO"` or `"SALARIO"`). 

The bug is in `src/components/financial/FinancialEntryForm.tsx` inside the `categoryOptions` computed value. In **Case A** (the path currently active for this company, since `settings.categories` is an array with `{id, code, name, type, ...}` objects), the form uses `cat.name` ("Salário") as the `value` of each `<SelectItem>`, when it should use `cat.code` ("SAL_RIO" or "SALARIO"). The `value` is what gets stored in the DB via `categoria: categoria || undefined`.

### Evidence
From the network request body:
```json
{"categoria":"Salário", ...}
```
The DB trigger expects a code like `"SAL_RIO"` (the `code` field of the category object). Sending the display name causes the 400 error.

### What needs fixing

Only one file needs to change: **`src/components/financial/FinancialEntryForm.tsx`**

#### Fix in `categoryOptions` (lines ~118-123):

**Case A** currently maps:
```typescript
.map((cat: any) => ({ value: String(cat.name), label: String(cat.name) }));
```
Must become:
```typescript
.map((cat: any) => ({ value: String(cat.code || cat.id || cat.name), label: String(cat.name) }));
```
This uses `cat.code` as the stored value (what the DB validates against) while keeping `cat.name` as the human-readable label. The fallback chain `cat.code || cat.id || cat.name` ensures backward compatibility if any category is missing a `code`.

#### Fix in `categoryOptions` — editingEntry inclusion guard (lines ~150-153):

The current guard checks:
```typescript
if (currentCat && !sorted.some((opt) => opt.value.toLowerCase() === currentCat.toLowerCase()))
```
This works correctly once `value` is changed to `cat.code`, because existing entries already store codes, not names. No change needed there.

#### Fix in the "editing entry" load — `setCategoria` (line ~241):

Currently:
```typescript
setCategoria(editingEntry.categoria || "");
```
This correctly loads the stored value (which is already the code). No change needed.

### Side note on Case B

**Case B** (object format `{entrada: [...], saida: [...]}`) also has the same bug:
```typescript
return { value: String((item as any).name), label: String((item as any).name) };
```
This must also be fixed to:
```typescript
return { value: String((item as any).code || (item as any).id || (item as any).name), label: String((item as any).name) };
```

### Technical Implementation

**File to edit:** `src/components/financial/FinancialEntryForm.tsx`  
**Lines affected:** ~103-131 (the `categoryOptions` useMemo)

- Case B (object format): change `value` from `item.name` to `item.code || item.id || item.name`
- Case A (array format): change `value` from `cat.name` to `cat.code || cat.id || cat.name`
- Case C (DEFAULT_CATEGORIES fallback): `DEFAULT_CATEGORIES` likely already stores proper codes. Let me verify it uses code or name:

From `src/utils/constants.ts`, DEFAULT_CATEGORIES uses `{ name, type }` — no `code`. In the fallback case (Case C), there's no code field so `cat.name` is correct as value since these are internal defaults not validated by the DB trigger. But since DEFAULT_CATEGORIES is only a fallback when no settings exist, this scenario shouldn't hit the DB trigger validation anyway.

### No database migration needed

This is a pure frontend fix. The database trigger, RLS, and schema remain completely untouched.

### Safety

- Existing records in the DB already have `categoria` stored as codes (e.g., `"EXAME"`, `"CONSULTA"`) — the edit flow will correctly match these codes to the dropdown options.
- Historical entries are unaffected.
- No breaking changes to any other component.
