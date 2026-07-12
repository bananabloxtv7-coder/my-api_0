"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Coins,
  DollarSign,
  Cpu,
  Plus,
  Server,
  KeyRound,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type NavTab = "overview" | "providers" | "master-keys" | "logs" | "settings";

interface OverviewPanelProps {
  onNavigate?: (tab: NavTab) => void;
}

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

interface LogItem {
  id: string;
  method: string;
  path: string;
  model: string | null;
  endpointType: string | null;
  providerName: string | null;
  statusCode: number | null;
  durationMs: number | null;
  success: boolean;
  error: string | null;
  retried: number;
  createdAt: string;
}

interface ProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  priority: number;
  _count: { apiKeys: number; endpoints: number; models: number };
}

const DONUT_COLORS = [
  "#7c3aed",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
];

export function OverviewPanel({ onNavigate }: OverviewPanelProps) {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/stats"),
    refetchInterval: 30_000,
  });

  const { data: logsData } = useQuery<{ logs: LogItem[]; total: number }>({
    queryKey: ["logs-overview", 200],
    queryFn: () => api.get("/api/logs?limit=200"),
    refetchInterval: 30_000,
  });

  const { data: providersData } = useQuery<{ providers: ProviderItem[] }>({
    queryKey: ["providers-overview"],
    queryFn: () => api.get("/api/providers"),
    refetchInterval: 30_000,
  });

  if (statsLoading || !stats) {
    return <OverviewSkeleton />;
  }

  const s = stats.summary;
  const logs = logsData?.logs ?? [];
  const providers = providersData?.providers ?? [];

  // 7-day series from real logs
  const series = bucketByDay(logs, 7);
  const today = series[series.length - 1];
  const yesterday = series[series.length - 2];

  const requestsChange =
    yesterday && yesterday.total > 0
      ? ((today.total - yesterday.total) / yesterday.total) * 100
      : null;

  const todayRate =
    today.total > 0 ? (today.success / today.total) * 100 : 0;
  const yesterdayRate =
    yesterday && yesterday.total > 0
      ? (yesterday.success / yesterday.total) * 100
      : 0;
  const rateChange =
    yesterday && yesterday.total > 0 ? todayRate - yesterdayRate : null;

  // Recent activity (8 most recent)
  const recent = logs.slice(0, 8);

  // Per-model success rate from logs
  const modelStats = aggregateByModel(logs);

  // Per-provider stats from logs
  const providerStats = aggregateByProvider(logs);

  const totalEndpointCount = stats.byEndpoint.reduce(
    (sum, e) => sum + e.count,
    0
  );

  return (
    <div className="space-y-5">
      {/* ───────────── Metric cards ───────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          label="إجمالي الطلبات"
          value={formatNumber(s.requests24h)}
          sub="آخر 24 ساعة"
          icon={<Activity className="w-5 h-5" />}
          iconColor="purple"
          change={requestsChange}
          sparkline={series.map((d) => d.total)}
        />
        <MetricCard
          label="معدل النجاح"
          value={`${s.successRate7d}%`}
          sub="آخر 7 أيام"
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconColor="green"
          change={rateChange}
          changeUnit="نقطة"
        />
        <MetricCard
          label="إجمالي الرموز"
          value="0"
          sub="غير مُتتبّع"
          icon={<Coins className="w-5 h-5" />}
          iconColor="blue"
        />
        <MetricCard
          label="إجمالي التكلفة"
          value="$0.00"
          sub="غير مُتتبّع"
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="orange"
        />
        <MetricCard
          label="النماذج النشطة"
          value={formatNumber(s.models)}
          sub={`${s.providers} مزود`}
          icon={<Cpu className="w-5 h-5" />}
          iconColor="purple"
        />
      </div>

      {/* ───────────── Requests chart + Recent activity ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Requests line chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">
                الطلبات خلال آخر 7 أيام
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                إجمالي · ناجح · فاشل
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <LegendDot color="#7c3aed" label="الإجمالي" />
              <LegendDot color="#10b981" label="ناجح" />
              <LegendDot color="#ef4444" label="فاشل" />
            </div>
          </CardHeader>
          <CardContent>
            <div dir="ltr" className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1c2e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#9ca3af" }}
                    cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="الإجمالي"
                  />
                  <Line
                    type="monotone"
                    dataKey="success"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    name="ناجح"
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#ef4444", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    name="فاشل"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-card border-border">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base text-white">النشاط الأخير</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-7"
              onClick={() => onNavigate?.("logs")}
            >
              عرض الكل
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyHint text="لا توجد طلبات بعد. أضف مزودًا ومفتاحًا وابدأ الإرسال." />
            ) : (
              <div className="space-y-1 -mt-2">
                {recent.map((log) => (
                  <ActivityRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───────────── Quick actions ───────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          icon={<Plus className="w-4 h-4" />}
          label="إضافة نموذج"
          onClick={() => onNavigate?.("providers")}
        />
        <QuickAction
          icon={<Server className="w-4 h-4" />}
          label="إضافة مزود"
          onClick={() => onNavigate?.("providers")}
        />
        <QuickAction
          icon={<KeyRound className="w-4 h-4" />}
          label="إنشاء مفتاح"
          onClick={() => onNavigate?.("master-keys")}
        />
        <QuickAction
          icon={<BarChart3 className="w-4 h-4" />}
          label="عرض التحليلات"
          onClick={() => onNavigate?.("logs")}
        />
      </div>

      {/* ───────────── Top models + Providers status ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top models table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-white">
              النماذج الأكثر طلبًا
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topModels.length === 0 ? (
              <EmptyHint text="لا توجد بيانات بعد." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs w-12">#</TableHead>
                    <TableHead className="text-muted-foreground text-xs">النموذج</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-left">الطلبات</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-left">النجاح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topModels.slice(0, 6).map((m, i) => {
                    const ms = modelStats.get(m.name);
                    const rate = ms && ms.total > 0 ? Math.round((ms.success / ms.total) * 100) : null;
                    return (
                      <TableRow key={m.name} className="border-border">
                        <TableCell>
                          <span
                            className={`inline-flex w-6 h-6 items-center justify-center rounded-md text-xs font-bold ${
                              i === 0
                                ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                                : i === 1
                                ? "bg-white/10 text-white"
                                : i === 2
                                ? "bg-[#7c3aed]/20 text-[#7c3aed]"
                                : "bg-white/5 text-muted-foreground"
                            }`}
                          >
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-white" dir="ltr">
                          {m.name}
                        </TableCell>
                        <TableCell className="text-left text-sm font-medium text-white">
                          {formatNumber(m.count)}
                        </TableCell>
                        <TableCell className="text-left">
                          {rate !== null ? (
                            <Badge
                              variant="outline"
                              className={`font-mono text-[10px] ${
                                rate >= 95
                                  ? "text-[#10b981] border-[#10b981]/30"
                                  : rate >= 80
                                  ? "text-[#f59e0b] border-[#f59e0b]/30"
                                  : "text-[#ef4444] border-[#ef4444]/30"
                              }`}
                            >
                              {rate}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Providers status table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-white">حالة المزودين</CardTitle>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <EmptyHint text="لا توجد مزودون بعد." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">المزود</TableHead>
                    <TableHead className="text-muted-foreground text-xs">الحالة</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-left">التشغيل</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-left">الزمن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.slice(0, 6).map((p) => {
                    const ps = providerStats.get(p.name);
                    const total = ps?.total ?? 0;
                    const success = ps?.success ?? 0;
                    const uptime = total > 0 ? Math.round((success / total) * 100) : null;
                    const latency = ps?.avgLatency ?? null;
                    const status = !p.isActive
                      ? "down"
                      : uptime !== null && uptime < 80
                      ? "degraded"
                      : "healthy";
                    return (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="text-sm font-medium text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <Server className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span className="truncate">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-left text-xs text-muted-foreground font-mono">
                          {uptime !== null ? `${uptime}%` : "—"}
                        </TableCell>
                        <TableCell className="text-left text-xs text-muted-foreground font-mono" dir="ltr">
                          {latency !== null ? `${latency}ms` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───────────── Usage donut chart ───────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-white">
            التوزيع حسب نوع المهمة
          </CardTitle>
          <p className="text-xs text-muted-foreground">آخر 7 أيام</p>
        </CardHeader>
        <CardContent>
          {stats.byEndpoint.length === 0 ? (
            <EmptyHint text="لا توجد بيانات بعد." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="relative h-[240px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.byEndpoint}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={92}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {stats.byEndpoint.map((_, i) => (
                        <Cell
                          key={i}
                          fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1c2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">
                    {formatNumber(totalEndpointCount)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">إجمالي الطلبات</span>
                </div>
              </div>
              <div className="space-y-2">
                {stats.byEndpoint.map((e, i) => {
                  const pct =
                    totalEndpointCount > 0
                      ? Math.round((e.count / totalEndpointCount) * 100)
                      : 0;
                  return (
                    <div
                      key={e.type}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                      <span className="text-sm text-white font-mono" dir="ltr">
                        {e.type}
                      </span>
                      <span className="mr-auto text-xs text-muted-foreground">
                        {formatNumber(e.count)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground w-10 text-left">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

type IconColor = "purple" | "green" | "blue" | "orange";

const ICON_STYLES: Record<IconColor, string> = {
  purple: "bg-[#7c3aed]/15 text-[#7c3aed] border-[#7c3aed]/20",
  green: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/20",
  blue: "bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/20",
  orange: "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/20",
};

function MetricCard({
  label,
  value,
  sub,
  icon,
  iconColor,
  change,
  changeUnit,
  sparkline,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconColor: IconColor;
  change?: number | null;
  changeUnit?: string;
  sparkline?: number[];
}) {
  const hasChange = change !== null && change !== undefined && isFinite(change);
  const isUp = hasChange && change! >= 0;
  return (
    <Card className="bg-card border-border hover:border-white/15 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold text-white mt-1.5 truncate">
              {value}
            </div>
            {sub && (
              <div className="text-[11px] text-muted-foreground/70 mt-1">
                {sub}
              </div>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ICON_STYLES[iconColor]}`}
          >
            {icon}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {hasChange ? (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                isUp ? "text-[#10b981]" : "text-[#ef4444]"
              }`}
            >
              {isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {Math.abs(change!).toFixed(1)}
              {changeUnit ? ` ${changeUnit}` : "%"}
            </span>
          ) : (
            <span />
          )}
          {sparkline && sparkline.length > 1 && (
            <Sparkline data={sparkline} color="#7c3aed" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({
  data,
  color = "#7c3aed",
  width = 72,
  height = 26,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const gid = `spark-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ActivityRow({ log }: { log: LogItem }) {
  const time = timeAgo(log.createdAt);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          log.success
            ? "bg-[#10b981]/10 text-[#10b981]"
            : "bg-[#ef4444]/10 text-[#ef4444]"
        }`}
      >
        {log.success ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <XCircle className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-white truncate" dir="ltr">
          {log.model || log.endpointType || log.path}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {log.providerName || "—"} · {log.endpointType || "—"}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground/70 shrink-0 whitespace-nowrap">
        {time}
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-auto py-3 justify-start gap-2.5 bg-card border-border hover:bg-white/5 hover:border-[#7c3aed]/40 text-white"
    >
      <span className="w-8 h-8 rounded-lg bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

function StatusBadge({ status }: { status: "healthy" | "degraded" | "down" }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10b981]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
        </span>
        يعمل
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#f59e0b]">
        <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
        متدهور
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ef4444]">
      <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
      متوقف
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="h-28 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
      {text}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="p-5 h-[120px]" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border animate-pulse">
          <CardContent className="p-5 h-[330px]" />
        </Card>
        <Card className="bg-card border-border animate-pulse">
          <CardContent className="p-5 h-[330px]" />
        </Card>
      </div>
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جارٍ تحميل البيانات...
      </div>
    </div>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function bucketByDay(logs: LogItem[], days: number) {
  const now = new Date();
  const buckets: Array<{
    key: string;
    label: string;
    total: number;
    success: number;
    failed: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const offset = i;
    const label =
      offset === 0 ? "اليوم" : offset === 1 ? "أمس" : `قبل ${offset}أ`;
    buckets.push({
      key: day.toDateString(),
      label,
      total: 0,
      success: 0,
      failed: 0,
    });
  }

  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const log of logs) {
    const key = new Date(log.createdAt).toDateString();
    const b = map.get(key);
    if (b) {
      b.total++;
      if (log.success) b.success++;
      else b.failed++;
    }
  }

  return buckets;
}

function aggregateByModel(logs: LogItem[]) {
  const map = new Map<string, { total: number; success: number }>();
  for (const log of logs) {
    if (!log.model) continue;
    const cur = map.get(log.model) ?? { total: 0, success: 0 };
    cur.total++;
    if (log.success) cur.success++;
    map.set(log.model, cur);
  }
  return map;
}

function aggregateByProvider(logs: LogItem[]) {
  const map = new Map<
    string,
    { total: number; success: number; errors: number; latencySum: number; latencyCount: number }
  >();
  for (const log of logs) {
    if (!log.providerName) continue;
    const cur =
      map.get(log.providerName) ?? {
        total: 0,
        success: 0,
        errors: 0,
        latencySum: 0,
        latencyCount: 0,
      };
    cur.total++;
    if (log.success) cur.success++;
    else cur.errors++;
    if (log.durationMs != null) {
      cur.latencySum += log.durationMs;
      cur.latencyCount++;
    }
    map.set(log.providerName, cur);
  }
  // Compute avg latency
  const result = new Map<string, { total: number; success: number; errors: number; avgLatency: number }>();
  for (const [name, v] of map) {
    result.set(name, {
      total: v.total,
      success: v.success,
      errors: v.errors,
      avgLatency:
        v.latencyCount > 0 ? Math.round(v.latencySum / v.latencyCount) : 0,
    });
  }
  return result;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `قبل ${sec}ث`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${min}د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr}س`;
  const day = Math.floor(hr / 24);
  return `قبل ${day}ي`;
}
