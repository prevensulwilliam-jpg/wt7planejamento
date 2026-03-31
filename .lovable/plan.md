

# Fix definitivo — Mapeamento slug→categoria via `categoryMap.ts`

## Problem
`custom_categories` has names like "Aluguel/Kitnets" which slugify to `aluguel_kitnets`, but `revenues.source` stores `kitnets`. The normalize-based matching fails because these are fundamentally different strings.

## Changes

### 1. New file: `src/lib/categoryMap.ts`
Create with all the maps and helpers as specified:
- `REVENUE_SOURCE_MAP` — maps DB slugs (kitnets, salario, sal_rio, etc.) to `{emoji, name, color}`
- `EXPENSE_CATEGORY_MAP` — maps DB slugs (cartao_credito, alimentacao, etc.) to `{emoji, name, color}`
- `getRevenueDisplay(source)` — lookup with readable fallback
- `getExpenseDisplay(category)` — lookup with readable fallback

### 2. `src/pages/ExpensesPage.tsx`
- Import `EXPENSE_CATEGORY_MAP, getExpenseDisplay` from `categoryMap`
- Replace `getCategoryDisplay` (lines 87-100) with a wrapper around `getExpenseDisplay`
- Replace `allCategoryOptions` (lines 68-85) to build from `EXPENSE_CATEGORY_MAP` entries + any unknown values from data, sorted by usage
- Filter logic (lines 117-128) stays similar but now matches by the map key directly (since options use the raw DB value)

### 3. `src/pages/RevenuesPage.tsx`
- Import `REVENUE_SOURCE_MAP, getRevenueDisplay` from `categoryMap`
- Replace `getSourceDisplay` (lines 85-98) with a wrapper around `getRevenueDisplay`
- Replace `allSourceOptions` (lines 67-83) to build from `REVENUE_SOURCE_MAP` entries + unknown values from data
- Filter logic (lines 115-126) same pattern

## Files Changed
| File | Action |
|------|--------|
| `src/lib/categoryMap.ts` | Create — static maps + helper functions |
| `src/pages/ExpensesPage.tsx` | Use map-based display + options |
| `src/pages/RevenuesPage.tsx` | Use map-based display + options |

