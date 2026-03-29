

# Sprint 1 — Módulo Kitnets Completo

## Resumo
Implementar 3 páginas completas (KitnetsPage, ManagerKitnetsPage, EnergyPage), 1 hook de dados, e atualizar o roteamento. Tudo conectado ao Supabase com dados reais das tabelas `kitnets`, `kitnet_entries`, `celesc_invoices` e `energy_readings`.

---

## Arquivos a Criar

### 1. `src/hooks/useKitnets.ts`
Hook centralizado com React Query:
- `useKitnets()` — busca todas as kitnets da tabela `kitnets`
- `useKitnetEntries(month)` — busca `kitnet_entries` filtrado por `reference_month`, com join em `kitnets` via `kitnet_id`
- `useKitnetSummary(month)` — calcula KPIs: total recebido, ocupadas, manutenção, vacâncias
- `useCelescInvoices(month?)` — busca faturas da tabela `celesc_invoices`
- `useEnergyReadings(month, complex)` — busca leituras de `energy_readings` com join em `kitnets`
- Mutations: `useUpdateKitnet`, `useCreateKitnetEntry`, `useCreateCelescInvoice`, `useSaveEnergyReadings`

### 2. `src/pages/KitnetsPage.tsx` — Admin `/kitnets`
3 abas usando shadcn Tabs:

**Aba Visão Geral:**
- 4 KpiCards: Total Recebido, Ocupadas, Manutenção, Vacâncias
- 2 grids (RWT02 com 8 unidades, RWT03 com 5) usando PremiumCard
- Cada card: código, inquilino, aluguel, bolinha de status (verde/amarelo/vermelho)
- Botão "Editar" abre Dialog com campos: inquilino, valor aluguel, status (select)
- Skeleton loading, empty state

**Aba Lançamentos:**
- Filtro de mês (input type month)
- Tabela com colunas: Kitnet, Inquilino, Tipo, Valor, Data, Descrição, Quem lançou
- Dados de `kitnet_entries` com join `kitnets`
- Botão "Novo Lançamento" → Dialog: kitnet (select), tipo (select com 5 opções), valor, data, descrição, mês referência
- Skeleton + empty state

**Aba Relatório Mensal:**
- Seletor de mês
- Tabela agrupada por complexo: unidade, inquilino, aluguel bruto, IPTU, CELESC, SEMASA, taxa ADM, total líquido
- Totais por complexo e total geral
- Botão "Exportar CSV" (gera e baixa arquivo)
- Filtra `kitnet_entries` onde type inclui dados de payment

### 3. `src/pages/ManagerKitnetsPage.tsx` — Portal Manager `/manager/kitnets`
Página isolada (sem AdminLayout/sidebar):
- Header: WT7Logo pequeno + "Portal Administração Kitnets" + botão Sair
- Verificação de role `kitnet_manager` via `get_user_role`, redirect se não autorizado
- Seletor de mês no topo
- Grid 13 kitnets com cards: código, inquilino, status, aluguel, botão "Lançar Repasse"
- Modal "Lançar Repasse" (Dialog): período início/fim (date pickers), aluguel bruto, IPTU+Taxa Lixo, CELESC, SEMASA, taxa ADM (10% auto), total líquido calculado em tempo real com card dourado, banco/agência/conta pré-preenchidos, observações
- Salva em `kitnet_entries` com `created_by = auth.uid()`
- Resumo do mês (4 cards): Total Recebido, Manutenção, Atrasos, Vacâncias
- Histórico de lançamentos do mês em tabela simples

### 4. `src/pages/EnergyPage.tsx` — Admin `/energy`
2 abas:

**Aba Faturas CELESC:**
- Botão "Nova Fatura" → Dialog: complexo (RWT02/RWT03), mês referência, vencimento, kWh total, valor total, COSIP, %PIS/COFINS, %ICMS, kWh solar, valor pago
- Campo calculado: Tarifa R$/kWh = (total - COSIP) ÷ kWh em card dourado
- Tabela de faturas existentes
- Salva em `celesc_invoices`

**Aba Leituras & Cobrança:**
- Seletor mês + complexo
- Grid unidades: unidade, inquilino, leitura anterior (auto), campo leitura atual, kWh calculado, valor calculado (kWh × tarifa do mês)
- Tarifa puxada de `celesc_invoices` do mês/complexo
- Botão "Salvar Todas as Leituras" grava em `energy_readings`
- Card resumo: Total cobrado, Total pago CELESC, Margem Solar (verde)

### 5. Atualizar `src/App.tsx`
- Importar `KitnetsPage`, `ManagerKitnetsPage`, `EnergyPage`
- Substituir `PlaceholderPage` nas rotas `/kitnets`, `/energy`
- Rota `/manager/kitnets` usa `ManagerKitnetsPage` (com AuthGuard mas sem AdminLayout)

---

## Detalhes Técnicos

- **Componentes reutilizados:** PremiumCard, KpiCard, GoldButton, WtBadge, WT7Logo
- **Formatação:** `formatCurrency`, `formatMonth`, `getCurrentMonth` de `@/lib/formatters`
- **UI:** shadcn Dialog, Tabs, Select, Input, Table, Calendar/Popover (date pickers com `pointer-events-auto`)
- **Validação:** campos obrigatórios nos forms, toast de sucesso/erro via `useToast`
- **Loading:** Skeleton components em todas as tabelas e grids
- **Empty states:** mensagem quando não há dados
- **CSV export:** gera Blob com dados formatados, aciona download via link temporário
- **Sem alterações no DB:** tabelas e RLS já existem e cobrem os cenários

