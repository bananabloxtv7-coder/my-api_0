"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ScrollText,
  Loader2,
} from "lucide-react";

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

export function LogsPanel() {
  const [page, setPage] = useState(0);
  const [successFilter, setSuccessFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState("");
  const pageSize = 50;

  const { data, isLoading, isFetching } = useQuery<{
    logs: LogItem[];
    total: number;
  }>({
    queryKey: ["logs", page, successFilter, modelFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (successFilter !== "all") params.set("success", successFilter);
      if (modelFilter) params.set("model", modelFilter);
      return api.get(`/api/logs?${params.toString()}`);
    },
    refetchInterval: 15_000,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">السجلات</h1>
        <p className="text-muted-foreground text-sm">
          سجل طلبات البوابة — آخر {data?.total ?? 0} طلب
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="true">ناجح</SelectItem>
                <SelectItem value="false">فاشل</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="تصفية حسب النموذج..."
              value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); setPage(0); }}
              className="w-48"
              dir="ltr"
            />
            <div className="mr-auto text-xs text-muted-foreground flex items-center gap-1">
              {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
              تحديث تلقائي كل 15 ثانية
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.logs?.length ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <ScrollText className="w-10 h-10 text-muted-foreground" />
              <div className="font-medium">لا توجد سجلات</div>
              <p className="text-sm text-muted-foreground">
                ستظهر هنا طلبات البوابة فور إرسالها.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-16">الحالة</TableHead>
                      <TableHead>النموذج</TableHead>
                      <TableHead>المزود</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الكود</TableHead>
                      <TableHead>المدة</TableHead>
                      <TableHead>التبديلات</TableHead>
                      <TableHead>الوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          {l.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {l.model || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.providerName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {l.endpointType || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {l.statusCode ? (
                            <Badge
                              variant="outline"
                              className={
                                l.statusCode < 300
                                  ? "text-emerald-600"
                                  : l.statusCode < 400
                                  ? "text-amber-600"
                                  : "text-destructive"
                              }
                            >
                              {l.statusCode}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" dir="ltr">
                          {l.durationMs ? `${l.durationMs}ms` : "—"}
                        </TableCell>
                        <TableCell>
                          {l.retried > 0 ? (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              <RefreshCw className="w-3 h-3 ml-1" />
                              {l.retried}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(l.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-xs text-muted-foreground">
                  صفحة {page + 1} من {totalPages || 1} — {data.total} إجمالي
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                    السابق
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    التالي
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
