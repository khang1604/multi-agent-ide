"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const WorktreeManager_1 = require("./worktree/WorktreeManager");
const ArtifactManager_1 = require("./artifacts/ArtifactManager");
const DiffProvider_1 = require("./diff/DiffProvider");
const SwarmControlProvider_1 = require("./views/SwarmControlProvider");
const DaemonBridge_1 = require("./daemon/DaemonBridge");
const AuditorDiagnostics_1 = require("./auditor/AuditorDiagnostics");
const StorageLayout_1 = require("./storage/StorageLayout");
const IdeMcpServer_1 = require("./mcp/IdeMcpServer");
function activate(context) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const worktreeMgr = new WorktreeManager_1.WorktreeManager(rootPath);
    const artifactMgr = new ArtifactManager_1.ArtifactManager(rootPath);
    const diffProvider = DiffProvider_1.AgentDiffProvider.getInstance();
    const daemonBridge = DaemonBridge_1.DaemonBridge.getInstance(rootPath);
    const auditorDiagMgr = AuditorDiagnostics_1.AuditorDiagnosticsManager.getInstance(rootPath);
    context.subscriptions.push({ dispose: () => auditorDiagMgr.dispose() });
    // Start native MCP Server over Unix Domain Socket for external CLI agents
    const mcpServer = IdeMcpServer_1.IdeMcpServer.getInstance(rootPath);
    mcpServer.start().catch((err) => {
        console.warn('[multi-agent-harness] IdeMcpServer start error:', err);
    });
    context.subscriptions.push({ dispose: () => mcpServer.stop() });
    // Initialize Daemon Bridge & start background status sync
    daemonBridge.init().then(async () => {
        daemonBridge.startSync(3000);
        await validateAndEnforceRoles(daemonBridge);
    }).catch((err) => {
        console.warn('[multi-agent-harness] DaemonBridge init error:', err);
    });
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('multiAgent.roleMapping') || e.affectsConfiguration('multiAgent.apiKey')) {
            const config = vscode.workspace.getConfiguration('multiAgent');
            const openaiKey = config.get('apiKey.openai');
            if (openaiKey)
                process.env.OPENAI_API_KEY = openaiKey;
            const anthropicKey = config.get('apiKey.anthropic');
            if (anthropicKey)
                process.env.ANTHROPIC_API_KEY = anthropicKey;
            const geminiKey = config.get('apiKey.gemini');
            if (geminiKey)
                process.env.GEMINI_API_KEY = geminiKey;
            await validateAndEnforceRoles(daemonBridge);
        }
    }));
    // 1. Register diff content provider
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DiffProvider_1.AgentDiffProvider.scheme, diffProvider));
    // 2. Register Webview Views with Daemon Bridge
    const swarmProvider = new SwarmControlProvider_1.SwarmControlProvider(context.extensionUri, worktreeMgr, artifactMgr, daemonBridge, rootPath);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SwarmControlProvider_1.SwarmControlProvider.viewType, swarmProvider));
    // 3. Register Status Bar HUD
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'multi-agent.swarmControlView.focus';
    statusBarItem.tooltip = 'Click to open Multi-Agent Swarm Chat & Control Center';
    const updateStatusBar = (daemon, workflowCount = 0) => {
        if (daemon === 'running') {
            statusBarItem.text = `$(hub-pulse) Swarm: Active${workflowCount > 0 ? ` (${workflowCount} tasks)` : ''}`;
            statusBarItem.color = '#73c991';
        }
        else {
            statusBarItem.text = `$(circle-slash) Swarm: Stopped`;
            statusBarItem.color = undefined;
        }
        statusBarItem.show();
    };
    daemonBridge.onDidStatusChange((status) => {
        const activeCount = status.workflows.filter((w) => ['queued', 'running', 'waiting', 'recovering'].includes(w.status)).length;
        updateStatusBar(status.daemon, activeCount);
    });
    daemonBridge.getStatus().then((s) => updateStatusBar(s.daemon)).catch(() => { });
    context.subscriptions.push(statusBarItem);
    // 4. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.startDaemon', async () => {
        try {
            const res = await daemonBridge.startDaemon();
            vscode.window.showInformationMessage(`Multi-Agent Daemon started (PID: ${res.pid || 'running'})`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Start daemon error: ${msg}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.stopDaemon', async () => {
        try {
            await daemonBridge.stopDaemon();
            vscode.window.showInformationMessage('Multi-Agent Daemon stop requested.');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Stop daemon error: ${msg}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.showDoctor', async () => {
        try {
            const doc = await daemonBridge.getDoctor();
            const providers = Object.entries(doc.providers)
                .map(([name, p]) => `${name}: ${p.available ? 'OK' : 'Unavailable (' + p.reason + ')'}`)
                .join('\n');
            vscode.window.showInformationMessage(`Multi-Agent Doctor:\nPython: ${doc.python} | Daemon: ${doc.daemon}\n${providers}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Doctor error: ${msg}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.clearAuditorDiagnostics', () => {
        auditorDiagMgr.clear();
        vscode.window.showInformationMessage('Auditor diagnostics cleared.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.simulateAuditorReport', () => {
        auditorDiagMgr.setIssues([
            {
                file: 'PLAN.md',
                line: 1,
                message: 'Plan verified: 0 critical vulnerabilities detected. Ready for implementation.',
                severity: 'info',
                source: 'Gemini Auditor'
            }
        ]);
        vscode.window.showInformationMessage('Auditor report simulated: diagnostics updated.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.assignRoles', async () => {
        let doctor;
        try {
            doctor = await daemonBridge.getDoctor();
        }
        catch (e) {
            vscode.window.showErrorMessage('Unable to query Agent status from Hub.');
            return;
        }
        if (!doctor || !doctor.providers) {
            vscode.window.showErrorMessage('No Agent providers detected.');
            return;
        }
        const healthMap = {};
        if (doctor.health && Array.isArray(doctor.health)) {
            for (const h of doctor.health) {
                if (h.reason && h.reason.trim())
                    healthMap[h.provider] = h.reason;
            }
        }
        const isUsable = (name) => {
            const p = doctor.providers[name];
            if (!p)
                return { usable: false, reason: 'Not installed' };
            if (p.available !== true)
                return { usable: false, reason: p.reason || 'CLI not installed' };
            if (healthMap[name])
                return { usable: false, reason: healthMap[name] };
            return { usable: true };
        };
        const rolePick = await vscode.window.showQuickPick([
            { label: '🏛️ Lead Architect', role: 'architect', description: 'Decompose requirements into living PLAN.md' },
            { label: '⚡ Algorithm Worker', role: 'worker', description: 'Source code implementation and diff staging' },
            { label: '🛡️ Security Auditor', role: 'auditor', description: 'AST validation and security verification' }
        ], { placeHolder: 'Select Swarm role to configure' });
        if (!rolePick)
            return;
        const config = vscode.workspace.getConfiguration('multiAgent');
        const currentRoleMapping = config.get('roleMapping') || {};
        const currentAssigned = config.get(`roleMapping.${rolePick.role}`) || currentRoleMapping[rolePick.role] || 'antigravity';
        const providerOptions = Object.keys(doctor.providers).map(provName => {
            const check = isUsable(provName);
            let label = provName.toUpperCase();
            if (provName === 'antigravity')
                label = 'Google Antigravity (Gemini)';
            else if (provName === 'codex')
                label = 'OpenAI Codex';
            else if (provName === 'claude')
                label = 'Anthropic Claude Code';
            else if (provName === 'copilot')
                label = 'GitHub Copilot';
            const isCurrent = currentAssigned === provName;
            if (check.usable) {
                return {
                    label: `$(check) ${label}${isCurrent ? ' (Current)' : ''}`,
                    id: provName,
                    usable: true,
                    description: 'Ready'
                };
            }
            else {
                let cleanReason = check.reason || 'Unavailable';
                if (cleanReason.includes('quota') || cleanReason.includes('limit'))
                    cleanReason = 'Quota limit reached';
                else if (cleanReason.includes('not installed'))
                    cleanReason = 'CLI not installed';
                return {
                    label: `$(circle-slash) ${label}`,
                    id: provName,
                    usable: false,
                    description: `Cannot select: ${cleanReason}`
                };
            }
        });
        const chosen = await vscode.window.showQuickPick(providerOptions, {
            placeHolder: `Choose an agent for ${rolePick.label}`
        });
        if (!chosen)
            return;
        if (!chosen.usable) {
            vscode.window.showErrorMessage(`"${chosen.id.toUpperCase()}" cannot be selected: ${chosen.description}. Please choose an agent with "Ready" status.`);
            return;
        }
        currentRoleMapping[rolePick.role] = chosen.id;
        await config.update(`roleMapping.${rolePick.role}`, chosen.id, vscode.ConfigurationTarget.Global);
        await config.update('roleMapping', currentRoleMapping, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Successfully assigned "${chosen.id.toUpperCase()}" as ${rolePick.label}.`);
    }), vscode.commands.registerCommand('multiAgent.configureProviders', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgent');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.newSession', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Describe the engineering task for the Multi Agent Swarm',
            placeHolder: 'e.g. Implement rate limiting middleware and unit tests',
        });
        if (input) {
            try {
                const res = await daemonBridge.dispatch(input);
                vscode.window.showInformationMessage(`Task dispatched to Swarm (Workflow: ${res.id})`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Dispatch error: ${msg}`);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.approvePlan', async () => {
        vscode.window.showInformationMessage('Plan approved! Swarm is executing plan and scaffolding project...');
        try {
            const taskId = `task-${Date.now()}`;
            const info = await worktreeMgr.createWorktree(taskId);
            vscode.window.showInformationMessage(`Worktree created at: ${info.worktreePath} (Branch: ${info.branch})`);
            await swarmProvider.handleApprovePlan();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to create worktree: ${message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.refreshWorktrees', async () => {
        const list = await worktreeMgr.listWorktrees();
        vscode.window.showInformationMessage(`Active Worktrees: ${list.length}`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.openArchitectureMap', async () => {
        const mapUri = vscode.Uri.file(path.join(rootPath, 'docs', 'architecture', 'VISUAL_FLOW_MAP.md'));
        try {
            await vscode.commands.executeCommand('markdown.showPreview', mapUri);
        }
        catch {
            const doc = await vscode.workspace.openTextDocument(mapUri);
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Three, preview: true });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.setupCockpitLayout', async () => {
        await vscode.commands.executeCommand('vscode.setEditorLayout', {
            orientation: 0,
            groups: [{ size: 0.28 }, { size: 0.44 }, { size: 0.28 }],
        });
        const planPath = StorageLayout_1.StorageLayout.getPlanFile(rootPath);
        const diffPath = StorageLayout_1.StorageLayout.getDiffStagingFile(rootPath);
        const activityPath = StorageLayout_1.StorageLayout.getActivityStreamFile(rootPath);
        try {
            await StorageLayout_1.StorageLayout.ensureDirectories(rootPath);
            await fs.mkdir(path.dirname(diffPath), { recursive: true });
            try {
                await fs.access(planPath);
            }
            catch {
                await fs.writeFile(planPath, '# Living PLAN.md\n\n> Multi-Agent Execution Plan\n\n## 1. Objectives\n- [ ] Task 1: Inception\n', 'utf-8');
            }
            try {
                await fs.access(diffPath);
            }
            catch {
                await fs.writeFile(diffPath, '# Continuous Multi-Diff Staging\n# Waiting for Swarm dispatches...\n', 'utf-8');
            }
            try {
                await fs.access(activityPath);
            }
            catch {
                await fs.writeFile(activityPath, '# Swarm Activity Stream\n\n- [Architect] Initialized\n- [Worker] Standby\n- [Auditor] Standby\n', 'utf-8');
            }
            const planDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
            await vscode.window.showTextDocument(planDoc, { viewColumn: vscode.ViewColumn.One, preview: false });
            // Column 2: Prefer Native Continuous Multi-Diff Editor (Tier 2)
            try {
                await vscode.commands.executeCommand('workbench.action.multiAgent.openContinuousDiff');
            }
            catch {
                const diffDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(diffPath));
                await vscode.window.showTextDocument(diffDoc, { viewColumn: vscode.ViewColumn.Two, preview: false });
            }
            const actDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(activityPath));
            await vscode.window.showTextDocument(actDoc, { viewColumn: vscode.ViewColumn.Three, preview: false });
            vscode.window.showInformationMessage('Swarm Cockpit 3-Column Layout active.');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Cockpit setup error: ${msg}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.focusLayout', async () => {
        await vscode.commands.executeCommand('vscode.setEditorLayout', {
            orientation: 0,
            groups: [{ size: 1.0 }],
        });
    }), vscode.commands.registerCommand('multiAgent.openPlan', async () => {
        const planPath = StorageLayout_1.StorageLayout.getPlanFile(rootPath);
        await StorageLayout_1.StorageLayout.ensureDirectories(rootPath);
        if (!fsSync.existsSync(planPath)) {
            await fs.writeFile(planPath, '# Living PLAN.md\n\n> Multi-Agent Execution Plan\n', 'utf-8');
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
        await vscode.window.showTextDocument(doc, { preview: false });
    }), vscode.commands.registerCommand('multiAgent.openDiff', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.multiAgent.openContinuousDiff');
        }
        catch {
            const diffPath = StorageLayout_1.StorageLayout.getDiffStagingFile(rootPath);
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(diffPath));
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    }), vscode.commands.registerCommand('multiAgent.openActivity', async () => {
        const actPath = StorageLayout_1.StorageLayout.getActivityStreamFile(rootPath);
        await StorageLayout_1.StorageLayout.ensureDirectories(rootPath);
        if (!fsSync.existsSync(actPath)) {
            await fs.writeFile(actPath, '# Swarm Activity Stream\n', 'utf-8');
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(actPath));
        await vscode.window.showTextDocument(doc, { preview: false });
    }));
    // Auto-reveal Swarm Chat (Secondary Sidebar on the right) on launch without forcing 3-column clutter
    setTimeout(async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.openSecondarySidebar');
            await vscode.commands.executeCommand('multi-agent.swarmControlView.focus');
        }
        catch { }
    }, 1000);
    console.log('Multi Agent IDE Harness Core Extension activated.');
}
function deactivate() {
    const daemonBridge = DaemonBridge_1.DaemonBridge.getInstance();
    daemonBridge.stopSync();
    const mcpServer = IdeMcpServer_1.IdeMcpServer.getInstance();
    mcpServer.stop();
}
async function validateAndEnforceRoles(daemonBridge) {
    const config = vscode.workspace.getConfiguration('multiAgent');
    let doctor;
    try {
        doctor = await daemonBridge.getDoctor();
    }
    catch (e) {
        console.warn('[multi-agent-harness] Doctor probe failed:', e);
        return;
    }
    if (!doctor || !doctor.providers)
        return;
    const healthMap = {};
    if (doctor.health && Array.isArray(doctor.health)) {
        for (const h of doctor.health) {
            if (h.reason && h.reason.trim()) {
                healthMap[h.provider] = h.reason;
            }
        }
    }
    const isUsable = (provName) => {
        const p = doctor.providers[provName];
        if (!p)
            return { usable: false, reason: 'CLI engine not configured' };
        if (p.available !== true)
            return { usable: false, reason: p.reason || 'CLI not installed or not on PATH' };
        if (healthMap[provName])
            return { usable: false, reason: healthMap[provName] };
        return { usable: true };
    };
    // Find a reliable fallback provider that is available
    let fallback = 'antigravity';
    if (!isUsable('antigravity').usable) {
        const candidate = Object.keys(doctor.providers).find(k => isUsable(k).usable);
        if (candidate)
            fallback = candidate;
    }
    const roles = ['architect', 'worker', 'auditor'];
    const currentRoleMapping = config.get('roleMapping') || {};
    for (const role of roles) {
        const assigned = config.get(`roleMapping.${role}`) || currentRoleMapping[role] || 'antigravity';
        const check = isUsable(assigned);
        if (!check.usable) {
            let cleanReason = check.reason || 'Unavailable';
            if (cleanReason.includes('quota') || cleanReason.includes('limit')) {
                cleanReason = 'Quota limit reached';
            }
            else if (cleanReason.includes('not installed')) {
                cleanReason = 'CLI is not installed';
            }
            vscode.window.showWarningMessage(`Agent "${assigned.toUpperCase()}" cannot be assigned to role "${role.toUpperCase()}": ${cleanReason}. Automatically switched to ready agent "${fallback.toUpperCase()}".`);
            currentRoleMapping[role] = fallback;
            await config.update(`roleMapping.${role}`, fallback, vscode.ConfigurationTarget.Global);
            await config.update('roleMapping', currentRoleMapping, vscode.ConfigurationTarget.Global);
        }
    }
}
//# sourceMappingURL=extension.js.map