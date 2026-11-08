# Technical Specification 14: UI Layout, Packaging, Installation & Cross-Platform Blueprint

## 1. Executive Summary

This specification defines the cross-platform distribution model, installer packaging pipeline, runtime prerequisite management, UI theming architecture, and panel layout strategy for **MAHub IDE**.

The design guarantees zero-friction onboarding: developers on **Linux, macOS, and Windows Native** can install and launch MAHub with a single click without manually configuring Python virtual environments or runtime dependencies.

---

## 2. Core Decisions Matrix (Grill-Me Grounding)

| Domain | Selected Decision | Key Architectural Impact |
| :--- | :--- | :--- |
| **Supported OS** | **Tier-1 Full Cross-Platform (Linux, macOS, Windows Native)** | Native Win32/PowerShell support without requiring WSL2; path normalization via `pathlib.Path`; platform-safe file locking. |
| **Packaging & Install** | **Self-Contained Embedded Runtime Installers** | Bundles `python-build-standalone` (Python 3.11+); pre-built packages for `.exe`/`.msi` (Windows), `.dmg` (macOS Universal), `.AppImage`/`.deb` (Linux). |
| **UI Aesthetics** | **Native Adaptive Theme Engine (100% VS Code Tokens)** | Binds strictly to `var(--vscode-*)` CSS custom properties; automatically conforms to any active theme (Dark+, Monokai, Dracula, Light+). |
| **Onboarding** | **Interactive 3-Step Setup Wizard Tab** | First-run welcome tab: (1) System health & local Ollama discovery $\rightarrow$ (2) Secure key storage in OS Keyring $\rightarrow$ (3) Cost profile selection. |
| **Panel Placement** | **Flexible Dual-Zone Layout** | **Secondary Sidebar**: Real-time Swimlanes, Live HUD, Chat, Quick Tasks.<br>**Main Editor Canvas Tab**: Full-screen `@xyflow/react` DAG visualization with zoom/pan. |

---

## 3. Cross-Platform Runtime & Packaging Architecture

```
+-----------------------------------------------------------------------------------+
| MAHub Cross-Platform Packaging Pipeline                                           |
|                                                                                   |
|  [Source Code]                                                                    |
|  - Python Core Engine (agenthub, cli)                                              |
|  - Webview Bundle (React 18 + Tailwind + @xyflow/react)                           |
|  - Embedded Python Runtime (python-build-standalone 3.11+)                        |
|                                                                                   |
|                                         |                                         |
|                 +-----------------------+-----------------------+                 |
|                 |                       |                       |                 |
|                 v                       v                       v                 |
|          [Windows Native]           [macOS]                 [Linux]               |
|          - Format: .exe / .msi      - Format: .dmg          - Format: .AppImage   |
|            & Portable .zip            (Universal Binary)      & .deb package      |
|          - PowerShell / Win32       - Apple Silicon (M1-M4) - Ubuntu, Debian,     |
|            detached process           & Intel x86_64          Fedora, Arch        |
|          - Native Win32 FileLock    - macOS Keychain        - Linux SecretService |
|            & Path normalization       Credential Vault        & Keyring Vault     |
+-----------------------------------------------------------------------------------+
```

---

## 4. Platform-Specific Implementation Rules

### 4.1 Windows Native Safeguards
- **File Locking**: Replaces Unix `fcntl.flock` with Windows `msvcrt.locking` or named kernel mutexes (`platforms.py`).
- **Path Normalization**: All file system operations internally standardize on POSIX forward slashes `/` via `Path.as_posix()`, converting to Windows backslashes `\` only when passing commands to `cmd.exe` or `powershell.exe`.
- **Subprocess Spawning**: Background daemon processes pass `creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS` to prevent persistent command prompt popups.
- **Git Worktree Path Bounds**: Avoids Windows `MAX_PATH` (260 characters) limitations by prefixing absolute worktree paths with `\\?\` or maintaining shallow worktree directories (`.local/wt/<id>`).

### 4.2 macOS Universal Architecture
- **Code Signing & Notarization**: Binaries built for `darwin-arm64` and `darwin-x64` lipo-stitched into a Universal Binary; signed with Apple Developer ID.
- **Secure Key Storage**: Direct integration with macOS Keychain Services via `keyring.backends.macOS.Keyring`.

### 4.3 Linux Packaging & Distribution
- **AppImage**: Bundles all glibc shared objects and Python shared libraries into a portable single-binary execution image.
- **Debian Package (`.deb`)**: Configures desktop entry `/usr/share/applications/mahub.desktop` and installs CLI symlinks into `/usr/local/bin/ma`.

---

## 5. UI Layout & Dual-Zone Component Specs

```
+-----------------------------------------------------------------------------------+
| MAHub IDE Host Window (Adaptive Theme)                                            |
|                                                                                   |
|  +--------------------+  +----------------------------+  +---------------------+  |
|  | Primary Sidebar    |  | Main Editor Area           |  | Secondary Sidebar   |  |
|  |                    |  |                            |  |                     |  |
|  | - File Explorer    |  | [Tab 1: src/auth.ts]       |  | [Swarm Header]      |  |
|  | - Source Control   |  | [Tab 2: MAHub Canvas (DAG)]|  | - Project: mahub    |  |
|  | - Open VSX Exts    |  |                            |  | - Autopilot: [ON]   |  |
|  |                    |  |   ( )---> ( )---> ( )      |  |                     |  |
|  |                    |  |    Task DAG with @xyflow   |  | [Agent Swimlanes]   |  |
|  |                    |  |    Zoom / Pan Controls     |  | - Architect: Ready  |  |
|  |                    |  |                            |  | - Coder: 48 tok/s   |  |
|  |                    |  |                            |  | - Auditor: Passing  |  |
|  |                    |  |                            |  |                     |  |
|  |                    |  |                            |  | [HUD & Chat Input]  |  |
|  |                    |  |                            |  | - Cost: $0.14 / $1.5|  |
|  |                    |  |                            |  | - [Input Message]   |  |
|  +--------------------+  +----------------------------+  +---------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  | Status Bar: Active Worktree [wt: task-102] | Saved via RouteLLM: $14.20     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 5.1 CSS Custom Properties Binding (Adaptive Theme)
All React webview styles in `frontend/ide-extension` utilize native CSS custom properties:

```css
/* Automatically inherited from VS Code Host */
.mahub-container {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
}

.mahub-card {
  background-color: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-widget-border, var(--vscode-sideBarSectionHeader-border));
}

.mahub-button-primary {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.mahub-button-primary:hover {
  background-color: var(--vscode-button-hoverBackground);
}
```

---

## 6. Interactive 3-Step Onboarding Flow

1. **Step 1: Environment Health Check**
   - Automatically probes for `git`, `python`, `node`.
   - Probes `http://127.0.0.1:11434` to detect if Ollama is running and lists local models.
2. **Step 2: Credential & Privacy Setup**
   - Developer inputs Anthropic, OpenAI, or Google Gemini API keys, or toggles **"Air-Gapped Local Mode"**.
   - Keys are immediately written into the OS Keyring and tested with a 1-token dry run.
3. **Step 3: Cost Profile Selection**
   - **Balanced (Default)**: RouteLLM cascades between Gemini 2.0 Flash / DeepSeek V3 and Claude 3.7.
   - **Performance Tier**: Claude 3.7 Sonnet / Opus + OpenAI o3-mini on all tasks.
   - **Offline Privacy Tier**: DeepSeek R1 + Qwen2.5-Coder via local Ollama.
