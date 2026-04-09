

# Histórico de Acessos — Collapsible + Paginação 20/página

## Mudanças (arquivo único: `src/pages/UsersPage.tsx`)

### 1. Adicionar estado de abrir/fechar e paginação
- Novo state `historyOpen` (default `false`) para controlar visibilidade da seção
- Novo state `historyPage` (default `0`) para paginação
- Reset `historyPage` para 0 quando mudar o filtro de usuário

### 2. Header clicável com chevron
- Tornar o header do card clicável (toggle `historyOpen`)
- Adicionar ícone `ChevronDown`/`ChevronUp` ao lado do título
- Quando fechado, esconder filtro + tabela

### 3. Paginação de 20 registros
- Trocar `loginHistory.slice(0, 50)` por `loginHistory.slice(page * 20, (page + 1) * 20)`
- Adicionar controles "Anterior" / "Próxima" abaixo da tabela
- Mostrar "Página X de Y"

### 4. Filtro por usuário (já existe)
- Manter o `Select` existente — já filtra por usuário
- Incluir admin na lista de opções do filtro (atualmente excluído com `.filter(u => u.role !== "admin")`) — remover esse filtro para mostrar todos os usuários

