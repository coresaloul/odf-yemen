# ==========================================================
#  جدولة المهام التلقائية في Windows:
#   1) تشغيل النظام تلقائياً عند إقلاع الجهاز
#   2) فحص كل 10 دقائق وإعادة التشغيل عند التوقف
#   3) نسخة احتياطية يومية الساعة 11:00 مساءً
#  التشغيل كمسؤول (Run as Administrator)
# ==========================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$deploy = (Resolve-Path "$PSScriptRoot\..").Path
$ps     = "powershell.exe"

function Register-OdfTask($name, $action, $triggers) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers `
    -RunLevel Highest -User "SYSTEM" `
    -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit ([TimeSpan]::FromHours(2))) | Out-Null
  Write-Host "تم تسجيل المهمة: $name" -ForegroundColor Green
}

# 1) التشغيل عند الإقلاع (بعد 3 دقائق لإتاحة إقلاع Docker Desktop)
$startAction = New-ScheduledTaskAction -Execute $ps `
  -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"Start-Sleep 180; Set-Location '$deploy'; docker compose up -d`""
$bootTrigger = New-ScheduledTaskTrigger -AtStartup
Register-OdfTask "ODF-HR-Startup" $startAction $bootTrigger

# 2) مراقبة كل 10 دقائق
$watchAction = New-ScheduledTaskAction -Execute $ps `
  -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location '$deploy'; if ((docker compose ps -q app).Length -eq 0 -or -not (docker compose ps --status running -q app)) { docker compose up -d }`""
$watchTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) `
  -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-OdfTask "ODF-HR-Watchdog" $watchAction $watchTrigger

# 3) نسخة احتياطية يومية 23:00
$backupAction = New-ScheduledTaskAction -Execute $ps `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\backup.ps1`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At 23:00
Register-OdfTask "ODF-HR-Backup" $backupAction $backupTrigger

Write-Host "`nتمت جدولة كل المهام. راجعها من Task Scheduler عند الحاجة." -ForegroundColor Cyan
