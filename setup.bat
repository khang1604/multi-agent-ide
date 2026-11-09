@echo off
setlocal
title Multi-Agent IDE - Windows Setup

echo ========================================================
echo   Starting Multi-Agent IDE Setup for Windows...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Setup encountered an error. Please see the output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Press any key to finish setup...
pause >nul
