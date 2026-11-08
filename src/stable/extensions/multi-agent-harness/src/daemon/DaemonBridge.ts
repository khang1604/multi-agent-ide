import * as path from 'path';
import * as fs from 'fs/promises';
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
  private syncTimer?: NodeJS.Timeout;
  private _onDidStatusChange = new vscode.EventEmitter<StatusResult>();
  public readonly onDidStatusChange = this._onDidStatusChange.event;

  private lastStatus: StatusResult = {
    daemon: 'stopped',
    workflows: []
  };

  constructor(private projectRoot: string) {
    this.hubScriptPath = path.join(projectRoot, 'harness', 'cli', 'hub.py');
  }

  public static getInstance(projectRoot?: string): DaemonBridge {
    if (!DaemonBridge.instance && projectRoot) {
      DaemonBridge.instance = new DaemonBridge(projectRoot);
    }
    return DaemonBridge.instance;
  }

  public async init(): Promise<void> {
    // Verify hub script exists
    try {
      await fs.access(this.hubScriptPath);
    } catch {
      // Fallback search in parent directory if opened in subfolder
      const parentHub = path.join(this.projectRoot, '..', 'harness', 'cli', 'hub.py');
      try {
        await fs.access(parentHub);
        this.hubScriptPath = parentHub;
      } catch {
        console.warn(`[DaemonBridge] hub.py not found at ${this.hubScriptPath}`);
      }
    }
  }

  private async runHubCommand<T>(args: string[]): Promise<T> {
    const pythonBin = 'python3';
    try {
      const { stdout } = await execFileAsync(pythonBin, [this.hubScriptPath, ...args], {
        cwd: path.dirname(this.hubScriptPath),
        env: {
          ...process.env,
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

    return await this.runHubCommand<{ id: string; status: string }>([
      'run',
      '--project', project,
      '--objective', objective
    ]);
  }

  public async cancel(workflowId: string): Promise<{ cancelled: boolean }> {
    return await this.runHubCommand<{ cancelled: boolean }>(['cancel', '--workflow-id', workflowId]);
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
