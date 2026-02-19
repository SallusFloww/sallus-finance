

# Fix: handleAddType RPC Call + Proper State Sync

## Root Cause

The database RPC `upsert_production_type_with_category` returns:
```json
{ "success": true, "production_type": {...}, "category_code": "PARECER" }
```

But `handleAddType` (line 149) expects:
```typescript
onSyncComplete({
  productionTypes: result.production_types,   // UNDEFINED
  categories: result.categories,              // UNDEFINED
});
```

This passes `undefined` to `onSyncComplete`, which corrupts the local state. The catch block then fires (or state becomes broken), and the fallback local creation at line 160 runs -- creating the production type WITHOUT a category.

## Fix (2 files, no schema changes)

### File 1: `src/components/settings/SettingsProductionTypes.tsx`

Replace `handleAddType` (lines 121-178) to:

1. Add `console.log` before and after the RPC call (as requested for debugging)
2. After RPC success, call `onSyncComplete` with the single returned item merged into the existing arrays (instead of relying on non-existent full arrays from the RPC)
3. Keep the fallback but make it clearer

```typescript
const handleAddType = async () => {
  const trimmed = newType.trim();
  if (!trimmed) return;

  const exists = types.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    toast.error("Tipo de producao ja existe!");
    return;
  }

  setAddingType(true);
  try {
    console.log('[ADD_PROD_TYPE] calling RPC', { companyId, name: trimmed, description: newDescription.trim() });

    const { data, error } = await (supabase.rpc as any)('upsert_production_type_with_category', {
      _company_id: companyId,
      _name: trimmed,
      _description: newDescription.trim(),
      _desired_entry_type: 'entrada',
    });

    console.log('[ADD_PROD_TYPE] rpc result', { data, error });

    if (error) throw error;

    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error || 'Erro ao criar tipo');
      return;
    }

    // RPC returns { success, production_type, category_code }
    // Trigger a full refetch of settings to get both arrays updated
    onSyncComplete({
      productionTypes: [], // Signal to refetch
      categories: [],
    });

    onAddLog("UPDATE_SETTINGS", `Tipo "${trimmed}" adicionado com categoria ENTRADA vinculada`);
    setNewType("");
    setNewDescription("");
    toast.success("Tipo criado e categoria vinculada como ENTRADA");
  } catch (err) {
    console.error("[ADD_PROD_TYPE] Exception:", err);
    // Fallback: local creation without category
    const newTypeObj = { ... };
    onUpdate([...types, newTypeObj]);
    toast.warning("Tipo criado localmente. Categoria pode precisar ser criada manualmente.");
  } finally {
    setAddingType(false);
  }
};
```

**But wait** -- calling `onSyncComplete` with empty arrays would also corrupt state. The correct fix is to **not use `onSyncComplete` at all** and instead trigger a settings refetch. This requires a new prop.

### Better approach: Add `onRefetch` prop

Instead of trying to reconstruct arrays from partial RPC data, add an `onRefetch` callback that triggers `useCompanySettings().refetch()` -- this reloads both `production_types` and `categories` from the DB (which the RPC already updated atomically).

### File 1: `src/components/settings/SettingsProductionTypes.tsx`

Changes:
- Replace the `onSyncComplete` usage in `handleAddType` with a call to a new `onRefetch` prop
- Add console.log statements before/after RPC
- Keep the fallback for backward compatibility

```typescript
// In handleAddType, after RPC success:
if (!result?.success) {
  toast.error(result?.error || 'Erro ao criar tipo');
  return;
}

// RPC updated the DB atomically. Refetch settings to get fresh data.
await onRefetch();

onAddLog("UPDATE_SETTINGS", `Tipo "${trimmed}" adicionado com categoria ENTRADA vinculada`);
setNewType("");
setNewDescription("");
toast.success("Tipo criado e categoria vinculada como ENTRADA");
```

The interface becomes:
```typescript
interface SettingsProductionTypesProps {
  productionTypes: ProductionTypeConfig[];
  productions: Production[];
  companyId: string;
  onUpdate: (types: ProductionTypeConfig[]) => void;
  onSyncComplete: (data: { productionTypes: ProductionTypeConfig[]; categories: Category[] }) => void;
  onRefetch: () => Promise<void>;  // NEW
  onAddLog: (action: string, details: string) => void;
}
```

### File 2: `src/pages/Settings.tsx`

Pass the `refetch` function from `useCompanySettings` as the new `onRefetch` prop:

```typescript
<SettingsProductionTypes
  productionTypes={extendedSettings?.productionTypes ?? []}
  productions={productions ?? []}
  companyId={currentCompany?.id || ""}
  onUpdate={(types) => setExtendedSettings((prev) => ({ ...prev, productionTypes: types }))}
  onSyncComplete={({ productionTypes, categories }) => {
    setExtendedSettings((prev) => ({ ...prev, productionTypes }));
    updateSettings({ categories });
  }}
  onRefetch={async () => { await refetch(); }}   // NEW - from useCompanySettings
  onAddLog={addAuditLog}
/>
```

Where `refetch` is destructured from `useCompanySettings()` (it's already exported as `refetch: loadSettings` at line 475 of the hook). We need to add it to the destructuring at line 70 of Settings.tsx:

```typescript
const { settings, extendedSettings, updateSettings, updateExtendedSettings, refetch } = useCompanySettings();
```

## Summary of changes

| File | Change |
|---|---|
| `src/components/settings/SettingsProductionTypes.tsx` | Add `onRefetch` prop; rewrite `handleAddType` to call RPC then `onRefetch()`; add console.log before/after RPC |
| `src/pages/Settings.tsx` | Destructure `refetch` from `useCompanySettings()`; pass `onRefetch={async () => { await refetch(); }}` to `SettingsProductionTypes` |

## What does NOT change

- The RPC in the database (already correct and working)
- The `onSyncComplete` prop (kept for backward compatibility, but not used by the RPC path)
- The `onUpdate` prop (still used for edit/toggle flows)
- The trigger `financial_entries_category_guard()` (untouched)
- Existing production types, categories, financial entries, receivables (untouched)
- No schema changes, no RLS changes
