

# Correção do card "Faturamentos Novos" — Deduplicação e Replicação

## Problema
A replicação de meses copia `closing_date` para os registros novos, causando duplicatas no cálculo de "Faturamentos Novos". O card soma contratos repetidos em múltiplos `reference_month`.

## Mudanças (arquivo único: `src/hooks/useBilling.ts`)

### 1. Incluir `client_name` na query `allRecords`
Alterar o `.select()` da query `prevensul_billing_all_for_new` para incluir `client_name`, necessário para deduplicação.

### 2. Deduplicar cálculo de `totalNew`
Substituir o reduce simples por lógica que usa um `Set<string>` com chave `client_name__closing_date`, contando cada contrato apenas uma vez.

### 3. Replicação não copia `closing_date`
No `useReplicateMonth`, trocar `closing_date: r.closing_date` por `closing_date: null` para que meses replicados não herdem a data de fechamento original.

