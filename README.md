# Multi Agent IDE

<div align="center">
  <h3>The Agent-First Multi-Agent Development Environment</h3>
  <p>Forked and hardened from VS Code (Code-OSS 1.143.1 / VSCodium) with zero Microsoft telemetry, Open VSX Registry, and native multi-model swarm coordination.</p>
</div>

---

## 1. Architectural Highlights

**Multi Agent IDE** bridges the gap between traditional single-agent chat extensions and autonomous multi-agent engineering teams (Claude Architect, o3-mini Worker, Gemini Auditor):

- **Tier 1 (Cockpit Layout):** Native 3-column workbench: Column 1 = Living `PLAN.md`, Column 2 = Continuous Multi-Diff Staging, Column 3 = Swarm Activity Stream.
- **Tier 2 (Continuous Multi-Diff):** Seamless virtual document provider integrated into VS Code's native `MultiDiffEditor` widget across isolated worktrees.
- **Tier 3 (PTY Token Compaction):** Real-time terminal output compression reducing LLM context token consumption by up to 80%.
- **Tier 4 (Built-in MCP Server):** Background Unix Domain Socket (`/tmp/multi-agent-ide.sock`) exposing IDE UI controls to external terminal agents.
- **Git Worktree Isolation:** Autonomous agent modifications occur inside detached Git worktrees (`.local/worktrees/<task-id>/`), leaving your working tree untouched until accepted.

---

## 2. Repository Layout & Developer Navigation

| Directory | Layer | Description |
| :--- | :--- | :--- |
| [`ai/`](ai/) | **Constitution & Security** | Security invariants (`GLOBAL_RULES.md`, `SECURITY.md`, `AGENTS.md`). |
| [`docs/`](docs/) | **Documentation & Blueprints** | 15 architectural specs, progress logs, master handoff, and code map. |
| [`docs/ARCHITECTURE_MAP.md`](docs/ARCHITECTURE_MAP.md) | **Code Traceability GPS** | **Primary index mapping features $\rightarrow$ architecture specs $\rightarrow$ source files.** |
| [`harness/`](harness/) | **Swarm Orchestrator Engine** | Python 3.11+ swarm engine (task pipeline, circuit breaker, CLI). |
| [`src/stable/extensions/`](src/stable/extensions/) | **Built-in Extensions** | `multi-agent-harness` extension (symlinked to `vscode/extensions/`). |
| [`vscode/`](vscode/) | **VS Code Core Engine** | Compiled Code-OSS 1.143.1 workbench client (`vscode/out/`). |
| [`patches/`](patches/) | **Core Patches** | Modular patches for branding, telemetry stripping, and core tweaks. |
| [`run.sh`](run.sh) | **Standalone Runner** | Detached background desktop application runner. |

---

## 3. Quick Start & Execution

### Launch Desktop IDE
```bash
# Launch on current repository
./run.sh .

# Launch on a target project workspace
./run.sh /path/to/project
```

### Compile Workbench Client
```bash
export PATH="$HOME/.local/node24/bin:$PATH"
cd vscode
npm run compile-client
```

### Compile Multi-Agent Built-in Extension
```bash
cd src/stable/extensions/multi-agent-harness
npm run compile
```

---

## 4. Maintenance & Upstream Rebase Protocol

To preserve long-term maintainability when upgrading Code-OSS or VSCodium upstream:
1. **Core Tagging Standard:** All custom logic in `vscode/src/` is tagged with `// [MULTI-AGENT-IDE] ... // [/MULTI-AGENT-IDE]`.
2. **Patch Extraction:** Custom modifications to core are exported into `patches/` (e.g. `patches/90-multi-agent-tier1-cockpit.patch`).
3. **Single Extension Source:** Always edit in `src/stable/extensions/multi-agent-harness/`; the `vscode/extensions/` path is a symbolic link.
4. **Knowledge Graph Sync:** Run `graphify update .` after significant code modifications to keep `graphify-out/graph.json` synchronized.

---

## 5. Master Documentation Links
- [**Architecture & Code Traceability Map**](docs/ARCHITECTURE_MAP.md)
- [**Project Handoff Guide**](docs/HANDOFF.md)
- [**Development Progress Log**](docs/PROGRESS.md)
- [**15 Architectural Specifications**](docs/architecture/)
- [**Security & Global Rules**](ai/GLOBAL_RULES.md)
