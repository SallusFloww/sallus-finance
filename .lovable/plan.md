
# Multi-Type Production Selection — Implementation Plan

## Architecture Overview

The implementation introduces multi-select production types in `ProductionForm.tsx` using a **bulk insert strategy** for atomicity. The existing `onSubmit` callback signature is preserved but bypassed for multi-type submissions, which perform a direct Supabase bulk insert inside the form itself for safety.

```text
CURRENT FLOW:
  Form → single productionType → onSubmit(data) → addProduction(1 row) → DB

NEW FLOW (multi-type):
  Form → selectedTypes[] + perTypeValues{} → bulk insert N rows directly → DB
  Form → single type (legacy) → onSubmit(data) → addProduction(1 row) → DB [UNCHANGED]
```

---

## State Changes

### Replace single `productionType` string in `formData` with:

```typescript
const [selectedTypes, setSelectedTypes] = useState<string[]>(["CONSULTA"]);
const [perTypeValues, setPerTypeValues] = useState<
  Record<string, { quantity: string; totalValue: string; examType?: string; therapySessionType?: string }>
>({ CONSULTA: { quantity: "1", totalValue: "" } });
```

Keep `formData` for all shared fields: `productionDate`, `competencia`, `unit`, `specialty`, `doctorId`, `payerType`, `convenio`, `paymentMethod`, `notes`, `description`, `procedureCode`.

Remove `formData.productionType`, `formData.quantity`, `formData.totalValue`, `formData.examType`, `formData.therapySessionType` from `formData` — these move to `perTypeValues` per-type.

For **package types** (PACOTE_BOX, PACOTE_GTA), keep them in a separate isolated `singlePackageType` mode, exactly as today. If `selectedTypes` contains a package type, the form renders in "package mode" (single-type, unchanged behavior).

---

## UI Changes

### Production Type Section (violet card)

Replace the Popover/Command dropdown with a **checkbox list**:

```
┌─────────────────────────────────────────────────────┐
│  Tipo de Produção *                                  │
│                                                      │
│  [✓] Consulta                                        │
│       Qtde: [1]    Valor Total (R$): [_____]         │
│                                                      │
│  [✓] Box / Atendimento PS                            │
│       Qtde: [1]    Valor Total (R$): [_____]         │
│                                                      │
│  [ ] Exame         [ ] Quimioterapia                 │
│  [ ] Sessão Terap. [ ] Internação                    │
│  [ ] Mat/Med       [ ] Outro                         │
│  [custom types if any]                               │
│                                                      │
│  ─────── Pacotes (seleção exclusiva) ────────        │
│  ( ) Pacote Box (Convênio)                           │
│  ( ) Pacote GTA (Convênio)                           │
│  ⓘ Pacotes não combinam com outros tipos             │
└─────────────────────────────────────────────────────┘
```

- Non-package types: checkboxes (multi-select)
- Package types: radio-like buttons below a separator — selecting one clears `selectedTypes` and enters "single package mode"
- When a checkbox is checked: initialize `perTypeValues[type] = { quantity: "1", totalValue: "" }`
- When unchecked: remove from `perTypeValues`
- Inline qty+value row appears below each checked type

### Dynamic Sub-fields (EXAME / SESSAO_TERAPEUTICA)

- When only 1 type: render `renderDynamicFields()` exactly as today (no change)
- When multi-type: render a compact inline sub-field only for EXAME and SESSAO_TERAPEUTICA items:
  - EXAME: shows "Tipo de Exame" select inline under that row
  - SESSAO_TERAPEUTICA: shows "Tipo de Sessão" select inline under that row
  - Other types: no sub-field needed

---

## Submission Logic

### Multi-type (N > 1, non-package)

Perform a **bulk Supabase insert** directly in the form:

```typescript
// 1. Generate batchId for audit trail
const batchId = crypto.randomUUID();

// 2. Build rows array
const rows = selectedTypes.map(type => ({
  company_id: currentCompany.id,
  production_date: formData.productionDate,
  competencia: formData.competencia,
  unit: formData.unit,
  specialty: formData.specialty || "SEM_ESPECIALIDADE",
  doctor_id: formData.doctorId || null,
  payer_type: formData.payerType,
  convenio: formData.payerType === "CONVENIO" ? formData.convenio : null,
  payment_method: formData.payerType === "PARTICULAR" ? formData.paymentMethod : null,
  production_type: type,
  description: buildDescription(type, perTypeValues[type]),
  quantity: parseInt(perTypeValues[type].quantity) || 1,
  unit_value: ...,
  total_value: parseFloat(perTypeValues[type].totalValue) || 0,
  status: "PRODUZIDO",
  created_by: profile.id,
  // Batch audit: stored in notes/history
  notes: batchId ? `[#BATCH:${batchId}]${formData.notes ? " " + formData.notes : ""}` : formData.notes,
  history: [...],
}));

// 3. Bulk insert — atomic from Supabase perspective
const { data: inserted, error } = await supabase
  .from("productions")
  .insert(rows)
  .select();

// 4. Rollback if error
if (error) {
  // If partial rows were inserted (network failure mid-flight), clean up using returned IDs
  // But since insert is a single request, it's all-or-nothing at the DB level
  toast.error("Falha ao registrar produções. Nada foi salvo.");
  return;
}
```

### Single-type (N = 1, non-package)

Call `onSubmit(data)` exactly as today — **no change** to this path.

### Package type selected alone

Call `onSubmit(data)` exactly as today — **no change** to package flow.

---

## Validation

```text
1. At least 1 type selected
2. If package selected: must be alone (no other types)
3. If CONVENIO: convenio field required
4. If PARTICULAR: paymentMethod required
5. Centro Clínico: specialty required
6. Competência format valid
7. For each selected type:
   - quantity > 0
   - totalValue (optional but >= 0 if filled)
   - EXAME: examType required
   - SESSAO_TERAPEUTICA: therapySessionType required
8. Package validations: unchanged (validateTotal, payerType === CONVENIO)
```

---

## Batch ID Audit Trail

When N > 1:
- `batchId = crypto.randomUUID()`
- Each row's `notes` field gets: `[#BATCH:UUID] <original notes>` if notes exist, or `[#BATCH:UUID]` alone
- This allows future tracing of co-submitted rows without any schema change
- The `notes` DB column exists and is nullable — no schema change required

---

## Toast Messages

| Case | Toast |
|---|---|
| 1 type saved | `"Produção registrada com sucesso"` (unchanged) |
| N types saved | `"3 produções registradas com sucesso"` |
| Error (any) | `"Falha ao registrar produções. Nada foi salvo."` |

---

## Files to Change

| File | What Changes |
|---|---|
| `src/components/production/ProductionForm.tsx` | Replace type dropdown with checkbox list; add `selectedTypes` + `perTypeValues` state; update `handleSubmit` with bulk insert for multi-type; preserve all single-type + package flows |

`src/pages/Production.tsx` — **no change needed** (the multi-type path bypasses `handleAddProduction` entirely; single-type still calls it normally).

`useProductionDB.ts`, all hooks, DB schema, reports — **untouched**.

---

## Safety Guarantees

- Bulk insert is a **single HTTP request** to Supabase — either all rows are saved or none (PostgreSQL transaction)
- If `insert` fails, no rows are written (no partial save, no manual rollback needed)
- Package flow is completely isolated and unchanged
- Single-type flow calls `onSubmit` exactly as before — unchanged
- `addProduction` hook shows its own toast for single-type; bulk path shows its own toast
- After bulk insert, `fetchProductions()` from realtime context refreshes the list automatically
- The `batchId` in notes is an opaque string — filters, stats, DRE, BI all ignore it

---

## Technical Summary

### New State Variables

```typescript
// replaces formData.productionType + formData.quantity + formData.totalValue + formData.examType + formData.therapySessionType
const [selectedTypes, setSelectedTypes] = useState<string[]>(["CONSULTA"]);
const [perTypeValues, setPerTypeValues] = useState<
  Record<string, {
    quantity: string;
    totalValue: string;
    examType?: string;
    therapySessionType?: string;
  }>
>({ CONSULTA: { quantity: "1", totalValue: "" } });
```

### Toggle Handler

```typescript
const toggleType = (type: string) => {
  const isPackage = PACKAGE_PRODUCTION_TYPES.includes(type);
  
  if (isPackage) {
    // Package: exclusive single-select
    setSelectedTypes([type]);
    setPerTypeValues({ [type]: { quantity: "1", totalValue: "" } });
    return;
  }
  
  // If currently selecting a non-package, clear any package
  const hadPackage = selectedTypes.some(t => PACKAGE_PRODUCTION_TYPES.includes(t));
  
  if (selectedTypes.includes(type)) {
    // Uncheck — minimum 1 must remain
    const next = selectedTypes.filter(t => t !== type);
    if (next.length === 0) return; // Don't allow empty selection
    setSelectedTypes(next);
    setPerTypeValues(prev => { const c = {...prev}; delete c[type]; return c; });
  } else {
    // Check — if had package, clear it first
    const base = hadPackage ? [] : selectedTypes;
    setSelectedTypes([...base, type]);
    setPerTypeValues(prev => ({
      ...(hadPackage ? {} : prev),
      [type]: { quantity: "1", totalValue: "" }
    }));
  }
};
```

### Derived Flags

```typescript
const isMultiType = selectedTypes.length > 1;
const isSinglePackage = selectedTypes.length === 1 && PACKAGE_PRODUCTION_TYPES.includes(selectedTypes[0]);
const isSingleNonPackage = selectedTypes.length === 1 && !PACKAGE_PRODUCTION_TYPES.includes(selectedTypes[0]);
// For backward compat in renderDynamicFields and getQuantityLabel:
const activeProductionType = isSingleNonPackage ? selectedTypes[0] : (isSinglePackage ? selectedTypes[0] : "");
```
