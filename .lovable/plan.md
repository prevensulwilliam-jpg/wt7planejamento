

# Fix Conciliação Bancária — 4 Problems

## 1. Fix `useImportTransactions` (duplicate check instead of upsert)
In `src/hooks/useBankReconciliation.ts`, replace the `upsert` with explicit duplicate detection: query existing `external_id`s first, filter out duplicates, then `insert` only new ones. Return `{ imported, skipped }` counts.

## 2. Fix preview categorization in `ImportTab`
In `src/pages/ReconciliationPage.tsx`, change `preview` state from `ParsedTransaction[]` to `any[]`. In `handleFile`, run `categorizeTransaction()` immediately after parsing, storing intent/confidence/label on each item. Show categorization summary (4 colored boxes: Receitas/Despesas/Transferências/Dúvidas) and a styled transaction list with intent color dots and category labels instead of the plain table.

## 3. Fix `doImport` to pass categorized data
In `doImport`, read directly from the already-categorized `preview` state instead of re-categorizing. Map transfers to `status: "ignored"`. Show detailed toast with counts.

## 4. Fix file encoding
Change `reader.readAsText(file)` to `reader.readAsText(file, "latin1")` for BB OFX compatibility.

## Files Changed
| File | Changes |
|------|---------|
| `src/hooks/useBankReconciliation.ts` | Replace upsert with select+insert dedup logic |
| `src/pages/ReconciliationPage.tsx` | Fix preview state type, categorize in handleFile, new preview UI with intent colors, fix doImport mapping, latin1 encoding |

No database changes needed.

