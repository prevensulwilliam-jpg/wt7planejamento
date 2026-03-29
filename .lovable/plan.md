

# Fix — BB Rende Fácil como transferência automática

## Change
In `src/lib/categorizeTransaction.ts`, add 5 new keywords to `TRANSFER_KEYWORDS` array (some already exist, only add missing ones):

```
"rende facil",
"aplic automatica",
"cheque compensado",
"compensacao cheque",
"saldo anterior",
"saldo do dia",
```

Lines 12-24: expand the array. Keywords `"bb rende facil"`, `"aplicacao automatica"`, `"aplicação automática"`, `"resgate automatico"`, `"resgate automático"` already exist — skip duplicates.

No other files changed.

