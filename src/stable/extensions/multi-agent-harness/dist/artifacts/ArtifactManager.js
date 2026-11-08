"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactManager = void 0;
const path = require("path");
const fs = require("fs/promises");
const vscode = require("vscode");
const StorageLayout_1 = require("../storage/StorageLayout");
class ArtifactManager {
    artifactsDir;
    _onArtifactsChanged = new vscode.EventEmitter();
    onArtifactsChanged = this._onArtifactsChanged.event;
    constructor(projectRoot) {
        this.artifactsDir = StorageLayout_1.StorageLayout.getArtifactsDir(projectRoot);
    }
    async init() {
        await fs.mkdir(this.artifactsDir, { recursive: true });
    }
    parseFrontmatter(rawContent) {
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
        const match = rawContent.match(frontmatterRegex);
        const defaultMeta = {
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
            if (colonIdx === -1)
                continue;
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (key === 'title')
                metadata.title = val;
            if (key === 'userfacing' || key === 'user_facing')
                metadata.userFacing = val === 'true';
            if (key === 'requestfeedback' || key === 'request_feedback')
                metadata.requestFeedback = val === 'true';
            if (key === 'status')
                metadata.status = val;
            if (key === 'summary')
                metadata.summary = val;
        }
        return { metadata, body: match[2] };
    }
    async loadArtifacts() {
        await this.init();
        try {
            const files = await fs.readdir(this.artifactsDir);
            const items = [];
            for (const file of files) {
                if (!file.endsWith('.md'))
                    continue;
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
        }
        catch {
            return [];
        }
    }
    async saveArtifact(id, content) {
        await this.init();
        const filePath = path.join(this.artifactsDir, id.endsWith('.md') ? id : `${id}.md`);
        await fs.writeFile(filePath, content, 'utf-8');
        await this.loadArtifacts();
    }
}
exports.ArtifactManager = ArtifactManager;
//# sourceMappingURL=ArtifactManager.js.map