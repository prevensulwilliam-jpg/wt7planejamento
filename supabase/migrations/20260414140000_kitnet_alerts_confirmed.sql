-- Adiciona campo confirmed para rastrear se o acordo foi incluído no fechamento
ALTER TABLE public.kitnet_alerts ADD COLUMN IF NOT EXISTS confirmed boolean;

-- confirmed = null  → ainda não respondido (pendente)
-- confirmed = true  → acordo confirmado como incluído no fechamento
-- confirmed = false → ainda pendente (usuário disse "não")
