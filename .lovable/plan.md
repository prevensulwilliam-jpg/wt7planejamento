

# Limpar dados — 4 tabelas

## Ação
Executar DELETE em todas as linhas das 4 tabelas via migração SQL:

```sql
DELETE FROM bank_import_history;
DELETE FROM bank_transactions;
DELETE FROM revenues;
DELETE FROM expenses;
```

A ordem importa: `bank_transactions` tem colunas `matched_revenue_id` e `matched_expense_id` que referenciam revenues/expenses, então limpar `bank_transactions` antes.

## Resultado
Todas as 4 tabelas ficarão vazias, prontas para reimportação do zero.

