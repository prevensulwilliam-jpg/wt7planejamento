-- Corrige entries antigos que ficaram com reconciled = NULL
UPDATE public.kitnet_entries SET reconciled = false WHERE reconciled IS NULL;
