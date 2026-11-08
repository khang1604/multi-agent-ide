# Technical Specification 12: Worktree Conflict Resolution, Resilience & Evaluation Harness

## 1. Worktree 3-Way Merge & Conflict Resolution

When multiple Coder agents work in parallel across isolated Git Worktrees (`.local/worktrees/<task-id>`), merge conflicts can arise if two tasks touch overlapping modules.

```
+-----------------------------------------------------------------------------------+
| Parallel Worktree Merge Flow                                                      |
|                                                                                   |
|  [Coder A: Branch task-auth]           [Coder B: Branch task-user]                |
|  - Edits src/auth/service.py           - Edits src/user/service.py                |
|  - Modifies src/routes.py              - Modifies src/routes.py                   |
|              \                                      /                             |
|               v                                    v                              |
|  +-----------------------------------------------------------------------------+  |
|  | Stage 1: Topological DAG Scheduling (Prevention)                             |  |
|  | - Architect groups dependent file mutations into sequential tasks.          |  |
|  +-----------------------------------------------------------------------------+  |
|                                     |                                             |
|                                     v                                             |
|  +-----------------------------------------------------------------------------+  |
|  | Stage 2: Git 3-Way Merge Attempt                                            |  |
|  | - Automatic merge into staging branch. Clean? -> Proceed to Auditor.         |  |
|  +-----------------------------------------------------------------------------+  |
|                                     | (Conflict Detected)                         |
|                                     v                                             |
|  +-----------------------------------------------------------------------------+  |
|  | Stage 3: Architect-Guided Semantic Rebase                                   |  |
|  | - Architect inspects conflict chunks + AST dependencies; re-synthesizes     |  |
|  |   unified file.                                                             |  |
|  | - Auditor runs test suite on unified file. Pass? -> Resolved.                |  |
|  +-----------------------------------------------------------------------------+  |
|                                     | (Persistent Test Failure)                   |
|                                     v                                             |
|  +-----------------------------------------------------------------------------+  |
|  | Stage 4: Operator Escalation (Monaco 3-Way Diff Editor)                     |  |
|  | - Displays side-by-side Monaco diff with Accept/Reject controls.           |  |
+--+-----------------------------------------------------------------------------+--+
```

---

## 2. API Resilience, Circuit Breakers & Failover Cascades

Frontier LLM APIs frequently experience transient outages, capacity exhaustion, and HTTP 429 rate limits. MAHub incorporates an enterprise-grade resilience harness:

### 2.1 Exponential Backoff with Full Jitter
All provider calls wrap an asynchronous retry decorator:
$$T_{\text{wait}} = \min(T_{\text{max}}, T_{\text{base}} \times 2^{\text{attempt}}) + \text{Uniform}(0, \text{jitter})$$

### 2.2 Provider Failover Cascade
If a provider continues to fail after 3 retries or enters a circuit breaker `OPEN` state, MAHub seamlessly switches the agent's active provider to a functionally equivalent fallback:

| Primary Role / Model | Fallback Tier 1 | Fallback Tier 2 (Offline / Local) |
| :--- | :--- | :--- |
| **Architect** (Claude 3.7 / Opus) | OpenAI o3-mini / Gemini 2.5 Pro | DeepSeek R1 (671B / 70B via vLLM) |
| **Coder** (Claude 3.7 / o3-mini) | DeepSeek V3 / Gemini 2.0 Pro | Qwen2.5-Coder 32B (Local Ollama) |
| **Fast Triage** (Gemini 2.0 Flash) | Claude 3.5 Haiku / GPT-4o-mini | Llama 3.3 70B / Qwen 14B (Local) |

### 2.3 Circuit Breaker State Machine
- **CLOSED**: All requests route to the primary provider.
- **OPEN**: If 5 consecutive requests fail within a 60-second sliding window, the circuit trips `OPEN` for 30 seconds. All requests immediately route to Fallback Tier 1 without network latency.
- **HALF-OPEN**: Sends a single probe request. If successful, resets to `CLOSED`; if failing, extends `OPEN` for another 60 seconds.

---

## 3. Evaluation & Benchmarking Harness

To empirically validate that MAHub delivers higher resolution rates and superior cost efficiency compared to monolithic coding assistants, MAHub embeds an automated benchmarking harness.

### 3.1 SWE-bench Integration
- **Benchmark Suite**: SWE-bench Lite (300 real GitHub issues from Django, Flask, SymPy, Scikit-learn).
- **Execution Workflow**:
  1. Spawns isolated Git worktree for each benchmark task.
  2. Ingests problem description and gold environment.
  3. MAHub Architect dispatches Coder worker to produce a `DiffPatch`.
  4. Auditor applies the patch and runs SWE-bench evaluation test assertions.
  5. Records `RESOLVED` vs `UNRESOLVED`, total token consumption, and latency.

### 3.2 Key Target Metrics
1. **Pass@1 Resolve Rate**: Target $\ge 65\%$ on SWE-bench Lite.
2. **Cost-per-Resolved-Task**: Target $\le \$1.50$ average cost per issue through RouteLLM dynamic cascading.
3. **Zero Main-Branch Contamination**: 100% of failed attempts discarded without leaving dirty uncommitted files in the primary repository.

