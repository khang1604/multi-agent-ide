# Technical Specification 09: IPC Protocol, WebSocket JSON-RPC & Data Contracts

## 1. Executive Summary & Communication Topology

MAHub IDE operates as a decoupled client-server architecture:
- **Backend Daemon (`mahub`)**: Python 3.11+ process running an `asyncio` event bus, FastAPI/Uvicorn WebSocket server, Git worktree manager, and SQLite event journal.
- **Frontend Extension (`mahub-ide`)**: VS Code / VSCodium TypeScript extension hosting a React 18 Webview.

Communication uses **JSON-RPC 2.0 over Local WebSocket** (`ws://127.0.0.1:<port>/ws`), secured by an ephemeral bearer authentication token generated upon daemon startup.

---

## 2. Authentication & Handshake Protocol

```
+-------------------+                                +--------------------+
| Extension Webview |                                | Python Core Daemon |
+---------+---------+                                +---------+----------+
          |                                                    |
          | 1. Connect: ws://127.0.0.1:42800/ws               |
          +--------------------------------------------------->|
          |                                                    |
          | 2. Auth Handshake Request                          |
          |    {"jsonrpc": "2.0", "id": 1,                     |
          |     "method": "auth.handshake",                    |
          |     "params": {"token": "ephemeral-secret-token"}} |
          +--------------------------------------------------->|
          |                                                    |
          | 3. Auth Response                                   |
          |    {"jsonrpc": "2.0", "id": 1,                     |
          |     "result": {"status": "authenticated",          |
          |                "version": "1.0.0",                 |
          |                "active_project": "multi_agents"}}  |
          |<---------------------------------------------------+
          |                                                    |
          | 4. Subscription to Event Stream                    |
          |    {"jsonrpc": "2.0", "id": 2,                     |
          |     "method": "stream.subscribe",                  |
          |     "params": {"topics": ["plan", "agent", "gate"]}|
          +--------------------------------------------------->|
```

---

## 3. Core Data Contracts (JSON Schemas)

### 3.1 PlanManifest Schema (`PlanManifest.json`)
The central artifact orchestrating the execution graph:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PlanManifest",
  "type": "object",
  "required": ["plan_id", "project_path", "target_goal", "tasks", "status", "created_at"],
  "properties": {
    "plan_id": { "type": "string", "format": "uuid" },
    "project_path": { "type": "string" },
    "target_goal": { "type": "string" },
    "status": { 
      "type": "string", 
      "enum": ["PLANNING", "IN_PROGRESS", "VERIFYING", "COMPLETED", "FAILED", "BLOCKED"] 
    },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["task_id", "title", "assigned_agent", "dependencies", "status"],
        "properties": {
          "task_id": { "type": "string" },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "assigned_agent": {
            "type": "string",
            "enum": ["architect", "coder", "auditor", "navigator"]
          },
          "assigned_model": { "type": "string" },
          "dependencies": {
            "type": "array",
            "items": { "type": "string" }
          },
          "worktree_path": { "type": "string" },
          "branch_name": { "type": "string" },
          "status": {
            "type": "string",
            "enum": ["PENDING", "IN_PROGRESS", "VERIFYING", "VERIFIED", "REJECTED"]
          },
          "artifacts": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": { "type": "string", "enum": ["diff_patch", "test_report", "ast_graph"] },
                "path": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

---

### 3.2 EventStream Record Schema (SQLite & Streaming)
Every action is serialized into the local SQLite `events` table and streamed via WebSocket:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EventStreamRecord",
  "type": "object",
  "required": ["event_id", "plan_id", "timestamp", "agent_role", "event_type", "payload"],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "plan_id": { "type": "string", "format": "uuid" },
    "task_id": { "type": ["string", "null"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "agent_role": { "type": "string" },
    "event_type": {
      "type": "string",
      "enum": [
        "AGENT_THOUGHT_DELTA",
        "TOKEN_STREAM_DELTA",
        "TOOL_EXECUTION_START",
        "TOOL_EXECUTION_OUTPUT",
        "NODE_STATUS_CHANGED",
        "SYNTAX_GUARD_FAILURE",
        "RISK_GATE_TRIGGERED",
        "RISK_GATE_RESOLVED",
        "WORKTREE_MERGED"
      ]
    },
    "payload": { "type": "object" },
    "token_metrics": {
      "type": "object",
      "properties": {
        "prompt_tokens": { "type": "integer" },
        "completion_tokens": { "type": "integer" },
        "cost_usd": { "type": "number" },
        "latency_ms": { "type": "number" }
      }
    }
  }
}
```

---

## 4. Real-time Streaming Messages

### 4.1 Real-time Token Streaming (`TOKEN_STREAM_DELTA`)
```json
{
  "jsonrpc": "2.0",
  "method": "stream.event",
  "params": {
    "event_type": "TOKEN_STREAM_DELTA",
    "task_id": "task-auth-401",
    "agent_role": "coder",
    "delta": "function validateToken(token: string): boolean {\n",
    "accumulated_tokens": 142
  }
}
```

### 4.2 Interactive DAG State Update (`NODE_STATUS_CHANGED`)
```json
{
  "jsonrpc": "2.0",
  "method": "stream.event",
  "params": {
    "event_type": "NODE_STATUS_CHANGED",
    "task_id": "task-auth-401",
    "old_status": "IN_PROGRESS",
    "new_status": "VERIFYING",
    "progress_percent": 75,
    "current_action": "Running unit test suite: tests/test_auth.py"
  }
}
```

### 4.3 3-Tier Human Risk Gate Request (`RISK_GATE_TRIGGERED`)
```json
{
  "jsonrpc": "2.0",
  "method": "stream.event",
  "params": {
    "event_type": "RISK_GATE_TRIGGERED",
    "gate_id": "gate-9081",
    "tier": 3,
    "action_type": "TERMINAL_EXECUTION",
    "target": "npm install -g risky-package",
    "risk_score": "HIGH",
    "reasoning": "Attempting global package installation requiring root privileges.",
    "timeout_seconds": 300
  }
}
```

Operator Response:
```json
{
  "jsonrpc": "2.0",
  "id": 105,
  "method": "gate.resolve",
  "params": {
    "gate_id": "gate-9081",
    "verdict": "REJECT",
    "feedback": "Do not install globally; use project-local devDependencies."
  }
}
```

