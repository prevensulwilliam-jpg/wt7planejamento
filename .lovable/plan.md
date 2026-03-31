

# Feature — Filtro por banco em Receitas e Despesas

## Summary
Add bank filter extracted from transaction descriptions (pattern `[BANK NAME]`) to both pages, plus helper functions in `categoryMap.ts`.

## Changes

### 1. `src/lib/categoryMap.ts`
Add two functions at the end:
- `extractBank(description)` — regex `\[([^\]]+)\]$` to extract bank name
- `getUniqueBanks(records)` — returns sorted unique bank names from records' descriptions

### 2. `src/pages/RevenuesPage.tsx`
- Import `extractBank, getUniqueBanks`
- Add state: `filterBank` ("all"), `bankFilterOpen` (false)
- Add `availableBanks` memo from `getUniqueBanks(revenues)`
- Add bank filter in `filteredRevenues` useMemo: `if (filterBank !== "all") data = data.filter(r => extractBank(r.description) === filterBank)`
- Add bank filter dropdown button after the source filter dropdown (teal color scheme, 🏦 icon)
- Add bank dropdown panel (same style as source filter dropdown)
- Update "Limpar filtros" condition and onClick to include `filterBank`
- Add ref for click-outside closing of bank dropdown

### 3. `src/pages/ExpensesPage.tsx`
- Same changes as RevenuesPage: import helpers, add `filterBank`/`bankFilterOpen` state, `availableBanks` memo
- Add bank filter in `filteredExpenses` useMemo
- Add bank filter dropdown after category filter dropdown
- Update "Limpar filtros" to include `filterBank`
- Add ref for click-outside

### 4. KPI subtitle
In both pages, when `filterBank !== "all"`, show a small `🏦 {filterBank}` text below the first KPI card value (inside the KPI grid area, as a subtitle span).

## Files Changed
| File | Action |
|------|--------|
| `src/lib/categoryMap.ts` | Add `extractBank` + `getUniqueBanks` |
| `src/pages/RevenuesPage.tsx` | Add bank filter state, dropdown, filter logic |
| `src/pages/ExpensesPage.tsx` | Add bank filter state, dropdown, filter logic |

