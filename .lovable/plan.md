

# Limpar dados — 4 tabelas

## Ação
Executar DELETE em todas as linhas das 4 tabelas usando o insert tool (para operações de dados):

```sql
DELETE FROM bank_import_history;
DELETE FROM bank_transactions;
DELETE FROM revenues;
DELETE FROM expenses;
```

Ordem: `bank_import_history` e `bank_transactions` primeiro (referências a revenues/expenses), depois as tabelas principais.

## Resultado
Todas as 4 tabelas ficarão vazias, prontas para reimportação do zero.

