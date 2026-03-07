import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { CustomTool } from '@accomplish_ai/agent-core/common';
import { updateCustomToolStatus } from '@accomplish_ai/agent-core/storage/repositories/customTools';

// ── Helpers ─────────────────────────────────────────────────────────────────

function execCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const proc = spawn(cmd, args, { cwd, shell: false });

    proc.stdout.on('data', (d: Buffer) => stdout.push(d.toString()));
    proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.join(''), stderr: stderr.join('') });
      } else {
        reject(new Error(stderr.join('') || `Process exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function findPython(): Promise<string> {
  const candidates =
    process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      await execCommand(cmd, ['--version'], process.cwd());
      return cmd;
    } catch {
      continue;
    }
  }
  throw new Error('Python não encontrado. Instale Python 3 para usar tools Python.');
}

function getToolDir(userDataPath: string, toolId: string): string {
  return path.join(userDataPath, 'tools', toolId);
}

function getPythonExe(toolDir: string): string {
  return process.platform === 'win32'
    ? path.join(toolDir, 'venv', 'Scripts', 'python.exe')
    : path.join(toolDir, 'venv', 'bin', 'python');
}

function getPipExe(toolDir: string): string {
  return process.platform === 'win32'
    ? path.join(toolDir, 'venv', 'Scripts', 'pip.exe')
    : path.join(toolDir, 'venv', 'bin', 'pip');
}

// ── Setup ────────────────────────────────────────────────────────────────────

async function setupPythonTool(tool: CustomTool, toolDir: string): Promise<void> {
  // Write code and requirements
  fs.writeFileSync(path.join(toolDir, 'tool.py'), tool.code, 'utf-8');
  if (tool.requirements.trim()) {
    fs.writeFileSync(path.join(toolDir, 'requirements.txt'), tool.requirements.trim(), 'utf-8');
  }

  // Create venv
  const python = await findPython();
  await execCommand(python, ['-m', 'venv', 'venv'], toolDir);

  // Install requirements if any
  if (tool.requirements.trim()) {
    const pip = getPipExe(toolDir);
    await execCommand(pip, ['install', '-r', 'requirements.txt'], toolDir);
  }
}

async function setupNodeTool(tool: CustomTool, toolDir: string, nodePath: string): Promise<void> {
  // Write code
  fs.writeFileSync(path.join(toolDir, 'index.js'), tool.code, 'utf-8');

  // Parse requirements into package.json dependencies
  const deps: Record<string, string> = {};
  if (tool.requirements.trim()) {
    const pkgs = tool.requirements
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pkg of pkgs) {
      // support "package@version" syntax
      const atIdx = pkg.lastIndexOf('@');
      if (atIdx > 0) {
        deps[pkg.slice(0, atIdx)] = pkg.slice(atIdx + 1);
      } else {
        deps[pkg] = 'latest';
      }
    }
  }

  const packageJson = JSON.stringify(
    {
      name: `tool-${tool.id}`,
      version: '1.0.0',
      type: 'commonjs',
      dependencies: deps,
    },
    null,
    2,
  );
  fs.writeFileSync(path.join(toolDir, 'package.json'), packageJson, 'utf-8');

  // npm is in the same dir as node
  const npmPath =
    process.platform === 'win32'
      ? path.join(path.dirname(nodePath), 'npm.cmd')
      : path.join(path.dirname(nodePath), 'npm');

  if (Object.keys(deps).length > 0) {
    await execCommand(npmPath, ['install', '--no-fund', '--no-audit'], toolDir);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sets up the virtual environment for a tool.
 * Updates the tool's status in the database when done.
 */
export async function setupToolEnvironment(
  tool: CustomTool,
  userDataPath: string,
  nodePath: string,
): Promise<void> {
  const toolDir = getToolDir(userDataPath, tool.id);
  fs.mkdirSync(toolDir, { recursive: true });

  updateCustomToolStatus(tool.id, 'setting_up');

  try {
    if (tool.language === 'python') {
      await setupPythonTool(tool, toolDir);
    } else {
      await setupNodeTool(tool, toolDir, nodePath);
    }
    updateCustomToolStatus(tool.id, 'ready');
    console.log(`[ToolsManager] Tool "${tool.name}" ready at ${toolDir}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateCustomToolStatus(tool.id, 'error', msg);
    console.error(`[ToolsManager] Setup failed for "${tool.name}":`, msg);
    throw err;
  }
}

/**
 * Returns the shell command the agent should use to run this tool.
 * e.g.: `"C:\...\venv\Scripts\python.exe" "C:\...\tool.py"`
 */
export function getRunCommand(tool: CustomTool, userDataPath: string, nodePath: string): string {
  const toolDir = getToolDir(userDataPath, tool.id);

  if (tool.language === 'python') {
    const pyExe = getPythonExe(toolDir);
    const script = path.join(toolDir, 'tool.py');
    return `"${pyExe}" "${script}"`;
  } else {
    const script = path.join(toolDir, 'index.js');
    return `"${nodePath}" "${script}"`;
  }
}

/**
 * Removes all files for a tool from disk.
 */
export function cleanupToolDirectory(userDataPath: string, toolId: string): void {
  const toolDir = getToolDir(userDataPath, toolId);
  if (fs.existsSync(toolDir)) {
    fs.rmSync(toolDir, { recursive: true, force: true });
    console.log(`[ToolsManager] Removed tool directory: ${toolDir}`);
  }
}

/**
 * Rewrites the tool files and re-runs setup (for updates).
 */
export async function rebuildToolEnvironment(
  tool: CustomTool,
  userDataPath: string,
  nodePath: string,
): Promise<void> {
  cleanupToolDirectory(userDataPath, tool.id);
  await setupToolEnvironment(tool, userDataPath, nodePath);
}
