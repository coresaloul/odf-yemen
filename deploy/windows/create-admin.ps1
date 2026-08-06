# ==========================================================
#  إنشاء حساب مستخدم بدور المدير التنفيذي
#  مثال:
#   .\create-admin.ps1 -Email admin@yateemdev.org -Password "كلمة-المرور"
# ==========================================================
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [ValidateSet("executive_director", "hr", "manager", "employee")]
  [string]$Role = "executive_director"
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$deploy  = (Resolve-Path "$PSScriptRoot\..").Path
$envPath = Join-Path $deploy ".env"
if (-not (Test-Path $envPath)) { throw "ملف الإعدادات .env غير موجود. شغّل setup.ps1 أولاً." }

$cfg = @{}
Get-Content $envPath | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2] } }

$base = "http://localhost:$($cfg['GATEWAY_PORT'])"
$body = @{ email = $Email; password = $Password; email_confirm = $true } | ConvertTo-Json

$resp = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/admin/users" -Body $body `
  -ContentType "application/json" `
  -Headers @{ apikey = $cfg['SERVICE_ROLE_KEY']; Authorization = "Bearer $($cfg['SERVICE_ROLE_KEY'])" }

if (-not $resp.id) { throw "فشل إنشاء الحساب: $($resp | ConvertTo-Json -Compress)" }

Push-Location $deploy
"insert into public.user_roles (user_id, role) values ('$($resp.id)', '$Role') on conflict do nothing;" |
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-Null
Pop-Location

Write-Host "تم إنشاء الحساب: $Email بدور $Role" -ForegroundColor Green
