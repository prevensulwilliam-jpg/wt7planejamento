const RULES: { keywords: string[]; category: string; type: "credit" | "debit" | "both" }[] = [
  // Receitas
  { keywords: ["repasse", "aluguel", "locacao", "locação", "rwt", "rwt02", "rwt03"], category: "kitnets", type: "credit" },
  { keywords: ["salario", "salário", "prevensul", "folha"], category: "salario", type: "credit" },
  { keywords: ["comissao", "comissão", "comiss"], category: "comissao_prevensul", type: "credit" },
  { keywords: ["solar", "energia solar", "q7"], category: "solar", type: "credit" },
  { keywords: ["laudo", "art", "anotacao"], category: "laudos", type: "credit" },
  { keywords: ["t7", "t7 sales"], category: "t7", type: "credit" },
  // Despesas
  { keywords: ["ifood", "uber eats", "rappi", "restaurante", "lanche", "padaria"], category: "alimentacao", type: "debit" },
  { keywords: ["suplemento", "whey", "creatina", "growth"], category: "suplementos", type: "debit" },
  { keywords: ["academia", "smartfit", "personal", "henrique"], category: "academia", type: "debit" },
  { keywords: ["farmacia", "farmácia", "remedios", "medico", "médico", "hospital", "clinica", "plano saude"], category: "saude", type: "debit" },
  { keywords: ["netflix", "spotify", "amazon", "apple", "google", "youtube", "lovable", "supabase", "github"], category: "assinaturas", type: "debit" },
  { keywords: ["combustivel", "gasolina", "posto", "shell", "ipiranga", "ipva", "seguro auto"], category: "veiculo", type: "debit" },
  { keywords: ["celesc", "energia", "eletrica", "elétrica"], category: "kitnets_manutencao", type: "debit" },
  { keywords: ["iptu", "prefeitura", "imovel", "imóvel"], category: "impostos", type: "debit" },
  { keywords: ["villa sonali", "casamento", "noiva", "decoracao"], category: "casamento", type: "debit" },
  { keywords: ["construcao", "construção", "obra", "material", "cimento", "bloco", "pedreiro"], category: "obras", type: "debit" },
  { keywords: ["viagem", "hotel", "hospedagem", "airbnb", "passagem", "latam", "gol"], category: "viagens", type: "debit" },
  { keywords: ["lazer", "cinema", "teatro", "show", "ingresso"], category: "lazer", type: "debit" },
];

export function categorizeTransaction(description: string, type: "credit" | "debit"): string {
  const lower = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const rule of RULES) {
    if (rule.type !== "both" && rule.type !== type) continue;
    if (rule.keywords.some(k => lower.includes(k))) return rule.category;
  }
  return type === "credit" ? "outros_receita" : "outros";
}

export const CATEGORY_LABELS: Record<string, string> = {
  kitnets: "Kitnets",
  salario: "Salário",
  comissao_prevensul: "Comissão Prevensul",
  solar: "Energia Solar",
  laudos: "Laudos",
  t7: "T7 Sales",
  outros_receita: "Outros (Receita)",
  alimentacao: "Alimentação",
  suplementos: "Suplementos",
  academia: "Academia",
  saude: "Saúde",
  assinaturas: "Assinaturas",
  veiculo: "Veículo",
  kitnets_manutencao: "Kitnets Manutenção",
  impostos: "Impostos",
  casamento: "Casamento",
  obras: "Obras",
  viagens: "Viagens",
  lazer: "Lazer",
  outros: "Outros",
};
