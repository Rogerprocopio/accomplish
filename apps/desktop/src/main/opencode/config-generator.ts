import { app } from 'electron';
import path from 'path';
import {
  generateConfig,
  ACCOMPLISH_AGENT_NAME,
  buildProviderConfigs,
  syncApiKeysToOpenCodeAuth as coreSyncApiKeysToOpenCodeAuth,
  getOpenCodeAuthPath,
  isTokenExpired,
  refreshAccessToken,
} from '@accomplish_ai/agent-core';
import type { IntegrationContext, ToolContext, WorkspaceContext } from '@accomplish_ai/agent-core';
import { getAllIntegratedServices } from '@accomplish_ai/agent-core/storage/repositories/integratedServices';
import { getAllCustomTools } from '@accomplish_ai/agent-core/storage/repositories/customTools';
import { initWorkspace, readWorkspaceContent } from '@accomplish_ai/agent-core/workspace/manager';
import { getRunCommand } from '../services/toolsManager';
import { getApiKey, getAllApiKeys } from '../store/secureStorage';
import { getStorage } from '../store/storage';
import { getBundledNodePaths } from '../utils/bundled-node';
import { skillsManager } from '../skills';
import { PERMISSION_API_PORT, QUESTION_API_PORT } from '@accomplish_ai/agent-core';

export { ACCOMPLISH_AGENT_NAME };

/**
 * Returns the path to MCP tools directory.
 * Electron-specific: uses app.isPackaged and process.resourcesPath.
 */
export function getMcpToolsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp-tools');
  } else {
    return path.join(app.getAppPath(), '..', '..', 'packages', 'agent-core', 'mcp-tools');
  }
}

/**
 * Returns the OpenCode config directory.
 * Electron-specific: uses app.isPackaged and process.resourcesPath.
 */
export function getOpenCodeConfigDir(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return path.join(app.getAppPath(), '..', '..', 'packages', 'agent-core');
  }
}

/**
 * Generates the OpenCode configuration file.
 *
 * @param azureFoundryToken - Optional Azure Foundry token for Entra ID auth
 * @returns Path to the generated config file
 */
export async function generateOpenCodeConfig(azureFoundryToken?: string): Promise<string> {
  const mcpToolsPath = getMcpToolsPath();
  const userDataPath = app.getPath('userData');
  const bundledNodeBinPath = getBundledNodePaths()?.binDir;

  console.log('[OpenCode Config] MCP tools path:', mcpToolsPath);
  console.log('[OpenCode Config] User data path:', userDataPath);
  if (!bundledNodeBinPath) {
    throw new Error(
      '[OpenCode Config] Bundled Node.js path is missing. ' +
        'Run "pnpm -F @accomplish/desktop download:nodejs" and rebuild before launching.',
    );
  }

  // Use the extracted buildProviderConfigs from core package
  const { providerConfigs, enabledProviders, modelOverride } = await buildProviderConfigs({
    getApiKey,
    azureFoundryToken,
  });

  // Inject store:false for OpenAI to prevent 403 errors
  // with project-scoped keys (sk-proj-...) that lack /v1/chat/completions storage permission
  const openAiApiKey = getApiKey('openai');
  if (openAiApiKey) {
    const existingOpenAi = providerConfigs.find((p) => p.id === 'openai');
    if (existingOpenAi) {
      existingOpenAi.options.store = false;
    } else {
      providerConfigs.push({
        id: 'openai',
        options: { store: false },
      });
    }
  }

  const enabledSkills = await skillsManager.getEnabled();

  // Fetch enabled connectors with valid tokens
  const storage = getStorage();
  const enabledConnectors = storage.getEnabledConnectors();
  const connectors: Array<{ id: string; name: string; url: string; accessToken: string }> = [];

  for (const connector of enabledConnectors) {
    if (connector.status !== 'connected') continue;

    let tokens = storage.getConnectorTokens(connector.id);
    if (!tokens?.accessToken) {
      console.warn(`[Connectors] Missing access token for ${connector.name}`);
      storage.setConnectorStatus(connector.id, 'error');
      continue;
    }

    // Refresh token if expired
    if (isTokenExpired(tokens)) {
      if (tokens.refreshToken && connector.oauthMetadata && connector.clientRegistration) {
        try {
          tokens = await refreshAccessToken({
            tokenEndpoint: connector.oauthMetadata.tokenEndpoint,
            refreshToken: tokens.refreshToken,
            clientId: connector.clientRegistration.clientId,
            clientSecret: connector.clientRegistration.clientSecret,
          });
          storage.storeConnectorTokens(connector.id, tokens);
        } catch (err) {
          console.warn(`[Connectors] Token refresh failed for ${connector.name}:`, err);
          storage.setConnectorStatus(connector.id, 'error');
          continue;
        }
      } else {
        console.warn(
          `[Connectors] Access token expired for ${connector.name} and cannot be refreshed`,
        );
        storage.setConnectorStatus(connector.id, 'error');
        continue;
      }
    }

    connectors.push({
      id: connector.id,
      name: connector.name,
      url: connector.url,
      accessToken: tokens.accessToken,
    });
  }

  // Load registered integrations with their API keys
  const integrations: IntegrationContext[] = [];
  try {
    const registeredServices = getAllIntegratedServices();
    for (const service of registeredServices) {
      integrations.push({
        description: service.description,
        apiKey: service.apiKey,
      });
    }
    if (integrations.length > 0) {
      console.log(
        `[OpenCode Config] Loaded ${integrations.length} integration(s) into system prompt`,
      );
    }
  } catch (err) {
    console.warn('[OpenCode Config] Failed to load integrations:', err);
  }

  // Load ready custom tools
  const tools: ToolContext[] = [];
  try {
    const nodePath = bundledNodeBinPath
      ? path.join(bundledNodeBinPath, process.platform === 'win32' ? 'node.exe' : 'node')
      : 'node';
    const allTools = getAllCustomTools();
    for (const tool of allTools) {
      if (tool.status === 'ready') {
        tools.push({
          name: tool.name,
          description: tool.description,
          language: tool.language,
          runCommand: getRunCommand(tool, userDataPath, nodePath),
        });
      }
    }
    if (tools.length > 0) {
      console.log(`[OpenCode Config] Loaded ${tools.length} custom tool(s) into system prompt`);
    }
  } catch (err) {
    console.warn('[OpenCode Config] Failed to load custom tools:', err);
  }

  // Load workspace content (context files fully + memory index only)
  let workspace: WorkspaceContext | undefined;
  try {
    const workspacePath = getWorkspacePath();
    initWorkspace(workspacePath);
    const content = readWorkspaceContent(workspacePath);
    workspace = content;
    const ctxCount = content.contextFiles.length;
    const memCount = content.memoryIndex.length;
    if (ctxCount > 0 || memCount > 0) {
      console.log(
        `[OpenCode Config] Workspace loaded: ${ctxCount} context file(s), ${memCount} memory note(s)`,
      );
    }
  } catch (err) {
    console.warn('[OpenCode Config] Failed to load workspace:', err);
  }

  const result = generateConfig({
    platform: process.platform,
    mcpToolsPath,
    userDataPath,
    isPackaged: app.isPackaged,
    bundledNodeBinPath,
    skills: enabledSkills,
    providerConfigs,
    permissionApiPort: PERMISSION_API_PORT,
    questionApiPort: QUESTION_API_PORT,
    enabledProviders,
    model: modelOverride?.model,
    smallModel: modelOverride?.smallModel,
    connectors: connectors.length > 0 ? connectors : undefined,
    integrations: integrations.length > 0 ? integrations : undefined,
    tools: tools.length > 0 ? tools : undefined,
    workspace,
  });

  process.env.OPENCODE_CONFIG = result.configPath;
  process.env.OPENCODE_CONFIG_DIR = path.dirname(result.configPath);

  console.log('[OpenCode Config] Generated config at:', result.configPath);
  console.log('[OpenCode Config] OPENCODE_CONFIG env set to:', process.env.OPENCODE_CONFIG);
  console.log('[OpenCode Config] OPENCODE_CONFIG_DIR env set to:', process.env.OPENCODE_CONFIG_DIR);

  return result.configPath;
}

/**
 * Returns the path to the OpenCode config file.
 */
export function getOpenCodeConfigPath(): string {
  return path.join(app.getPath('userData'), 'opencode', 'opencode.json');
}

/**
 * Returns the path to the workspace directory (in the user's home directory).
 */
export function getWorkspacePath(): string {
  return path.join(app.getPath('home'), 'workspace');
}

// Re-export getOpenCodeAuthPath from core for consumers that import from this module
export { getOpenCodeAuthPath };

/**
 * Syncs API keys to the OpenCode auth.json file.
 * Uses Electron-specific path resolution and secure storage access.
 */
export async function syncApiKeysToOpenCodeAuth(): Promise<void> {
  const apiKeys = await getAllApiKeys();
  const authPath = getOpenCodeAuthPath();

  await coreSyncApiKeysToOpenCodeAuth(authPath, apiKeys);
}
