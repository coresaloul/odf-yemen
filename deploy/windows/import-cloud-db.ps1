<#
.SYNOPSIS
  نقل بيانات public من PostgreSQL السحابي إلى قاعدة PostgreSQL المحلية.

.DESCRIPTION
  يصدّر البيانات فقط بعد تطبيق migrations محلياً. لا يستبدل مخططي auth وstorage،
  لأنهما تتم تهيئتهما بواسطة خدمات Supabase المحلية.

.EXAMPLE
  .\import-cloud-db.ps1 -SourceDatabaseUrl "postgresql://..."
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDatabaseUrl,
  [string]$BackupDirectory = "$PSScriptRoot\..\backups",
  [switch]$SkipMigrations
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker غير مثبت أو غير متاح في PATH."
}

$deploy = (Resolve-Path "$PSScriptRoot\..").Path
$composeFile = Join-Path $deploy "docker-compose.yml"
if (-not (Test-Path $composeFile)) {
  throw "لم يتم العثور على docker-compose.yml داخل deploy."
}

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$BackupDirectory = (Resolve-Path $BackupDirectory).Path
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dumpName = "cloud-public-$stamp.dump"
$dumpPath = Join-Path $BackupDirectory $dumpName
$containerDumpPath = "/tmp/$dumpName"

Push-Location $deploy
try {
  Write-Host "تشغيل قاعدة البيانات المحلية..." -ForegroundColor Cyan
  docker compose up -d db | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "تعذر تشغيل خدمة PostgreSQL المحلية." }

  if (-not $SkipMigrations) {
    Write-Host "تطبيق migrations المحلية..." -ForegroundColor Cyan
    $migrationScript = Join-Path $deploy "apply-migrations.sh"
    if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
      wsl bash -lc "cd '$(wsl wslpath -a $deploy)' && bash ./apply-migrations.sh" | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "فشل تطبيق migrations المحلية." }
    } else {
      throw "لم يتم العثور على WSL. ثبّت WSL أو استخدم -SkipMigrations بعد تطبيق migrations يدوياً."
    }
  }

  $dbContainer = docker compose ps -q db
  if (-not $dbContainer) { throw "حاوية قاعدة البيانات المحلية غير موجودة." }

  Write-Host "تصدير بيانات public من المصدر..." -ForegroundColor Cyan
  docker run --rm `
    -v "${BackupDirectory}:/backup" `
    postgres:15 `
    pg_dump --dbname=$SourceDatabaseUrl --format=custom --no-owner --no-privileges --schema=public --file="/backup/$dumpName" | Out-Host
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dumpPath)) {
    throw "فشل تصدير قاعدة PostgreSQL السحابية. استخدم رابط اتصال PostgreSQL وليس رابط REST."
  }

  Write-Host "نسخ ملف التصدير إلى الحاوية المحلية..." -ForegroundColor Cyan
  docker cp $dumpPath "${dbContainer}:$containerDumpPath" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "تعذر نسخ ملف التصدير إلى الحاوية المحلية." }

  Write-Host "استيراد البيانات إلى PostgreSQL المحلية..." -ForegroundColor Cyan
  docker compose exec -T db pg_restore `
    --data-only `
    --disable-triggers `
    --no-owner `
    --no-privileges `
    --exit-on-error `
    -U postgres `
    -d postgres `
    $containerDumpPath | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "فشل الاستيراد. يفضّل استخدام قاعدة محلية فارغة أو volume جديد قبل إعادة المحاولة."
  }

  docker compose exec -T db rm -f $containerDumpPath | Out-Host
  Write-Host "تم نقل بيانات public بنجاح." -ForegroundColor Green
  Write-Host "ملف النسخة محفوظ في: $dumpPath" -ForegroundColor DarkGray
  Write-Host "ملاحظة: حسابات auth والمرفقات في storage لا تنتقل بهذا السكربت." -ForegroundColor Yellow
}
finally {
  Pop-Location
}