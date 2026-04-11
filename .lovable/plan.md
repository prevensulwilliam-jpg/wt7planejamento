
# Corrigir filtro `doubts` no `useReconciliationSummary`

## Problema
Linha 223 de `src/hooks/useBankReconciliation.ts` filtra `doubts` com dupla condição (`category_intent === "duvida" && status === "pending"`), inconsistente com a correção já aplicada na `ReconciliationPage`.

## Mudança
**Arquivo:** `src/hooks/useBankReconciliation.ts`, linha 223

```typescript
// ANTES
const doubts = data.filter((t: any) => t.category_intent === "duvida" && t.status === "pending").length;

// DEPOIS
const doubts = data.filter((t: any) => t.status === "pending").length;
```

Mudança de uma única linha. Nenhum outro arquivo afetado.
