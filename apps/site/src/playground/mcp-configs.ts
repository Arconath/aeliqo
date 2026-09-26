/**
 * Copyable MCP client configs for the playground's remote-agent paths. The
 * local runner's bearer token is printed by `pnpm playground:local` and never
 * enters this page; the hosted relay's short-lived token arrives from /pair
 * and is embedded in the hosted variant below.
 */
import type { RelayPair } from './hosted-relay.js';

const TOKEN_PLACEHOLDER = '<token>';
const COPY_MANUAL = 'Copy is unavailable — select the config text and copy it manually.';

export const COPY_HINTS = {
  local: 'Copied. Replace <token> with the bearer token printed by pnpm playground:local.',
  hosted: 'Copied — the bearer token is included. It stays valid until the relay session expires.',
} as const;

function config(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderMcpClientConfigs(http: HTMLElement, stdio: HTMLElement): void {
  const origin = window.location.origin;
  http.textContent = config({
    mcpServers: {
      'aeliqo-playground': {
        type: 'streamable-http',
        url: `${origin}/mcp`,
        headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
      },
    },
  });
  stdio.textContent = config({
    mcpServers: {
      'aeliqo-playground': {
        command: 'pnpm',
        args: ['--dir', 'apps/site', 'mcp:stdio'],
        env: { AELIQO_LOCAL_URL: origin, AELIQO_MCP_TOKEN: TOKEN_PLACEHOLDER },
      },
    },
  });
}

/** The hosted variant carries the real short-lived bearer token from /pair. */
export function renderHostedMcpConfig(http: HTMLElement, cli: HTMLElement, pair: RelayPair): void {
  http.textContent = config({
    mcpServers: {
      'aeliqo-playground': {
        type: 'streamable-http',
        url: pair.mcpUrl,
        headers: { Authorization: `Bearer ${pair.token}` },
      },
    },
  });
  cli.textContent = `claude mcp add --transport http aeliqo-playground ${pair.mcpUrl} --header "Authorization: Bearer ${pair.token}"\n`;
}

async function copyConfig(source: HTMLElement, status: HTMLElement, copied: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(source.textContent ?? '');
    status.textContent = copied;
  } catch {
    status.textContent = COPY_MANUAL;
  }
}

export function bindConfigCopy(root: HTMLElement, status: HTMLElement, copied: string = COPY_HINTS.local): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-copy-config]')) {
    const source = root.querySelector<HTMLElement>(`#pg-mcp-${button.dataset.copyConfig ?? ''}`);
    if (source === null) continue;
    button.addEventListener('click', () => void copyConfig(source, status, copied));
  }
}
