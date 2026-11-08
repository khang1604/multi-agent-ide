"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDiffProvider = void 0;
const vscode = require("vscode");
class AgentDiffProvider {
    static scheme = 'agent-diff';
    static instance;
    _documents = new Map();
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    static getInstance() {
        if (!AgentDiffProvider.instance) {
            AgentDiffProvider.instance = new AgentDiffProvider();
        }
        return AgentDiffProvider.instance;
    }
    provideTextDocumentContent(uri) {
        const key = uri.toString();
        return this._documents.get(key) || '';
    }
    update(uri, content) {
        this._documents.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }
    static getDiffUri(originalUri, taskId) {
        return originalUri.with({
            scheme: AgentDiffProvider.scheme,
            query: `taskId=${encodeURIComponent(taskId)}`,
        });
    }
}
exports.AgentDiffProvider = AgentDiffProvider;
//# sourceMappingURL=DiffProvider.js.map