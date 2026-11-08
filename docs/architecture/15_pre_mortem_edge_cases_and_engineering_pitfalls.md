# Technical Specification 15: Deep-Dive Pre-Mortem, Edge Cases & Engineering Pitfalls

## 1. Executive Summary & Purpose

A robust architecture is defined not by how it behaves in optimal conditions, but by how it handles edge cases, system limits, and hostile failure modes. 

Before committing a single line of production code for **MAHub IDE**, this document systematically examines the **6 Most Critical Engineering Pitfalls** across Windows Native, Git Worktree concurrency, IPC lifecycle, Webview memory leaks, AST limits, and native binary dependencies—along with concrete, battle-tested solutions.

---

## 2. Pitfall Matrix & Architectural Solutions

| Pitfall Area | Concrete Failure Mode | Severity | Architectural Solution |
| :--- | :--- | :--- | :--- |
| **1. Windows Native** | File locking (`WinError 32`), `MAX_PATH` (260 char limit), CRLF line ending mismatch. | **CRITICAL** | Retrying exponential file cleaner; shallow worktree paths (`.local/wt/<id>`); `.gitattributes` LF enforcement. |
| **2. Git Concurrency** | `.git/index.lock` collisions between parallel Coder agents; orphaned/zombie worktrees. | **HIGH** | Centralized `GitLockQueue` mutex in Python daemon; startup auto-sweep (`git worktree prune`). |
| **3. IPC & Lifecycle** | Zombie daemon consuming CPU/API tokens after IDE is closed; Webview state loss on reload. | **HIGH** | Heartbeat watchdog (60s orphan cutoff); SQLite WAL state hydration on reconnect. |
| **4. Webview Rendering** | Panel collapse destroys React state; 60fps token streaming blows up React re-render queue. | **MEDIUM** | `retainContextWhenHidden: true`; `requestAnimationFrame` token chunk throttling (16ms batching). |
| **5. AST & Context OOM** | Tree-sitter parsing 10MB minified bundles, lockfiles, or binary dumps freezes daemon. | **HIGH** | Hard 500 KB file size ceiling; automatic minified/generated file skip heuristics. |
| **6. Native Binaries** | Requiring C++ compiler (MSVC/gcc) to build Tree-sitter grammar `.so`/`.dll` kills onboarding. | **HIGH** | Use pre-compiled binary wheels (`tree-sitter-languages`) requiring zero local compiler toolchains. |

---

## 3. Deep-Dive Breakdown of Each Pitfall & Solutions

### 3.1 Pitfall 1: Windows Native Gauntlet (`WinError 32`, `MAX_PATH`, CRLF)

#### A. The File Locking Nightmare (`WinError 32`)
On Windows, if any background process (VS Code file watcher, anti-virus scanner, or an unclosed Python file descriptor) touches a file, Windows locks it exclusively. Attempting to delete a worktree results in:
`PermissionError: [WinError 32] The process cannot access the file because it is being used by another process`

**Solution: The Resilient Windows File Cleaner**
```python
import os
import shutil
import stat
import time

def remove_readonly(func, path, exc_info):
    """Clear readonly bit and retry deletion."""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def safe_rmtree(path: str, max_retries: int = 5, delay: float = 0.2):
    """Safely removes directory tree on Windows with exponential backoff."""
    for attempt in range(max_retries):
        try:
            shutil.rmtree(path, onerror=remove_readonly)
            return
        except PermissionError:
            if attempt == max_retries - 1:
                raise
            time.sleep(delay * (2 ** attempt))
```

#### B. The 260-Character `MAX_PATH` Limit
Nested dependencies (`node_modules/@angular/...`) inside worktrees frequently exceed 260 characters, breaking Win32 system calls.
- **Solution 1**: Worktree paths use a shortened root: `.local/wt/<short_task_id>`.
- **Solution 2**: Always enable Git long paths in repo settings: `git config core.longpaths true`.
- **Solution 3**: Convert absolute paths using the Win32 extended-length prefix: `\\?\C:\path\to\repo`.

#### C. CRLF vs LF Line Ending Clashes
Windows defaults to `core.autocrlf=true`, causing file hashes to diverge from Linux/macOS and producing massive phantom diffs.
- **Solution**: Commit a project-root `.gitattributes` file enforcing Unix line endings across all platforms:
  ```gitattributes
  * text=auto eol=lf
  *.{cmd,bat,ps1} text eol=crlf
  ```

---

### 3.2 Pitfall 2: Git Worktree Concurrency & Index Locking

When Coder A and Coder B run parallel git commands (`git add`, `git commit`, `git checkout`), Git creates a repository-wide lockfile `.git/index.lock`. Uncoordinated execution crashes with:
`fatal: Unable to create '.git/index.lock': File exists.`

**Solution: Centralized Async Git Mutex (`GitLockQueue`)**
In MAHub's Python Core Daemon, all Git operations crossing repository metadata are queued through an `asyncio.Lock`:

```python
import asyncio

class GitRepositoryManager:
    def __init__(self, repo_root: str):
        self.repo_root = repo_root
        self._git_lock = asyncio.Lock()

    async def execute_git(self, *args, cwd: str = None) -> str:
        """Serializes Git metadata operations while allowing parallel file edits."""
        async with self._git_lock:
            proc = await asyncio.create_subprocess_exec(
                "git", *args, cwd=cwd or self.repo_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"Git error ({proc.returncode}): {stderr.decode()}")
            return stdout.decode().strip()
```

**Startup Worktree Garbage Collection**:
Upon daemon launch, MAHub automatically sweeps dangling worktrees:
`git worktree prune` followed by pruning `.local/wt/` folders whose tasks are marked `COMPLETED` or `FAILED`.

---

### 3.3 Pitfall 3: WebSocket Lifecycle, Zombie Daemons & Context Hydration

#### A. Preventing Runaway Token Costs on Window Close
If a developer closes VS Code while a 10-step multi-agent task is running, unmonitored agents could burn tens of dollars in API credits.
- **Heartbeat Monitor**: The Webview sends a `ping` every 5 seconds.
- **Auto-Pause Watchdog**: If no `ping` is received within 45 seconds, the daemon sets the swarm status to `PAUSED_DISCONNECTED` and halts LLM generation requests.

#### B. Zero-Loss State Hydration on Window Reload (`Ctrl+R` / `Cmd+R`)
When the developer reloads VS Code, the Webview state is wiped.
- **Solution**: Upon reconnect, Webview sends `{"method": "state.hydrate"}`.
- The Python Daemon reads the current `PlanManifest` and replays the active task state from the SQLite WAL journal in $< 10\text{ms}$.

---

### 3.4 Pitfall 4: Webview Memory Leaks & 60fps Token Throttling

Streaming LLM tokens directly to React state at 80 tokens/second causes hundreds of state dispatches per second, freezing the UI thread.

**Solution: Animation-Frame Throttled Buffer**
In `frontend/ide-extension`:
```typescript
class TokenStreamBuffer {
  private buffer: string = '';
  private rafId: number | null = null;

  constructor(private onFlush: (chunk: string) => void) {}

  public push(token: string) {
    this.buffer += token;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.onFlush(this.buffer);
        this.buffer = '';
        this.rafId = null;
      });
    }
  }
}
```
**Preserving Webview State**:
Set `retainContextWhenHidden: true` in the VS Code Webview provider registration so switching between Explorer and the MAHub panel does not re-mount React components.

---

### 3.5 Pitfall 5: AST Parser Protection Against Giant Files

Parsing files like `package-lock.json` (30,000 lines) or minified JS bundles (`vendor.min.js`) via Tree-sitter causes extreme CPU spikes and Out-Of-Memory (OOM) crashes.

**Solution: Guardrails for AST Ingestion**
```python
MAX_PARSABLE_FILE_SIZE_BYTES = 500 * 1024  # 500 KB limit
IGNORE_EXTENSIONS = {".lock", ".min.js", ".min.css", ".map", ".svg", ".wasm"}

def is_parsable_source_file(path: str) -> bool:
    if any(path.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return False
    try:
        return os.path.getsize(path) <= MAX_PARSABLE_FILE_SIZE_BYTES
    except OSError:
        return False
```

---

### 3.6 Pitfall 6: Native Binary Dependencies for Tree-sitter

Historically, `tree-sitter` in Python required compiling C source files on the user's machine, failing on Windows machines lacking Visual Studio C++ build tools.

**Solution: Modern Pre-Built Wheels (`tree-sitter-languages`)**
MAHub specifies `tree-sitter-languages` in `requirements.txt`:
- Ships pre-compiled shared libraries (`.so`, `.dylib`, `.pyd`) for Windows x64, macOS (arm64 & x86_64), and Linux (manylinux).
- **Zero local C compiler requirement**. Installs cleanly via `pip install` on standard user machines.

---

## 4. Final Engineering Checklist Before Writing Code

- [x] **File Locking**: Safe retry cleaner implemented for Windows.
- [x] **Concurrency**: Async Git Mutex queue designed to prevent `.git/index.lock` collisions.
- [x] **Heartbeat**: 45s orphan cutoff prevents runaway API spend.
- [x] **Rendering**: 60fps token streaming throttler prevents UI thread freezing.
- [x] **Memory/AST**: 500 KB file ceiling prevents Tree-sitter OOM.
- [x] **Toolchain**: Pre-compiled binary wheels selected for zero-compiler installation.
- [x] **Security**: OS Keyring vault + AST command sanitizer prevents credential leaks and malicious execution.
