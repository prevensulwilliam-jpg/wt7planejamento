# CLAUDE.md — Projeto WT7
> Contexto completo para novas sessões Claude Code.
> Última atualização: 06/04/2026
> Gerado a partir do estado real do repositório.

---

## O que é o WT7

Sistema de gestão financeira e patrimonial pessoal do William Tavares.
Uso diário interno. Não é SaaS público.

- **URL produção:** https://wt7planejamento.lovable.app
- **Repositório:** https://github.com/prevensulwilliam-jpg/wt7planejamento.git
- **Pasta local:** `C:\Users\Usuário\Desktop\CLAUDE WILLIAM\wt7`
- **Branch principal:** `main`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite (Lovable) |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Supabase: PostgreSQL, RLS, Edge Functions (Deno) |
| Auth | Supabase Auth + roles customizados (`admin`, `kitnet_manager`) |
| IA | Lovable gateway → Gemini 2.5 Flash (edge function `wisely-ai`) |
| Deploy | `git push origin main` → Lovable auto-deploy frontend |
| Data fetching | TanStack Query (useQuery, useMutation) |

---

## Supabase — ATENÇÃO CRÍTICA

| Item | Valor |
|------|-------|
| Project ref correto (Lovable) | `hbyzmuxkgsogbxhykhhu` |
| Project ref do token pessoal | `tarvvkgqbtbsysyaduqm` ← ERRADO para o app |
| Token pessoal William | `sbp_47cb2e4646a9eb9a6838b91c9e015cea73141c79` |

**🚨 REGRA FUNDAMENTAL:** O WT7 usa **Lovable Cloud** como plataforma. Todo acesso ao Supabase deve ser feito pelo **painel do Lovable** (não pelo supabase.com diretamente).
- Supabase dashboard: `Lovable → projeto → Supabase`
- Edge Functions: `Lovable → Supabase → Edge Functions`
- SQL Editor: `Lovable → Supabase → SQL Editor`
- Auth settings: `Lovable → Supabase → Authentication`
- **Nunca** navegar para `supabase.com/dashboard` diretamente
- **Nunca** usar CLI com token pessoal (projeto errado)

### Aplicar migrations
1. Escrever SQL em `supabase/migrations/YYYYMMDD_nome.sql`
2. Commitar e pushar
3. Rodar o SQL **manualmente** no SQL Editor (Lovable → Supabase → SQL Editor)
4. Lovable **não aplica migrations automaticamente**

### Migrations pendentes de aplicar no banco correto
```sql
-- energy_config (tarifa por complexo)
CREATE TABLE IF NOT EXISTS energy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residencial_code text NOT NULL UNIQUE,
  tariff_kwh numeric(10,4) NOT NULL DEFAULT 1.0600,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);
INSERT INTO energy_config (residencial_code, tariff_kwh)
  VALUES ('RWT02', 1.0600), ('RWT03', 1.0600) ON CONFLICT DO NOTHING;
ALTER TABLE energy_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read energy_config" ON energy_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin can modify energy_config" ON energy_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- payment_date em celesc_invoices
ALTER TABLE public.celesc_invoices ADD COLUMN IF NOT EXISTS payment_date DATE;
```

---

## Rotas da aplicação (`src/App.tsx`)

| Path | Componente | Acesso |
|------|-----------|--------|
| `/dashboard` | DashboardPage | admin |
| `/naval` | NavalPage | admin |
| `/revenues` | RevenuesPage | admin |
| `/expenses` | ExpensesPage | admin |
| `/banks` | BanksPage | admin |
| `/reconciliation` | ReconciliationPage | admin |
| `/patterns` | PatternsPage | admin |
| `/categories` | CategoriesPage | admin |
| `/kitnets` | KitnetsPage | admin |
| `/energy` | EnergyPage | admin |
| `/constructions` | ConstructionsPage | admin |
| `/assets` | AssetsPage | admin |
| `/wedding` | WeddingPage | admin |
| `/goals` | GoalsPage | admin |
| `/taxes` | TaxesPage | admin |
| `/projections` | ProjectionsPage | admin |
| `/reports/kitnets` | KitnetsReportPage | admin |
| `/reports/commissions` | CommissionsPage | admin |
| `/users` | UsersPage | admin |
| `/manager/kitnets` | ManagerKitnetsPage | admin + kitnet_manager |
| `/financial/billing` | FinancialBillingPage | público |
| `/partner/projects` | PartnerProjectsPage | público |

---

## Tabelas no banco

| Tabela | Campos relevantes |
|--------|------------------|
| `kitnets` | code, residencial_code, unit_number, tenant_name, tenant_phone, rent_value, status, contract_url |
| `kitnet_entries` | kitnet_id, reference_month, rent_gross, iptu, semasa, celesc, adm_fee, total_liquid |
| `celesc_invoices` | residencial_code, reference_month, due_date, payment_date, kwh_total, invoice_total, cosip, pis_cofins_pct, icms_pct, solar_kwh_offset, amount_paid, tariff_per_kwh |
| `energy_readings` | kitnet_id, reference_month, reading_previous, reading_current, consumption_kwh, amount_to_charge, tariff_per_kwh, celesc_invoice_id |
| `energy_config` | residencial_code (UNIQUE), tariff_kwh (default 1.0600) |
| `revenues` | description, amount, received_at, reference_month, source, category_id |
| `expenses` | description, amount, paid_at, reference_month, category_id |
| `bank_accounts` | name, bank, balance, last_updated |
| `bank_transactions` | description, amount, date, reconciled |
| `assets` | name, type, value, acquisition_date |
| `user_roles` | user_id, role (app_role enum: admin, kitnet_manager) |

---

## Edge Functions (`supabase/functions/`)

### `wisely-ai`
Principal função de IA. Tem `LOVABLE_API_KEY` injetada pelo Lovable.
Dois modos:

```typescript
// Modo chat Naval (padrão)
supabase.functions.invoke("wisely-ai", {
  body: { messages: [...], stream: false }
})

// Modo extração CELESC
supabase.functions.invoke("wisely-ai", {
  body: { action: "extract-celesc", imageBase64: "...", mediaType: "image/jpeg" }
})
// Retorna: { ok: true, data: { reference_month, due_date, kwh_total, invoice_total, cosip, ... } }
```

### `extract-celesc-invoice`
Versão standalone — deployada no projeto errado (`tarvvkgqbtbsysyaduqm`). **Não usar.**
Usar sempre o modo `action: "extract-celesc"` do `wisely-ai`.

### `pluggy-sync`
Sincronização bancária via Pluggy.

---

## Componentes WT7 (`src/components/wt7/`)

| Componente | Props principais | Uso |
|-----------|----------------|-----|
| `MonthPicker` | `value: string (YYYY-MM)`, `onChange: (v: string) => void`, `className?` | Substitui TODO `<Input type="month">` |
| `DatePicker` | `value: string (YYYY-MM-DD)`, `onChange: (v: string) => void`, `placeholder?` | Substitui TODO `<Input type="date">` |
| `GoldButton` | `onClick`, `disabled`, `className` | Botão padrão dourado |
| `PremiumCard` | `glowColor?`, `className` | Card com glow opcional |
| `KpiCard` | `label`, `value: number`, `color: "gold" \| "red" \| "green"` | Card de KPI |
| `WtBadge` | `variant: "green" \| "gold" \| "red"`, `children` | Badge colorido |
| `AdminSidebar` | — | Sidebar do admin com todos os links |
| `KitnetModal` | `kitnet`, `open`, `onOpenChange`, `onUpdated` | Modal 3 abas: Dados / Contrato / Fechamentos |
| `NavalChat` | — | Chat flutuante com Naval (IA financeira) |

```tsx
// MonthPicker
import { MonthPicker } from "@/components/wt7/MonthPicker";
<MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />

// DatePicker
import { DatePicker } from "@/components/wt7/DatePicker";
<DatePicker value={form.due_date} onChange={v => set("due_date", v)} placeholder="Vencimento" />
```

---

## Hooks (`src/hooks/useKitnets.ts`)

```typescript
useKitnets()                              // todas as kitnets
useUpdateKitnet()                         // atualiza kitnet
useKitnetSummary(month)                   // resumo por complexo
useKitnetEntries(month)                   // fechamentos do mês
useCreateKitnetEntry()                    // cria fechamento (também cria revenue automático)
useKitnetFechamentos(kitnetId)            // histórico de fechamentos de uma kitnet
useLastEnergyReading(kitnetId)            // última leitura de energia de uma kitnet
useCelescInvoices(month?)                 // faturas CELESC
useCreateCelescInvoice()                  // cria fatura
useUpdateCelescInvoice()                  // edita fatura
useEnergyReadings(month, residencialCode?)// leituras por complexo/mês
useSaveEnergyReadings()                   // upsert leituras (onConflict: "id")
useEnergyConfig()                         // tarifa R$/kWh por complexo
useUpdateEnergyTariff()                   // atualiza tarifa (admin only)
useEnergyReadingsSummary(month)           // soma amount_to_charge por residencial_code
```

---

## Módulos da aplicação

### KitnetModal — 3 abas
- **Dados:** tenant_name, tenant_phone, rent_value, status, bank info
- **Contrato:** upload PDF → Supabase Storage bucket `contracts` → path: `{residencial_code}/{kitnet_code}/{timestamp}_{filename}`
- **Fechamentos:** lista histórico + formulário com calculadora CELESC (leitura anterior auto-fill via `useLastEnergyReading`)

### Portal Manager (`/manager/kitnets`)
- Auth: role `kitnet_manager` OU `admin`
- Admin vê botão **"← Dashboard"** no header → navega para `/dashboard` sem logout
- Manager não vê esse botão
- Energia Solar: tarifa vem de `energy_config`, manager só lê

### Energia Solar (`/energy`) — 3 abas
**Faturas CELESC:**
- Colunas: Complexo, Mês, Vencimento, Pagamento, kWh, Total Fatura, Solar kWh, Pago, Tarifa/kWh, Editar
- Upload com IA: foto/PDF → base64 → `wisely-ai` action `extract-celesc` → auto-preenche
- Tarifa calculada = (Total - COSIP) ÷ kWh

**Leituras & Cobrança:**
- Tarifa editável admin (salva em `energy_config`) — padrão R$1,06/kWh
- Cálculo: kWh = Atual - Anterior; Valor = kWh × tarifa config (não usa tariff_per_kwh da fatura)
- KPI: Total Cobrado / Total Pago CELESC / Margem Solar

**Balancete:**
- Por complexo: Valor Fatura (vermelho) | Valor Cobrado | Saldo Solar (verde)
- Saldo Total dourado

---

## Decisões arquiteturais (não revisitar)

| Decisão | Motivo |
|---------|--------|
| Tarifa energia = `energy_config.tariff_kwh` | Fixa por complexo, independente da fatura CELESC |
| `MonthPicker` e `DatePicker` em todo o sistema | Zero digitação para datas — sempre clicável |
| Edge functions via Lovable dashboard | CLI acessa projeto errado |
| `supabase.functions.invoke()` — nunca `fetch()` manual | fetch manual não tem auth nem URL corretos |
| Storage contratos: bucket `contracts` privado | Policies por role |

---

## Padrões de código

```typescript
// ✅ Chamar edge function
const { data, error } = await supabase.functions.invoke("wisely-ai", {
  body: { messages: [...] }
});

// ✅ Mutation com invalidação
const qc = useQueryClient();
return useMutation({
  mutationFn: async (...) => { ... },
  onSuccess: () => qc.invalidateQueries({ queryKey: ["tabela"] }),
});

// ✅ RLS admin
USING (public.has_role(auth.uid(), 'admin'::public.app_role))

// ✅ Verificar role no frontend
const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
const isAdmin = !!data;

// ✅ Upsert energy readings
supabase.from("energy_readings").upsert(readings, { onConflict: "id" })
```

---

## Fluxo de deploy

```bash
git add arquivo.tsx
git commit -m "feat: descrição"
git pull --rebase origin main   # Lovable pode ter auto-commitado
git push origin main            # → Lovable rebuild automático
```

---

## Últimas alterações (abril 2026)

| Data | O que foi feito |
|------|----------------|
| 05/04 | `MonthPicker` e `DatePicker` — substituídos em todo o sistema (34 ocorrências, 16 arquivos) |
| 05/04 | Botão "← Dashboard" no Portal Manager para admin |
| 05/04 | Estrutura `Desktop\claude\` com CLAUDE.md por projeto |
| 04/04 | Colunas Vencimento e Data Pagamento na tabela de faturas CELESC |
| 04/04 | Botão Editar faturas CELESC (dialog pré-preenchido) |
| 04/04 | Aba Balancete Financeiro em Energia Solar |
| 04/04 | Tarifa fixa R$1,06/kWh em `energy_config` (admin edita, manager lê) |
| 04/04 | Upload fatura CELESC com IA (Gemini via wisely-ai action extract-celesc) |
| 03/04 | Portal Manager completo (auth, grid, KitnetModal, Energia Solar) |
| 03/04 | KitnetModal 3 abas: Dados, Contrato, Fechamentos |

---

## Pendências conhecidas

- **UsersPage.tsx:** usa `<input type="month">` HTML nativo — não foi substituído pelo MonthPicker
- **wisely-ai extract-celesc:** confirmar que versão com `action: "extract-celesc"` está deployada em `hbyzmuxkgsogbxhykhhu`
- **Migrations pendentes:** `energy_config` e `payment_date` (rodar SQL acima no banco correto)
- **Dashboard de kitnets:** planejado — mostrará totais por residencial + valor energia solar
