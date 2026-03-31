

# Fix build errors + ReconciliationPage modifications

## Part 1: Fix ImportHistoryTab build errors
The `KpiCard` expects `value: number` and `color: 'gold' | 'green' | 'red' | 'cyan' | 'gray'`, but ImportHistoryTab passes strings and hex colors. `WtBadge` expects the same color union but gets `'success'`, `'info'`, `'warning'`.

**Fix in `ImportHistoryTab.tsx`:**
- KpiCard `value` props: pass numbers instead of strings (use `formatAs="number"`)
- KpiCard `color` props: map to valid union values (`"gold"`, `"cyan"`, `"green"/"gold"` conditional, `"gray"`)
- WtBadge variants: `'success'` → `'green'`, `'info'` → `'cyan'`, `'warning'` → `'gold'`

## Part 2: ReconciliationPage modifications

### 2a. Add imports (after line 23)
```ts
import { useBankStatementUpload } from "@/hooks/useBankStatementUpload";
import { ImportHistoryTab } from "@/components/reconciliation/ImportHistoryTab";
```

### 2b. Replace HistoryTab usage (line 144)
Replace `<HistoryTab month={month} accounts={accounts} />` with `<ImportHistoryTab accounts={accounts} />`

### 2c. Add upload mutation (after line 157)
```ts
const uploadStatementMutation = useBankStatementUpload();
```

### 2d. Add upload block in doImport (after line 311, before toast.success at line 316)
Save the original file to storage with import stats after successful import.

### 2e. Update toast message (line 319)
Append `📁 Extrato salvo no histórico` to the success message.

## Files Changed
| File | Action |
|------|--------|
| `src/components/reconciliation/ImportHistoryTab.tsx` | Fix KpiCard and WtBadge type errors |
| `src/pages/ReconciliationPage.tsx` | Add imports, upload mutation, upload logic in doImport, update toast |

