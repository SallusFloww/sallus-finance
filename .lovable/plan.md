
## Root Cause: Double Source of Truth for Production Types

### What is happening

The production type dropdown in "Nova Produção" shows every type twice. For example:
- `CONSULTA` (raw ID from `BASE_PRODUCTION_TYPES`) AND `Consulta` (display name from `savedProductionTypes`)
- `MAT_MED` AND `Mat/Med`
- etc.

### Why it happens

In `ProductionForm.tsx` lines 207–214, the `productionTypes` array is built by merging three sources:

```
BASE_PRODUCTION_TYPES  →  ["CONSULTA", "EXAME", "QUIMIOTERAPIA", "BOX_PS",
                           "SESSAO_TERAPEUTICA", "INTERNACAO", "MAT_MED", "OUTRO"]

MATMED_PRODUCTION_TYPE →  "MAT_MED"   ← redundant, already in BASE_PRODUCTION_TYPES

savedProductionTypes   →  ["Consulta", "Exame", "Quimioterapia", "Box / Atendimento PS",
                           "Sessão Terapêutica", "Internação", "Mat/Med", "Outro"]
                           (display names from the DB via useCompanySettings)
```

The `Set` deduplication only removes exact string duplicates. Since `"CONSULTA" !== "Consulta"`, every type survives deduplication and appears **twice** in the list.

The underlying issue: `BASE_PRODUCTION_TYPES` holds raw IDs, while `getSavedProductionTypes()` returns human-readable names from `extendedSettings.productionTypes`. These are two incompatible representations of the same data being merged without normalization.

### Fix Strategy

The fix is entirely in `src/components/production/ProductionForm.tsx` — one file, one logical change.

**The correct approach:** Since the DB (`extendedSettings.productionTypes` via `getSavedProductionTypes`) is the **source of truth** (it has names, active/inactive status, and includes all defaults already merged by `SettingsProductionTypes`), `savedProductionTypes` should be used as the primary list. `BASE_PRODUCTION_TYPES` should only serve as a fallback when no DB types are available.

**New logic:**

```typescript
// If the company has production types saved in DB, use them as the single source.
// Otherwise, fall back to BASE_PRODUCTION_TYPES (for companies not yet configured).
const productionTypes = savedProductionTypes.length > 0
  ? [
      ...new Set([
        ...savedProductionTypes,         // DB names: "Consulta", "Mat/Med", etc.
        ...PACKAGE_PRODUCTION_TYPES,     // "PACOTE_BOX", "PACOTE_GTA" (package types always included)
      ])
    ]
  : [
      ...new Set([
        ...BASE_PRODUCTION_TYPES,        // fallback IDs
        MATMED_PRODUCTION_TYPE,
        ...PACKAGE_PRODUCTION_TYPES,
      ])
    ];
```

However, this introduces a secondary concern: the rest of the form uses `formData.productionType` as a raw ID (`"CONSULTA"`, `"MAT_MED"`) for comparisons like:

```typescript
const isPackage = PACKAGE_PRODUCTION_TYPES.includes(formData.productionType); // "PACOTE_BOX"
const isCentroClinico = unit.includes("CENTRO_CLINICO");
```

The `PACKAGE_PRODUCTION_TYPES` are IDs (`"PACOTE_BOX"`, `"PACOTE_GTA"`), not display names, so they must stay as IDs in the list — which they already do since `PACKAGE_PRODUCTION_TYPES` is separate. No conflict there.

For the base types, the form comparisons like `formData.productionType === "EXAME"` must still work. Since `savedProductionTypes` returns **names** (e.g., `"Exame"`), not IDs, this could break those comparisons.

**Better fix — deduplicate by normalizing to ID:**

Instead of switching the entire list to names, keep the existing ID-based system but **remove the `savedProductionTypes` merge** (which adds names) and replace it with a check that only adds truly custom types (types in DB that are NOT already in `BASE_PRODUCTION_TYPES`):

```typescript
// Custom types added by the company (not in the base set)
const baseIds = new Set([...BASE_PRODUCTION_TYPES, ...PACKAGE_PRODUCTION_TYPES]);
const customProductionTypes = savedProductionTypes.filter(
  (name) => !baseIds.has(name as any) && 
            !Object.values(PRODUCTION_TYPE_LABELS).some(
              label => label.toLowerCase() === name.toLowerCase()
            )
);

const productionTypes = [
  ...new Set([
    ...BASE_PRODUCTION_TYPES,
    MATMED_PRODUCTION_TYPE,      // Remove this — already in BASE_PRODUCTION_TYPES
    ...PACKAGE_PRODUCTION_TYPES,
    ...customProductionTypes,    // Only genuinely custom types
  ]),
];
```

Wait — this still has the flaw that `MATMED_PRODUCTION_TYPE` is already in `BASE_PRODUCTION_TYPES` since `src/types/index.ts` line 438 confirms `"MAT_MED"` is in `BASE_PRODUCTION_TYPES`.

**Simplest correct fix:** Remove `MATMED_PRODUCTION_TYPE` from the spread (it's redundant), and filter `savedProductionTypes` to exclude anything that matches a base ID or its label:

```typescript
// Only include custom DB types that are NOT already represented in BASE_PRODUCTION_TYPES
const customProductionTypes = savedProductionTypes.filter((name) => {
  const nameUpper = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const isBaseId = BASE_PRODUCTION_TYPES.includes(name as any);
  const isBaseLabel = Object.entries(PRODUCTION_TYPE_LABELS).some(
    ([, label]) => label.toLowerCase() === name.toLowerCase()
  );
  return !isBaseId && !isBaseLabel;
});

const productionTypes = [
  ...new Set([
    ...BASE_PRODUCTION_TYPES,
    ...PACKAGE_PRODUCTION_TYPES,
    ...customProductionTypes,
  ]),
];
```

This guarantees:
- Base types appear exactly once (as IDs, compatible with all existing comparisons)
- Package types appear exactly once
- Genuinely custom types (added by company in Settings) are appended
- `MAT_MED` no longer duplicated (removed redundant `MATMED_PRODUCTION_TYPE` spread)

### What does NOT change

- All existing form logic that compares `formData.productionType` to raw IDs (e.g., `"EXAME"`, `"CONSULTA"`, `"PACOTE_BOX"`) continues to work unchanged
- The display label rendering at line 847 uses `getProductionTypeLabel(type)` which maps IDs to names — this is unaffected
- No database changes
- No changes to `useCompanySettings`, `BASE_PRODUCTION_TYPES`, or any other file

### File to Change

| File | Change |
|---|---|
| `src/components/production/ProductionForm.tsx` | Remove redundant `MATMED_PRODUCTION_TYPE` from the merge; filter `savedProductionTypes` to exclude types already represented by `BASE_PRODUCTION_TYPES` or their display labels |

### Safety

- Single-file change
- The dropdown renders `getProductionTypeLabel(type)` for each entry — IDs resolve correctly to human names
- No risk to form submission, validation, or database writes
- Existing productions in the DB are unaffected
