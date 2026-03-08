

## Plan: Auto-cadastro com Aprovação do Admin

### Overview

Add a self-registration flow where users create their own account (email + password), then wait for an admin to approve and assign them a role in the company.

### Flow

```text
User visits /auth
    ↓
Clicks "Criar conta"
    ↓
Fills: Name, Email, Password
    ↓
Account created (profile exists, NO company link)
    ↓
User logs in → sees "Aguardando aprovação" screen
    ↓
Admin opens Users → "Solicitações" tab
    ↓
Sees pending users → Approves with role
    ↓
User refreshes → full access
```

### Database Changes

1. **New RPC: `get_pending_registrations`** - Security definer function that returns profiles with no `user_company_roles` entry for the admin's company. Only callable by admins. This avoids RLS issues since admins can't normally see unlinked profiles.

2. **New RPC: `approve_user_registration`** - Takes user_id, company_id, role_id. Creates the `user_company_roles` row. Admin-only, security definer.

### Frontend Changes

**1. `src/pages/Auth.tsx`**
- Add a "signup" mode alongside login/forgot/reset/invite
- Signup form: full name, email, password, confirm password
- Uses existing `signUp()` from AuthContext
- After signup, show success message: "Conta criada! Faça login e aguarde a aprovação do administrador."
- Add "Criar conta" link below login form

**2. `src/components/auth/ProtectedRoute.tsx`**
- Update the "no company" screen message to say "Sua conta está aguardando aprovação do administrador" instead of generic text
- Add a logout button

**3. `src/pages/Users.tsx`**
- Add third tab: "Solicitações" (pending registrations)
- Fetch pending users via `get_pending_registrations` RPC
- Each row shows name, email, created_at
- "Aprovar" button opens dialog to select role
- On approve, calls `approve_user_registration` RPC then invalidates queries
- "Rejeitar" option (optional - just ignore, or could block the profile)

### What stays unchanged
- Existing invite flow continues to work
- `useProductionDB.ts` and financial flows untouched
- Existing auth context `signUp` method already exists and works
- Edge functions unchanged

### Security
- Signup creates an auth user + profile via existing trigger
- No company access until admin explicitly approves
- RPCs use `security definer` with admin role check
- Self-registered users see the blocked screen until approved

