# Multi Agent IDE — Visual Flow & Architecture Map
> **Purpose:** Traceable architecture diagrams and data-flow schemas for live reference during development, maintenance, and upstream upgrades. Keep this file open side-by-side with code editors.

---

## 1. End-to-End System Topology & Data Flow

```mermaid
flowchart TB
    subgraph UI_Layer ["Tầng Giao Diện (VS Code Workbench / Cockpit Layout)"]
        direction TB
        Col1["Cột 1: Living PLAN.md<br/><code>PLAN.md</code><br/>Frontmatter + Task DAG"]
        Col2["Cột 2: Continuous Multi-Diff<br/><code>agent-diff://staged</code><br/>MultiDiffEditor Widget"]
        Col3["Cột 3: Swarm Activity Stream<br/><code>multi-agent.swarmControlView</code><br/>Realtime Agent Swimlanes"]
        AuxBar["Secondary Sidebar<br/>Orchestrator Hub & HUD"]
    end

    subgraph Core_Engine ["Tầng Lõi Workbench (vscode/src/vs/)"]
        LayoutHook["layout.ts Hook<br/><code>MultiAgentCockpit</code>"]
        EditorGrid["IEditorGroupsService<br/>(3 Horizontal Columns)"]
        AuxBarService["IPaneCompositePartService<br/>(Right Sidebar Dock)"]
        MultiDiffResolver["IMultiDiffSourceResolverService<br/>(Virtual Diff Provider)"]
    end

    subgraph Ext_Layer ["Tầng Built-in Extension (src/stable/extensions/multi-agent-harness/)"]
        ExtMain["extension.ts<br/>(Activation & Commands)"]
        WorktreeMgr["WorktreeManager.ts<br/>(Git Worktree Operations)"]
        DiffProv["DiffProvider.ts<br/>(agent-diff:// Schema)"]
        ArtifactMgr["ArtifactManager.ts<br/>(PLAN.md Parser)"]
        SwarmHUD["SwarmControlProvider.ts<br/>(Sidebar Webview)"]
    end

    subgraph Swarm_Daemon ["Tầng Bộ Não Điều Phối (harness/engine/ - Python 3.11+)"]
        DaemonService["service.py / hub.py<br/>Daemon Process"]
        Engine["engine.py<br/>Task Pipeline & Circuit Breaker"]
        Adapters["adapters.py<br/>CLI Adapters (Claude, o3-mini, Gemini)"]
        WorktreeEngine["workspace.py<br/>Lease & Branch Isolation"]
        McpServer["mcp.py<br/>Model Context Protocol Server"]
    end

    subgraph Swarm_Models ["Mô Hình AI Chuyên Biệt (Multi-Model Swarm)"]
        Claude["Claude 3.7 Sonnet<br/>(Lead Architect)"]
        O3Mini["OpenAI o3-mini<br/>(Algorithm Worker)"]
        Gemini["Gemini 2.5 Pro<br/>(Repo & Security Auditor)"]
    end

    subgraph Isolated_FS ["Hệ Thống Tệp Cô Lập (Git Worktree Sandbox)"]
        PrimaryRepo["Primary Checkout<br/><code>/home/nguyenkhang/Project/...</code>"]
        Worktree1[".local/worktrees/task-101/<br/>Branch: agent/task-101"]
        Worktree2[".local/worktrees/task-102/<br/>Branch: agent/task-102"]
        Lessons[".local/memory/LESSONS.md<br/>Zero-Vector Lessons"]
    end

    %% Flow Connections
    LayoutHook --> EditorGrid
    LayoutHook --> AuxBarService
    EditorGrid --> Col1
    EditorGrid --> Col2
    AuxBarService --> Col3

    ExtMain --> WorktreeMgr
    ExtMain --> DiffProv
    ExtMain --> ArtifactMgr
    ExtMain --> SwarmHUD

    Col1 <--> ArtifactMgr
    Col2 <--> DiffProv
    Col3 <--> SwarmHUD

    SwarmHUD <== "JSON-RPC / IPC Socket" ==> McpServer
    McpServer --> DaemonService
    DaemonService --> Engine
    Engine --> Adapters
    Engine --> WorktreeEngine

    Adapters --> Claude
    Adapters --> O3Mini
    Adapters --> Gemini

    WorktreeEngine --> Worktree1
    WorktreeEngine --> Worktree2
    WorktreeMgr -. "git worktree list / diff" .-> Worktree1

    O3Mini --> Worktree1
    Gemini --> Worktree1
    Gemini -. "Verified Patch" .-> Col2
```

---

## 2. Chu Trình Thực Thi Tác Vụ Đa Tác Tử (Multi-Agent Execution Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Human)
    participant UI as Cockpit Layout (Cột 1, 2, 3)
    participant Ext as multi-agent-harness
    participant Hub as Python Swarm Engine
    participant Arch as Claude Architect
    participant Coder as o3-mini Worker
    participant Audit as Gemini Auditor

    Dev->>UI: Nhập task tại Cột 3 (Swarm HUD) hoặc tạo PLAN.md
    UI->>Ext: Gửi lệnh dispatchTask(prompt)
    Ext->>Hub: IPC JSON-RPC: dispatch_task()
    
    rect rgb(235, 245, 255)
        Note over Hub,Arch: Phase 1: Planning & DAG Generation
        Hub->>Arch: Phân tích intent + tạo PlanManifest (DAG)
        Arch-->>Hub: Return PlanManifest JSON
        Hub->>Ext: Cập nhật PLAN.md & cập nhật Cột 1
        Ext->>UI: Hiển thị Living PLAN.md & Request Approval
    end

    Dev->>UI: Nhấn "Approve Plan"
    UI->>Ext: multiAgent.approvePlan
    Ext->>Hub: approve_plan(taskId)

    rect rgb(240, 255, 240)
        Note over Hub,Coder: Phase 2: Isolated Code Generation
        Hub->>Hub: Tạo Git Worktree tại .local/worktrees/<task-id>
        Hub->>Coder: Thực thi code generation trong worktree
        Coder-->>Hub: Commit code vào branch agent/<task-id>
    end

    rect rgb(255, 245, 235)
        Note over Hub,Audit: Phase 3: Verification & Auditor Loop
        Hub->>Audit: Chạy Test Suite & Linter trong worktree
        alt Tests Passed
            Audit-->>Hub: Verification OK (0 errors)
        else Tests Failed (Max 3 retries)
            Audit-->>Coder: Bounded Self-Healing Loop (Traces)
        end
    end

    Hub->>Ext: Bắn sự kiện DIFF_READY
    Ext->>UI: Hiển thị Continuous Multi-Diff tại Cột 2
    Dev->>UI: Review Monaco Diff & Merge vào branch chính
```

---

## 3. Bản Đồ Tra Cứu Mã Nguồn Nhanh (Code Look-Up Matrix)

Dành cho lập trình viên tra cứu nhanh vị trí code khi sửa chữa hoặc nâng cấp:

| Thành phần | Chức năng chính | Đường dẫn tệp tin | Điểm mở rộng / Sửa chữa |
| :--- | :--- | :--- | :--- |
| **Cockpit Hook** | Tự động chia 3 cột và nạp editors khi mở IDE | [`vscode/src/vs/workbench/browser/layout.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/vscode/src/vs/workbench/browser/layout.ts) | Can thiệp hàm `getInitialEditorsState()` và `restoreParts()` |
| **Cockpit Controller** | Module độc lập chứa toàn bộ cấu hình 3 cột | [`vscode/src/vs/workbench/contrib/multiAgent/browser/multiAgentCockpit.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/vscode/src/vs/workbench/contrib/multiAgent/browser/multiAgentCockpit.ts) | Chỉnh tỷ lệ cột (`groups: [0.28, 0.44, 0.28]`), đường dẫn file mặc định |
| **Diff Staging** | Virtual document provider scheme `agent-diff://` | [`src/stable/extensions/multi-agent-harness/src/diff/DiffProvider.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/src/stable/extensions/multi-agent-harness/src/diff/DiffProvider.ts) | Nâng cấp liên kết sang `MultiDiffEditorInput` (Tầng 2) |
| **Worktree Manager** | Tạo và quản lý `.local/worktrees/<task-id>` | [`src/stable/extensions/multi-agent-harness/src/worktree/WorktreeManager.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/src/stable/extensions/multi-agent-harness/src/worktree/WorktreeManager.ts) | Thêm cherry-pick, rebase, squash và dọn dẹp worktree |
| **Artifact Manager** | Đọc ghi frontmatter metadata trong `PLAN.md` | [`src/stable/extensions/multi-agent-harness/src/artifacts/ArtifactManager.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/src/stable/extensions/multi-agent-harness/src/artifacts/ArtifactManager.ts) | Đồng bộ trạng thái checkbox `[x]` vào database SQLite |
| **Swarm HUD** | Giao diện Webview realtime hiển thị trạng thái tác tử | [`src/stable/extensions/multi-agent-harness/src/views/SwarmControlProvider.ts`](file:///home/nguyenkhang/Project/multi-agent-ide/src/stable/extensions/multi-agent-harness/src/views/SwarmControlProvider.ts) | Tích hợp biểu đồ DAG `@xyflow/react`, streaming token/s |
| **Swarm Engine** | Lõi điều phối tác tử Python | [`harness/engine/engine.py`](file:///home/nguyenkhang/Project/multi-agent-ide/harness/engine/engine.py) | Định tuyến model, mạch ngắt Circuit Breaker khi lỗi 3 lần |
| **Model Adapters** | Giao tiếp CLI Claude, o3-mini, Gemini | [`harness/engine/adapters.py`](file:///home/nguyenkhang/Project/multi-agent-ide/harness/engine/adapters.py) | Thêm adapter Ollama local, OpenRouter, vLLM |
| **Desktop Launcher** | Script khởi chạy standalone không chặn terminal | [`run.sh`](file:///home/nguyenkhang/Project/multi-agent-ide/run.sh) | Tham số Electron, biến môi trường đồ họa Wayland/X11 |

---

## 4. Hướng Dẫn Nâng Cấp Upstream Khi Có Bản Code-OSS Mới (Rebase Protocol)

Khi nâng cấp VS Code (Code-OSS) lên phiên bản mới:
1. **Kiểm tra Patch Hiện có:**
   Toàn bộ can thiệp vào lõi được trích xuất tại thư mục `patches/`. Các patch liên quan đến Multi Agent IDE được đánh số `90+`:
   - `patches/90-multi-agent-tier1-cockpit.patch`
2. **Quy tắc Kiểm tra Trùng lặp (DRY):**
   Mã nguồn của built-in extension nằm tại `src/stable/extensions/multi-agent-harness/`. Thư mục `vscode/extensions/multi-agent-harness` chỉ là một symbolic link. Không bao giờ copy đè file thủ công.
3. **Cập nhật Lại Đồ thị Tri thức:**
   Sau khi sửa code hoặc rebase:
   ```bash
   graphify update .
   ```
   Đồ thị tại `graphify-out/graph.json` sẽ tự động cập nhật ngay lập tức với chi phí 0 token.

