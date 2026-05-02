## Estado verificado

Já confirmado no banco e repo:
- **4 migrations já aplicadas** (schema consolidado em `20260502151012_*.sql` na sessão anterior):
  - `daily_tasks`, `task_recurrence_rules` ✓
  - `prevensul_billing.pipeline_stage` ✓
  - `goals` com `period_type`, `period_start`, `period_end`, `metric`, `auto_calculated` ✓
  - `whatsapp_notifications_queue`, `whatsapp_config` ✓
- **Edge functions existentes:** `wisely-ai` (v37), `send-whatsapp` (v1-stub) já no repo.
- **Falta:** `generate-recurrence-tasks` (não existe).

## Ações

### 1. Reaplicar as 4 migrations originais (idempotente)
Como já tem `IF NOT EXISTS` em tudo, vou rodar as 4 migrations via tool de migração mesmo assim, pra deixar o histórico oficial registrado (a sessão anterior consolidou num único arquivo). Sem efeito destrutivo — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.

> Alternativa: pular essa etapa já que o schema está aplicado. Recomendo pular pra evitar reabrir o histórico — confirmar com você.

### 2. Atualizar versão do `wisely-ai`
- Trocar constante `WISELY_AI_VERSION` de `2026.05.02-v37-sprint1-fundacao-hoje-v4` → `2026.05.02-v38-hoje-v4-completo`
- Redeploy via `supabase--deploy_edge_functions(["wisely-ai"])`

### 3. Criar nova edge function `generate-recurrence-tasks`
Arquivo: `supabase/functions/generate-recurrence-tasks/index.ts`

Lógica:
- Lê `task_recurrence_rules` ativas
- Calcula janela: `max(today, start_date, last_generated_until + 1)` até `today + days_ahead` (default 7, capped 90)
- Para cada dia na janela, decide via `frequency`:
  - `daily` → todo dia
  - `weekdays` → seg-sex
  - `weekly` → dia da semana = `weekday`
  - `monthly` → dia do mês = `monthly_day`
  - `yearly` → mesmo mês/dia do `start_date`
  - `custom_cron` → ignorado nesta versão
- Anti-duplicação: SELECT `(recurrence_rule_id, due_date)` antes de inserir
- Atualiza `last_generated_until` da regra
- Retorna JSON com `total_tasks_inserted` + breakdown por regra
- Usa `SUPABASE_SERVICE_ROLE_KEY`
- CORS padrão WT7

Configuração em `supabase/config.toml`:
```toml
[functions.generate-recurrence-tasks]
verify_jwt = false
```
(`send-whatsapp` já está com `verify_jwt = true` — mantém)

Deploy via `supabase--deploy_edge_functions(["generate-recurrence-tasks", "send-whatsapp"])`

### 4. pg_cron — diário 7h Brasília (10h UTC)
Rodar via tool insert (não migration, contém `service_role_key`):
```sql
SELECT cron.schedule(
  'generate-recurrence-tasks-daily',
  '0 10 * * *',
  $$ SELECT net.http_post(
    url := 'https://hbyzmuxkgsogbxhykhhu.supabase.co/functions/v1/generate-recurrence-tasks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    body := jsonb_build_object('days_ahead', 7)
  ) $$
);
```
> Pré-requisito: extensions `pg_cron` + `pg_net` habilitadas. Verifico antes; se faltar habilito.
> Como `verify_jwt = false`, o Authorization é opcional, mas mantém compatibilidade.

## Arquivos não tocados
- `src/pages/CommissionsPortalPage.tsx`
- `src/pages/KitnetsPage.tsx`
- Nenhuma alteração frontend nesta entrega.

## Resultado esperado
- `wisely-ai` retornando `version: "2026.05.02-v38-hoje-v4-completo"`
- `send-whatsapp` deployada (já estava)
- `generate-recurrence-tasks` deployada e respondendo `{ ok: true, ... }` no curl de teste
- Cron job `generate-recurrence-tasks-daily` listado em `cron.job`
