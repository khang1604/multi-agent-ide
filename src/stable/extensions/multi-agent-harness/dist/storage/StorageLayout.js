"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageLayout = void 0;
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
class StorageLayout {
    static globalRoot = path.join(os.homedir(), '.multi-agent-ide');
    static getProjectSlug(projectRoot) {
        const hash = crypto.createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 8);
        const base = path.basename(projectRoot).replace(/[^a-zA-Z0-9_-]/g, '_') || 'workspace';
        return `${base}-${hash}`;
    }
    static getBrainDir(projectRoot) {
        return path.join(StorageLayout.globalRoot, 'brain', StorageLayout.getProjectSlug(projectRoot));
    }
    static getArtifactsDir(projectRoot) {
        return path.join(StorageLayout.getBrainDir(projectRoot), 'artifacts');
    }
    static getWorktreesDir(projectRoot) {
        return path.join(StorageLayout.globalRoot, 'worktrees', StorageLayout.getProjectSlug(projectRoot));
    }
    static getChatHistoryFile(projectRoot) {
        return path.join(StorageLayout.getBrainDir(projectRoot), 'chat_history.json');
    }
    static getPlanFile(projectRoot) {
        return path.join(StorageLayout.getArtifactsDir(projectRoot), 'PLAN.md');
    }
    static getDiffStagingFile(projectRoot) {
        return path.join(StorageLayout.getBrainDir(projectRoot), 'DIFF_STAGING.diff');
    }
    static getActivityStreamFile(projectRoot) {
        return path.join(StorageLayout.getBrainDir(projectRoot), 'SWARM_ACTIVITY.md');
    }
    static async ensureDirectories(projectRoot) {
        await fs.mkdir(StorageLayout.getArtifactsDir(projectRoot), { recursive: true });
        await fs.mkdir(StorageLayout.getWorktreesDir(projectRoot), { recursive: true });
    }
}
exports.StorageLayout = StorageLayout;
//# sourceMappingURL=StorageLayout.js.map