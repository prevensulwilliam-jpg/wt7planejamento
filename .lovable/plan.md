

# Campo Banco/Origem no DoubtCard

## Changes in `src/pages/ReconciliationPage.tsx`

### 1. Update `classifyAs` signature (line 443)
Add optional `enrichedDescription?: string` parameter. Use it instead of `tx.description` in revenue/expense inserts (lines 459, 471).

### 2. Update `DoubtCard` component (lines 741-840)
- Update `classifyAs` type signature to include optional 4th param `enrichedDescription?: string`
- Add `bankNote` state
- Add text input field between category grid and action buttons (after line 812)
- Update `handleConfirm` to build enriched description and pass it as 4th arg
- Update transfer confirm button to also pass enriched description

### Files
| File | Changes |
|------|---------|
| `src/pages/ReconciliationPage.tsx` | 3 edits: classifyAs signature+usage, DoubtCard type+state+input+confirm |

