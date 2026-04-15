

# Plano: Corrigir exclusão de investimentos e zerar dados

## Problema
O dialog de confirmação mostra `Excluir ""?` com nome vazio. A funcionalidade de exclusão já existe no código, mas precisa de duas correções:

## Mudanças

### 1. Apagar os 2 investimentos existentes no banco
Usar o insert tool para deletar os registros atuais:
```sql
DELETE FROM investments WHERE id IN (
  '94061928-acf1-4806-9730-ad07d3cc4181',
  '487787ff-4605-4789-b5f1-6bcf1ddefaa1'
);
```

### 2. Corrigir bug do nome vazio no dialog de exclusão
O `ConfirmDelete` na linha 624 usa `delInv.name ?? ""`. Se o `name` está vindo como string vazia do banco, o dialog mostra vazio. Vou adicionar um fallback melhor:
```tsx
{delInv && <ConfirmDelete name={delInv.name || delInv.type || "investimento"} .../>}
```

Isso garante que mesmo investimentos sem nome mostrem algo útil no dialog.

## Resultado
- Aba Investimentos ficará zerada, pronta para novas entradas
- Exclusão futura mostrará nome correto no dialog de confirmação

