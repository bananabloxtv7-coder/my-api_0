"use client";

import { useState } from "react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Server,
  KeyRound,
  ScrollText,
  Settings,
  LogOut,
  Network,
  Menu,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { OverviewPanel } from "./overview";
import { ProvidersPanel } from "./providers";
import { MasterKeysPanel } from "./master-keys";
import { LogsPanel } from "./logs";
import { SettingsPanel } from "./settings";

export type Tab = "overview" | "providers" | "master-keys" | "logs" | "settings";

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const NAV: NavItem[] = [
  {
    id: "overview",
    label: "نظرة عامة",
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    title: "نظرة عامة",
    subtitle: "ملخص أداء البوابة والمزودين",
  },
  {
    id: "providers",
    label: "المزودون",
    icon: <Server className="w-[18px] h-[18px]" />,
    title: "المزودون",
    subtitle: "إدارة مزودي الذكاء الاصطناعي والمفاتيح",
  },
  {
    id: "master-keys",
    label: "المفاتيح الرئيسية",
    icon: <KeyRound className="w-[18px] h-[18px]" />,
    title: "المفاتيح الرئيسية",
    subtitle: "مفاتيح الوصول إلى البوابة",
  },
  {
    id: "logs",
    label: "السجلات",
    icon: <ScrollText className="w-[18px] h-[18px]" />,
    title: "السجلات",
    subtitle: "سجل طلبات البوابة",
  },
  {
    id: "settings",
    label: "الإعدادات والوثائق",
    icon: <Settings className="w-[18px] h-[18px]" />,
    title: "الإعدادات والوثائق",
    subtitle: "إعدادات البوابة ودليل الاستخدام",
  },
];

export function DashboardShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();
  const active = NAV.find((n) => n.id === tab) ?? NAV[0];

  async function handleLogout() {
    await logout();
  }

  function selectTab(id: Tab) {
    setTab(id);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ───────────── Desktop sidebar (sticky, RTL start = right) ───────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-l border-sidebar-border h-screen sticky top-0">
        <SidebarContent tab={tab} onSelect={selectTab} user={user} initials={initials} />
      </aside>

      {/* ───────────── Mobile sidebar (Sheet) ───────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="w-72 p-0 bg-sidebar border-sidebar-border flex flex-col"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">القائمة</SheetTitle>
          </SheetHeader>
          <SidebarContent tab={tab} onSelect={selectTab} user={user} initials={initials} />
        </SheetContent>
      </Sheet>

      {/* ───────────── Main column ───────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight truncate">
                {active.title}
              </h1>
              <p className="text-xs text-muted-foreground leading-tight truncate">
                {active.subtitle}
              </p>
            </div>

            <div className="mr-auto flex items-center gap-2 sm:gap-3">
              {/* Status indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
                </span>
                <span className="text-xs font-medium text-[#10b981]">
                  كل الأنظمة تعمل
                </span>
              </div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 hover:bg-white/5">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium max-w-[140px] truncate">
                      {user?.name || user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                  <div className="px-2 py-1.5">
                    <div className="text-sm font-medium truncate">
                      {user?.name || "مستخدم"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" dir="ltr">
                      {user?.email}
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={() => selectTab("settings")}
                    className="hover:bg-white/5 focus:bg-white/5"
                  >
                    <Settings className="w-4 h-4 ml-2" />
                    الإعدادات
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4 ml-2" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6">
          {tab === "overview" && <OverviewPanel onNavigate={selectTab} />}
          {tab === "providers" && <ProvidersPanel />}
          {tab === "master-keys" && <MasterKeysPanel />}
          {tab === "logs" && <LogsPanel />}
          {tab === "settings" && <SettingsPanel />}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-border bg-background/50">
          <div className="px-4 lg:px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1">
            <span>© {new Date().getFullYear()} بوابة API — Smart AI Gateway</span>
            <span className="opacity-70 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Transparent Reverse Proxy · Key Rotation · Model Discovery
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */

interface SidebarContentProps {
  tab: Tab;
  onSelect: (t: Tab) => void;
  user: { email: string; name: string | null } | null;
  initials: string;
}

function SidebarContent({ tab, onSelect, user, initials }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6366f1] flex items-center justify-center text-white shadow-lg shadow-[#7c3aed]/30">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold leading-tight text-white">بوابة API</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              Smart AI Gateway
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
          القائمة
        </div>
        {NAV.map((item) => {
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <span className={isActive ? "text-white" : ""}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Upgrade banner */}
      <div className="px-3 pb-3">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#7c3aed]/20 to-[#6366f1]/10 border border-[#7c3aed]/30 p-4">
          <div className="absolute -top-6 -left-6 w-20 h-20 bg-[#7c3aed]/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#7c3aed] flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">ترقية الباقة</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
              افتح ميزات متقدمة: تحليلات أعمق، حدود أعلى، ودعم أولوية.
            </p>
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:opacity-90 border-0"
              onClick={() => onSelect("settings")}
            >
              ترقية الآن
            </Button>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate text-white">
              {user?.name || "مستخدم"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
              {user?.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
