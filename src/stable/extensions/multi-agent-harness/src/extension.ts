import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { WorktreeManager } from './worktree/WorktreeManager';
import { ArtifactManager } from './artifacts/ArtifactManager';
import { AgentDiffProvider } from './diff/DiffProvider';
import { SwarmControlProvider } from './views/SwarmControlProvider';
import { DaemonBridge, DoctorResult } from './daemon/DaemonBridge';
import { AuditorDiagnosticsManager } from './auditor/AuditorDiagnostics';
import { StorageLayout } from './storage/StorageLayout';
import { IdeMcpServer } from './mcp/IdeMcpServer';

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  const worktreeMgr = new WorktreeManager(rootPath);
  const artifactMgr = new ArtifactManager(rootPath);
  const diffProvider = AgentDiffProvider.getInstance();
  const daemonBridge = DaemonBridge.getInstance(rootPath);
  const auditorDiagMgr = AuditorDiagnosticsManager.getInstance(rootPath);
  context.subscriptions.push({ dispose: () => auditorDiagMgr.dispose() });

  // Start native MCP Server over Unix Domain Socket for external CLI agents
  const mcpServer = IdeMcpServer.getInstance(rootPath);
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

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('multiAgent.roleMapping') || e.affectsConfiguration('multiAgent.apiKey')) {
        const config = vscode.workspace.getConfiguration('multiAgent');
        const openaiKey = config.get<string>('apiKey.openai');
        if (openaiKey) process.env.OPENAI_API_KEY = openaiKey;
        const anthropicKey = config.get<string>('apiKey.anthropic');
        if (anthropicKey) process.env.ANTHROPIC_API_KEY = anthropicKey;
        const geminiKey = config.get<string>('apiKey.gemini');
        if (geminiKey) process.env.GEMINI_API_KEY = geminiKey;

        await validateAndEnforceRoles(daemonBridge);
      }
    })
  );

  // 1. Register diff content provider
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(AgentDiffProvider.scheme, diffProvider)
  );

  // 2. Register Webview Views with Daemon Bridge
  const swarmProvider = new SwarmControlProvider(context.extensionUri, worktreeMgr, artifactMgr, daemonBridge, rootPath);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SwarmControlProvider.viewType, swarmProvider)
  );

  // 3. Register Status Bar HUD
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'multi-agent.swarmControlView.focus';
  statusBarItem.tooltip = 'Click to open Multi-Agent Swarm Chat & Control Center';

  const updateStatusBar = (daemon: 'running' | 'stopped', workflowCount = 0) => {
    if (daemon === 'running') {
      statusBarItem.text = `$(hub-pulse) Swarm: Active${workflowCount > 0 ? ` (${workflowCount} tasks)` : ''}`;
      statusBarItem.color = '#73c991';
    } else {
      statusBarItem.text = `$(circle-slash) Swarm: Stopped`;
      statusBarItem.color = undefined;
    }
    statusBarItem.show();
  };

  daemonBridge.onDidStatusChange((status) => {
    const activeCount = status.workflows.filter((w) =>
      ['queued', 'running', 'waiting', 'recovering'].includes(w.status)
    ).length;
    updateStatusBar(status.daemon, activeCount);
  });

  daemonBridge.getStatus().then((s) => updateStatusBar(s.daemon)).catch(() => {});
  context.subscriptions.push(statusBarItem);

  // 4. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.startDaemon', async () => {
      try {
        const res = await daemonBridge.startDaemon();
        vscode.window.showInformationMessage(`Multi-Agent Daemon started (PID: ${res.pid || 'running'})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Start daemon error: ${msg}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.stopDaemon', async () => {
      try {
        await daemonBridge.stopDaemon();
        vscode.window.showInformationMessage('Multi-Agent Daemon stop requested.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Stop daemon error: ${msg}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.showDoctor', async () => {
      try {
        const doc = await daemonBridge.getDoctor();
        const providers = Object.entries(doc.providers)
          .map(([name, p]) => `${name}: ${p.available ? 'OK' : 'Unavailable (' + p.reason + ')'}`)
          .join('\n');
        vscode.window.showInformationMessage(`Multi-Agent Doctor:\nPython: ${doc.python} | Daemon: ${doc.daemon}\n${providers}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Doctor error: ${msg}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.clearAuditorDiagnostics', () => {
      auditorDiagMgr.clear();
      vscode.window.showInformationMessage('Auditor diagnostics cleared.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.simulateAuditorReport', () => {
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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.assignRoles', async () => {
      let doctor: DoctorResult | undefined;
      try {
        doctor = await daemonBridge.getDoctor();
      } catch (e) {
        vscode.window.showErrorMessage('Unable to query Agent status from Hub.');
        return;
      }

      if (!doctor || !doctor.providers) {
        vscode.window.showErrorMessage('No Agent providers detected.');
        return;
      }

      const healthMap: Record<string, string> = {};
      if (doctor.health && Array.isArray(doctor.health)) {
        for (const h of doctor.health) {
          if (h.reason && h.reason.trim()) healthMap[h.provider] = h.reason;
        }
      }

      const isUsable = (name: string): { usable: boolean; reason?: string } => {
        const p = doctor.providers[name];
        if (!p) return { usable: false, reason: 'Not installed' };
        if (p.available !== true) return { usable: false, reason: p.reason || 'CLI not installed' };
        if (healthMap[name]) return { usable: false, reason: healthMap[name] };
        return { usable: true };
      };

      const rolePick = await vscode.window.showQuickPick(
        [
          { label: '🏛️ Lead Architect', role: 'architect', description: 'Decompose requirements into living PLAN.md' },
          { label: '⚡ Algorithm Worker', role: 'worker', description: 'Source code implementation and diff staging' },
          { label: '🛡️ Security Auditor', role: 'auditor', description: 'AST validation and security verification' }
        ],
        { placeHolder: 'Select Swarm role to configure' }
      );
      if (!rolePick) return;

      const config = vscode.workspace.getConfiguration('multiAgent');
      const currentRoleMapping = config.get<Record<string, string>>('roleMapping') || {};
      const currentAssigned = config.get<string>(`roleMapping.${rolePick.role}`) || currentRoleMapping[rolePick.role] || 'antigravity';

      const providerOptions = Object.keys(doctor.providers).map(provName => {
        const check = isUsable(provName);
        let label = provName.toUpperCase();
        if (provName === 'antigravity') label = 'Google Antigravity (Gemini)';
        else if (provName === 'codex') label = 'OpenAI Codex';
        else if (provName === 'claude') label = 'Anthropic Claude Code';
        else if (provName === 'copilot') label = 'GitHub Copilot';

        const isCurrent = currentAssigned === provName;
        if (check.usable) {
          return {
            label: `$(check) ${label}${isCurrent ? ' (Current)' : ''}`,
            id: provName,
            usable: true,
            description: 'Ready'
          };
        } else {
          let cleanReason = check.reason || 'Unavailable';
          if (cleanReason.includes('quota') || cleanReason.includes('limit')) cleanReason = 'Quota limit reached';
          else if (cleanReason.includes('not installed')) cleanReason = 'CLI not installed';
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

      if (!chosen) return;

      if (!chosen.usable) {
        vscode.window.showErrorMessage(`"${chosen.id.toUpperCase()}" cannot be selected: ${chosen.description}. Please choose an agent with "Ready" status.`);
        return;
      }

      currentRoleMapping[rolePick.role] = chosen.id;
      await config.update(`roleMapping.${rolePick.role}`, chosen.id, vscode.ConfigurationTarget.Global);
      await config.update('roleMapping', currentRoleMapping, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Successfully assigned "${chosen.id.toUpperCase()}" as ${rolePick.label}.`);
    }),

    vscode.commands.registerCommand('multiAgent.loginCliAccount', async (targetProvider?: string) => {
      let doctor: DoctorResult | undefined;
      try {
        doctor = await daemonBridge.getDoctor();
      } catch (e) {
        console.warn('Doctor probe error:', e);
      }

      let selectedId = targetProvider;
      if (!selectedId) {
        const pick = await vscode.window.showQuickPick(
          [
            {
              label: '$(account) Google Antigravity',
              id: 'antigravity',
              description: 'Google Account (agy CLI)',
              detail: 'Launch interactive terminal session for Google Antigravity'
            },
            {
              label: '$(account) OpenAI Codex',
              id: 'codex',
              description: 'ChatGPT Account (codex login)',
              detail: 'Launch browser OAuth login for ChatGPT Plus / Team / Enterprise'
            },
            {
              label: '$(account) Anthropic Claude Code',
              id: 'claude',
              description: 'Anthropic Account (claude login)',
              detail: 'Launch browser login for Anthropic Claude Code CLI'
            },
            {
              label: '$(account) GitHub Copilot',
              id: 'copilot',
              description: 'GitHub Account (gh auth login)',
              detail: 'Authorize GitHub CLI and Copilot subscription'
            }
          ],
          { placeHolder: 'Select an Agent CLI to sign in with your account' }
        );

        if (!pick) return;
        selectedId = pick.id;
      }

      if (selectedId === 'antigravity') {
        const bin = findCliBinary('antigravity', doctor) || 'agy';
        const term = vscode.window.createTerminal({ name: 'Agent CLI: Google Antigravity' });
        term.show();
        term.sendText(`"${bin}"`);
        vscode.window.showInformationMessage('Opened Google Antigravity terminal session.');
      } else if (selectedId === 'codex') {
        const bin = findCliBinary('codex', doctor) || 'codex';
        const term = vscode.window.createTerminal({ name: 'Agent CLI: Codex Login' });
        term.show();
        term.sendText(`"${bin}" login`);
        vscode.window.showInformationMessage('Opening browser authentication for ChatGPT/Codex account. Please complete login in the opened window.');
      } else if (selectedId === 'claude') {
        const isInstalled = doctor?.providers?.claude?.available === true;
        if (!isInstalled) {
          const action = await vscode.window.showWarningMessage(
            'Claude Code CLI is not installed. Please install it using npm first: npm install -g @anthropic-ai/claude-code',
            'Copy Install Command'
          );
          if (action === 'Copy Install Command') {
            await vscode.env.clipboard.writeText('npm install -g @anthropic-ai/claude-code');
            vscode.window.showInformationMessage('Copied install command to clipboard.');
          }
          return;
        }
        const term = vscode.window.createTerminal({ name: 'Agent CLI: Claude Login' });
        term.show();
        term.sendText('claude login');
        vscode.window.showInformationMessage('Opened Claude Code login in terminal.');
      } else if (selectedId === 'copilot') {
        const isInstalled = doctor?.providers?.copilot?.available === true;
        if (!isInstalled) {
          const action = await vscode.window.showWarningMessage(
            'GitHub CLI (gh) is not installed. Please install it with: sudo apt install gh, then run gh auth login.',
            'Copy Install Command'
          );
          if (action === 'Copy Install Command') {
            await vscode.env.clipboard.writeText('sudo apt install -y gh && gh auth login');
            vscode.window.showInformationMessage('Copied install command to clipboard.');
          }
          return;
        }
        const term = vscode.window.createTerminal({ name: 'Agent CLI: GitHub Auth' });
        term.show();
        term.sendText('gh auth login');
        vscode.window.showInformationMessage('Opened GitHub CLI authentication in terminal.');
      }
    }),

    vscode.commands.registerCommand('multiAgent.configureProviders', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgent');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.newSession', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Describe the engineering task for the Multi Agent Swarm',
        placeHolder: 'e.g. Implement rate limiting middleware and unit tests',
      });
      if (input) {
        try {
          const res = await daemonBridge.dispatch(input);
          vscode.window.showInformationMessage(`Task dispatched to Swarm (Workflow: ${res.id})`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Dispatch error: ${msg}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.approvePlan', async () => {
      vscode.window.showInformationMessage('Plan approved! Swarm is executing plan and scaffolding project...');
      try {
        const taskId = `task-${Date.now()}`;
        const info = await worktreeMgr.createWorktree(taskId);
        vscode.window.showInformationMessage(`Worktree created at: ${info.worktreePath} (Branch: ${info.branch})`);
        await swarmProvider.handleApprovePlan();
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

      const planPath = StorageLayout.getPlanFile(rootPath);
      const diffPath = StorageLayout.getDiffStagingFile(rootPath);
      const activityPath = StorageLayout.getActivityStreamFile(rootPath);

      try {
        await StorageLayout.ensureDirectories(rootPath);
        await fs.mkdir(path.dirname(diffPath), { recursive: true });
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

  context.subscriptions.push(
    vscode.commands.registerCommand('multiAgent.focusLayout', async () => {
      await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 0,
        groups: [{ size: 1.0 }],
      });
    }),
    vscode.commands.registerCommand('multiAgent.openPlan', async () => {
      const planPath = StorageLayout.getPlanFile(rootPath);
      await StorageLayout.ensureDirectories(rootPath);
      if (!fsSync.existsSync(planPath)) {
        await fs.writeFile(planPath, '# Living PLAN.md\n\n> Multi-Agent Execution Plan\n', 'utf-8');
      }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
      await vscode.window.showTextDocument(doc, { preview: false });
    }),
    vscode.commands.registerCommand('multiAgent.openDiff', async () => {
      try {
        await vscode.commands.executeCommand('workbench.action.multiAgent.openContinuousDiff');
      } catch {
        const diffPath = StorageLayout.getDiffStagingFile(rootPath);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(diffPath));
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }),
    vscode.commands.registerCommand('multiAgent.openActivity', async () => {
      const actPath = StorageLayout.getActivityStreamFile(rootPath);
      await StorageLayout.ensureDirectories(rootPath);
      if (!fsSync.existsSync(actPath)) {
        await fs.writeFile(actPath, '# Swarm Activity Stream\n', 'utf-8');
      }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(actPath));
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  // Auto-reveal Swarm Chat (Secondary Sidebar on the right) on launch without forcing 3-column clutter
  setTimeout(async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.openSecondarySidebar');
      await vscode.commands.executeCommand('multi-agent.swarmControlView.focus');
    } catch {}
  }, 1000);

  console.log('Multi Agent IDE Harness Core Extension activated.');
}

export function deactivate() {
  const daemonBridge = DaemonBridge.getInstance();
  daemonBridge.stopSync();
  const mcpServer = IdeMcpServer.getInstance();
  mcpServer.stop();
}

async function validateAndEnforceRoles(daemonBridge: DaemonBridge): Promise<void> {
  const config = vscode.workspace.getConfiguration('multiAgent');
  let doctor: DoctorResult | undefined;
  try {
    doctor = await daemonBridge.getDoctor();
  } catch (e) {
    console.warn('[multi-agent-harness] Doctor probe failed:', e);
    return;
  }

  if (!doctor || !doctor.providers) return;

  const healthMap: Record<string, string> = {};
  if (doctor.health && Array.isArray(doctor.health)) {
    for (const h of doctor.health) {
      if (h.reason && h.reason.trim()) {
        healthMap[h.provider] = h.reason;
      }
    }
  }

  const isUsable = (provName: string): { usable: boolean; reason?: string } => {
    const p = doctor.providers[provName];
    if (!p) return { usable: false, reason: 'CLI engine not configured' };
    if (p.available !== true) return { usable: false, reason: p.reason || 'CLI not installed or not on PATH' };
    if (healthMap[provName]) return { usable: false, reason: healthMap[provName] };
    return { usable: true };
  };

  // Find a reliable fallback provider that is available
  let fallback = 'antigravity';
  if (!isUsable('antigravity').usable) {
    const candidate = Object.keys(doctor.providers).find(k => isUsable(k).usable);
    if (candidate) fallback = candidate;
  }

  const roles = ['architect', 'worker', 'auditor'] as const;
  const currentRoleMapping = config.get<Record<string, string>>('roleMapping') || {};

  for (const role of roles) {
    const assigned = config.get<string>(`roleMapping.${role}`) || currentRoleMapping[role] || 'antigravity';
    const check = isUsable(assigned);
    if (!check.usable) {
      let cleanReason = check.reason || 'Unavailable';
      if (cleanReason.includes('quota') || cleanReason.includes('limit')) {
        cleanReason = 'Quota limit reached';
      } else if (cleanReason.includes('not installed')) {
        cleanReason = 'CLI is not installed';
      }

      vscode.window.showWarningMessage(
        `Agent "${assigned.toUpperCase()}" cannot be assigned to role "${role.toUpperCase()}": ${cleanReason}. Automatically switched to ready agent "${fallback.toUpperCase()}".`,
        'Sign in with CLI Account',
        'Configure Settings'
      ).then((action) => {
        if (action === 'Sign in with CLI Account') {
          vscode.commands.executeCommand('multiAgent.loginCliAccount');
        } else if (action === 'Configure Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgent');
        }
      });

      currentRoleMapping[role] = fallback;
      await config.update(`roleMapping.${role}`, fallback, vscode.ConfigurationTarget.Global);
      await config.update('roleMapping', currentRoleMapping, vscode.ConfigurationTarget.Global);
    }
  }
}

function findCliBinary(name: string, doctor?: DoctorResult): string | undefined {
  if (doctor?.providers?.[name]?.command?.[0]) {
    const cmd = doctor.providers[name].command[0];
    if (fsSync.existsSync(cmd)) return cmd;
  }
  const home = process.env.HOME || '';
  if (name === 'antigravity') {
    const p = path.join(home, '.gemini', 'bin', 'agy');
    if (fsSync.existsSync(p)) return p;
  } else if (name === 'codex') {
    const p = path.join(home, '.codex', 'plugins', '.plugin-appserver', 'codex');
    if (fsSync.existsSync(p)) return p;
  }
  return undefined;
}
