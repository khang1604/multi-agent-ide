import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface ProviderInfo {
  available: boolean;
  command?: string[];
  version?: string;
  roles?: string[];
  reason?: string;
}

export interface DoctorResult {
  python: string;
  os: string;
  git: string;
  home: string;
  daemon: 'running' | 'stopped';
  providers: Record<string, ProviderInfo>;
  health: unknown[];
  note: string;
}

export interface WorkflowItem {
  id: string;
  status: 'queued' | 'running' | 'waiting' | 'recovering' | 'completed' | 'blocked' | 'cancelled' | 'needs_review';
  phase: string;
  leader?: string;
  complexity: string;
  calls: number;
  max_calls: number;
  next_run: number;
  summary: string;
  error: string;
  objective?: string;
}

export interface StatusResult {
  daemon: 'running' | 'stopped';
  workflows: WorkflowItem[];
}

export class DaemonBridge {
  private static instance: DaemonBridge;
  private hubScriptPath: string;
  private resolvedPythonBin: string = '/usr/bin/python3';
  private syncTimer?: NodeJS.Timeout;
  private _onDidStatusChange = new vscode.EventEmitter<StatusResult>();
  public readonly onDidStatusChange = this._onDidStatusChange.event;

  private lastStatus: StatusResult = {
    daemon: 'stopped',
    workflows: []
  };

  constructor(private projectRoot: string) {
    const candidates = [
      process.env.MULTI_AGENT_HUB_PATH,
      path.resolve(__dirname, '../../../../harness/cli/hub.py'),
      path.resolve(__dirname, '../../../../../harness/cli/hub.py'),
      path.resolve(__dirname, '../../../../../../harness/cli/hub.py'),
      '/home/nguyenkhang/Project/multi-agent-ide/harness/cli/hub.py',
      path.join(projectRoot, 'harness', 'cli', 'hub.py'),
    ].filter(Boolean) as string[];

    this.hubScriptPath = candidates.find(c => fsSync.existsSync(c)) || candidates[0];

    const pyCandidates = [
      process.env.PYTHON_BIN,
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      '/bin/python3',
      'python3',
      'python'
    ].filter(Boolean) as string[];
    for (const py of pyCandidates) {
      if (py.startsWith('/') && fsSync.existsSync(py)) {
        this.resolvedPythonBin = py;
        break;
      }
    }
  }

  public static getInstance(projectRoot?: string): DaemonBridge {
    if (!DaemonBridge.instance && projectRoot) {
      DaemonBridge.instance = new DaemonBridge(projectRoot);
    }
    return DaemonBridge.instance;
  }

  public async init(): Promise<void> {
    try {
      await fs.access(this.hubScriptPath);
    } catch {
      console.warn(`[DaemonBridge] hub.py not found at ${this.hubScriptPath}`);
    }
  }

  private async runHubCommand<T>(args: string[]): Promise<T> {
    const fullPath = [
      process.env.PATH,
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/local/sbin',
      '/usr/sbin',
      '/sbin',
      path.join(process.env.HOME || '', '.local/bin'),
      path.join(process.env.HOME || '', '.gemini/bin'),
      path.join(process.env.HOME || '', '.cargo/bin'),
    ].filter(Boolean).join(':');

    try {
      const { stdout } = await execFileAsync(this.resolvedPythonBin, [this.hubScriptPath, ...args], {
        cwd: path.dirname(this.hubScriptPath),
        env: {
          ...process.env,
          PATH: fullPath,
          PYTHONPATH: path.join(path.dirname(this.hubScriptPath), '..'),
        }
      });
      return JSON.parse(stdout) as T;
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message: string };
      const raw = error.stdout || error.stderr || error.message;
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error(`Hub CLI failed: ${raw}`);
      }
    }
  }

  public async getDoctor(): Promise<DoctorResult> {
    return await this.runHubCommand<DoctorResult>(['doctor']);
  }

  public async getStatus(): Promise<StatusResult> {
    const status = await this.runHubCommand<StatusResult>(['status']);
    this.lastStatus = status;
    this._onDidStatusChange.fire(status);
    return status;
  }

  public async startDaemon(): Promise<{ status: string; pid?: number }> {
    const res = await this.runHubCommand<{ status: string; pid?: number }>(['start']);
    await this.getStatus();
    return res;
  }

  public async stopDaemon(): Promise<{ status: string }> {
    const res = await this.runHubCommand<{ status: string }>(['stop']);
    await this.getStatus();
    return res;
  }

  public async dispatch(objective: string, project = 'default'): Promise<{ id: string; status: string }> {
    // Ensure daemon is started
    if (this.lastStatus.daemon !== 'running') {
      try {
        await this.startDaemon();
      } catch (err) {
        console.warn('[DaemonBridge] Auto-start daemon error:', err);
      }
    }

    // Ensure project is registered in Hub database
    try {
      const projects = await this.runHubCommand<Array<{ name: string; id: string }>>(['projects']);
      const exists = Array.isArray(projects) && projects.some(p => p.name === project || p.name === 'default');
      if (!exists) {
        await this.runHubCommand(['project-add', project, this.projectRoot, '--verify', '[["true"]]']);
      }
    } catch (e) {
      console.warn('[DaemonBridge] Auto register project warning:', e);
    }

    return await this.runHubCommand<{ id: string; status: string }>([
      'run',
      project,
      objective
    ]);
  }

  public async cancel(workflowId: string): Promise<{ cancelled: boolean }> {
    return await this.runHubCommand<{ cancelled: boolean }>(['cancel', workflowId]);
  }

  public startSync(intervalMs = 3000): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.syncTimer = setInterval(async () => {
      try {
        await this.getStatus();
      } catch {
        // Silently tolerate transient polling drops
      }
    }, intervalMs);
  }

  public stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }
}
