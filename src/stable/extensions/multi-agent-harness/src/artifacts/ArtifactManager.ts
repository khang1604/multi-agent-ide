import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

export interface ArtifactMetadata {
  title: string;
  userFacing: boolean;
  requestFeedback: boolean;
  status: 'draft' | 'pending_approval' | 'in_progress' | 'completed' | 'rejected';
  summary?: string;
}

export interface ArtifactItem {
  id: string;
  filePath: string;
  content: string;
  metadata: ArtifactMetadata;
}

export class ArtifactManager {
  private artifactsDir: string;
  private _onArtifactsChanged = new vscode.EventEmitter<ArtifactItem[]>();
  public readonly onArtifactsChanged = this._onArtifactsChanged.event;

  constructor(private projectRoot: string) {
    this.artifactsDir = path.join(projectRoot, '.local', 'artifacts');
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.artifactsDir, { recursive: true });
  }

  public parseFrontmatter(rawContent: string): { metadata: ArtifactMetadata; body: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = rawContent.match(frontmatterRegex);

    const defaultMeta: ArtifactMetadata = {
      title: 'Untitled Artifact',
      userFacing: true,
      requestFeedback: false,
      status: 'draft',
    };

    if (!match) {
      return { metadata: defaultMeta, body: rawContent };
    }

    const yamlLines = match[1].split('\n');
    const metadata = { ...defaultMeta };

    for (const line of yamlLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

      if (key === 'title') metadata.title = val;
      if (key === 'userfacing' || key === 'user_facing') metadata.userFacing = val === 'true';
      if (key === 'requestfeedback' || key === 'request_feedback') metadata.requestFeedback = val === 'true';
      if (key === 'status') metadata.status = val as ArtifactMetadata['status'];
      if (key === 'summary') metadata.summary = val;
    }

    return { metadata, body: match[2] };
  }

  public async loadArtifacts(): Promise<ArtifactItem[]> {
    await this.init();
    try {
      const files = await fs.readdir(this.artifactsDir);
      const items: ArtifactItem[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(this.artifactsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const { metadata } = this.parseFrontmatter(content);

        items.push({
          id: file,
          filePath,
          content,
          metadata,
        });
      }

      this._onArtifactsChanged.fire(items);
      return items;
    } catch {
      return [];
    }
  }

  public async saveArtifact(id: string, content: string): Promise<void> {
    await this.init();
    const filePath = path.join(this.artifactsDir, id.endsWith('.md') ? id : `${id}.md`);
    await fs.writeFile(filePath, content, 'utf-8');
    await this.loadArtifacts();
  }
}
