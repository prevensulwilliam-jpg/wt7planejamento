

# Corrigir build errors + filtro de dúvidas

## Problema
3 fontes de erro:

1. **`kitnet_entry_id` não existe** na tabela `bank_transactions` — o código referencia essa coluna mas ela nunca foi criada no banco
2. **`category_label`** também não existe nos types (linha 196 do hook) — mesma situação
3. **Filtro de dúvidas** na ReconciliationPage (linha 769) exclui transações pendentes sem `category_intent === "duvida"`

## Mudanças

### 1. Migration: adicionar colunas faltantes em `bank_transactions`
```sql
ALTER TABLE public.bank_transactions 
  ADD COLUMN IF NOT EXISTS kitnet_entry_id uuid REFERENCES public.kitnet_entries(id) ON DELETE SET NULL;
```
Nota: `category_label` já existe nos types (linha 188), então o erro de `category_label` na linha 196 do hook é na verdade sobre `kitnet_entry_id`. Confirmado: os erros TS2322 nas linhas 87 e 196 são sobre `kitnet_entry_id` que não existe no tipo Update.

### 2. `src/pages/ReconciliationPage.tsx` (linha 769)
Alterar o filtro de dúvidas:
```typescript
// ANTES
const doubts = allTransactions.filter((t: any) => t.category_intent === "duvida" && t.status === "pending");
// DEPOIS
const doubts = allTransactions.filter((t: any) => t.status === "pending");
```

### 3. `src/hooks/useBankReconciliation.ts` + `src/pages/KitnetsReportPage.tsx`
Após a migration ser aplicada e os types regenerados, os erros TS desaparecem automaticamente. Enquanto isso, adicionar casts `as any` temporários onde necessário para destravar o build.

## Ordem de execução
1. Criar migration para `kitnet_entry_id`
2. Corrigir filtro na ReconciliationPage
3. Adicionar casts `as any` nos pontos com erro de tipo para destravar build imediatamente

