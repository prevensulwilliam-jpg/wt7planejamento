// ─── Gerador de Relatório de Comissões Prevensul ────────────────────────────
// Gera HTML imprimível (abre nova aba → Ctrl+P → Salvar como PDF)

const EMPRESA = {
  nome:     "PREVENSUL COMERCIAL ELÉTRICA E SISTEMAS CONTRA INCÊNDIO",
  cnpj:     "CNPJ: 05.047.431/0001-27",
  endereco: "Rua Gustavo Bernedt, nº 358 – Cordeiros, Itajaí – SC – CEP 88.310-550",
  telefone: "(47) 3083-4219",
};

const RESPONSAVEL = {
  nome:  "William Tavares",
  cargo: "Diretor Comercial",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function brl(v: number | null | undefined): string {
  if (v == null) return "R$ —";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesAnoLong(month: string): string {
  const [y, m] = month.split("-");
  return new Date(+y, +m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .toUpperCase();
}

function hoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page { size: A4 landscape; margin: 18mm 16mm; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
  }

  /* ── Cabeçalho empresa ── */
  .empresa-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .empresa-nome {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.3px;
    margin-bottom: 3px;
  }
  .empresa-info {
    font-size: 10.5px;
    color: #333;
    line-height: 1.7;
  }
  .empresa-contato {
    text-align: right;
    font-size: 10.5px;
    color: #333;
    line-height: 1.7;
  }

  /* ── Título relatório ── */
  .relatorio-titulo {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .relatorio-sub {
    text-align: center;
    font-size: 10px;
    color: #666;
    margin-bottom: 16px;
  }

  /* ── Tabela ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
    font-size: 10.5px;
  }
  th {
    background: #111;
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-weight: 700;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }
  th.num, td.num { text-align: right; }
  td {
    border: 1px solid #ccc;
    padding: 6px 10px;
    vertical-align: middle;
  }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr.total-row td {
    background: #e8e8e8;
    font-weight: 700;
    font-size: 11px;
    border-top: 2px solid #111;
  }

  /* ── Status badges ── */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .badge-pago        { background: #d1fae5; color: #065f46; }
  .badge-parcial     { background: #fef3c7; color: #92400e; }
  .badge-pendente    { background: #dbeafe; color: #1e40af; }
  .badge-inadimplente{ background: #fee2e2; color: #991b1b; }

  /* ── Rodapé / assinaturas ── */
  .footer-info {
    font-size: 10.5px;
    margin-bottom: 28px;
    color: #333;
  }
  .assinaturas {
    display: flex;
    gap: 60px;
    margin-top: 8px;
  }
  .assinatura-bloco {
    flex: 1;
    max-width: 260px;
  }
  .assinatura-linha {
    border-top: 1.5px solid #111;
    margin-bottom: 5px;
  }
  .assinatura-nome {
    font-weight: 700;
    font-size: 10.5px;
  }
  .assinatura-cargo {
    font-size: 10px;
    color: #555;
  }
`;

// ─── Badge HTML ──────────────────────────────────────────────────────────────

function badgeHtml(status: string | null): string {
  const s = status ?? "";
  const cls: Record<string, string> = {
    Pago: "badge-pago",
    Parcial: "badge-parcial",
    Pendente: "badge-pendente",
    Inadimplente: "badge-inadimplente",
    Quitado: "badge-pago",
  };
  return `<span class="badge ${cls[s] ?? ""}">${s || "—"}</span>`;
}

// ─── Wrapper HTML ────────────────────────────────────────────────────────────

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

// ─── Gerador principal ───────────────────────────────────────────────────────

export function exportPDF(data: any[], month: string): void {
  const mesLabel = mesAnoLong(month);
  const title = `Relatório de Comissões — ${mesLabel}`;

  const totalPago = data.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const totalComissao = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);

  const linhas = data.map(r => `
  <tr>
    <td>${r.client_name ?? "—"}</td>
    <td class="num">${brl(r.contract_total)}</td>
    <td class="num">${brl(r.balance_remaining)}</td>
    <td style="text-align:center">
      ${r.installment_current != null || r.installment_total != null
        ? `${r.installment_current ?? "—"}/${r.installment_total ?? "—"}`
        : "—"}
    </td>
    <td style="text-align:center">${r.closing_date ?? "—"}</td>
    <td class="num">${brl(r.amount_paid)}</td>
    <td class="num">${brl(r.commission_value)}</td>
    <td style="text-align:center">${badgeHtml(r.status)}</td>
  </tr>`).join("");

  const body = `
<div class="empresa-header">
  <div>
    <div class="empresa-nome">${EMPRESA.nome}</div>
    <div class="empresa-info">${EMPRESA.cnpj}</div>
    <div class="empresa-info">${EMPRESA.endereco}</div>
  </div>
  <div class="empresa-contato">
    <div>${EMPRESA.telefone}</div>
  </div>
</div>

<div class="relatorio-titulo">Relatório de Comissões — ${mesLabel}</div>
<div class="relatorio-sub">Gerado em ${hoje()}</div>

<table>
  <thead>
    <tr>
      <th>CLIENTE</th>
      <th class="num">VALOR</th>
      <th class="num">SALDO</th>
      <th style="text-align:center">PARCELA</th>
      <th style="text-align:center">DATA FECH.</th>
      <th class="num">PAGO</th>
      <th class="num">COMISSÃO</th>
      <th style="text-align:center">STATUS</th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
    <tr class="total-row">
      <td colspan="5">TOTAL</td>
      <td class="num">${brl(totalPago)}</td>
      <td class="num">${brl(totalComissao)}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer-info">Itajaí – SC, ${hoje()}.</div>

<div class="assinaturas">
  <div class="assinatura-bloco">
    <div class="assinatura-linha"></div>
    <div class="assinatura-nome">${RESPONSAVEL.nome}</div>
    <div class="assinatura-cargo">${RESPONSAVEL.cargo}</div>
  </div>
  <div class="assinatura-bloco">
    <div class="assinatura-linha"></div>
    <div class="assinatura-nome">Responsável Financeiro</div>
    <div class="assinatura-cargo">&nbsp;</div>
  </div>
</div>`;

  openHtml(wrapHtml(title, body));
}
