import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { toast } from "sonner";

type Card = {
  id: string;
  name: string;
  bank: string;
  last4: string | null;
  closing_day: number | null;
  due_day: number | null;
};

type ParseResult = {
  ok: boolean;
  invoice_id?: string;
  reference_month?: string;
  total_amount?: number;
  parsed?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove "data:...;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function detectFormat(filename: string): "ofx" | "csv" | "pdf" | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "ofx") return "ofx";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  return null;
}

export default function CardsPage() {
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<ParseResult | null>(null);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);

  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").order("name");
      if (error) throw error;
      return data as Card[];
    },
  });

  async function handleUpload(file: File) {
    if (!selectedCardId) {
      toast.error("Selecione um cartão primeiro");
      return;
    }
    const format = detectFormat(file.name);
    if (!format) {
      toast.error("Formato inválido (use .ofx, .csv ou .pdf)");
      return;
    }

    setUploading(true);
    setLastResult(null);
    setRecentTxs([]);

    try {
      const file_content = format === "pdf" ? await fileToBase64(file) : await fileToText(file);

      const { data, error } = await supabase.functions.invoke("parse-card-invoice", {
        body: { card_id: selectedCardId, file_format: format, file_content },
      });
      if (error) throw error;

      const result = data as ParseResult;
      setLastResult(result);

      if (result.ok) {
        toast.success(`Importado: ${result.inserted} novas, ${result.skipped} duplicadas`);

        // Carrega transações pra visualização
        const { data: txs } = await supabase
          .from("card_transactions")
          .select("*, custom_categories(name, emoji, counts_as_investment)")
          .eq("invoice_id", result.invoice_id)
          .order("transaction_date", { ascending: false });
        setRecentTxs(txs || []);
      } else {
        toast.error(result.error || "Erro desconhecido");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro");
      setLastResult({ ok: false, error: e.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "#F0F4F8" }}>Cartões</h1>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
          Importe OFX (BB), CSV (XP) ou PDF. O parser extrai, categoriza e deduplica.
        </p>
      </div>

      {/* Upload */}
      <PremiumCard>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: "#F0F4F8" }}>Importar fatura</h2>

          <div className="space-y-2">
            <label className="text-sm" style={{ color: "#94A3B8" }}>Cartão</label>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-white"
            >
              <option value="">— escolha —</option>
              {cards?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.last4 ? `•••• ${c.last4}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm" style={{ color: "#94A3B8" }}>Arquivo (.ofx / .csv / .pdf)</label>
            <input
              type="file"
              accept=".ofx,.csv,.pdf"
              disabled={uploading || !selectedCardId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-yellow-600 file:text-black file:font-semibold hover:file:bg-yellow-500"
            />
          </div>

          {uploading && <p className="text-sm" style={{ color: "#C9A84C" }}>⏳ Processando...</p>}
        </div>
      </PremiumCard>

      {/* Resultado */}
      {lastResult && (
        <PremiumCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-3" style={{ color: "#F0F4F8" }}>Resultado</h2>
            {lastResult.ok ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>Mês</div>
                  <div className="text-lg font-bold" style={{ color: "#F0F4F8" }}>{lastResult.reference_month}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>Total</div>
                  <div className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                    R$ {lastResult.total_amount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>Transações</div>
                  <div className="text-lg font-bold" style={{ color: "#10B981" }}>{lastResult.parsed}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>Novas / Dup</div>
                  <div className="text-lg font-bold" style={{ color: "#F0F4F8" }}>
                    {lastResult.inserted} / {lastResult.skipped}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-red-400">❌ {lastResult.error}</div>
            )}
          </div>
        </PremiumCard>
      )}

      {/* Grid de transações */}
      {recentTxs.length > 0 && (
        <PremiumCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "#F0F4F8" }}>
              Transações ({recentTxs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10" style={{ color: "#94A3B8" }}>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Descrição</th>
                    <th className="text-left py-2 px-2">Portador</th>
                    <th className="text-left py-2 px-2">Categoria</th>
                    <th className="text-center py-2 px-2">Parc</th>
                    <th className="text-right py-2 px-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxs.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5" style={{ color: "#F0F4F8" }}>
                      <td className="py-2 px-2">{t.transaction_date}</td>
                      <td className="py-2 px-2">{t.description}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                        {t.cardholder || "—"}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {t.custom_categories?.emoji} {t.custom_categories?.name || "A Investigar"}
                        {t.counts_as_investment && (
                          <span className="ml-1 text-xs" style={{ color: "#10B981" }}>💎</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center text-xs">
                        {t.installment_total > 1 ? `${t.installment_current}/${t.installment_total}` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        R$ {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ color: "#C9A84C" }} className="font-bold">
                    <td colSpan={5} className="py-3 px-2 text-right">Total</td>
                    <td className="py-3 px-2 text-right font-mono">
                      R$ {recentTxs.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ color: "#10B981" }} className="text-sm">
                    <td colSpan={5} className="py-2 px-2 text-right">💎 Investimento (conta pra Sobra)</td>
                    <td className="py-2 px-2 text-right font-mono">
                      R$ {recentTxs.filter(t => t.counts_as_investment).reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ color: "#F43F5E" }} className="text-sm">
                    <td colSpan={5} className="py-2 px-2 text-right">Custo de Vida</td>
                    <td className="py-2 px-2 text-right font-mono">
                      R$ {recentTxs.filter(t => !t.counts_as_investment).reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </PremiumCard>
      )}
    </div>
  );
}
