# Multi Agent IDE — Master Architecture & Code Traceability Map

> **Purpose:** This document is the primary GPS for engineers and AI agents working on Multi Agent IDE. It maps every core feature, architectural requirement, and design specification directly to its implementation files, upstream patches, and verification commands.

---

## 1. System Layer Overview

```
+-----------------------------------------------------------------------------------------+
|                                    MULTI AGENT IDE                                      |
+-----------------------------------------------------------------------------------------+
|  Layer 5: AI Constitution & Rules        | ai/GLOBAL_RULES.md, ai/SECURITY.md, ai/AGENTS|
+------------------------------------------+----------------------------------------------+
|  Layer 4: Architecture & Progress Hub    | docs/architecture/ (15 specs), docs/PROGRESS|
+------------------------------------------+----------------------------------------------+
|  Layer 3: Swarm Orchestration Engine     | harness/engine/ (Python 3.11+, agenthub)     |
+------------------------------------------+----------------------------------------------+
|  Layer 2: Built-in Native Extension      | src/stable/extensions/multi-agent-harness/   |
|                                          | (Symlinked to vscode/extensions/)            |
+------------------------------------------+----------------------------------------------+
|  Layer 1: Core Workbench Customizations  | vscode/src/vs/workbench/browser/layout.ts    |
|                                          | patches/ (VSCodium & Custom Core Patches)    |
+------------------------------------------+----------------------------------------------+
|  Layer 0: Host Binary & Runner           | vscode/.build/electron/multi-agent-ide       |
|                                          | run.sh, build.sh, prepare_vscode.sh          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Feature & Code Traceability Matrix

| Tier / Feature | Description | Architecture Spec | Primary Implementation Files | Upstream Patch / Ext Target | Verification Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Cockpit Layout** | Auto 3-column workbench on startup: Column 1 = `PLAN.md`, Column 2 = Continuous Multi-Diff, Column 3 = Swarm Stream. | [`05_ui_foundations.md`](architecture/05_multi_agent_ide_ui_foundations.md)<br>[`06_ui_blueprint.md`](architecture/06_mahub_ide_ui_blueprint.md) | • `vscode/src/vs/workbench/browser/layout.ts`<br>• `src/stable/extensions/multi-agent-harness/src/extension.ts` | `patches/90-multi-agent-tier1-cockpit.patch` | `cd vscode && npm run compile-client`<br>`./run.sh` |
| **Tier 2: Continuous Multi-Diff** | Virtual diff staging provider connected to native VS Code `MultiDiffEditor`. | [`06_ui_blueprint.md`](architecture/06_mahub_ide_ui_blueprint.md)<br>[`13_killer_features.md`](architecture/13_mahub_killer_features_proposal.md) | • `src/stable/extensions/multi-agent-harness/src/diff/DiffProvider.ts`<br>• `vscode/src/vs/workbench/contrib/multiDiffEditor/` | `src/stable/extensions/multi-agent-harness` | `cd src/stable/extensions/multi-agent-harness && npm run compile` |
| **Tier 3: PTY Token Compaction** | Strip terminal noise & compact output by 80% before LLM reads. | [`10_context_compaction.md`](architecture/10_context_compaction_and_token_management.md) | • `vscode/src/vs/platform/terminal/node/ptyHost.ts`<br>• `harness/engine/adapters.py` | `patches/91-pty-token-compaction.patch` | `cd vscode && npm run compile-client` |
| **Tier 4: Built-in MCP Server** | Background Unix domain socket server (`/tmp/multi-agent-ide.sock`) for external agent CLI UI control. | [`09_ipc_protocol.md`](architecture/09_ipc_protocol_and_data_contracts.md)<br>[`13_killer_features.md`](architecture/13_mahub_killer_features_proposal.md) | • `vscode/src/vs/server/node/`<br>• `harness/engine/mcp.py` | `harness/engine/` | `python -m unittest discover harness/tests/` |
| **Swarm Orchestrator** | Multi-model dispatch (Claude Architect, o3-mini Worker, Gemini Auditor) with circuit breaker. | [`01_vision.md`](architecture/01_orchestrator_vision_and_core_concepts.md)<br>[`03_agent_matrix.md`](architecture/03_agent_specialization_matrix.md) | • `harness/engine/engine.py`<br>• `harness/engine/service.py`<br>• `harness/engine/lifecycle.py` | `harness/engine/` | `python -m unittest discover harness/tests/` |
| **Git Worktree Isolation** | Isolate agent code mutations in `.local/worktrees/<task-id>/`. | [`06_ui_blueprint.md`](architecture/06_mahub_ide_ui_blueprint.md)<br>[`12_resilience.md`](architecture/12_resilience_evaluation_and_conflict_resolution.md) | • `src/stable/extensions/multi-agent-harness/src/worktree/WorktreeManager.ts`<br>• `harness/engine/workspace.py` | `src/stable/extensions/multi-agent-harness` | `npm test` in extension dir |
| **Living Plan Manager** | Parse & synchronize living frontmatter plan artifacts. | [`01_vision.md`](architecture/01_orchestrator_vision_and_core_concepts.md)<br>[`13_killer_features.md`](architecture/13_mahub_killer_features_proposal.md) | • `src/stable/extensions/multi-agent-harness/src/artifacts/ArtifactManager.ts` | `src/stable/extensions/multi-agent-harness` | `npm test` in extension dir |
| **Swarm Control HUD** | Realtime Webview sidebar for Swarm state, task progress, and token counters. | [`06_ui_blueprint.md`](architecture/06_mahub_ide_ui_blueprint.md)<br>[`13_killer_features.md`](architecture/13_mahub_killer_features_proposal.md) | • `src/stable/extensions/multi-agent-harness/src/views/SwarmControlProvider.ts` | `src/stable/extensions/multi-agent-harness` | Manual Webview inspection |

---

## 3. Core Fork Modification Standards (For Painless Upstream Upgrades)

To ensure smooth merges and rebases when upgrading upstream Code-OSS:

1. **Tagging Rule:** All modifications inside `vscode/src/` must be wrapped in identifiable comment blocks:
   ```typescript
   // =========================================================================
   // [MULTI-AGENT-IDE] <Feature Title> (<Tier/Component>)
   // Ref: docs/architecture/<spec_file.md>
   // =========================================================================
   ... custom logic ...
   // [/MULTI-AGENT-IDE]
   ```
2. **Patch Extraction:** After verifying core modifications in `vscode/`, extract the diff into `patches/`:
   ```bash
   # Example: Exporting Tier 1 patch
   git diff vscode/src/vs/workbench/browser/layout.ts > patches/90-multi-agent-tier1-cockpit.patch
   ```
3. **Single Source of Truth for Built-in Extensions:**
   - Source resides in `src/stable/extensions/multi-agent-harness/`.
   - `vscode/extensions/multi-agent-harness` is a symbolic link to `../../src/stable/extensions/multi-agent-harness`.
   - Always run `npm run compile` inside `src/stable/extensions/multi-agent-harness/` when updating extension TypeScript code.

---

## 4. Quick Navigation Index
- **Visual Flow & Architecture Map:** [`docs/architecture/VISUAL_FLOW_MAP.md`](architecture/VISUAL_FLOW_MAP.md) — Interactive visual topology & sequence diagram for live tracing while coding.
- **Constitution & Security:** [`ai/GLOBAL_RULES.md`](../ai/GLOBAL_RULES.md) | [`ai/SECURITY.md`](../ai/SECURITY.md)
- **Handoff & Onboarding:** [`docs/HANDOFF.md`](HANDOFF.md)
- **Active Progress & Roadmap:** [`docs/PROGRESS.md`](PROGRESS.md)
- **All 15 Architecture Specs:** [`docs/architecture/`](architecture/)
- **Runner Script:** [`run.sh`](../run.sh)
- **Graphify Knowledge Graph:** [`graphify-out/GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md)

