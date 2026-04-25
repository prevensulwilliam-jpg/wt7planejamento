// Gerador de sugestões para créditos pendentes em /reconciliation.
// Não decide nada — só lista hipóteses ranqueadas para o William escolher.
//
// Filosofia: NUNCA promover automaticamente algo como "kitnets". O sistema
// só sabe com certeza quando há link kitnet_entry_id. Tudo o mais é
// hipótese que precisa de confirmação humana.

export type CreditSuggestion = {
  category: string;
  intent: "receita" | "transferencia" | "duvida";
  label: string;
  hint: string;          // texto explicativo curto
  confidence: "high" | "medium" | "low";
  tenant?: string;       // se a sugestão envolve inquilino, o nome
  kitnet_code?: string;  // código da kitnet (RWT02-05) se aplicável
};

export type TenantHistory = {
  tenant_name: string;
  kitnet_id: string;
  kitnet_code: string;
  rent_value: number;        // aluguel bruto
  total_liquid: number;      // último líquido recebido
  last_seen_month: string;   // ex: "2026-04"
  is_active: boolean;        // está em fechamento dos últimos 2 meses?
};

export type ClassificationPattern = {
  description_pattern: string;
  category: string;
  intent: string;
  label: string;
  count: number;
};

const VALOR_TOLERANCE_PCT = 0.10; // ±10% match com valor histórico

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionContainsTenant(description: string, tenantName: string): boolean {
  const desc = normalizeName(description);
  const tenant = normalizeName(tenantName);
  if (!tenant || tenant.length < 4) return false;

  // Match completo
  if (desc.includes(tenant)) return true;

  // Match por primeiro nome (4+ caracteres) — comum em PIX
  const firstName = tenant.split(" ")[0];
  if (firstName.length >= 4 && desc.includes(firstName)) return true;

  // Match por nome + sobrenome separadamente (PIX abreviado)
  const parts = tenant.split(" ").filter(p => p.length >= 4);
  const matched = parts.filter(p => desc.includes(p)).length;
  if (parts.length >= 2 && matched >= 2) return true;

  return false;
}

function valueMatchesRent(amount: number, rent: number): "exact" | "close" | "multiple" | "none" {
  if (rent <= 0) return "none";
  const ratio = amount / rent;
  // Match exato (±5%)
  if (Math.abs(ratio - 1) <= 0.05) return "exact";
  // Múltiplo claro (1.5x = aluguel + multa, 2x = 2 meses, etc)
  for (const mult of [1.5, 2, 3, 0.5]) {
    if (Math.abs(ratio - mult) <= 0.05) return "multiple";
  }
  // Próximo (±10%)
  if (Math.abs(ratio - 1) <= VALOR_TOLERANCE_PCT) return "close";
  return "none";
}

/**
 * Gera sugestões ranqueadas para um crédito pendente.
 * Sempre inclui "Não é receita identificável" como última opção (escape).
 */
export function suggestForCredit(input: {
  description: string;
  amount: number;
  date: string;             // YYYY-MM-DD
  tenants: TenantHistory[];
  patterns?: ClassificationPattern[];
}): CreditSuggestion[] {
  const out: CreditSuggestion[] = [];
  const { description, amount, tenants, patterns = [] } = input;
  const desc = (description ?? "").toLowerCase();

  // ─── 1) Match por nome de inquilino conhecido ───
  for (const t of tenants) {
    if (!descriptionContainsTenant(description, t.tenant_name)) continue;

    const valueMatch = valueMatchesRent(amount, t.rent_value);
    const liquidMatch = valueMatchesRent(amount, t.total_liquid);

    if (valueMatch === "exact" || liquidMatch === "exact") {
      out.push({
        category: "aluguel_kitnets",
        intent: "receita",
        label: `Aluguel de ${t.tenant_name} (${t.kitnet_code})`,
        hint: `Valor bate com aluguel histórico (R$ ${t.rent_value.toFixed(2)})${t.is_active ? "" : " — inquilino não está em fechamento recente"}`,
        confidence: t.is_active ? "high" : "medium",
        tenant: t.tenant_name,
        kitnet_code: t.kitnet_code,
      });
    } else if (valueMatch === "multiple" || liquidMatch === "multiple") {
      const ratio = amount / t.rent_value;
      out.push({
        category: "aluguel_kitnets",
        intent: "receita",
        label: `${ratio.toFixed(1)}× aluguel de ${t.tenant_name} (${t.kitnet_code})`,
        hint: `${ratio === 0.5 ? "Pagamento parcial" : ratio === 2 ? "2 meses (atrasado?)" : "Aluguel + multa/extra"}`,
        confidence: "medium",
        tenant: t.tenant_name,
        kitnet_code: t.kitnet_code,
      });
    } else if (valueMatch === "close") {
      out.push({
        category: "aluguel_kitnets",
        intent: "receita",
        label: `Possível aluguel ${t.tenant_name} (${t.kitnet_code})`,
        hint: `Nome bate, valor próximo (esperado R$ ${t.rent_value.toFixed(2)})`,
        confidence: "low",
        tenant: t.tenant_name,
        kitnet_code: t.kitnet_code,
      });
    } else {
      // Nome bate mas valor totalmente fora — pode ser caução, devolução, multa
      out.push({
        category: "aluguel_kitnets",
        intent: "receita",
        label: `${t.tenant_name} (${t.kitnet_code}) — outro motivo`,
        hint: `Nome bate, mas valor não é aluguel (caução? multa? reembolso?)`,
        confidence: "low",
        tenant: t.tenant_name,
        kitnet_code: t.kitnet_code,
      });
    }
  }

  // ─── 2) Match por padrão aprendido (classification_patterns) ───
  for (const p of patterns) {
    if (!desc.includes(p.description_pattern.toLowerCase())) continue;
    // Evita duplicar com sugestão de inquilino já existente
    if (out.some(o => o.category === p.category)) continue;
    out.push({
      category: p.category,
      intent: (p.intent as any) ?? "receita",
      label: p.label,
      hint: `Padrão aprendido (visto ${p.count}× antes)`,
      confidence: p.count >= 3 ? "high" : "medium",
    });
  }

  // ─── 3) Heurísticas de descrição (CR.TRF.INTERC LARA, depósitos genéricos) ───
  if (/lara|woiciechovski|domingos/i.test(description) && !out.some(o => o.tenant)) {
    out.push({
      category: "aluguel_kitnets",
      intent: "receita",
      label: "Repasse Lara — origem não identificada",
      hint: "Veio da administradora mas não bate com fechamento. Multa? Caução? Atrasado?",
      confidence: "medium",
    });
  }

  if (/cr\.dep\.interc|deposito|depósito/i.test(description) && amount >= 500 && !out.some(o => o.category === "aluguel_kitnets")) {
    out.push({
      category: "aluguel_kitnets",
      intent: "receita",
      label: "Depósito — possível aluguel direto",
      hint: "Inquilino pode ter depositado direto sem PIX nominal",
      confidence: "low",
    });
  }

  // ─── 4) Sempre adiciona alternativas genéricas (escape hatches) ───
  out.push({
    category: "outros_receita",
    intent: "receita",
    label: "Outra receita (não kitnet)",
    hint: "Comissão, dividendo, freelance, venda etc",
    confidence: "low",
  });

  out.push({
    category: "transferencia",
    intent: "transferencia",
    label: "Transferência / reembolso (entrada neutra)",
    hint: "Não conta na Sobra Reinvestida",
    confidence: "low",
  });

  // Ordenar por confiança (high → medium → low)
  const order = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return out;
}
