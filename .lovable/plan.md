

# Fix — Evitar duplicação de receitas/despesas no doImport

## Problem
When the same bank statement is imported multiple times, the `doImport` function creates duplicate revenues/expenses because it doesn't check if the `bank_transaction` already has a `matched_revenue_id` or `matched_expense_id`.

## Change

### `src/pages/ReconciliationPage.tsx` (lines 271-277)
After fetching each `btRow` by `external_id`, also select `matched_revenue_id` and `matched_expense_id`. Before creating a revenue/expense, check if the link already exists — if so, skip.

**Current** (line 273-274):
```ts
.select("id")
```

**New:**
```ts
.select("id, matched_revenue_id, matched_expense_id")
```

Then wrap the revenue/expense creation blocks (lines 279-306) with guards:

```ts
if (tx.category_intent === "receita" && !(btRow as any)?.matched_revenue_id) {
  // ... existing insert logic
} else if (tx.category_intent === "despesa" && !(btRow as any)?.matched_expense_id) {
  // ... existing insert logic
}
```

This ensures that even if the same statement is processed multiple times, revenues/expenses are only created once per transaction.

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Add guard checks in doImport (~3 lines changed) |

