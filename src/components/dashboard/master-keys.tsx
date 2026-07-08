"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface MasterKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyPreview: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  _count: { requestLogs: number };
}

export function MasterKeysPanel() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery<{ keys: MasterKey[] }>({
    queryKey: ["master-keys"],
    queryFn: () => api.get("/api/master-keys"),
  });

  const createMut = useMutation({
    mutationFn: () => api.post<{ plainKey: string }>("/api/master-keys", { name: newName }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["master-keys"] });
      setCreatedKey(res.plainKey);
      setNewName("");
      toast.success("تم إنشاء المفتاح الرئيسي");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/master-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-keys"] });
      toast.success("تم حذف المفتاح");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/master-keys/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-keys"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success("تم نسخ المفتاح");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المفاتيح الرئيسية</h1>
          <p className="text-muted-foreground text-sm">
            استخدم هذه المفاتيح داخل تطبيقاتك للوصول إلى البوابة
          </p>
        </div>
        <Button onClick={() => { setCreatedKey(null); setAddOpen(true); }}>
          <Plus className="w-4 h-4 ml-2" />
          إنشاء مفتاح
        </Button>
      </div>

      {/* Usage hint */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold mb-1">طريقة الاستخدام</div>
            <p className="text-muted-foreground">
              أرسل طلباتك إلى{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs" dir="ltr">
                /v1/chat/completions
              </code>{" "}
              مع الترويسة{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs" dir="ltr">
                Authorization: Bearer YOUR_MASTER_KEY
              </code>
              . تعمل البوابة كوكيل شفاف وتعيد الرد كما هو.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
          ))}
        </div>
      ) : !data?.keys?.length ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="font-semibold">لا توجد مفاتيح رئيسية</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              أنشئ مفتاحك الأول لبدء استخدام البوابة من تطبيقاتك.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{k.name}</div>
                      <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                        {k.keyPrefix}…{k.keyPreview}
                      </div>
                    </div>
                  </div>
                  {k.isActive ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">
                      نشط
                    </Badge>
                  ) : (
                    <Badge variant="secondary">معطّل</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="text-muted-foreground">الطلبات</div>
                    <div className="font-bold text-base">{k._count.requestLogs}</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="text-muted-foreground">آخر استخدام</div>
                    <div className="font-medium text-sm">
                      {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => toggleMut.mutate({ id: k.id, isActive: !k.isActive })}
                  >
                    {k.isActive ? "تعطيل" : "تفعيل"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("حذف هذا المفتاح؟ لن تتمكن التطبيقات من استخدامه بعد الآن.")) {
                        delMut.mutate(k.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setCreatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء مفتاح رئيسي جديد</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "احفظ هذا المفتاح الآن — لن تتمكن من رؤيته مرة أخرى."
                : "أدخل اسمًا تعريفيًا للمفتاح."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm break-all" dir="ltr">
                    {createdKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyKey(createdKey)}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>انسخ المفتاح واحفظه في مكان آمن. لا يمكن استرجاعه لاحقًا.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Label>اسم المفتاح</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: تطبيق الإنتاج"
              />
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => { setAddOpen(false); setCreatedKey(null); }}>
                تم
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
                <Button
                  disabled={loading || !newName.trim()}
                  onClick={async () => {
                    setLoading(true);
                    try { await createMut.mutateAsync(); } finally { setLoading(false); }
                  }}
                >
                  {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  إنشاء
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} س`;
  const day = Math.floor(hr / 24);
  return `قبل ${day} يوم`;
}
