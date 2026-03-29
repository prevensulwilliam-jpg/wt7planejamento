

# Sprint 4 — All Remaining Modules

## Summary
Create 8 new page files + 1 new hook file. Update App.tsx routes. Seed 5 properties into `real_estate_properties`. No DB schema changes needed — all tables already exist.

---

## Files to Create

### 1. `src/hooks/useConstructions.ts`
Hook with `useProperties()`, `useConstructionExpenses(propertyId?)`, `useCreateConstructionExpense()`, `useUpdateProperty()` — as specified.

### 2. `src/pages/ConstructionsPage.tsx` — `/constructions`
2 tabs: **Projetos** (property cards with status badges, progress bars, partner info, edit modal) | **Despesas** (property selector dropdown, KPIs, expense form with category/split logic, table with totals).

### 3. `src/pages/PartnerProjectsPage.tsx` — `/partner/projects`
Standalone page (no sidebar), purple accent (#8B5CF6). Role check via `has_role` for `partner`/`admin`. Filters `real_estate_properties` by `partner_name` matching logged-in user's profile name. Read-only project cards + expense table per project + projection card (ROI, payback). "Lançar Despesa" button limited to partner's projects.

### 4. `src/pages/WeddingPage.tsx` — `/wedding`
3 tabs: **Financeiro** (Villa Sonali contract summary, installment timeline from `wedding_installments`, KPIs, bar chart) | **Fornecedores** (local state checklist with status badges, totals) | **Cronograma** (visual timeline with milestones, dynamic countdown to 11/12/2027).

### 5. `src/pages/GoalsPage.tsx` — `/goals`
Goal cards from `useGoals()` with animated progress bars, inline value update. "Nova Meta" modal. Special R$100k card with revenue breakdown by source and gap analysis.

### 6. `src/pages/AssetsPage.tsx` — `/assets`
3 tabs: **Bens** (`assets` table, CRUD cards, total patrimônio) | **Investimentos** (`investments` table, yield calculation, CRUD) | **Consórcios** (`consortiums` table, progress bars, CRUD).

### 7. `src/pages/ProjectionsPage.tsx` — `/projections`
3 sections: **Simulador R$100k** (editable inputs, compound growth formula, LineChart with 3 scenarios + R$100k reference line) | **Projeção Kitnets** (timeline table of future rental income factoring partner splits) | **ROI por Projeto** (table with ROI % and payback months).

### 8. `src/pages/KitnetsReportPage.tsx` — `/reports/kitnets`
Month + complex selector (RWT02/RWT03/Todos). KPIs from `kitnet_entries`. Detailed table per unit. Horizontal BarChart of net revenue per unit. 3-month LineChart comparison. CSV export.

### 9. `src/pages/TaxesPage.tsx` — `/taxes`
2 tabs: **Impostos** (`taxes` table, color-coded status cards, alert banner for overdue, CRUD) | **Dívidas** (`debts` table, progress bars, payment tracking, CRUD).

### 10. Update `src/App.tsx`
- Import all 9 new pages
- Replace all remaining `PlaceholderPage` routes with real components
- Move `/partner/projects` from `AuthGuard` wrapper to standalone `<PartnerProjectsPage />`
- Remove `/investments` and `/consortiums` routes (now tabs inside AssetsPage)

### 11. Seed `real_estate_properties`
Insert 5 records (RWT01, RWT04, RJW01, RJW02, RWW01) with the exact data provided.

---

## Technical Details

- **Hooks**: `useConstructions.ts` is new; all other data comes from existing hooks in `useFinances.ts` and `useKitnets.ts`
- **Components reused**: PremiumCard, KpiCard, GoldButton, WtBadge, Skeleton, WT7Logo
- **Charts**: Recharts LineChart, BarChart, PieChart (already in project)
- **UI**: shadcn Dialog, AlertDialog, Tabs, Select, Input, Table, Progress
- **Partner page**: follows ManagerKitnetsPage pattern for standalone auth check
- **Wedding suppliers**: local state array (not a separate DB table)
- **Projections math**: `years = ln(target/current) / ln(1 + rate)`
- **No DB schema changes**: all tables (`real_estate_properties`, `construction_expenses`, `wedding_installments`, `wedding_budget`, `goals`, `assets`, `investments`, `consortiums`, `taxes`, `debts`, `kitnet_entries`) already exist
- **CSV export**: reuse pattern from Sprint 2/3 (BOM UTF-8, `;` separator)

