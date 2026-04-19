
O usuário aprovou a estratégia de adicionar `GEMINI_API_KEY`, mas ao verificar `<secrets>` no contexto, vejo que **a chave NÃO foi adicionada ainda**. Os secrets atuais são apenas: `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEY`.

Então preciso solicitar o secret de novo no modo default e depois fazer o ajuste no código + redeploy.

Olhando `naval-embed/index.ts`, ele já está escrito pra usar `GEMINI_API_KEY` direto na API nativa do Google (`generativelanguage.googleapis.com`), não no gateway Lovable. Mas o erro do log mostra "Embeddings gateway error 400" — ou seja, **a versão deployada ainda é a antiga** que tentava usar o gateway. O código atual no repo já está correto, só falta:

1. Adicionar o secret `GEMINI_API_KEY`
2. Redeploy do `naval-embed` pra pegar a versão nova que usa a API nativa do Gemini

## Plano

**Status atual:** A chave `GEMINI_API_KEY` ainda não foi adicionada — só os secrets padrão do Supabase/Lovable existem. Sem ela, o `naval-embed` continua quebrado.

**Passos:**

1. **Solicitar o secret `GEMINI_API_KEY`** — você pega grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (login Google, "Create API key", copia). Limite generoso pra `text-embedding-004` (768 dims).

2. **Redeploy do `naval-embed`** — o código no repo (commit `d9a52fb`) já está correto: chama a API nativa do Gemini (`generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents`) usando `GEMINI_API_KEY`, não o gateway Lovable. Mas o erro nos logs ("Embeddings gateway error 400") indica que a versão atualmente em produção é a antiga — então preciso fazer o redeploy depois que a chave estiver lá.

3. **Testar** invocando `naval-embed` com `{ query: "teste" }` — deve retornar `{ ok: true, embedding: [...768 floats] }`.

4. **Re-embedar as sources existentes** (se houver) — chamar `naval-embed` com `{ source_id: "..." }` pra cada source ativa, populando `naval_principle_vectors` pro RAG do `wisely-ai` voltar a funcionar.
