"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const WorktreeManager_1 = require("./worktree/WorktreeManager");
const ArtifactManager_1 = require("./artifacts/ArtifactManager");
const DiffProvider_1 = require("./diff/DiffProvider");
const SwarmControlProvider_1 = require("./views/SwarmControlProvider");
function activate(context) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const worktreeMgr = new WorktreeManager_1.WorktreeManager(rootPath);
    const artifactMgr = new ArtifactManager_1.ArtifactManager(rootPath);
    const diffProvider = DiffProvider_1.AgentDiffProvider.getInstance();
    // 1. Register diff content provider
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DiffProvider_1.AgentDiffProvider.scheme, diffProvider));
    // 2. Register Webview Views
    const swarmProvider = new SwarmControlProvider_1.SwarmControlProvider(context.extensionUri, worktreeMgr, artifactMgr);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SwarmControlProvider_1.SwarmControlProvider.viewType, swarmProvider));
    // 3. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('multiAgent.newSession', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Describe the engineering task for the Multi Agent Swarm',
            placeHolder: 'e.g. Implement rate limiting middleware and unit tests',
        });
        if (input) {
            vscode.window.showInformationMessage(`Task dispatched: ${input}`);
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
    console.log('Multi Agent IDE Harness Core Extension activated.');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map