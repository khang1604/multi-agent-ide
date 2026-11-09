# Multi-Agent IDE - PowerShell Launcher
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Target = ""
)

$RootDir = $PSScriptRoot
$VscodeDir = Join-Path $RootDir "vscode"

if (-not (Test-Path $VscodeDir)) {
    Write-Error "The 'vscode' directory was not found. Please run '.\setup.ps1' (or setup.bat) first."
    exit 1
}

if (-not $Target) {
    $Target = $RootDir
}

Write-Host "Launching Multi-Agent IDE on: $Target..." -ForegroundColor Cyan
Push-Location $VscodeDir
try {
    cmd.exe /c "scripts\code.bat `"$Target`""
} finally {
    Pop-Location
}
