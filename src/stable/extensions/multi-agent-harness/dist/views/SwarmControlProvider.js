"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmControlProvider = void 0;
const vscode = require("vscode");
class SwarmControlProvider {
    _extensionUri;
    artifactMgr;
    daemonBridge;
    static viewType = 'multi-agent.swarmControlView';
    _view;
    agents = [
        {
            id: 'agent-architect',
            name: 'Lead Architect',
            role: 'Architect',
            model: 'Antigravity / Claude 3.7',
            state: 'idle',
            tokensUsed: 0,
        },
        {
            id: 'agent-coder',
            name: 'Algorithm Worker',
            role: 'Worker',
            model: 'Codex / o3-mini',
            state: 'idle',
            tokensUsed: 0,
        },
        {
            id: 'agent-auditor',
            name: 'Repo & Security Auditor',
            role: 'Auditor',
            model: 'Antigravity / Gemini 2.5',
            state: 'idle',
            tokensUsed: 0,
        },
    ];
    constructor(_extensionUri, _worktreeMgr, artifactMgr, daemonBridge) {
        this._extensionUri = _extensionUri;
        this.artifactMgr = artifactMgr;
        this.daemonBridge = daemonBridge;
        if (this.daemonBridge) {
            this.daemonBridge.onDidStatusChange((status) => {
                this.syncWithDaemonStatus(status);
            });
        }
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
                case 'onToggleDaemon':
                    if (data.action === 'start') {
                        await this.daemonBridge?.startDaemon();
                    }
                    else {
                        await this.daemonBridge?.stopDaemon();
                    }
                    break;
                case 'onCancelWorkflow':
                    if (data.workflowId) {
                        await this.daemonBridge?.cancel(data.workflowId);
                        vscode.window.showInformationMessage(`Workflow ${data.workflowId} cancelled.`);
                    }
                    break;
                case 'onRefresh':
                    if (this.daemonBridge) {
                        const status = await this.daemonBridge.getStatus();
                        this.syncWithDaemonStatus(status);
                    }
                    else {
                        this.updateSwarmView();
                    }
                    break;
            }
        });
        // Trigger initial status check
        if (this.daemonBridge) {
            this.daemonBridge.getStatus().then((status) => this.syncWithDaemonStatus(status));
        }
    }
    syncWithDaemonStatus(status) {
        if (!this._view)
            return;
        const activeWorkflow = status.workflows.find((w) => ['queued', 'running', 'waiting', 'recovering'].includes(w.status));
        if (activeWorkflow) {
            if (activeWorkflow.phase === 'plan' || activeWorkflow.status === 'queued') {
                this.updateAgentState('agent-architect', 'planning', activeWorkflow.objective);
                this.updateAgentState('agent-coder', 'idle');
                this.updateAgentState('agent-auditor', 'idle');
            }
            else if (activeWorkflow.phase === 'implement') {
                this.updateAgentState('agent-architect', 'idle');
                this.updateAgentState('agent-coder', 'executing', `Implementing: ${activeWorkflow.summary || activeWorkflow.objective}`);
                this.updateAgentState('agent-auditor', 'idle');
            }
            else if (activeWorkflow.phase === 'review') {
                this.updateAgentState('agent-architect', 'idle');
                this.updateAgentState('agent-coder', 'idle');
                this.updateAgentState('agent-auditor', 'reviewing', 'Auditing changes & running verification');
            }
        }
        else {
            const needsReview = status.workflows.find((w) => w.status === 'needs_review');
            if (needsReview) {
                this.updateAgentState('agent-architect', 'waiting_approval', 'Awaiting operator review/approval');
            }
            else {
                this.updateAgentState('agent-architect', 'idle');
                this.updateAgentState('agent-coder', 'idle');
                this.updateAgentState('agent-auditor', 'idle');
            }
        }
        this._view.webview.postMessage({
            type: 'daemonUpdate',
            daemon: status.daemon,
            workflow: activeWorkflow || status.workflows[0] || null,
            workflows: status.workflows.slice(0, 5),
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
        vscode.window.showInformationMessage(`Multi Agent IDE: Dispatching task "${prompt.slice(0, 40)}..."`);
        this.updateAgentState('agent-architect', 'planning', prompt);
        if (this.daemonBridge) {
            try {
                const res = await this.daemonBridge.dispatch(prompt);
                vscode.window.showInformationMessage(`Swarm Workflow ${res.id} queued successfully.`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Swarm dispatch error: ${msg}`);
            }
        }
        // Also update living PLAN.md
        const planContent = `# Living PLAN.md\n\n> Objective: ${prompt}\n\n## Tasks\n- [ ] [Architect] Decompose and validate task boundaries\n- [ ] [Worker] Create worktree & implement code changes\n- [ ] [Auditor] Verify lint, types, and test assertions\n`;
        await this.artifactMgr.saveArtifact('PLAN.md', planContent);
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
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .header {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
    }
    .daemon-pill {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .daemon-pill.running {
      background: rgba(115, 201, 145, 0.2);
      color: #73c991;
      border: 1px solid #73c991;
    }
    .daemon-pill.stopped {
      background: rgba(200, 200, 200, 0.1);
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-widget-border);
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
    .workflow-card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-focusBorder, #007acc);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 12px;
      display: none;
    }
    .workflow-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--vscode-editor-foreground);
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
    button.btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      margin-top: 4px;
    }
    button.btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="header-row">
    <div class="header">Multi-Agent Swarm HUD</div>
    <div id="daemonPill" class="daemon-pill stopped" title="Click to start/stop Python Hub Daemon">DAEMON: STOPPED</div>
  </div>

  <div id="activeWorkflowCard" class="workflow-card">
    <div class="header">Active Workflow</div>
    <div id="wfTitle" class="workflow-title">-</div>
    <div id="wfMeta" class="meta">Phase: - | Calls: 0</div>
    <button id="cancelWfBtn" class="btn-secondary" style="margin-top:8px;">Cancel Workflow</button>
  </div>
  
  <div class="agent-card">
    <div class="agent-title">
      <span>Lead Architect</span>
      <span class="badge badge-idle" id="badge-architect">IDLE</span>
    </div>
    <div class="meta">Engine: Antigravity (agy) | Role: Plan & DAG</div>
  </div>

  <div class="agent-card">
    <div class="agent-title">
      <span>Algorithm Worker</span>
      <span class="badge badge-idle" id="badge-coder">IDLE</span>
    </div>
    <div class="meta">Engine: Codex (codex) | Role: Worktree Code</div>
  </div>

  <div class="agent-card">
    <div class="agent-title">
      <span>Security & Repo Auditor</span>
      <span class="badge badge-idle" id="badge-auditor">IDLE</span>
    </div>
    <div class="meta">Engine: Gemini / Linter | Role: Verify & Merge</div>
  </div>

  <div class="prompt-box">
    <div class="header">Dispatch Task to Swarm</div>
    <textarea id="promptInput" placeholder="E.g. Refactor auth service using HttpOnly cookies..."></textarea>
    <button id="dispatchBtn">Dispatch to Swarm</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const btn = document.getElementById('dispatchBtn');
    const input = document.getElementById('promptInput');
    const daemonPill = document.getElementById('daemonPill');
    const wfCard = document.getElementById('activeWorkflowCard');
    const wfTitle = document.getElementById('wfTitle');
    const wfMeta = document.getElementById('wfMeta');
    const cancelWfBtn = document.getElementById('cancelWfBtn');

    let currentDaemonState = 'stopped';
    let currentWorkflowId = null;

    daemonPill.addEventListener('click', () => {
      const nextAction = currentDaemonState === 'running' ? 'stop' : 'start';
      vscode.postMessage({ type: 'onToggleDaemon', action: nextAction });
    });

    cancelWfBtn.addEventListener('click', () => {
      if (currentWorkflowId) {
        vscode.postMessage({ type: 'onCancelWorkflow', workflowId: currentWorkflowId });
      }
    });

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
      } else if (msg.type === 'daemonUpdate') {
        currentDaemonState = msg.daemon;
        daemonPill.innerText = 'DAEMON: ' + msg.daemon.toUpperCase();
        daemonPill.className = 'daemon-pill ' + msg.daemon;

        if (msg.workflow) {
          wfCard.style.display = 'block';
          currentWorkflowId = msg.workflow.id;
          wfTitle.innerText = msg.workflow.objective ? msg.workflow.objective.slice(0, 50) : msg.workflow.id;
          wfMeta.innerText = 'Phase: ' + msg.workflow.phase.toUpperCase() + ' | Calls: ' + msg.workflow.calls + '/' + msg.workflow.max_calls + ' | Status: ' + msg.workflow.status;
        } else {
          wfCard.style.display = 'none';
          currentWorkflowId = null;
        }
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.SwarmControlProvider = SwarmControlProvider;
//# sourceMappingURL=SwarmControlProvider.js.map