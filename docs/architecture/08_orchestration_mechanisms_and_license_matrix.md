# Research 08: Orchestration Mechanisms, Community Reuse & License Matrix

## 1. Comparison of Orchestration Paradigms

| Orchestration Paradigm | Representative Engines | Execution Flow | Strengths | Critical Weaknesses | Suitability for MAHub |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Conversational Swarm** | AutoGen v0.2, CrewAI standard | Agent-to-agent freeform multi-turn dialogue | Fast initial setup; mimics human brainstorming | Severe token explosion; context drift; compounding hallucinations; poor SWE-bench scores | **AVOID** (Reject conversational chattering) |
| **Cyclic State Graph** | LangGraph, LlamaIndex Workflows | Explicit nodes, conditional edges, cyclic loops | Deterministic state transitions, time-travel checkpoints, explicit human interrupts | High boilerplate; graph wiring can become rigid if dynamic task trees change | **ADOPT for Task Lifecycle & Risk Gates** |
| **Actor Model / Event-Driven** | Magentic-One, OpenHands EventStream | Asynchronous message passing, append-only event stream | High concurrency; reactive; completely decoupled workers; replayable audit logs | Requires robust event bus and dead-letter queue handling | **ADOPT for Python Daemon & WebSocket IPC** |
| **Architect-Worker Pipeline** | Aider Architect, SWE-agent, OpenCode | 2-stage handoff: Reasoning model plans $\rightarrow$ Worker edits code | Maximum token efficiency; aligns model strengths to tasks; SOTA coding benchmark performance | Requires high-quality context compression (Repo Map) to feed the Planner | **PRIMARY ENGINE PATTERN for MAHub** |

---

## 2. Community Reuse Roadmap: What to Adopt vs. What to Build

To maximize efficiency and stand on the shoulders of the open-source community, MAHub adheres to a strict **Reuse-First Hierarchy**:

```
+-----------------------------------------------------------------------------------+
| MAHub Orchestration Stack                                                         |
|                                                                                   |
|  [Reused Open-Source Modules]                      [Custom MAHub Innovations]     |
|                                                                                   |
|  - Aider repomap.py (Tree-sitter + PageRank) ----> Codebase GPS Context Engine    |
|  - SWE-agent ACI (Syntax/Linter pre-commit) -----> Zero-Hallucination File Editor |
|  - RouteLLM Cascading Router --------------------> Strength-Based Model Dispatch  |
|  - Anthropic Model Context Protocol (MCP) -------> Universal Tool Integration     |
|  - @xyflow/react + shadcn/ui --------------------> Secondary Sidebar & DAG Canvas |
|                                                                                   |
|                                                    +----------------------------+ |
|                                                    | Git Worktree Manager       | |
|                                                    | PlanManifest DAG State     | |
|                                                    | 3-Tier Human Risk Gates    | |
|                                                    | Monaco 3-Way Diff Binding  | |
|                                                    +----------------------------+ |
+-----------------------------------------------------------------------------------+
```

### 2.1 Reused from Open-Source Community (Zero Reinvention)
1. **Tree-sitter Symbol Indexing & Personalized PageRank** (from *Aider*, Apache-2.0):
   - Generates compact, 1,000-token architectural outlines of classes, methods, and call graphs.
2. **Agent-Computer Interface & Syntax Guard** (from *SWE-agent*, MIT):
   - Validates code syntax and linting rules before writing to disk, catching LLM syntax errors in real time.
3. **Cascading Cost Router** (from *RouteLLM*, Apache-2.0):
   - Routes simple/repetitive requests to fast, economical models (Gemini 2.0 Flash / DeepSeek V3), escalating to frontier reasoning models (Claude 3.7 / o3-mini) upon complexity or test failure.
4. **Tool Discovery & Standard Integration** (from *MCP Protocol*, MIT):
   - Connects any local or remote tool via the open Model Context Protocol.
5. **Interactive Graph UI Canvas** (from *@xyflow/react*, MIT):
   - High-performance, customizable node-based DAG graph rendering for the IDE Webview.

### 2.2 Built Custom by MAHub
1. **Git Worktree Isolation Engine**: Zero-overhead local worktree creation (`.local/worktrees/<task-id>`), automated branch merging, and cherry-picking without heavy Docker container requirements.
2. **PlanManifest DAG Orchestrator**: Manages parallel worker dependencies, task checklists, and verification verdicts.
3. **3-Tier Human-in-the-Loop Risk Gate**: Non-modal visual diff review and shell command interception.
4. **Monaco 3-Way Diff Binding**: Native integration with VS Code editor tabs for side-by-side inspection of worktree branches.

---

## 3. Comprehensive Legal & Licensing Matrix

| Library / Tool | Upstream License | Commercial Use? | Patent Grant? | Redistribution Constraints | MAHub Invariant & Boundary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Aider components** | **Apache-2.0** | Yes | Yes (Section 3) | Retain copyright notice; state changes made | Cleanly reusable in Python backend with standard license attribution. |
| **SWE-agent ACI** | **MIT** | Yes | No explicit clause | Retain copyright notice | Fully permissive; safe for embedding and modification. |
| **OpenHands Core** | **MIT** | Yes | No explicit clause | Retain copyright notice | Permissive; modular components can be adapted freely. |
| **RouteLLM** | **Apache-2.0** | Yes | Yes (Section 3) | Retain copyright notice | Safe for routing optimization algorithms. |
| **LangGraph / MCP** | **MIT** | Yes | No explicit clause | Retain copyright notice | Clean standard for protocol and state machine concepts. |
| **React / @xyflow/react** | **MIT** | Yes | No explicit clause | Retain copyright notice | Safe for IDE frontend extension. |
| **GPL-3.0 / AGPL-3.0 tools** | **GPL-3.0 / AGPL-3.0** | Restricted | Copyleft | Must open source entire derivative work if statically linked | **MANDATORY BOUNDARY: Process Isolation ONLY.** Never import GPL/AGPL code directly into MAHub Python codebase. Invoke solely via external CLI, subprocess, or network IPC. |
| **Source-Available (BSL, SSPL)** | **Non-OSI** | Conditional | Varies | Forbids offering software as a hosted commercial service | **STRICT PROHIBITION: Do not incorporate BSL/SSPL components into MAHub core.** |

---

## 4. Key Takeaways for MAHub Engineering
1. **Standing on Giants**: Leveraging Aider's repo map and SWE-agent's ACI gives MAHub world-class coding accuracy from day one without writing custom AST parsers from scratch.
2. **License Safety**: All core components selected for direct code reuse are strictly **MIT** or **Apache-2.0**, guaranteeing total freedom for open-source distribution and enterprise adoption.
3. **Isolation Rule**: Any future tool bearing copyleft (GPL/AGPL) licenses must remain strictly behind external subprocess or IPC boundaries to preserve MAHub's permissive licensing model.

