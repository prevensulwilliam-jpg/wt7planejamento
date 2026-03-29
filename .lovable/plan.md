

# Sprint 6 — Conciliação Bancária (OFX/CSV + Pluggy Open Finance)

## Summary
Create 2 new DB tables, 4 new source files (hook, 2 parsers, page), 1 edge function. Update App.tsx and AdminSidebar.tsx with new route.

---

## 1. Database Migration
Create `bank_transactions` and `pluggy_connections` tables with RLS policies scoped to admin role (not `USING (true)` — must use `has_role`).

Also add a **unique constraint** on `bank_transactions.external_id` (needed for upsert `onConflict`).

## 2. `src/lib/parseOFX.ts`
OFX parser (SGML regex) + CSV parser (auto-detect BB/XP/generic format). Returns `ParsedTransaction[]` with `external_id`, `date`, `description`, `amount`, `type`, `source`.

## 3. `src/lib/categorizeTransaction.ts`
Rule-based keyword categorizer — no API calls. Covers kitnets, salário, comissão, alimentação, assinaturas, veículo, obras, casamento, etc. Returns category string.

## 4. `src/hooks/useBankReconciliation.ts`
- `useBankTransactions(filters?)` — query with account/month/status filters
- `useImportTransactions()` — upsert mutation
- `useMatchTransaction()` — confirm category + link to revenue/expense
- `useIgnoreTransaction()` — mark as ignored
- `useReconciliationSummary(month)` — computed KPIs from transaction data

## 5. `src/pages/ReconciliationPage.tsx`
3 tabs:
- **Importar**: File upload (drag+drop for .ofx/.csv), account selector, preview table, auto-categorize on import, bank instructions accordion. Pluggy card with "Em breve" badge (shows config instruction if no secrets).
- **Conciliar**: Month/status/account filters, KPIs (credits/debits/pending/matched), transaction list with confirm/edit/ignore actions, bulk confirm button.
- **Histórico**: Full filtered table, BarChart (weekly in/out), PieChart (expense categories), CSV export.

## 6. Edge Function `supabase/functions/pluggy-sync/index.ts`
Pluggy API integration: authenticate → fetch active connections → pull last 30 days transactions → upsert into `bank_transactions`. Graceful error if `PLUGGY_CLIENT_ID` not set.

## 7. Routing & Sidebar
- `App.tsx`: Add `<Route path="/reconciliation" element={<ReconciliationPage />} />` inside admin routes
- `AdminSidebar.tsx`: Add `{ label: "Conciliação", icon: ArrowLeftRight, href: "/reconciliation" }` to "RECEITAS & DESPESAS" group, import `ArrowLeftRight` from lucide-react

---

## Technical Details
- RLS: `has_role(auth.uid(), 'admin'::app_role)` on both new tables (not open `true`)
- Unique constraint on `external_id` for upsert dedup
- Pluggy edge function uses `SUPABASE_SERVICE_ROLE_KEY` (already available) + `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` (user adds later)
- Components: PremiumCard, KpiCard, GoldButton, WtBadge, Skeleton, shadcn Tabs/Dialog/Select/Table/AlertDialog
- Recharts: BarChart, PieChart
- File reading via `FileReader.readAsText()` for OFX/CSV
- No changes to existing files beyond App.tsx and AdminSidebar.tsx

