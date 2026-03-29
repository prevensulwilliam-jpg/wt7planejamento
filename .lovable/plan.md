

# Fix Auth Flow — 3 Issues

## Changes

### 1. Configure Supabase Redirect URLs
Use `cloud--configure_auth` to set the Site URL and add the redirect URL for password reset.

### 2. Fix `ResetPasswordPage.tsx` — race condition
Update the `useEffect` to:
- Call `getSession()` immediately to catch already-arrived recovery tokens
- Listen for both `PASSWORD_RECOVERY` and `SIGNED_IN` events
- Check both `hash` and `search` params for `type=recovery`

### 3. Fix `LoginPage.tsx` — missing redirect
Add `navigate("/dashboard", { replace: true })` after successful `signInWithPassword`.

### 4. Fix forwardRef warnings
Console shows `WT7Logo` and `GoldButton` need `React.forwardRef`. Will wrap both components.

