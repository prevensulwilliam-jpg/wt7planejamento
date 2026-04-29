## Contexto

No `/commissions/portal` (componente `PrevensulHistory` em `src/pages/CommissionsPortalPage.tsx`) existem hoje **dois caminhos** para editar um registro:

1. **Clicar no nome do cliente** (linha 1142) → chama `onLoadRecord(r)` → carrega no formulário **"Registrar Faturamento"** no topo da página (vira "Editar — {cliente}"). Esse fluxo já popula tudo: campos do contrato, parcelas, tipo de pagamento, etc.
2. **Botão lápis âmbar** (linha 1168, ícone `Pencil` cor `#F59E0B`) → chama `startEdit(r)` → abre **edição inline** dentro da própria linha da tabela, com um conjunto reduzido de campos (sem parcelas, sem cronograma, sem notas).

Você quer que ao clicar em **Editar** (o lápis âmbar) os dados também apareçam no **Registrar Faturamento** — ou seja, unificar os dois fluxos no formulário completo do topo, que é mais rico.

## Mudança

**Arquivo:** `src/pages/CommissionsPortalPage.tsx`

### 1. Trocar o `onClick` do botão lápis (linha 1168)

De:
```tsx
<button onClick={() => startEdit(r)} ...>
```
Para:
```tsx
<button onClick={() => onLoadRecord(r)} ...>
```

Assim o botão Editar passa a fazer exatamente o mesmo que clicar no nome do cliente: rola/carrega o formulário "Registrar Faturamento" no topo com todos os dados do cliente prontos para edição (incluindo parcelas via `editRecord` no `useEffect` da linha 209-225).

### 2. Adicionar scroll suave para o topo

Para que ao clicar o usuário veja o formulário sendo preenchido (já que o form fica acima da tabela), envolver a chamada:
```tsx
onClick={() => { onLoadRecord(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
```

Aplicar o mesmo scroll também no botão do nome do cliente (linha 1142) para consistência.

### 3. Limpeza opcional (recomendada)

A edição inline (`startEdit`, `cancelEdit`, `saveEdit`, `editingId`, `editForm`, e o branch `isEditing` que renderiza a linha em modo edição em ~1100-1135) fica **órfã** — nada mais aciona. Removê-la deixa o código mais enxuto e elimina ~80 linhas mortas.

Se preferir manter por segurança nesta primeira iteração, deixo apenas as duas trocas de `onClick` acima e sinalizo o código morto para uma limpeza futura.

## Resultado esperado

Tanto clicando no **nome do cliente** quanto no **lápis âmbar** da coluna de ações, os dados do registro carregam no card **"Registrar Faturamento"** no topo (que muda o título para "Editar — {cliente}"), permitindo editar **todos** os campos — inclusive parcelas, cronograma, notas e tipo de pagamento — em vez de apenas os campos básicos da edição inline.

## Pergunta

Quer que eu também **remova a edição inline** (item 3) já nesta mudança, ou prefere manter por enquanto?
