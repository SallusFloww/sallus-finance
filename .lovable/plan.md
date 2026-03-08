

## Plan: Fix Users Page to be 100% Functional

### Issues Identified

1. **Console Warning (Ref on DropdownMenu):** `DropdownMenuTrigger asChild` wrapping a `Button` in the actions column is generating a React ref warning. The `Button` component likely needs `forwardRef` or the trigger needs adjustment.

2. **Visualizador role missing from RoleSummaryCards:** `RoleSummaryCards.tsx` hardcodes `Admin, Gestor, Operacional, Financeiro, Leitura` but the DB system role is `Visualizador`. Users with this role won't appear in the count cards.

3. **Role mismatch between summary cards and DB:** The summary cards show 5 hardcoded roles, but the actual system roles from the database may only include 3-4 (e.g., Admin, Gestor, Visualizador). Cards for non-existent roles show "0 usuarios" unnecessarily.

4. **Self-action protection missing:** An admin can deactivate or remove themselves, which would lock them out.

### Changes

**1. `src/components/users/RoleSummaryCards.tsx`**
- Add `Visualizador` to `ROLE_SUMMARY_CONFIG` (same config as Leitura)
- Make the grid dynamic: only render cards for roles that actually exist in the fetched system roles, instead of hardcoding all 5

**2. `src/pages/Users.tsx`**
- Pass `roles` (from DB) to `RoleSummaryCards` so it only shows relevant role cards
- Fix DropdownMenu ref warning: wrap the trigger button properly or use `asChild` correctly
- Add self-protection: prevent current user from deactivating/removing themselves
- Add confirmation dialog for destructive actions (deactivate/remove user)

**3. `src/components/users/RoleSummaryCards.tsx`**
- Accept a `roles` prop to filter which cards to show
- Map `Visualizador` -> Leitura display config

**4. Minor UX Polish**
- Show "Você" badge next to the current user's row
- Disable role dropdown for the current user (prevent self-demotion)

