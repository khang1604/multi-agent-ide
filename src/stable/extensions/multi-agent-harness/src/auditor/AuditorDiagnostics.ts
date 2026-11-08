import * as vscode from 'vscode';
import * as path from 'path';

export interface AuditorIssue {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source?: string;
}

export class AuditorDiagnosticsManager {
  private static instance: AuditorDiagnosticsManager;
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private projectRoot: string) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('multi-agent-auditor');
  }

  public static getInstance(projectRoot?: string): AuditorDiagnosticsManager {
    if (!AuditorDiagnosticsManager.instance && projectRoot) {
      AuditorDiagnosticsManager.instance = new AuditorDiagnosticsManager(projectRoot);
    }
    return AuditorDiagnosticsManager.instance;
  }

  public setIssues(issues: AuditorIssue[]): void {
    this.clear();
    const map = new Map<string, vscode.Diagnostic[]>();

    for (const issue of issues) {
      const fullPath = path.isAbsolute(issue.file)
        ? issue.file
        : path.join(this.projectRoot, issue.file);
      const uri = vscode.Uri.file(fullPath);

      const line = Math.max(0, (issue.line || 1) - 1);
      const col = Math.max(0, (issue.column || 1) - 1);
      const range = new vscode.Range(line, col, line, col + 80);

      let severity = vscode.DiagnosticSeverity.Error;
      if (issue.severity === 'warning') severity = vscode.DiagnosticSeverity.Warning;
      if (issue.severity === 'info') severity = vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(
        range,
        `[Auditor] ${issue.message}`,
        severity
      );
      diagnostic.source = issue.source || 'Multi-Agent Auditor';

      const existing = map.get(uri.toString()) || [];
      existing.push(diagnostic);
      map.set(uri.toString(), existing);
    }

    for (const [uriStr, diagnostics] of map.entries()) {
      this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diagnostics);
    }
  }

  public clear(): void {
    this.diagnosticCollection.clear();
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
