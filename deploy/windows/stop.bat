@echo off
chcp 65001 >nul
title إيقاف نظام الموارد البشرية
cd /d "%~dp0.."

echo.
echo ===== إيقاف نظام الموارد البشرية =====
echo البيانات محفوظة ولن تُحذف.
echo.

docker compose stop
echo.
echo تم الإيقاف.
pause
