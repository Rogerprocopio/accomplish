import fs from 'fs';
import path from 'path';

const WORKSPACE_DIRS = ['context', 'memory'] as const;

const README_ROOT = `---
type: system
---
# Accomplish Workspace

Este é o workspace do agente Accomplish.

- **\`context/\`** — Escreva aqui arquivos Markdown com contexto que o agente deve sempre conhecer. Estes arquivos são lidos **integralmente** a cada sessão.
- **\`memory/\`** — O agente salva aqui seus aprendizados em formato Obsidian. Apenas o índice (título + tags) é injetado no contexto; o agente lê arquivos específicos quando precisar.
`;

const README_CONTEXT = `---
type: system
---
# Context

Coloque aqui arquivos Markdown com informações que o agente deve sempre saber.

**Exemplos:**
- \`meus-projetos.md\` — projetos ativos
- \`preferencias.md\` — como você gosta de trabalhar
- \`empresa.md\` — contexto sobre sua empresa

**Atenção:** Estes arquivos são lidos integralmente a cada sessão. Mantenha-os concisos.
`;

const README_MEMORY = `---
type: system
---
# Agent Memory

O agente salva seus aprendizados aqui em formato Obsidian.

## Formato usado pelo agente

\`\`\`yaml
---
tags: [aprendizado, usuario]
date: YYYY-MM-DD
type: learning
---
# Título da nota

Conteúdo da nota com [[links internos]] e #tags.
\`\`\`

Você também pode criar notas aqui. O agente verá o índice de todos os arquivos desta pasta.
`;

export interface MemoryFileEntry {
  filename: string;
  title: string;
  tags: string[];
}

export interface WorkspaceContent {
  workspacePath: string;
  contextFiles: Array<{ filename: string; content: string }>;
  memoryIndex: MemoryFileEntry[];
}

/**
 * Creates the workspace directory structure with README files if they don't exist.
 */
export function initWorkspace(workspacePath: string): void {
  fs.mkdirSync(workspacePath, { recursive: true });

  for (const dir of WORKSPACE_DIRS) {
    fs.mkdirSync(path.join(workspacePath, dir), { recursive: true });
  }

  const rootReadme = path.join(workspacePath, 'README.md');
  if (!fs.existsSync(rootReadme)) {
    fs.writeFileSync(rootReadme, README_ROOT, 'utf-8');
  }

  const contextReadme = path.join(workspacePath, 'context', 'README.md');
  if (!fs.existsSync(contextReadme)) {
    fs.writeFileSync(contextReadme, README_CONTEXT, 'utf-8');
  }

  const memoryReadme = path.join(workspacePath, 'memory', 'README.md');
  if (!fs.existsSync(memoryReadme)) {
    fs.writeFileSync(memoryReadme, README_MEMORY, 'utf-8');
  }
}

/**
 * Parses YAML frontmatter from a Markdown string.
 * Returns title and tags.
 */
function parseFrontmatter(content: string): { title: string; tags: string[] } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let title = '';
  let tags: string[] = [];

  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();

    const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  // Fall back to first H1 heading if no frontmatter title
  if (!title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) title = h1Match[1].trim();
  }

  return { title, tags };
}

/**
 * Reads all .md files from context/ fully (skips README.md).
 */
export function readContextFiles(
  workspacePath: string,
): Array<{ filename: string; content: string }> {
  const contextDir = path.join(workspacePath, 'context');
  if (!fs.existsSync(contextDir)) return [];

  const files = fs
    .readdirSync(contextDir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

  return files.map((filename) => ({
    filename,
    content: fs.readFileSync(path.join(contextDir, filename), 'utf-8'),
  }));
}

/**
 * Reads only frontmatter (title + tags) from all .md files in memory/ (skips README.md).
 */
export function readMemoryIndex(workspacePath: string): MemoryFileEntry[] {
  const memoryDir = path.join(workspacePath, 'memory');
  if (!fs.existsSync(memoryDir)) return [];

  const files = fs
    .readdirSync(memoryDir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(memoryDir, filename), 'utf-8');
    const { title, tags } = parseFrontmatter(content);
    return { filename, title: title || filename.replace('.md', ''), tags };
  });
}

/**
 * Returns the full workspace content ready for system prompt injection.
 */
export function readWorkspaceContent(workspacePath: string): WorkspaceContent {
  return {
    workspacePath,
    contextFiles: readContextFiles(workspacePath),
    memoryIndex: readMemoryIndex(workspacePath),
  };
}
