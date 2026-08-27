# تشغيل النظام على جهاز Windows داخل المؤسسة

دليل كامل لتحويل جهاز يعمل بنظام Windows إلى سيرفر يشغّل نظام الموارد البشرية بالكامل (التطبيق + قاعدة البيانات + المصادقة + التخزين)، ويستخدمه الموظفون من أجهزتهم عبر الشبكة الداخلية.

---

## المتطلبات

| البند | الحد الأدنى | الموصى به |
|---|---|---|
| نظام التشغيل | Windows 10 (2004) | Windows 11 / Server 2022 |
| الذاكرة | 8 GB | 16 GB |
| المساحة الفارغة | 40 GB | 100 GB SSD |
| الشبكة | كابل + IP ثابت | كابل + IP محجوز من الراوتر |
| الكهرباء | — | UPS لحماية قاعدة البيانات |

مطلوب أيضاً: تفعيل **Virtualization (VT-x / SVM)** من إعدادات BIOS، وصلاحيات **Administrator** على الجهاز.

---

## الخطوة 1: تفعيل WSL2

افتح **PowerShell كمسؤول** ونفّذ:

```powershell
wsl --install
```

ثم **أعد تشغيل الجهاز**. بعد الإقلاع تحقق:

```powershell
wsl --status
```

يجب أن يظهر `Default Version: 2`. إن لم يظهر:

```powershell
wsl --set-default-version 2
wsl --update
```

---

## الخطوة 2: تثبيت Docker Desktop

1. حمّل Docker Desktop for Windows من الموقع الرسمي وثبّته.
2. أثناء التثبيت اترك خيار **Use WSL 2 instead of Hyper-V** مفعّلاً.
3. بعد التثبيت افتح Docker Desktop ← **Settings**:
   - **General**: فعّل `Start Docker Desktop when you sign in`
   - **Resources**: خصّص 4 GB ذاكرة على الأقل (6 GB أفضل)
4. انتظر حتى تتحول الأيقونة أسفل الشاشة إلى **Running** (أخضر).

تحقق من PowerShell:

```powershell
docker version
```

---

## الخطوة 3: نسخ المشروع

ثبّت Git من `git-scm.com`، ثم:

```powershell
cd C:\
git clone <رابط-المستودع> odf-hr
cd C:\odf-hr\deploy\windows
```

إن لم يكن لديك Git، حمّل المشروع كملف ZIP وفكّه في `C:\odf-hr`.

---

## الخطوة 4: التهيئة بأمر واحد

انقر بزر الفأرة الأيمن على `setup.ps1` واختر **Run with PowerShell**، أو من PowerShell كمسؤول:

```powershell
cd C:\odf-hr\deploy\windows
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

السكربت يقوم تلقائياً بـ:

1. التحقق من Docker
2. اكتشاف عنوان IP الخاص بالجهاز وسؤالك عن المنفذ (افتراضياً `80`)
3. توليد كلمة مرور قاعدة البيانات ومفاتيح المصادقة (JWT) وكتابتها في `deploy\.env`
4. سؤالك عن إعدادات البريد (اختياري — يمكن تخطيها)
5. بناء النظام وتشغيله (10–20 دقيقة أول مرة فقط)
6. إنشاء بنية قاعدة البيانات: كل الجداول وسياسات الحماية والدوال
7. إنشاء حساب المدير التنفيذي
8. فتح المنافذ في جدار حماية Windows للشبكة الداخلية فقط

> **مهم جداً:** احتفظ بنسخة آمنة من `C:\odf-hr\deploy\.env`. بدونه لا يمكن قراءة قاعدة البيانات ولا تسجيل الدخول.

---

## الخطوة 5: تثبيت عنوان IP للجهاز

حتى لا يتغير العنوان بعد إعادة التشغيل:

**الطريقة الأفضل (من الراوتر):** ابحث في إعدادات الراوتر عن `DHCP Reservation` واحجز العنوان الحالي لعنوان MAC الخاص بالجهاز.

**أو من Windows:** Settings ← Network & Internet ← Ethernet ← IP assignment ← Edit ← Manual ← IPv4:

- IP address: `192.168.1.50` (مثال — اختر عنواناً خارج نطاق DHCP)
- Subnet mask: `255.255.255.0`
- Gateway: عنوان الراوتر
- DNS: `8.8.8.8`

إن غيّرت العنوان بعد التهيئة، عدّل `PUBLIC_HOST` في `deploy\.env` ثم:

```powershell
cd C:\odf-hr\deploy
docker compose up -d --build
```

---

## الخطوة 6: الدخول من أجهزة الموظفين

من أي جهاز على نفس الشبكة، افتح المتصفح على:

```
http://192.168.1.50
```

(استبدل العنوان بعنوان جهاز السيرفر. إن اخترت منفذاً غير 80 أضفه: `http://192.168.1.50:3000`)

يمكن تسهيل الأمر بإنشاء اختصار على سطح مكتب كل موظف، أو بإضافة سجل داخلي في DNS المؤسسة يربط `hr.local` بعنوان الجهاز.

---

## الخطوة 7: التشغيل التلقائي والصيانة الدورية

شغّل كمسؤول:

```powershell
powershell -ExecutionPolicy Bypass -File C:\odf-hr\deploy\windows\install-tasks.ps1
```

يسجّل ثلاث مهام في Task Scheduler:

| المهمة | الوظيفة |
|---|---|
| `ODF-HR-Startup` | تشغيل النظام تلقائياً عند إقلاع الجهاز (بعد انقطاع الكهرباء مثلاً) |
| `ODF-HR-Watchdog` | فحص كل 10 دقائق وإعادة التشغيل إن توقف |
| `ODF-HR-Backup` | نسخة احتياطية يومية الساعة 11:00 مساءً |

---

## التشغيل اليومي

| العملية | الطريقة |
|---|---|
| تشغيل النظام | نقرة مزدوجة على `windows\start.bat` |
| إيقاف النظام | نقرة مزدوجة على `windows\stop.bat` |
| نسخة احتياطية فورية | `powershell -File windows\backup.ps1` |
| نسخة على قرص خارجي | `powershell -File windows\backup.ps1 -Destination "E:\ODF-Backups"` |
| إضافة مستخدم بصلاحية | `powershell -File windows\create-admin.ps1 -Email x@y.org -Password "..." -Role hr` |
| عرض حالة الخدمات | `cd C:\odf-hr\deploy` ثم `docker compose ps` |
| عرض السجلات | `docker compose logs -f app` |

---

## الاسترجاع من نسخة احتياطية

```powershell
cd C:\odf-hr\deploy
# 1) أعد ملف .env من نسخة env-<التاريخ>.txt
# 2) فك ضغط db-<التاريخ>.sql.zip ثم:
Get-Content .\db-2026-08-06_2300.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
```

## نقل البيانات من Supabase السحابي إلى PostgreSQL المحلية

يجب أولاً تشغيل الخدمات المحلية وتطبيق migrations. بعد ذلك احصل من Supabase Dashboard على **رابط اتصال PostgreSQL**، وليس رابط REST أو `SUPABASE_URL`. يفضّل استخدام رابط Session Pooler عند توفره.

من PowerShell داخل مجلد المشروع:

```powershell
cd .\deploy\windows
powershell -ExecutionPolicy Bypass -File .\import-cloud-db.ps1 `
   -SourceDatabaseUrl "postgresql://postgres:[كلمة-المرور]@db.[المشروع].supabase.co:5432/postgres"
```

ينقل السكربت بيانات مخطط `public` فقط إلى قاعدة PostgreSQL المحلية، ويحفظ نسخة dump داخل `deploy\backups`. لا يشمل ذلك حسابات المصادقة في `auth` أو الملفات الموجودة في Storage؛ أعد إنشاء المستخدمين محلياً وانقل ملفات Storage بشكل مستقل.

نفّذ النقل على قاعدة محلية فارغة أو نسخة جديدة من volume لتجنب أخطاء المفاتيح المكررة. لا تضع رابط الاتصال في ملف داخل Git أو في سجل الأوامر المشترك.

---

## النسخ الاحتياطي: قاعدة ذهبية

نسخة داخل نفس الجهاز ليست نسخة احتياطية. اضبط `backup.ps1` ليكتب على:

- قرص خارجي أو جهاز آخر في الشبكة (`-Destination "\\NAS\ODF-Backups"`)، **و**
- نسخة أسبوعية تُنقل خارج المكتب

---

## الوصول من خارج المكتب (اختياري)

**الخيار الآمن الأول — VPN المؤسسة:** يتصل الموظف بالـ VPN ثم يفتح نفس العنوان الداخلي. لا حاجة لأي تغيير في النظام.

**الخيار الثاني — Cloudflare Tunnel (مجاني، بدون فتح منافذ على الراوتر):**

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create odf-hr
cloudflared tunnel route dns odf-hr hr.yateemdev.org
cloudflared tunnel run --url http://localhost:80 odf-hr
```

ثم عدّل `PUBLIC_HOST=https://hr.yateemdev.org` في `deploy\.env` وأعد البناء:

```powershell
cd C:\odf-hr\deploy
docker compose up -d --build
```

لا تفتح منافذ النظام مباشرة على الإنترنت من الراوتر (Port Forwarding) دون HTTPS وجدار حماية — هذا يعرّض بيانات الموظفين للخطر.

---

## حل المشاكل الشائعة

| العَرَض | السبب | الحل |
|---|---|---|
| `wsl --install` يفشل | Virtualization معطّلة | فعّل VT-x/SVM من BIOS |
| Docker عالق على "Starting" | WSL قديم | `wsl --update` ثم أعد تشغيل الجهاز |
| `port is already allocated` | منفذ 80 مستخدم (IIS أو Skype) | غيّر `APP_PORT` في `.env` إلى `3000` وأعد التشغيل |
| الموقع يفتح على السيرفر ولا يفتح من أجهزة الموظفين | جدار الحماية أو شبكة Public | شغّل `firewall.ps1` كمسؤول، وغيّر ملف تعريف الشبكة إلى Private |
| صفحة بيضاء أو خطأ اتصال بعد تغيير IP | `PUBLIC_HOST` قديم | عدّله في `.env` ثم `docker compose up -d --build` |
| بطء شديد | ذاكرة Docker قليلة | Docker Desktop ← Settings ← Resources ← ارفع الذاكرة إلى 6–8 GB |
| فشل تسجيل الدخول بعد إعادة تثبيت | تغيّر `JWT_SECRET` | أعد ملف `.env` الأصلي من النسخة الاحتياطية |
| نفاد المساحة | سجلات وصور Docker قديمة | `docker system prune -a` (لا يحذف البيانات) |

---

## ملاحظات

- كل الإعدادات عبر ملف `.env` — لا يوجد ارتباط بأي مزوّد، ويمكن نقل النظام لاحقاً إلى سيرفر Linux أو VPS بنفس الملفات.
- ميزة **إضافة مهمة بالصوت** تحتاج إنترنت ومفتاح خدمة ذكاء اصطناعي؛ باقي النظام يعمل بالكامل دون إنترنت.
- إشعارات البريد تحتاج إعدادات SMTP صحيحة في `.env`؛ الإشعارات داخل النظام تعمل بدونها.
