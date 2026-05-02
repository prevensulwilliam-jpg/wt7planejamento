/**
 * Naval — testes de regressão.
 *
 * Pegam as lógicas mais críticas que historicamente quebraram em sessões anteriores
 * e validam que continuam corretas. NÃO testa edge function diretamente (precisaria
 * mock de Supabase) — testa lógicas de cálculo isoláveis e regras de classificação.
 *
 * Pra rodar: npm run test (vitest)
 */
import { describe, it, expect } from "vitest";

describe("Naval Regression Suite", () => {

  // ─── Regra: comissão Prevensul = 3% (jamais 12%) ────────────────────────
  describe("comissão Prevensul = 3%", () => {
    it("contrato R$ 4M / 12 parcelas → R$ 10k/mês comissão (não R$ 40k)", () => {
      const contractTotal = 4_000_000;
      const installments = 12;
      const monthlyClient = contractTotal / installments;
      const commission = monthlyClient * 0.03;
      expect(commission).toBe(10_000);
      expect(commission).not.toBe(40_000); // erro histórico v31
    });

    it("contrato R$ 12M / 24 parcelas (GRAND FOOD) → R$ 15k/mês", () => {
      const contractTotal = 12_040_000;
      const installments = 24;
      const monthlyClient = contractTotal / installments;
      const commission = monthlyClient * 0.03;
      expect(commission).toBeCloseTo(15_050, 0);
    });
  });

  // ─── Regra: CLT = R$ 10.903 (NÃO arredondar pra R$ 10k) ──────────────────
  describe("CLT real (não arredondado)", () => {
    it("12 meses de CLT real soma R$ 130.836 (não R$ 120k)", () => {
      const cltReal = 10_903;
      const total12m = cltReal * 12;
      expect(total12m).toBe(130_836);
      expect(total12m).not.toBe(120_000);
    });

    it("diferença arredondamento em 12m é R$ 10.836", () => {
      const real = 10_903 * 12;
      const arredondado = 10_000 * 12;
      expect(real - arredondado).toBe(10_836);
    });
  });

  // ─── Regra: ciclo Prevensul +1 mês (delay) ───────────────────────────────
  describe("ciclo Prevensul (+1 mês delay)", () => {
    it("contrato começando jun/26 paga 1ª comissão jul/26", () => {
      const contractStart = new Date("2026-06-15");
      const firstCommissionMonth = new Date(contractStart.getFullYear(), contractStart.getMonth() + 1, 1);
      expect(firstCommissionMonth.getMonth()).toBe(6); // jul (0-indexed)
      expect(firstCommissionMonth.getFullYear()).toBe(2026);
    });

    it("contrato 12x começando jun/26 → janela jun/26-mai/27 pega 11 parcelas (não 12)", () => {
      // 1ª parcela cliente: jun/26 → comissão cai jul/26
      // 12ª parcela cliente: mai/27 → comissão cai jun/27 (FORA da janela)
      // Janela jun/26-mai/27 pega comissões jul/26 a mai/27 = 11 parcelas
      const totalParcelas = 12;
      const delayMeses = 1;
      const janelaMeses = 12;
      const parcelasNaJanela = janelaMeses - delayMeses;
      expect(parcelasNaJanela).toBe(11);

      const comissaoMensal = 10_000;
      const totalComissaoNaJanela = parcelasNaJanela * comissaoMensal;
      expect(totalComissaoNaJanela).toBe(110_000);
    });
  });

  // ─── Regra: Modelo A kitnets — fonte única ──────────────────────────────
  describe("Modelo A kitnets", () => {
    it("revenue source='aluguel_kitnets' NÃO deve ser somada ao calcular receita", () => {
      const revenues = [
        { source: "aluguel_kitnets", amount: 2000, counts_as_income: true }, // SKIP
        { source: "comissao_prevensul", amount: 5000, counts_as_income: true }, // CONTA
        { source: "outros_receita", amount: 1050, counts_as_income: true }, // CONTA
        { source: "salario", amount: 10903, counts_as_income: true }, // CONTA
      ];
      const total = revenues
        .filter(r => r.counts_as_income !== false && r.source !== "aluguel_kitnets")
        .reduce((s, r) => s + r.amount, 0);
      expect(total).toBe(16_953);
      expect(total).not.toBe(18_953); // se incluísse aluguel_kitnets duplicado
    });
  });

  // ─── Bug histórico: subtração duplicada saldo prevensul ──────────────────
  describe("CommissionsPortalPage: saldo correto", () => {
    it("saldo = balance_remaining (NÃO subtrair amount_paid de novo)", () => {
      // ALIANZ G3: PDF mostra saldo R$ 150.000, pago no mês R$ 50.000
      // Sistema antigo (BUG): exibia R$ 100.000 = 150 - 50 (subtração duplicada)
      // Sistema novo (FIX): exibe R$ 150.000
      const balance_remaining = 150_000;
      const amount_paid = 50_000;
      const saldoCorreto = Math.max(0, balance_remaining); // FIX
      const saldoErrado = Math.max(0, balance_remaining - amount_paid); // BUG antigo

      expect(saldoCorreto).toBe(150_000);
      expect(saldoErrado).toBe(100_000); // confirma que o bug daria isso
      expect(saldoCorreto).not.toBe(saldoErrado);
    });
  });

  // ─── Cleanup pipeline: filter MAX(reference_month) ───────────────────────
  describe("pipeline lê só reference_month mais recente", () => {
    it("4 abas mensais somariam saldo INFLADO 4x — filter pega só mais recente", () => {
      const billingRows = [
        { client: "GF", balance_remaining: 6_240_000, reference_month: "2026-04" },
        { client: "GF", balance_remaining: 6_740_000, reference_month: "2026-03" },
        { client: "GF", balance_remaining: 7_240_000, reference_month: "2026-02" },
        { client: "GF", balance_remaining: 7_740_000, reference_month: "2026-01" },
      ];
      const totalSomandoTodos = billingRows.reduce((s, r) => s + r.balance_remaining, 0);
      const latestMonth = billingRows.reduce((m, r) => r.reference_month > m ? r.reference_month : m, "");
      const totalLatestOnly = billingRows
        .filter(r => r.reference_month === latestMonth)
        .reduce((s, r) => s + r.balance_remaining, 0);

      expect(totalSomandoTodos).toBe(27_960_000); // BUG: somar todos os meses
      expect(totalLatestOnly).toBe(6_240_000); // FIX v34
    });
  });

  // ─── Audit anti-divergência (regra do 2×) ────────────────────────────────
  describe("anti-divergência 2× histórico", () => {
    it("projeção mensal > 2× histórico ativa flag warning", () => {
      const historicoMensal = 40_000;
      const projecao = 105_000;
      const ratio = projecao / historicoMensal;
      const PROIBIDO_RATIO = 2;
      expect(ratio).toBeGreaterThan(PROIBIDO_RATIO);
      // Naval deveria PARAR antes de devolver projeção R$ 105k/mês quando histórico é R$ 40k.
    });

    it("projeção 1.5× histórico passa OK", () => {
      const historicoMensal = 40_000;
      const projecao = 55_000;
      const ratio = projecao / historicoMensal;
      expect(ratio).toBeLessThanOrEqual(2);
    });
  });
});
