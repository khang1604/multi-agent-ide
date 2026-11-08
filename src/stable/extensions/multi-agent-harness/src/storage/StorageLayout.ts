import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

export class StorageLayout {
  public static readonly globalRoot = path.join(os.homedir(), '.multi-agent-ide');

  public static getProjectSlug(projectRoot: string): string {
    const hash = crypto.createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 8);
    const base = path.basename(projectRoot).replace(/[^a-zA-Z0-9_-]/g, '_') || 'workspace';
    return `${base}-${hash}`;
  }

  public static getBrainDir(projectRoot: string): string {
    return path.join(StorageLayout.globalRoot, 'brain', StorageLayout.getProjectSlug(projectRoot));
  }

  public static getArtifactsDir(projectRoot: string): string {
    return path.join(StorageLayout.getBrainDir(projectRoot), 'artifacts');
  }

  public static getWorktreesDir(projectRoot: string): string {
    return path.join(StorageLayout.globalRoot, 'worktrees', StorageLayout.getProjectSlug(projectRoot));
  }

  public static getChatHistoryFile(projectRoot: string): string {
    return path.join(StorageLayout.getBrainDir(projectRoot), 'chat_history.json');
  }

  public static getPlanFile(projectRoot: string): string {
    return path.join(StorageLayout.getArtifactsDir(projectRoot), 'PLAN.md');
  }

  public static getDiffStagingFile(projectRoot: string): string {
    return path.join(StorageLayout.getBrainDir(projectRoot), 'DIFF_STAGING.diff');
  }

  public static getActivityStreamFile(projectRoot: string): string {
    return path.join(StorageLayout.getBrainDir(projectRoot), 'SWARM_ACTIVITY.md');
  }

  public static async ensureDirectories(projectRoot: string): Promise<void> {
    await fs.mkdir(StorageLayout.getArtifactsDir(projectRoot), { recursive: true });
    await fs.mkdir(StorageLayout.getWorktreesDir(projectRoot), { recursive: true });
  }
}
