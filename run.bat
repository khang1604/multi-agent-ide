@echo off
setlocal
title Multi-Agent IDE

set "DIR=%~dp0"
set "APP_ROOT=%DIR%vscode"

if not exist "%APP_ROOT%" (
    echo [ERROR] The 'vscode' directory was not found.
    echo Please run 'setup.bat' first to download and prepare the Multi-Agent IDE.
    echo.
    pause
    exit /b 1
)

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=%DIR%"

echo Launching Multi-Agent IDE on: %TARGET%...
cd /d "%APP_ROOT%"
call scripts\code.bat "%TARGET%" %*
