"use client";

import { useAuth } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, LogOut, Network, Code2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsPanel() {
  const { user, logout } = useAuth();

  const quickStart = `# مثال باستخدام curl
curl https://YOUR_DOMAIN/api/v1/chat/completions \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"مرحبا"}]
  }'

# مثال باستخدام Python (openai SDK)
from openai import OpenAI
client = OpenAI(
    api_key="gw_xxx_YOUR_MASTER_KEY",
    base_url="https://YOUR_DOMAIN/api/v1"
)
resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role":"user","content":"مرحبا"}]
)`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm">
          معلومات الحساب ودليل الاستخدام السريع
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            معلومات الحساب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row icon={<User className="w-4 h-4" />} label="الاسم" value={user?.name || "—"} />
          <Row icon={<Mail className="w-4 h-4" />} label="البريد" value={user?.email || "—"} ltr />
          <Row
            icon={<Shield className="w-4 h-4" />}
            label="الدور"
            value={<Badge variant="outline">{user?.role || "user"}</Badge>}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            دليل الاستخدام السريع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            استبدل <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">YOUR_DOMAIN</code> بعنوان موقعك، و
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">gw_xxx_YOUR_MASTER_KEY</code>
            بمفتاحك الرئيسي.
          </p>
          <pre className="rounded-lg bg-muted/50 p-4 text-xs overflow-x-auto font-mono leading-relaxed" dir="ltr">
            {quickStart}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="w-4 h-4" />
            آلية عمل البوابة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. يصل الطلب إلى <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">/api/v1/*</code> مع مفتاحك الرئيسي.</p>
          <p>2. تتعرّف البوابة على نوع الـ Endpoint (chat, embeddings, images…).</p>
          <p>3. تبحث عن المزود الذي يدعم النموذج المطلوب.</p>
          <p>4. تختار مفتاحًا صحيًا وتُرسل الطلب بشفافية (فقط استبدال المفتاح).</p>
          <p>5. عند فشل المفتاح (حصة/حد/خطأ) تنتقل للمفتاح التالي خلال أجزاء من الثانية.</p>
          <p>6. تُعيد الرد كما هو من المزود — تطبيقك لا يشعر بأي فرق.</p>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">تسجيل الخروج</div>
            <div className="text-sm text-muted-foreground">إنهاء الجلسة الحالية</div>
          </div>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              logout();
              toast.success("تم تسجيل الخروج");
            }}
          >
            <LogOut className="w-4 h-4 ml-2" />
            خروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  ltr,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-sm w-24 shrink-0">{label}</div>
      <div className="font-medium mr-auto" dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}
