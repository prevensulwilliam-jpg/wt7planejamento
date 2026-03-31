// Mapa fixo: valor salvo no banco → { emoji, nome, cor }

// Receitas (revenues.source)
export const REVENUE_SOURCE_MAP: Record<string, { emoji: string; name: string; color: string }> = {
  kitnets:              { emoji: "🏘️", name: "Aluguel/Kitnets",       color: "#C9A84C" },
  salario:              { emoji: "💼", name: "Salário",                color: "#10B981" },
  comissao_prevensul:   { emoji: "📊", name: "Comissão Prevensul",     color: "#2DD4BF" },
  solar:                { emoji: "☀️", name: "Energia Solar",          color: "#F59E0B" },
  laudos:               { emoji: "📋", name: "Laudos Técnicos",        color: "#3B82F6" },
  t7:                   { emoji: "🚀", name: "T7 Sales",               color: "#8B5CF6" },
  dividendos:           { emoji: "📈", name: "Dividendos/Rendimentos", color: "#10B981" },
  outros_receita:       { emoji: "💰", name: "Outros (Receita)",       color: "#C9A84C" },
  // slugs que podem vir do banco com acentos removidos
  sal_rio:              { emoji: "💼", name: "Salário",                color: "#10B981" },
  comiss_o_prevensul:   { emoji: "📊", name: "Comissão Prevensul",     color: "#2DD4BF" },
  laudos_t_cnicos:      { emoji: "📋", name: "Laudos Técnicos",        color: "#3B82F6" },
  outros__receita_:     { emoji: "💰", name: "Outros (Receita)",       color: "#C9A84C" },
};

// Despesas (expenses.category)
export const EXPENSE_CATEGORY_MAP: Record<string, { emoji: string; name: string; color: string }> = {
  cartao_credito:       { emoji: "💳", name: "Cartão de Crédito",      color: "#F43F5E" },
  cartao:               { emoji: "💳", name: "Cartão de Crédito",      color: "#F43F5E" },
  energia_eletrica:     { emoji: "⚡", name: "Energia Elétrica",       color: "#F59E0B" },
  internet:             { emoji: "🌐", name: "Internet",               color: "#3B82F6" },
  telefonia:            { emoji: "📱", name: "Telefonia",              color: "#8B5CF6" },
  lazer:                { emoji: "🎉", name: "Lazer",                  color: "#EC4899" },
  alimentacao:          { emoji: "🍽️", name: "Alimentação",            color: "#F59E0B" },
  suplementos:          { emoji: "💊", name: "Suplementação",          color: "#8B5CF6" },
  saude:                { emoji: "🏥", name: "Saúde",                  color: "#10B981" },
  maconaria:            { emoji: "🔷", name: "Maçonaria",              color: "#2DD4BF" },
  guarani:              { emoji: "⚽", name: "Guarani",                color: "#10B981" },
  consorcio:            { emoji: "🔄", name: "Consórcio",              color: "#C9A84C" },
  terapia:              { emoji: "🧠", name: "Terapia",                color: "#8B5CF6" },
  obras:                { emoji: "🏗️", name: "Obras",                  color: "#F59E0B" },
  terrenos:             { emoji: "🌍", name: "Terrenos",               color: "#10B981" },
  agua:                 { emoji: "💧", name: "Água",                   color: "#3B82F6" },
  gasolina:             { emoji: "⛽", name: "Gasolina",               color: "#F43F5E" },
  farmacia:             { emoji: "💊", name: "Farmácia",               color: "#10B981" },
  academia:             { emoji: "🏋️", name: "Academia",              color: "#2DD4BF" },
  impostos:             { emoji: "🧾", name: "Impostos/Taxas",         color: "#F43F5E" },
  casamento:            { emoji: "💍", name: "Casamento",              color: "#EC4899" },
  assinaturas:          { emoji: "📲", name: "Assinaturas",            color: "#6366F1" },
  veiculo:              { emoji: "🚗", name: "Veículo",                color: "#94A3B8" },
  kitnets_manutencao:   { emoji: "🔧", name: "Kitnets Manutenção",     color: "#F97316" },
  energia_agua:         { emoji: "💧", name: "Energia/Água",           color: "#3B82F6" },
  gas:                  { emoji: "🔥", name: "Gás",                    color: "#F97316" },
  aluguel:              { emoji: "🏠", name: "Aluguel",                color: "#F43F5E" },
  outros:               { emoji: "📦", name: "Outros",                 color: "#4A5568" },
};

// Função helper para buscar exibição de receita
export function getRevenueDisplay(source: string | null) {
  if (!source) return { emoji: "💰", name: "Outros", color: "#C9A84C" };
  const found = REVENUE_SOURCE_MAP[source];
  if (found) return found;
  // Fallback: formatar o slug para leitura
  const readable = source.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return { emoji: "💰", name: readable, color: "#C9A84C" };
}

// Função helper para buscar exibição de despesa
export function getExpenseDisplay(category: string | null) {
  if (!category) return { emoji: "📦", name: "Outros", color: "#4A5568" };
  const found = EXPENSE_CATEGORY_MAP[category];
  if (found) return found;
  const readable = category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return { emoji: "📦", name: readable, color: "#94A3B8" };
}

// Extrair nome do banco da descrição
// Ex: "DEPOSITO [CREDIFOZ]" → "CREDIFOZ"
export function extractBank(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/\[([^\]]+)\]$/);
  return match ? match[1].trim() : null;
}

// Listar bancos únicos de uma lista de registros
export function getUniqueBanks(records: { description?: string | null }[]): string[] {
  const banks = new Set<string>();
  records.forEach(r => {
    const bank = extractBank(r.description ?? "");
    if (bank) banks.add(bank);
  });
  return Array.from(banks).sort();
}
