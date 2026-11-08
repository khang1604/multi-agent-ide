# MAHub: Multi-Agent Orchestration Platform — Vision & Core Concepts

## 1. Executive Summary & Vision
**MAHub (Multi-Agent Hub)** is an open, modular, local-first multi-agent orchestration engine designed to coordinate heterogeneous AI agents according to their distinct strengths. Instead of relying on a monolithic model or a homogeneous swarm, MAHub treats modern coding and research agents as specialized craftspeople. It manages lifecycle, workspace isolation, task decomposition, dynamic routing, and artifact handoffs.

---

## 2. Core Problem Statement
Existing multi-agent frameworks often suffer from critical shortcomings:
1. **Homogeneity Trap**: Frameworks typically bind to a single LLM family (e.g., all GPT-4o or all Claude), ignoring the fact that different models exhibit drastically different cost-performance profiles and reasoning strengths.
2. **Brittle Integration**: Adding a new agent CLI or API often requires rewiring the entire framework or dealing with proprietary protocols.
3. **Context Pollution & Drift**: Feeding an entire repository into every agent conversation degrades reasoning quality, exhausts context windows, and increases hallucination rates.
4. **Lack of Local Execution Control**: Many solutions rely heavily on cloud-hosted SaaS control planes, introducing latency, privacy concerns, and unpredictable billing.

---

## 3. The Four Core Pillars of MAHub

### Pillar I: Strength-Based Dynamic Routing (Specialization Matching)
Every incoming request undergoes intent analysis, complexity classification, and domain decomposition:
* **Strategic Architectural Planning**: High-complexity architectural tasks require strong long-horizon reasoning and refactoring precision (e.g., Claude 3.7 Sonnet / Opus).
* **Massive Repository Context & Broad Scanning**: Ingesting extensive codebases, multi-file diffs, or broad documentation analysis (e.g., Gemini 2.5 / 2.0 Pro with 1M-2M token context).
* **Algorithmic Code Generation & Logic Puzzles**: High-speed, high-density algorithmic implementation and unit test synthesis (e.g., OpenAI o3-mini / GPT-4o).
* **Economical Bulk Processing & Local Inference**: High-volume transforms, routine linting, AST extraction, or local offline agents (e.g., DeepSeek R1 / V3, local Ollama models).

### Pillar II: Universal Pluggable Agent Adapter (Open Registry)
MAHub separates the **Orchestrator Core** from the **Agent Runtimes**:
* **Standardized Agent Interface (SAI)**: An agent is defined by a declarative manifest:
  - Input/Output format: CLI interactive stream, headless stdio JSON-RPC, or REST API.
  - Capability tags: `[code-writing, repo-wide-search, terminal-exec, visual-analysis, security-audit]`.
  - Resource footprint & cost tier: Free (local), Low, Medium, High.
* **Support for Any Agent**: Users can register any off-the-shelf CLI agent (Claude Code, Gemini CLI, Aider, OpenCode, Codex, Agy) or custom Dockerized agents without altering orchestrator core logic.

### Pillar III: Context-Isolated Workspaces & Artifact Handshake
* **Worktree & Sandbox Isolation**: Each worker operates within an isolated git worktree or isolated branch.
* **Deterministic Handoff Protocol**: Agents do not pass raw conversational chatter to each other. They communicate via structured **Artifacts**:
  - `PlanManifest`: Step-by-step goals, dependencies, verification criteria.
  - `DiffPatch`: Atomic code diffs produced by worker agents.
  - `ReviewVerdict`: Feedback and acceptance criteria from reviewer/evaluator agents.
* **Single Active Writer Invariant**: At any stage of a sub-task, only one agent holds write permission on a given file set to prevent race conditions and merge conflicts.

### Pillar IV: Local-First Control Plane & Privacy Guardrails
* **Local State Database**: All task queues, execution timelines, agent run logs, and metrics reside in local SQLite (`.local/mahub.sqlite3`).
* **Zero Real Credentials Leakage**: Secrets and credentials are managed in isolated credential vaults or environment boundaries; workers receive scoped mock/test environments.
* **Fallback & Circuit Breakers**: If a specialized agent fails, stalls, or exceeds token quotas, the orchestrator triggers graceful failover to secondary models with contextual escalation.

---

## 4. Phase 1 Research Objectives (with NotebookLM)
1. **Analyze Best-in-Class Patterns**: Dissect routing architectures from RouteLLM, FrugalGPT, 9-route, and OpenCode.
2. **Formulate the Agent Taxonomy**: Build a rigorous benchmark and decision tree for model allocation based on coding benchmarks (SWE-bench, HumanEval, Codeforces).
3. **Define the Protocol Specification**: Draft formal schemas for Agent Manifests, Task Specifications, and Artifact Exchanges.
