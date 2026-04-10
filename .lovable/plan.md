

# Atualizar wisely-ai — RECONCILE_PROMPT melhorado

## O que muda
Arquivo único: `supabase/functions/wisely-ai/index.ts`

O `RECONCILE_PROMPT` será substituído pela versão expandida que:
1. Analisa créditos E débitos (antes só focava em créditos)
2. Sugere categorias para débitos conhecidos (cartão, conta de luz, etc.)
3. Pergunta sobre débitos não identificados (PIX, TED, cheque)
4. Calcula saldo do mês e compara com esperado (~R$40k)
5. Formato de resposta mais completo com seções para entradas e saídas não identificadas

Nenhuma mudança na lógica JavaScript — apenas o texto do prompt `RECONCILE_PROMPT` é atualizado. Os demais modos (chat Naval, extract-celesc) permanecem inalterados.

