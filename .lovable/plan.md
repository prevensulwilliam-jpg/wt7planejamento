

# Atualizar Edge Function wisely-ai — Adicionar modo "reconcile"

## O que muda
Arquivo único: `supabase/functions/wisely-ai/index.ts`

O código atual será substituído pelo código fornecido, que adiciona:

1. **Novo prompt `RECONCILE_PROMPT`** — instruções para conciliação bancária automática
2. **Novo modo `action: "reconcile"`** — recebe transações pendentes, receitas esperadas e fechamentos de kitnets, faz auto-match por valor exato, e envia contexto estruturado para o Naval gerar relatório de conciliação
3. **Retorno enriquecido** — além do texto do Naval, retorna `autoMatched`, `unmatched`, `totalCredits`, `totalDebits`

Os modos existentes (chat Naval e extract-celesc) permanecem inalterados.

