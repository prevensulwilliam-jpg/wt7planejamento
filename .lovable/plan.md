

# Rewrite doImport upload block — remove separate try-catch

## What changes

In `src/pages/ReconciliationPage.tsx`, lines **320-369**:

Remove the `uploadOk` flag, the separate `try-catch`, and the conditional logs. Replace with the user's exact upload code placed directly inside the main `try` block (so any error bubbles up and stops execution).

### Replace lines 320-369 with:

```typescript
      const transfers = rows.filter(r => r.status === "ignored").length;
      const doubts = rows.filter(r => r.status === "pending").length;

      // Fazer upload do arquivo para histórico
      if (fileRef.current?.files?.[0]) {
        const originalFile = fileRef.current.files[0];
        const periodDates = rows.map(r => r.date).filter(Boolean).sort();

        await uploadStatementMutation.mutateAsync({
          file: originalFile,
          accountId: selectedAccount,
          importStats: {
            totalTransactions: rows.length,
            newTransactions: rows.length,
            duplicateTransactions: 0,
            autoCategorized: autoRows.length,
            pendingReview: doubts,
            totalCredits: rows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0),
            totalDebits: rows.filter(r => r.type === "debit").reduce((s, r) => s + r.amount, 0),
            periodStart: periodDates[0] || new Date().toISOString().split('T')[0],
            periodEnd: periodDates[periodDates.length - 1] || new Date().toISOString().split('T')[0],
            referenceMonth: periodDates[0]?.slice(0, 7) || month
          }
        });
      }

      toast.success(
        `✅ ${revenues} receitas e ${expenses} despesas criadas automaticamente · ` +
        `${transfers} transferências ignoradas · ` +
        `${doubts > 0 ? `${doubts} aguardam sua classificação` : "nenhuma dúvida"} · ` +
        `📁 Extrato salvo`
      );
```

Also remove the `alert('🚀 doImport foi chamada! Versão NOVA');` debug line (around line 234).

### Key points:
- No separate try-catch — upload errors go to the main catch and show via `toast.error`
- `newTransactions: rows.length` and `autoCategorized: autoRows.length` as requested
- `referenceMonth` uses `month` (state variable) as fallback
- Success toast always shows "📁 Extrato salvo"
- Debug alert removed

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Rewrite upload block in doImport, remove debug alert |

