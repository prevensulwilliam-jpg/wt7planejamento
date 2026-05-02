import { useState, useRef, useEffect } from "react";
import { RefreshCw, Send, MessageSquare, ChevronDown, ChevronUp, Play, History, Search, Trash2, Reply, X, BookmarkPlus, Save, Bell, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavalAnalysis, useNavalChat, useNavalInsight } from "@/hooks/useNaval";
import { useNavalHistory, useDeleteAllChats, useSaveMemory } from "@/hooks/useNavalHistory";
import { useNavalAlerts, useRunDailyCheck, useDismissAlert } from "@/hooks/useNavalAlerts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { formatDate } from "@/lib/formatters";

const SUGGESTIONS = [
  "Quando vou atingir R$100k/mês?",
  "Qual kitnet está me dando mais retorno?",
  "Quais despesas posso cortar?",
  "Como está o andamento das obras?",
];

// ─── Card de análise mensal — começa COLAPSADO ──────────────────────
function AnalysisCard() {
  const [expanded, setExpanded] = useState(false);
  const { analysis, loading, generate, context, hasGenerated } = useNavalAnalysis(false);

  const handleExpand = () => {
    if (!expanded) {
      setExpanded(true);
      if (!hasGenerated && !loading) generate();
    } else {
      setExpanded(false);
    }
  };

  return (
    <PremiumCard glowColor="rgba(45,212,191,0.3)">
      <button onClick={handleExpand} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="font-display font-bold" style={{ color: "#2DD4BF" }}>
            Análise de {context?.month ?? "..."}
          </h2>
          {!hasGenerated && !loading && <span className="text-[10px] uppercase tracking-wide" style={{ color: "#4A5568" }}>(clique pra carregar)</span>}
        </div>
        <div className="flex items-center gap-2">
          {hasGenerated && (
            <button
              onClick={(e) => { e.stopPropagation(); generate(); }}
              disabled={loading}
              className="text-xs flex items-center gap-1 hover:text-wt-text-primary transition-colors disabled:opacity-50"
              style={{ color: "#94A3B8" }}
              title="Recarregar análise"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "#94A3B8" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#94A3B8" }} />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 rounded" style={{ background: "#131B22", width: `${90 - i * 10}%` }} />
              ))}
            </div>
          ) : analysis ? (
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
          ) : null}
        </div>
      )}
    </PremiumCard>
  );
}

// ─── Card de insight (Renda/Kitnets/Metas) — começa COLAPSADO ────────
function InsightCard({ icon, title, prompt }: { icon: string; title: string; prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  const { text, loading, generate, hasGenerated } = useNavalInsight(title, prompt, false);

  const handleClick = () => {
    if (!expanded) {
      setExpanded(true);
      if (!hasGenerated && !loading) generate();
    } else {
      setExpanded(false);
    }
  };

  return (
    <PremiumCard>
      <button onClick={handleClick} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h4 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>{title}</h4>
          {!hasGenerated && !loading && <span className="text-[9px] uppercase" style={{ color: "#4A5568" }}>▶</span>}
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" style={{ color: "#94A3B8" }} /> : <ChevronDown className="w-3 h-3" style={{ color: "#94A3B8" }} />}
      </button>

      {expanded && (
        <div className="mt-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-3 rounded" style={{ background: "#131B22", width: `${85 - i * 15}%` }} />
              ))}
            </div>
          ) : text ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs" style={{ color: "#94A3B8" }}>
              <ReactMarkdown
                components={{
                  strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
                  p: ({ children }) => <p style={{ margin: "2px 0" }}>{children}</p>,
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          ) : null}
        </div>
      )}
    </PremiumCard>
  );
}

// ─── Modal "Salvar como memória permanente" ──────────────────────────
type SaveMemoryDialogProps = {
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
  initialAnswer?: string;
};
function SaveMemoryDialog({ open, onClose, initialQuestion = "", initialAnswer = "" }: SaveMemoryDialogProps) {
  const saveMutation = useSaveMemory();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (open) {
      // Pré-preenche: título sugerido a partir da pergunta, conteúdo combinando Q+A
      const suggestTitle = initialQuestion
        ? initialQuestion.slice(0, 60)
        : "";
      setTitle(suggestTitle);
      const combined = initialQuestion && initialAnswer
        ? `**Pergunta:** ${initialQuestion}\n\n**Resposta/regra:**\n${initialAnswer}`
        : initialAnswer || "";
      setContent(combined);
      // Slug auto: lowercase + sem acentos + traços
      const autoSlug = (suggestTitle || "memoria")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
      setSlug(autoSlug || `memoria_${Date.now()}`);
    }
  }, [open, initialQuestion, initialAnswer]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !slug.trim()) return;
    try {
      await saveMutation.mutateAsync({ slug: slug.trim(), title: title.trim(), content });
      onClose();
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`);
    }
  };

  const inputStyle = { background: "#0D1318", border: "1px solid #2A3F55", color: "#F0F4F8" } as const;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid rgba(45,212,191,0.4)", maxWidth: 600 }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#2DD4BF" }}>💾 Salvar como memória permanente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Naval vai usar essa memória em TODAS as próximas sessões. Use pra regras de negócio,
            fatos que ele precisa lembrar pra sempre (não confundir com histórico de chat de 7 dias).
          </p>
          <div>
            <label className="text-[10px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>Slug (id único)</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} style={inputStyle} placeholder="ex: ciclo_comissao_prevensul" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Ex: Regra do ciclo de comissão" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>Conteúdo (markdown ok)</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} style={inputStyle} />
            <p className="text-[10px] mt-1" style={{ color: "#4A5568" }}>Edite à vontade — só o que ficar aqui é o que Naval vai lembrar.</p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#1A2535", color: "#F0F4F8" }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !title.trim() || !content.trim() || !slug.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: "#C9A84C", color: "#000" }}
          >
            {saveMutation.isPending ? "Salvando..." : "💾 Salvar memória"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Chat principal — agora puxa últimas 10 do banco + mostra envio em andamento ──
type ChatSectionProps = {
  localMessages: { role: "user" | "assistant"; content: string }[];
  loading: boolean;
  send: (input: string) => void;
  loadConversation: (q: string, a: string) => void;
  clearChat: () => void;
};
function ChatSection({ localMessages, loading, send, loadConversation, clearChat }: ChatSectionProps) {
  const { data: history = [], isLoading: historyLoading } = useNavalHistory();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [memoryDialog, setMemoryDialog] = useState<{ open: boolean; q?: string; a?: string }>({ open: false });
  // Esconde o histórico inline (mas mantém no banco). User pode reexibir.
  // Persiste em localStorage pra manter mesmo após reload.
  const [historyHidden, setHistoryHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("naval_chat_hide_history") === "1";
  });

  const toggleHistoryHidden = (next: boolean) => {
    setHistoryHidden(next);
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem("naval_chat_hide_history", "1");
      else localStorage.removeItem("naval_chat_hide_history");
    }
  };

  const handleClearVisible = () => {
    clearChat();
    toggleHistoryHidden(true);
  };

  // Mostra: histórico do banco (mais antigo no topo) + mensagens locais novas (no fim)
  // Filtra historial pra evitar duplicar perguntas que já estão em messages locais
  const localQuestions = new Set(localMessages.filter((m) => m.role === "user").map((m) => m.content.trim()));
  const recentHistory = historyHidden
    ? []
    : history.slice(0, 10).filter((h) => !localQuestions.has(h.question.trim())).reverse();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [localMessages, recentHistory.length]);

  const handleSend = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    send(txt);
  };

  const isEmpty = localMessages.length === 0 && recentHistory.length === 0 && !historyLoading;

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: "#2DD4BF" }} />
          <h3 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>
            Pergunte ao Naval
          </h3>
          {localMessages.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(45,212,191,0.15)", color: "#2DD4BF" }}>
              em conversa ({localMessages.length} msg)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(localMessages.length > 0 || recentHistory.length > 0) && (
            <button
              onClick={handleClearVisible}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: "#94A3B8", border: "1px solid #2A3F55" }}
              title="Esconde a conversa atual e o histórico inline. Permanece tudo salvo na aba Histórico."
            >
              <Trash2 className="w-3 h-3" />
              Limpar
            </button>
          )}
          {historyHidden && history.length > 0 && (
            <button
              onClick={() => toggleHistoryHidden(false)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}
              title="Reexibir histórico recente nessa aba"
            >
              <History className="w-3 h-3" />
              Mostrar histórico
            </button>
          )}
          {!historyHidden && recentHistory.length > 0 && (
            <span className="text-[10px]" style={{ color: "#4A5568" }}>
              últimas {recentHistory.length} (auto-limpa em 7d)
            </span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="space-y-3 mb-4 max-h-[500px] overflow-y-auto pr-1" style={{ minHeight: 120 }}>
        {isEmpty && (
          <p className="text-xs text-center py-8" style={{ color: "#4A5568" }}>
            Faça uma pergunta sobre suas finanças...
          </p>
        )}

        {/* Histórico do banco (conversas anteriores, ainda dentro da janela 7d) */}
        {recentHistory.map((c) => (
          <div key={c.id} className="space-y-2 group">
            <div className="flex justify-end">
              <div
                className="rounded-xl px-4 py-2 max-w-[85%] text-sm opacity-70"
                style={{ background: "#1A2535", border: "1px solid #2A3F55", color: "#F0F4F8" }}
              >
                {c.question}
              </div>
            </div>
            <div className="flex justify-start items-end gap-2">
              <div
                className="rounded-xl px-4 py-2 max-w-[85%] text-sm opacity-90"
                style={{ background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.15)", color: "#F0F4F8" }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-bold" style={{ color: "#2DD4BF" }}>W</span>
                  <span className="text-[10px]" style={{ color: "#4A5568" }}>
                    {new Date(c.asked_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
                      p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
                    }}
                  >
                    {c.answer}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => loadConversation(c.question, c.answer)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md hover:bg-white/5"
                  style={{ color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}
                  title="Continuar essa conversa (próxima pergunta vai com esse contexto)"
                >
                  <Reply className="w-3 h-3" />
                  Continuar
                </button>
                <button
                  onClick={() => setMemoryDialog({ open: true, q: c.question, a: c.answer })}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md hover:bg-white/5"
                  style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
                  title="Salvar como memória permanente do Naval (não some em 7 dias)"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  Anotar
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Mensagens locais (sessão atual) — destaque visual mais forte */}
        {localMessages.map((m, i) => (
          <div key={`local-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
              <p className="text-[10px] mt-1" style={{ color: "#4A5568" }}>
                Naval pensando... pode sair da página, a resposta fica salva.
              </p>
            </div>
          </div>
        )}
      </div>

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

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Pergunte algo ao Naval..."
          className="flex-1"
          style={{ background: "#0D1318", borderColor: "#2A3F55", color: "#F0F4F8" }}
        />
        <GoldButton onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </GoldButton>
      </div>

      <SaveMemoryDialog
        open={memoryDialog.open}
        onClose={() => setMemoryDialog({ open: false })}
        initialQuestion={memoryDialog.q}
        initialAnswer={memoryDialog.a}
      />
    </PremiumCard>
  );
}

// ─── Aba de histórico — busca + limpar + continuar conversa ────────
type HistorySectionProps = {
  onContinue: (question: string, answer: string) => void;
};
function HistorySection({ onContinue }: HistorySectionProps) {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useNavalHistory(search);
  const deleteAll = useDeleteAllChats();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [memoryDialog, setMemoryDialog] = useState<{ open: boolean; q?: string; a?: string }>({ open: false });

  const handleClearAll = () => {
    if (!confirm("Apagar TODO o histórico de perguntas? Não dá pra desfazer.")) return;
    deleteAll.mutate();
  };

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" style={{ color: "#2DD4BF" }} />
          <h3 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>
            Histórico de perguntas
          </h3>
          <span className="text-[10px]" style={{ color: "#4A5568" }}>
            (auto-limpa após 7 dias)
          </span>
        </div>
        {data.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={deleteAll.isPending}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition-colors hover:bg-red-500/10 disabled:opacity-50"
            style={{ color: "#F43F5E", border: "1px solid rgba(244,63,94,0.3)" }}
          >
            <Trash2 className="w-3 h-3" />
            Limpar tudo
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#4A5568" }} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nas perguntas e respostas..."
          className="pl-10"
          style={{ background: "#0D1318", borderColor: "#2A3F55", color: "#F0F4F8" }}
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded" style={{ background: "#131B22" }} />
          ))}
        </div>
      )}

      {!isLoading && data.length === 0 && (
        <p className="text-xs text-center py-12" style={{ color: "#4A5568" }}>
          {search ? "Nenhuma pergunta encontrada com esse termo." : "Nenhuma pergunta ainda. Faça uma pergunta na aba ao lado."}
        </p>
      )}

      <div className="space-y-2">
        {data.map((c) => {
          const isOpen = expanded === c.id;
          return (
            <div key={c.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid #1A2535" }}>
              <button
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="w-full text-left p-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase" style={{ color: "#4A5568" }}>
                    {formatDate(c.asked_at)} · {new Date(c.asked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {c.tools_used && c.tools_used.length > 0 && ` · ${c.tools_used.length} tool(s)`}
                  </span>
                  {isOpen ? <ChevronUp className="w-3 h-3" style={{ color: "#94A3B8" }} /> : <ChevronDown className="w-3 h-3" style={{ color: "#94A3B8" }} />}
                </div>
                <p className="text-sm" style={{ color: "#F0F4F8" }}>{c.question}</p>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: "#1A2535", background: "#080C10" }}>
                  <div className="prose prose-sm prose-invert max-w-none text-xs mb-2" style={{ color: "#94A3B8" }}>
                    <ReactMarkdown
                      components={{
                        strong: ({ children }) => <strong style={{ color: "#E8C97A" }}>{children}</strong>,
                        p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
                      }}
                    >
                      {c.answer}
                    </ReactMarkdown>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t flex-wrap gap-2" style={{ borderColor: "#1A2535" }}>
                    <div className="flex flex-wrap gap-2 text-[10px]" style={{ color: "#4A5568" }}>
                      {c.tools_used?.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded" style={{ background: "rgba(45,212,191,0.08)", color: "#2DD4BF" }}>{t}</span>
                      ))}
                      {c.tokens_in != null && <span>in: {c.tokens_in}</span>}
                      {c.tokens_cache_read != null && c.tokens_cache_read > 0 && <span>cache: {c.tokens_cache_read}</span>}
                      {c.tokens_out != null && <span>out: {c.tokens_out}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMemoryDialog({ open: true, q: c.question, a: c.answer })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                        style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
                        title="Salvar como memória permanente do Naval"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        Anotar
                      </button>
                      <button
                        onClick={() => onContinue(c.question, c.answer)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                        style={{ color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}
                        title="Voltar pra aba Conversar com essa conversa carregada"
                      >
                        <Reply className="w-3 h-3" />
                        Continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SaveMemoryDialog
        open={memoryDialog.open}
        onClose={() => setMemoryDialog({ open: false })}
        initialQuestion={memoryDialog.q}
        initialAnswer={memoryDialog.a}
      />
    </PremiumCard>
  );
}

// ─── Aba Alertas — desvios detectados pelo cron diário ───────────────
function AlertsSection() {
  const { data: alerts = [], isLoading } = useNavalAlerts();
  const runCheck = useRunDailyCheck();
  const dismiss = useDismissAlert();

  const sevColor = (s: string) =>
    s === "critical" ? "#F43F5E" : s === "warning" ? "#F59E0B" : "#3B82F6";
  const sevIcon = (s: string) =>
    s === "critical" ? AlertCircle : s === "warning" ? AlertTriangle : Info;

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: "#F59E0B" }} />
          <h3 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>
            Alertas proativos
          </h3>
          {alerts.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
              {alerts.length} ativo(s)
            </span>
          )}
        </div>
        <button
          onClick={() => runCheck.mutate()}
          disabled={runCheck.isPending}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
          style={{ color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}
          title="Rodar detectores agora (sem esperar 06:00)"
        >
          <RefreshCw className={`w-3 h-3 ${runCheck.isPending ? "animate-spin" : ""}`} />
          Verificar agora
        </button>
      </div>

      <p className="text-[11px] mb-3" style={{ color: "#94A3B8" }}>
        Detectores rodam diariamente às 06:00. Cada alerta auto-resolve quando a condição corrige.
      </p>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded" style={{ background: "#131B22" }} />
          ))}
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-2" style={{ color: "#10B981", opacity: 0.5 }} />
          <p className="text-sm" style={{ color: "#94A3B8" }}>Tudo no trilho. Nenhum alerta ativo.</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((a) => {
          const SevIcon = sevIcon(a.severity);
          const color = sevColor(a.severity);
          return (
            <div key={a.id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: "#0D1318", border: `1px solid ${color}33` }}>
              <SevIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <h4 className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>{a.title}</h4>
                  <span className="text-[10px]" style={{ color: "#4A5568" }}>
                    {new Date(a.detected_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "#94A3B8" }}>{a.message}</p>
                {a.metric_name && (
                  <div className="text-[10px] mt-2" style={{ color: "#4A5568" }}>
                    {a.metric_name}: <span style={{ color }}>{a.metric_value}</span>
                    {a.metric_threshold != null && <span> · limite: {a.metric_threshold}</span>}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismiss.mutate(a.id)}
                disabled={dismiss.isPending}
                className="shrink-0 p-1.5 rounded hover:bg-white/5"
                style={{ color: "#4A5568" }}
                title="Marcar como visto / resolvido"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </PremiumCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL — Chat | Histórico
// ═══════════════════════════════════════════════════════════════════
export default function NavalPage() {
  const [tab, setTab] = useState<"chat" | "historico" | "alertas">("chat");
  // useNavalChat aqui no topo pra compartilhar entre ChatSection e HistorySection
  const chat = useNavalChat();
  const { data: alerts = [] } = useNavalAlerts();
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  // Callback usado pelo HistorySection: carrega conversa + muda pra aba Conversar
  const handleContinueFromHistory = (q: string, a: string) => {
    chat.loadConversation(q, a);
    setTab("chat");
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <h1 className="font-display font-bold text-xl text-wt-text-primary">Naval</h1>
          <WtBadge variant="cyan">híbrido · Sonnet 4.6 (análise) + Haiku 4.5 (factual)</WtBadge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "chat" | "historico" | "alertas")}>
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="chat">
            <MessageSquare className="w-3.5 h-3.5 mr-2" />
            Conversar
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="w-3.5 h-3.5 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="alertas">
            <Bell className="w-3.5 h-3.5 mr-2" />
            Alertas
            {(criticalCount + warningCount) > 0 && (
              <span
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: criticalCount > 0 ? "#F43F5E" : "#F59E0B",
                  color: "#fff",
                }}
              >
                {criticalCount + warningCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4 mt-6">
          {/* Cards de análise — colapsados, clica pra expandir + carregar */}
          <AnalysisCard />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InsightCard
              icon="💰"
              title="Renda"
              prompt="Analise a composição de receitas do William. Diversificação, dependência de fontes, tendências. Máximo 3 bullets curtos."
            />
            <InsightCard
              icon="🏘️"
              title="Kitnets"
              prompt="Analise a performance das kitnets: ocupação, vacância, manutenção, rentabilidade. Máximo 3 bullets curtos."
            />
            <InsightCard
              icon="🎯"
              title="Metas"
              prompt="Analise o progresso das metas do William. Distância de cada meta e próximo passo sugerido. Máximo 3 bullets curtos."
            />
          </div>

          <ChatSection
            localMessages={chat.messages}
            loading={chat.loading}
            send={chat.send}
            loadConversation={chat.loadConversation}
            clearChat={chat.clearChat}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <HistorySection onContinue={handleContinueFromHistory} />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <AlertsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
