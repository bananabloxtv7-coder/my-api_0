"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { DashboardShell } from "@/components/dashboard/shell";
import { Loader2, Network } from "lucide-react";

export default function Home() {
  const { user, initialized, fetchUser } = useAuth();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
          <Network className="w-6 h-6" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return <DashboardShell />;
}
