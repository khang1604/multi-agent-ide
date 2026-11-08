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
                case 'onOpenCockpit':
                    vscode.commands.executeCommand('multiAgent.setupCockpitLayout');
                    break;
                case 'onGetDoctor':
                    await this.sendProvidersState();
                    break;
                case 'onSaveCustomProvider':
                    await this.saveCustomProvider(data.provider);
                    break;
                case 'onUpdateRoleMapping':
                    await this.updateRoleMapping(data.mapping);
                    break;
                case 'onOpenSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgent');
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
        // Trigger initial status check & providers probe
        if (this.daemonBridge) {
            this.daemonBridge.getStatus().then((status) => this.syncWithDaemonStatus(status));
        }
        this.sendProvidersState();
    }
    async sendProvidersState() {
        if (!this._view)
            return;
        const config = vscode.workspace.getConfiguration('multiAgent');
        let doctor = undefined;
        if (this.daemonBridge) {
            try {
                doctor = await this.daemonBridge.getDoctor();
            }
            catch (e) {
                console.warn('[multi-agent-harness] getDoctor error:', e);
            }
        }
        this._view.webview.postMessage({
            type: 'providersState',
            doctor,
            roleMapping: config.get('roleMapping'),
            customProviders: config.get('customProviders')
        });
    }
    async saveCustomProvider(provider) {
        if (!provider || !provider.id || !provider.command) {
            vscode.window.showErrorMessage('Agent ID and Command path are required.');
            return;
        }
        const config = vscode.workspace.getConfiguration('multiAgent');
        const existing = config.get('customProviders') || [];
        const updated = [...existing.filter(p => p.id !== provider.id), provider];
        await config.update('customProviders', updated, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Agent CLI "${provider.name || provider.id}" registered successfully.`);
        await this.sendProvidersState();
    }
    async updateRoleMapping(mapping) {
        const config = vscode.workspace.getConfiguration('multiAgent');
        await config.update('roleMapping', mapping, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Swarm workflow role mapping updated.');
        await this.sendProvidersState();
    }
    openConfigPanel() {
        this._view?.webview.postMessage({ type: 'toggleConfig', open: true });
        this.sendProvidersState();
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
            }
            catch (err) {
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
    .config-drawer {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-focusBorder, #007acc);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      max-height: 300px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .config-header {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }
    .config-section {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, #333);
      border-radius: 4px;
      padding: 6px;
      margin-bottom: 6px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .role-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11px;
    }
    .role-grid select {
      width: 100%;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 2px 4px;
      font-size: 11px;
    }
    .config-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 4px 6px;
      font-size: 11px;
      margin-bottom: 4px;
      border-radius: 3px;
    }
    .probe-item {
      font-size: 11px;
      padding: 3px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .probe-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .probe-ready {
      background: rgba(115, 201, 145, 0.2);
      color: #73c991;
      border: 1px solid #73c991;
    }
    .probe-missing {
      background: rgba(200, 200, 200, 0.1);
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="header-title">🤖 Swarm Chat</div>
    <div class="top-actions">
      <div id="configBtn" class="btn-pill" title="Configure Agent Providers & Custom CLIs">⚙️ Agents</div>
      <div id="cockpitBtn" class="btn-pill" title="Reset Cockpit 3-Column Layout">⊞ Cockpit</div>
      <div id="daemonPill" class="daemon-pill stopped" title="Click to start/stop Python Hub Daemon">DAEMON: STOPPED</div>
    </div>
  </div>

  <!-- Agent Config Drawer -->
  <div id="configDrawer" class="config-drawer" style="display: none;">
    <div class="config-header">
      <span>Agent CLI & Providers</span>
      <span id="closeConfigBtn" style="cursor:pointer; font-weight: bold;">✕</span>
    </div>

    <!-- Role Mapping -->
    <div class="config-section">
      <div class="section-title">Workflow Role Assignment</div>
      <div class="role-grid">
        <label>Architect:
          <select id="selArchitect">
            <option value="antigravity">Google Antigravity (agy)</option>
            <option value="claude">Claude Code (claude)</option>
          </select>
        </label>
        <label>Worker:
          <select id="selWorker">
            <option value="codex">OpenAI Codex (codex)</option>
            <option value="antigravity">Google Antigravity (agy)</option>
          </select>
        </label>
        <label>Auditor:
          <select id="selAuditor">
            <option value="antigravity">Gemini Auditor (agy)</option>
            <option value="codex">Codex Linter</option>
          </select>
        </label>
      </div>
      <button id="saveRolesBtn" style="margin-top:6px; padding:4px;">Apply Role Assignment</button>
    </div>

    <!-- Detected CLI Probes -->
    <div class="config-section">
      <div class="section-title">Installed CLI Engines</div>
      <div id="providersProbeList" class="probe-list">
        <div class="probe-item"><span>Checking CLI probes...</span></div>
      </div>
      <button id="runDoctorBtn" class="btn-secondary" style="margin-top:6px; padding:4px;">Probe CLI Engines (Doctor)</button>
    </div>

    <!-- Register Custom CLI -->
    <div class="config-section">
      <div class="section-title">+ Register Custom Agent CLI</div>
      <input id="customId" class="config-input" placeholder="Agent ID (e.g. aider, gemini-cli)" />
      <input id="customCmd" class="config-input" placeholder="Command (e.g. /usr/local/bin/aider or aider)" />
      <div style="font-size:10px; margin-top:4px; display:flex; gap:10px;">
        <label><input type="checkbox" id="rolePlan" /> Plan</label>
        <label><input type="checkbox" id="roleImpl" checked /> Code</label>
        <label><input type="checkbox" id="roleReview" checked /> Review</label>
      </div>
      <button id="addCustomBtn" style="margin-top:6px; padding:4px;">Register Custom CLI</button>
    </div>

    <button id="openVscodeSettingsBtn" class="btn-secondary" style="margin-top:4px; padding:4px;">Open Full VS Code Settings (GUI)</button>
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
    const configBtn = document.getElementById('configBtn');
    const closeConfigBtn = document.getElementById('closeConfigBtn');
    const configDrawer = document.getElementById('configDrawer');
    const input = document.getElementById('promptInput');
    const daemonPill = document.getElementById('daemonPill');
    const chatContainer = document.getElementById('chatMessages');

    const selArchitect = document.getElementById('selArchitect');
    const selWorker = document.getElementById('selWorker');
    const selAuditor = document.getElementById('selAuditor');
    const saveRolesBtn = document.getElementById('saveRolesBtn');
    const providersProbeList = document.getElementById('providersProbeList');
    const runDoctorBtn = document.getElementById('runDoctorBtn');
    const addCustomBtn = document.getElementById('addCustomBtn');
    const customId = document.getElementById('customId');
    const customCmd = document.getElementById('customCmd');
    const rolePlan = document.getElementById('rolePlan');
    const roleImpl = document.getElementById('roleImpl');
    const roleReview = document.getElementById('roleReview');
    const openVscodeSettingsBtn = document.getElementById('openVscodeSettingsBtn');

    let currentDaemonState = 'stopped';
    let availableEngines = ['antigravity', 'codex', 'claude', 'copilot'];

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

    configBtn.addEventListener('click', () => {
      const isVisible = configDrawer.style.display !== 'none';
      configDrawer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        vscode.postMessage({ type: 'onGetDoctor' });
      }
    });

    closeConfigBtn.addEventListener('click', () => {
      configDrawer.style.display = 'none';
    });

    daemonPill.addEventListener('click', () => {
      const nextAction = currentDaemonState === 'running' ? 'stop' : 'start';
      vscode.postMessage({ type: 'onToggleDaemon', action: nextAction });
    });

    saveRolesBtn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'onUpdateRoleMapping',
        mapping: {
          architect: selArchitect.value,
          worker: selWorker.value,
          auditor: selAuditor.value
        }
      });
    });

    runDoctorBtn.addEventListener('click', () => {
      providersProbeList.innerHTML = '<div class="probe-item"><span>Probing CLI engines...</span></div>';
      vscode.postMessage({ type: 'onGetDoctor' });
    });

    addCustomBtn.addEventListener('click', () => {
      const id = customId.value.trim();
      const cmd = customCmd.value.trim();
      if (!id || !cmd) return;

      const roles = [];
      if (rolePlan.checked) roles.push('plan');
      if (roleImpl.checked) roles.push('implement');
      if (roleReview.checked) roles.push('review');

      vscode.postMessage({
        type: 'onSaveCustomProvider',
        provider: { id, name: id, command: cmd, roles }
      });

      customId.value = '';
      customCmd.value = '';
    });

    openVscodeSettingsBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'onOpenSettings' });
    });

    function renderProviders(doctor, roleMapping, customProviders) {
      if (!doctor || !doctor.providers) return;
      providersProbeList.innerHTML = '';
      availableEngines = Object.keys(doctor.providers);

      if (customProviders && Array.isArray(customProviders)) {
        customProviders.forEach(cp => {
          if (!availableEngines.includes(cp.id)) availableEngines.push(cp.id);
        });
      }

      // Populate Selects
      [selArchitect, selWorker, selAuditor].forEach(sel => {
        const curVal = sel.value;
        sel.innerHTML = '';
        availableEngines.forEach(eng => {
          const opt = document.createElement('option');
          opt.value = eng;
          opt.innerText = eng.charAt(0).toUpperCase() + eng.slice(1);
          sel.appendChild(opt);
        });
        if (curVal && availableEngines.includes(curVal)) {
          sel.value = curVal;
        }
      });

      if (roleMapping) {
        if (roleMapping.architect) selArchitect.value = roleMapping.architect;
        if (roleMapping.worker) selWorker.value = roleMapping.worker;
        if (roleMapping.auditor) selAuditor.value = roleMapping.auditor;
      }

      // Render probe items
      Object.entries(doctor.providers).forEach(([name, p]) => {
        const item = document.createElement('div');
        item.className = 'probe-item';
        const isReady = p.available === true;
        item.innerHTML = '<span>' + name.toUpperCase() + (p.version ? ' <small style="opacity:0.7">(' + p.version.slice(0, 18) + ')</small>' : '') + '</span>' +
          '<span class="probe-badge ' + (isReady ? 'probe-ready' : 'probe-missing') + '">' + (isReady ? 'READY' : 'NOT FOUND') + '</span>';
        providersProbeList.appendChild(item);
      });

      // Custom providers
      if (customProviders && Array.isArray(customProviders)) {
        customProviders.forEach(cp => {
          const item = document.createElement('div');
          item.className = 'probe-item';
          item.innerHTML = '<span>' + cp.id.toUpperCase() + ' <small style="opacity:0.7">(Custom CLI: ' + cp.command.slice(0, 20) + ')</small></span>' +
            '<span class="probe-badge probe-ready">CUSTOM</span>';
          providersProbeList.appendChild(item);
        });
      }
    }

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
      } else if (msg.type === 'providersState' || msg.type === 'doctorResult') {
        renderProviders(msg.doctor, msg.roleMapping, msg.customProviders);
      } else if (msg.type === 'toggleConfig') {
        configDrawer.style.display = msg.open ? 'block' : 'none';
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.SwarmControlProvider = SwarmControlProvider;
//# sourceMappingURL=SwarmControlProvider.js.map