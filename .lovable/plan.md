

# Botão Apagar fechamento + tooltip com data no badge "Último fechamento"

## Mudanças (arquivo único: `src/components/wt7/KitnetModal.tsx`)

### 1. Criar hook `useDeleteKitnetEntry` em `src/hooks/useKitnets.ts`
- Mutation que executa `supabase.from("kitnet_entries").delete().eq("id", id)`
- Invalidar queries `["kitnet-fechamentos"]` e `["kitnet-entries"]` no onSuccess

### 2. Botão Apagar ao lado do badge "Último fechamento"
- Adicionar botão vermelho com ícone `Trash2` entre o badge "Último fechamento" e o botão "Editar" (linha ~302-307)
- Confirmar exclusão com `window.confirm("Deseja realmente apagar este fechamento?")`
- Ao apagar, chamar `deleteKitnetEntry.mutateAsync(displayed.id)` e exibir toast

### 3. Tooltip no badge "Último fechamento"
- Usar o campo `created_at` (ou `updated_at`) do registro `displayed` para mostrar a data de lançamento
- Adicionar `title` attribute no `<span>` do badge com texto: `"Lançado em DD/MM/YYYY às HH:MM"`
- Alternativamente, usar componente `Tooltip` do shadcn para melhor UX

### Detalhes técnicos
- O botão Apagar só aparece quando há um fechamento exibido (`displayed` não é null)
- Após apagar, o componente recarrega via invalidação do TanStack Query
- O badge "Último fechamento" só aparece quando `selectedMonth === null`, mantendo essa lógica

