@echo off
chcp 65001 >nul
title تشغيل نظام الموارد البشرية
cd /d "%~dp0.."

echo.
echo ===== تشغيل نظام الموارد البشرية =====
echo.

docker version >nul 2>&1
if errorlevel 1 (
  echo [خطأ] Docker Desktop غير مشغّل. شغّله وانتظر حتى يصبح جاهزاً ثم أعد المحاولة.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [خطأ] لم يتم تهيئة النظام بعد. شغّل windows\setup.ps1 أولاً.
  pause
  exit /b 1
)

docker compose up -d
if errorlevel 1 (
  echo [خطأ] فشل التشغيل. راجع الرسائل أعلاه.
  pause
  exit /b 1
)

echo.
echo تم تشغيل النظام. حالة الخدمات:
docker compose ps
echo.
for /f "tokens=2 delims==" %%a in ('findstr /b "PUBLIC_HOST" .env') do set HOST=%%a
for /f "tokens=2 delims==" %%a in ('findstr /b "APP_PORT" .env') do set APORT=%%a
echo العنوان: %HOST%:%APORT%
echo.
pause
