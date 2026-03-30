

# Feature — Classificação automática Fixo/Variável por recorrência

## Summary
Add `detectTransactionType()` to `categorizeTransaction.ts`, then use it in ReconciliationPage (classifyAs + confirmAllAuto), ExpensesPage and RevenuesPage modals. Also run a migration to fix existing records.

## Changes

### 1. `src/lib/categorizeTransaction.ts`
Add at the end of file:
- `FIXED_CATEGORIES`, `VARIABLE_CATEGORIES`, `FIXED_REVENUE_SOURCES`, `VARIABLE_REVENUE_SOURCES` arrays
- `detectTransactionType(category, intent)` → returns `"fixed" | "variable"`

### 2. `src/pages/ReconciliationPage.tsx`
- Import `detectTransactionType`
- In `classifyAs` (lines 663, 680): replace `type: "variable"` with `type: detectTransactionType(category, intent)`
- In `confirmAllAuto` (lines 717, 729): same replacement using `detectTransactionType(category, intent as any)`

### 3. `src/pages/ExpensesPage.tsx`
- Import `detectTransactionType`
- Line 173: change category `onValueChange` to also auto-set type: `onValueChange={v => { const autoType = detectTransactionType(v, "despesa"); setForm(f => ({ ...f, category: v, type: autoType })); }}`

### 4. `src/pages/RevenuesPage.tsx`
- Import `detectTransactionType`
- Line 169: change source `onValueChange` to also auto-set type: `onValueChange={v => { const autoType = detectTransactionType(v, "receita"); setForm(f => ({ ...f, source: v, type: autoType })); }}`

### 5. DB Migration — fix existing records
```sql
UPDATE revenues SET type = 'fixed' WHERE source IN ('kitnets', 'salario');
UPDATE revenues SET type = 'variable' WHERE source IN ('comissao_prevensul', 'laudos', 't7', 'solar', 'dividendos', 'outros_receita');
UPDATE expenses SET type = 'fixed' WHERE category IN ('consorcio', 'academia', 'assinaturas', 'internet', 'telefonia', 'terapia', 'maconaria', 'guarani');
UPDATE expenses SET type = 'variable' WHERE category IN ('alimentacao', 'lazer', 'viagens', 'gasolina', 'farmacia', 'obras', 'terrenos', 'outros', 'cartao_credito');
```

## Files Changed
| File | Action |
|------|--------|
| `src/lib/categorizeTransaction.ts` | Add `detectTransactionType` function |
| `src/pages/ReconciliationPage.tsx` | Use auto-detect in classifyAs + confirmAllAuto |
| `src/pages/ExpensesPage.tsx` | Auto-set type on category select |
| `src/pages/RevenuesPage.tsx` | Auto-set type on source select |
| DB migration | Fix existing records' type field |

