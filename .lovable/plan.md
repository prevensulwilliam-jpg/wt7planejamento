

# Fix — Rotas /investments e /consortiums + tipos Supabase

## Changes

### 1. `src/App.tsx` — Add redirect routes
Add two `<Route>` entries inside the admin layout block:
```tsx
<Route path="/investments" element={<Navigate to="/assets?tab=investimentos" replace />} />
<Route path="/consortiums" element={<Navigate to="/assets?tab=consorcios" replace />} />
```

### 2. `src/components/wt7/AdminSidebar.tsx` — Update hrefs
Change:
- `"/investments"` → `"/assets?tab=investimentos"`
- `"/consortiums"` → `"/assets?tab=consorcios"`

### 3. `src/pages/AssetsPage.tsx` — Read tab from URL
- Add `useSearchParams` import
- Read `searchParams.get("tab")` and use as `defaultValue` on `<Tabs>`

### 4. `src/hooks/useBankReconciliation.ts` — Remove `as any` casts
Replace all `from("bank_transactions" as any)` with `from("bank_transactions")` — table exists in types.ts.

### 5. `src/hooks/useCategories.ts` — Remove `as any` casts
Replace all `from("custom_categories" as any)` with `from("custom_categories")` — table exists in types.ts.

## Files Changed
| File | Action |
|------|--------|
| `src/App.tsx` | Add 2 redirect routes |
| `src/components/wt7/AdminSidebar.tsx` | Update 2 hrefs |
| `src/pages/AssetsPage.tsx` | Add useSearchParams, dynamic default tab |
| `src/hooks/useBankReconciliation.ts` | Remove `as any` casts |
| `src/hooks/useCategories.ts` | Remove `as any` casts |

