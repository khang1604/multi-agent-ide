# Research 05: Multi-Agent IDE Foundations & Legal/Open-Source Compliance

## 1. Executive Summary & Legal Invariants

Building a custom, open-source AI-native IDE requires strict compliance with open-source licensing, trademark laws, and marketplace distribution regulations.

### 1.1 Trademark and Brand Boundaries
- **Source Code vs. Trademark**: The source code repository `microsoft/vscode` is licensed under the permissive **MIT License**. However, the official compiled binary, the name **"Visual Studio Code"**, the official ribbons, and Microsoft logos are proprietary, registered trademarks of Microsoft Corporation.
- **Legal Invariant**: Our custom IDE must be branded independently (e.g., **MAHub Studio** or **MAHub IDE**). All references, icons, splash screens, and product metadata (`product.json`) must be cleanly re-branded.
- **Marketplace ToS Restriction**: Microsoft's Terms of Service for `marketplace.visualstudio.com` explicitly forbid access from non-official/non-Microsoft binaries. Attempting to point a custom IDE fork to the Microsoft Marketplace violates their ToS.
- **Open VSX Compliance**: Our IDE must configure `serviceUrl` and `itemUrl` in `product.json` to point exclusively to the **Eclipse Open VSX Registry** (`https://open-vsx.org/vscode/gallery`), an open-source, vendor-neutral marketplace.
- **Telemetry Stripping**: All Microsoft telemetry endpoints (`vortex.data.microsoft.com`, AppInsights) must be completely disabled, stripped, or replaced with local zero-tracking null loggers.

---

## 2. Competitive & Architectural Teardown of Base Candidates

| Platform / Repository | License | Upstream Base | Key Strengths | Key Weaknesses | Verdict for MAHub |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VSCodium** (`vscodium/vscodium`) | MIT | `microsoft/vscode` | 100% clean build scripts, automated upstream syncing, telemetry stripped, preconfigured Open VSX | Pure shell wrapper without built-in AI/Agent primitives | **Base for Phase 2 Packaging** |
| **Void** (`voideditor/void`) | Apache-2.0 | `vscodium` fork | Native AI chat & inline edits built into VS Code core, modern UI design | Heavy focus on single-agent interaction; lacking multi-agent orchestration & worktrees | **Key reference for UI integration & C++ / TypeScript patches** |
| **Eclipse Theia** (`eclipse-theia/theia`) | EPL-2.0 | Independent / Monaco | Fully modular, designed for custom IDEs from ground up, strong enterprise adoption | Heavier runtime, slower extension ecosystem sync, different architectural paradigms | Secondary alternative |
| **Cline** (`cline/cline`) | Apache-2.0 | VS Code Extension | Battle-tested tool calling, MCP client integration, diff review, file tree manipulation | Monolithic single-agent loop; no DAG graph or multi-worktree visualization | **UI reference for file editing & MCP tools** |
| **Continue** (`continuedev/continue`) | Apache-2.0 | VS Code Extension | Excellent GUI webview architecture, LLM provider routing, custom context providers | Single-thread chat panel; does not coordinate parallel multi-agent swarms | **UI reference for webview state management** |

---

## 3. The Multi-Agent IDE Dilemma

Traditional AI code assistants (Cursor, GitHub Copilot, Cline, Continue) operate on a **Single-Agent Monologue** paradigm:
1. One prompt goes in.
2. One model streams tokens into one chat panel.
3. If the model gets stuck or hallucinates, the user must manually intervene.

In contrast, **MAHub (Multi-Agent Hub)** operates on a **Decoupled Swarm** paradigm:
1. **Architect Agent**: Breaks complex objectives into a structured `PlanManifest` DAG (Directed Acyclic Graph).
2. **Coder Agent(s)**: Parallel execution workers dispatched to isolated Git Worktrees (`.local/worktrees/<task-id>`).
3. **Auditor / Verifier Agent**: Runs linters, static analysis, and automated test suites, feeding back failure traces into the Coder's context.
4. **Human Operator**: Supervises the execution graph, reviews side-by-side Monaco diffs, and approves 3-Tier risk gates.

To bring this paradigm to life, the user interface must prioritize **orchestration visibility, dependency graphs, and multi-worktree diff inspection** rather than a mere chat box.

