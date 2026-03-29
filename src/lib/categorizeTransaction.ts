export type TransactionIntent =
  | "receita"
  | "despesa"
  | "transferencia"
  | "duvida";

export interface CategorizationResult {
  category: string;
  intent: TransactionIntent;
  confidence: "high" | "low";
  label: string;
}

const TRANSFER_KEYWORDS = [
  "transf", "transferencia", "transferência",
  "pix enviado", "pix recebido", "pix proprio", "pix próprio",
  "entre contas", "aplicacao", "aplicação", "resgate",
  "ted proprio", "ted próprio", "doc proprio", "doc próprio",
  "cdb", "lci", "lca", "tesouro", "fundo",
  "ailos", "banco do brasil", "xp investimentos", "bb", "inter",
  "william tavares",
];

const REVENUE_RULES: { keywords: string[]; category: string; label: string }[] = [
  { keywords: ["repasse", "aluguel", "locacao", "locação", "rwt02", "rwt03", "amauri", "manoel correa"], category: "kitnets", label: "Kitnets" },
  { keywords: ["salario", "salário", "prevensul", "folha pagamento"], category: "salario", label: "Salário" },
  { keywords: ["comissao", "comissão"], category: "comissao_prevensul", label: "Comissão Prevensul" },
  { keywords: ["solar", "q7 energia"], category: "solar", label: "Energia Solar" },
  { keywords: ["laudo", "anotacao responsabilidade", "art "], category: "laudos", label: "Laudos" },
  { keywords: ["t7 sales", "t7sales"], category: "t7", label: "T7 Sales" },
];

const EXPENSE_RULES: { keywords: string[]; category: string; label: string }[] = [
  { keywords: ["ifood", "uber eats", "rappi", "restaurante", "lanche", "padaria", "supermercado", "mercado"], category: "alimentacao", label: "Alimentação" },
  { keywords: ["suplemento", "whey", "creatina", "growth supplements"], category: "suplementos", label: "Suplementos" },
  { keywords: ["smartfit", "academia", "personal trainer", "henrique"], category: "academia", label: "Academia/Personal" },
  { keywords: ["farmacia", "drogaria", "remedios", "medico", "hospital", "clinica", "plano de saude", "unimed"], category: "saude", label: "Saúde" },
  { keywords: ["netflix", "spotify", "amazon prime", "apple", "google one", "youtube", "lovable", "supabase", "github", "chatgpt", "openai"], category: "assinaturas", label: "Assinaturas" },
  { keywords: ["combustivel", "gasolina", "posto", "shell", "ipiranga", "ipva", "seguro auto", "detran"], category: "veiculo", label: "Veículo" },
  { keywords: ["celesc", "energia eletrica", "semasa", "saneamento"], category: "kitnets_manutencao", label: "Energia/Água Kitnets" },
  { keywords: ["iptu", "prefeitura", "taxa lixo"], category: "impostos", label: "Impostos" },
  { keywords: ["villa sonali", "casamento", "noiva", "buffet", "decoracao casamento"], category: "casamento", label: "Casamento" },
  { keywords: ["material construcao", "cimento", "bloco", "ferragem", "pedreiro", "mao de obra obra"], category: "obras", label: "Obras" },
  { keywords: ["hotel", "hospedagem", "airbnb", "passagem aerea", "latam", "gol ", "azul "], category: "viagens", label: "Viagens" },
  { keywords: ["cinema", "teatro", "show", "ingresso", "parque"], category: "lazer", label: "Lazer" },
];

export function categorizeTransaction(
  description: string,
  type: "credit" | "debit",
  amount?: number,
  allAccounts?: string[]
): CategorizationResult {
  const raw = description ?? "";
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. DETECT TRANSFER — highest priority
  const isTransfer =
    TRANSFER_KEYWORDS.some(k => lower.includes(k.toLowerCase())) ||
    (allAccounts ?? []).some(acc => lower.includes(acc.toLowerCase()));

  if (isTransfer) {
    return {
      category: "transferencia",
      intent: "transferencia",
      confidence: "high",
      label: "Transferência entre Contas",
    };
  }

  // 2. DETECT REVENUE
  if (type === "credit") {
    for (const rule of REVENUE_RULES) {
      if (rule.keywords.some(k => lower.includes(k))) {
        return { category: rule.category, intent: "receita", confidence: "high", label: rule.label };
      }
    }
    return { category: "outros_receita", intent: "duvida", confidence: "low", label: "Receita não identificada" };
  }

  // 3. DETECT EXPENSE
  if (type === "debit") {
    for (const rule of EXPENSE_RULES) {
      if (rule.keywords.some(k => lower.includes(k))) {
        return { category: rule.category, intent: "despesa", confidence: "high", label: rule.label };
      }
    }
    if (amount && amount > 500) {
      return { category: "outros", intent: "duvida", confidence: "low", label: "Despesa não identificada" };
    }
    return { category: "outros", intent: "despesa", confidence: "low", label: "Outros" };
  }

  return { category: "outros", intent: "duvida", confidence: "low", label: "Não identificado" };
}

export const CATEGORY_LABELS: Record<string, string> = {
  transferencia: "Transferência entre Contas",
  kitnets: "Kitnets",
  salario: "Salário",
  comissao_prevensul: "Comissão Prevensul",
  solar: "Energia Solar",
  laudos: "Laudos",
  t7: "T7 Sales",
  outros_receita: "Outros (Receita)",
  alimentacao: "Alimentação",
  suplementos: "Suplementos",
  academia: "Academia/Personal",
  saude: "Saúde",
  assinaturas: "Assinaturas",
  veiculo: "Veículo",
  kitnets_manutencao: "Energia/Água Kitnets",
  impostos: "Impostos",
  casamento: "Casamento",
  obras: "Obras",
  viagens: "Viagens",
  lazer: "Lazer",
  outros: "Outros",
};

export const INTENT_CONFIG = {
  receita: { color: "#10B981", label: "Receita", badge: "green" as const },
  despesa: { color: "#F43F5E", label: "Despesa", badge: "red" as const },
  transferencia: { color: "#94A3B8", label: "Transferência", badge: "gray" as const },
  duvida: { color: "#F59E0B", label: "Dúvida", badge: "gold" as const },
};
