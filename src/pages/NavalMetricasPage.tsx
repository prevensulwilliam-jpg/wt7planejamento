/**
 * NavalMetricasPage — wrapper standalone do dashboard de métricas Naval.
 *
 * O conteúdo real está em <NavalMetricasContent /> (reusado também na tab
 * "Métricas" dentro de /naval).
 *
 * Esta página continua acessível via URL /naval/metricas (sem link no sidebar
 * a partir de 03/05/2026 — William moveu a métrica como tab interna do Naval).
 */
import { useNavigate } from "react-router-dom";
import { BarChart3, Bot } from "lucide-react";
import { NavalMetricasContent } from "@/components/wt7/NavalMetricasContent";

export default function NavalMetricasPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b" style={{ borderColor: "#1A2535" }}>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: "#F0F4F8" }}>
              <BarChart3 className="w-6 h-6" style={{ color: "#A78BFA" }} />
              Naval — Métricas
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              Uso e custo dos últimos 30 dias · híbrido Sonnet 4.6 / Haiku 4.5
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/naval")}
              className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
              style={{ background: "rgba(167,139,250,.1)", color: "#C4B5FD", border: "1px solid rgba(167,139,250,.3)" }}
            >
              <Bot className="w-3 h-3" /> Voltar pro Naval
            </button>
            <button
              onClick={() => navigate("/naval/biblioteca")}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(232,201,122,.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,.3)" }}
            >
              📚 Biblioteca
            </button>
          </div>
        </div>

        <NavalMetricasContent />
      </div>
    </div>
  );
}
