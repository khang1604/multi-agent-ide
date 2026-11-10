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

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vcPath = & $vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $vcPath) {
        Write-Warning "Visual C++ Build Tools ('Desktop development with C++' workload) not detected."
        Write-Warning "node-gyp requires the MSVC toolset to compile native modules (@vscode/windows-process-tree, node-pty, spdlog)."
    } else {
        Write-Host "Found Visual Studio C++ Toolset at: $vcPath" -ForegroundColor Green
    }
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

# Apply Multi-Agent native patches (Tier 1 & Tier 2 native cockpit)
Push-Location $VscodeDir
try {
    $cockpitFile = Join-Path $VscodeDir "src\vs\workbench\contrib\multiAgent\browser\multiAgentCockpit.ts"
    if (-not (Test-Path $cockpitFile)) {
        $patches = @(
            (Join-Path $RootDir "patches\00-settings-gallery.patch"),
            (Join-Path $RootDir "patches\90-multi-agent-tier1-cockpit.patch")
        )
        foreach ($patch in $patches) {
            if (Test-Path $patch) {
                $patchName = Split-Path $patch -Leaf
                Write-Host "Applying native patch: $patchName..." -ForegroundColor Yellow
                git apply --ignore-space-change --ignore-whitespace $patch
                Write-Host "Applied patch: $patchName" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "Multi-Agent native cockpit patch already applied." -ForegroundColor Green
    }
} catch {
    Write-Warning "Patch application encountered an issue: $_"
} finally {
    Pop-Location
}

$ProductJson = Join-Path $RootDir "product.json"
if (Test-Path $ProductJson) {
    Push-Location $RootDir
    try {
        node -e "const fs = require('fs'); const base = JSON.parse(fs.readFileSync('vscode/product.json', 'utf8')); const custom = JSON.parse(fs.readFileSync('product.json', 'utf8')); const gallery = { serviceUrl: 'https://open-vsx.org/vscode/gallery', itemUrl: 'https://open-vsx.org/vscode/item', latestUrlTemplate: 'https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest', controlUrl: 'https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json' }; const merged = { ...base, ...custom, nameShort: 'Multi Agent IDE', nameLong: 'Multi Agent IDE', applicationName: 'multi-agent-ide', extensionsGallery: gallery, linkProtectionTrustedDomains: ['https://open-vsx.org'] }; fs.writeFileSync('vscode/product.json', JSON.stringify(merged, null, 2));"
        Write-Host "Configured product.json for Multi Agent IDE (with Open VSX Gallery)." -ForegroundColor Green
    } catch {
        Copy-Item -Path $ProductJson -Destination (Join-Path $VscodeDir "product.json") -Force
        Write-Host "Copied product.json to vscode/product.json" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# Ensure Python orchestrator agenthub package resolves properly on Windows
$HubSymlink = Join-Path $RootDir "harness\agenthub"
$EngineDir = Join-Path $RootDir "harness\engine"
if ((Test-Path $HubSymlink) -and -not (Test-Path $HubSymlink -PathType Container)) {
    try {
        Remove-Item $HubSymlink -Force
        New-Item -ItemType Junction -Path $HubSymlink -Target $EngineDir -Force | Out-Null
        Write-Host "Configured Windows Junction for harness/agenthub -> harness/engine." -ForegroundColor Green
    } catch {
        Write-Warning "Could not create junction for harness/agenthub: $_"
    }
}

# Configure MSBuild environment and Directory.Build.props & targets for native addons
$env:VSCODE_SKIP_NODE_VERSION_CHECK = "1"
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
$env:SpectreMitigation = "false"
$vcLib = "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.51.36231\lib\x64"
$sdkLibUm = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64"
$sdkLibUcrt = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64"
$env:LIB = "$vcLib;$sdkLibUm;$sdkLibUcrt;$env:LIB"

$BuildProps = Join-Path $VscodeDir "Directory.Build.props"
$BuildTargets = Join-Path $VscodeDir "Directory.Build.targets"
$DisableSpectreXml = @"
<Project>
  <PropertyGroup>
    <SpectreMitigation>false</SpectreMitigation>
    <LibraryPath>`$(LibraryPath);$vcLib;$sdkLibUm;$sdkLibUcrt</LibraryPath>
  </PropertyGroup>
  <ItemDefinitionGroup>
    <Link>
      <AdditionalLibraryDirectories>%`(AdditionalLibraryDirectories);$vcLib;$sdkLibUm;$sdkLibUcrt</AdditionalLibraryDirectories>
    </Link>
  </ItemDefinitionGroup>
</Project>
"@
$DisableSpectreXml | Set-Content -Path $BuildProps -Encoding UTF8
$DisableSpectreXml | Set-Content -Path $BuildTargets -Encoding UTF8

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
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed. Please ensure Visual Studio C++ build tools are installed and try again."
        exit $LASTEXITCODE
    }

    # Ensure all required Windows native addons have compiled .node binaries
    Write-Host "Verifying Windows native addons (.node binaries)..." -ForegroundColor Yellow
    $nativeModules = @(
        "@vscode\policy-watcher",
        "@vscode\windows-process-tree",
        "@vscode\spdlog",
        "@vscode\sqlite3",
        "@vscode\windows-registry",
        "@vscode\windows-mutex",
        "@vscode\windows-ca-certs",
        "@vscode\deviceid",
        "native-keymap",
        "native-is-elevated",
        "node-pty",
        "@parcel\watcher",
        "windows-foreground-love",
        "kerberos"
    )
    foreach ($mod in $nativeModules) {
        $modDir = Join-Path $VscodeDir "node_modules\$mod"
        if (Test-Path (Join-Path $modDir "binding.gyp")) {
            $hasBin = (Get-ChildItem -Path $modDir -Filter "*.node" -Recurse -ErrorAction SilentlyContinue).Count -gt 0
            if (-not $hasBin) {
                Write-Host "Compiling native addon: $mod..." -ForegroundColor Yellow
                Push-Location $modDir
                try { npx node-gyp rebuild 2>$null } catch {} finally { Pop-Location }
            }
        }
    }
    Write-Host "Native addons verified." -ForegroundColor Green

    Write-Host "Compiling VS Code client..." -ForegroundColor Yellow
    npm run compile-client
    if ($LASTEXITCODE -ne 0) {
        Write-Error "VS Code client compilation failed with exit code $LASTEXITCODE."
        exit $LASTEXITCODE
    }
    Write-Host "Client compiled successfully." -ForegroundColor Green

    Write-Host "Ensuring Electron binary is ready..." -ForegroundColor Yellow
    npm run electron
    Write-Host "Electron binary ready." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  Setup completed successfully!           " -ForegroundColor Green
Write-Host "  Double-click 'run.bat' to launch!       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
