export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Soma de valores monetários via inteiros em centavos — evita drift de float.
// Ex: 0.1 + 0.2 === 0.30000000000000004 em JS. sumMoney([0.1, 0.2]) === 0.3.
export function sumMoney(values: Array<number | null | undefined>): number {
  const cents = values.reduce<number>((acc, v) => acc + Math.round(((v ?? 0) as number) * 100), 0);
  return cents / 100;
}

// Arredondamento consistente para 2 casas em centavos (evita 1234.005 → 1234.00).
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
