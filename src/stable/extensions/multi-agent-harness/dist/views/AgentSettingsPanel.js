"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSettingsPanel = void 0;
const vscode = require("vscode");
class AgentSettingsPanel {
    _daemonBridge;
    static currentPanel;
    _panel;
    _disposables = [];
    static async createOrShow(extensionUri, daemonBridge) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (AgentSettingsPanel.currentPanel) {
            AgentSettingsPanel.currentPanel._panel.reveal(column);
            await AgentSettingsPanel.currentPanel.sendState();
            return;
        }
        const panel = vscode.window.createWebviewPanel('multiAgent.settings', '⚙️ Multi-Agent Settings & Providers', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri]
        });
        AgentSettingsPanel.currentPanel = new AgentSettingsPanel(panel, daemonBridge);
    }
    constructor(panel, _daemonBridge) {
        this._daemonBridge = _daemonBridge;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview();
        this._panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'onGetDoctor':
                    await this.sendState();
                    break;
                case 'onLoginProvider':
                    await this.handleLoginProvider(data.provider);
                    break;
                case 'onSetApiKey':
                    await this.handleSetApiKey(data.provider);
                    break;
                case 'onBrowseExecutable':
                    await this.handleBrowseExecutable();
                    break;
                case 'onSaveCustomProvider':
                    await this.saveCustomProvider(data.provider);
                    break;
                case 'onDeleteCustomProvider':
                    await this.deleteCustomProvider(data.id);
                    break;
                case 'onUpdateRoleMapping':
                    await this.updateRoleMapping(data.mapping);
                    break;
                case 'onOpenVscodeSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgent');
                    break;
            }
        }, null, this._disposables);
        this.sendState();
    }
    async sendState() {
        const config = vscode.workspace.getConfiguration('multiAgent');
        let doctor;
        if (this._daemonBridge) {
            try {
                doctor = await this._daemonBridge.getDoctor();
            }
            catch (e) {
                console.warn('[AgentSettingsPanel] getDoctor error:', e);
            }
        }
        this._panel.webview.postMessage({
            type: 'providersState',
            doctor,
            roleMapping: config.get('roleMapping'),
            customProviders: config.get('customProviders')
        });
    }
    async handleLoginProvider(provider) {
        let cmd = '';
        const prov = (provider || '').toLowerCase();
        if (prov.includes('antigravity') || prov === 'agy') {
            cmd = 'agy auth login';
        }
        else if (prov.includes('codex')) {
            cmd = 'codex login';
        }
        else if (prov.includes('claude')) {
            cmd = 'claude login';
        }
        else if (prov.includes('copilot')) {
            cmd = 'gh auth login';
        }
        else {
            cmd = `${provider} login`;
        }
        const term = vscode.window.createTerminal({
            name: `Agent Auth: ${provider.toUpperCase()}`
        });
        term.show();
        term.sendText(cmd);
        vscode.window.showInformationMessage(`Đã mở Terminal để đăng nhập ${provider.toUpperCase()}. Vui lòng làm theo hướng dẫn trong Terminal.`);
    }
    async handleSetApiKey(provider) {
        const prov = (provider || '').toLowerCase();
        let envVarName = 'API_KEY';
        if (prov.includes('codex') || prov.includes('openai'))
            envVarName = 'OPENAI_API_KEY';
        else if (prov.includes('claude') || prov.includes('anthropic'))
            envVarName = 'ANTHROPIC_API_KEY';
        else if (prov.includes('antigravity') || prov.includes('gemini'))
            envVarName = 'GEMINI_API_KEY';
        const key = await vscode.window.showInputBox({
            prompt: `Nhập giá trị ${envVarName} cho ${provider.toUpperCase()}`,
            password: true,
            placeHolder: 'sk-...'
        });
        if (key) {
            process.env[envVarName] = key;
            vscode.window.showInformationMessage(`Đã lưu ${envVarName} vào môi trường runtime.`);
            await this.sendState();
        }
    }
    async handleBrowseExecutable() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: 'Chọn file thực thi CLI của Agent'
        });
        if (uris && uris[0]) {
            this._panel.webview.postMessage({
                type: 'setCustomPath',
                path: uris[0].fsPath
            });
        }
    }
    async saveCustomProvider(provider) {
        if (!provider || !provider.id || !provider.command) {
            vscode.window.showErrorMessage('Agent ID và Lệnh thực thi không được để trống.');
            return;
        }
        const config = vscode.workspace.getConfiguration('multiAgent');
        const existing = config.get('customProviders') || [];
        const updated = [...existing.filter(p => p.id !== provider.id), provider];
        await config.update('customProviders', updated, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Đã đăng ký Agent CLI "${provider.name || provider.id}" thành công.`);
        await this.sendState();
    }
    async deleteCustomProvider(providerId) {
        const config = vscode.workspace.getConfiguration('multiAgent');
        const existing = config.get('customProviders') || [];
        const updated = existing.filter(p => p.id !== providerId);
        await config.update('customProviders', updated, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Đã gỡ bỏ Agent CLI "${providerId}".`);
        await this.sendState();
    }
    async updateRoleMapping(mapping) {
        const config = vscode.workspace.getConfiguration('multiAgent');
        await config.update('roleMapping', mapping, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Đã cập nhật phân công vai trò Swarm thành công.');
        await this.sendState();
    }
    dispose() {
        AgentSettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x)
                x.dispose();
        }
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Agent Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
      padding: 24px 32px;
      margin: 0;
      line-height: 1.5;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-icon {
      font-size: 28px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--vscode-foreground, #fff);
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: var(--vscode-descriptionForeground, #8b949e);
    }
    .tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 20px;
      padding-bottom: 4px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground, #8b949e);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      color: var(--vscode-foreground, #fff);
      background: rgba(255, 255, 255, 0.05);
    }
    .tab-btn.active {
      color: #58a6ff;
      background: rgba(56, 139, 253, 0.15);
    }
    .tab-content {
      display: none;
      animation: fadeIn 0.15s ease-in-out;
    }
    .tab-content.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 14px;
      transition: border-color 0.2s ease;
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.16);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground, #fff);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #8b949e);
      margin-bottom: 10px;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      letter-spacing: 0.3px;
    }
    .badge-ready {
      background: rgba(46, 160, 67, 0.15);
      color: #3fb950;
      border: 1px solid rgba(46, 160, 67, 0.3);
    }
    .badge-warning {
      background: rgba(210, 153, 34, 0.15);
      color: #e3b341;
      border: 1px solid rgba(210, 153, 34, 0.35);
    }
    .badge-missing {
      background: rgba(139, 148, 158, 0.15);
      color: #8b949e;
      border: 1px solid rgba(139, 148, 158, 0.3);
    }
    .badge-custom {
      background: rgba(163, 113, 247, 0.15);
      color: #bc8cff;
      border: 1px solid rgba(163, 113, 247, 0.35);
    }
    .alert-box {
      background: rgba(210, 153, 34, 0.1);
      border: 1px solid rgba(210, 153, 34, 0.3);
      color: #e3b341;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .actions-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn {
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .btn-primary {
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground, #0062a3);
    }
    .btn-danger {
      background: rgba(248, 81, 73, 0.1);
      color: #f85149;
      border: 1px solid rgba(248, 81, 73, 0.3);
    }
    .btn-danger:hover {
      background: rgba(248, 81, 73, 0.2);
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground, #fff);
      margin-bottom: 6px;
    }
    .form-input, .form-select {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background, #252526);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12.5px;
      font-family: inherit;
    }
    .form-input:focus, .form-select:focus {
      outline: 1px solid var(--vscode-focusBorder, #007acc);
    }
    .hint-text {
      font-size: 11.5px;
      color: var(--vscode-descriptionForeground, #8b949e);
      margin-top: 4px;
      line-height: 1.4;
    }
    .roles-checkboxes {
      display: flex;
      gap: 16px;
      margin-top: 6px;
    }
    .roles-checkboxes label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .footer-bar {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">⚙️</div>
      <div>
        <h1>Quản lý Agent & Cài đặt Swarm</h1>
        <p>Cấu hình các CLI Engine, đăng nhập tài khoản API và phân chia vai trò Architect / Worker / Auditor.</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="tab-providers">🤖 Danh sách Agent & Đăng nhập</button>
      <button class="tab-btn" data-tab="tab-roles">🎯 Phân công vai trò (Roles)</button>
      <button class="tab-btn" data-tab="tab-add">➕ Thêm Agent tùy chỉnh</button>
    </div>

    <!-- TAB 1: Danh sách Agent & Đăng nhập -->
    <div id="tab-providers" class="tab-content active">
      <div id="providersList">
        <div style="padding: 20px; text-align: center; color: #8b949e;">Đang kiểm tra trạng thái các Agent...</div>
      </div>
      <div style="margin-top: 14px;">
        <button id="refreshDoctorBtn" class="btn">🔄 Kiểm tra lại trạng thái (Probe)</button>
      </div>
    </div>

    <!-- TAB 2: Phân công vai trò -->
    <div id="tab-roles" class="tab-content">
      <div class="card">
        <div class="card-title" style="margin-bottom: 12px;">Phân công nhiệm vụ cho Swarm Workflow</div>
        
        <div class="form-group">
          <label class="form-label">🏛️ Lead Architect (Lập kế hoạch & Living Plan):</label>
          <select id="selArchitect" class="form-select"></select>
          <div class="hint-text">Chịu trách nhiệm phân tích yêu cầu từ người dùng, thiết kế domain model và lập Living PLAN.md.</div>
        </div>

        <div class="form-group">
          <label class="form-label">⚡ Algorithm Worker (Lập trình viên & Staging):</label>
          <select id="selWorker" class="form-select"></select>
          <div class="hint-text">Chịu trách nhiệm trực tiếp viết mã nguồn các file và đưa vào vùng Staging cho người dùng duyệt.</div>
        </div>

        <div class="form-group">
          <label class="form-label">🛡️ Security Auditor (Kiểm duyệt bảo mật & AST):</label>
          <select id="selAuditor" class="form-select"></select>
          <div class="hint-text">Chịu trách nhiệm độc lập rà soát lỗi cú pháp TypeScript, quy chuẩn AST và tính toàn vẹn bảo mật.</div>
        </div>

        <button id="saveRolesBtn" class="btn btn-primary" style="margin-top: 8px;">💾 Lưu phân công vai trò</button>
      </div>
    </div>

    <!-- TAB 3: Thêm Agent tùy chỉnh -->
    <div id="tab-add" class="tab-content">
      <div class="card">
        <div class="card-title" style="margin-bottom: 6px;">Đăng ký công cụ AI bên ngoài vào Swarm</div>
        <div class="hint-text" style="margin-bottom: 16px;">Bạn có thể tích hợp bất kỳ công cụ lập trình AI dạng dòng lệnh (CLI) nào có trên máy tính của bạn.</div>

        <div class="form-group">
          <label class="form-label">Mẫu cấu hình sẵn (Khuyên dùng):</label>
          <select id="presetTemplate" class="form-select">
            <option value="">-- Chọn mẫu cấu hình sẵn để tự động điền --</option>
            <option value="aider">Aider (AI Pair Programming CLI)</option>
            <option value="ollama">Ollama (Offline Local LLM: qwen2.5-coder)</option>
            <option value="claude">Claude Code CLI (Anthropic)</option>
            <option value="gemini">Gemini CLI (Google)</option>
            <option value="custom">Tùy chỉnh khác (Nhập thủ công)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Tên định danh (ID):</label>
          <input id="customId" class="form-input" placeholder="Ví dụ: aider, ollama, custom-agent" />
          <div class="hint-text">Tên ngắn gọn không dấu để hiển thị trong danh sách phân vai.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Lệnh CLI hoặc đường dẫn file thực thi:</label>
          <div style="display: flex; gap: 8px;">
            <input id="customCmd" class="form-input" placeholder="Ví dụ: aider hoặc /usr/local/bin/aider" />
            <button id="browseCmdBtn" class="btn" type="button" title="Duyệt file trên máy">📂 Duyệt file...</button>
          </div>
          <div class="hint-text">Nhập tên lệnh có sẵn trong PATH của Terminal, hoặc bấm "Duyệt file..." để trỏ tới file chạy.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Vai trò Agent có thể đảm nhiệm:</label>
          <div class="roles-checkboxes">
            <label><input type="checkbox" id="rolePlan" /> 🏛️ Lập kế hoạch (Plan)</label>
            <label><input type="checkbox" id="roleImpl" checked /> ⚡ Viết code (Code / Implement)</label>
            <label><input type="checkbox" id="roleReview" checked /> 🛡️ Soát lỗi & Review (Audit)</label>
          </div>
        </div>

        <button id="addCustomBtn" class="btn btn-primary">+ Đăng ký Agent vào Swarm</button>
      </div>

      <div class="card-title" style="margin-top: 20px; margin-bottom: 10px;">Danh sách Agent tùy chỉnh đã đăng ký</div>
      <div id="customAgentsList">
        <div style="font-size:12px; color:#8b949e;">Chưa có Agent tùy chỉnh nào.</div>
      </div>
    </div>

    <div class="footer-bar">
      <span style="font-size:12px; color:#8b949e;">Multi-Agent IDE Settings • Cấu hình lưu trữ trong VS Code Settings</span>
      <button id="openVscodeSettingsBtn" class="btn">⚙️ Mở trong VS Code Settings</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const providersList = document.getElementById('providersList');
    const refreshDoctorBtn = document.getElementById('refreshDoctorBtn');
    const saveRolesBtn = document.getElementById('saveRolesBtn');
    const addCustomBtn = document.getElementById('addCustomBtn');
    const browseCmdBtn = document.getElementById('browseCmdBtn');
    const presetTemplate = document.getElementById('presetTemplate');
    const customId = document.getElementById('customId');
    const customCmd = document.getElementById('customCmd');
    const rolePlan = document.getElementById('rolePlan');
    const roleImpl = document.getElementById('roleImpl');
    const roleReview = document.getElementById('roleReview');
    const selArchitect = document.getElementById('selArchitect');
    const selWorker = document.getElementById('selWorker');
    const selAuditor = document.getElementById('selAuditor');
    const customAgentsList = document.getElementById('customAgentsList');
    const openVscodeSettingsBtn = document.getElementById('openVscodeSettingsBtn');

    // Tab Navigation
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      });
    });

    // Preset Auto-fill
    if (presetTemplate) {
      presetTemplate.addEventListener('change', () => {
        const val = presetTemplate.value;
        if (val === 'aider') {
          customId.value = 'aider';
          customCmd.value = 'aider';
          rolePlan.checked = false;
          roleImpl.checked = true;
          roleReview.checked = true;
        } else if (val === 'ollama') {
          customId.value = 'ollama';
          customCmd.value = 'ollama run qwen2.5-coder';
          rolePlan.checked = true;
          roleImpl.checked = true;
          roleReview.checked = true;
        } else if (val === 'claude') {
          customId.value = 'claude';
          customCmd.value = 'claude';
          rolePlan.checked = true;
          roleImpl.checked = true;
          roleReview.checked = true;
        } else if (val === 'gemini') {
          customId.value = 'gemini';
          customCmd.value = 'gemini';
          rolePlan.checked = true;
          roleImpl.checked = true;
          roleReview.checked = true;
        }
      });
    }

    if (browseCmdBtn) {
      browseCmdBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'onBrowseExecutable' });
      });
    }

    refreshDoctorBtn.addEventListener('click', () => {
      providersList.innerHTML = '<div style=\"padding:20px;text-align:center;color:#8b949e;\">Đang kiểm tra kết nối các Agent...</div>';
      vscode.postMessage({ type: 'onGetDoctor' });
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
      vscode.postMessage({ type: 'onOpenVscodeSettings' });
    });

    // Event delegation for cards
    document.addEventListener('click', (e) => {
      const loginBtn = e.target.closest('.btn-login');
      if (loginBtn && loginBtn.dataset.provider) {
        vscode.postMessage({ type: 'onLoginProvider', provider: loginBtn.dataset.provider });
        return;
      }
      const keyBtn = e.target.closest('.btn-apikey');
      if (keyBtn && keyBtn.dataset.provider) {
        vscode.postMessage({ type: 'onSetApiKey', provider: keyBtn.dataset.provider });
        return;
      }
      const delBtn = e.target.closest('.btn-delete-custom');
      if (delBtn && delBtn.dataset.id) {
        vscode.postMessage({ type: 'onDeleteCustomProvider', id: delBtn.dataset.id });
        return;
      }
    });

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderProviders(doctor, roleMapping, customProviders) {
      if (!doctor || !doctor.providers) return;
      providersList.innerHTML = '';
      const availableEngines = Object.keys(doctor.providers);

      if (customProviders && Array.isArray(customProviders)) {
        customProviders.forEach(cp => {
          if (!availableEngines.includes(cp.id)) availableEngines.push(cp.id);
        });
      }

      // Populate Role mapping selects
      [selArchitect, selWorker, selAuditor].forEach(sel => {
        const curVal = sel.value;
        sel.innerHTML = '';
        availableEngines.forEach(eng => {
          const opt = document.createElement('option');
          opt.value = eng;
          let label = eng.toUpperCase();
          if (eng === 'antigravity') label = '🏛️ Google Antigravity / Gemini';
          else if (eng === 'codex') label = '⚡ OpenAI Codex';
          else if (eng === 'claude') label = '🏛️ Claude Code (Anthropic)';
          else if (eng === 'copilot') label = '⚡ GitHub Copilot';
          opt.innerText = label;
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

      // Health mapping
      const healthMap = {};
      if (doctor.health && Array.isArray(doctor.health)) {
        doctor.health.forEach(h => {
          healthMap[h.provider] = h.reason;
        });
      }

      // Render Provider Cards
      Object.entries(doctor.providers).forEach(([name, p]) => {
        const card = document.createElement('div');
        card.className = 'card';

        const isAvailable = p.available === true;
        const healthErr = healthMap[name];
        let statusBadge = '';
        if (isAvailable && (!healthErr || healthErr.trim() === '')) {
          statusBadge = '<span class=\"badge badge-ready\">🟢 SẴN SÀNG</span>';
        } else if (isAvailable && healthErr) {
          statusBadge = '<span class=\"badge badge-warning\">⚠️ HẾT QUOTA / CẦN ĐĂNG NHẬP</span>';
        } else {
          statusBadge = '<span class=\"badge badge-missing\">⚪ CHƯA CÀI ĐẶT</span>';
        }

        let displayName = name.toUpperCase();
        let providerDesc = '';
        if (name === 'antigravity') {
          displayName = 'Google Antigravity (agy)';
          providerDesc = 'Engine chính thức từ Google, hỗ trợ mô hình Gemini 2.5 Pro và Claude 3.7 qua Antigravity CLI.';
        } else if (name === 'codex') {
          displayName = 'OpenAI Codex (codex)';
          providerDesc = 'Công cụ lập trình AI từ OpenAI, hỗ trợ các mô hình GPT-4o và o3-mini.';
        } else if (name === 'claude') {
          displayName = 'Claude Code (claude)';
          providerDesc = 'Agent CLI chuyên nghiệp từ Anthropic, hỗ trợ mô hình Claude 3.7 Sonnet.';
        } else if (name === 'copilot') {
          displayName = 'GitHub Copilot (copilot)';
          providerDesc = 'GitHub Copilot CLI hỗ trợ kiểm tra và viết mã.';
        }

        let alertHtml = '';
        if (healthErr) {
          const cleanReason = healthErr.length > 200 ? healthErr.slice(0, 195) + '...' : healthErr;
          alertHtml = '<div class=\"alert-box\">⚠️ <strong>Cảnh báo hạn mức / Phiên đăng nhập:</strong> ' + escapeHtml(cleanReason) + '</div>';
        } else if (!isAvailable && p.reason) {
          alertHtml = '<div class=\"alert-box\" style=\"color:#8b949e; background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1);\">' + escapeHtml(p.reason) + '</div>';
        }

        const actionsHtml = '<div class=\"actions-row\">' +
          '<button class=\"btn btn-primary btn-login\" data-provider=\"' + escapeHtml(name) + '\" title=\"Mở Terminal để đăng nhập ' + escapeHtml(name) + '\">' +
            '🔑 Đăng nhập thủ công' +
          '</button>' +
          '<button class=\"btn btn-apikey\" data-provider=\"' + escapeHtml(name) + '\" title=\"Nhập API Key cho ' + escapeHtml(name) + '\">' +
            '🗝️ Nhập API Key' +
          '</button>' +
        '</div>';

        card.innerHTML = '<div class=\"card-header\">' +
            '<span class=\"card-title\">' + escapeHtml(displayName) + '</span>' +
            statusBadge +
          '</div>' +
          '<div class=\"card-meta\">' + escapeHtml(providerDesc) + '<br>' + (p.version ? 'Phiên bản: ' + escapeHtml(p.version) : (p.command ? 'Lệnh: ' + escapeHtml(p.command.join(' ')) : 'Chưa tìm thấy lệnh CLI trong PATH')) + '</div>' +
          alertHtml +
          actionsHtml;

        providersList.appendChild(card);
      });

      // Render custom providers in TAB 3
      if (customAgentsList) {
        customAgentsList.innerHTML = '';
        if (customProviders && Array.isArray(customProviders) && customProviders.length > 0) {
          customProviders.forEach(cp => {
            const item = document.createElement('div');
            item.className = 'card';
            item.innerHTML = '<div class=\"card-header\">' +
                '<span class=\"card-title\">🤖 ' + escapeHtml(cp.name || cp.id) + '</span>' +
                '<span class=\"badge badge-custom\">CUSTOM CLI</span>' +
              '</div>' +
              '<div class=\"card-meta\">Lệnh thực thi: <code>' + escapeHtml(cp.command) + '</code> | Vai trò: ' + escapeHtml((cp.roles || []).join(', ')) + '</div>' +
              '<div class=\"actions-row\">' +
                '<button class=\"btn btn-danger btn-delete-custom\" data-id=\"' + escapeHtml(cp.id) + '\">🗑️ Gỡ bỏ Agent</button>' +
              '</div>';
            customAgentsList.appendChild(item);
          });
        } else {
          customAgentsList.innerHTML = '<div style=\"font-size:12px; color:#8b949e; padding:8px 0;\">Chưa có Agent tùy chỉnh nào. Bạn có thể thêm ở biểu mẫu phía trên.</div>';
        }
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'providersState') {
        renderProviders(msg.doctor, msg.roleMapping, msg.customProviders);
      } else if (msg.type === 'setCustomPath' && msg.path) {
        if (customCmd) customCmd.value = msg.path;
      }
    });

    // Request state on load
    vscode.postMessage({ type: 'onGetDoctor' });
  </script>
</body>
</html>`;
    }
}
exports.AgentSettingsPanel = AgentSettingsPanel;
//# sourceMappingURL=AgentSettingsPanel.js.map