import { useMemo, useState } from "react";
import { BookOpen, Plus, Trash2, Eye, EyeOff, Pencil, Upload, Link as LinkIcon, FileText, Sparkles, X, Save } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useNavalSources,
  useIngestNavalSource,
  useCreateNavalSource,
  useUpdateNavalSource,
  useDeleteNavalSource,
  slugify,
  LENS_LABEL,
  LENS_COLOR,
  type NavalLens,
  type NavalSource,
  type NavalSourceType,
  type IngestDraft,
} from "@/hooks/useNavalSources";

const LENS_ORDER: NavalLens[] = ["naval", "aaron_ross", "housel", "tevah", "operador", "outros"];

const SOURCE_TYPE_LABEL: Record<NavalSourceType, string> = {
  book: "Livro", video: "Vídeo", article: "Artigo", podcast: "Podcast", note: "Nota", course: "Curso",
};

export default function BibliotecaPage() {
  const { data: sources, isLoading } = useNavalSources();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NavalSource | null>(null);

  const grouped = useMemo(() => {
    const g: Record<NavalLens, NavalSource[]> = {
      naval: [], aaron_ross: [], housel: [], tevah: [], operador: [], outros: [],
    };
    (sources ?? []).forEach((s) => g[s.lens].push(s));
    return g;
  }, [sources]);

  const totalActive = (sources ?? []).filter((s) => s.active).length;
  const totalPrinciples = (sources ?? []).reduce((acc, s) => acc + (s.active ? s.principles.length : 0), 0);

  return (
    <div className="min-h-screen" style={{ background: "#0B1015" }}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-6 h-6" style={{ color: "#E8C97A" }} />
              <h1 className="font-display text-2xl font-bold" style={{ color: "#E8C97A" }}>
                Biblioteca do Naval
              </h1>
            </div>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              Brain stack do conselheiro — {totalActive} fontes ativas · {totalPrinciples} princípios carregados
            </p>
          </div>
          <GoldButton onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1 inline" /> Nova fonte
          </GoldButton>
        </div>

        {/* Grid por lente */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" style={{ background: "#131B22" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {LENS_ORDER.map((lens) => {
              const items = grouped[lens];
              if (items.length === 0) return null;
              return (
                <div key={lens}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`px-3 py-1 rounded border text-xs font-bold ${LENS_COLOR[lens]}`}>
                      {LENS_LABEL[lens]}
                    </div>
                    <div className="text-xs" style={{ color: "#64748B" }}>
                      {items.filter((i) => i.active).length}/{items.length} ativa(s)
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((s) => (
                      <SourceCard key={s.id} source={s} onEdit={() => { setEditing(s); setModalOpen(true); }} />
                    ))}
                  </div>
                </div>
              );
            })}

            {(sources ?? []).length === 0 && (
              <PremiumCard>
                <div className="text-center py-8" style={{ color: "#94A3B8" }}>
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Biblioteca vazia. Alimente o Naval com uma fonte.
                </div>
              </PremiumCard>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <SourceModal
          source={editing}
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Card de fonte
// ─────────────────────────────────────────
function SourceCard({ source, onEdit }: { source: NavalSource; onEdit: () => void }) {
  const update = useUpdateNavalSource();
  const del = useDeleteNavalSource();
  const { toast } = useToast();

  const handleToggle = () => {
    update.mutate({ id: source.id, patch: { active: !source.active } }, {
      onSuccess: () => toast({ title: source.active ? "Desativada" : "Ativada", description: source.title }),
    });
  };

  const handleDelete = () => {
    if (!confirm(`Apagar "${source.title}"? Esta ação é irreversível.`)) return;
    del.mutate(source.id, {
      onSuccess: () => toast({ title: "Removida", description: source.title }),
    });
  };

  return (
    <PremiumCard glowColor={source.active ? "rgba(232,201,122,0.15)" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <WtBadge variant={source.active ? "gold" : "red"}>
              {SOURCE_TYPE_LABEL[source.source_type]}
            </WtBadge>
            {!source.active && <span className="text-xs" style={{ color: "#EF4444" }}>inativa</span>}
          </div>
          <h3 className="font-display font-bold text-base truncate" style={{ color: "#F0F4F8" }}>
            {source.title}
          </h3>
          {source.author && (
            <p className="text-xs truncate" style={{ color: "#94A3B8" }}>{source.author}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleToggle} className="p-1.5 rounded hover:bg-white/5 transition" title={source.active ? "Desativar" : "Ativar"}>
            {source.active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-zinc-500" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5 transition" title="Editar">
            <Pencil className="w-4 h-4" style={{ color: "#E8C97A" }} />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded hover:bg-white/5 transition" title="Apagar">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {source.summary && (
        <p className="text-xs mt-3 line-clamp-2" style={{ color: "#94A3B8" }}>
          {source.summary}
        </p>
      )}

      <div className="mt-3 text-xs flex items-center gap-3" style={{ color: "#64748B" }}>
        <span>📚 {source.principles.length} princípios</span>
        <span>· prioridade {source.priority}</span>
      </div>
    </PremiumCard>
  );
}

// ─────────────────────────────────────────
// Modal: ingest + review + save
// ─────────────────────────────────────────
function SourceModal({ source, open, onClose }: {
  source: NavalSource | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEdit = source !== null;
  const { toast } = useToast();
  const ingest = useIngestNavalSource();
  const create = useCreateNavalSource();
  const update = useUpdateNavalSource();

  // Estado do rascunho editável
  const [draft, setDraft] = useState<IngestDraft & { source_type: NavalSourceType; source_url?: string; priority: number; active: boolean }>(() => ({
    title: source?.title ?? "",
    author: source?.author ?? "",
    lens: (source?.lens ?? "outros") as NavalLens,
    summary: source?.summary ?? "",
    principles: source?.principles ?? [],
    source_type: source?.source_type ?? "book",
    source_url: source?.source_url ?? "",
    priority: source?.priority ?? 100,
    active: source?.active ?? true,
  }));

  // Entradas de ingest
  const [activeTab, setActiveTab] = useState<"pdf" | "url" | "text">("text");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [hint, setHint] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      res(s.split(",")[1] ?? "");
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleIngest = async () => {
    try {
      let input: Parameters<typeof ingest.mutateAsync>[0];
      if (activeTab === "pdf") {
        if (!pdfFile) { toast({ title: "Selecione um PDF", variant: "destructive" as any }); return; }
        const b64 = await fileToBase64(pdfFile);
        input = { mode: "pdf", pdfBase64: b64, mediaType: pdfFile.type, hint };
      } else if (activeTab === "url") {
        if (!urlInput) { toast({ title: "Cole a URL", variant: "destructive" as any }); return; }
        input = { mode: "url", url: urlInput, hint };
      } else {
        if (!textInput.trim()) { toast({ title: "Cole o texto", variant: "destructive" as any }); return; }
        input = { mode: "text", rawText: textInput, hint };
      }

      const d = await ingest.mutateAsync(input);
      setDraft((prev) => ({
        ...prev,
        title: d.title,
        author: d.author,
        lens: d.lens,
        summary: d.summary,
        principles: d.principles,
        source_url: activeTab === "url" ? urlInput : prev.source_url,
      }));
      toast({ title: "Destilado!", description: `${d.principles.length} princípios extraídos — revise e salve.` });
    } catch (e: any) {
      toast({ title: "Falha na destilação", description: e?.message ?? "Erro", variant: "destructive" as any });
    }
  };

  const handleSave = async () => {
    if (!draft.title) { toast({ title: "Título obrigatório", variant: "destructive" as any }); return; }
    if (draft.principles.length === 0) { toast({ title: "Sem princípios pra salvar", variant: "destructive" as any }); return; }

    try {
      if (isEdit && source) {
        await update.mutateAsync({
          id: source.id,
          patch: {
            title: draft.title,
            author: draft.author || null,
            source_type: draft.source_type,
            source_url: draft.source_url || null,
            lens: draft.lens,
            summary: draft.summary || null,
            principles: draft.principles,
            priority: draft.priority,
            active: draft.active,
          },
        });
        toast({ title: "Atualizada", description: draft.title });
      } else {
        await create.mutateAsync({
          slug: slugify(draft.title) || `source-${Date.now()}`,
          title: draft.title,
          author: draft.author || null,
          source_type: draft.source_type,
          source_url: draft.source_url || null,
          lens: draft.lens,
          summary: draft.summary || null,
          principles: draft.principles,
          priority: draft.priority,
          active: draft.active,
        });
        toast({ title: "Adicionada à biblioteca", description: draft.title });
      }
      onClose();
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e?.message ?? "Erro", variant: "destructive" as any });
    }
  };

  const updatePrinciple = (i: number, v: string) => {
    setDraft((d) => ({ ...d, principles: d.principles.map((p, idx) => idx === i ? v : p) }));
  };
  const removePrinciple = (i: number) => {
    setDraft((d) => ({ ...d, principles: d.principles.filter((_, idx) => idx !== i) }));
  };
  const addPrinciple = () => {
    setDraft((d) => ({ ...d, principles: [...d.principles, ""] }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: "#0F1720", border: "1px solid #1E293B" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#E8C97A" }}>
            {isEdit ? "Editar fonte" : "Nova fonte na biblioteca"}
          </DialogTitle>
        </DialogHeader>

        {/* Só mostra aba de ingest se NÃO for edição */}
        {!isEdit && (
          <div className="space-y-3 border-b pb-4" style={{ borderColor: "#1E293B" }}>
            <div className="text-xs" style={{ color: "#94A3B8" }}>
              1. Destile — cole texto, URL ou PDF; Naval extrai princípios via IA
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text"><FileText className="w-3 h-3 mr-1 inline" /> Texto</TabsTrigger>
                <TabsTrigger value="url"><LinkIcon className="w-3 h-3 mr-1 inline" /> URL</TabsTrigger>
                <TabsTrigger value="pdf"><Upload className="w-3 h-3 mr-1 inline" /> PDF</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="pt-3">
                <Textarea
                  placeholder="Cole aqui o texto do artigo, capítulo, transcrição, notas..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                  style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}
                />
              </TabsContent>
              <TabsContent value="url" className="pt-3">
                <Input
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}
                />
                <p className="text-xs mt-2" style={{ color: "#64748B" }}>
                  Baixa o HTML e extrai texto automaticamente. Ideal para artigos de blog/Substack/Medium.
                </p>
              </TabsContent>
              <TabsContent value="pdf" className="pt-3">
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}
                />
                {pdfFile && <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>{pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)}KB)</p>}
              </TabsContent>
            </Tabs>
            <Input
              placeholder="Dica opcional (ex: 'capítulo sobre alavancagem do Naval')"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}
            />
            <button
              onClick={handleIngest}
              disabled={ingest.isPending}
              className="w-full py-2 px-4 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #E8C97A, #B8943F)", color: "#0B1015" }}
            >
              <Sparkles className="w-4 h-4" />
              {ingest.isPending ? "Destilando..." : "Destilar com IA"}
            </button>
          </div>
        )}

        {/* Formulário do rascunho */}
        <div className="space-y-4 pt-2">
          <div className="text-xs" style={{ color: "#94A3B8" }}>
            {isEdit ? "Edite os campos e salve" : "2. Revise os princípios destilados e salve"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Título</label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Autor</label>
              <Input value={draft.author ?? ""} onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Lente</label>
              <Select value={draft.lens} onValueChange={(v) => setDraft({ ...draft, lens: v as NavalLens })}>
                <SelectTrigger style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENS_ORDER.map((l) => <SelectItem key={l} value={l}>{LENS_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Tipo</label>
              <Select value={draft.source_type} onValueChange={(v) => setDraft({ ...draft, source_type: v as NavalSourceType })}>
                <SelectTrigger style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_TYPE_LABEL) as NavalSourceType[]).map((t) =>
                    <SelectItem key={t} value={t}>{SOURCE_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>URL (opcional)</label>
              <Input value={draft.source_url ?? ""} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
                style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Resumo (quando usar essa lente?)</label>
              <Textarea value={draft.summary ?? ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={2}
                style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Prioridade (menor = mais acionada)</label>
              <Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 100 })}
                style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8" }} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#F0F4F8" }}>
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Ativa (Naval carrega no prompt)
              </label>
            </div>
          </div>

          {/* Princípios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs" style={{ color: "#94A3B8" }}>
                Princípios operativos ({draft.principles.length})
              </label>
              <button onClick={addPrinciple} className="text-xs flex items-center gap-1" style={{ color: "#E8C97A" }}>
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {draft.principles.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs pt-3 w-5 text-right" style={{ color: "#64748B" }}>{i + 1}.</span>
                  <Textarea
                    value={p}
                    onChange={(e) => updatePrinciple(i, e.target.value)}
                    rows={2}
                    className="flex-1"
                    style={{ background: "#0B1015", borderColor: "#1E293B", color: "#F0F4F8", fontSize: 13 }}
                  />
                  <button onClick={() => removePrinciple(i)} className="p-1 hover:bg-white/5 rounded mt-1">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              {draft.principles.length === 0 && (
                <div className="text-xs text-center py-6" style={{ color: "#64748B" }}>
                  Sem princípios ainda. Use "Destilar com IA" acima ou adicione manualmente.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: "#1E293B" }}>
            <button onClick={onClose} className="px-4 py-2 text-sm rounded" style={{ color: "#94A3B8" }}>
              Cancelar
            </button>
            <GoldButton onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="w-4 h-4 mr-1 inline" />
              {isEdit ? "Atualizar" : "Salvar na biblioteca"}
            </GoldButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
