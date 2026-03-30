

# Feature — Filtros, ordenação e edição inline em Despesas e Receitas

## Summary
Add `useUpdateExpense` and `useUpdateRevenue` hooks, then enhance both pages with column sorting, type/category filters, and inline editing.

## Changes

### 1. `src/hooks/useFinances.ts`
Add two new mutation hooks:
- `useUpdateExpense` — updates expense by id (category, type, description, amount)
- `useUpdateRevenue` — updates revenue by id (source, type, description, amount)

### 2. `src/pages/ExpensesPage.tsx`
- Add imports: `useMemo` from React, `useUpdateExpense`, `useCategories`, sort/edit icons from lucide
- Add state: `sortField`, `sortDir`, `filterType`, `filterCategory`, `editingId`, `editForm`
- Add `filteredExpenses` memo with type filter, category filter, and multi-column sorting
- Add `toggleSort` helper and `SortIcon` component
- Add filter bar above table: type toggle buttons (Todos/Fixos/Variáveis), category dropdown from `useCategories("despesa")`, clear filters button, record count
- Make table headers clickable (Categoria, Tipo, Valor, Data) with sort icons
- Replace table body with inline-editable rows: category select, description input, type select, amount input — with confirm/cancel buttons via `useUpdateExpense`
- Use `filteredExpenses` instead of raw `data` in the table and footer total

### 3. `src/pages/RevenuesPage.tsx`
Same pattern as ExpensesPage but adapted:
- `useUpdateRevenue` instead of `useUpdateExpense`
- `source` field instead of `category`
- `useCategories("receita")` for filter dropdown
- `received_at` instead of `paid_at`
- Gold/green color (#10B981) for values instead of red
- Type options: fixed/variable/eventual
- Sort fields: source, type, amount, date

### 4. Forms
Both pages already have the Tipo (Fixo/Variável) field in the creation dialog — no changes needed there.

## Files Changed
| File | Action |
|------|--------|
| `src/hooks/useFinances.ts` | Add `useUpdateExpense` + `useUpdateRevenue` |
| `src/pages/ExpensesPage.tsx` | Add filters, sorting, inline editing |
| `src/pages/RevenuesPage.tsx` | Add filters, sorting, inline editing |

