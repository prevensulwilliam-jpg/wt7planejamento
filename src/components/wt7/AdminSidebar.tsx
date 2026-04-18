import { useLocation, Link } from "react-router-dom";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import {
  LayoutDashboard, Bot, TrendingUp, TrendingDown, Landmark,
  Home, Zap, HardHat, Building2, BarChart3, RefreshCw, Heart,
  Target, Receipt, Radio, ClipboardList, Coins, Users, ArrowLeftRight, Brain, Tag, KeyRound, Banknote, CalendarClock, Briefcase
} from "lucide-react";

const navGroups = [
  {
    label: "VISÃO GERAL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Naval", icon: Bot, href: "/naval" },
    ],
  },
  {
    label: "ESTRATÉGIA",
    items: [
      { label: "Negócios", icon: Briefcase, href: "/businesses" },
    ],
  },
  {
    label: "RECEITAS & DESPESAS",
    items: [
      { label: "Receitas", icon: TrendingUp, href: "/revenues" },
      { label: "Despesas", icon: TrendingDown, href: "/expenses" },
      { label: "Bancos & Caixas", icon: Landmark, href: "/banks" },
      { label: "Conciliação Bancária", icon: ArrowLeftRight, href: "/reconciliation" },
      { label: "Categorias", icon: Tag, href: "/categories" },
      { label: "Aplicações", icon: BarChart3, href: "/assets?tab=investimentos" },
      { label: "Consórcios", icon: RefreshCw, href: "/consortiums" },
    ],
  },
  {
    label: "IMÓVEIS",
    items: [
      { label: "Kitnets", icon: Home, href: "/kitnets" },
      { label: "Energia Solar", icon: Zap, href: "/energy" },
      { label: "Portal Administrador", icon: KeyRound, href: "/manager/kitnets" },
      { label: "Obras & Terrenos", icon: HardHat, href: "/constructions" },
      { label: "Patrimônio", icon: Building2, href: "/assets?tab=bens" },
    ],
  },
  {
    label: "COMISSÕES",
    items: [
      { label: "Portal Comissões", icon: Coins, href: "/commissions/portal" },
      { label: "Comissões Externas", icon: Banknote, href: "/commissions/external" },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { label: "Despesas Recorrentes", icon: CalendarClock, href: "/recurring-bills" },
      { label: "Metas", icon: Target, href: "/goals" },
      { label: "Impostos & Dívidas", icon: Receipt, href: "/taxes" },
      { label: "Projeções", icon: Radio, href: "/projections" },
      { label: "Casamento 2027", icon: Heart, href: "/wedding" },
    ],
  },
  {
    label: "RELATÓRIOS",
    items: [
      { label: "Relatório Kitnets", icon: ClipboardList, href: "/reports/kitnets" },
      { label: "Relatório Comissões", icon: Coins, href: "/reports/commissions" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { label: "Usuários & Acessos", icon: Users, href: "/users" },
    ],
  },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const location = useLocation();

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300 overflow-y-auto"
      style={{
        width: collapsed ? 64 : 240,
        background: '#080C10',
        borderRight: '1px solid #1A2535',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 shrink-0">
        {collapsed ? (
          <button onClick={onToggle} className="w-full flex justify-center">
            <WT7Logo size="sm" />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <WT7Logo size="md" />
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-wt-border/30 text-wt-text-muted"
            >
              ‹
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-5">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[1.5px]" style={{ color: '#4A5568' }}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = item.href.includes('?')
                  ? (location.pathname + location.search) === item.href
                  : location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150"
                    style={{
                      background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                      borderLeft: active ? '3px solid #C9A84C' : '3px solid transparent',
                      color: active ? '#E8C97A' : '#94A3B8',
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="font-body">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
