"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmControlProvider = void 0;
const vscode = require("vscode");
class SwarmControlProvider {
    _extensionUri;
    artifactMgr;
    static viewType = 'multi-agent.swarmControlView';
    _view;
    agents = [
        {
            id: 'agent-architect',
            name: 'Lead Architect',
            role: 'Architect',
            model: 'Claude 3.7 Sonnet',
            state: 'idle',
            tokensUsed: 0,
        },
        {
            id: 'agent-coder',
            name: 'Algorithm Worker',
            role: 'Worker',
            model: 'OpenAI o3-mini',
            state: 'idle',
            tokensUsed: 0,
        },
        {
            id: 'agent-auditor',
            name: 'Repo & Security Auditor',
            role: 'Auditor',
            model: 'Gemini 2.5 Pro',
            state: 'idle',
            tokensUsed: 0,
        },
    ];
    constructor(_extensionUri, _worktreeMgr, artifactMgr) {
        this._extensionUri = _extensionUri;
        this.artifactMgr = artifactMgr;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this.getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'onStartPrompt':
                    await this.handleUserPrompt(data.value);
                    break;
                case 'onApprovePlan':
                    vscode.commands.executeCommand('multiAgent.approvePlan');
                    break;
                case 'onRefresh':
                    this.updateSwarmView();
                    break;
            }
        });
    }
    updateAgentState(agentId, state, task, tokens = 0) {
        const agent = this.agents.find((a) => a.id === agentId);
        if (agent) {
            agent.state = state;
            if (task !== undefined)
                agent.currentTask = task;
            agent.tokensUsed += tokens;
            this.updateSwarmView();
        }
    }
    updateSwarmView() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateAgents',
                agents: this.agents,
            });
        }
    }
    async handleUserPrompt(prompt) {
        vscode.window.showInformationMessage(`Multi Agent IDE: Processing task "${prompt.slice(0, 40)}..."`);
        this.updateAgentState('agent-architect', 'planning', prompt);
        // Simulate Architect formulating a PlanManifest living artifact
        const samplePlan = `---
title: "Plan: ${prompt.slice(0, 30)}"
user_facing: true
request_feedback: true
status: "pending_approval"
---

### Architecture & Execution Plan
1. [ ] Analyze affected modules
2. [ ] Spawn isolated Git Worktree
3. [ ] Implement core logic
4. [ ] Run tests and verify
`;
        await this.artifactMgr.saveArtifact('PLAN.md', samplePlan);
        this.updateAgentState('agent-architect', 'waiting_approval', 'Awaiting operator approval for PLAN.md');
    }
    getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 10px;
      margin: 0;
      background: transparent;
      font-size: 13px;
    }
    .header {
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
    }
    .agent-card {
      border: 1px solid var(--vscode-widget-border, #333);
      background: var(--vscode-editor-background);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .agent-title {
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge-idle { opacity: 0.6; }
    .badge-running { background: #007acc; color: white; }
    .badge-waiting { background: #e5a50a; color: black; font-weight: bold; }
    .meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    .prompt-box {
      margin-top: 14px;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
    }
    button {
      margin-top: 6px;
      width: 100%;
      padding: 7px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">Active Multi-Agent Swarm</div>
  
  <div class="agent-card">
    <div class="agent-title">
      <span>Lead Architect</span>
      <span class="badge badge-idle" id="badge-architect">IDLE</span>
    </div>
    <div class="meta">Model: Claude 3.7 Sonnet | Role: Plan & Review</div>
  </div>

  <div class="agent-card">
    <div class="agent-title">
      <span>Algorithm Worker</span>
      <span class="badge badge-idle" id="badge-coder">IDLE</span>
    </div>
    <div class="meta">Model: OpenAI o3-mini | Role: Code & Test Suite</div>
  </div>

  <div class="agent-card">
    <div class="agent-title">
      <span>Security & Repo Auditor</span>
      <span class="badge badge-idle" id="badge-auditor">IDLE</span>
    </div>
    <div class="meta">Model: Gemini 2.5 Pro | Role: 2M Context & QA</div>
  </div>

  <div class="prompt-box">
    <div class="header">Dispatch Task to Swarm</div>
    <textarea id="promptInput" placeholder="E.g. Refactor auth service using HttpOnly cookies..."></textarea>
    <button id="dispatchBtn">Dispatch to Architect</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const btn = document.getElementById('dispatchBtn');
    const input = document.getElementById('promptInput');

    btn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ type: 'onStartPrompt', value: text });
      input.value = '';
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'updateAgents') {
        msg.agents.forEach(a => {
          const badge = document.getElementById('badge-' + a.role.toLowerCase());
          if (badge) {
            badge.innerText = a.state.toUpperCase();
            badge.className = 'badge ' + (a.state === 'idle' ? 'badge-idle' : (a.state === 'waiting_approval' ? 'badge-waiting' : 'badge-running'));
          }
        });
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.SwarmControlProvider = SwarmControlProvider;
//# sourceMappingURL=SwarmControlProvider.js.map