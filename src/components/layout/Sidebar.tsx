import { forwardRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowUpDown,
  Settings,
  FileText,
  Upload,
  History,
  TrendingUp,
  Gauge,
  Receipt,
  Banknote,
  Activity,
  Send,
  Wallet,
  BarChart3,
  Clock,
  PieChart,
  LineChart,
  Users,
  CheckSquare,
  Trash2,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// =====================================================
// NAVEGAÇÃO PRINCIPAL — SALLUS FINANCE
// =====================================================
// Estrutura organizada por fluxo operacional real:
// Operação → Relatórios → Executivo → Resultados → Administração
//
// ⚠️ Itens administrativos são filtrados por permissão
// ⚠️ Admin visualiza todos os itens
// =====================================================

const navSections: NavSection[] = [
  {
    title: "Operação",
    items: [
      { to: "/", icon: Wallet, label: "Caixa", permission: "VIEW_DASHBOARD" },
      { to: "/transactions", icon: ArrowUpDown, label: "Movimentações", permission: "VIEW_TRANSACTIONS" },
      { to: "/production", icon: Activity, label: "Produção", permission: "VIEW_PRODUCTION" },
      { to: "/suggested-billing", icon: Send, label: "Faturamento Sugerido", permission: "VIEW_BILLING" },
      { to: "/billing", icon: Receipt, label: "Faturamento", permission: "VIEW_BILLING" },
      { to: "/conciliation", icon: CheckSquare, label: "Conciliação", badge: "NOVO", permission: "VIEW_RECEIVABLES" },
    ],
  },
  {
    title: "📊 Relatórios",
    items: [
      { to: "/production-report", icon: Activity, label: "Produção", permission: "VIEW_REPORTS" },
      { to: "/reports", icon: Wallet, label: "Financeiro", permission: "VIEW_REPORTS" },
      { to: "/billing-report", icon: Receipt, label: "Faturamento", permission: "VIEW_REPORTS" },
      { to: "/aging-report", icon: Clock, label: "Aging (A Receber)", permission: "VIEW_RECEIVABLES" },
    ],
  },
  {
    title: "📈 Executivo",
    items: [
      // ✅ NOVO: BI v2 (PowerBI-like)
      { to: "/bi-v2", icon: BarChart3, label: "BI v2", badge: "BETA", permission: "VIEW_BI" },

      // BI atual
      { to: "/bi", icon: BarChart3, label: "BI", badge: "NOVO", permission: "VIEW_BI" },

      { to: "/executive-report", icon: PieChart, label: "Relatório Executivo", permission: "VIEW_REPORTS" },
      { to: "/monthly-report", icon: FileText, label: "Rel. Mensal", badge: "PDF", permission: "VIEW_REPORTS" },
    ],
  },
  {
    title: "Resultados",
    items: [
      { to: "/dre", icon: Receipt, label: "DRE", permission: "VIEW_DRE" },
      { to: "/score", icon: Gauge, label: "Score", permission: "VIEW_SCORE" },
      { to: "/trends", icon: TrendingUp, label: "Tendências", permission: "VIEW_TRENDS" },
      { to: "/trends-history", icon: LineChart, label: "Histórico de Tendências", permission: "VIEW_TRENDS" },
    ],
  },
  {
    title: "Administração",
    items: [
      { to: "/users", icon: Users, label: "Usuários", permission: "VIEW_USERS" },
      { to: "/import", icon: Upload, label: "Importar", permission: "CREATE_TRANSACTIONS" },
      { to: "/settings", icon: Settings, label: "Configurações", permission: "VIEW_SETTINGS" },
      { to: "/audit", icon: History, label: "Logs", permission: "VIEW_AUDIT" },
      {
        to: "/admin/cleanup",
        icon: Trash2,
        label: "Limpeza de dados",
        permission: "VIEW_AUDIT",
      },
      {
        to: "/admin/operations",
        icon: Server,
        label: "System Operations",
        permission: "VIEW_AUDIT",
      },
    ],
  },
];

// Navegação mobile simplificada
const mobileNavItems: NavItem[] = [
  { to: "/", icon: Wallet, label: "Caixa" },
  { to: "/transactions", icon: ArrowUpDown, label: "Mov.", permission: "VIEW_TRANSACTIONS" },
  { to: "/receivables", icon: Banknote, label: "Receber", permission: "VIEW_RECEIVABLES" },
  { to: "/dre", icon: Receipt, label: "DRE" },

  // ✅ opcional: BI v2 no mobile também (se quiser, mantém; se não quiser, pode remover)
  { to: "/bi-v2", icon: BarChart3, label: "BI v2", permission: "VIEW_BI" },

  { to: "/settings", icon: Settings, label: "Config", permission: "VIEW_SETTINGS" },
];

export function Sidebar() {
  const location = useLocation();
  const { hasPermission, currentRole } = useAuth();

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (!item.permission) return true;
      if (currentRole?.name === "Admin") return true;
      return hasPermission(item.permission);
    });

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: filterItems(section.items),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar lg:block">
      <nav className="flex flex-col gap-0.5 p-3">
        {visibleSections.map((section, idx) => (
          <div key={section.title} className={cn("mb-1", idx > 0 && "mt-3 pt-3 border-t border-border/50")}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </div>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                        {item.badge}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export const MobileNav = forwardRef<HTMLElement, Record<string, never>>(function MobileNav(_, ref) {
  const location = useLocation();
  const { hasPermission, currentRole } = useAuth();

  const visibleItems = mobileNavItems.filter((item) => {
    if (!item.permission) return true;
    if (currentRole?.name === "Admin") return true;
    return hasPermission(item.permission);
  });

  return (
    <nav
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden safe-area-bottom"
    >
      <div className="flex items-center justify-around py-1.5">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 transition-all min-w-[56px]",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-[9px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
});
