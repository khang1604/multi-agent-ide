import * as vscode from 'vscode';
import { WorktreeManager } from '../worktree/WorktreeManager';
import { ArtifactManager } from '../artifacts/ArtifactManager';
import { DaemonBridge, StatusResult } from '../daemon/DaemonBridge';

export interface AgentStatus {
  id: string;
  name: string;
  role: 'Architect' | 'Worker' | 'Auditor' | 'Triage';
  model: string;
  state: 'idle' | 'planning' | 'executing' | 'reviewing' | 'waiting_approval';
  currentTask?: string;
  tokensUsed: number;
}

export class SwarmControlProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multi-agent.swarmControlView';
  private _view?: vscode.WebviewView;

  private agents: AgentStatus[] = [
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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    _worktreeMgr: WorktreeManager,
    private readonly artifactMgr: ArtifactManager,
    private readonly daemonBridge?: DaemonBridge
  ) {
    if (this.daemonBridge) {
      this.daemonBridge.onDidStatusChange((status) => {
        this.syncWithDaemonStatus(status);
      });
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
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
        case 'onOpenCockpit':
          vscode.commands.executeCommand('multiAgent.setupCockpitLayout');
          break;
        case 'onToggleDaemon':
          if (data.action === 'start') {
            await this.daemonBridge?.startDaemon();
          } else {
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
          } else {
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

  private syncWithDaemonStatus(status: StatusResult): void {
    if (!this._view) return;

    const activeWorkflow = status.workflows.find((w) =>
      ['queued', 'running', 'waiting', 'recovering'].includes(w.status)
    );

    if (activeWorkflow) {
      if (activeWorkflow.phase === 'plan' || activeWorkflow.status === 'queued') {
        this.updateAgentState('agent-architect', 'planning', activeWorkflow.objective);
        this.updateAgentState('agent-coder', 'idle');
        this.updateAgentState('agent-auditor', 'idle');
      } else if (activeWorkflow.phase === 'implement') {
        this.updateAgentState('agent-architect', 'idle');
        this.updateAgentState(
          'agent-coder',
          'executing',
          `Implementing: ${activeWorkflow.summary || activeWorkflow.objective}`
        );
        this.updateAgentState('agent-auditor', 'idle');
      } else if (activeWorkflow.phase === 'review') {
        this.updateAgentState('agent-architect', 'idle');
        this.updateAgentState('agent-coder', 'idle');
        this.updateAgentState('agent-auditor', 'reviewing', 'Auditing changes & running verification');
      }
    } else {
      const needsReview = status.workflows.find((w) => w.status === 'needs_review');
      if (needsReview) {
        this.updateAgentState('agent-architect', 'waiting_approval', 'Awaiting operator review/approval');
      } else {
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

  public updateAgentState(agentId: string, state: AgentStatus['state'], task?: string, tokens = 0): void {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.state = state;
      if (task !== undefined) agent.currentTask = task;
      agent.tokensUsed += tokens;
      this.updateSwarmView();
    }
  }

  private updateSwarmView(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateAgents',
        agents: this.agents,
      });
    }
  }

  private async handleUserPrompt(prompt: string): Promise<void> {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user message to chat stream
    this._view?.webview.postMessage({
      type: 'appendChatMessage',
      sender: 'You',
      role: 'user',
      text: prompt,
      time
    });

    // Append Architect acknowledgement
    this._view?.webview.postMessage({
      type: 'appendChatMessage',
      sender: 'Lead Architect',
      role: 'agent',
      text: `Objective received. Analyzing task boundaries, preparing living PLAN.md, and orchestrating worker worktrees...`,
      time
    });

    this.updateAgentState('agent-architect', 'planning', prompt);

    if (this.daemonBridge) {
      try {
        const res = await this.daemonBridge.dispatch(prompt);
        this._view?.webview.postMessage({
          type: 'appendChatMessage',
          sender: 'Swarm Hub',
          role: 'system',
          text: `Workflow ${res.id} queued in Python Hub Daemon (status: ${res.status}).`,
          time
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this._view?.webview.postMessage({
          type: 'appendChatMessage',
          sender: 'Swarm Hub',
          role: 'system',
          text: `Daemon dispatch note: ${msg}. Continuing in standalone Cockpit mode.`,
          time
        });
      }
    }

    // Update living PLAN.md
    const planContent = `# Living PLAN.md\n\n> Objective: ${prompt}\n\n## Tasks\n- [ ] [Architect] Decompose and validate task boundaries\n- [ ] [Worker] Create worktree & implement code changes\n- [ ] [Auditor] Verify lint, types, and test assertions\n`;
    await this.artifactMgr.saveArtifact('PLAN.md', planContent);
  }

  private getHtmlForWebview(): string {
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
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      overflow: hidden;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-shrink: 0;
    }
    .header-title {
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--vscode-foreground);
    }
    .top-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--vscode-widget-border, #444);
      background: rgba(255, 255, 255, 0.05);
      color: var(--vscode-foreground);
    }
    .btn-pill:hover {
      background: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
    }
    .daemon-pill {
      font-size: 10px;
      padding: 2px 7px;
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
    .swimlanes {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 4px;
      margin-bottom: 10px;
      flex-shrink: 0;
    }
    .swim-card {
      border: 1px solid var(--vscode-widget-border, #333);
      background: var(--vscode-editor-background);
      border-radius: 4px;
      padding: 6px 4px;
      text-align: center;
    }
    .swim-role {
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 2px;
    }
    .badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      display: inline-block;
    }
    .badge-idle { opacity: 0.6; }
    .badge-running { background: #007acc; color: white; }
    .badge-waiting { background: #e5a50a; color: black; font-weight: bold; }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
      margin-bottom: 10px;
    }
    .chat-bubble {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .chat-bubble.user {
      background: var(--vscode-editor-selectionBackground, #264f78);
      align-self: flex-end;
      max-width: 88%;
      color: var(--vscode-editor-foreground);
    }
    .chat-bubble.agent {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, #333);
      align-self: flex-start;
      max-width: 95%;
    }
    .chat-bubble.system {
      background: rgba(255, 255, 255, 0.04);
      border-left: 3px solid #007acc;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      align-self: stretch;
    }
    .bubble-meta {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
      color: var(--vscode-descriptionForeground);
    }
    .prompt-footer {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
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
      resize: none;
      height: 60px;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .action-row {
      display: flex;
      gap: 6px;
    }
    button {
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      flex: 1;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="header-title">🤖 Swarm Chat</div>
    <div class="top-actions">
      <div id="cockpitBtn" class="btn-pill" title="Reset Cockpit 3-Column Layout">⊞ Cockpit</div>
      <div id="daemonPill" class="daemon-pill stopped" title="Click to start/stop Python Hub Daemon">DAEMON: STOPPED</div>
    </div>
  </div>

  <div class="swimlanes">
    <div class="swim-card">
      <div class="swim-role">🧠 Architect</div>
      <span class="badge badge-idle" id="badge-architect">IDLE</span>
    </div>
    <div class="swim-card">
      <div class="swim-role">⚡ Worker</div>
      <span class="badge badge-idle" id="badge-coder">IDLE</span>
    </div>
    <div class="swim-card">
      <div class="swim-role">🛡️ Auditor</div>
      <span class="badge badge-idle" id="badge-auditor">IDLE</span>
    </div>
  </div>

  <div id="chatMessages" class="chat-container">
    <div class="chat-bubble system">
      <div class="bubble-meta">
        <span>System</span>
        <span>Ready</span>
      </div>
      <div>Multi-Agent IDE Swarm initialized. Type an objective below to orchestrate Architect (Plan), Worker (Code), and Auditor (Verify).</div>
    </div>
  </div>

  <div class="prompt-footer">
    <textarea id="promptInput" placeholder="Chat with Swarm or dispatch task (Enter to send, Shift+Enter for newline)..."></textarea>
    <div class="action-row">
      <button id="dispatchBtn">Send to Swarm</button>
      <button id="approveBtn" class="btn-secondary" title="Approve current living PLAN.md and spawn isolated git worktree">Approve Plan</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const btn = document.getElementById('dispatchBtn');
    const approveBtn = document.getElementById('approveBtn');
    const cockpitBtn = document.getElementById('cockpitBtn');
    const input = document.getElementById('promptInput');
    const daemonPill = document.getElementById('daemonPill');
    const chatContainer = document.getElementById('chatMessages');

    let currentDaemonState = 'stopped';

    function scrollToBottom() {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendMessage(sender, role, text, time) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-bubble ' + (role || 'agent');

      const metaDiv = document.createElement('div');
      metaDiv.className = 'bubble-meta';
      metaDiv.innerHTML = '<span>' + sender + '</span><span>' + (time || '') + '</span>';

      const textDiv = document.createElement('div');
      textDiv.innerText = text;

      msgDiv.appendChild(metaDiv);
      msgDiv.appendChild(textDiv);
      chatContainer.appendChild(msgDiv);
      scrollToBottom();
    }

    function doSend() {
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ type: 'onStartPrompt', value: text });
      input.value = '';
    }

    btn.addEventListener('click', doSend);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    approveBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'onApprovePlan' });
    });

    cockpitBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'onOpenCockpit' });
    });

    daemonPill.addEventListener('click', () => {
      const nextAction = currentDaemonState === 'running' ? 'stop' : 'start';
      vscode.postMessage({ type: 'onToggleDaemon', action: nextAction });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'appendChatMessage') {
        appendMessage(msg.sender, msg.role, msg.text, msg.time);
      } else if (msg.type === 'updateAgents') {
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
      }
    });
  </script>
</body>
</html>`;
  }
}
