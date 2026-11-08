# Technical Specification 10: Context Compaction, Token Budgeting & Memory Eviction

## 1. The Context Scaling Dilemma

In autonomous coding agents, unmanaged context growth is the primary driver of failure:
- **"Lost in the Middle" Degradation**: Reasoning accuracy sharply declines when relevant needles are buried in 50k+ tokens of irrelevant logs.
- **Cost Escalation**: In naive loops, resending 80k prompt tokens on every turn leads to exponential cost curves ($O(N^2)$ token consumption).
- **Context Bleed & Pollution**: Feeding raw compiler warnings or chatter from Agent A into Agent B corrupts Agent B's task focus.

MAHub enforces a **4-Tier Context Compaction & Isolation Engine**.

---

## 2. The 4-Tier Context Management Architecture

```
+-----------------------------------------------------------------------------------+
| MAHub Context Control Plane                                                       |
|                                                                                   |
|  [Tier 1: Role-Based Context Budgeting]                                           |
|  - Architect: Repo Map (~1,000 tokens) + Goal Spec (Max: 8,000 tokens)            |
|  - Coder: Target File AST + Task Spec + Last 3 Feedback Traces (Max: 12,000 tokens)|
|  - Auditor: Git Diff (~2,000 tokens) + Filtered Test Failures (Max: 6,000 tokens) |
|                                                                                   |
|  [Tier 2: Codebase AST Elision (Tree-sitter)]                                     |
|  - Injects method signatures & docstrings; elides function bodies of dependencies |
|                                                                                   |
|  [Tier 3: Output Headroom Compression]                                            |
|  - Caps CLI & test logs: Strips passing tests; preserves stack traces & exit code |
|                                                                                   |
|  [Tier 4: Hierarchical Summarization & Memory Eviction]                           |
|  - Turns > 12: Collapses turns 1-8 into an immutable TaskStateSummary             |
+-----------------------------------------------------------------------------------+
```

---

## 3. Concrete Context Engineering Protocols

### 3.1 Role-Based Context Partitioning
Each agent is instantiated with a **fresh, isolated context window**:
- **Zero Cross-Chat Bleed**: Coder 1 never receives the raw chat stream or reasoning tokens of Coder 2.
- **Artifact-Only Handoff**: Information between agents crosses boundaries exclusively via validated JSON/Markdown artifacts:
  - `Architect -> Coder`: `TaskSpec` (Goal, target files, acceptance criteria).
  - `Coder -> Auditor`: `DiffPatch` (Git diff against the worktree branch base).
  - `Auditor -> Coder`: `VerificationVerdict` (Pass/Fail, exact failure stack traces).

---

### 3.2 Codebase AST Elision
When a Coder agent needs awareness of external modules or utilities, MAHub never injects full files. Using Tree-sitter, files outside the active edit set are compressed:

```typescript
// Raw File (350 lines): src/auth/token_service.ts
// Injected into Context via AST Elision (18 lines):
export class TokenService {
  constructor(private readonly secret: string, private readonly ttl: number);
  
  /** Generates a cryptographically secure JWT session token. */
  public signSession(userId: string, claims: Record<string, unknown>): string;
  // ... [32 lines implementation elided] ...

  /** Validates signature and expiration of session token. */
  public verifyToken(token: string): TokenPayload | null;
  // ... [48 lines implementation elided] ...
}
```
**Savings**: 90% to 95% token reduction per referenced dependency.

---

### 3.3 Output Headroom Compression
Compiler errors and test runners often emit thousands of lines of output. Unconstrained ingestion wastes context budget. MAHub applies a streaming log compressor:

```python
def compress_terminal_output(raw_output: str, max_lines: int = 60) -> str:
    """
    Compresses verbose test/compiler logs:
    1. Extracts exit code and high-level summary (passed/failed counts).
    2. Isolates stack traces, AssertionErrors, and compiler diagnostics.
    3. Truncates repetitive passing lines with an elision counter.
    """
    lines = raw_output.splitlines()
    if len(lines) <= max_lines:
        return raw_output

    # Isolate failure regions
    failure_lines = [
        line for line in lines 
        if any(keyword in line for keyword in ["FAIL", "ERROR", "Traceback", "assert", "Error:"])
    ]
    summary = lines[-3:] # Last 3 lines typically contain test suite summary
    
    compressed = "\n".join(failure_lines[:max_lines - 5])
    return f"{compressed}\n... [{len(lines) - len(failure_lines)} passing lines elided] ...\n" + "\n".join(summary)
```

---

### 3.4 Hierarchical Memory Eviction (Sliding Window + Scratchpad)
When an agent is locked in a difficult debugging loop exceeding 10 turns:
1. Turns $1 \dots (N-4)$ are passed to a background summarizer (Gemini 2.0 Flash).
2. The summarizer emits a structured `TaskScratchpad`:
   - **Hypotheses Tested & Disproven**: Avoids repeating failed attempts.
   - **Modified Files**: Tracks current changes.
   - **Remaining Blocker**: Concrete error statement.
3. The conversation history is wiped; the agent resumes with:
   `[System Prompt] + [TaskScratchpad] + [Turns N-3, N-2, N-1, Current]`.

