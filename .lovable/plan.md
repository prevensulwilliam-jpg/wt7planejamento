# Comissões Externas — Datas, Parcelas, Edição e KPIs ajustados

## O que muda na tela `/commissions/external`

### 1. KPIs (3 cards)
- **Comissões Geradas** (R$) — soma de `commission_value` de todos os lançamentos do mês
- **Comissões Recebidas** (R$) — soma das parcelas pagas (`paid_at` preenchido) cuja data de pagamento cai no mês
- **Registros** — número inteiro puro (ex: `2`, não `R$ 2,00`)

### 2. Formulário "Registrar Comissão" (atualizado)
Mantém: Descrição, Origem, Valor, Taxa comissão (%), Observações.
Acrescenta:
- **Data do lançamento** (DatePicker) — obrigatória
- **Forma de recebimento:**
  - À vista → 1 campo "Data de pagamento prevista"
  - Parcelado → input "Nº de parcelas" (ex: 3) + "Data 1ª parcela" → o sistema gera N parcelas com mesmo valor (`commission_value / N`) e datas mensais consecutivas
  - Tabela editável das parcelas geradas (data + valor) antes de salvar — usuário pode ajustar cada uma

Exemplo: comissão R$ 30.000 em 3x → cria 3 parcelas de R$ 10.000 nas datas 27/04, 27/05, 27/06.

### 3. Histórico — nova UX
Tabela agrupada por lançamento, com expansão para ver parcelas:
- Linha principal: Descrição | Origem | Valor | Comissão Total | Data Lançamento | Status (ex: "2/3 pagas") | Ações
- Ações: **Editar** (abre modal) | **Excluir**
- Expandir mostra parcelas com: Data prevista | Valor | Status (Paga / Pendente) | botão "Marcar como paga" (define `paid_at = hoje`) ou DatePicker para informar data real
- O agrupamento por mês continua filtrando pela `reference_month` do lançamento principal

### 4. Modal de Edição
Mesmos campos do formulário de criação. Permite:
- Editar dados do lançamento
- Adicionar/remover/ajustar parcelas individualmente
- Marcar parcelas como pagas/pendentes

---

## Mudanças técnicas

### Banco — nova migration
```sql
-- Campos no lançamento principal
ALTER TABLE public.other_commissions
  ADD COLUMN IF NOT EXISTS issued_at date,        -- data de lançamento
  ADD COLUMN IF NOT EXISTS installments_count int DEFAULT 1;

-- Nova tabela de parcelas
CREATE TABLE IF NOT EXISTS public.other_commission_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.other_commissions(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_at date,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (commission_id, installment_number)
);
ALTER TABLE public.other_commission_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access oc_installments"
  ON public.other_commission_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
```

### Hook (`src/hooks/useOtherCommissions.ts`)
- Estender query para trazer parcelas (`select("*, installments:other_commission_installments(*)")`)
- Adicionar: `useUpdateOtherCommission`, `useUpsertInstallments`, `useMarkInstallmentPaid`
- `useOtherCommissionsSummary(month)` recalcula:
  - `totalCommission` = soma de `commission_value` dos lançamentos do mês
  - `totalReceived` = soma de `installments.amount` onde `paid_at` está dentro do mês

### Página (`src/pages/ExternalCommissionsPage.tsx`)
- KpiCard "Registros": usar `formatNumber` simples (não currency). Pode ser via prop nova `format="number"` ou texto direto
- FormSection: adicionar DatePickers + bloco de parcelas (radio À vista/Parcelado + tabela)
- HistorySection: linhas expansíveis (usar `Collapsible` ou estado local) + botões Editar/Excluir
- Novo componente `EditCommissionDialog` reutilizando lógica do form

### KpiCard
Verificar se já aceita formato numérico puro; senão adicionar prop `format?: "currency" | "number"` (default currency).

---

## Checklist de entrega
1. Migration SQL (campos novos + tabela parcelas + RLS)
2. Hook atualizado com CRUD de parcelas
3. Form com geração automática de parcelas + edição inline
4. Histórico com expansão, edit modal, marcar como paga
5. KPIs corrigidos (Geradas / Recebidas / Registros como inteiro)
