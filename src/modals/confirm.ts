import { Modal, type App } from 'obsidian';

/** How the confirm button is styled: `danger` (red, the default) for a
    destructive action, `primary` for any other. */
export type ConfirmStyle = 'danger' | 'primary';

const CONFIRM_BUTTON_CLS: Record<ConfirmStyle, string> = {
  danger: 'cad-btn primary danger',
  primary: 'cad-btn primary',
};

export interface ConfirmModalOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to `danger`. */
  confirmStyle?: ConfirmStyle;
  onConfirm?: () => void;
  /** Called from the cancel button and when closed without a response. */
  onCancel?: () => void;
}

/* ─────────── Confirm modal (replaces blocking window.confirm) ─────────── */
export class CadenceConfirmModal extends Modal {
  declare title: string;
  declare message: string;
  declare confirmLabel: string;
  declare cancelLabel: string;
  declare confirmStyle: ConfirmStyle;
  declare onConfirm: (() => void) | undefined;
  declare onCancel: (() => void) | undefined;
  declare _responded: boolean;
  /** Set by onOpen(); Enter with it focused cancels. */
  declare _cancelBtn?: HTMLButtonElement;

  constructor(app: App, opts: ConfirmModalOptions = {}) {
    super(app);
    this.title = opts.title || 'Confirm Action';
    this.message = opts.message || 'Are you sure?';
    this.confirmLabel = opts.confirmLabel || 'Confirm';
    this.cancelLabel = opts.cancelLabel || 'Cancel';
    this.confirmStyle = opts.confirmStyle && Object.prototype.hasOwnProperty.call(CONFIRM_BUTTON_CLS, opts.confirmStyle) ? opts.confirmStyle : 'danger';
    this.onConfirm = opts.onConfirm;
    this.onCancel = opts.onCancel;
    this._responded = false;

    // Registered once, here, so reopening never adds a second listener.
    // Enter confirms, unless Cancel has focus; Escape cancels.
    this.contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._respond(e.target === this._cancelBtn ? this.onCancel : this.onConfirm);
      }
      if (e.key === 'Escape') { e.preventDefault(); this._respond(this.onCancel); }
    });
  }

  /* Answer once: close, then call the callback. */
  _respond(callback: (() => void) | undefined) {
    if (this._responded) return;
    this._responded = true;
    this.close();
    callback?.();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this._responded = false;
    contentEl.addClass('cad-prompt-modal');
    contentEl.addClass('cad-confirm-modal');
    contentEl.createEl('h3', { text: this.title });

    const msg = contentEl.createEl('p', { text: this.message });
    msg.style.fontSize = '14px';
    msg.style.marginTop = '8px';
    msg.style.marginBottom = '20px';
    msg.style.color = 'var(--text-muted)';

    const row = contentEl.createDiv();
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';

    const cancelBtn = row.createEl('button', { text: this.cancelLabel, cls: 'cad-btn' });
    cancelBtn.addEventListener('click', () => this._respond(this.onCancel));
    this._cancelBtn = cancelBtn;

    const confirmBtn = row.createEl('button', { text: this.confirmLabel, cls: CONFIRM_BUTTON_CLS[this.confirmStyle] });
    confirmBtn.addEventListener('click', () => this._respond(this.onConfirm));

    setTimeout(() => confirmBtn.focus(), 50);
  }

  onClose() {
    if (!this._responded && this.onCancel) {
      this._responded = true;
      this.onCancel();
    }
    this.contentEl.empty();
  }
}
