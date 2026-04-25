import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCockpitBreakdown, type BreakdownBucket } from "@/hooks/useCockpitBreakdown";

type Section = "receita" | "custeio" | "investimento";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  month: string;
  section: Section;
}

const SECTION_META: Record<Section, { title: string; emoji: string; color: string; bg: string }> = {
  receita: {
    title: "Receita Real — Composição",
    emoji: "💰",
    color: "#E8C97A",
    bg: "rgba(232,201,122,0.05)",
  },
  custeio: {
    title: "Custeio — Composição",
    emoji: "💸",
    color: "#F43F5E",
    bg: "rgba(244,63,94,0.05)",
  },
  investimento: {
    title: "Investimento — Composição",
    emoji: "💎",
    color: "#10B981",
    bg: "rgba(16,185,129,0.05)",
  },
};

function BucketCard({ bucket, color, onClose }: { bucket: BreakdownBucket; color: string; onClose: () => void }) {
  if (bucket.total === 0 && bucket.count === 0) return null;
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "rgba(13,19,24,0.6)", border: `1px solid ${color}33` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider font-mono" style={{ color: "#94A3B8" }}>
            {bucket.label}
          </p>
          <p className="text-lg font-mono font-bold mt-0.5" style={{ color }}>
            {formatCurrency(bucket.total)}
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-mono" style={{ background: `${color}15`, color }}>
          {bucket.count} {bucket.count === 1 ? "item" : "itens"}
        </span>
      </div>

      {bucket.items.length > 0 && (
        <div className="space-y-1.5">
          {bucket.items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between text-xs gap-3 py-1.5 px-2 rounded"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ color: "#F0F4F8" }}>{it.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                  {it.date ? formatDate(it.date) : ""}
                  {it.source ? ` · ${it.source}` : ""}
                </p>
              </div>
              <span className="font-mono flex-shrink-0" style={{ color }}>
                {formatCurrency(it.amount)}
              </span>
            </div>
          ))}
          {bucket.count > bucket.items.length && (
            <p className="text-[10px] text-center pt-1" style={{ color: "#4A5568" }}>
              +{bucket.count - bucket.items.length} {bucket.count - bucket.items.length === 1 ? "outro" : "outros"} (top {bucket.items.length} mostrados)
            </p>
          )}
        </div>
      )}

      {bucket.link && (
        <Link
          to={bucket.link.href}
          onClick={onClose}
          className="flex items-center justify-between text-xs pt-2 mt-2 px-2 py-1.5 rounded transition-all hover:opacity-80"
          style={{ borderTop: `1px solid ${color}22`, color }}
        >
          <span className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" />
            {bucket.link.label}
          </span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

export function CockpitDrillDownModal({ open, onOpenChange, month, section }: Props) {
  const { data, isLoading } = useCockpitBreakdown(month);
  const meta = SECTION_META[section];
  const sectionData = data?.[section];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: "#0D1318", border: `1px solid ${meta.color}40` }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: meta.color }}>
            <span>{meta.emoji}</span>
            <span>{meta.title}</span>
            <span className="text-xs font-mono ml-auto opacity-70">{month}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : sectionData ? (
          <div className="space-y-3">
            {/* Total destacado */}
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
            >
              <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "#94A3B8" }}>
                TOTAL
              </p>
              <p className="text-3xl font-mono font-bold mt-1" style={{ color: meta.color }}>
                {formatCurrency(sectionData.total)}
              </p>
            </div>

            {/* Buckets principais */}
            {sectionData.buckets.map((bucket, i) => (
              <BucketCard key={i} bucket={bucket} color={meta.color} onClose={() => onOpenChange(false)} />
            ))}

            {/* Excluídos (só pra custeio) */}
            {section === "custeio" && (data!.custeio.excluded?.length ?? 0) > 0 && (
              <div
                className="rounded-xl p-3 mt-4"
                style={{ background: "rgba(100,116,139,0.05)", border: "1px dashed #1A2535" }}
              >
                <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "#64748B" }}>
                  ⚠ EXCLUÍDOS DO CUSTEIO (auditoria — transparência total)
                </p>
                {data!.custeio.excluded.map((bucket, i) => (
                  bucket.total > 0 && (
                    <div key={i} className="mb-2 last:mb-0">
                      <BucketCard bucket={bucket} color="#64748B" onClose={() => onOpenChange(false)} />
                    </div>
                  )
                ))}
                <p className="text-[10px] mt-3 leading-relaxed px-2" style={{ color: "#64748B" }}>
                  Esses valores aparecem em /despesas (total bruto da tabela R${" "}
                  {formatCurrency(sectionData.total + (data!.custeio.excluded?.reduce((s, b) => s + b.total, 0) ?? 0)).replace("R$ ", "")}{" "}
                  ) mas NÃO entram no Custeio do cockpit pra evitar duplicação e ruído contábil.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-center py-8" style={{ color: "#64748B" }}>
            Sem dados pra esse mês.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
