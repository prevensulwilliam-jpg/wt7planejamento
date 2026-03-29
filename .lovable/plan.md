

# Wisely IA — Módulo Completo

## Resumo
Criar 2 arquivos novos (hook + página), atualizar DashboardPage e App.tsx. Usar **Edge Function** para chamadas AI (não é possível chamar APIs externas diretamente do browser por CORS). Usar Lovable AI gateway (modelo suportado) em vez da Claude API direta.

---

## Problema com a abordagem proposta
A Claude API em `api.anthropic.com` **não aceita chamadas diretas do browser** (CORS bloqueado, e requer API key no header). A solução correta é uma **Edge Function** que faz a chamada server-side.

Além disso, o projeto tem acesso ao **Lovable AI gateway** que suporta modelos como `openai/gpt-5` e `google/gemini-2.5-flash` sem precisar de API key — mais simples e sem custo extra.

---

## Arquivos a Criar

### 1. Edge Function `supabase/functions/wisely-ai/index.ts`
- Recebe `{ prompt, systemPrompt }` via POST
- Chama Lovable AI gateway (modelo `google/gemini-2.5-flash`) usando `LOVABLE_API_KEY`
- Retorna `{ text }` com a resposta
- CORS headers configurados

### 2. `src/hooks/useWisely.ts`
- `useWiselyContext()` — agrega dados de `useDashboardKPIs`, `useKitnets`, `useKitnetSummary`, `useGoals`, `usePrevensulBilling` para o mês atual
- `useWiselyAnalysis()` — chama a edge function com contexto financeiro, retorna `{ analysis, loading, generate }`
- `useWiselyChat()` — mantém array de mensagens, envia histórico completo a cada nova mensagem

### 3. `src/pages/WiselyPage.tsx`
**Seção 1 — Análise Mensal Automática:**
- Card com borda ciano, título "Análise de [Mês]", botão "↻ Atualizar"
- Auto-gera ao montar quando dados estão prontos
- Resposta renderizada com markdown (react-markdown)
- Skeleton animado durante loading

**Seção 2 — Chat com Wisely:**
- Input + botão enviar, histórico estilo chat
- Mensagens do usuário à direita (fundo escuro), Wisely à esquerda (fundo ciano sutil)
- Chips de sugestão clicáveis: "Quando vou atingir R$100k/mês?", etc.
- Scroll automático para última mensagem

**Seção 3 — Insights Rápidos (3 cards):**
- 💰 Renda | 🏘️ Kitnets | 🎯 Metas
- Gerados em paralelo via `Promise.all`
- Botão "Detalhar" injeta pergunta no chat

### 4. Atualizar `src/pages/DashboardPage.tsx`
- Card Wisely existente (mock) → substituir por dados reais via `useWiselyAnalysis()`
- Botão "↻ Atualizar" regenera
- Botão "Wisely →" navega para `/wisely`

### 5. Atualizar `src/App.tsx`
- Importar `WiselyPage`, substituir `PlaceholderPage` na rota `/wisely`

---

## Detalhes Técnicos

- **Modelo**: `google/gemini-2.5-flash` via Lovable AI gateway (suportado, sem API key do usuário)
- **Edge Function**: usa `LOVABLE_API_KEY` (já disponível no ambiente)
- **System prompt**: contexto completo do William (empresário, kitnets, Prevensul, meta R$100k)
- **Markdown rendering**: `react-markdown` para formatação das respostas
- **Persistência de chat**: estado local (não salva em `wisely_messages` por enquanto — pode ser adicionado depois)
- **Tema**: ciano #2DD4BF para destaque, componentes PremiumCard/GoldButton existentes

