import type { AeliqoAppActionEvent } from '@aeliqo/web/app';

type PendingAction = Extract<AeliqoAppActionEvent, { readonly state: 'preview' }>;

interface ActionReviewOptions {
  readonly dialog: HTMLDialogElement;
  readonly content: HTMLElement;
  readonly cancelButton: HTMLButtonElement;
  readonly confirmButton: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly pageStatus: HTMLElement;
  readonly receiptState: HTMLElement;
  readonly stringify: (value: unknown) => string;
  readonly setError: (message?: string) => void;
}

export interface ActionReviewController {
  readonly handle: (event: AeliqoAppActionEvent) => void;
  reset(): void;
}

function deepestActiveElement(): HTMLElement | undefined {
  let active = document.activeElement;
  while (active instanceof HTMLElement && active.shadowRoot?.activeElement instanceof HTMLElement)
    active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : undefined;
}

class ActionReviewState implements ActionReviewController {
  private pending: PendingAction | undefined;
  private returnFocus: HTMLElement | undefined;

  constructor(private readonly options: ActionReviewOptions) {
    options.cancelButton.addEventListener('click', this.cancel);
    options.confirmButton.addEventListener('click', () => void this.confirm());
    options.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.cancel();
    });
  }

  handle = (event: AeliqoAppActionEvent): void => {
    if (event.state === 'preview') {
      this.showPreview(event);
      return;
    }
    this.pending = undefined;
    if (event.state === 'failed') {
      this.showFailure(event.diagnostics[0]?.message ?? 'The action failed.');
      return;
    }
    this.showExecution(event.execution.state);
  };

  reset(): void {
    this.pending = undefined;
    this.returnFocus = undefined;
  }

  private showPreview(event: PendingAction): void {
    this.pending = event;
    this.returnFocus = deepestActiveElement();
    this.options.cancelButton.disabled = false;
    this.options.cancelButton.textContent = 'Cancel';
    this.options.confirmButton.disabled = false;
    this.options.confirmButton.removeAttribute('aria-busy');
    this.options.status.textContent = 'Waiting for your confirmation.';
    this.options.content.textContent = this.options.stringify({
      action: event.preview.action,
      sideEffect: event.preview.sideEffect,
      confirmation: event.preview.confirmation,
      input: event.preview.input,
    });
    this.options.dialog.showModal();
  }

  private showFailure(message: string): void {
    this.options.cancelButton.disabled = false;
    this.options.cancelButton.textContent = 'Close';
    this.options.confirmButton.disabled = true;
    this.options.confirmButton.removeAttribute('aria-busy');
    this.options.status.textContent = message;
    this.options.setError(message);
  }

  private showExecution(state: 'executed' | 'ambiguous'): void {
    this.options.confirmButton.disabled = true;
    this.options.confirmButton.removeAttribute('aria-busy');
    this.options.status.textContent =
      state === 'executed' ? 'Action completed.' : 'The remote result is uncertain; reconcile before retrying.';
    this.options.pageStatus.textContent = this.options.status.textContent;
    this.options.receiptState.textContent = state;
    if (state === 'executed') this.close();
    else {
      this.options.cancelButton.disabled = false;
      this.options.cancelButton.textContent = 'Close';
    }
  }

  private close(): void {
    this.options.dialog.close();
    const target = this.returnFocus;
    this.returnFocus = undefined;
    window.setTimeout(() => {
      if (!this.options.dialog.open && target?.isConnected === true) target.focus();
    }, 0);
  }

  private cancel = (): void => {
    this.pending?.cancel();
    this.pending = undefined;
    this.close();
  };

  private async confirm(): Promise<void> {
    const action = this.pending;
    if (action === undefined) return;
    this.options.cancelButton.disabled = true;
    this.options.confirmButton.disabled = true;
    this.options.confirmButton.setAttribute('aria-busy', 'true');
    this.options.status.textContent = 'Rechecking authority and executing…';
    try {
      await action.confirm();
    } catch {
      if (this.pending !== action) return;
      this.failConfirmation(action);
    }
  }

  private failConfirmation(action: PendingAction): void {
    action.cancel();
    this.pending = undefined;
    this.options.cancelButton.disabled = false;
    this.options.cancelButton.textContent = 'Close';
    this.options.confirmButton.removeAttribute('aria-busy');
    this.options.status.textContent = 'The action failed safely. Close this review and try again.';
    this.options.setError(this.options.status.textContent);
  }
}

export function createActionReviewController(options: ActionReviewOptions): ActionReviewController {
  return new ActionReviewState(options);
}
