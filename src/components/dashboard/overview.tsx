"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  KeyRound,
  Cpu,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface StatsResponse {
  summary: {
    providers: number;
    keys: number;
    activeKeys: number;
    models: number;
    masterKeys: number;
    requests24h: number;
    success24h: number;
    errors24h: number;
    successRate7d: number;
  };
  topProviders: Array<{ name: string; count: number }>;
  topModels: Array<{ name: string; count: number }>;
  byEndpoint: Array<{ type: string; count: number }>;
}

const PIE_COLORS = ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];

export function OverviewPanel() {
  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/stats"),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-28" />
          </Card>
        ))}
      </div>
    );
  }

  const s = data.summary;
  const cards = [
    {
      label: "المزودون",
      value: s.providers,
      icon: <Server className="w-5 h-5" />,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "المفاتيح",
      value: s.keys,
      sub: `${s.activeKeys} نشط`,
      icon: <KeyRound className="w-5 h-5" />,
      color: "from-cyan-500 to-blue-600",
    },
    {
      label: "النماذج",
      value: s.models,
      icon: <Cpu className="w-5 h-5" />,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "طلبات 24س",
      value: s.requests24h,
      icon: <Activity className="w-5 h-5" />,
      color: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نظرة عامة</h1>
        <p className="text-muted-foreground text-sm">
          ملخص أداء البوابة والمزودين خلال آخر 24 ساعة
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{c.label}</div>
                  <div className="text-3xl font-bold mt-1">{c.value}</div>
                  {c.sub && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.sub}
                    </div>
                  )}
                </div>
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center`}
                >
                  {c.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Success rate + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <TrendingUp className="w-4 h-4" />
              معدل النجاح (7 أيام)
            </div>
            <div className="text-4xl font-bold">{s.successRate7d}%</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">ناجح 24س</span>
                <span className="font-semibold mr-auto">{s.success24h}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground">فشل 24س</span>
                <span className="font-semibold mr-auto">{s.errors24h}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">أكثر المزودين استخدامًا (7 أيام)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProviders.length === 0 ? (
              <EmptyHint text="لا توجد طلبات بعد. أضف مزودًا ومفتاحًا وابدأ الإرسال." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topProviders} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} name="الطلبات" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Models + endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">النماذج الأكثر طلبًا</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topModels.length === 0 ? (
              <EmptyHint text="لا توجد بيانات بعد." />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                {data.topModels.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm truncate" dir="ltr">
                      {m.name}
                    </span>
                    <Badge>{m.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">التوزيع حسب نوع الـ Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byEndpoint.length === 0 ? (
              <EmptyHint text="لا توجد بيانات بعد." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.byEndpoint}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => `${e.type}`}
                  >
                    {data.byEndpoint.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-auto text-xs px-2 py-0.5 rounded-full bg-muted font-mono">
      {children}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
      {text}
    </div>
  );
}
