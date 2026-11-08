import * as vscode from 'vscode';
import { WorktreeManager } from './worktree/WorktreeManager';
import { ArtifactManager } from './artifacts/ArtifactManager';
import { AgentDiffProvider } from './diff/DiffProvider';
import { SwarmControlProvider } from './views/SwarmControlProvider';

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  const worktreeMgr = new WorktreeManager(rootPath);
  const artifactMgr = new ArtifactManager(rootPath);
  const diffProvider = AgentDiffProvider.getInstance();

  // 1. Register diff content provider
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(AgentDiffProvider.scheme, diffProvider)
  );

  // 2. Register Webview Views
  const swarmProvider = new SwarmControlProvider(context.extensionUri, worktreeMgr, artifactMgr);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SwarmControlProvider.viewType, swarmProvider)
  );

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.newSession', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Describe the engineering task for the Multi Agent Swarm',
        placeHolder: 'e.g. Implement rate limiting middleware and unit tests',
      });
      if (input) {
        vscode.window.showInformationMessage(`Task dispatched: ${input}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.approvePlan', async () => {
      vscode.window.showInformationMessage('Plan approved! Swarm is spawning isolated Git Worktree...');
      try {
        const taskId = `task-${Date.now()}`;
        const info = await worktreeMgr.createWorktree(taskId);
        vscode.window.showInformationMessage(`Worktree created at: ${info.worktreePath} (Branch: ${info.branch})`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to create worktree: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.refreshWorktrees', async () => {
      const list = await worktreeMgr.listWorktrees();
      vscode.window.showInformationMessage(`Active Worktrees: ${list.length}`);
    })
  );

  console.log('Multi Agent IDE Harness Core Extension activated.');
}

export function deactivate() {}
