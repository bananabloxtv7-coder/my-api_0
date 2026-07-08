"use client";

import { useState } from "react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Network, KeyRound, Zap } from "lucide-react";
import { toast } from "sonner";

export function AuthScreen() {
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("تم تسجيل الدخول بنجاح");
      } else {
        await register(email, password, name);
        toast.success("تم إنشاء الحساب بنجاح");
      }
    } catch (err) {
      toast.error((err as Error).message || "حدث خطأ");
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero side */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-cyan-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Network className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">بوابة API الذكية</span>
        </div>

        <div className="relative z-10 space-y-8">
          <h1 className="text-4xl font-bold leading-tight">
            بوابة وسيطة شفافة
            <br />
            لمزودي الذكاء الاصطناعي
          </h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-md">
            توجيه ذكي للطلبات، تدوير تلقائي للمفاتيح، واكتشاف النماذج — كل ذلك
            بشفافية كاملة دون أن يشعر تطبيقك بأي فرق.
          </p>
          <div className="grid grid-cols-1 gap-4 max-w-md">
            <Feature
              icon={<Zap className="w-5 h-5" />}
              title="تدوير مفاتيح فوري"
              desc="تبديل المفاتيح خلال أجزاء من الثانية عند تجاوز الحصة أو الحد."
            />
            <Feature
              icon={<Network className="w-5 h-5" />}
              title="اكتشاف النماذج"
              desc="بحث تلقائي بين المزودين عن النموذج المطلوب."
            />
            <Feature
              icon={<ShieldCheck className="w-5 h-5" />}
              title="وكيل عكسي شفاف"
              desc="بدون تعديل الطلبات أو الردود — فقط استبدال المفتاح."
            />
            <Feature
              icon={<KeyRound className="w-5 h-5" />}
              title="تشفير كامل"
              desc="تخزين المفاتيح مشفّرة AES-256 وسجل تدقيق شامل."
            />
          </div>
        </div>

        <div className="relative z-10 text-white/50 text-sm">
          © {new Date().getFullYear()} Smart API Gateway
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <Network className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold">بوابة API الذكية</span>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "ادخل بياناتك للوصول إلى لوحة التحكم"
                  : "أنشئ حسابك للبدء خلال دقيقة"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as "login" | "register")}
              >
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">دخول</TabsTrigger>
                  <TabsTrigger value="register">حساب جديد</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">كلمة المرور</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        dir="ltr"
                      />
                    </div>
                    <SubmitButton loading={loading} label="تسجيل الدخول" />
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">الاسم (اختياري)</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="اسمك"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-r">البريد الإلكتروني</Label>
                      <Input
                        id="email-r"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-r">كلمة المرور</Label>
                      <Input
                        id="password-r"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6 أحرف على الأقل"
                        dir="ltr"
                      />
                    </div>
                    <SubmitButton loading={loading} label="إنشاء الحساب" />
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-white/70 text-sm">{desc}</div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <Button type="submit" className="w-full" disabled={loading} size="lg">
      {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
      {label}
    </Button>
  );
}
