// Sugere código de negócio com base em keywords/padrões na descrição + source
// Usado pelo engine de reconciliação e pela UI de /businesses
// IMPORTANTE: manter em sincronia com o backfill SQL (migrations 20260418150000, 20260418160000, 20260418170000)

export type BusinessLike = { id: string; code: string };

export function suggestBusinessCode(r: { description?: string | null; source?: string | null }): string {
  const txt = `${r.description ?? ""} ${r.source ?? ""}`.toLowerCase();

  if (/\brwt\s?0\d|repasse\s?rwt|kitnet|aluguel|residencial\s?w|lara\s?woiciechovski/i.test(txt)) return "KITNETS";
  if (/prevensul|salario|salário|comiss|adianta|pluxee|reembolso|13o|decimo|décimo|férias|ferias|ppr|thiago\s+sergio\s+maba|thiago\s+maba|claudio\s+sergio\s+maba|cláudio\s+sergio\s+maba|claudio\s+maba|cláudio\s+maba/i.test(txt)) return "PREVENSUL";
  if (/\bcw7\b|q7\s?solar|q7energia|energia\s?solar/i.test(txt)) return "CW7";
  if (/\bt7\b|t7\s?sales|t7service/i.test(txt)) return "T7";
  if (/\bhr7\b|henrique\s?rial|consultoria\s?fitness/i.test(txt)) return "HR7";
  if (/promax|mercado\s?livre/i.test(txt)) return "PROMAX";
  return "OUTROS"; // fallback seguro — nunca retorna null
}

export function suggestBusiness<T extends BusinessLike>(
  r: { description?: string | null; source?: string | null },
  businesses: T[]
): T | null {
  const code = suggestBusinessCode(r);
  return businesses.find(b => b.code === code) ?? null;
}
