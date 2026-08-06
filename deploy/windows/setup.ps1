# ==========================================================
#  تهيئة نظام الموارد البشرية على جهاز Windows (أول مرة فقط)
#  التشغيل: انقر بزر الفأرة الأيمن على الملف واختر
#           "Run with PowerShell"  (كمسؤول)
# ==========================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot
$deploy = (Resolve-Path "$PSScriptRoot\..").Path

function Say($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`n!! $msg" -ForegroundColor Red; Read-Host "اضغط Enter للخروج"; exit 1 }

# ---------- 1) التحقق من Docker ----------
Say "التحقق من Docker Desktop..."
try { docker version --format '{{.Server.Version}}' | Out-Null }
catch { Fail "Docker Desktop غير مثبت أو غير مشغّل. ثبّته وشغّله ثم أعد المحاولة." }

# ---------- 2) عنوان الجهاز في الشبكة ----------
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }
$answer = Read-Host "عنوان الجهاز في الشبكة [$ip] (اضغط Enter للقبول)"
if ($answer) { $ip = $answer }

$appPort = Read-Host "منفذ التطبيق [80] (اضغط Enter للقبول)"
if (-not $appPort) { $appPort = "80" }

# ---------- 3) توليد المفاتيح ----------
function New-RandomSecret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[^A-Za-z0-9]', '')
}

function New-Jwt([string]$role, [string]$secret) {
  $header  = '{"alg":"HS256","typ":"JWT"}'
  $iat     = [int][double]::Parse((Get-Date -UFormat %s))
  $exp     = $iat + (60 * 60 * 24 * 365 * 10)   # صالح 10 سنوات
  $payload = "{`"role`":`"$role`",`"iss`":`"supabase`",`"iat`":$iat,`"exp`":$exp}"
  function B64Url([byte[]]$d) { [Convert]::ToBase64String($d).TrimEnd('=').Replace('+','-').Replace('/','_') }
  $h = B64Url ([Text.Encoding]::UTF8.GetBytes($header))
  $p = B64Url ([Text.Encoding]::UTF8.GetBytes($payload))
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
  $sig = B64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$h.$p")))
  return "$h.$p.$sig"
}

$envPath = Join-Path $deploy ".env"
if (Test-Path $envPath) {
  $again = Read-Host "ملف الإعدادات موجود مسبقاً. إعادة توليده سيمنع الوصول للبيانات القديمة. متابعة؟ (y/N)"
  if ($again -ne "y") { Say "تم الاحتفاظ بالإعدادات الحالية." }
}

if (-not (Test-Path $envPath) -or $again -eq "y") {
  Say "توليد كلمات المرور والمفاتيح..."
  $dbPass    = New-RandomSecret 24
  $jwtSecret = New-RandomSecret 48
  $anonKey   = New-Jwt "anon" $jwtSecret
  $svcKey    = New-Jwt "service_role" $jwtSecret

  $smtpHost = Read-Host "خادم البريد SMTP (اتركه فارغاً لتعطيل رسائل البريد)"
  if (-not $smtpHost) { $smtpHost = "localhost"; $smtpUser = "no-reply@localhost"; $smtpPass = "none"; $smtpPort = "25" }
  else {
    $smtpPort = Read-Host "منفذ SMTP [587]"; if (-not $smtpPort) { $smtpPort = "587" }
    $smtpUser = Read-Host "بريد المرسل"
    $smtpPass = Read-Host "كلمة مرور البريد"
  }

@"
PUBLIC_HOST=http://$ip
POSTGRES_PASSWORD=$dbPass
POSTGRES_DB=postgres
POSTGRES_PORT=5432
JWT_SECRET=$jwtSecret
ANON_KEY=$anonKey
SERVICE_ROLE_KEY=$svcKey
SMTP_HOST=$smtpHost
SMTP_PORT=$smtpPort
SMTP_USER=$smtpUser
SMTP_PASS=$smtpPass
SMTP_SENDER_NAME=نظام الموارد البشرية
APP_PORT=$appPort
GATEWAY_PORT=8000
"@ | Set-Content -Path $envPath -Encoding UTF8

  Say "تم إنشاء ملف الإعدادات: $envPath"
  Write-Host "   احتفظ بنسخة آمنة منه — بدونه لا يمكن قراءة البيانات." -ForegroundColor Yellow
}

# ---------- 4) بناء وتشغيل الخدمات ----------
Say "بناء النظام وتشغيله (قد يستغرق 10-20 دقيقة أول مرة)..."
Push-Location $deploy
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "فشل تشغيل الخدمات. راجع رسائل Docker أعلاه." }

# ---------- 5) تطبيق بنية قاعدة البيانات ----------
Say "انتظار جاهزية قاعدة البيانات..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker compose exec -T db pg_isready -U postgres 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 3
}
if (-not $ready) { Pop-Location; Fail "قاعدة البيانات لم تجهز في الوقت المتوقع." }

Say "تطبيق بنية قاعدة البيانات..."
Get-ChildItem "$deploy\..\supabase\migrations\*.sql" | Sort-Object Name | ForEach-Object {
  Write-Host "   - $($_.Name)"
  Get-Content $_.FullName -Raw -Encoding UTF8 |
    docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "     تحذير: تعذّر تطبيق هذا الملف بالكامل" -ForegroundColor Yellow }
}
Pop-Location

# ---------- 6) حساب المدير التنفيذي ----------
Say "إنشاء حساب المدير التنفيذي"
$adminEmail = Read-Host "البريد الإلكتروني للمدير التنفيذي"
$adminPass  = Read-Host "كلمة المرور"
if ($adminEmail -and $adminPass) {
  & "$PSScriptRoot\create-admin.ps1" -Email $adminEmail -Password $adminPass
}

# ---------- 7) جدار الحماية ----------
Say "فتح المنافذ في جدار حماية Windows للشبكة الداخلية..."
& "$PSScriptRoot\firewall.ps1"

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host " تم تجهيز النظام بنجاح" -ForegroundColor Green
Write-Host " العنوان من أي جهاز في الشبكة:  http://$ip$(if ($appPort -ne '80') { ":$appPort" })" -ForegroundColor Green
Write-Host "==================================================`n" -ForegroundColor Green
Read-Host "اضغط Enter للإغلاق"
