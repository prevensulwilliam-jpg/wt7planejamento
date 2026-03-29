

# WT7 — Sistema Financeiro Pessoal Premium

## Visão Geral
Sistema financeiro pessoal completo para William Tavares com 4 perfis de acesso (admin, kitnet_manager, financial, partner), design premium dark com dourado, e assistente IA "Wisely" integrado via Claude API.

---

## Fase 1 — Fundação (Design System + Auth + DB)

### Design System Premium Dark
- Configurar paleta dark completa (bg-deep #05080C, gold #C9A84C, cyan #2DD4BF, etc.)
- Importar fontes Google: Syne, Plus Jakarta Sans, JetBrains Mono
- Criar componentes base: KPI Card, Premium Card, Gold Button, Badges, Skeleton shimmer
- Configurar Recharts theme (tooltip, grid, gradientes)

### Supabase Backend
- Criar todas as 20+ tabelas conforme schema (profiles, kitnets, residenciais, revenues, expenses, real_estate_properties, construction_expenses, wedding_budget, goals, etc.)
- Configurar user_roles table separada (admin, kitnet_manager, financial, partner)
- RLS policies por role usando security definer function `has_role()`
- Seed com dados reais (13 kitnets, 5 imóveis, casamento, metas)
- Bucket Storage `documents` para PDFs

### Autenticação & Roteamento
- Tela de login premium com glassmorphism, logo WT7 dourado
- Redirect por role após login (admin→/dashboard, kitnet_manager→/manager/kitnets, etc.)
- Route guards por role
- Layout com sidebar 240px colapsável (admin) e headers limpos (outros perfis)

---

## Fase 2 — Dashboard Admin (Módulo Principal)

### Sidebar Navigation
- Logo WT7 gradiente dourado
- 7 grupos de navegação com ícones Lucide (Visão Geral, Receitas & Despesas, Imóveis, Investimentos, Gestão, Relatórios, Sistema)
- Estado ativo com borda dourada esquerda

### Dashboard `/dashboard`
- Topbar com seletor de mês e botões ação
- Card Meta R$100k/mês (gradiente dourado, progress bar)
- Card Wisely IA (placeholder — integração na Fase 5)
- 4 KPI Cards premium (Receita, Resultado, Despesas, Patrimônio) com sparklines
- Gráfico Receitas vs Despesas (AreaChart dual 6 meses)
- Gráfico Composição de Receitas (DonutChart)
- Tabela receitas do mês
- Metas com progress bars
- Grid kitnets por complexo (RWT02 e RWT03)
- Cards obras em andamento
- Alertas de vencimentos (30 dias)

---

## Fase 3 — Módulos Admin Secundários

### Receitas & Despesas `/revenues`, `/expenses`
- CRUD completo com formulários, tabelas e filtros por mês
- Categorias conforme schema (alimentação, suplementos, etc.)

### Kitnets `/kitnets`
- Grid de 13 unidades com status visual (occupied/vacant/maintenance)
- Detalhes por unidade, histórico de repasses

### Energia Solar `/energy`
- Wizard 3 passos: fatura CELESC → grid leituras → relatório
- Cálculo automático tarifa/kWh e valor por unidade
- Dashboard energia com margem solar, gráficos comparativos

### Obras & Terrenos `/constructions`
- 5 imóveis com KPIs, timeline de etapas, toggle visão total/minha cota
- Tabela despesas da obra com split William/Sócio
- Gráfico projeção de retorno (LineChart cruzamento investimento vs receita)

### Casamento 2027 `/wedding`
- KPIs (orçamento, contratado, pago, a contratar)
- Countdown para 11/12/2027
- Checklist fornecedores em 3 colunas por status
- Cronograma parcelas Villa Sonali
- BarChart impacto no fluxo de caixa 2027

### Projeções `/projections`
- Simulador R$100k com sliders interativos
- 3 cenários (conservador/moderado/agressivo)
- LineChart projeção 2026-2032
- AreaChart stacked por fonte de renda

### Metas, Impostos, Patrimônio, Investimentos, Consórcios
- CRUDs com tabelas, formulários e progress bars
- Badges de status, filtros, export CSV

---

## Fase 4 — Módulos Externos (Manager + Partner)

### Portal Kitnet Manager `/manager/kitnets`
- Header simples (sem sidebar)
- 3 abas: Repasses | Energia | Histórico
- Formulário de repasse com cálculo automático (aluguel - IPTU - CELESC - SEMASA - ADM)
- Ferramenta energia embutida (leituras por unidade)

### Portal Financeiro Prevensul `/manager/billing`
- Header simples
- 4 KPIs ciano (faturado, recebido, comissão, NFs)
- Formulário lançamento com card live "Comissão 3%"
- Importação Excel com preview e dedup
- Tabela espelhando planilha original

### Portal do Sócio `/partner/projects`
- Header simples
- Cards dos projetos filtrados por partner_projects
- Toggle Projeto Total / Minha Cota 50%
- 3 abas: Financeiro | Projeção | Lançar despesa
- Extrato da cota

---

## Fase 5 — Wisely IA (Claude API)

### Edge Function `wisely-analyze`
- Integração Anthropic API via Supabase Edge Function
- System prompt com contexto pessoal de William
- Prompt dinâmico por módulo (dashboard, kitnets, comissões, obras, metas, casamento)

### Card Wisely no Dashboard
- Análise automática ao abrir, skeleton durante loading
- Botão "Atualizar análise"
- 4 bullets de insights

### Botão flutuante "✨ Analisar" por módulo
- Cada página tem análise contextual

### Chat Wisely `/wisely`
- Interface de chat completa
- Histórico salvo em wisely_messages
- Contexto inclui KPIs atuais

---

## Fase 6 — Polish & Extras

### UX
- Framer Motion para transições de página e entrada de cards
- Empty states com ilustrações
- Modal de confirmação para ações destrutivas
- Export CSV/Excel em todos os relatórios
- Responsivo mobile com sidebar colapsável (hamburger)

### Sistema
- Tela Usuários & Acessos (admin)
- Audit log para todas as ações de roles não-admin
- React Query com cache 5 min

### Formatação
- Moeda BRL: `Intl.NumberFormat('pt-BR')`
- Datas: dd/MM/yyyy na UI
- Mês referência: YYYY-MM interno → "Março 2026" display

