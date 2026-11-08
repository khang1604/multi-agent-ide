import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StorageLayout } from '../storage/StorageLayout';
import { TokenCompactor } from '../compactor/TokenCompactor';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class IdeMcpServer {
  private static instance?: IdeMcpServer;
  private server?: net.Server;
  private socketPath: string;

  private constructor(private readonly projectRoot?: string) {
    this.socketPath = StorageLayout.getIpcSocketPath();
  }

  public static getInstance(projectRoot?: string): IdeMcpServer {
    if (!IdeMcpServer.instance) {
      IdeMcpServer.instance = new IdeMcpServer(projectRoot);
    }
    return IdeMcpServer.instance;
  }

  public async start(): Promise<void> {
    const socketDir = path.dirname(this.socketPath);
    if (!fs.existsSync(socketDir)) {
      fs.mkdirSync(socketDir, { recursive: true });
    }

    // Clean up stale socket file if not Windows named pipe
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch (err) {
        console.warn('[IdeMcpServer] Failed to clean stale socket:', err);
      }
    }

    this.server = net.createServer((socket) => {
      let buffer = '';

      socket.on('data', async (chunk) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const request = JSON.parse(trimmed);
            const response = await this.handleMcpRequest(request);
            if (response) {
              socket.write(JSON.stringify(response) + '\n');
            }
          } catch (err) {
            socket.write(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: 'Parse error', data: String(err) }
            }) + '\n');
          }
        }
      });

      socket.on('error', (err) => {
        console.error('[IdeMcpServer] Socket client error:', err);
      });
    });

    return new Promise((resolve, reject) => {
      this.server?.listen(this.socketPath, () => {
        console.log(`[IdeMcpServer] MCP Server listening on socket: ${this.socketPath}`);
        resolve();
      });

      this.server?.on('error', (err) => {
        console.error('[IdeMcpServer] Server error:', err);
        reject(err);
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {}
    }
  }

  private async handleMcpRequest(req: any): Promise<any> {
    const id = req.id;
    const method = req.method;

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'multi-agent-ide-core',
            version: '1.0.0'
          },
          instructions: 'Multi Agent IDE native MCP bridge. Controls IDE layout, multi-diff canvas, editor selections, living plan, and risk gates.'
        }
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: this.getToolDefinitions()
        }
      };
    }

    if (method === 'tools/call') {
      const name = req.params?.name;
      const args = req.params?.arguments || {};
      try {
        const result = await this.executeTool(name, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: msg }
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    };
  }

  private getToolDefinitions(): McpToolDefinition[] {
    return [
      {
        name: 'ide_open_diff',
        description: 'Open the continuous multi-diff canvas in Column 2 of the Cockpit.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Optional task ID associated with the diff' }
          }
        }
      },
      {
        name: 'ide_highlight_range',
        description: 'Open a file in the active editor group and highlight a specific line range.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Absolute or workspace-relative path to the file' },
            startLine: { type: 'integer', description: '1-based starting line number' },
            endLine: { type: 'integer', description: '1-based ending line number' }
          },
          required: ['filePath', 'startLine']
        }
      },
      {
        name: 'ide_update_plan',
        description: 'Update the living PLAN.md artifact in the centralized storage.',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Full Markdown content for PLAN.md' }
          },
          required: ['content']
        }
      },
      {
        name: 'ide_request_human_approval',
        description: 'Request explicit human approval before executing sensitive operations (risk gate).',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action description to confirm' },
            riskScore: { type: 'number', description: 'Risk score from 0.0 to 1.0' }
          },
          required: ['action']
        }
      },
      {
        name: 'ide_compact_terminal_output',
        description: 'Compress verbose build, test, or terminal output by stripping ANSI escape sequences and eliding redundant lines.',
        inputSchema: {
          type: 'object',
          properties: {
            rawOutput: { type: 'string', description: 'Raw terminal output string' },
            maxLines: { type: 'integer', description: 'Max lines to retain (default 60)' }
          },
          required: ['rawOutput']
        }
      }
    ];
  }

  private async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'ide_open_diff': {
        await vscode.commands.executeCommand('workbench.action.multiAgent.openContinuousDiff');
        return { success: true, message: 'Continuous multi-diff canvas opened in Column 2' };
      }

      case 'ide_highlight_range': {
        let absPath = args.filePath;
        if (!path.isAbsolute(absPath) && this.projectRoot) {
          absPath = path.join(this.projectRoot, absPath);
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
        const startLine = Math.max(0, (args.startLine || 1) - 1);
        const endLine = Math.max(startLine, ((args.endLine || args.startLine) || 1) - 1);
        const range = new vscode.Range(startLine, 0, endLine, 999);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        return { success: true, highlighted: { file: absPath, startLine: startLine + 1, endLine: endLine + 1 } };
      }

      case 'ide_update_plan': {
        if (!this.projectRoot) {
          throw new Error('Project root not set; cannot locate living PLAN.md');
        }
        const planPath = StorageLayout.getPlanFile(this.projectRoot);
        await fs.promises.mkdir(path.dirname(planPath), { recursive: true });
        await fs.promises.writeFile(planPath, args.content, 'utf-8');
        return { success: true, planPath };
      }

      case 'ide_request_human_approval': {
        const choice = await vscode.window.showWarningMessage(
          `[Agent Risk Gate] Approval requested: ${args.action} (Risk: ${args.riskScore ?? 'N/A'})`,
          { modal: true },
          'Approve',
          'Reject'
        );
        return { approved: choice === 'Approve' };
      }

      case 'ide_compact_terminal_output': {
        const raw = args.rawOutput || '';
        const compressed = TokenCompactor.compressOutput(raw, args.maxLines || 60);
        return {
          originalLength: raw.length,
          compressedLength: compressed.length,
          compressedOutput: compressed
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
