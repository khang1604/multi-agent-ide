# Multi-Agent IDE - Windows Setup Script
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot
$VscodeDir = Join-Path $RootDir "vscode"
$TargetCommit = "e646868227c3e3a9e3f24277c8c7220be42c0be7"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Multi-Agent IDE - Windows Setup        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in PATH. Please install Git for Windows: https://git-scm.com/"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js (v20 or v22): https://nodejs.org/"
    exit 1
}

$nodeVer = node -v
Write-Host "Found Node.js: $nodeVer" -ForegroundColor Green
Write-Host "Found Git: $(git --version)" -ForegroundColor Green

# 2. Clone / Fetch VS Code base commit if missing
if (-not (Test-Path $VscodeDir)) {
    Write-Host "`n[2/5] Fetching VS Code base ($TargetCommit)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $VscodeDir -Force | Out-Null
    Push-Location $VscodeDir
    try {
        git init -q
        git remote add origin https://github.com/microsoft/vscode.git
        git fetch --depth 1 origin $TargetCommit
        git checkout FETCH_HEAD
        Write-Host "VS Code source fetched successfully." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[2/5] VS Code directory already exists at $VscodeDir." -ForegroundColor Green
}

# 3. Synchronize Multi-Agent source and assets
Write-Host "`n[3/5] Injecting Multi-Agent components into vscode/..." -ForegroundColor Yellow
$SrcDir = Join-Path $RootDir "src\stable"
if (Test-Path $SrcDir) {
    Copy-Item -Path "$SrcDir\*" -Destination $VscodeDir -Recurse -Force
    Write-Host "Overlaid src/stable onto vscode/" -ForegroundColor Green
}

$ProductJson = Join-Path $RootDir "product.json"
if (Test-Path $ProductJson) {
    Push-Location $RootDir
    try {
        node -e "const fs = require('fs'); const base = JSON.parse(fs.readFileSync('vscode/product.json', 'utf8')); const custom = JSON.parse(fs.readFileSync('product.json', 'utf8')); const merged = { ...base, ...custom, nameShort: 'Multi Agent IDE', nameLong: 'Multi Agent IDE', applicationName: 'multi-agent-ide' }; fs.writeFileSync('vscode/product.json', JSON.stringify(merged, null, 2));"
        Write-Host "Configured product.json for Multi Agent IDE." -ForegroundColor Green
    } catch {
        Copy-Item -Path $ProductJson -Destination (Join-Path $VscodeDir "product.json") -Force
        Write-Host "Copied product.json to vscode/product.json" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# 4. Install dependencies & compile extension
Write-Host "`n[4/5] Installing dependencies and compiling Multi-Agent extension..." -ForegroundColor Yellow
$ExtensionDir = Join-Path $VscodeDir "extensions\multi-agent-harness"
if (Test-Path $ExtensionDir) {
    Push-Location $ExtensionDir
    try {
        npm install
        npm run compile
        Write-Host "Multi-Agent extension compiled successfully." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# 5. Prepare VS Code dev build
Write-Host "`n[5/5] Installing VS Code dependencies & compiling client..." -ForegroundColor Yellow
Push-Location $VscodeDir
try {
    npm install
    Write-Host "Compiling VS Code client..." -ForegroundColor Yellow
    npm run compile-client
    Write-Host "Client compiled successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  Setup completed successfully!           " -ForegroundColor Green
Write-Host "  Double-click 'run.bat' to launch!       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
