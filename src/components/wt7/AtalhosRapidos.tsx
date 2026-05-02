/**
 * AtalhosRapidos — 6 botões pra navegação rápida no /hoje v4.
 */
import { useNavigate } from "react-router-dom";
import { Briefcase, Home, FileText, Bot, BarChart3, Target } from "lucide-react";

const ATALHOS = [
  { icon: Briefcase, label: "Negócios", path: "/negocios", color: "#C9A84C" },
  { icon: Home, label: "Kitnets", path: "/kitnets", color: "#10B981" },
  { icon: FileText, label: "Comissões", path: "/commissions/portal", color: "#3B82F6" },
  { icon: Bot, label: "Naval", path: "/naval", color: "#A78BFA" },
  { icon: BarChart3, label: "DRE", path: "/dre", color: "#F43F5E" },
  { icon: Target, label: "Metas", path: "/goals", color: "#E8C97A" },
];

export function AtalhosRapidos() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {ATALHOS.map(a => {
        const Icon = a.icon;
        return (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="rounded-xl p-3 border text-center transition-all hover:-translate-y-0.5 hover:border-[#C9A84C]"
            style={{
              background: "#0F141B",
              borderColor: "#1A2535",
            }}
          >
            <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: a.color }} />
            <div className="text-[10px] font-mono uppercase tracking-[0.5px]" style={{ color: "#F0F4F8" }}>
              {a.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
