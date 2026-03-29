

# Sprint 7 — Conciliação Inteligente: Transferências + Dúvidas + Criação Automática

## Summary
Add 3 new columns to `bank_transactions`, rewrite `categorizeTransaction.ts` with intent/confidence system, update `useBankReconciliation.ts` hook, and evolve `ReconciliationPage.tsx` with smart doubts UI and auto-creation of revenues/expenses.

---

## 1. Database Migration
Add 3 columns to `bank_transactions`:
```sql
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS category_intent text,
ADD COLUMN IF NOT EXISTS category_confidence text,
ADD COLUMN IF NOT EXISTS category_label text;
```

Also update the `status` check constraint to allow `'auto_categorized'` (or remove the check constraint since it's text without one currently — verify first).

## 2. Rewrite `src/lib/categorizeTransaction.ts`
Replace entirely with the new version featuring:
- `TransactionIntent` type: `"receita" | "despesa" | "transferencia" | "duvida"`
- `CategorizationResult` interface with `category`, `intent`, `confidence` ("high"/"low"), `label`
- `TRANSFER_KEYWORDS` array for detecting inter-account transfers (pix, ted, cdb, resgate, user's own account names)
- Separate `REVENUE_RULES` and `EXPENSE_RULES` arrays with labels
- Updated `categorizeTransaction()` accepting `amount?` and `allAccounts?` params
- Priority: transfer detection first → revenue rules → expense rules → doubt fallback (high-amount debits >500 = doubt)
- Updated `CATEGORY_LABELS` with "transferencia" entry
- New `INTENT_CONFIG` export with color/label/badge per intent

## 3. Update `src/hooks/useBankReconciliation.ts`
- `useMatchTransaction`: add `intent?: string` param, include `category_intent: intent` in update payload
- Keep all other hooks unchanged

## 4. Update `src/pages/ReconciliationPage.tsx`

### Import tab changes (doImport function):
- Fetch account names from `accounts` for transfer detection
- Call new `categorizeTransaction(description, type, amount, accountNames)` returning `CategorizationResult`
- Set `category_intent`, `category_confidence`, `category_label` on each row
- Set `status: "auto_categorized"` for high-confidence non-doubt items, `"pending"` otherwise
- Enhanced toast showing transfers/auto/doubts counts

### Reconcile tab changes:
- Filter transactions into 4 groups: `doubts`, `transfers`, `autoCategorized`, `pendingReview`
- **KPIs**: replace current 4 cards with: Dúvidas (gold) | Auto-categorizado (cyan) | Transferências (gray) | Conciliados (green)
- **Doubts card** (amber glow, top priority): each doubt shows date/description/amount + classification buttons (revenue subcategories for credits, expense subcategories for debits, plus "Transferência" and "Ignorar" always available)
- **Transfers info bar**: gray bar showing count of auto-ignored transfers
- **Auto-categorized bar**: green bar with "Confirmar todas" button
- **Existing table** below for remaining pending items

### New `classifyAs` function:
- Updates `bank_transactions` status to matched with intent
- If `receita`: auto-inserts into `revenues` table
- If `despesa`: auto-inserts into `expenses` table
- If `transferencia`: marks as ignored, no revenue/expense created
- Toast feedback per action

### New `confirmAllAuto` function:
- Loops through all `auto_categorized` transactions
- Creates revenues/expenses based on intent
- Marks all as matched
- Summary toast with counts

## 5. Files Changed
| File | Action |
|------|--------|
| `src/lib/categorizeTransaction.ts` | Full rewrite |
| `src/hooks/useBankReconciliation.ts` | Add `intent` param to match mutation |
| `src/pages/ReconciliationPage.tsx` | Evolve import logic + reconcile tab UI |
| Migration SQL | Add 3 columns to `bank_transactions` |

## Technical Details
- No new dependencies needed
- All mutations use existing `supabase` client with `as any` casting (consistent with current pattern)
- Revenue/expense auto-creation uses `reference_month` derived from transaction date (`date.slice(0,7)`)
- Transfer detection checks both keyword list AND user's bank account names
- The `status` column already has no check constraint (it's plain `text` with default), so `"auto_categorized"` works without schema changes beyond the 3 new columns

