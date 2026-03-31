

# Add robust error handling to Storage upload block

## Change in `src/pages/ReconciliationPage.tsx` (lines 319-341)

Replace the current upload block with:

1. **Add console.log before upload** — log file name, size, accountId, and importStats
2. **Wrap in its own try-catch** — separate from the main import try-catch
3. **On failure** — show `toast.warning` with the specific error message (import still succeeds)
4. **Check file existence** — log if `fileRef.current?.files?.[0]` is falsy

```typescript
// Line 319-341 becomes:
const fileExists = !!fileRef.current?.files?.[0];
console.log("[Upload] fileRef check:", { fileExists, filesLength: fileRef.current?.files?.length });

if (fileExists) {
  const originalFile = fileRef.current!.files![0];
  const periodDates = rows.map(r => r.date).filter(Boolean).sort();
  
  const importStats = { /* same as current */ };

  console.log("[Upload] Preparing upload:", {
    fileName: originalFile.name,
    fileSize: originalFile.size,
    accountId: selectedAccount,
    importStats
  });

  try {
    await uploadStatementMutation.mutateAsync({
      file: originalFile,
      accountId: selectedAccount,
      importStats
    });
    console.log("[Upload] Success!");
  } catch (uploadErr: any) {
    console.error("[Upload] Failed:", uploadErr);
    toast.warning(`⚠️ Importação OK, mas falha ao salvar arquivo: ${uploadErr.message}`);
  }
} else {
  console.warn("[Upload] Nenhum arquivo encontrado no fileRef");
}
```

Also update the toast.success message to conditionally show "📁 Extrato salvo" only when upload succeeded (use a boolean flag).

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Wrap upload in separate try-catch with logs and warning toast |

