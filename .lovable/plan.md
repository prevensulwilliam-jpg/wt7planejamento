

# Sprint 3 — Dashboard Real + Receitas + Despesas + Bancos + Usuários

## Resumo
6 arquivos a criar/atualizar. 1 nova tabela `bank_accounts`. Seed de metas e receitas. Dashboard conectado a dados reais.

---

## 1. Criar tabela `bank_accounts`
Migration SQL:
```sql
CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_type text,
  balance numeric DEFAULT 0,
  last_updated date,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage bank_accounts" ON bank_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
```

## 2. Seed inicial
Insert goals (4 records) and revenues de março/2026 (6 records) conforme especificado.

## 3. `src/hooks/useFinances.ts` — Hook centralizado
- `useRevenues(month?)`, `useCreateRevenue()`, `useDeleteRevenue()`
- `useExpenses(month?)`, `useCreateExpense()`, `useDeleteExpense()`
- `useDashboardKPIs(month)` — calcula totalRevenue, totalExpenses, netResult, revenueBySource, expenseByCategory
- `useRevenueExpenseTrend()` — últimos 6 meses agregados
- `useGoals()`, `useUpdateGoal()`
- `useAssets()`

## 4. `src/pages/DashboardPage.tsx` — Conectar dados reais
- Substituir mock data por hooks reais: `useDashboardKPIs`, `useRevenueExpenseTrend`, `useGoals`, `useKitnets`
- Seletor de mês funcional (ChevronLeft/Right incrementa/decrementa mês)
- KPIs dinâmicos, gráficos com fallback para empty state
- Meta R$100k com gap calculado dinamicamente
- Manter Wisely card como mock
- Skeleton loading nos KPIs

## 5. `src/pages/RevenuesPage.tsx`
2 abas (Lançamentos | Análise):
- **Lançamentos**: 4 KPIs, modal "Nova Receita" (fonte, descrição, valor, tipo, data, mês), tabela com badges coloridos por fonte, delete com AlertDialog, total no rodapé
- **Análise**: BarChart horizontal por fonte, PieChart composição, comparativo 3 meses, export CSV

## 6. `src/pages/ExpensesPage.tsx`
2 abas (Lançamentos | Análise):
- **Lançamentos**: 4 KPIs, modal "Nova Despesa" (categoria com emoji, descrição, valor, tipo, data, mês), tabela com badges, delete com AlertDialog
- **Análise**: PieChart por categoria, BarChart comparativo, card alertas (categorias +20%), export CSV

## 7. `src/pages/BanksPage.tsx`
- Hook `useBankAccounts` inline (query + mutations)
- Card total consolidado no topo
- Grid de cards por conta: banco, tipo (badge), saldo dourado, última atualização
- Modal "Adicionar Conta" e editar saldo

## 8. `src/pages/UsersPage.tsx`
- Busca `user_roles` com join em `profiles` (não auth.users diretamente — usar profiles.id = user_roles.user_id)
- Tabela: Nome, Email (do profile), Role (badge colorido), Data criação
- Badges: admin=dourado, kitnet_manager=ciano, financial=verde, partner=roxo
- Card informativo com URLs de acesso por perfil
- Nota: criação de usuários via painel backend (exibir instrução)

## 9. `src/App.tsx` — Atualizar rotas
Importar e substituir PlaceholderPages para `/revenues`, `/expenses`, `/banks`, `/users`.

---

## Detalhes Técnicos
- Todos os componentes reutilizam PremiumCard, KpiCard, GoldButton, WtBadge, Skeleton
- shadcn: Dialog, AlertDialog, Tabs, Select, Input, Table, Popover
- Recharts: AreaChart (dashboard), BarChart, PieChart, LineChart
- `formatCurrency`, `formatMonth`, `getCurrentMonth` de `@/lib/formatters`
- CSV export com BOM UTF-8, separador `;`
- Loading skeletons + empty states em todas as views
- Toast sucesso/erro em todas as mutations

