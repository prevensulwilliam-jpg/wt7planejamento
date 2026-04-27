import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * DRE mensal — Demonstração do Resultado.
 *
 * 7 blocos canônicos:
 *  1. Receitas           — entradas reais (avulsas + kitnets reconciliados)
 *  2. Custeio Pessoal    — custo de vida core
 *  3. Obras              — aportes patrimoniais imobiliários (cota W)
 *  4. Casamento          — Villa Sonali + extras + reservas mensais
 *  5. Viagens            — Canton/Japão, lua de mel, outras
 *  6. Outros Aportes     — consórcios + dev profissional + ferramentas
 *  7. Resultado          — sobra líquida + indicadores %
 *
 * Cartão: regime CAIXA — fatura paga no mês entra como saída.
 */

export type DREItem = { label: string; amount: number; date?: string | null; source?: string | null };
export type DREBucket = { label: string; total: number; items: DREItem[] };

export type DRE = {
  month: string;
  receitas: {
    total: number;
    renda_ativa: DREBucket;       // CLT + comissões Prevensul
    renda_passiva: DREBucket;     // Kitnets reconciliados
    comissoes_extras: DREBucket;  // other_commissions
    avulsas: DREBucket;           // demais revenues
    entradas_neutras: number;     // memo (não conta)
  };
  custeio: {
    total: number;
    buckets: DREBucket[];         // por categoria agrupada
  };
  obras: {
    total: number;
    buckets: DREBucket[];         // por construction
    terrenos: DREBucket;          // NRSX e outros
  };
  casamento: {
    total: number;
    buckets: DREBucket[];
  };
  viagens: {
    total: number;
    buckets: DREBucket[];
  };
  outros_aportes: {
    total: number;
    consorcios: DREBucket;
    dev_profissional: DREBucket;
    dev_pessoal: DREBucket;
    ferramentas: DREBucket;
  };
  resultado: {
    receita: number;
    custeio: number;
    obras: number;
    casamento: number;
    viagens: number;
    outros_aportes: number;
    sobra_liquida: number;
    sobra_operacional_pct: number;       // (receita - custeio) / receita
    reinvestimento_patrimonial_pct: number;  // obras / receita
    reinvestimento_total_pct: number;    // (obras + outros_aportes) / receita
    casamento_viagens_pct: number;       // (casamento + viagens) / receita
  };
};

// ─── Classificador de despesa em bloco DRE ────────────────────────
type ExpenseLike = {
  category?: string | null;
  description?: string | null;
  vector?: string | null;
  counts_as_investment?: boolean | null;
};

function classifyExpense(e: ExpenseLike): "obras" | "casamento" | "viagens" | "outros_aportes" | "custeio" {
  const c = (e.category || "").toLowerCase();
  const d = (e.description || "").toLowerCase();

  // OBRAS
  if (c === "obras" || c === "aporte_obra" || c === "terrenos") return "obras";
  if (e.vector === "WT7_Holding" || e.vector === "aporte_obra") return "obras";

  // CASAMENTO
  if (c === "casamento" || c === "casamento_2027") return "casamento";
  if (d.includes("villa sonali") || d.includes("casamento")) return "casamento";

  // VIAGENS
  if (c === "viagens" || c === "viagem_educacao" || c === "viagem_negocios") return "viagens";
  if (e.vector === "viagens") return "viagens";

  // OUTROS APORTES
  if (e.counts_as_investment === true) return "outros_aportes";
  if (c === "consorcio" || c === "consorcios_aporte") return "outros_aportes";
  if (c === "kitnets_manutencao" || c === "manutencao_kitnets") return "outros_aportes";

  return "custeio";
}

function classifyCardTx(t: { vector?: string | null; counts_as_investment?: boolean | null; custom_categories?: { slug?: string | null; vector?: string | null } | null }): "obras" | "casamento" | "viagens" | "outros_aportes" | "custeio" | "ignorar" {
  const slug = t.custom_categories?.slug || "";
  if (slug === "ignorar") return "ignorar";
  if (slug === "aporte_obra") return "obras";
  if (slug === "casamento_2027") return "casamento";
  if (slug === "viagens" || slug === "viagem_educacao" || slug === "viagem_negocios") return "viagens";
  if (t.counts_as_investment) return "outros_aportes";
  return "custeio";
}

export function useDRE(month: string) {
  return useQuery<DRE>({
    queryKey: ["dre", month],
    // DRE é agregação derivada de várias tabelas (revenues, kitnet_entries, other_commissions, expenses,
    // card_invoices, card_transactions, wedding_installments). Como cada uma tem seu próprio mutation
    // com invalidação isolada, o DRE precisa sempre buscar fresco quando montado pra refletir mudanças
    // em qualquer uma delas — caso contrário o staleTime de 5min do QueryClient mantém dados rancheados.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const monthStart = `${month}-01`;
      const [yy, mm] = month.split("-").map(Number);
      const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

      // ═══ 1. RECEITAS ═══
      const { data: revs } = await supabase.from("revenues")
        .select("id, amount, source, description, received_at, counts_as_income, business_id")
        .eq("reference_month", month);
      const { data: kitEntries } = await supabase.from("kitnet_entries")
        .select("id, total_liquid, tenant_name, kitnet_id, reconciled, received_at")
        .eq("reference_month", month);

      // Comissões externas — REGIME CAIXA por parcela.
      // Conta apenas parcelas com paid_at dentro do mês, independente do reference_month
      // ou issued_at do lançamento-mãe. Isso casa com /commissions/external "Comissões Recebidas".
      const lastDay = new Date(yy, mm, 0).getDate();
      const monthEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data: paidInstallments } = await (supabase as any).from("other_commission_installments")
        .select("amount, paid_amount, paid_at, due_date, installment_number, other_commissions(id, description, source)")
        .not("paid_at", "is", null)
        .gte("paid_at", monthStart)
        .lte("paid_at", monthEnd);

      const { data: businesses } = await supabase.from("businesses").select("id, code, name");
      const bizById = new Map<string, { code: string; name: string }>();
      (businesses ?? []).forEach((b: any) => bizById.set(b.id, { code: b.code, name: b.name }));

      // Renda ativa (Prevensul) — revenues com business_id=PREVENSUL OU source contém prevensul/comissao/clt
      const prevensulBiz = (businesses ?? []).find((b: any) => b.code === "PREVENSUL");
      const isRendaAtiva = (r: any) => {
        const src = (r.source || "").toLowerCase();
        const desc = (r.description || "").toLowerCase();
        if (r.business_id === prevensulBiz?.id) return true;
        if (src.includes("prevensul") || src.includes("comissao") || src.includes("comissão") || src.includes("salario") || src.includes("salário") || src.includes("clt")) return true;
        if (desc.includes("prevensul") || desc.includes("salário") || desc.includes("comissão")) return true;
        return false;
      };
      const validRevs = (revs ?? []).filter((r: any) => r.counts_as_income !== false);
      const rendaAtivaItems = validRevs.filter(isRendaAtiva);
      const rendaAtivaTotal = rendaAtivaItems.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

      // Renda passiva — kitnet_entries reconciliados (Modelo A)
      const kitReconciled = (kitEntries ?? []).filter((k: any) => k.reconciled === true);
      const rendaPassivaTotal = kitReconciled.reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);

      // Comissões extras — soma das parcelas pagas no mês (regime caixa)
      const extrasTotal = (paidInstallments ?? []).reduce(
        (s: number, p: any) => s + Number(p.paid_amount ?? p.amount ?? 0),
        0,
      );

      // Avulsas — restantes de revenues
      const avulsasItems = validRevs.filter((r: any) => !isRendaAtiva(r) && r.source !== "aluguel_kitnets");
      const avulsasTotal = avulsasItems.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

      const entradasNeutras = (revs ?? [])
        .filter((r: any) => r.counts_as_income === false)
        .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

      const receitaTotal = rendaAtivaTotal + rendaPassivaTotal + extrasTotal + avulsasTotal;

      // ═══ 2-6. CUSTEIO + OBRAS + CASAMENTO + VIAGENS + OUTROS APORTES ═══
      const { data: exps } = await supabase.from("expenses")
        .select("id, amount, category, description, vector, counts_as_investment, paid_at, is_card_payment, nature")
        .eq("reference_month", month);

      // Cartão: tx das invoices PAGAS no mês (regime caixa)
      const { data: paidInvs } = await supabase.from("card_invoices")
        .select("id, paid_amount, total_amount")
        .gte("paid_at", monthStart)
        .lt("paid_at", nextMonth);
      const ratioByInv: Record<string, number> = {};
      for (const inv of paidInvs ?? []) {
        const total = Number((inv as any).total_amount ?? 0);
        const paid = Number((inv as any).paid_amount ?? total);
        ratioByInv[(inv as any).id] = total > 0 ? Math.min(1, paid / total) : 1;
      }
      const paidInvIds = (paidInvs ?? []).map((i: any) => i.id);
      let cardTxs: any[] = [];
      if (paidInvIds.length > 0) {
        const { data } = await supabase.from("card_transactions")
          .select("id, amount, description, transaction_date, vector, counts_as_investment, invoice_id, custom_categories ( slug )")
          .in("invoice_id", paidInvIds);
        cardTxs = (data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount ?? 0) * (ratioByInv[t.invoice_id] ?? 1) }));
      }

      // Acumular por bloco e por sub-categoria
      type Group = Map<string, { total: number; items: DREItem[] }>;
      const custeioGroup: Group = new Map();
      const obrasGroup: Group = new Map();
      const casamentoGroup: Group = new Map();
      const viagensGroup: Group = new Map();
      const consorciosGroup: Group = new Map();
      const devProGroup: Group = new Map();
      const devPessoalGroup: Group = new Map();
      const ferramentasGroup: Group = new Map();
      const terrenosGroup: Group = new Map();

      const addItem = (g: Group, key: string, item: DREItem) => {
        if (!g.has(key)) g.set(key, { total: 0, items: [] });
        const b = g.get(key)!;
        b.total += item.amount;
        b.items.push(item);
      };

      // Expenses (excluindo card_payments e transferências)
      for (const e of exps ?? []) {
        if ((e as any).is_card_payment) continue;
        if (((e as any).nature ?? "expense") === "transfer") continue;

        const amt = Number((e as any).amount ?? 0);
        const cat = (e as any).category || "outros";
        const item: DREItem = {
          label: (e as any).description || cat,
          amount: amt,
          date: (e as any).paid_at,
          source: cat,
        };

        const bloc = classifyExpense(e as any);
        if (bloc === "obras") {
          if (cat.toLowerCase() === "terrenos") {
            addItem(terrenosGroup, "Terrenos NRSX", item);
          } else {
            addItem(obrasGroup, "Obras (geral)", item);
          }
        } else if (bloc === "casamento") {
          addItem(casamentoGroup, cat, item);
        } else if (bloc === "viagens") {
          addItem(viagensGroup, cat, item);
        } else if (bloc === "outros_aportes") {
          if (cat.toLowerCase().includes("consorcio") || cat === "consorcios_aporte") addItem(consorciosGroup, "Consórcios", item);
          else if (cat === "dev_profissional_agora") addItem(devProGroup, "Dev Profissional", item);
          else if (cat === "dev_pessoal_futuro") addItem(devPessoalGroup, "Dev Pessoal", item);
          else if (cat === "produtividade_ferramentas") addItem(ferramentasGroup, "Ferramentas", item);
          else addItem(ferramentasGroup, "Outros aportes", item);
        } else {
          // CUSTEIO — agrupa por categoria
          addItem(custeioGroup, cat, item);
        }
      }

      // Cartão: regime caixa
      for (const t of cardTxs) {
        const bloc = classifyCardTx(t);
        if (bloc === "ignorar") continue;
        const item: DREItem = {
          label: t.description || "(sem descrição)",
          amount: Number(t.amount ?? 0),
          date: t.transaction_date,
          source: t.custom_categories?.slug || null,
        };
        if (bloc === "obras") addItem(obrasGroup, "Cartão · Obras", item);
        else if (bloc === "casamento") addItem(casamentoGroup, "Cartão · Casamento", item);
        else if (bloc === "viagens") addItem(viagensGroup, "Cartão · Viagens", item);
        else if (bloc === "outros_aportes") {
          const slug = t.custom_categories?.slug;
          if (slug === "dev_profissional_agora") addItem(devProGroup, "Dev Profissional (cartão)", item);
          else if (slug === "dev_pessoal_futuro") addItem(devPessoalGroup, "Dev Pessoal (cartão)", item);
          else if (slug === "produtividade_ferramentas") addItem(ferramentasGroup, "Ferramentas (cartão)", item);
          else if (slug === "consorcios_aporte") addItem(consorciosGroup, "Consórcios (cartão)", item);
          else addItem(ferramentasGroup, "Outros aportes (cartão)", item);
        } else {
          addItem(custeioGroup, "Cartão · " + (t.custom_categories?.slug || "outros"), item);
        }
      }

      // Wedding installments paid no mês
      const { data: wedInsts } = await supabase.from("wedding_installments")
        .select("id, description, supplier, amount, paid_at, status, due_date");
      for (const w of wedInsts ?? []) {
        const paidAt = (w as any).paid_at;
        if (!paidAt) continue;
        if (paidAt < monthStart || paidAt >= nextMonth) continue;
        addItem(casamentoGroup, "Villa Sonali / Casamento", {
          label: (w as any).description || (w as any).supplier || "Casamento",
          amount: Number((w as any).amount ?? 0),
          date: paidAt,
          source: (w as any).supplier,
        });
      }

      // Helper pra Map → array DREBucket
      const toArr = (g: Group): DREBucket[] => Array.from(g.entries()).map(([label, v]) => ({ label, total: v.total, items: v.items.sort((a, b) => b.amount - a.amount) })).sort((a, b) => b.total - a.total);
      const sumGroup = (g: Group) => Array.from(g.values()).reduce((s, v) => s + v.total, 0);

      // Build buckets de receita
      const receitas = {
        total: receitaTotal,
        renda_ativa: { label: "Renda Ativa Prevensul", total: rendaAtivaTotal, items: rendaAtivaItems.map((r: any) => ({ label: r.description || r.source || "Prevensul", amount: Number(r.amount ?? 0), date: r.received_at, source: r.source })).sort((a, b) => b.amount - a.amount) },
        renda_passiva: { label: "Renda Passiva (Kitnets — Modelo A)", total: rendaPassivaTotal, items: kitReconciled.map((k: any) => ({ label: `Aluguel — ${k.tenant_name || "(vago)"}`, amount: Number(k.total_liquid ?? 0), date: k.received_at, source: "kitnets" })).sort((a, b) => b.amount - a.amount) },
        comissoes_extras: {
          label: "Comissões Extras (parcelas recebidas no mês)",
          total: extrasTotal,
          items: (paidInstallments ?? []).map((p: any) => ({
            label: `${p.other_commissions?.description ?? "Comissão"} · parcela ${p.installment_number}`,
            amount: Number(p.paid_amount ?? p.amount ?? 0),
            date: p.paid_at,
            source: p.other_commissions?.source ?? null,
          })).sort((a: any, b: any) => b.amount - a.amount),
        },
        avulsas: { label: "Outras Receitas Avulsas", total: avulsasTotal, items: avulsasItems.map((r: any) => ({ label: r.description || r.source, amount: Number(r.amount ?? 0), date: r.received_at, source: r.source })).sort((a, b) => b.amount - a.amount) },
        entradas_neutras: entradasNeutras,
      };

      const custeioBuckets = toArr(custeioGroup);
      const obrasBuckets = toArr(obrasGroup);
      const terrenosArr = toArr(terrenosGroup);

      const dre: DRE = {
        month,
        receitas,
        custeio: { total: custeioBuckets.reduce((s, b) => s + b.total, 0), buckets: custeioBuckets },
        obras: {
          total: sumGroup(obrasGroup) + sumGroup(terrenosGroup),
          buckets: obrasBuckets,
          terrenos: terrenosArr[0] ?? { label: "Terrenos NRSX", total: 0, items: [] },
        },
        casamento: { total: sumGroup(casamentoGroup), buckets: toArr(casamentoGroup) },
        viagens: { total: sumGroup(viagensGroup), buckets: toArr(viagensGroup) },
        outros_aportes: {
          total: sumGroup(consorciosGroup) + sumGroup(devProGroup) + sumGroup(devPessoalGroup) + sumGroup(ferramentasGroup),
          consorcios: toArr(consorciosGroup)[0] ?? { label: "Consórcios", total: 0, items: [] },
          dev_profissional: toArr(devProGroup)[0] ?? { label: "Dev Profissional", total: 0, items: [] },
          dev_pessoal: toArr(devPessoalGroup)[0] ?? { label: "Dev Pessoal", total: 0, items: [] },
          ferramentas: toArr(ferramentasGroup)[0] ?? { label: "Ferramentas", total: 0, items: [] },
        },
        resultado: { receita: 0, custeio: 0, obras: 0, casamento: 0, viagens: 0, outros_aportes: 0, sobra_liquida: 0, sobra_operacional_pct: 0, reinvestimento_patrimonial_pct: 0, reinvestimento_total_pct: 0, casamento_viagens_pct: 0 },
      };

      // Resultado
      dre.resultado.receita = receitaTotal;
      dre.resultado.custeio = dre.custeio.total;
      dre.resultado.obras = dre.obras.total;
      dre.resultado.casamento = dre.casamento.total;
      dre.resultado.viagens = dre.viagens.total;
      dre.resultado.outros_aportes = dre.outros_aportes.total;
      dre.resultado.sobra_liquida = receitaTotal - dre.custeio.total - dre.obras.total - dre.casamento.total - dre.viagens.total - dre.outros_aportes.total;
      dre.resultado.sobra_operacional_pct = receitaTotal > 0 ? ((receitaTotal - dre.custeio.total) / receitaTotal) * 100 : 0;
      dre.resultado.reinvestimento_patrimonial_pct = receitaTotal > 0 ? (dre.obras.total / receitaTotal) * 100 : 0;
      dre.resultado.reinvestimento_total_pct = receitaTotal > 0 ? ((dre.obras.total + dre.outros_aportes.total) / receitaTotal) * 100 : 0;
      dre.resultado.casamento_viagens_pct = receitaTotal > 0 ? ((dre.casamento.total + dre.viagens.total) / receitaTotal) * 100 : 0;

      return dre;
    },
  });
}
