import * as vscode from 'vscode';

export class AgentDiffProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'agent-diff';
  private static instance: AgentDiffProvider;

  private _documents = new Map<string, string>();
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this._onDidChange.event;

  public static getInstance(): AgentDiffProvider {
    if (!AgentDiffProvider.instance) {
      AgentDiffProvider.instance = new AgentDiffProvider();
    }
    return AgentDiffProvider.instance;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    const key = uri.toString();
    return this._documents.get(key) || '';
  }

  public update(uri: vscode.Uri, content: string): void {
    this._documents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  public static getDiffUri(originalUri: vscode.Uri, taskId: string): vscode.Uri {
    return originalUri.with({
      scheme: AgentDiffProvider.scheme,
      query: `taskId=${encodeURIComponent(taskId)}`,
    });
  }
}
