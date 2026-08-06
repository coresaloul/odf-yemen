# ==========================================================
#  فتح منافذ النظام في جدار حماية Windows للشبكة الداخلية فقط
#  التشغيل كمسؤول (Run as Administrator)
# ==========================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$envPath = Join-Path (Resolve-Path "$PSScriptRoot\..") ".env"
$appPort = 80
$gwPort  = 8000
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^APP_PORT=(\d+)')     { $appPort = [int]$Matches[1] }
    if ($_ -match '^GATEWAY_PORT=(\d+)') { $gwPort  = [int]$Matches[1] }
  }
}

$ports = @($appPort, $gwPort) | Select-Object -Unique

foreach ($p in $ports) {
  $name = "ODF-HR-$p"
  Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $name `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p `
    -Profile Private,Domain | Out-Null
  Write-Host "تم فتح المنفذ $p للشبكة الداخلية (Private/Domain) فقط" -ForegroundColor Green
}

Write-Host "`nملاحظة أمنية: المنافذ مغلقة على شبكات Public عمداً." -ForegroundColor Yellow
Write-Host "للوصول من خارج المكتب استخدم VPN أو Cloudflare Tunnel." -ForegroundColor Yellow
