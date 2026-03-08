

# Plan: Refactor Reports.tsx and Split useReceivablesDB.ts

## Overview

Two maintainability improvements that extract code into smaller files without changing any behavior, data flow, or public API.

## 1. Split `Reports.tsx` (2579 lines) into sub-components

The page has clearly separated sections. We'll extract each into its own component file under `src/components/reports/`:

| New File | Lines Extracted | Content |
|----------|----------------|---------|
| `ReportFilters.tsx` | ~1786-1937 | Filter controls (date pickers, selects, director mode toggle, clear button) |
| `ReportExecutiveSummary.tsx` | ~1950-2012 | Stats cards + executive reading + report status |
| `ReportAlerts.tsx` | ~2014-2082 | Management alerts with risk types and suggestions |
| `ReportRevenueMap.tsx` | ~2084-2113 | Top 3 revenue map cards |
| `ReportUnitAnalysis.tsx` | ~2116-2317 | Detailed unit analysis with specialties (Centro Clinico) |
| `ReportConsolidatedTables.tsx` | ~2318-2507 | Unit entries, category, receipt type, operadora, payment method tables, consolidated summary |
| `ReportExports.tsx` | ~2509-2575 + export functions (830-1763) | Footer, CSV/PDF/backup export logic |

The parent `Reports.tsx` will keep all state, `useMemo` computations, and pass them as props. This preserves the exact same rendering and data flow.

**Approach**: Each component receives typed props (read-only data + callbacks). No context changes. No logic changes. Pure extraction.

## 2. Split `useReceivablesDB.ts` (1408 lines) into 3 files

| New File | Content |
|----------|---------|
| `src/hooks/receivables/types.ts` | `DBReceivable` interface, `ReceivablesFilters`, `toReceivable()`, `createHistoryEntry()` (lines 1-118) |
| `src/hooks/receivables/useReceivablesActions.ts` | All mutation callbacks: `addReceivable`, `updateReceivable`, `markAsReceived`, `markAsReceivedMultipleDates`, `markAsGlossed`, `initiateAppeal`, `approveAppeal`, `rejectAppeal`, `reconcileOrphanedReceivables` (lines 174-1128) |
| `src/hooks/useReceivablesDB.ts` | Slim orchestrator: state, fetch, filter, getStats, derived values, imports from the two new files, returns same API |

The public API (`useReceivablesDB()` return type) stays identical. All existing consumers (`Receivables.tsx`, `Conciliation`, `Billing`, etc.) continue working with zero changes.

**Approach for actions split**: Create a factory function `createReceivablesActions(deps)` that receives `{ receivables, currentCompany, profile, fetchReceivables, refreshAll, processingIdsRef }` and returns all action callbacks. The main hook calls this factory.

## 3. Drop backup table (SQL migration)

Execute migration to drop `receivables_dupes_20260108` (inactive backup table with no RLS, no FK references, no active data).

```sql
DROP TABLE IF EXISTS public.receivables_dupes_20260108;
```

## What stays unchanged
- All state management, data flow, financial formulas
- All RLS policies, database schema (except backup table drop)
- All routes, auth, RBAC
- All public hook APIs
- All existing component imports outside Reports

## Execution order
1. Create `src/components/reports/` directory with 7 sub-components
2. Refactor `Reports.tsx` to use new sub-components
3. Create `src/hooks/receivables/` directory with types and actions
4. Refactor `useReceivablesDB.ts` to use new modules
5. Drop backup table via migration
6. Verify build passes

