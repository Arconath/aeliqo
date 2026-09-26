/**
 * Copyable MCP client configs for the local playground runner. The bearer
 * token is printed by `pnpm playground:local`; this page never sees it.
 */
const TOKEN_PLACEHOLDER = '<token>';

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

async function copyConfig(source: HTMLElement, status: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(source.textContent ?? '');
    status.textContent = 'Copied. Replace <token> with the bearer token printed by pnpm playground:local.';
  } catch {
    status.textContent = 'Copy is unavailable — select the config text and copy it manually.';
  }
}

export function bindConfigCopy(root: HTMLElement, status: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-copy-config]')) {
    const source = root.querySelector<HTMLElement>(`#pg-mcp-${button.dataset.copyConfig ?? ''}`);
    if (source === null) continue;
    button.addEventListener('click', () => void copyConfig(source, status));
  }
}
