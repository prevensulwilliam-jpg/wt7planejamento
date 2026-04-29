# Totalizar colunas Valor e Saldo no Portal de Comissões

## Contexto

Na tabela do `/commissions/portal` (componente `PrevensulHistory` em `src/pages/CommissionsPortalPage.tsx`), o rodapé `TOTAL` hoje só soma **Pago** (verde) e **Comissão** (dourado). As colunas **Valor** (`contract_total`) e **Saldo** (`balance_remaining − amount_paid`, mesma fórmula usada na linha 1155) ficam vazias no footer (cobertas pelo `colSpan={5}` da célula "TOTAL").

O usuário quer que essas duas colunas também sejam totalizadas, seguindo a mesma lógica visual e de soma de Pago/Comissão.

## Mudanças

**Arquivo:** `src/pages/CommissionsPortalPage.tsx`

### 1. Adicionar dois `useMemo` ao lado dos existentes (linha 914-915)

```ts
const totalValor = useMemo(
  () => displayData.reduce((s, r) => s + (r.contract_total ?? 0), 0),
  [displayData]
);
const totalSaldo = useMemo(
  () => displayData.reduce(
    (s, r) => s + Math.max(0, (r.balance_remaining ?? 0) - (r.amount_paid ?? 0)),
    0
  ),
  [displayData]
);
```

Uso `Math.max(0, ...)` para casar com a fórmula exibida em cada linha (1155) e evitar saldo negativo distorcendo o total.

### 2. Reorganizar o `TableFooter` (linhas 1185-1192)

Atualmente: `colSpan={5}` para "TOTAL" + Pago + Comissão + `colSpan={2}`.

Novo layout (8 colunas alinhadas com o header — Cliente, Valor, Saldo, Parcela, Data Fech., Pago, Comissão, Status, +1 ações):

- Coluna 1 (Cliente): label "TOTAL" em dourado
- Coluna 2 (Valor): `formatCurrency(totalValor)` em cinza/neutro (mesma cor da célula da linha — `#94A3B8`)
- Coluna 3 (Saldo): `formatCurrency(totalSaldo)` em vermelho (`#F43F5E`, mesma cor das células da coluna)
- Colunas 4-5 (Parcela, Data Fech.): `colSpan={2}` vazio
- Coluna 6 (Pago): mantém verde
- Coluna 7 (Comissão): mantém dourado
- Colunas 8-9 (Status + ações): `colSpan={2}` vazio

## Resultado esperado

A linha TOTAL passa a exibir, além de Pago e Comissão, o **Valor total dos contratos** e o **Saldo total a receber** do mês filtrado, respeitando o filtro de status e a busca aplicada (porque usa `displayData`, idêntico aos totais existentes).

Nada mais muda — sem alteração de schema, hook, KPI ou export.
