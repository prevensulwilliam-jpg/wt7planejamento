-- ══════════════════════════════════════════════════════════════════
-- Sprint C — RAG semântico para o Naval
-- ══════════════════════════════════════════════════════════════════
-- Cada princípio da biblioteca (naval_sources.principles[]) vira um
-- vetor 768-dim (Gemini text-embedding-004). Quando William pergunta
-- algo ao Naval, embedamos a pergunta e buscamos os top-K princípios
-- mais próximos via cosine similarity.
-- ══════════════════════════════════════════════════════════════════

-- 1) Extensão pgvector (ativar no Postgres do Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Tabela de vetores
CREATE TABLE IF NOT EXISTS naval_principle_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES naval_sources(id) ON DELETE CASCADE,
  principle_idx int NOT NULL,        -- posição no array principles[] da source
  text text NOT NULL,                -- texto do princípio (redundante c/ sources, mas acelera join)
  lens text NOT NULL,                -- redundante c/ source.lens (pra filtro rápido)
  embedding vector(768) NOT NULL,    -- gemini text-embedding-004 = 768 dims
  created_at timestamptz DEFAULT now(),
  UNIQUE (source_id, principle_idx)
);

-- Index HNSW p/ busca rápida (melhor que ivfflat em bibliotecas pequenas/médias)
CREATE INDEX IF NOT EXISTS naval_principle_vectors_embedding_idx
  ON naval_principle_vectors
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS naval_principle_vectors_source_id_idx
  ON naval_principle_vectors (source_id);

-- 3) RLS — só admin lê/escreve
ALTER TABLE naval_principle_vectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads principle vectors" ON naval_principle_vectors;
CREATE POLICY "admin reads principle vectors"
  ON naval_principle_vectors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin writes principle vectors" ON naval_principle_vectors;
CREATE POLICY "admin writes principle vectors"
  ON naval_principle_vectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Função de busca semântica
--    Retorna top-K princípios mais próximos da query, com metadata da source.
--    threshold: cosine similarity mínima (0.0 a 1.0). 0.5 é um bom default.
CREATE OR REPLACE FUNCTION match_principles(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  source_id uuid,
  source_title text,
  source_author text,
  source_summary text,
  lens text,
  principle_idx int,
  text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.source_id,
    s.title AS source_title,
    s.author AS source_author,
    s.summary AS source_summary,
    v.lens,
    v.principle_idx,
    v.text,
    1 - (v.embedding <=> query_embedding) AS similarity
  FROM naval_principle_vectors v
  JOIN naval_sources s ON s.id = v.source_id
  WHERE s.active = true
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- Permite chamar do edge function (service_role já tem acesso)
GRANT EXECUTE ON FUNCTION match_principles TO authenticated;
