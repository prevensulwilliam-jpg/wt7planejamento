

# Categorias Completas + Modais Nova Despesa/Receita na Conciliação

## Summary
Update `ReconciliationPage.tsx` only. Three changes: (1) replace fixed doubt buttons with `DoubtCard` component featuring full category selector, (2) add `NewExpenseModal`, (3) add `NewRevenueModal`. Add action buttons in ReconcileTab toolbar.

## Changes in `src/pages/ReconciliationPage.tsx`

### 1. Add constants at top of file
- `DESPESA_OPTIONS` array (23 categories: cartão, energia, internet, telefonia, lazer, alimentação, suplementos, saúde, maçonaria, guarani, consórcio, terapia, obras, terrenos, água, gasolina, farmácia, academia, impostos, casamento, assinaturas, veículo, outros)
- `RECEITA_OPTIONS` array (8 categories: kitnets, salário, comissão prevensul, solar, laudos, t7, dividendos, outros receita)
- `ALL_CATEGORY_LABELS` record mapping all values to display names

### 2. Add `DoubtCard` component
Replaces the inline doubt buttons (lines 540-612). Each card shows:
- Intent toggle (Receita / Despesa / Transferência)
- Category grid selector based on selected intent
- Confirm + Ignore buttons
- Uses local state for `selectedCategory` and `selectedIntent`

### 3. Add `NewExpenseModal` component
Dialog with category grid (DESPESA_OPTIONS), description input, amount, date, type (fixed/variable), reference month. Inserts into `expenses` table.

### 4. Add `NewRevenueModal` component
Same pattern but for revenues. Source grid (RECEITA_OPTIONS), type includes "eventual". Inserts into `revenues` table.

### 5. Update ReconcileTab toolbar (lines 470-479)
Replace single recategorize button with 3 buttons: "+ Nova Receita" (green), "+ Nova Despesa" (red), "🔄 Recategorizar" (gold). Add modal state and render both modals.

### 6. Update doubts section (lines 540-612)
Replace inline JSX with `<DoubtCard>` component usage.

## Additional imports needed
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from ui/dialog
- `Input` from ui/input
- `useToast` from hooks/use-toast (for modals — or keep using sonner `toast`)

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Add 3 components + constants, update ReconcileTab |

No database or other file changes.

