"use client";

import { useAuth } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Mail, Shield, LogOut, Network, Code2, ImageIcon,
  MessageSquare, FileText, Mic, Search, ShieldAlert, Copy,
} from "lucide-react";
import { toast } from "sonner";

export function SettingsPanel() {
  const { user, logout } = useAuth();

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات والوثائق</h1>
        <p className="text-muted-foreground text-sm">
          معلومات الحساب + دليل كامل لاستخدام البوابة مع كل أنواع الطلبات والمزودين
        </p>
      </div>

      {/* Account info */}
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

      {/* Documentation tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            دليل الاستخدام الكامل
          </CardTitle>
          <CardDescription>
            البوابة شفافة تماماً — أرسل الطلب بنفس بنية المزود الأصلي، والبوابة تستبدل المفتاح فقط.
            استبدل <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">YOUR_DOMAIN</code> و
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">gw_xxx</code> بقيمك.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chat">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 h-auto">
              <TabsTrigger value="chat" className="text-xs gap-1"><MessageSquare className="w-3 h-3" /> Chat</TabsTrigger>
              <TabsTrigger value="images" className="text-xs gap-1"><ImageIcon className="w-3 h-3" /> الصور</TabsTrigger>
              <TabsTrigger value="models" className="text-xs gap-1"><Search className="w-3 h-3" /> النماذج</TabsTrigger>
              <TabsTrigger value="embeddings" className="text-xs gap-1"><FileText className="w-3 h-3" /> Embeddings</TabsTrigger>
              <TabsTrigger value="audio" className="text-xs gap-1"><Mic className="w-3 h-3" /> الصوت</TabsTrigger>
              <TabsTrigger value="rerank" className="text-xs gap-1"><ShieldAlert className="w-3 h-3" /> Rerank</TabsTrigger>
              <TabsTrigger value="how" className="text-xs gap-1"><Network className="w-3 h-3" /> الآلية</TabsTrigger>
            </TabsList>

            {/* ── Chat ── */}
            <TabsContent value="chat" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">المحادثة (Chat Completions)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  البوابة تدعم كل مسارات chat الشائعة. أرسل الطلب بنفس بنية OpenAI أو المزود،
                  والبوابة توجّهه تلقائياً للمزود الصحيح.
                </p>
              </div>
              <EndpointPaths paths={[
                "/v1/chat/completions",
                "/v1/chats",
                "/v1/ai/chat",
                "/v1/messages",
              ]} />
              <CodeBlock
                title="OpenAI-style (gpt-4o, gpt-4o-mini, ...)"
                code={`curl -X POST https://YOUR_DOMAIN/v1/chat/completions \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"مرحبا"}]
  }'`}
                onCopy={copyCode}
              />
              <CodeBlock
                title="Python (OpenAI SDK)"
                code={`from openai import OpenAI

client = OpenAI(
    api_key="gw_xxx_YOUR_MASTER_KEY",
    base_url="https://YOUR_DOMAIN/v1"
)
resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role":"user","content":"مرحبا"}]
)
print(resp.choices[0].message.content)`}
                onCopy={copyCode}
              />
            </TabsContent>

            {/* ── Images ── */}
            <TabsContent value="images" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">توليد الصور (Image Generation)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  البوابة تدعم توليد الصور من أي مزود. أضف في إعدادات المزود مسار نوع
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">images</code>
                  بمسار المزود الفعلي، ثم أرسل الطلب بنفس بنية المزود.
                </p>
              </div>
              <EndpointPaths paths={[
                "/v1/images/generations",
                "/v1/images/edits",
                "/v1/images/variations",
              ]} />
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <div className="font-semibold mb-2 text-amber-600 dark:text-amber-400">
                  ⚠️ ملاحظة: أضف مسار images لكل مزود يدعم الصور
                </div>
                <p className="text-muted-foreground mb-2">
                  من تبويب "المزودون" → تفاصيل المزود → تبويب "المسارات":
                </p>
                <ul className="text-muted-foreground space-y-1 text-xs mr-4">
                  <li>• <b>النوع:</b> <code className="font-mono">images</code></li>
                  <li>• <b>المسار:</b> مسار المزود الفعلي (مثال: <code className="font-mono">/v1beta/models/gemini-3.1-flash-lite-image:generateContent</code> لمزود CometAPI)</li>
                  <li>• <b>النماذج:</b> أضف اسم النموذج في تبويب "النماذج" (مثال: <code className="font-mono">gemini-3.1-flash-lite-image</code>)</li>
                </ul>
              </div>
              <CodeBlock
                title="OpenAI DALL-E style (gpt-image, dall-e-3)"
                code={`curl -X POST https://YOUR_DOMAIN/v1/images/generations \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "dall-e-3",
    "prompt": "لوحة فنية لقط في غابة",
    "n": 1,
    "size": "1024x1024"
  }'`}
                onCopy={copyCode}
              />
              <CodeBlock
                title="Gemini Image style (CometAPI / SiliconFlow)"
                code={`curl -X POST https://YOUR_DOMAIN/v1/images/generations \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Da Vinci style anatomical sketch"}]
    }],
    "generationConfig": {
      "responseModalities": ["TEXT","IMAGE"],
      "imageConfig": {"aspectRatio":"1:1","imageSize":"1K"}
    }
  }'`}
                onCopy={copyCode}
              />
              <CodeBlock
                title="Stable Diffusion / FLUX style (SiliconFlow)"
                code={`curl -X POST https://YOUR_DOMAIN/v1/images/generations \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "black-forest-labs/FLUX.1-schnell",
    "prompt": "قط فضائي يطير في الفضاء",
    "image_size": "1024x1024"
  }'`}
                onCopy={copyCode}
              />
              <CodeBlock
                title="Python — حفظ الصورة من الرد"
                code={`import requests, base64, json

resp = requests.post(
    "https://YOUR_DOMAIN/v1/images/generations",
    headers={
        "Authorization": "Bearer gw_xxx_YOUR_MASTER_KEY",
        "Content-Type": "application/json"
    },
    json={
        "model": "dall-e-3",
        "prompt": "قط فضائي",
        "size": "1024x1024"
    }
)
data = resp.json()

# OpenAI-style: data[0].url or data[0].b64_json
if "data" in data and data["data"]:
    item = data["data"][0]
    if "b64_json" in item:
        img = base64.b64decode(item["b64_json"])
    elif "url" in item:
        img = requests.get(item["url"]).content
    with open("image.png", "wb") as f:
        f.write(img)
    print("تم حفظ الصورة")

# Gemini-style: candidates[0].content.parts[].inlineData.data
elif "candidates" in data:
    for part in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            img = base64.b64decode(part["inlineData"]["data"])
            with open("image.png", "wb") as f:
                f.write(img)
            print("تم حفظ الصورة")`}
                onCopy={copyCode}
              />
            </TabsContent>

            {/* ── Models ── */}
            <TabsContent value="models" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">قائمة النماذج (Models)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  استرجع قائمة النماذج المتاحة من كل المزودين عبر مسار واحد.
                </p>
              </div>
              <EndpointPaths paths={["/v1/models"]} />
              <CodeBlock
                title="استرجاع قائمة النماذج"
                code={`curl https://YOUR_DOMAIN/v1/models \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY"`}
                onCopy={copyCode}
              />
              <p className="text-sm text-muted-foreground">
                <b>مهم:</b> استخدم أسماء النماذج كما تظهر في القائمة بالضبط (مثل
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">deepseek-ai/DeepSeek-V3.2</code>
                وليس <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">deepseek-chat</code>).
              </p>
            </TabsContent>

            {/* ── Embeddings ── */}
            <TabsContent value="embeddings" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">التضمينات (Embeddings)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  تحويل النصوص إلى متجهات للبحث الدلالي. أضف مسار
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">embeddings</code>
                  للمزود.
                </p>
              </div>
              <EndpointPaths paths={["/v1/embeddings"]} />
              <CodeBlock
                title="إنشاء embeddings"
                code={`curl -X POST https://YOUR_DOMAIN/v1/embeddings \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "text-embedding-3-small",
    "input": "النص المراد تضمينه"
  }'`}
                onCopy={copyCode}
              />
            </TabsContent>

            {/* ── Audio ── */}
            <TabsContent value="audio" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">الصوت (Audio — TTS / STT)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  تحويل النص لصوت (TTS) أو الصوت لنص (STT). أضف مسار
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">audio</code>
                  للمزود.
                </p>
              </div>
              <EndpointPaths paths={[
                "/v1/audio/speech",
                "/v1/audio/transcriptions",
              ]} />
              <CodeBlock
                title="تحويل النص لصوت (TTS)"
                code={`curl -X POST https://YOUR_DOMAIN/v1/audio/speech \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "tts-1",
    "input": "مرحبا بك في البوابة الذكية",
    "voice": "alloy"
  }' --output speech.mp3`}
                onCopy={copyCode}
              />
            </TabsContent>

            {/* ── Rerank ── */}
            <TabsContent value="rerank" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">إعادة الترتيب (Rerank)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  إعادة ترتيب المستندات حسب الصلة بسؤال. أضف مسار
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs mx-1">rerank</code>
                  للمزود (مثل Cohere, SiliconFlow).
                </p>
              </div>
              <EndpointPaths paths={["/v1/rerank"]} />
              <CodeBlock
                title="Rerank"
                code={`curl -X POST https://YOUR_DOMAIN/v1/rerank \\
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "Qwen/Qwen3-Reranker-8B",
    "query": "ما هي البوابة الذكية؟",
    "documents": ["البوابة وسيط شفاف","الطقس اليوم مشمس"]
  }'`}
                onCopy={copyCode}
              />
            </TabsContent>

            {/* ── How it works ── */}
            <TabsContent value="how" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">آلية عمل البوابة</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  البوابة عبارة عن وكيل عكسي شفاف (Transparent Reverse Proxy) مع تدوير مفاتيح ذكي.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <Step n={1} title="وصول الطلب">
                  يصل الطلب إلى <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">/v1/*</code> مع مفتاحك الرئيسي.
                </Step>
                <Step n={2} title="اكتشاف النوع">
                  تتعرّف البوابة على نوع الـ Endpoint تلقائياً (chat, images, embeddings, audio...).
                </Step>
                <Step n={3} title="البحث عن المزود">
                  تبحث عن المزود الذي يدعم النموذج المطلوب (حسب النماذج المضافة لكل مزود).
                </Step>
                <Step n={4} title="التوجيه الشفاف">
                  تختار مفتاحاً صحيحاً وتُرسل الطلب بشفافية — <b>فقط استبدال المفتاح</b>، دون أي تعديل على الـ Body أو الـ Headers.
                </Step>
                <Step n={5} title="تدوير المفاتيح">
                  عند فشل المفتاح (حصة/حد/401/5xx) تنتقل للمفتاح التالي <b>خلال أجزاء من الثانية</b>، مع تخطي المفاتيح المعطّلة فوراً.
                </Step>
                <Step n={6} title="إعادة الرد">
                  تُعيد الرد كما هو من المزود — تطبيقك لا يشعر بأي فرق.
                </Step>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 mt-4">
                <div className="font-semibold mb-2">تصنيف الأخطاء والتدوير</div>
                <div className="space-y-1.5 text-xs">
                  <ErrRow code="401/403" action="تعطيل المفتاح نهائياً + الانتقال للتالي" />
                  <ErrRow code="429" action="Cooldown مؤقت (دقيقة) + الانتقال للتالي" />
                  <ErrRow code="402/Quota" action="Cooldown طويل (6 ساعات) + الانتقال للتالي" />
                  <ErrRow code="5xx" action="Cooldown قصير (5 ثوانٍ) + الانتقال للتالي" />
                  <ErrRow code="400/404/422" action="خطأ من العميل → يُعاد كما هو (شفافية)" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Logout */}
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

// ───────────────────────── Sub-components ─────────────────────────

function Row({
  icon, label, value, ltr,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-sm w-24 shrink-0">{label}</div>
      <div className="font-medium mr-auto" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}

function EndpointPaths({ paths }: { paths: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {paths.map((p) => (
        <Badge key={p} variant="outline" className="font-mono text-xs" dir="ltr">{p}</Badge>
      ))}
    </div>
  );
}

function CodeBlock({ title, code, onCopy }: { title: string; code: string; onCopy: (c: string) => void }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onCopy(code)}
          title="نسخ"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed bg-background" dir="ltr">
        {code}
      </pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {n}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-sm">{children}</div>
      </div>
    </div>
  );
}

function ErrRow({ code, action }: { code: string; action: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-mono text-xs w-20 justify-center" dir="ltr">{code}</Badge>
      <span className="text-muted-foreground">{action}</span>
    </div>
  );
}
