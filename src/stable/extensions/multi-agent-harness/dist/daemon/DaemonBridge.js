"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaemonBridge = void 0;
const path = require("path");
const fs = require("fs/promises");
const child_process_1 = require("child_process");
const util_1 = require("util");
const vscode = require("vscode");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class DaemonBridge {
    projectRoot;
    static instance;
    hubScriptPath;
    syncTimer;
    _onDidStatusChange = new vscode.EventEmitter();
    onDidStatusChange = this._onDidStatusChange.event;
    lastStatus = {
        daemon: 'stopped',
        workflows: []
    };
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.hubScriptPath = path.join(projectRoot, 'harness', 'cli', 'hub.py');
    }
    static getInstance(projectRoot) {
        if (!DaemonBridge.instance && projectRoot) {
            DaemonBridge.instance = new DaemonBridge(projectRoot);
        }
        return DaemonBridge.instance;
    }
    async init() {
        // Verify hub script exists
        try {
            await fs.access(this.hubScriptPath);
        }
        catch {
            // Fallback search in parent directory if opened in subfolder
            const parentHub = path.join(this.projectRoot, '..', 'harness', 'cli', 'hub.py');
            try {
                await fs.access(parentHub);
                this.hubScriptPath = parentHub;
            }
            catch {
                console.warn(`[DaemonBridge] hub.py not found at ${this.hubScriptPath}`);
            }
        }
    }
    async runHubCommand(args) {
        const pythonBin = 'python3';
        try {
            const { stdout } = await execFileAsync(pythonBin, [this.hubScriptPath, ...args], {
                cwd: path.dirname(this.hubScriptPath),
                env: {
                    ...process.env,
                    PYTHONPATH: path.join(path.dirname(this.hubScriptPath), '..'),
                }
            });
            return JSON.parse(stdout);
        }
        catch (err) {
            const error = err;
            const raw = error.stdout || error.stderr || error.message;
            try {
                return JSON.parse(raw);
            }
            catch {
                throw new Error(`Hub CLI failed: ${raw}`);
            }
        }
    }
    async getDoctor() {
        return await this.runHubCommand(['doctor']);
    }
    async getStatus() {
        const status = await this.runHubCommand(['status']);
        this.lastStatus = status;
        this._onDidStatusChange.fire(status);
        return status;
    }
    async startDaemon() {
        const res = await this.runHubCommand(['start']);
        await this.getStatus();
        return res;
    }
    async stopDaemon() {
        const res = await this.runHubCommand(['stop']);
        await this.getStatus();
        return res;
    }
    async dispatch(objective, project = 'default') {
        // Ensure daemon is started
        if (this.lastStatus.daemon !== 'running') {
            try {
                await this.startDaemon();
            }
            catch (err) {
                console.warn('[DaemonBridge] Auto-start daemon error:', err);
            }
        }
        return await this.runHubCommand([
            'run',
            '--project', project,
            '--objective', objective
        ]);
    }
    async cancel(workflowId) {
        return await this.runHubCommand(['cancel', '--workflow-id', workflowId]);
    }
    startSync(intervalMs = 3000) {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        this.syncTimer = setInterval(async () => {
            try {
                await this.getStatus();
            }
            catch {
                // Silently tolerate transient polling drops
            }
        }, intervalMs);
    }
    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }
    }
}
exports.DaemonBridge = DaemonBridge;
//# sourceMappingURL=DaemonBridge.js.map