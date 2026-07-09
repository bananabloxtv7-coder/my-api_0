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
  LayoutDashboard,
  Server,
  KeyRound,
  ScrollText,
  Settings,
  LogOut,
  Moon,
  Sun,
  Network,
  Menu,
} from "lucide-react";
import { useTheme } from "next-themes";
import { OverviewPanel } from "./overview";
import { ProvidersPanel } from "./providers";
import { MasterKeysPanel } from "./master-keys";
import { LogsPanel } from "./logs";
import { SettingsPanel } from "./settings";

type Tab = "overview" | "providers" | "master-keys" | "logs" | "settings";

const NAV: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "نظرة عامة", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "providers", label: "المزودون", icon: <Server className="w-4 h-4" /> },
  { id: "master-keys", label: "المفاتيح الرئيسية", icon: <KeyRound className="w-4 h-4" /> },
  { id: "logs", label: "السجلات", icon: <ScrollText className="w-4 h-4" /> },
  { id: "settings", label: "الإعدادات والوثائق", icon: <Settings className="w-4 h-4" /> },
];

export function DashboardShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <Network className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold leading-tight">بوابة API الذكية</div>
              <div className="text-xs text-muted-foreground leading-tight">
                Smart API Gateway
              </div>
            </div>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="تبديل المظهر"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">تبديل المظهر</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium max-w-[160px] truncate">
                    {user?.name || user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <div className="text-sm font-medium truncate">
                    {user?.name || "مستخدم"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" dir="ltr">
                    {user?.email}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTab("settings")}>
                  <Settings className="w-4 h-4 ml-2" />
                  الإعدادات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 ml-2" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            mobileOpen ? "block" : "hidden"
          } lg:block w-64 shrink-0 border-l bg-background`}
        >
          <nav className="p-3 space-y-1 sticky top-16">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {tab === "overview" && <OverviewPanel />}
          {tab === "providers" && <ProvidersPanel />}
          {tab === "master-keys" && <MasterKeysPanel />}
          {tab === "logs" && <LogsPanel />}
          {tab === "settings" && <SettingsPanel />}
        </main>
      </div>

      {/* Footer (sticky to bottom) */}
      <footer className="border-t bg-background mt-auto">
        <div className="px-4 lg:px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>© {new Date().getFullYear()} بوابة API الذكية — Smart API Gateway</span>
          <span className="opacity-70">Transparent Reverse Proxy · Key Rotation · Model Discovery</span>
        </div>
      </footer>
    </div>
  );
}
