import { useState } from "react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/useCategories";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Tag } from "lucide-react";

const EMOJIS = ["💳","⚡","🌐","📱","🎉","🍽️","💊","🏥","🔷","⚽","🔄","🧠","🏗️","🌍","💧","⛽","🏋️","🧾","💍","📲","🚗","📦","🏘️","💼","📊","☀️","📋","🚀","📈","💰","🏦","🎯","📉","🔧","🛒","✈️","🎓","💻","🔑","⚙️"];

const COLORS = [
  "#F43F5E","#F59E0B","#10B981","#3B82F6","#8B5CF6",
  "#2DD4BF","#EC4899","#C9A84C","#6366F1","#94A3B8","#4A5568",
];

const emptyForm = { name: "", emoji: "📦", type: "despesa", color: "#94A3B8" };

export default function CategoriesPage() {
  const { toast } = useToast();
  const { data: categories = [], isLoading } = useAllCategories();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<"all" | "despesa" | "receita">("all");

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({ name: cat.name, emoji: cat.emoji, type: cat.type, color: cat.color });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...form });
        toast({ title: "Categoria atualizada!" });
      } else {
        await createMut.mutateAsync(form);
        toast({ title: "Categoria criada!" });
      }
      setModalOpen(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: "Categoria removida." });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const activeCategories = categories.filter((c: any) => c.active !== false);
  const filtered = activeCategories.filter((c: any) =>
    filter === "all" ? true : c.type === filter || c.type === "ambos"
  );
  const despesas = filtered.filter((c: any) => c.type === "despesa" || c.type === "ambos");
  const receitas = filtered.filter((c: any) => c.type === "receita" || c.type === "ambos");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6" style={{ color: "#C9A84C" }} />
          <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
            Categorias
          </h1>
        </div>
        <GoldButton onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nova Categoria
        </GoldButton>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "despesa", "receita"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: filter === f ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#E8C97A" : "#94A3B8",
              border: `1px solid ${filter === f ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {f === "all" ? "Todas" : f === "despesa" ? "💸 Despesas" : "💰 Receitas"}
          </button>
        ))}
        <span className="text-xs ml-2" style={{ color: "#4A5568" }}>
          {filtered.length} categorias
        </span>
      </div>

      {isLoading ? (
        <PremiumCard>
          <div className="text-center py-12">
            <p style={{ color: "#94A3B8" }}>Carregando...</p>
          </div>
        </PremiumCard>
      ) : (
        <>
          {/* Grid despesas */}
          {(filter === "all" || filter === "despesa") && despesas.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "#F43F5E" }}>
                💸 Despesas ({despesas.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {despesas.map((cat: any) => (
                  <CategoryCard key={cat.id} cat={cat}
                    onEdit={() => openEdit(cat)}
                    onDelete={() => handleDelete(cat.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grid receitas */}
          {(filter === "all" || filter === "receita") && receitas.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "#10B981" }}>
                💰 Receitas ({receitas.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {receitas.map((cat: any) => (
                  <CategoryCard key={cat.id} cat={cat}
                    onEdit={() => openEdit(cat)}
                    onDelete={() => handleDelete(cat.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }} className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: "#F0F4F8" }}>
              {editing ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
              <span className="text-2xl">{form.emoji}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: "#F0F4F8" }}>
                  {form.name || "Nome da categoria"}
                </p>
                <span className="text-xs" style={{ color: form.color }}>
                  {form.type === "despesa" ? "Despesa" : form.type === "receita" ? "Receita" : "Ambos"}
                </span>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Nome *</label>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Maçonaria"
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Tipo</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                  <SelectItem value="despesa" style={{ color: "#F0F4F8" }}>💸 Despesa</SelectItem>
                  <SelectItem value="receita" style={{ color: "#F0F4F8" }}>💰 Receita</SelectItem>
                  <SelectItem value="ambos" style={{ color: "#F0F4F8" }}>↕️ Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emoji */}
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Emoji</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {EMOJIS.map(e => (
                  <button key={e} type="button"
                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className="w-9 h-9 rounded-lg text-lg transition-all flex items-center justify-center"
                    style={{
                      background: form.emoji === e ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${form.emoji === e ? "rgba(201,168,76,0.5)" : "transparent"}`,
                    }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor */}
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-all"
                    style={{
                      background: c,
                      border: form.color === c ? "3px solid white" : "3px solid transparent",
                      outline: form.color === c ? `2px solid ${c}` : "none",
                    }} />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ color: "#94A3B8" }}>
              Cancelar
            </button>
            <GoldButton onClick={handleSave}>
              {editing ? "Salvar alterações" : "Criar categoria"}
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryCard({ cat, onEdit, onDelete }: { cat: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl p-3 flex items-center justify-between group transition-all"
      style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xl flex-shrink-0">{cat.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#F0F4F8" }}>
            {cat.name}
          </p>
          {!cat.active && (
            <WtBadge variant="gray">Inativa</WtBadge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/5" title="Editar">
          <Pencil className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-white/5" title="Remover">
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#F43F5E" }} />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: "#F0F4F8" }}>Remover "{cat.name}"?</AlertDialogTitle>
              <AlertDialogDescription style={{ color: "#94A3B8" }}>
                A categoria será desativada. Lançamentos existentes não serão afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel style={{ color: "#94A3B8" }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}
                style={{ background: "rgba(244,63,94,0.2)", color: "#F43F5E" }}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
