import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import type { DiscoveredEndpoint } from '@accomplish_ai/agent-core';

// OpenAPI-compatible spec shape (simplified)
interface OpenApiSpec {
  info?: { title?: string; description?: string; version?: string };
  paths?: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          description?: string;
          schema?: { type?: string };
        }>;
      }
    >
  >;
}

const DISCOVERY_PATHS = [
  '/openapi.json',
  '/swagger.json',
  '/api-docs',
  '/api/openapi.json',
  '/api/swagger.json',
  '/v1/openapi.json',
  '/docs/openapi.json',
];

function fetchUrl(url: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        Accept: 'application/json',
        'User-Agent': 'Accomplish-AI/1.0',
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

function parseOpenApiSpec(specJson: string): DiscoveredEndpoint[] {
  let spec: OpenApiSpec;
  try {
    spec = JSON.parse(specJson) as OpenApiSpec;
  } catch {
    return [];
  }

  if (!spec.paths) {
    return [];
  }

  const endpoints: DiscoveredEndpoint[] = [];
  for (const [endpointPath, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        const params = (operation.parameters ?? []).map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          description: p.description,
          type: p.schema?.type,
        }));

        endpoints.push({
          method: method.toUpperCase(),
          path: endpointPath,
          summary: operation.summary,
          description: operation.description,
          parameters: params.length > 0 ? params : undefined,
        });
      }
    }
  }

  return endpoints;
}

function buildMarkdownDoc(
  serviceName: string,
  baseUrl: string,
  endpoints: DiscoveredEndpoint[],
): string {
  const lines: string[] = [
    `# ${serviceName} — API Documentation`,
    '',
    `> Generated automatically by Accomplish on ${new Date().toLocaleString()}`,
    '',
    `**Base URL:** \`${baseUrl}\``,
    '',
    '---',
    '',
  ];

  if (endpoints.length === 0) {
    lines.push(
      '> No endpoints were auto-discovered. Add them manually or provide an OpenAPI spec URL.',
    );
    return lines.join('\n');
  }

  lines.push(`## Endpoints (${endpoints.length} total)`, '');

  for (const ep of endpoints) {
    lines.push(`### \`${ep.method} ${ep.path}\``);
    if (ep.summary) {
      lines.push('', ep.summary);
    }
    if (ep.description) {
      lines.push('', ep.description);
    }

    if (ep.parameters && ep.parameters.length > 0) {
      lines.push('', '**Parameters:**', '');
      lines.push('| Name | In | Required | Type | Description |');
      lines.push('|------|----|----------|------|-------------|');
      for (const p of ep.parameters) {
        lines.push(
          `| \`${p.name}\` | ${p.in} | ${p.required ? 'yes' : 'no'} | ${p.type ?? '—'} | ${p.description ?? '—'} |`,
        );
      }
    }

    lines.push('', '**Example:**', '```bash');
    const examplePath = ep.path.replace(/{([^}]+)}/g, '<$1>');
    lines.push(`curl -X ${ep.method} "${baseUrl}${examplePath}" \\`);
    lines.push('  -H "Authorization: Bearer YOUR_API_KEY"');
    lines.push('```', '');
  }

  return lines.join('\n');
}

export interface WebhookDiscoveryResult {
  endpoints: DiscoveredEndpoint[];
  docPath: string;
  markdownContent: string;
}

export async function discoverAndDocumentService(
  serviceName: string,
  baseUrl: string,
  apiKey: string,
  servicesDir: string,
): Promise<WebhookDiscoveryResult> {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  let endpoints: DiscoveredEndpoint[] = [];

  // Try each discovery path
  for (const discoveryPath of DISCOVERY_PATHS) {
    const url = `${normalizedBase}${discoveryPath}`;
    try {
      const body = await fetchUrl(url, apiKey);
      const parsed = parseOpenApiSpec(body);
      if (parsed.length > 0) {
        endpoints = parsed;
        console.log(`[WebhookDiscovery] Found ${parsed.length} endpoints via ${url}`);
        break;
      }
    } catch {
      // Try next path
    }
  }

  const markdownContent = buildMarkdownDoc(serviceName, normalizedBase, endpoints);

  // Save doc to disk
  if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir, { recursive: true });
  }

  const safeFileName = serviceName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const docPath = path.join(servicesDir, `${safeFileName}.md`);
  fs.writeFileSync(docPath, markdownContent, 'utf-8');

  return { endpoints, docPath, markdownContent };
}

export function readServiceDoc(docPath: string): string | null {
  try {
    if (fs.existsSync(docPath)) {
      return fs.readFileSync(docPath, 'utf-8');
    }
  } catch {
    // ignore
  }
  return null;
}
