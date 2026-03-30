

# Fix — Remover último dado hardcoded do Dashboard

## Current State
The DashboardPage.tsx is **already 100% connected to Supabase** via hooks (`useDashboardKPIs`, `useRevenueExpenseTrend`, `useGoals`, `useKitnets`). There are **no mock arrays** to remove.

The only hardcoded value is on line 207:
```tsx
<KpiCard label="Patrimônio Líquido" value={4200000} color="cyan" compact />
```

## Plan
Replace the hardcoded `4200000` with a computed value from real data by summing:
- `assets` table (`estimated_value`)
- `investments` table (`current_amount`)
- `real_estate_properties` table (`property_value`)

### Changes in `src/hooks/useFinances.ts`
Add a `useNetWorth()` hook that queries `assets`, `investments`, and `real_estate_properties`, then sums their values.

### Changes in `src/pages/DashboardPage.tsx`
- Import `useNetWorth`
- Replace `value={4200000}` with `value={netWorth}` from the hook
- Show skeleton while loading

## Files Changed
| File | Action |
|------|--------|
| `src/hooks/useFinances.ts` | Add `useNetWorth()` hook |
| `src/pages/DashboardPage.tsx` | Replace hardcoded 4200000 with hook data |

