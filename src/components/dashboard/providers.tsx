"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Server,
  MoreVertical,
  Trash2,
  Pencil,
  KeyRound,
  Route,
  Cpu,
  ExternalLink,
  RefreshCw,
  Power,
  Copy,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// ───────────────────────── Types ─────────────────────────

interface ProviderListItem {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  priority: number;
  authHeader: string;
  authScheme: string;
  protocol: string;
  _count: { apiKeys: number; endpoints: number; models: number };
  endpoints: Array<{ id: string; type: string; path: string; method: string }>;
}

interface ProviderDetail extends ProviderListItem {
  models: Array<{ id: string; name: string }>;
  keys: Array<KeyItem>;
}

interface KeyItem {
  id: string;
  name: string | null;
  keyPreview: string;
  isActive: boolean;
  status: string;
  lastError: string | null;
  lastErrorAt: string | null;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  totalRequests: number;
  totalErrors: number;
  totalSuccess: number;
  createdAt: string;
}

// ───────────────────────── Presets ─────────────────────────

const ENDPOINT_PRESETS: Array<{ type: string; path: string }> = [
  { type: "chat", path: "/v1/chat/completions" },
  { type: "models", path: "/v1/models" },
  { type: "embeddings", path: "/v1/embeddings" },
  { type: "images", path: "/v1/images/generations" },
  { type: "audio", path: "/v1/audio/speech" },
  { type: "responses", path: "/v1/responses" },
  { type: "rerank", path: "/v1/rerank" },
  { type: "moderation", path: "/v1/moderations" },
];

const AUTH_SCHEMES = [
  { value: "bearer", label: "Bearer Token (Authorization: Bearer …)" },
  { value: "x-api-key", label: "X-API-Key header" },
  { value: "raw", label: "Raw value in custom header" },
];

const PROTOCOLS = [
  { value: "transparent", label: "شفاف (Transparent) — لا تحويل" },
  { value: "anthropic", label: "Anthropic — تحويل OpenAI → Claude تلقائياً" },
];

// ───────────────────────── Main Panel ─────────────────────────

export function ProvidersPanel() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderListItem | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ providers: ProviderListItem[] }>({
    queryKey: ["providers"],
    queryFn: () => api.get("/api/providers"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/providers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم حذف المزود");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المزودون</h1>
          <p className="text-muted-foreground text-sm">
            أضف عددًا غير محدود من المزودين والمفاتيح والـ Endpoints
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة مزود
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-40" />
            </Card>
          ))}
        </div>
      ) : !data?.providers?.length ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Server className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="font-semibold">لا يوجد مزودون بعد</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              ابدأ بإضافة مزود الخدمة الأول (مثل OpenAI, Anthropic, Google…) مع
              عنوانه الأساسي ومساراته.
            </p>
            <Button onClick={() => setAddOpen(true)} className="mt-2">
              <Plus className="w-4 h-4 ml-2" />
              إضافة مزود
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onOpen={() => setDetailId(p.id)}
              onEdit={() => setEditing(p)}
              onDelete={() => {
                if (confirm(`حذف المزود "${p.name}" وكل مفاتيحه؟`)) {
                  delMut.mutate(p.id);
                }
              }}
            />
          ))}
        </div>
      )}

      <ProviderFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editing={null}
      />
      <ProviderFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
      />

      <ProviderDetailSheet
        providerId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}

// ───────────────────────── Provider Card ─────────────────────────

function ProviderCard({
  provider,
  onOpen,
  onEdit,
  onDelete,
}: {
  provider: ProviderListItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{provider.name}</CardTitle>
              <div className="text-xs text-muted-foreground truncate" dir="ltr">
                {provider.baseUrl}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onOpen}>
                <ExternalLink className="w-4 h-4 ml-2" />
                إدارة التفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 ml-2" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 ml-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {provider.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">
              <CheckCircle2 className="w-3 h-3 ml-1" />
              نشط
            </Badge>
          ) : (
            <Badge variant="secondary">معطّل</Badge>
          )}
          <Badge variant="outline" className="font-mono">
            {provider.authScheme}
          </Badge>
          {provider.protocol === "anthropic" && (
            <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-500/15">
              Anthropic
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={<KeyRound className="w-3.5 h-3.5" />} value={provider._count.apiKeys} label="مفاتيح" />
          <Stat icon={<Route className="w-3.5 h-3.5" />} value={provider._count.endpoints} label="مسارات" />
          <Stat icon={<Cpu className="w-3.5 h-3.5" />} value={provider._count.models} label="نماذج" />
        </div>
        <Button variant="outline" className="w-full" onClick={onOpen}>
          إدارة المفاتيح والمسارات
          <ExternalLink className="w-4 h-4 mr-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
      </div>
      <div className="font-bold text-lg leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ───────────────────────── Provider Form (Add/Edit) ─────────────────────────

function ProviderFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ProviderListItem | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authScheme, setAuthScheme] = useState("bearer");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [protocol, setProtocol] = useState("transparent");
  const [priority, setPriority] = useState("0");
  const [endpoints, setEndpoints] = useState<Array<{ type: string; path: string }>>(ENDPOINT_PRESETS);
  const [modelsText, setModelsText] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync when opening
  const lastEditingId = useState(editing?.id)[0];
  if (open && editing && editing.id !== lastEditingId && lastEditingId !== undefined) {
    // noop; values are set below
  }

  function resetForm() {
    setName("");
    setBaseUrl("");
    setAuthScheme("bearer");
    setAuthHeader("Authorization");
    setProtocol("transparent");
    setPriority("0");
    setEndpoints(ENDPOINT_PRESETS);
    setModelsText("");
  }

  function prepareForEdit() {
    if (editing) {
      setName(editing.name);
      setBaseUrl(editing.baseUrl);
      setAuthScheme(editing.authScheme);
      setAuthHeader(editing.authHeader);
      setProtocol(editing.protocol || "transparent");
      setPriority(String(editing.priority));
      setEndpoints(
        editing.endpoints.length > 0
          ? editing.endpoints.map((e) => ({ type: e.type, path: e.path }))
          : ENDPOINT_PRESETS
      );
      setModelsText("");
    } else {
      resetForm();
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error("الاسم وعنوان URL مطلوبان");
      return;
    }
    setLoading(true);
    try {
      const models = modelsText
        .split(/[\n,]/)
        .map((m) => m.trim())
        .filter(Boolean);
      if (editing) {
        await api.patch(`/api/providers/${editing.id}`, {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          authScheme,
          authHeader,
          protocol,
          priority: parseInt(priority) || 0,
        });
        toast.success("تم تحديث المزود");
      } else {
        await api.post("/api/providers", {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          authScheme,
          authHeader,
          protocol,
          priority: parseInt(priority) || 0,
          endpoints,
          models,
        });
        toast.success("تمت إضافة المزود");
      }
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onOpenChange(false);
      if (!editing) resetForm();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) prepareForEdit();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل المزود" : "إضافة مزود جديد"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "عدّل بيانات المزود. تُدار المسارات والنماذج من شاشة التفاصيل."
              : "أدخل بيانات المزود. سيتم إعداد المسارات الشائعة تلقائيًا ويمكنك تعديلها لاحقًا."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المزود *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: OpenAI"
              />
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                الأعلى يُفضّل عند توفّر عدة مزودين للنموذج نفسه
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>عنوان URL الأساسي *</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>طريقة المصادقة</Label>
              <Select value={authScheme} onValueChange={setAuthScheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_SCHEMES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اسم الترويسة (Header)</Label>
              <Input
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>البروتوكول (Protocol Translation)</Label>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOLS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              استخدم <b>Anthropic</b> إذا كان المزود يستخدم بنية Claude Messages API
              (مثل Anthropic نفسها أو مزود موحد يدعم claude). تحوّل البوابة طلبات
              OpenAI تلقائياً إلى بنية Anthropic وتعيد الرد بصيغة OpenAI.
            </p>
          </div>

          {!editing && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>المسارات (Endpoints)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEndpoints([...endpoints, { type: "custom", path: "" }])}
                  >
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    إضافة مسار
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-muted/30">
                  {endpoints.map((ep, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        className="w-32"
                        value={ep.type}
                        onChange={(e) => {
                          const next = [...endpoints];
                          next[i] = { ...next[i], type: e.target.value };
                          setEndpoints(next);
                        }}
                        placeholder="النوع"
                        dir="ltr"
                      />
                      <Input
                        className="flex-1"
                        value={ep.path}
                        onChange={(e) => {
                          const next = [...endpoints];
                          next[i] = { ...next[i], path: e.target.value };
                          setEndpoints(next);
                        }}
                        placeholder="/v1/chat/completions"
                        dir="ltr"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEndpoints(endpoints.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>النماذج المدعومة (اختياري)</Label>
                <Textarea
                  value={modelsText}
                  onChange={(e) => setModelsText(e.target.value)}
                  placeholder={"gpt-4o, gpt-4o-mini\ngpt-4.1"}
                  className="font-mono text-sm"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  افصل بين النماذج بفاصلة أو سطر جديد. اتركه فارغًا لجعل المزود
                  يدعم أي نموذج (Wildcard).
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {editing ? "حفظ" : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Provider Detail Sheet ─────────────────────────

function ProviderDetailSheet({
  providerId,
  onOpenChange,
}: {
  providerId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useQuery<{ provider: ProviderDetail }>({
    queryKey: ["provider", providerId],
    queryFn: () => api.get(`/api/providers/${providerId}`),
    enabled: !!providerId,
  });

  return (
    <Sheet open={!!providerId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            {data?.provider.name || "تحميل..."}
          </SheetTitle>
          {data?.provider.baseUrl && (
            <p className="text-xs text-muted-foreground" dir="ltr">
              {data.provider.baseUrl}
            </p>
          )}
        </SheetHeader>

        {isLoading || !data ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6">
            <Tabs defaultValue="keys">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="keys">
                  <KeyRound className="w-4 h-4 ml-1" />
                  المفاتيح
                </TabsTrigger>
                <TabsTrigger value="endpoints">
                  <Route className="w-4 h-4 ml-1" />
                  المسارات
                </TabsTrigger>
                <TabsTrigger value="models">
                  <Cpu className="w-4 h-4 ml-1" />
                  النماذج
                </TabsTrigger>
              </TabsList>

              <TabsContent value="keys">
                <KeysManager providerId={data.provider.id} keys={data.provider.keys} />
              </TabsContent>
              <TabsContent value="endpoints">
                <EndpointsManager
                  providerId={data.provider.id}
                  endpoints={data.provider.endpoints}
                />
              </TabsContent>
              <TabsContent value="models">
                <ModelsManager
                  providerId={data.provider.id}
                  models={data.provider.models}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ───────────────────────── Keys Manager ─────────────────────────

function KeysManager({ providerId, keys }: { providerId: string; keys: KeyItem[] }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      api.post(`/api/providers/${providerId}/keys`, { key: newKey, name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setNewKey("");
      setNewName("");
      setAdding(false);
      toast.success("تمت إضافة المفتاح");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/providers/${providerId}/keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("تم حذف المفتاح");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/providers/${providerId}/keys/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/providers/${providerId}/keys/${id}`, { reset: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      toast.success("تمت إعادة تفعيل المفتاح");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetAllMut = useMutation({
    mutationFn: async () => {
      const disabled = keys.filter((k) => k.status !== "active");
      await Promise.all(
        disabled.map((k) =>
          api.patch(`/api/providers/${providerId}/keys/${k.id}`, { reset: true })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("تمت إعادة تفعيل جميع المفاتيح");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disabledCount = keys.filter((k) => k.status !== "active").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {keys.length} مفتاح
          {disabledCount > 0 && (
            <span className="mr-2 text-amber-600 dark:text-amber-400">
              ({disabledCount} بحاجة لإعادة تفعيل)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {disabledCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resetAllMut.mutate()}
              disabled={resetAllMut.isPending}
            >
              <RefreshCw className="w-4 h-4 ml-1" />
              إعادة تفعيل الكل
            </Button>
          )}
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="w-4 h-4 ml-1" />
            إضافة مفتاح
          </Button>
        </div>
      </div>

      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>مفتاح API *</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="sk-..."
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم تعريفي (اختياري)</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="الحساب الأساسي"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newKey.trim() || loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await addMut.mutateAsync();
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                حفظ
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {keys.length === 0 && !adding ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          لا توجد مفاتيح بعد. أضف مفتاحًا للبدء.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <KeyRow
              key={k.id}
              k={k}
              onToggle={(isActive) => toggleMut.mutate({ id: k.id, isActive })}
              onReset={() => resetMut.mutate(k.id)}
              onDelete={() => {
                if (confirm("حذف هذا المفتاح؟")) delMut.mutate(k.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KeyRow({
  k,
  onToggle,
  onReset,
  onDelete,
}: {
  k: KeyItem;
  onToggle: (v: boolean) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [show, setShow] = useState(false);
  const statusMeta = keyStatusMeta(k.status);

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {k.name || "بدون اسم"}
              </span>
              <Badge
                variant="outline"
                className={`font-mono ${statusMeta.className}`}
              >
                {statusMeta.icon}
                {statusMeta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="font-mono" dir="ltr">
                {show ? `••••${k.keyPreview}` : `••••••••${k.keyPreview}`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setShow((v) => !v)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
              <span>طلبات: {k.totalRequests}</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                نجاح: {k.totalSuccess}
              </span>
              <span className="text-destructive">أخطاء: {k.totalErrors}</span>
              {k.lastUsedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(k.lastUsedAt)}
                </span>
              )}
            </div>
            {k.lastError && k.status !== "active" && (
              <div className="mt-1.5 text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span className="truncate" dir="ltr">{k.lastError}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch checked={k.isActive} onCheckedChange={onToggle} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onReset}>
                  <RefreshCw className="w-4 h-4 ml-2" />
                  إعادة تفعيل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggle.bind(null, !k.isActive)}>
                  <Power className="w-4 h-4 ml-2" />
                  {k.isActive ? "تعطيل" : "تفعيل"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function keyStatusMeta(status: string) {
  switch (status) {
    case "active":
      return { label: "نشط", className: "text-emerald-600", icon: <CheckCircle2 className="w-3 h-3 ml-1" /> };
    case "rate_limited":
      return { label: "حد المعدل", className: "text-amber-600", icon: <Clock className="w-3 h-3 ml-1" /> };
    case "quota_exceeded":
      return { label: "تجاوز الحصة", className: "text-orange-600", icon: <AlertCircle className="w-3 h-3 ml-1" /> };
    case "disabled":
      return { label: "معطّل", className: "text-destructive", icon: <XCircle className="w-3 h-3 ml-1" /> };
    case "error":
      return { label: "خطأ", className: "text-destructive", icon: <AlertCircle className="w-3 h-3 ml-1" /> };
    case "exhausted":
      return { label: "منتهي", className: "text-destructive", icon: <XCircle className="w-3 h-3 ml-1" /> };
    default:
      return { label: status, className: "", icon: null };
  }
}

// ───────────────────────── Endpoints Manager ─────────────────────────

function EndpointsManager({
  providerId,
  endpoints,
}: {
  providerId: string;
  endpoints: Array<{ id: string; type: string; path: string; method: string }>;
}) {
  const qc = useQueryClient();
  const [newType, setNewType] = useState("chat");
  const [newPath, setNewPath] = useState("");
  const [editing, setEditing] = useState<Record<string, { path: string }>>({});

  const addMut = useMutation({
    mutationFn: () =>
      api.post(`/api/providers/${providerId}/endpoints`, {
        type: newType,
        path: newPath,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      setNewPath("");
      toast.success("تمت إضافة المسار");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 400) {
        toast.error("هذا النوع موجود بالفعل. عدّل المسار الموجود.");
      } else {
        toast.error((e as Error).message);
      }
    },
  });

  const updMut = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      api.patch(`/api/providers/${providerId}/endpoints/${id}`, { path }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("تم تحديث المسار");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/providers/${providerId}/endpoints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("تم حذف المسار");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {endpoints.length} مسار — يُستخدم كل مسار حسب نوع الطلب الوارد
      </div>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="text-xs font-medium">إضافة مسار جديد</div>
          <div className="flex gap-2">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENDPOINT_PRESETS.map((e) => (
                  <SelectItem key={e.type} value={e.type}>
                    {e.type}
                  </SelectItem>
                ))}
                <SelectItem value="custom">custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/v1/chat/completions"
              dir="ltr"
              className="flex-1"
            />
            <Button
              size="sm"
              disabled={!newPath.trim()}
              onClick={() => addMut.mutate()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {endpoints.map((ep) => (
          <Card key={ep.id}>
            <CardContent className="p-3 flex items-center gap-2">
              <Badge variant="outline" className="font-mono shrink-0">
                {ep.type}
              </Badge>
              <Input
                value={editing[ep.id]?.path ?? ep.path}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s,
                    [ep.id]: { path: e.target.value },
                  }))
                }
                dir="ltr"
                className="flex-1 font-mono text-sm"
              />
              {editing[ep.id] && editing[ep.id].path !== ep.path && (
                <Button
                  size="sm"
                  onClick={() => {
                    updMut.mutate({ id: ep.id, path: editing[ep.id].path });
                    setEditing((s) => {
                      const n = { ...s };
                      delete n[ep.id];
                      return n;
                    });
                  }}
                >
                  حفظ
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm("حذف هذا المسار؟")) delMut.mutate(ep.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Models Manager ─────────────────────────

function ModelsManager({
  providerId,
  models,
}: {
  providerId: string;
  models: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const [newModel, setNewModel] = useState("");

  const addMut = useMutation({
    mutationFn: () =>
      api.post(`/api/providers/${providerId}/models`, { name: newModel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setNewModel("");
      toast.success("تمت إضافة النموذج");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/providers/${providerId}/models?modelId=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم حذف النموذج");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {models.length === 0
          ? "لا توجد نماذج محددة — المزود يدعم أي نموذج (Wildcard)."
          : `${models.length} نموذج`}
      </div>

      <div className="flex gap-2">
        <Input
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          placeholder="gpt-4o"
          dir="ltr"
          className="font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newModel.trim()) addMut.mutate();
          }}
        />
        <Button size="sm" disabled={!newModel.trim()} onClick={() => addMut.mutate()}>
          <Plus className="w-4 h-4 ml-1" />
          إضافة
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {models.map((m) => (
          <Badge
            key={m.id}
            variant="secondary"
            className="font-mono pl-1 pr-2 py-1 gap-1"
          >
            {m.name}
            <button
              onClick={() => delMut.mutate(m.id)}
              className="hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── helpers ─────────────────────────

function XCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
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
