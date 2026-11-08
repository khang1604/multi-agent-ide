"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeManager = void 0;
const path = require("path");
const fs = require("fs/promises");
const child_process_1 = require("child_process");
const util_1 = require("util");
const StorageLayout_1 = require("../storage/StorageLayout");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class WorktreeManager {
    projectRoot;
    baseStorageDir;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.baseStorageDir = StorageLayout_1.StorageLayout.getWorktreesDir(projectRoot);
    }
    async runGit(args, cwd = this.projectRoot) {
        try {
            return await execFileAsync('git', args, { cwd });
        }
        catch (err) {
            const error = err;
            throw new Error(`Git command failed: git ${args.join(' ')}\n${error.stderr || error.message}`);
        }
    }
    async init() {
        await fs.mkdir(this.baseStorageDir, { recursive: true });
    }
    async createWorktree(taskId, baseBranch = 'HEAD') {
        await this.init();
        const branchName = `agent/${taskId}`;
        const worktreePath = path.join(this.baseStorageDir, taskId);
        // Ensure directory does not already exist
        try {
            await fs.access(worktreePath);
            throw new Error(`Worktree directory already exists: ${worktreePath}`);
        }
        catch (err) {
            const error = err;
            if (error.code !== 'ENOENT')
                throw err;
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
    async getDiff(taskId) {
        const branchName = `agent/${taskId}`;
        const { stdout } = await this.runGit(['diff', 'HEAD', branchName]);
        return stdout;
    }
    async listWorktrees() {
        const { stdout } = await this.runGit(['worktree', 'list', '--porcelain']);
        const lines = stdout.split('\n');
        const worktrees = [];
        let currentPath = '';
        let currentBranch = '';
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                currentPath = line.substring(9).trim();
            }
            else if (line.startsWith('branch ')) {
                currentBranch = line.substring(7).trim();
            }
            else if (line === '') {
                if (currentPath.includes(this.baseStorageDir) || currentPath.includes(path.join('.local', 'worktrees'))) {
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
    async mergeAndCleanup(taskId) {
        const branchName = `agent/${taskId}`;
        const worktreePath = path.join(this.baseStorageDir, taskId);
        // Merge changes back to current branch using squash to keep history clean
        await this.runGit(['merge', '--squash', branchName]);
        // Remove worktree
        await this.runGit(['worktree', 'remove', '--force', worktreePath]);
        // Delete temporary branch
        await this.runGit(['branch', '-D', branchName]).catch(() => { });
    }
    async discardWorktree(taskId) {
        const branchName = `agent/${taskId}`;
        const worktreePath = path.join(this.baseStorageDir, taskId);
        await this.runGit(['worktree', 'remove', '--force', worktreePath]).catch(() => { });
        await this.runGit(['branch', '-D', branchName]).catch(() => { });
    }
}
exports.WorktreeManager = WorktreeManager;
//# sourceMappingURL=WorktreeManager.js.map