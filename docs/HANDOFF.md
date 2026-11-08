# MULTI AGENT IDE - PROJECT HANDOFF & MASTER CONTINUATION GUIDE

> **Last Updated:** 2026-11-08  
> **Repository Path:** `/home/nguyenkhang/Project/multi-agent-ide`  
> **Target Binary:** `/home/nguyenkhang/Project/multi-agent-ide/vscode/.build/electron/multi-agent-ide`  
> **Runtime Runner:** `/home/nguyenkhang/Project/multi-agent-ide/run.sh`  
> **Branch:** `feat/multi-agent-ide`

---

## 1. Executive Summary & Core Mission
**Multi Agent IDE** is a dedicated, Agent-First IDE forked from open-source VS Code (VSCodium / Code-OSS v1.143.1). It is engineered to deliver a native multi-agent pair-programming experience similar to Google DeepMind Antigravity IDE, Cursor, and Windsurf, but with native support for multi-model swarms (Claude Architect, o3-mini Worker, Gemini Auditor).

All core intelligence, orchestration engines, research blueprints, and guardrails from the predecessor project `mahub` have been consolidated directly into this repository.

---

## 2. Consolidated Core Brain Architecture
The entire brain has been migrated into the following repository structure:

```
multi-agent-ide/
├── ai/                                    # Constitution, Security & Agent Guardrails
│   ├── GLOBAL_RULES.md                    # Data hygiene, zero credentials, boundary rules
│   ├── SECURITY.md                        # AppSec invariants, injection defense, audit logs
│   ├── AGENTS.md                          # Repository maintenance conventions
│   └── ANTIGRAVITY_PROMPT.md              # System prompt specification for agent orchestrator
├── docs/
│   ├── PROGRESS.md                        # Development status, lessons, active tasks
│   └── architecture/                      # Complete 15 Architectural Specifications
│       ├── 01_orchestrator_vision_and_core_concepts.md
│       ├── 02_competitive_analysis_and_benchmarks.md
│       ├── 03_agent_specialization_matrix.md
│       ├── 04_notebooklm_research_guide.md
│       ├── 05_multi_agent_ide_ui_foundations.md
│       ├── 06_mahub_ide_ui_blueprint.md
│       ├── 07_open_source_orchestration_deep_dive.md
│       ├── 08_orchestration_mechanisms_and_license_matrix.md
│       ├── 09_ipc_protocol_and_data_contracts.md
│       ├── 10_context_compaction_and_token_management.md
│       ├── 11_security_threat_model_and_appsec_guardrails.md
│       ├── 12_resilience_evaluation_and_conflict_resolution.md
│       ├── 13_mahub_killer_features_proposal.md
│       ├── 14_ui_installation_and_os_support_blueprint.md
│       └── 15_pre_mortem_edge_cases_and_engineering_pitfalls.md
├── harness/                               # Python Swarm Orchestrator Engine & CLI
│   ├── engine/                            # Python agenthub orchestration engine (33 modules)
│   │   ├── engine.py                      # Task execution pipeline & circuit breaker
│   │   ├── service.py                     # Background daemon service
│   │   ├── workspace.py                   # Git worktree isolation & lease management
│   │   ├── adapters.py                    # Provider CLI adapter (Claude, Codex, Antigravity)
│   │   ├── mcp.py                         # Native Model Context Protocol (MCP) server
│   │   └── lifecycle.py                   # State machine & transition safety
│   ├── cli/                               # CLI interfaces (ma, hub)
│   ├── config.default.json                # Default swarm priority & timeout config
│   ├── integrations/vscode-chat/          # VS Code chat bridge adapter
│   ├── scripts/                           # System service & autostart scripts
│   └── tests/                             # Engine unit & acceptance test suites
├── src/stable/extensions/                 # Core Built-in Extensions
│   └── multi-agent-harness/               # Built-in Native Extension
│       ├── src/worktree/WorktreeManager.ts   # Git worktree manager (.local/worktrees/<task-id>/)
│       ├── src/diff/DiffProvider.ts          # Virtual diff staging provider (agent-diff://)
│       ├── src/artifacts/ArtifactManager.ts  # Living plan frontmatter parser
│       └── src/views/SwarmControlProvider.ts # Sidebar Webview UI
├── vscode/                                # VS Code Core Source Tree (v1.143.1)
│   ├── out/                               # Compiled Workbench bundles (0 errors)
│   └── .build/electron/multi-agent-ide    # Prebuilt Electron desktop executable
└── run.sh                                 # Standalone detached runner (setsid -f)
```

---

## 3. Current Technical State & Verified Milestones
1. **Source Code Pruning:**
   * Removed Microsoft proprietary stores (`stores/snapcraft`, `stores/winget`), MS documentation, and telemetry hooks.
   * Hardened `product.json` with `enableTelemetry: false`, Open VSX Registry (`https://open-vsx.org/vscode/gallery`).
2. **Build Toolchain:**
   * Node v24 installed standalone at `~/.local/node24/bin`.
   * Workbench compilation (`npm run compile-client`) verified with **0 errors**.
3. **Desktop Execution:**
   * `run.sh` launches the Electron application cleanly in background using `setsid -f`.
   * Environment variable `ELECTRON_RUN_AS_NODE` is automatically unset.
   * Tested and verified running under Wayland and X11 display servers.
4. **Built-in Extension:**
   * `multiagentide.multi-agent-harness` is registered as a built-in extension in `vscode/extensions/`.
   * Activity Bar icon and Webviews (`swarmControlView`, `artifactsView`, `worktreeView`) render properly.

---

## 4. Next Engineering Objectives (Roadmap)
1. **Tầng 1 (Cockpit Layout):**
   * Can thiệp vào `vscode/src/vs/workbench/browser/layout.ts` để khi mở IDE, tự động chia bố cục 3 cột mặc định: Plan Markdown viewer (trái), Continuous Multi-Diff (giữa), Swarm Webview (phải).
2. **Tầng 2 (Native Continuous Multi-Diff):**
   * Liên kết trực tiếp virtual document provider vào widget `multiDiffEditor` của VS Code để người dùng có thể duyệt toàn bộ diff do agent tạo ra trong 1 màn hình.
3. **Tầng 3 (PTY Token Compaction Engine):**
   * Can thiệp vào `vscode/src/vs/platform/terminal/node/ptyHost.ts` để lọc log rác, giảm 80% token tiêu thụ khi Agent đọc kết quả terminal.
4. **Tầng 4 (Built-in MCP Server on Unix Domain Socket):**
   * Binary IDE tự động mở socket tại `/tmp/multi-agent-ide.sock` cung cấp công cụ điều khiển giao diện cho các agent CLI bên ngoài.

---

## 5. Master Handoff Prompts (Dành cho Agent Tiếp Quản)

### Prompt Bàn Giao Tiếng Việt (Vietnamese Handoff Prompt)
*Sao chép đoạn bên dưới gửi cho bất kỳ Agent nào (Antigravity, Claude Code, Gemini CLI, Cursor) để tiếp tục phát triển:*

```text
Bạn là Agentic AI Software Engineer tiếp quản phát triển dự án "Multi Agent IDE" tại:
/home/nguyenkhang/Project/multi-agent-ide

Dự án này là một Agent-First IDE được fork và cắt gọt từ VS Code (Code-OSS 1.143.1 / VSCodium), loại bỏ hoàn toàn Microsoft Telemetry, tích hợp sâu kiến trúc đa tác tử (Claude Architect, o3-mini Worker, Gemini Auditor).

Vui lòng đọc kỹ:
1. docs/HANDOFF.md (Tổng quan tiến độ & vị trí mã nguồn)
2. docs/PROGRESS.md (Nhật ký phát triển gần nhất)
3. docs/architecture/ (15 tài liệu thiết kế kiến trúc đa tác tử)
4. ai/GLOBAL_RULES.md và ai/SECURITY.md (Quy tắc bảo mật & phân vùng làm việc)

Trạng thái hiện tại:
- Lõi VS Code đã compile thành công vào vscode/out/ (0 errors).
- Built-in extension nằm tại src/stable/extensions/multi-agent-harness/ (và vscode/extensions/multi-agent-harness/).
- Khởi chạy IDE bằng script: ./run.sh [đường_dẫn_project] (Node 24 tại ~/.local/node24/bin, binary tại vscode/.build/electron/multi-agent-ide).
- Toàn bộ bộ não điều phối Python nằm tại harness/engine/ (agenthub).

Nhiệm vụ tiếp theo:
Triển khai Tầng 1: Tích hợp sâu vào VS Code Workbench Layout (vscode/src/vs/workbench/browser/layout.ts) để khi mở IDE, tự động thiết lập Cockpit Layout 3 cột: Cột 1 xem Living PLAN.md, Cột 2 xem Continuous Multi-Diff Staging, Cột 3 là Swarm Activity Stream.
Hãy bắt đầu phân tích mã nguồn layout và đề xuất giải pháp cụ thể.
```

### English Handoff Prompt (For English Coding Agents)
*Copy this prompt for English-native coding agents:*

```text
You are an expert systems engineer taking over development of "Multi Agent IDE" at:
/home/nguyenkhang/Project/multi-agent-ide

This project is an Agent-First IDE forked and pruned from VS Code (Code-OSS 1.143.1 / VSCodium). All telemetry is removed, and a multi-agent orchestration harness (Claude Architect, o3-mini Worker, Gemini Auditor) is being natively integrated into the workbench core.

Key files to review:
1. docs/HANDOFF.md (Project orientation and structure)
2. docs/PROGRESS.md (Current status and lessons learned)
3. docs/architecture/ (15 detailed multi-agent specifications)
4. ai/GLOBAL_RULES.md & ai/SECURITY.md (Security constraints and coding guidelines)

Current State:
- VS Code client compiled in vscode/out/ with 0 errors.
- Built-in extension resides in src/stable/extensions/multi-agent-harness/ and vscode/extensions/multi-agent-harness/.
- Launcher available at ./run.sh [path] (Node v24 in ~/.local/node24/bin, binary in vscode/.build/electron/multi-agent-ide).
- Python orchestration engine consolidated into harness/engine/ (agenthub).

Next Immediate Task:
Implement Tier 1 Native Workbench Cockpit: Modify VS Code layout (vscode/src/vs/workbench/browser/layout.ts) to establish a 3-column Agent Cockpit: Column 1 = Living PLAN.md viewer, Column 2 = Continuous Multi-Diff staging, Column 3 = Swarm Control stream.
Begin by analyzing the layout engine and proposing surgical changes.
```

