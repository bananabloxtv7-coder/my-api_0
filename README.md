# بوابة API الذكية — Smart API Gateway

<div dir="rtl">

بوابة وسيطة شفافة (Transparent Reverse Proxy) بين تطبيقاتك ومزودي خدمات الذكاء الاصطناعي، مع تدوير مفاتيح ذكي، اكتشاف نماذج تلقائي، و failover فوري — دون أن يشعر تطبيقك بأي فرق.

## المزايا الرئيسية

- 🔄 **تدوير مفاتيح ذكي (Key Rotation)** — تبديل فوري للمفاتيح عند تجاوز الحصة أو الحد أو فشل المصادقة، خلال أجزاء من الثانية.
- 🔍 **اكتشاف النماذج (Model Discovery)** — بحث تلقائي بين جميع المزودين عن النموذج المطلوب.
- 🛡️ **وكيل عكسي شفاف** — لا تعديل على الطلبات أو الردود، فقط استبدال مفتاح المصادقة. الرد يُعاد كما هو (Raw) مع دعم البث (Streaming/SSE).
- 🗺️ **مسارات ديناميكية (Dynamic Endpoint Mapping)** — لكل مزود مساراته الخاصة القابلة للتعديل من لوحة التحكم دون لمس الكود.
- 🔐 **تشفير AES-256** لمفاتيح المزودين عند التخزين + سجل تدقيق كامل.
- 📊 **لوحة تحكم عربية (RTL)** — إدارة المزودين، المفاتيح، النماذج، الإحصائيات، والسجلات.
- ⚡ **أداء عالٍ** — async بالكامل، Non-Blocking I/O، تدوير سريع.

## البنية التقنية

| الطبقة | التقنية |
|--------|---------|
| Framework | Next.js 16 (App Router) + TypeScript |
| قاعدة البيانات | PostgreSQL (Supabase) + Prisma ORM |
| الواجهة | Tailwind CSS 4 + shadcn/ui + Recharts |
| المصادقة | JWT + Cookies (httpOnly) |
| التشفير | AES-256-GCM (Node crypto) |

## كيف يعمل المحرك

```
العميل → POST /api/v1/chat/completions (Authorization: Bearer gw_xxx)
                        │
                        ▼
        1. التحقق من المفتاح الرئيسي
        2. اكتشاف نوع الـ Endpoint (chat)
        3. قراءة النموذج من الـ Body (gpt-4o)
        4. البحث عن مزود يدعم النموذج
        5. تدوير المفاتيح:
              Key1 → فشل (401/429/402) → تعطيل/Cooldown
              Key2 → نجاح ✓
        6. تمرير الرد Raw (مع Streaming)
```

### تصنيف الأخطاء وتدوير المفاتيح

| الحالة | الإجراء |
|-------|---------|
| 401 / 403 | تعطيل المفتاح نهائيًا والانتقال للتالي |
| 429 | Cooldown مؤقت (دقيقة) |
| 402 / Billing / Quota | Cooldown طويل (6 ساعات) |
| 5xx | Cooldown قصير + الانتقال للتالي |
| 400 / 404 / 422 | خطأ من العميل → يُعاد كما هو (شفافية) |

## الاستخدام

```bash
# curl
curl https://YOUR_DOMAIN/api/v1/chat/completions \
  -H "Authorization: Bearer gw_xxx_YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"مرحبا"}]}'

# Python (OpenAI SDK)
from openai import OpenAI
client = OpenAI(
    api_key="gw_xxx_YOUR_MASTER_KEY",
    base_url="https://YOUR_DOMAIN/api/v1"
)
```

## التطوير المحلي

```bash
bun install
cp .env.example .env   # عبّ القيم
bun run db:push        # مزامنة المخطط مع قاعدة البيانات
bun run dev
```

## متغيرات البيئة

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط Supabase pooler (transaction mode) |
| `DIRECT_URL` | رابط Supabase session pooler (للم migrations) |
| `JWT_SECRET` | سر توقيع JWT |
| `ENCRYPTION_KEY` | مفتاح AES-256 (64 hex chars) |

## النشر على Vercel

1. ارفع المشروع إلى GitHub.
2. استورد المستودع في Vercel.
3. أضف متغيرات البيئة في إعدادات Vercel.
4. انشر. (سيُنفّذ `prisma generate && next build` تلقائيًا).

</div>
