

# Fix — Camila como transferência + anti-duplicata no recategorizar

## 1. `src/lib/categorizeTransaction.ts` — Adicionar variações do sobrenome Camila

Linha 41: substituir `"camila fuenfstueck adriano"` por 3 entradas:
```
"camila fuenfstueck adriano",
"camila fuenstueck adriano",
"fuenfstueck",
```

## 2. `src/pages/ReconciliationPage.tsx` — Anti-duplicata no recategorizeMutation

Linhas 537-549: após os blocos de insert existentes (que já checam `!tx.matched_revenue_id` / `!tx.matched_expense_id`), adicionar dois `else if` para atualizar a categoria quando já existe vínculo:

```tsx
else if (isAuto && result.intent === "receita" && tx.matched_revenue_id) {
  await supabase.from("revenues").update({ source: result.category }).eq("id", tx.matched_revenue_id);
} else if (isAuto && result.intent === "despesa" && tx.matched_expense_id) {
  await supabase.from("expenses").update({ category: result.category }).eq("id", tx.matched_expense_id);
}
```

Also: remove the lines that overwrite `matched_revenue_id`/`matched_expense_id` with null when they already exist (lines 548-549 in the update call should only set these if `revenueId`/`expenseId` are non-null).

## 3. Database cleanup (via migration)

Run SQL to:
- Clean duplicate revenues/expenses
- Mark Camila transactions as ignored/transferência
- Delete erroneous Saúde expenses from Camila

## Files Changed
| File | Action |
|------|--------|
| `src/lib/categorizeTransaction.ts` | Add Camila surname variations |
| `src/pages/ReconciliationPage.tsx` | Add else-if update branches in recategorizeMutation |
| DB migration | Cleanup Camila + duplicates |

