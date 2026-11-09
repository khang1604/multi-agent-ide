"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaemonBridge = void 0;
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const child_process_1 = require("child_process");
const util_1 = require("util");
const vscode = require("vscode");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class DaemonBridge {
    projectRoot;
    static instance;
    hubScriptPath;
    resolvedPythonBin = process.platform === 'win32' ? 'python' : '/usr/bin/python3';
    syncTimer;
    _onDidStatusChange = new vscode.EventEmitter();
    onDidStatusChange = this._onDidStatusChange.event;
    lastStatus = {
        daemon: 'stopped',
        workflows: []
    };
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        const candidates = [
            process.env.MULTI_AGENT_HUB_PATH,
            path.resolve(__dirname, '../../../../harness/cli/hub.py'),
            path.resolve(__dirname, '../../../../../harness/cli/hub.py'),
            path.resolve(__dirname, '../../../../../../harness/cli/hub.py'),
            '/home/nguyenkhang/Project/multi-agent-ide/harness/cli/hub.py',
            path.join(projectRoot, 'harness', 'cli', 'hub.py'),
        ].filter(Boolean);
        this.hubScriptPath = candidates.find(c => fsSync.existsSync(c)) || candidates[0];
        const isWin = process.platform === 'win32';
        const pyCandidates = [
            process.env.PYTHON_BIN,
            isWin ? 'python' : '/usr/bin/python3',
            isWin ? 'py' : '/usr/local/bin/python3',
            '/bin/python3',
            'python3',
            'python'
        ].filter(Boolean);
        for (const py of pyCandidates) {
            if ((py.startsWith('/') || py.includes('\\') || py.includes('/')) && fsSync.existsSync(py)) {
                this.resolvedPythonBin = py;
                break;
            }
        }
    }
    static getInstance(projectRoot) {
        if (!DaemonBridge.instance && projectRoot) {
            DaemonBridge.instance = new DaemonBridge(projectRoot);
        }
        return DaemonBridge.instance;
    }
    async init() {
        try {
            await fs.access(this.hubScriptPath);
        }
        catch {
            console.warn(`[DaemonBridge] hub.py not found at ${this.hubScriptPath}`);
        }
    }
    async runHubCommand(args) {
        const isWin = process.platform === 'win32';
        const userHome = process.env.USERPROFILE || process.env.HOME || '';
        const fullPath = [
            process.env.PATH,
            !isWin ? '/usr/local/bin' : undefined,
            !isWin ? '/usr/bin' : undefined,
            !isWin ? '/bin' : undefined,
            !isWin ? '/usr/local/sbin' : undefined,
            !isWin ? '/usr/sbin' : undefined,
            !isWin ? '/sbin' : undefined,
            isWin ? path.join(userHome, 'AppData', 'Roaming', 'npm') : undefined,
            isWin ? path.join(userHome, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links') : undefined,
            path.join(userHome, '.local', 'bin'),
            path.join(userHome, '.gemini', 'bin'),
            path.join(userHome, '.cargo', 'bin'),
        ].filter(Boolean).join(path.delimiter);
        try {
            const { stdout } = await execFileAsync(this.resolvedPythonBin, [this.hubScriptPath, ...args], {
                cwd: path.dirname(this.hubScriptPath),
                env: {
                    ...process.env,
                    PATH: fullPath,
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
        // Ensure project is registered in Hub database
        try {
            const projects = await this.runHubCommand(['projects']);
            const exists = Array.isArray(projects) && projects.some(p => p.name === project || p.name === 'default');
            if (!exists) {
                await this.runHubCommand(['project-add', project, this.projectRoot, '--verify', '[["true"]]']);
            }
        }
        catch (e) {
            console.warn('[DaemonBridge] Auto register project warning:', e);
        }
        return await this.runHubCommand([
            'run',
            project,
            objective
        ]);
    }
    async cancel(workflowId) {
        return await this.runHubCommand(['cancel', workflowId]);
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