-- Card "Outros" como catch-all + reforço de backfill da Prevensul

INSERT INTO public.businesses (code, name, partner_name, ownership_pct, status, category, monthly_target, target_12m, icon, color, order_index, notes) VALUES
  ('OUTROS', 'Outros (eventuais)', NULL, 100, 'ativo', 'recorrente', 0, 0, '🎯', '#94A3B8', 99, 'Receitas pontuais que não se encaixam nos demais negócios (freelas, vendas avulsas, reembolsos, etc).')
ON CONFLICT (code) DO NOTHING;

-- Backfill complementar: palavras-chave adicionais da Prevensul
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'PREVENSUL')
WHERE business_id IS NULL
  AND (
    lower(coalesce(source,'')) ~ '(reembolso|bonus|bônus|rateio|13o|decimo|férias|ferias|ppr|pro\s?labore|ajuda\s?de\s?custo|vale)' OR
    lower(coalesce(description,'')) ~ '(reembolso|bonus|bônus|rateio|13o|decimo|férias|ferias|ppr|pro\s?labore|ajuda\s?de\s?custo|vale\s?(alimenta|refei))'
  );

-- Relatório pós-backfill (para conferência visual)
-- SELECT b.code, b.name, COUNT(r.id) AS receitas_vinculadas, COALESCE(SUM(r.amount), 0) AS total
-- FROM public.businesses b
-- LEFT JOIN public.revenues r ON r.business_id = b.id AND r.reference_month = '2026-04'
-- GROUP BY b.code, b.name ORDER BY b.order_index;
