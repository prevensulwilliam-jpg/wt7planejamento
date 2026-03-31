

# Update upload logging format in doImport

The upload block already has try-catch and logging from the previous change. This plan updates the log format to match your exact requested style (emoji prefixes instead of `[Upload]` prefix) for easier identification in the console.

## Change in `src/pages/ReconciliationPage.tsx` (lines 319-361)

Replace the existing logging with your exact format:

- **Line 321**: Change `console.log("[Upload] fileRef check:", ...)` → `console.log('🔍 Verificando upload...', { temArquivo, nomeArquivo, contaSelecionada, totalLinhas })`
- **Line 340-345**: Change `console.log("[Upload] Preparing upload:", ...)` → `console.log('📁 Iniciando upload para Storage...')`
- **Line 354**: Change `console.log("[Upload] Success!")` → `console.log('✅ Upload concluído!')`
- **Line 356**: Change `console.error("[Upload] Failed:", ...)` → `console.error('❌ Erro no upload:', uploadErr)`
- **Line 357**: Update toast message to `'Transações importadas, mas falha ao salvar extrato no histórico: ' + uploadErr.message`
- **Line 360**: Change `console.warn("[Upload] Nenhum arquivo...")` → `console.warn('⚠️ Arquivo não encontrado no fileRef')`

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Update log format in upload block |

