"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs/promises");
const WorktreeManager_1 = require("./worktree/WorktreeManager");
const ArtifactManager_1 = require("./artifacts/ArtifactManager");
const DiffProvider_1 = require("./diff/DiffProvider");
const SwarmControlProvider_1 = require("./views/SwarmControlProvider");
const DaemonBridge_1 = require("./daemon/DaemonBridge");
const AuditorDiagnostics_1 = require("./auditor/AuditorDiagnostics");
function activate(context) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const worktreeMgr = new WorktreeManager_1.WorktreeManager(rootPath);
    const artifactMgr = new ArtifactManager_1.ArtifactManager(rootPath);
    const diffProvider = DiffProvider_1.AgentDiffProvider.getInstance();
    const daemonBridge = DaemonBridge_1.DaemonBridge.getInstance(rootPath);
    const auditorDiagMgr = AuditorDiagnostics_1.AuditorDiagnosticsManager.getInstance(rootPath);
    context.subscriptions.push({ dispose: () => auditorDiagMgr.dispose() });
    // Initialize Daemon Bridge & start background status sync
    daemonBridge.init().then(() => {
        daemonBridge.startSync(3000);
    }).catch((err) => {
        console.warn('[multi-agent-harness] DaemonBridge init error:', err);
    });
    // 1. Register diff content provider
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DiffProvider_1.AgentDiffProvider.scheme, diffProvider));
    // 2. Register Webview Views with Daemon Bridge
    const swarmProvider = new SwarmControlProvider_1.SwarmControlProvider(context.extensionUri, worktreeMgr, artifactMgr, daemonBridge);
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
        vscode.window.showInformationMessage('Plan approved! Swarm is spawning isolated Git Worktree...');
        try {
            const taskId = `task-${Date.now()}`;
            const info = await worktreeMgr.createWorktree(taskId);
            vscode.window.showInformationMessage(`Worktree created at: ${info.worktreePath} (Branch: ${info.branch})`);
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
        const planPath = path.join(rootPath, 'PLAN.md');
        const diffPath = path.join(rootPath, '.local', 'DIFF_STAGING.diff');
        const activityPath = path.join(rootPath, '.local', 'SWARM_ACTIVITY.md');
        try {
            await fs.mkdir(path.join(rootPath, '.local'), { recursive: true });
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
    // Auto-reveal Swarm Chat & Cockpit Layout on launch
    setTimeout(() => {
        vscode.commands.executeCommand('multi-agent.swarmControlView.focus').then(undefined, () => { });
        vscode.commands.executeCommand('multiAgent.setupCockpitLayout').then(undefined, () => { });
    }, 1200);
    console.log('Multi Agent IDE Harness Core Extension activated.');
}
function deactivate() {
    const daemonBridge = DaemonBridge_1.DaemonBridge.getInstance();
    daemonBridge.stopSync();
}
//# sourceMappingURL=extension.js.map