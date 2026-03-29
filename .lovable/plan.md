

# Feature — CRUD de Categorias Personalizadas

## Summary
Create `custom_categories` table with seed data, a `useCategories` hook, a `CategoriesPage` with full CRUD UI, and wire dynamic categories into the reconciliation modals/doubt cards.

---

## 1. Database Migration
- Create `custom_categories` table (id, name, emoji, type, color, active, created_at)
- CHECK constraint on `type` for `despesa`, `receita`, `ambos`
- RLS policy: admin-only via `has_role()`
- Seed 31 default categories via INSERT

## 2. New File: `src/hooks/useCategories.ts`
- `useCategories(type?)` — fetch active categories filtered by type (includes "ambos")
- `useAllCategories()` — fetch all categories (including inactive)
- `useCreateCategory()` — insert mutation
- `useUpdateCategory()` — update mutation
- `useDeleteCategory()` — soft-delete (set `active=false`)

## 3. New File: `src/pages/CategoriesPage.tsx`
- Header with "Nova Categoria" button
- Filter tabs: Todas / Despesas / Receitas
- Grid of `CategoryCard` components with edit/delete actions
- Create/Edit modal with name, type selector, emoji picker (40 emojis), color picker (11 colors), live preview
- Delete via AlertDialog (soft-delete)

## 4. Route & Sidebar
- `App.tsx`: import CategoriesPage, add `<Route path="/categories">` inside admin layout
- `AdminSidebar.tsx`: add `{ label: "Categorias", icon: Tag, href: "/categories" }` in "RECEITAS & DESPESAS" group

## 5. Update `ReconciliationPage.tsx` — Dynamic Categories
- Import `useCategories` hook
- In `DoubtCard`: fetch despesa/receita categories from hook, map to `{value, label}` format replacing hardcoded arrays
- In `NewExpenseModal`: use `useCategories("despesa")` instead of `DESPESA_OPTIONS`
- In `NewRevenueModal`: use `useCategories("receita")` instead of `RECEITA_OPTIONS`
- Keep `DESPESA_OPTIONS` and `RECEITA_OPTIONS` constants as fallbacks (or remove if hook is reliable)

## Files Changed
| File | Action |
|------|--------|
| DB migration | Create table + seed data |
| `src/hooks/useCategories.ts` | New file |
| `src/pages/CategoriesPage.tsx` | New file |
| `src/App.tsx` | Add route |
| `src/components/wt7/AdminSidebar.tsx` | Add nav item |
| `src/pages/ReconciliationPage.tsx` | Replace hardcoded category arrays with hook data in DoubtCard, NewExpenseModal, NewRevenueModal |

