import { Modal, type App } from 'obsidian';

export interface ConfirmModalOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
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
  declare onConfirm: (() => void) | undefined;
  declare onCancel: (() => void) | undefined;
  declare _responded: boolean;

  constructor(app: App, opts: ConfirmModalOptions) {
    super(app);
    this.title = opts.title || 'Confirm Action';
    this.message = opts.message || 'Are you sure?';
    this.confirmLabel = opts.confirmLabel || 'Confirm';
    this.cancelLabel = opts.cancelLabel || 'Cancel';
    this.onConfirm = opts.onConfirm;
    this.onCancel = opts.onCancel;
    this._responded = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
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
    cancelBtn.addEventListener('click', () => {
      this._responded = true;
      this.close();
      if (this.onCancel) this.onCancel();
    });

    const confirmBtn = row.createEl('button', { text: this.confirmLabel, cls: 'cad-btn primary danger' });
    confirmBtn.addEventListener('click', () => {
      this._responded = true;
      this.close();
      if (this.onConfirm) this.onConfirm();
    });

    setTimeout(() => confirmBtn.focus(), 50);
  }

  onClose() {
    if (!this._responded && this.onCancel) {
      this.onCancel();
    }
  }
}
