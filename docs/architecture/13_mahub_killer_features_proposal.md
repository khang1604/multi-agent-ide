# Feature Specification 13: MAHub IDE Core Feature Suite & Technical Blueprint

## 1. Executive Summary & Value Proposition

Traditional AI coding assistants (Cursor, GitHub Copilot, Windsurf, Cline) suffer from structural bottlenecks: single-agent chat congestion, main-branch pollution, alert fatigue, and uncontrollable token spend.

**MAHub IDE** delivers a professional, open-source multi-agent development environment built on **6 Killer Features**, vetted and finalized through the `/grill-me` architectural review.

---

## 2. The 6 Finalized Core Features of MAHub IDE

| # | Feature Name | Core Mechanism | User Experience & Workflow |
| :--- | :--- | :--- | :--- |
| **1** | **Dual-Mode Task Inception** | Natural Language + Structured PRD / Issue Intake $\rightarrow$ Visual `PlanManifest` DAG | Developer types a casual prompt or drags in a GitHub Issue/PRD. The Architect Agent parses intent into an interactive, editable DAG graph in the Secondary Sidebar *before* any code is generated. |
| **2** | **Bounded Self-Healing Loop** | Automated Linter/Test Feedback with Headroom Compression (Max 3 Retries) | Coder generates code in an isolated worktree; Auditor immediately runs unit tests. On failure, compressed error traces are piped back to Coder. If failing after 3 attempts, trips Circuit Breaker and alerts the operator. |
| **3** | **Zero-Vector 3-Tier Codebase Memory** | Rules (`AGENTS.md`) + Auto-Learned Lessons (`LESSONS.md`) + Tree-sitter Repo Map | Zero heavy vector DB setup. Compresses full repository AST into a ~1,000-token Codebase GPS using Aider's Tree-sitter PageRank, while continuously learning lessons from resolved bugs. |
| **4** | **Live Swarm HUD & Hard Budget Cap** | Real-time Token Velocity, Live USD Cost & RouteLLM Savings Counter | Status bar HUD shows live tokens/second per active model, total USD spent, and dollars saved by routing to Flash/DeepSeek. Automatically pauses if the user-defined budget cap (e.g. $2.00) is reached. |
| **5** | **1-Click Air-Gapped Privacy Mode** | Localhost Ollama/vLLM Auto-Discovery & Zero-Egress Network Isolation | Single UI toggle cuts 100% of outbound internet traffic. Automatically detects local LLM endpoints (`http://127.0.0.1:11434`), mapping DeepSeek R1 and Qwen2.5-Coder to swarm roles. |
| **6** | **Visual MCP Tool Manager** | Anthropic Model Context Protocol (MCP) Hub with Scoped Role Permissions | Visual UI in the Secondary Sidebar to manage local MCP servers (Git, SQLite, Postgres, Playwright, Docker). Operators can granularly restrict tool access (e.g., only Auditor gets Test Runner tools). |

---

## 3. Detailed Technical Architecture of Each Feature

### 3.1 Feature 1: Dual-Mode Task Inception
- **Input Types**:
  1. Plaintext prompt: `"Refactor auth service to use Argon2id with rate limiting."`
  2. Issue file upload: Drag-and-drop `issue_102.md` or PRD.
- **Pre-Flight Generation**:
  - Architect generates a JSON `PlanManifest` containing task nodes, dependency edges, target files, and designated agent models.
  - Rendered dynamically in the IDE using `@xyflow/react`.
  - Operator can reorder nodes, add manual subtasks, or click `[Approve & Launch Swarm]`.

### 3.2 Feature 2: Bounded Self-Healing Loop
- **Verification Harness**:
  - Auditor Agent automatically inspects worktree branches at `.local/worktrees/<task-id>`.
  - Runs target test command: `pytest tests/test_auth.py` or `npm test`.
- **Headroom Compression Filter**:
  - Strips passing test lines; isolates exact file, line number, AssertionError, and stack trace.
- **Fail-Safe Mechanism**:
  - Loop Counter: 1, 2, 3.
  - If Turn 3 fails: Node turns red on DAG, circuit breaker opens, and a diagnostic summary is displayed with an `[Escalate to Human]` prompt.

### 3.3 Feature 3: Zero-Vector 3-Tier Codebase Memory
- **Tier 1 (Static Directives)**: Natively reads `AGENTS.md`, `.cursorrules`, and project conventions.
- **Tier 2 (Continuous Learning)**: After resolving any non-trivial bug or edge case, MAHub automatically appends the problem, root cause, and fix to `.local/memory/LESSONS.md`.
- **Tier 3 (Tree-sitter Repo Map)**: Reuses Aider's `repomap.py` to extract symbol definitions and references across 130+ languages, ranking them via Personalized PageRank relative to currently active files.

### 3.4 Feature 4: Live Swarm HUD & Hard Budget Cap
- **Metrics Displayed**:
  - Active Agents: `[Architect: Idle] [Coder: 48 tok/s] [Auditor: Running pytest]`
  - Real-time Cost: `$0.14 USD` (accumulated) | `Budget Cap: $1.50`
  - RouteLLM Efficiency: `74% cost saved via Gemini Flash triage`
- **Hard Stop Protocol**:
  - When accumulated cost $\ge$ Budget Cap, the Python daemon sends a `BUDGET_CAP_EXCEEDED` event, pausing all worker threads and displaying a top ribbon: `[Increase Budget by $1.00]` or `[Abort Task]`.

### 3.5 Feature 5: 1-Click Air-Gapped Privacy Mode
- **Zero-Egress Enforcement**:
  - Daemon disables all cloud API client adapters (Anthropic, OpenAI, Google).
  - Outbound socket connections outside `127.0.0.1` are rejected by the network security layer.
- **Local Swarm Dispatch**:
  - Probes `http://127.0.0.1:11434` (Ollama) and `http://127.0.0.1:8000/v1` (vLLM).
  - Assigns models automatically based on local hardware:
    - Architect: `deepseek-r1:32b` or `qwen2.5:32b`
    - Coder: `qwen2.5-coder:14b` or `qwen2.5-coder:7b`
    - Auditor: `llama3.3:70b` or `codellama:13b`

### 3.6 Feature 6: Visual MCP Tool Manager
- **Capabilities**:
  - Direct UI list of installed Model Context Protocol (MCP) servers.
  - Toggle switches: `[ON/OFF]` for each server.
  - Scoped RBAC Assignment: Checkboxes to permit which Agent roles can invoke tools from that server (e.g. Architect, Coder, Auditor).
  - Persisted in `.local/mcp_config.json`.
