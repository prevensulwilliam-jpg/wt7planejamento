DROP FUNCTION IF EXISTS match_principles(vector, float, int);

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
  similarity float,
  principle_type text,
  principle_priority int,
  principle_tags jsonb,
  requires_validation boolean,
  is_hard_constraint boolean,
  is_operational_checklist boolean,
  temporal_validity_months int,
  cross_references jsonb
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
    1 - (v.embedding <=> query_embedding) AS similarity,
    (s.principles -> v.principle_idx ->> 'type')::text AS principle_type,
    NULLIF((s.principles -> v.principle_idx ->> 'priority'), '')::int AS principle_priority,
    (s.principles -> v.principle_idx -> 'tags')::jsonb AS principle_tags,
    NULLIF((s.principles -> v.principle_idx ->> 'requires_validation'), '')::boolean AS requires_validation,
    NULLIF((s.principles -> v.principle_idx ->> 'is_hard_constraint'), '')::boolean AS is_hard_constraint,
    NULLIF((s.principles -> v.principle_idx ->> 'is_operational_checklist'), '')::boolean AS is_operational_checklist,
    NULLIF((s.principles -> v.principle_idx ->> 'temporal_validity_months'), '')::int AS temporal_validity_months,
    (s.principles -> v.principle_idx -> 'cross_references')::jsonb AS cross_references
  FROM naval_principle_vectors v
  JOIN naval_sources s ON s.id = v.source_id
  WHERE s.active = true
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_principles TO authenticated;