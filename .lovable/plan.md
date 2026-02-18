
# Fix: Decimal Comma Parsing in Total Calculation

## Root Cause (confirmed)

The value inputs for each production type use `type="number"`. When the user types `121,95` (Brazilian decimal separator), the browser's native number input behavior strips the comma from `e.target.value`, returning `"12195"` (digits only) instead of `"121,95"`.

The `toNum` function in the `useMemo` then receives `"12195"` and correctly parses it as **12195** — not 121.95. Result: `500 + 200 + 12195 = R$ 12.895,00` instead of the correct `R$ 821,95`.

## Affected Inputs

There are two sets of value inputs to fix — both use `type="number"` and feed `updatePerTypeValue(type, "totalValue", e.target.value)`:

1. **Non-package rows** — Line 1267–1276 (compact inline layout)
2. **Package rows** — Line ~1367–1376 (same structure)

The single-type and package total value inputs (lines 1419 and 1462) already use `type="text"` with `placeholder="0,00"` so they are not affected.

## Fix: Change `type="number"` → `type="text"` + `inputMode="decimal"`

By switching to `type="text"` with `inputMode="decimal"`, the browser:
- Presents a numeric keyboard on mobile (same UX)
- Preserves the raw string in `e.target.value`, including the comma
- Allows `toNum("121,95")` to correctly parse to `121.95`

### Change 1 — Non-package value input (Line 1267–1276)

**Current:**
```tsx
<Input
  type="number"
  step="0.01"
  min="0"
  placeholder="R$"
  value={typeValues?.totalValue || ""}
  onChange={(e) => updatePerTypeValue(type, "totalValue", e.target.value)}
  className="h-7 w-24 text-xs text-center px-1"
  title="Valor Total (R$)"
/>
```

**Replacement:**
```tsx
<Input
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={typeValues?.totalValue || ""}
  onChange={(e) => updatePerTypeValue(type, "totalValue", e.target.value)}
  className="h-7 w-24 text-xs text-center px-1"
  title="Valor Total (R$)"
/>
```

### Change 2 — Package value input (Line ~1371–1375)

Same replacement: `type="text"` + `inputMode="decimal"` + `placeholder="0,00"`, removing `step` and `min`.

### Change 3 — Quantity inputs remain `type="number"` (no change needed)

Quantity fields (lines 1259–1266 and ~1359–1366) accept whole numbers only — the `type="number"` behavior is correct there since no decimal/comma is expected.

### Change 4 — `toNum` function remains identical

The existing `toNum` already handles both formats correctly:
- `"121,95"` → remove dots → `"121,95"` → replace comma → `"121.95"` → parseFloat → **121.95** ✓
- `"1.234,56"` → remove dots → `"123456"` ... wait, that's wrong for 4-digit thousands.

Actually the existing `toNum` has a secondary bug for values like `"1.234,56"` (dots as thousands separators): it would strip the dot first giving `"123456"` then replace comma → `"123456"` → 123456 (wrong). However for typical production values in the hundreds/low thousands without thousand-separators, the fix of `type="text"` alone is sufficient to resolve the reported issue. The more robust parser from the stack overflow hint can be applied simultaneously to future-proof it.

### Change 4 (optional but recommended) — Improve `toNum` to be locale-aware

Apply the robust parser from the audit's stack overflow note to handle both `"1.234,56"` and `"1,234.56"` correctly:

```typescript
const toNum = (s?: string): number => {
  if (!s || s === "") return 0;
  let str = String(s).trim().replace(/[¤$\u20AC£¥\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    // pt-BR format: "1.234,56" — comma is decimal separator
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // en-US format: "1,234.56" — dot is decimal separator
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};
```

## Summary of Changes

| Location | What | Why |
|---|---|---|
| Line 1268 | `type="number"` → `type="text"` + `inputMode="decimal"` | Preserves comma in `e.target.value` |
| Line 1269 | Remove `step="0.01"` + `min="0"` | Not applicable to text inputs |
| Line 1271 | `placeholder="R$"` → `placeholder="0,00"` | Consistent with single-type fields |
| Line ~1368 | Same changes for package value input | Same root cause |
| Lines 300–301 | Improve `toNum` to locale-aware parser | Future-proofs for thousand-separator values |

**No other changes.** Submit logic, schema, hooks, single-type fields, and package logic remain untouched.
