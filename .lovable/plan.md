
# UI Improvement + Real-time Total Preview — ProductionForm.tsx

## Scope (read-only areas remain untouched)
- **No submit logic changes** — `handleSubmit`, `onSubmit`, `toggleType`, `updatePerTypeValue`, all hooks remain identical.
- **No schema changes** — purely UI + one `useMemo`.
- **Changes confined to:** the card "Tipo de Produção" (lines 1183–1361) + import of `useMemo`.

---

## Change 1 — Add `useMemo` import and `totals` memo

**Location:** Line 1 — add `useMemo` to the React import.

**Location:** After line 294 (derived flags block), insert:

```typescript
// ===================================================================
// REAL-TIME TOTALS (pre-check display)
// ===================================================================
const totals = useMemo(() => {
  const toNum = (s?: string) =>
    parseFloat(String(s || "0").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
  const totalValue = selectedTypes.reduce(
    (acc, t) => acc + toNum(perTypeValues[t]?.totalValue),
    0
  );
  const totalQty = selectedTypes.reduce(
    (acc, t) => acc + (toNum(perTypeValues[t]?.quantity) || 1),
    0
  );
  return { totalValue, totalQty };
}, [selectedTypes, perTypeValues]);

const formattedTotal = totals.totalValue.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});
```

---

## Change 2 — Header of the "Tipo de Produção" card

**Current (lines 1184–1191):**
```tsx
<div className="flex items-center gap-2">
  <Layers className="h-4 w-4 text-violet-600" />
  <Label className="text-violet-600 font-medium">Tipo de Produção *</Label>
  {isMultiType && (
    <span className="ml-auto text-xs bg-violet-500/20 text-violet-700 px-2 py-0.5 rounded-full font-medium">
      {selectedTypes.length} selecionados
    </span>
  )}
</div>
```

**Replacement:**
```tsx
<div className="flex items-center gap-2">
  <Layers className="h-4 w-4 text-violet-600" />
  <Label className="text-violet-600 font-medium">Tipo de Produção *</Label>
  {isMultiType && (
    <span className="ml-auto text-xs bg-violet-500/20 text-violet-700 px-2 py-0.5 rounded-full font-medium">
      {selectedTypes.length} selecionados
    </span>
  )}
</div>

{/* Total Geral pré-conferência — visible only when ≥1 type has a value */}
{totals.totalValue > 0 && (
  <div className="flex items-center justify-between bg-violet-500/5 border border-violet-500/15 rounded-md px-3 py-1.5">
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Calculator className="h-3 w-3" />
      {isMultiType ? `${totals.totalQty} itens` : `${perTypeValues[selectedTypes[0]]?.quantity || 1} unid.`}
    </span>
    <span className="text-sm font-semibold text-violet-700">{formattedTotal}</span>
  </div>
)}
```

The total bar appears **only when at least one value > 0**, so it stays invisible until the user starts typing values. In single-type mode it shows units; in multi-type it sums quantities.

---

## Change 3 — Compact "checked type" row layout

**Current:** When a type is checked, it shows a full-width checkbox row + below it a `ml-8` block with a 2-column grid for Qtde and Valor. This creates a tall stacked layout.

**Replacement:** Merge everything into **one row** when checked:

```tsx
{/* For each non-package type */}
<div key={type} className="space-y-1">
  <div
    className={cn(
      "flex items-center gap-2 rounded-md cursor-pointer transition-colors px-2 py-1.5",
      isChecked
        ? "bg-violet-500/10 border border-violet-500/25"
        : "hover:bg-muted/40 border border-transparent"
    )}
    onClick={() => toggleType(type)}
  >
    <Checkbox
      checked={isChecked}
      onCheckedChange={() => toggleType(type)}
      onClick={(e) => e.stopPropagation()}
      className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 shrink-0"
    />
    <span className={cn("text-sm flex-1 min-w-0 truncate", isChecked ? "text-violet-700 font-medium" : "text-foreground")}>
      {getProductionTypeLabel(type)}
    </span>

    {/* Inline qty + value — only when checked */}
    {isChecked && (
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Input
          type="number"
          min="1"
          value={typeValues?.quantity || "1"}
          onChange={(e) => updatePerTypeValue(type, "quantity", e.target.value)}
          className="h-7 w-14 text-xs text-center px-1"
          title="Qtde"
        />
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
      </div>
    )}
  </div>

  {/* Sub-field for EXAME / SESSAO (indented, compact) */}
  {isChecked && (
    <div className="ml-6">
      {renderInlineSubField(type)}
    </div>
  )}
</div>
```

Key improvements:
- Row height goes from ~80px stacked → ~32px inline when checked
- Qty input is **narrow (w-14)** and value input is **medium (w-24)** — both right-aligned within the row
- Sub-fields (EXAME/SESSAO) still appear below, with a lighter `ml-6` indent instead of `ml-8`
- Removed separate `<Label>` elements for Qtde and Valor to save space; `title` attribute provides accessibility tooltip

---

## Change 4 — Package rows: same compact inline style

Apply identical inline treatment for package types — qty and value appear on the same row as the radio indicator when selected, matching the non-package treatment.

---

## Summary of line changes in `ProductionForm.tsx`

| Line range | What changes |
|---|---|
| Line 1 | Add `useMemo` to React import |
| Lines 295–302 (after derived flags) | Insert `totals` memo + `formattedTotal` |
| Lines 1183–1193 (card header) | Add total preview bar below the header row |
| Lines 1196–1256 (non-package checkbox rows) | Compact inline row layout |
| Lines 1296–1355 (package rows) | Same compact inline treatment |

**Zero changes to:** submit logic, schema, hooks, `renderDynamicFields`, single-type amber blocks, shared fields, `PackageFields`, footer button.
