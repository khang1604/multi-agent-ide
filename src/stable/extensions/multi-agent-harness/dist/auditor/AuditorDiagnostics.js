"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditorDiagnosticsManager = void 0;
const vscode = require("vscode");
const path = require("path");
class AuditorDiagnosticsManager {
    projectRoot;
    static instance;
    diagnosticCollection;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('multi-agent-auditor');
    }
    static getInstance(projectRoot) {
        if (!AuditorDiagnosticsManager.instance && projectRoot) {
            AuditorDiagnosticsManager.instance = new AuditorDiagnosticsManager(projectRoot);
        }
        return AuditorDiagnosticsManager.instance;
    }
    setIssues(issues) {
        this.clear();
        const map = new Map();
        for (const issue of issues) {
            const fullPath = path.isAbsolute(issue.file)
                ? issue.file
                : path.join(this.projectRoot, issue.file);
            const uri = vscode.Uri.file(fullPath);
            const line = Math.max(0, (issue.line || 1) - 1);
            const col = Math.max(0, (issue.column || 1) - 1);
            const range = new vscode.Range(line, col, line, col + 80);
            let severity = vscode.DiagnosticSeverity.Error;
            if (issue.severity === 'warning')
                severity = vscode.DiagnosticSeverity.Warning;
            if (issue.severity === 'info')
                severity = vscode.DiagnosticSeverity.Information;
            const diagnostic = new vscode.Diagnostic(range, `[Auditor] ${issue.message}`, severity);
            diagnostic.source = issue.source || 'Multi-Agent Auditor';
            const existing = map.get(uri.toString()) || [];
            existing.push(diagnostic);
            map.set(uri.toString(), existing);
        }
        for (const [uriStr, diagnostics] of map.entries()) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diagnostics);
        }
    }
    clear() {
        this.diagnosticCollection.clear();
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.AuditorDiagnosticsManager = AuditorDiagnosticsManager;
//# sourceMappingURL=AuditorDiagnostics.js.map