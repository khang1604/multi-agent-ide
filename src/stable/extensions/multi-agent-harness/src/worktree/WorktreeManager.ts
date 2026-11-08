import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { StorageLayout } from '../storage/StorageLayout';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  taskId: string;
  branch: string;
  worktreePath: string;
  headCommit?: string;
}

export class WorktreeManager {
  private baseStorageDir: string;

  constructor(private projectRoot: string) {
    this.baseStorageDir = StorageLayout.getWorktreesDir(projectRoot);
  }

  private async runGit(args: string[], cwd = this.projectRoot): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync('git', args, { cwd });
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message: string };
      throw new Error(`Git command failed: git ${args.join(' ')}\n${error.stderr || error.message}`);
    }
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.baseStorageDir, { recursive: true });
  }

  public async createWorktree(taskId: string, baseBranch = 'HEAD'): Promise<WorktreeInfo> {
    await this.init();
    const branchName = `agent/${taskId}`;
    const worktreePath = path.join(this.baseStorageDir, taskId);

    // Ensure directory does not already exist
    try {
      await fs.access(worktreePath);
      throw new Error(`Worktree directory already exists: ${worktreePath}`);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== 'ENOENT') throw err;
    }

    // git worktree add -b <branch> <path> <base>
    await this.runGit(['worktree', 'add', '-b', branchName, worktreePath, baseBranch]);

    const { stdout: commitHash } = await this.runGit(['rev-parse', 'HEAD'], worktreePath);

    return {
      taskId,
      branch: branchName,
      worktreePath,
      headCommit: commitHash.trim(),
    };
  }

  public async getDiff(taskId: string): Promise<string> {
    const branchName = `agent/${taskId}`;
    const { stdout } = await this.runGit(['diff', 'HEAD', branchName]);
    return stdout;
  }

  public async listWorktrees(): Promise<WorktreeInfo[]> {
    const { stdout } = await this.runGit(['worktree', 'list', '--porcelain']);
    const lines = stdout.split('\n');
    const worktrees: WorktreeInfo[] = [];

    let currentPath = '';
    let currentBranch = '';

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.substring(9).trim();
      } else if (line.startsWith('branch ')) {
        currentBranch = line.substring(7).trim();
      } else if (line === '') {
        if (currentPath.includes(path.join('.local', 'worktrees'))) {
          const taskId = path.basename(currentPath);
          worktrees.push({
            taskId,
            branch: currentBranch.replace('refs/heads/', ''),
            worktreePath: currentPath,
          });
        }
        currentPath = '';
        currentBranch = '';
      }
    }

    return worktrees;
  }

  public async mergeAndCleanup(taskId: string): Promise<void> {
    const branchName = `agent/${taskId}`;
    const worktreePath = path.join(this.baseStorageDir, taskId);

    // Merge changes back to current branch using squash to keep history clean
    await this.runGit(['merge', '--squash', branchName]);

    // Remove worktree
    await this.runGit(['worktree', 'remove', '--force', worktreePath]);

    // Delete temporary branch
    await this.runGit(['branch', '-D', branchName]).catch(() => {});
  }

  public async discardWorktree(taskId: string): Promise<void> {
    const branchName = `agent/${taskId}`;
    const worktreePath = path.join(this.baseStorageDir, taskId);

    await this.runGit(['worktree', 'remove', '--force', worktreePath]).catch(() => {});
    await this.runGit(['branch', '-D', branchName]).catch(() => {});
  }
}

