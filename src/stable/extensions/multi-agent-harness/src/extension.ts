import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
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

  // 4. Architecture Map & Cockpit Navigation
  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.openArchitectureMap', async () => {
      const mapUri = vscode.Uri.file(path.join(rootPath, 'docs', 'architecture', 'VISUAL_FLOW_MAP.md'));
      try {
        await vscode.commands.executeCommand('markdown.showPreview', mapUri);
      } catch {
        const doc = await vscode.workspace.openTextDocument(mapUri);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Three, preview: true });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.setupCockpitLayout', async () => {
      await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 0,
        groups: [{ size: 0.28 }, { size: 0.44 }, { size: 0.28 }],
      });

      const planPath = path.join(rootPath, 'PLAN.md');
      const diffPath = path.join(rootPath, '.local', 'DIFF_STAGING.diff');
      const activityPath = path.join(rootPath, '.local', 'SWARM_ACTIVITY.md');

      try {
        await fs.mkdir(path.join(rootPath, '.local'), { recursive: true });
        try { await fs.access(planPath); } catch {
          await fs.writeFile(planPath, '# Living PLAN.md\n\n> Multi-Agent Execution Plan\n\n## 1. Objectives\n- [ ] Task 1: Inception\n', 'utf-8');
        }
        try { await fs.access(diffPath); } catch {
          await fs.writeFile(diffPath, '# Continuous Multi-Diff Staging\n# Waiting for Swarm dispatches...\n', 'utf-8');
        }
        try { await fs.access(activityPath); } catch {
          await fs.writeFile(activityPath, '# Swarm Activity Stream\n\n- [Architect] Initialized\n- [Worker] Standby\n- [Auditor] Standby\n', 'utf-8');
        }

        const planDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
        await vscode.window.showTextDocument(planDoc, { viewColumn: vscode.ViewColumn.One, preview: false });

        // Column 2: Prefer Native Continuous Multi-Diff Editor (Tier 2)
        try {
          await vscode.commands.executeCommand('workbench.action.multiAgent.openContinuousDiff');
        } catch {
          const diffDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(diffPath));
          await vscode.window.showTextDocument(diffDoc, { viewColumn: vscode.ViewColumn.Two, preview: false });
        }

        const actDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(activityPath));
        await vscode.window.showTextDocument(actDoc, { viewColumn: vscode.ViewColumn.Three, preview: false });

        vscode.window.showInformationMessage('Swarm Cockpit 3-Column Layout active.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Cockpit setup error: ${msg}`);
      }
    })
  );

  console.log('Multi Agent IDE Harness Core Extension activated.');
}

export function deactivate() {}

