# ==========================================================
#  نسخة احتياطية يومية لقاعدة البيانات وملفات الوثائق
#  الاستخدام:  .\backup.ps1  [-Destination "D:\ODF-Backups"]  [-KeepDays 30]
# ==========================================================
param(
  [string]$Destination = "$PSScriptRoot\..\backups",
  [int]$KeepDays = 30
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$deploy = (Resolve-Path "$PSScriptRoot\..").Path
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$Destination = (Resolve-Path $Destination).Path
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"

Push-Location $deploy

# 1) قاعدة البيانات
$sqlFile = Join-Path $Destination "db-$stamp.sql"
docker compose exec -T db pg_dump -U postgres -d postgres | Out-File -FilePath $sqlFile -Encoding UTF8
if ((Get-Item $sqlFile).Length -lt 1024) { Pop-Location; throw "فشل أخذ نسخة قاعدة البيانات." }
Compress-Archive -Path $sqlFile -DestinationPath "$sqlFile.zip" -Force
Remove-Item $sqlFile

# 2) ملفات الوثائق المرفوعة
$filesDir = Join-Path $Destination "files-$stamp"
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
$cid = (docker compose ps -q storage)
if ($cid) {
  docker cp "${cid}:/var/lib/storage" "$filesDir" 2>$null | Out-Null
  Compress-Archive -Path "$filesDir\*" -DestinationPath "$filesDir.zip" -Force -ErrorAction SilentlyContinue
}
Remove-Item $filesDir -Recurse -Force -ErrorAction SilentlyContinue

# 3) نسخة من ملف الإعدادات (مطلوب للاسترجاع)
Copy-Item (Join-Path $deploy ".env") (Join-Path $Destination "env-$stamp.txt") -Force

Pop-Location

# 4) حذف النسخ القديمة
Get-ChildItem $Destination -File |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

Write-Host "تمت النسخة الاحتياطية في: $Destination" -ForegroundColor Green
