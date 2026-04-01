export interface ParsedTransaction {
  external_id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  source: "ofx" | "csv";
}

export function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\n\r]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const dtposted = get("DTPOSTED");
    const trnamtRaw = get("TRNAMT").trim();
    const trnamt = parseFloat(
      trnamtRaw.includes(",")
        ? trnamtRaw.replace(/\./g, "").replace(",", ".")
        : trnamtRaw
    );
    const fitid = get("FITID");
    const memo = get("MEMO") || get("NAME");

    if (!fitid || isNaN(trnamt)) continue;

    const dateStr = dtposted.slice(0, 8);
    const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    transactions.push({
      external_id: fitid,
      date,
      description: memo,
      amount: Math.abs(trnamt),
      type: trnamt >= 0 ? "credit" : "debit",
      source: "ofx",
    });
  }

  return transactions;
}

export function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const transactions: ParsedTransaction[] = [];

  const isBB = header.includes("data") && header.includes("histórico");

  lines.slice(1).forEach((line, idx) => {
    const cols = line.split(/[;,\t]/).map(c => c.replace(/"/g, "").trim());
    if (cols.length < 3) return;

    let date = "";
    let description = "";
    let amount = 0;
    let type: "credit" | "debit" = "debit";

    if (isBB) {
      date = cols[0].split("/").reverse().join("-");
      description = cols[1] ?? "";
      const credit = parseFloat((cols[3] ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
      const debit = parseFloat((cols[4] ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
      if (credit > 0) { amount = credit; type = "credit"; }
      else { amount = debit; type = "debit"; }
    } else {
      date = cols[0].includes("/")
        ? cols[0].split("/").reverse().join("-")
        : cols[0];
      description = cols[1] ?? "";
      const raw = parseFloat((cols[2] ?? "0").replace(/\./g, "").replace(",", "."));
      amount = Math.abs(raw);
      type = raw >= 0 ? "credit" : "debit";
    }

    if (!date || isNaN(amount) || amount === 0) return;

    transactions.push({
      external_id: `csv-${date}-${amount}-${description.slice(0, 20).replace(/\s+/g, '_')}-${idx}`,
      date,
      description,
      amount,
      type,
      source: "csv",
    });
  });

  return transactions;
}
