/**
 * Predicates canônicos do WT7 — fonte ÚNICA de verdade pra "o que conta".
 *
 * Histórico: a inconsistência dessas regras espalhadas pelos hooks causou
 * bugs de Modelo A (kitnet_entries sem reconciled) e duplicação de
 * entradas neutras como receita real. Centralizado aqui pra garantir
 * coerência entre /hoje, /receitas, /despesas, /negócios, autonomia, etc.
 */

// ═══════════════════════════════════════════════════════════════════
// RECEITAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Entrada de kitnet conta como receita real?
 * Modelo A: SOMENTE fechamentos reconciliados com extrato bancário.
 */
export function isReconciledKitnetEntry(k: { reconciled?: boolean | null }): boolean {
  return k.reconciled === true;
}

/**
 * Lançamento em `revenues` conta como receita real?
 * Exclui entradas neutras (transferências interconta, reembolsos, estornos)
 * que têm counts_as_income = false. NULL/undefined contam como true (default).
 */
export function isActualIncomeRevenue(r: { counts_as_income?: boolean | null }): boolean {
  return r.counts_as_income !== false;
}

/**
 * Inverso — entrada NEUTRA (não conta como receita).
 */
export function isNeutralRevenue(r: { counts_as_income?: boolean | null }): boolean {
  return r.counts_as_income === false;
}

// ═══════════════════════════════════════════════════════════════════
// DESPESAS
// ═══════════════════════════════════════════════════════════════════

type ExpenseLike = {
  nature?: string | null;
  is_card_payment?: boolean | null;
  counts_as_investment?: boolean | null;
};

/**
 * Lançamento em `expenses` conta como custeio (despesa real)?
 * Exclui:
 *   - is_card_payment=true (duplica com card_transactions)
 *   - nature='transfer' (transferência interconta)
 *   - counts_as_investment=true (vai pra investimento, não custeio)
 */
export function isActualCusteioExpense(e: ExpenseLike): boolean {
  if (e.is_card_payment === true) return false;
  if ((e.nature ?? "expense") === "transfer") return false;
  if (e.counts_as_investment === true) return false;
  return (e.nature ?? "expense") === "expense";
}

/**
 * Lançamento em `expenses` conta como investimento?
 */
export function isInvestmentExpense(e: ExpenseLike): boolean {
  if (e.is_card_payment === true) return false;
  if ((e.nature ?? "expense") === "transfer") return false;
  return e.counts_as_investment === true;
}

// ═══════════════════════════════════════════════════════════════════
// CARTÕES
// ═══════════════════════════════════════════════════════════════════

type CardTxLike = {
  custom_categories?: { slug?: string | null } | null;
};

/**
 * Tx de cartão conta no cálculo? Exclui categoria 'ignorar'
 * (PGTO CASH, estornos, lançamentos contábeis).
 */
export function isCountableCardTx(t: CardTxLike): boolean {
  return t.custom_categories?.slug !== "ignorar";
}
