# تشغيل النظام على سيرفر محلي (استضافة ذاتية)

هذه الحزمة تُشغّل **نظام الموارد البشرية بالكامل داخل شبكتكم**: قاعدة بيانات PostgreSQL خاصة، خدمة المصادقة، واجهة البيانات (REST)، التخزين، والتطبيق نفسه — دون أي اعتماد على استضافة خارجية.

## المتطلبات
- سيرفر Linux (Ubuntu 22.04 فأحدث) بذاكرة 4GB فأكثر
- Docker + Docker Compose v2
- منفذان مفتوحان: `3000` للتطبيق و`8000` لبوابة الخدمات

## خطوات التشغيل

### 1) نسخ المشروع إلى السيرفر
```sh
git clone <رابط-المستودع> odf-hr && cd odf-hr/deploy
cp .env.example .env
```

### 2) توليد المفاتيح
```sh
openssl rand -base64 48      # ضعه في JWT_SECRET
openssl rand -base64 32      # ضعه في POSTGRES_PASSWORD
```
ثم ولّد `ANON_KEY` و`SERVICE_ROLE_KEY` (رمزا JWT موقّعان بـ `JWT_SECRET`، بحقل `role` = `anon` و`service_role`) من:
https://supabase.com/docs/guides/self-hosting#api-keys

وعدّل `PUBLIC_HOST` ليساوي عنوان السيرفر داخل الشبكة، مثال: `http://192.168.1.10`.

### 3) الإقلاع
```sh
docker compose up -d --build
```

### 4) إنشاء بنية قاعدة البيانات
```sh
./apply-migrations.sh
```
يطبّق كل ملفات `supabase/migrations` بالترتيب: الجداول، الأدوار، سياسات الحماية (RLS)، الدوال والمشغّلات.

### 5) إنشاء حساب المدير التنفيذي
```sh
./create-admin.sh admin@yateemdev.org "كلمة-مرور-قوية"
```

### 6) الدخول
افتح: `http://<عنوان-السيرفر>:3000`

## النسخ الاحتياطي والاسترجاع
```sh
# نسخة احتياطية يومية
docker compose exec -T db pg_dump -U postgres postgres | gzip > backup-$(date +%F).sql.gz

# استرجاع
gunzip -c backup-2026-08-06.sql.gz | docker compose exec -T db psql -U postgres -d postgres
```
ملفات الوثائق المرفوعة محفوظة في الحجم `storage-data`.

## نقل البيانات من الاستضافة الحالية
1. صدّر البيانات من لوحة التحكم الحالية (تصدير CSV لكل جدول).
2. شغّل الخطوات 1–4 أعلاه لبناء المخطط.
3. استورد ملفات CSV: `\copy public.employees from 'employees.csv' csv header` داخل `psql`.
4. أعد إنشاء حسابات المستخدمين عبر `create-admin.sh` أو شاشة «إدارة المستخدمين» داخل النظام.

## تشغيل بدون Docker (اختياري)
```sh
npm install
NITRO_PRESET=node_server npm run build
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  node .output/server/index.mjs
```

## ملاحظات مهمة
- كل الإعدادات عبر متغيرات البيئة — لا يوجد ارتباط صلب بأي مزوّد.
- خاصية «إضافة مهمة بالصوت» تحتاج مفتاح خدمة ذكاء اصطناعي خارجية (`LOVABLE_API_KEY` أو أي مزوّد بديل). بدونه يبقى النظام يعمل كاملاً عدا هذه الميزة.
- للتشغيل عبر HTTPS ضع Nginx أو Caddy أمام المنفذين 3000 و8000، وحدّث `PUBLIC_HOST` إلى `https://...` ثم أعد البناء.
