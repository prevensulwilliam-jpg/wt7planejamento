## Naval Biblioteca v2 — Migration + Deploy + Embeddings

Aplicar a migration `20260502190000_naval_biblioteca_v2.sql`, redeployar `naval-embed` + `wisely-ai` (v43), e gerar embeddings dos 6 sources novos.

### Passos

1. **Aplicar migration** `supabase/migrations/20260502190000_naval_biblioteca_v2.sql`
   - Recria `match_principles` com 8 campos extras
   - Insere 6 sources (86 princípios) em `naval_sources` via `ON CONFLICT (slug)`

2. **Deploy edge functions** via `supabase--deploy_edge_functions`:
   - `naval-embed` (já aceita princípios como objetos — confirmado no arquivo)
   - `wisely-ai` (já está marcado como `v43-biblioteca-v2-com-metadados` — linha 5671)

3. **Gerar embeddings** dos 6 sources novos:
   - Query: `SELECT id, slug FROM naval_sources WHERE slug IN (...6 slugs...)`
   - Para cada id, invocar `naval-embed` via `supabase--curl_edge_functions` com `{ "source_id": "<uuid>" }`

4. **Validar**:
   - Conferir contagem em `naval_principle_vectors` por source
   - Logs de `wisely-ai` confirmando versão v43

Sem mudanças em código além da migration. Não toca em `CommissionsPortalPage` nem `KitnetsPage`.