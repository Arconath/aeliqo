import { connectHostedDeepSeek, type HostedDeepSeekConnection } from './deepseek-agent.js';
import type { PlaygroundScenario } from './scenarios.js';
import type { PlaygroundSession } from './session.js';

interface HostedDeepSeekControlOptions {
  readonly connectionKind: HTMLSelectElement;
  readonly localControls: HTMLElement;
  readonly controls: HTMLElement;
  readonly keyInput: HTMLInputElement;
  readonly consent: HTMLInputElement;
  readonly connectButton: HTMLButtonElement;
  readonly disconnectButton: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly prompt: HTMLTextAreaElement;
  readonly sendButton: HTMLButtonElement;
  readonly getSession: () => PlaygroundSession;
  readonly getScenario: () => PlaygroundScenario;
  readonly showConnection: (label: string, state: string) => void;
  readonly updateComposer: () => void;
  readonly onConnected: () => void;
  readonly onDisconnected: () => void;
  readonly recordModelRequests: (count: number) => void;
}

export interface HostedDeepSeekControls {
  clear(): boolean;
  cancel(): void;
  update(): void;
  connect(): Promise<void>;
  disconnect(): void;
  submit(): Promise<void>;
}

function validKey(value: string): boolean {
  return value.length > 0 && value.length <= 1_024 && !/[\u0000-\u0020\u007f]/u.test(value);
}

function promptStatus(result: Awaited<ReturnType<HostedDeepSeekConnection['run']>>): string {
  if (!result.ok) return 'The Playground could not validate the DeepSeek response. No UI change was committed.';
  const receipt = result.value;
  if (receipt.stop === 'renderer-ready')
    return `DeepSeek completed ${receipt.toolCalls} validated tool calls and the renderer confirmed the view.`;
  if (receipt.textDraft !== undefined)
    return `DeepSeek draft (not a verified UI change): ${receipt.textDraft.slice(0, 600)}`;
  if (receipt.stop === 'cancelled') return 'The DeepSeek request was cancelled.';
  return `DeepSeek stopped as ${receipt.stop}; no unsupported claim is shown as success.`;
}

class HostedDeepSeekControlState implements HostedDeepSeekControls {
  private connection: HostedDeepSeekConnection | undefined;
  private attempt = 0;
  private connecting = false;

  constructor(private readonly options: HostedDeepSeekControlOptions) {
    options.keyInput.addEventListener('input', this.update);
    options.consent.addEventListener('change', this.update);
    options.connectButton.addEventListener('click', () => void this.connect());
    options.disconnectButton.addEventListener('click', () => this.disconnect());
    this.update();
  }

  update = (): void => {
    const selected = this.options.connectionKind.value === 'deepseek';
    this.options.controls.hidden = !selected;
    this.options.localControls.hidden = selected;
    this.options.connectButton.disabled =
      !selected ||
      this.connecting ||
      this.connection !== undefined ||
      !this.options.consent.checked ||
      this.options.keyInput.value.trim().length === 0;
  };

  clear(): boolean {
    const hadHostedState =
      this.connection !== undefined ||
      this.connecting ||
      this.options.keyInput.value.length > 0 ||
      this.options.consent.checked;
    this.attempt += 1;
    this.connecting = false;
    this.connection?.close();
    this.connection = undefined;
    this.options.keyInput.value = '';
    this.options.keyInput.disabled = false;
    this.options.consent.checked = false;
    this.options.consent.disabled = false;
    this.options.connectButton.hidden = false;
    this.options.connectButton.disabled = true;
    this.options.disconnectButton.hidden = true;
    this.update();
    return hadHostedState;
  }

  cancel(): void {
    this.connection?.cancel();
  }

  async connect(): Promise<void> {
    if (this.options.connectionKind.value !== 'deepseek' || this.connecting || this.connection !== undefined) return;
    if (!this.options.consent.checked) {
      this.options.showConnection('Review the disclosure and opt in before connecting.', 'disconnected');
      return;
    }
    const apiKey = this.options.keyInput.value.trim();
    if (!validKey(apiKey)) {
      this.options.showConnection('Enter a valid DeepSeek API key to connect.', 'failed');
      return;
    }

    const currentAttempt = ++this.attempt;
    this.connecting = true;
    this.options.keyInput.value = '';
    this.options.keyInput.disabled = true;
    this.options.consent.disabled = true;
    this.options.connectButton.disabled = true;
    this.options.showConnection('Opening a direct browser connection to DeepSeek…', 'connecting');
    try {
      const result = await connectHostedDeepSeek(this.options.getSession(), apiKey);
      if (currentAttempt !== this.attempt) {
        if ('connection' in result) result.connection.close();
        return;
      }
      if ('error' in result) {
        this.options.keyInput.disabled = false;
        this.options.consent.disabled = false;
        this.options.showConnection(result.error, 'failed');
        return;
      }
      this.connection = result.connection;
      this.options.onConnected();
      this.options.connectButton.hidden = true;
      this.options.disconnectButton.hidden = false;
      this.options.showConnection(
        'DeepSeek is configured. Provider verification starts with your first prompt; your key stays in this page.',
        'configured',
      );
    } catch {
      if (currentAttempt !== this.attempt) return;
      this.options.keyInput.disabled = false;
      this.options.consent.disabled = false;
      this.options.showConnection('The Playground could not open the DeepSeek connection.', 'failed');
    } finally {
      if (currentAttempt === this.attempt) {
        this.connecting = false;
        this.options.keyInput.value = '';
        this.update();
        this.options.updateComposer();
      }
    }
  }

  disconnect(): void {
    this.clear();
    this.options.onDisconnected();
    this.options.updateComposer();
    this.options.showConnection('Disconnected from DeepSeek; the browser-held key was cleared.', 'disconnected');
  }

  async submit(): Promise<void> {
    const target = this.connection;
    const value = this.options.prompt.value.trim();
    if (target === undefined || value.length === 0) return;
    this.options.sendButton.disabled = true;
    this.options.status.textContent = 'Sending the prompt and selected synthetic scenario directly to DeepSeek…';
    try {
      const result = await target.run(value, this.options.getScenario());
      if (target !== this.connection) return;
      if (result.ok && result.value.stop === 'cancelled') {
        this.options.showConnection('DeepSeek is configured. The last request was cancelled.', 'configured');
      } else if (result.ok && result.value.stop !== 'failed') {
        this.options.recordModelRequests(result.value.modelRequests);
        this.options.showConnection('DeepSeek verified by a provider response.', 'verified');
      } else {
        this.options.showConnection(
          'DeepSeek returned an invalid or incomplete response; configuration is retained.',
          'failed',
        );
      }
      this.options.status.textContent = promptStatus(result);
    } catch {
      if (target === this.connection) {
        this.options.showConnection('DeepSeek request failed; configuration is retained for a retry.', 'failed');
        this.options.status.textContent =
          'The direct DeepSeek request failed safely. No provider details were recorded.';
      }
    } finally {
      if (target === this.connection) this.options.updateComposer();
    }
  }
}

export function createHostedDeepSeekControls(options: HostedDeepSeekControlOptions): HostedDeepSeekControls {
  return new HostedDeepSeekControlState(options);
}
