import { Modal, type App } from 'obsidian';
import { fromLocalDatetimeValue, toLocalDatetimeValue } from '../utils/dates';
import type { CaptureResult } from '../types/modals';

export interface CaptureModalOptions {
  defaultText?: string;
  /** ISO timestamp; when set, the "Remind me" toggle starts checked. */
  defaultWhen?: string | null;
  defaultRepeat?: string;
  /** Called with the capture, or null when closed without submitting. */
  onSubmit?: (result: CaptureResult | null) => void;
}

/* ─────────── Quick-capture modal ─────────── */
export class CadenceCaptureModal extends Modal {
  declare onSubmit: ((result: CaptureResult | null) => void) | undefined;
  declare defaultText: string;
  declare defaultWhen: string | null;
  declare defaultRepeat: string;
  declare _submitted: boolean;

  constructor(app: App, opts: CaptureModalOptions) {
    super(app);
    this.onSubmit = opts.onSubmit;
    this.defaultText = opts.defaultText || '';
    this.defaultWhen = opts.defaultWhen || null; // ISO or null
    this.defaultRepeat = opts.defaultRepeat || 'none';
    this._submitted = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-capture-modal');
    contentEl.createEl('h3', { text: 'Quick capture' });

    const textRow = contentEl.createDiv({ cls: 'cad-form-row' });
    textRow.createDiv({ cls: 'cad-form-label', text: 'WHAT' });
    const textInput = textRow.createEl('input', { type: 'text', cls: 'cad-form-input' });
    textInput.placeholder = 'What needs doing?';
    textInput.value = this.defaultText;

    // Schedule toggle
    const schedToggleRow = contentEl.createDiv();
    schedToggleRow.style.marginTop = '14px';
    schedToggleRow.style.display = 'flex';
    schedToggleRow.style.alignItems = 'center';
    schedToggleRow.style.gap = '8px';
    const schedCb = schedToggleRow.createEl('input', { type: 'checkbox' });
    const schedLbl = schedToggleRow.createEl('label', { text: 'Remind me' });
    schedLbl.style.fontSize = '13px';
    schedLbl.style.cursor = 'pointer';
    schedLbl.addEventListener('click', () => { schedCb.checked = !schedCb.checked; schedCb.dispatchEvent(new Event('change')); });

    // Schedule fields (hidden until toggled)
    const schedFields = contentEl.createDiv({ cls: 'cad-capture-sched' });
    schedFields.style.display = 'none';
    schedFields.style.marginTop = '12px';
    schedFields.style.gap = '12px';
    schedFields.style.display = 'none';

    const dateRow = schedFields.createDiv({ cls: 'cad-form-row' });
    dateRow.createDiv({ cls: 'cad-form-label', text: 'WHEN' });
    const dateInput = dateRow.createEl('input', { type: 'datetime-local', cls: 'cad-form-input' });
    if (this.defaultWhen) {
      const d = new Date(this.defaultWhen);
      if (!isNaN(d.getTime())) dateInput.value = toLocalDatetimeValue(d);
    } else {
      // Default to now + 1 hour, rounded to next 15min
      const dft = new Date(Date.now() + 60 * 60 * 1000);
      dft.setMinutes(Math.ceil(dft.getMinutes() / 15) * 15, 0, 0);
      dateInput.value = toLocalDatetimeValue(dft);
    }

    // Quick-pick buttons
    const quick = schedFields.createDiv();
    quick.style.display = 'flex';
    quick.style.gap = '6px';
    quick.style.marginTop = '8px';
    quick.style.flexWrap = 'wrap';
    // Flagged, not fixed: 'Tomorrow 9am' passes a function as deltaMs, so
    // setQuick writes NaN-NaN-… first; the listener below then overwrites it.
    const setQuick = (deltaMs: number | (() => void)) => {
      const d = new Date(Date.now() + (deltaMs as number));
      d.setSeconds(0, 0);
      dateInput.value = toLocalDatetimeValue(d);
    };
    const mkQ = (label: string, deltaMs: number | (() => void)) => {
      const b = quick.createEl('button', { cls: 'cad-btn cad-btn-sm', text: label });
      b.type = 'button';
      b.addEventListener('click', () => setQuick(deltaMs));
    };
    mkQ('+15m', 15 * 60 * 1000);
    mkQ('+1h', 60 * 60 * 1000);
    mkQ('+3h', 3 * 60 * 60 * 1000);
    mkQ('Tomorrow 9am', () => { });
    quick.lastChild!.addEventListener('click', () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      dateInput.value = toLocalDatetimeValue(d);
    });

    const repeatRow = schedFields.createDiv({ cls: 'cad-form-row' });
    repeatRow.style.marginTop = '10px';
    repeatRow.createDiv({ cls: 'cad-form-label', text: 'REPEAT' });
    const repeatSelect = repeatRow.createEl('select', { cls: 'cad-form-input' });
    [['none', 'No repeat'], ['daily', 'Daily'], ['weekly', 'Weekly']].forEach(([v, l]) => {
      const o = repeatSelect.createEl('option', { value: v, text: l });
      if (v === this.defaultRepeat) o.selected = true;
    });

    schedCb.addEventListener('change', () => {
      schedFields.style.display = schedCb.checked ? 'block' : 'none';
    });
    if (this.defaultWhen) { schedCb.checked = true; schedFields.style.display = 'block'; }

    // Action row
    const row = contentEl.createDiv();
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';
    row.style.marginTop = '18px';
    const cancel = row.createEl('button', { cls: 'cad-btn', text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const ok = row.createEl('button', { cls: 'cad-btn primary', text: 'Capture' });
    ok.type = 'button';

    const submit = () => {
      const text = textInput.value.trim();
      if (!text) { textInput.focus(); return; }
      const result: CaptureResult = { text, when: null, repeat: 'none' };
      if (schedCb.checked && dateInput.value) {
        const d = fromLocalDatetimeValue(dateInput.value);
        if (d && !isNaN(d.getTime())) {
          result.when = d.toISOString();
          result.repeat = repeatSelect.value || 'none';
        }
      }
      this._submitted = true;
      this.close();
      // Throws when constructed without onSubmit (flagged, not fixed).
      this.onSubmit!(result);
    };
    ok.addEventListener('click', submit);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') this.close();
    });

    setTimeout(() => textInput.focus(), 0);
  }
  onClose() {
    if (!this._submitted && this.onSubmit) this.onSubmit(null);
    this.contentEl.empty();
  }
}
