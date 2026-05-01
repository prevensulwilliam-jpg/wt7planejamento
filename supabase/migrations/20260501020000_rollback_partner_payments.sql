-- Rollback: feature de saldo entre sócios não foi adotada na operação real.
-- William opera RWT05/JW7 com Walmir/Jairo via reembolso antecipado por
-- depósito (Walmir te deposita antes do cheque compensar) — não há saldo
-- a rastrear. Funcionalidade gerou ruído visual sem valor operacional.

DROP TABLE IF EXISTS construction_partner_payments;
ALTER TABLE construction_expenses DROP COLUMN IF EXISTS excluded_from_partner_balance;
