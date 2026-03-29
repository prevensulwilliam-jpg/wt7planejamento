

# Sprint 2 — Módulo Comissões Prevensul + Portal Financeiro + Import Excel

## Resumo
Criar 3 arquivos novos (hook + 2 páginas), atualizar App.tsx com novas rotas, e instalar dependência `xlsx` para importação de planilhas.

---

## Arquivos a Criar

### 1. `src/hooks/useBilling.ts`
Hook centralizado com React Query conforme especificado:
- `usePrevensulBilling(month?)` — busca `prevensul_billing` com join em `profiles(name)`
- `useBillingSummary(month)` — KPIs calculados: totalBilled, totalReceived, totalCommission, totalRecords
- `useCreateBilling()` — mutation para inserir em `prevensul_billing`
- `useDeleteBilling()` — mutation para deletar registro
- `useImportHistory()` — busca últimos 20 registros de `import_history`
- `useCreateImportHistory()` — mutation para registrar import

### 2. `src/pages/FinancialBillingPage.tsx` — Portal Financeiro `/financial/billing`
Página isolada (sem sidebar), role `financial` ou `admin`. Segue padrão do ManagerKitnetsPage para auth check.

**Componentes:**
- Header: WT7Logo + "Portal Financeiro Prevensul" + botão Sair
- 4 KPI cards (destaque ciano #2DD4BF, comissão em dourado)
- Formulário "Registrar Faturamento" com todos os campos especificados, cálculo de comissão 3% em tempo real
- Card "Importar Planilha Excel" com upload .xlsx, leitura via `xlsx` (npm), preview em tabela, botão confirmar, verificação de duplicatas, registro em `import_history`
- Tabela histórico do mês com ações (deletar com AlertDialog de confirmação)
- Tabela histórico de imports

### 3. `src/pages/CommissionsPage.tsx` — Admin `/reports/commissions`
Página dentro do AdminLayout com 3 abas:

**Aba 1 — Comissões por Mês:**
- Seletor de período (mês inicial/final)
- 4 KPIs: Total Faturado, Total Recebido, Comissão Total, Média Mensal
- LineChart (Recharts) comissão mês a mês
- Tabela completa com linha de totais + botão Exportar CSV

**Aba 2 — Clientes:**
- Tabela agrupada por cliente com totais acumulados
- Badges de status (verde/dourado/vermelho)

**Aba 3 — Histórico de Imports:**
- Tabela de imports com expansão de detalhes

### 4. Atualizar `src/App.tsx`
- Importar `FinancialBillingPage` e `CommissionsPage`
- Substituir PlaceholderPage em `/reports/commissions` por `<CommissionsPage />`
- Adicionar rota isolada `/financial/billing` com `<FinancialBillingPage />` (fora do AuthGuard admin, como `/manager/kitnets`)

### 5. Instalar dependência `xlsx`
- Adicionar pacote `xlsx` ao projeto para leitura de planilhas Excel no browser

---

## Detalhes Técnicos

- **Import Excel**: Usa `xlsx` (SheetJS) para ler .xlsx no browser. Parse da aba pelo formato "MMYYYY". Começa leitura na linha 3. Parse parcela "3/4" → `installment_current=3, installment_total=4`. Duplicatas checadas por `client_name + reference_month + installment_current`
- **CSV Export**: Função `exportCSV` com BOM UTF-8, separador `;`, download via Blob/URL
- **Recharts**: LineChart para evolução de comissões (já disponível no projeto)
- **Componentes reutilizados**: PremiumCard, GoldButton, WtBadge, KpiCard, WT7Logo, Skeleton
- **UI**: shadcn Dialog, AlertDialog, Tabs, Select, Table, Input, Textarea
- **Tema**: fundo #080C10, dourado #C9A84C, ciano #2DD4BF para o portal financeiro
- **Sem alterações no DB**: tabelas `prevensul_billing` e `import_history` já existem com RLS configurado

