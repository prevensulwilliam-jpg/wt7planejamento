

# Fix — Auto-categorizados confirmam automaticamente no import

## Summary
Update `doImport` to auto-confirm high-confidence transactions (create revenues/expenses immediately) and update `recategorizeMutation` to do the same for existing transactions.

## Changes in `src/pages/ReconciliationPage.tsx`

### 1. Update `doImport` (lines 230-267)
- Change status mapping: `auto_categorized` → `matched` (already confirmed)
- Add `category_confirmed` field for auto-categorized rows
- After `importMutation.mutateAsync`, loop through auto-confirmed rows and insert into `revenues`/`expenses`
- Call `recordClassification` for each
- Update toast message to show created counts

### 2. Update `recategorizeMutation` (lines 434-474)
- When confidence is high and intent is not `duvida`: set status to `matched`, set `category_confirmed`
- Insert into `revenues`/`expenses` for each auto-confirmed transaction
- Track revenue/expense counts and invalidate those query keys
- Update toast to show created counts

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Update `doImport` + `recategorizeMutation` logic |

