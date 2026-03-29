import { useState, useRef, useEffect } from "react";
import { RefreshCw, Send, Sparkles, MessageSquare, TrendingUp, Home, Target } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWiselyAnalysis, useWiselyChat, useWiselyInsight } from "@/hooks/useWisely";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Quando vou atingir R$100k/mês?",
  "Qual kitnet está me dando mais retorno?",
  "Quais despesas posso cortar?",
  "Como está o andamento das obras?",
  "Como diversificar minha renda?",
];

function AnalysisCard() {
  const { analysis, loading, generate, context } = useWiselyAnalysis();

  return (
    <PremiumCard glowColor="rgba(45,212,191,0.3)">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="font-display font-bold" style={{ color: "#2DD4BF" }}>
            Análise de {context?.month ?? "..."}
          </h2>
        </div>
        <button
          onClick={() => generate()}
          disabled={loading}
          className="text-xs flex items-center gap-1 hover:text-wt-text-primary transition-colors disabled:opacity-50"
          style={{ color: "#94A3B8" }}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ background: "#131B22", width: `${90 - i * 10}%` }} />
          ))}
        </div>
      ) : (
        <div className="prose prose-sm prose-invert max-w-none text-sm" style={{ color: "#F0F4F8" }}>
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
              li: ({ children }) => <li style={{ color: "#F0F4F8", marginBottom: 4 }}>{children}</li>,
              h1: ({ children }) => <h3 className="font-display font-bold text-base mt-4 mb-2" style={{ color: "#2DD4BF" }}>{children}</h3>,
              h2: ({ children }) => <h3 className="font-display font-bold text-base mt-4 mb-2" style={{ color: "#2DD4BF" }}>{children}</h3>,
              h3: ({ children }) => <h4 className="font-display font-bold text-sm mt-3 mb-1" style={{ color: "#2DD4BF" }}>{children}</h4>,
              p: ({ children }) => <p style={{ color: "#F0F4F8", marginBottom: 8 }}>{children}</p>,
            }}
          >
            {analysis}
          </ReactMarkdown>
        </div>
      )}
    </PremiumCard>
  );
}

function ChatSection() {
  const { messages, loading, send } = useWiselyChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    send(txt);
  };

  return (
    <PremiumCard>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4" style={{ color: "#2DD4BF" }} />
        <h3 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>
          Pergunte ao Wisely
        </h3>
      </div>

      <div
        ref={scrollRef}
        className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1"
        style={{ minHeight: 120 }}
      >
        {messages.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: "#4A5568" }}>
            Faça uma pergunta sobre suas finanças...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="rounded-xl px-4 py-2 max-w-[85%] text-sm"
              style={{
                background: m.role === "user" ? "#1A2535" : "rgba(45,212,191,0.08)",
                border: m.role === "user" ? "1px solid #2A3F55" : "1px solid rgba(45,212,191,0.2)",
                color: "#F0F4F8",
              }}
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-bold" style={{ color: "#2DD4BF" }}>W</span>
                </div>
              )}
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
                    p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)" }}>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2DD4BF" }} />
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2DD4BF", animationDelay: "0.2s" }} />
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2DD4BF", animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setInput(""); send(s); }}
            className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-opacity-20"
            style={{ background: "rgba(45,212,191,0.1)", color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.2)" }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Pergunte algo ao Wisely..."
          className="flex-1"
          style={{ background: "#0D1318", borderColor: "#2A3F55", color: "#F0F4F8" }}
        />
        <GoldButton onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </GoldButton>
      </div>
    </PremiumCard>
  );
}

function InsightCard({
  icon,
  title,
  prompt,
  onDetail,
}: {
  icon: string;
  title: string;
  prompt: string;
  onDetail: (q: string) => void;
}) {
  const { text, loading } = useWiselyInsight(title, prompt);

  return (
    <PremiumCard>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <h4 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>{title}</h4>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-3 rounded" style={{ background: "#131B22", width: `${85 - i * 15}%` }} />
          ))}
        </div>
      ) : (
        <div className="prose prose-sm prose-invert max-w-none text-xs mb-3" style={{ color: "#94A3B8" }}>
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
              p: ({ children }) => <p style={{ margin: "2px 0" }}>{children}</p>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      )}
      <button
        onClick={() => onDetail(`Detalhe mais sobre: ${title}`)}
        className="text-xs hover:underline"
        style={{ color: "#2DD4BF" }}
      >
        Detalhar →
      </button>
    </PremiumCard>
  );
}

export default function WiselyPage() {
  const chatRef = useRef<{ send: (msg: string) => void }>(null);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <h1 className="font-display font-bold text-xl text-wt-text-primary">Wisely IA</h1>
          <WtBadge variant="cyan">powered by AI</WtBadge>
        </div>
      </div>

      {/* Analysis */}
      <AnalysisCard />

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard
          icon="💰"
          title="Renda"
          prompt="Analise a composição de receitas do William. Diversificação, dependência de fontes, tendências. Máximo 3 bullets curtos."
          onDetail={() => {}}
        />
        <InsightCard
          icon="🏘️"
          title="Kitnets"
          prompt="Analise a performance das kitnets: ocupação, vacância, manutenção, rentabilidade. Máximo 3 bullets curtos."
          onDetail={() => {}}
        />
        <InsightCard
          icon="🎯"
          title="Metas"
          prompt="Analise o progresso das metas do William. Distância de cada meta e próximo passo sugerido. Máximo 3 bullets curtos."
          onDetail={() => {}}
        />
      </div>

      {/* Chat */}
      <ChatSection />
    </div>
  );
}
