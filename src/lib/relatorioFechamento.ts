// ─── Gerador de Recibo de Repasse de Aluguel ───────────────────────────────
// Gera HTML imprimível (abre nova aba → Ctrl+P → Salvar como PDF)

const CORRETOR = "Luís Cláudio Domingos, Corretor de Imóveis CRECI 18.484 – SC";
const BANCO    = "Bco 085 Credifoz / Ag. 0109-0 / Conta Corrente: 1721373-8 / Posto atendimento: 004 / CPF: 058.437.139-03 William Tavares";

const COMPLEXOS: Record<string, { nome: string; endereco: string }> = {
  RWT02: { nome: "Residencial W Tavares 02", endereco: "Rua Amauri de Souza, nº 08, Itajaí – SC" },
  RWT03: { nome: "Residencial W Tavares 03", endereco: "Rua Manoel Corrêa, nº 125, Itajaí – SC"  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBR(str: string | null | undefined): string {
  if (!str) return "—";
  const d = new Date(str.length === 10 ? str + "T12:00:00" : str);
  return d.toLocaleDateString("pt-BR");
}

function mesAno(month: string): string {
  const [y, m] = month.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function hoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function unitNum(code: string): string {
  return code.split("-").pop() ?? code;
}

function resNum(residencialCode: string): string {
  return residencialCode.slice(-2); // "RWT02" → "02"
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #111;
    background: #fff;
    padding: 48px 56px;
    max-width: 720px;
    margin: 0 auto;
  }

  /* ── Cabeçalho do recibo ── */
  .recibo-header {
    display: flex;
    border: 2px solid #111;
    margin-bottom: 26px;
  }
  .recibo-header-left {
    flex: 1;
    padding: 14px 18px;
    border-right: 2px solid #111;
  }
  .recibo-header-left .title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.55;
  }
  .recibo-header-right {
    padding: 14px 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 155px;
  }
  .recibo-header-right .value {
    font-size: 17px;
    font-weight: 700;
  }

  /* ── Parágrafo descritivo ── */
  .body-text {
    line-height: 1.85;
    margin-bottom: 26px;
    text-align: justify;
  }

  /* ── Tabela financeira ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
  }
  td {
    border: 1.5px solid #111;
    padding: 9px 16px;
    font-weight: 600;
  }
  td:first-child {
    text-transform: uppercase;
    letter-spacing: 0.4px;
    width: 56%;
    text-align: center;
  }
  td:last-child { text-align: right; }
  tr.total-row td {
    font-size: 14px;
    font-weight: 700;
    background: #efefef;
  }

  /* ── Rodapé ── */
  .footer { line-height: 2.1; }
  .footer p { font-weight: 600; }

  /* ── Separador de páginas ── */
  .page-break {
    border-top: 2px dashed #ccc;
    margin: 44px 0;
  }

  /* ── Consolidado ── */
  .consolidado-title {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .consolidado-sub {
    font-size: 12px;
    color: #555;
    text-align: center;
    margin-bottom: 28px;
  }
  .sum-table th {
    background: #111;
    color: #fff;
    padding: 9px 10px;
    font-size: 11px;
    letter-spacing: 0.4px;
    text-align: center;
    border: 1.5px solid #111;
    font-weight: 600;
  }
  .sum-table td { font-size: 12px; text-align: right; }
  .sum-table td:first-child { text-align: center; }
  .sum-table td:nth-child(2) { text-align: left; padding-left: 10px; }
  .sum-table tr.sum-total td {
    background: #111;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
  }

  @media print {
    body { padding: 16px 24px; }
    @page { margin: 1.5cm; size: A4 portrait; }
    .page-break { page-break-after: always; border: none; margin: 0; }
  }
`;

// ─── Bloco de um recibo individual (HTML parcial) ────────────────────────────

function reciboBlock(kitnet: any, f: any): string {
  const cx   = COMPLEXOS[kitnet.residencial_code ?? ""] ?? { nome: kitnet.residencial_code, endereco: "" };
  const unit = unitNum(kitnet.code ?? "");
  const res  = resNum(kitnet.residencial_code ?? "");
  const nome = kitnet.tenant_name ?? "—";

  const bruto  = f.rent_gross   ?? 0;
  const iptu   = (f.iptu_taxa ?? f.iptu) ?? 0;
  const celesc = f.celesc        ?? 0;
  const semasa = f.semasa        ?? 0;
  const adm    = f.adm_fee       ?? 0;
  const total  = f.total_liquid  ?? 0;

  const periodo = (f.period_start && f.period_end)
    ? `${dateBR(f.period_start)} a ${dateBR(f.period_end)}`
    : mesAno(f.reference_month ?? "");

  return `
<div class="recibo-header">
  <div class="recibo-header-left">
    <div class="title">
      Recibo de Repasse de Aluguel<br>
      Res. ${res} CASA ${unit} — ${nome}
    </div>
  </div>
  <div class="recibo-header-right">
    <div class="value">${fmt(total)}</div>
  </div>
</div>

<p class="body-text">
  Recebi de, <strong>${CORRETOR}</strong>, referente ao repasse de aluguel
  da <strong>casa nº ${unit} do ${cx.nome}, situado na ${cx.endereco}</strong>,
  de acordo com o quadro abaixo e contratos de Adm. de Imóveis e Locação
  de Imóvel Residencial.
</p>

<table>
  <tr><td>Período</td>            <td>${periodo}</td></tr>
  <tr><td>Aluguéis</td>           <td>${fmt(bruto)}</td></tr>
  <tr><td>IPTU e Tx. de Lixo</td> <td>${fmt(iptu)}</td></tr>
  <tr><td>CELESC</td>             <td>${fmt(celesc)}</td></tr>
  <tr><td>SEMASA</td>             <td>${fmt(semasa)}</td></tr>
  <tr><td>ADM. 10% aluguel</td>   <td>${fmt(adm)}</td></tr>
  <tr class="total-row"><td>Total Líquido</td><td>${fmt(total)}</td></tr>
</table>

<div class="footer">
  <p>Itajaí-SC, ${hoje()}.</p>
  <p>Depósito: ${BANCO}.</p>
</div>`;
}

// ─── Wrapper HTML completo ───────────────────────────────────────────────────

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
${body}
<script>window.onload = () => { window.focus(); window.print(); }<\/script>
</body>
</html>`;
}

function openHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Gera e abre recibo de uma única kitnet */
export function abrirReciboIndividual(kitnet: any, fechamento: any) {
  const title = `Recibo — ${kitnet.code} — ${mesAno(fechamento.reference_month ?? "")}`;
  openHtml(wrapHtml(title, reciboBlock(kitnet, fechamento)));
}

/** Gera e abre relatório consolidado: sumário na p.1, recibos individuais a seguir */
export function abrirReciboConsolidado(
  entries: Array<{ kitnet: any; fechamento: any }>,
  month: string
) {
  const sorted = [...entries].sort((a, b) =>
    (a.kitnet.code ?? "").localeCompare(b.kitnet.code ?? "")
  );

  // ── Totalizadores ──
  const tot = sorted.reduce(
    (acc, { fechamento: f }) => {
      acc.bruto  += f.rent_gross  ?? 0;
      acc.iptu   += (f.iptu_taxa ?? f.iptu) ?? 0;
      acc.celesc += f.celesc      ?? 0;
      acc.semasa += f.semasa      ?? 0;
      acc.adm    += f.adm_fee     ?? 0;
      acc.total  += f.total_liquid ?? 0;
      return acc;
    },
    { bruto: 0, iptu: 0, celesc: 0, semasa: 0, adm: 0, total: 0 }
  );

  // ── Linhas da tabela sumário ──
  const linhas = sorted.map(({ kitnet, fechamento: f }) => `
  <tr>
    <td>${kitnet.code ?? "—"}</td>
    <td>${kitnet.tenant_name ?? "—"}</td>
    <td>${fmt(f.rent_gross ?? 0)}</td>
    <td>${fmt((f.iptu_taxa ?? f.iptu) ?? 0)}</td>
    <td>${fmt(f.celesc ?? 0)}</td>
    <td>${fmt(f.semasa ?? 0)}</td>
    <td>${fmt(f.adm_fee ?? 0)}</td>
    <td><strong>${fmt(f.total_liquid ?? 0)}</strong></td>
  </tr>`).join("\n");

  const consolidado = `
<div class="consolidado-title">Relatório Consolidado de Repasse</div>
<div class="consolidado-sub">${mesAno(month)} &nbsp;·&nbsp; Gerado em ${hoje()} &nbsp;·&nbsp; ${sorted.length} unidades</div>

<table class="sum-table">
  <thead>
    <tr>
      <th>Unidade</th>
      <th>Inquilino</th>
      <th>Bruto</th>
      <th>IPTU/Lixo</th>
      <th>CELESC</th>
      <th>SEMASA</th>
      <th>ADM</th>
      <th>Líquido</th>
    </tr>
  </thead>
  <tbody>${linhas}</tbody>
  <tfoot>
    <tr class="sum-total">
      <td colspan="2">TOTAL GERAL — ${sorted.length} unidades</td>
      <td>${fmt(tot.bruto)}</td>
      <td>${fmt(tot.iptu)}</td>
      <td>${fmt(tot.celesc)}</td>
      <td>${fmt(tot.semasa)}</td>
      <td>${fmt(tot.adm)}</td>
      <td>${fmt(tot.total)}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  <p>Itajaí-SC, ${hoje()}.</p>
  <p>Depósito: ${BANCO}.</p>
</div>`;

  const recibos = sorted
    .map(({ kitnet, fechamento }) =>
      `\n<div class="page-break"></div>\n${reciboBlock(kitnet, fechamento)}`
    )
    .join("\n");

  const title = `Relatório Consolidado — ${mesAno(month)}`;
  openHtml(wrapHtml(title, consolidado + recibos));
}
