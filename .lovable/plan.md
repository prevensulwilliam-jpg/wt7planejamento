

# Feature — Botão "Limpar lançamentos do período" na UsersPage

## Summary
Add a second danger zone card in `src/pages/UsersPage.tsx` with period-based cleanup: two month pickers, preview of what will be deleted, double confirmation, then deletes revenues/expenses/bank_transactions within the selected date range.

## Changes in `src/pages/UsersPage.tsx`

### 1. Add state variables
Add `periodOpen`, `cleaningPeriod`, `confirm3`, `periodStart`, `periodEnd` states.

### 2. Add `cleanPeriodData` function
- Validates period selection
- Deletes revenues where `reference_month` is within range
- Deletes expenses where `reference_month` is within range
- Deletes bank_transactions where `date` is within the computed date range
- Invalidates relevant query caches
- Shows toast with counts

### 3. Add second danger card in JSX
Place after the existing "Limpar dados de demonstração" card, inside the same `PremiumCard` with red glow. Contains:
- Period selector (two `<input type="month">`)
- Preview showing what will be deleted
- Double confirmation flow (confirm → final confirm)
- Cancel buttons at each stage

## Files Changed
| File | Action |
|------|--------|
| `src/pages/UsersPage.tsx` | Add period cleanup states, function, and UI card |

