export type TransactionIntent = "receita" | "despesa" | "transferencia" | "duvida";

export interface CategorizationResult {
  category: string;
  intent: TransactionIntent;
  confidence: "high" | "low";
  label: string;
}

// Transferências — keywords MUITO específicas para evitar falsos positivos
// REMOVIDO: "bb", "inter", "banco do brasil" — aparecem em muitas descrições normais
const TRANSFER_KEYWORDS = [
  "transferencia para", "transferencia de",
  "transf p/", "transf de ",
  "pix proprio", "pix próprio",
  "entre contas proprias", "entre contas próprias",
  "ted proprio", "ted próprio",
  "doc proprio", "doc próprio",
  "aplicacao automatica", "aplicação automática",
  "resgate automatico", "resgate automático",
  "bb rende facil",
  "rendimento bb",
  "william tavares",
  "rende facil",
  "aplic automatica",
  "saldo anterior",
  "saldo anterior",
  "saldo do dia",
  // Aplicações automáticas Ailos/Credifoz
  "db.apl.rdcpos",
  "cr.apl.rdcpos",
  "db. cotas",
  "cr.dep.interc",
  "cr.trf.interc",
  "db.trf.interc",
  "apl.rdcpos",
  "rdcpos",
  // Transferências entre contas próprias
  "credito pix - william tavares",
  "debito pix - william tavares",
  "camila fuenfstueck adriano",
  "camila fuenstueck adriano",
  "fuenfstueck",
];

// Receitas — alta confiança
const REVENUE_RULES: { keywords: string[]; category: string; label: string }[] = [
  { keywords: ["cheque compensado", "cheque credit"], category: "outros_receita", label: "Cheque Recebido" },
  { keywords: ["repasse aluguel", "repasse rwt", "repasse imovel", "repasse imóvel", "locacao", "locação"], category: "kitnets", label: "Kitnets" },
  { keywords: ["salario", "salário", "folha pgto", "folha pagamento", "vencimento clr", "vencimento clt"], category: "salario", label: "Salário" },
  { keywords: ["comissao prevensul", "comissão prevensul", "prevensul comis"], category: "comissao_prevensul", label: "Comissão Prevensul" },
  { keywords: ["energia solar", "q7 energia", "credito energia"], category: "solar", label: "Energia Solar" },
  { keywords: ["laudo tecnico", "anotacao responsabilidade", "art engenharia"], category: "laudos", label: "Laudos" },
  { keywords: ["t7 sales", "t7sales", "t7 vendas"], category: "t7", label: "T7 Sales" },
];

// Despesas — alta confiança
const EXPENSE_RULES: { keywords: string[]; category: string; label: string }[] = [
  { keywords: ["cheque compensado"], category: "outros", label: "Cheque Compensado" },
  { keywords: ["ifood", "uber eats", "rappi", "supermercado", "mercadao", "atacadao", "padaria", "restaurante", "lanchonete", "delivery"], category: "alimentacao", label: "Alimentação" },
  { keywords: ["suplemento", "whey protein", "creatina", "growth supplements", "max titanium"], category: "suplementos", label: "Suplementos" },
  { keywords: ["smartfit", "bio ritmo", "personal trainer", "academia"], category: "academia", label: "Academia/Personal" },
  { keywords: ["farmacia", "drogaria", "drogasil", "droga raia", "ultrafarma", "hospital", "clinica", "unimed", "amil", "plano saude", "convenio medico"], category: "saude", label: "Saúde" },
  { keywords: ["netflix", "spotify", "amazon prime", "apple.com", "google one", "youtube premium", "lovable", "supabase", "github", "chatgpt", "openai", "microsoft 365"], category: "assinaturas", label: "Assinaturas" },
  { keywords: ["posto ", "combustivel", "gasolina", "ipiranga", "shell", "br distrib", "petrobras dist", "ipva", "dpvat", "detran", "seguro auto", "vistoria"], category: "veiculo", label: "Veículo" },
  { keywords: ["celesc", "copel", "cemig", "semasa", "casan", "sanepar", "agua e esgoto", "energia eletrica fatura"], category: "kitnets_manutencao", label: "Energia/Água" },
  { keywords: ["iptu", "taxa lixo", "taxa iluminacao", "tributos municipais", "receita federal", "darf", "das simples", "gps inss"], category: "impostos", label: "Impostos" },
  { keywords: ["villa sonali", "buffet casamento", "decoracao casamento", "fotografia casamento"], category: "casamento", label: "Casamento" },
  { keywords: ["loja materiais", "leroy merlin", "c&c ", "telhanorte", "sodimac", "materiais construcao", "ferragem", "madeireira"], category: "obras", label: "Obras" },
  { keywords: ["latam", "gol linhas", "azul linhas", "passagem aerea", "decolar", "hotel ", "airbnb", "booking", "pousada"], category: "viagens", label: "Viagens" },
  { keywords: ["cinema", "cinemark", "ingresso", "ticketmaster", "shows ", "teatro "], category: "lazer", label: "Lazer" },
  { keywords: ["pagto cartao", "pagamento cartao", "fatura cartao", "cartao credito pgto", "pg cartao"], category: "cartao", label: "Fatura Cartão" },
  { keywords: ["pagto boleto", "pg boleto", "boleto bancario"], category: "outros", label: "Boleto" },
  { keywords: ["ademicon", "consorcio", "carta credito"], category: "consorcio", label: "Consórcio" },
  // Internet/Telefonia
  { keywords: ["debito pix - claro", "claro s.a", "tim s.a", "vivo ", "oi s.a"], category: "internet", label: "Internet/Telefonia" },
  // Energia elétrica
  { keywords: ["debito pix - celesc", "celesc distribuicao"], category: "energia_eletrica", label: "Energia Elétrica" },
  // Facebook/Google Ads
  { keywords: ["facebook servicos", "google ads", "meta ads"], category: "assinaturas", label: "Assinaturas/Ads" },
  // Conveniência/Alimentação
  { keywords: ["conveniencias rodoviaria"], category: "alimentacao", label: "Alimentação" },
];

export function categorizeTransaction(
  description: string,
  type: "credit" | "debit",
  amount?: number,
  allAccounts?: string[]
): CategorizationResult {
  const raw = description ?? "";
  // Normalizar: minúsculas + remover acentos
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. TRANSFERÊNCIA — keywords específicas apenas
  const isTransfer =
    TRANSFER_KEYWORDS.some(k => lower.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));

  if (isTransfer) {
    return { category: "transferencia", intent: "transferencia", confidence: "high", label: "Transferência entre Contas" };
  }

  // 2. RECEITA
  if (type === "credit") {
    for (const rule of REVENUE_RULES) {
      if (rule.keywords.some(k => lower.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
        return { category: rule.category, intent: "receita", confidence: "high", label: rule.label };
      }
    }
    // PIX recebido sem identificação → dúvida
    if (lower.includes("pix recebido") || lower.includes("credito pix") || lower.includes("ted recebido")) {
      return { category: "outros_receita", intent: "duvida", confidence: "low", label: "PIX/TED recebido — qual a origem?" };
    }
    // Crédito genérico alto valor → dúvida
    if (amount && amount > 1000) {
      return { category: "outros_receita", intent: "duvida", confidence: "low", label: "Receita não identificada" };
    }
    return { category: "outros_receita", intent: "receita", confidence: "low", label: "Outros (Receita)" };
  }

  // 3. DESPESA
  if (type === "debit") {
    for (const rule of EXPENSE_RULES) {
      if (rule.keywords.some(k => lower.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
        return { category: rule.category, intent: "despesa", confidence: "high", label: rule.label };
      }
    }
    // PIX enviado sem identificação → dúvida
    if (lower.includes("pix enviado") || lower.includes("debito pix") || lower.includes("ted enviado")) {
      return { category: "outros", intent: "duvida", confidence: "low", label: "PIX/TED enviado — qual o destino?" };
    }
    // Valor alto → dúvida
    if (amount && amount > 1000) {
      return { category: "outros", intent: "duvida", confidence: "low", label: "Despesa alta não identificada" };
    }
    return { category: "outros", intent: "despesa", confidence: "low", label: "Outros" };
  }

  return { category: "outros", intent: "duvida", confidence: "low", label: "Não identificado" };
}

export const CATEGORY_LABELS: Record<string, string> = {
  transferencia: "Transferência entre Contas",
  kitnets: "Kitnets", salario: "Salário",
  comissao_prevensul: "Comissão Prevensul", solar: "Energia Solar",
  laudos: "Laudos", t7: "T7 Sales", outros_receita: "Outros (Receita)",
  alimentacao: "Alimentação", suplementos: "Suplementos",
  academia: "Academia/Personal", saude: "Saúde", assinaturas: "Assinaturas",
  veiculo: "Veículo", kitnets_manutencao: "Energia/Água",
  impostos: "Impostos", casamento: "Casamento", obras: "Obras",
  viagens: "Viagens", lazer: "Lazer", cartao: "Fatura Cartão",
  consorcio: "Consórcio", outros: "Outros",
  internet: "Internet/Telefonia", energia_eletrica: "Energia Elétrica",
};

export const INTENT_CONFIG = {
  receita: { color: "#10B981", label: "Receita", badge: "green" as const },
  despesa: { color: "#F43F5E", label: "Despesa", badge: "red" as const },
  transferencia: { color: "#94A3B8", label: "Transferência", badge: "gray" as const },
  duvida: { color: "#F59E0B", label: "Dúvida", badge: "gold" as const },
};
