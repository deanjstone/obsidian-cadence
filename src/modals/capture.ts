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

/** Raw form values, as read from the modal's inputs. */
export interface CaptureForm {
  text: string;
  /** The "Remind me" checkbox. */
  scheduled: boolean;
  /** The datetime-local input's value (local time, no zone). */
  datetimeValue: string;
  repeat: string;
}

/** The onSubmit payload, or null when the trimmed text is blank. The time
    and repeat are dropped unless scheduled with a parseable time. */
export function buildCaptureResult(form: CaptureForm): CaptureResult | null {
  const text = form.text.trim();
  if (!text) return null;
  const result: CaptureResult = { text, when: null, repeat: 'none' };
  if (form.scheduled && form.datetimeValue) {
    const d = fromLocalDatetimeValue(form.datetimeValue);
    if (d && !isNaN(d.getTime())) {
      result.when = d.toISOString();
      result.repeat = form.repeat || 'none';
    }
  }
  return result;
}

/** The time input's default: now + 1 hour, rounded to the next quarter hour.
    Seconds are dropped after rounding, so 10:00:45 + 1h gives 11:00
    (flagged, not fixed). */
export function defaultCaptureWhen(now: Date): Date {
  const dft = new Date(now.getTime() + 60 * 60 * 1000);
  dft.setMinutes(Math.ceil(dft.getMinutes() / 15) * 15, 0, 0);
  return dft;
}

export type QuickPick = '+15m' | '+1h' | '+3h' | 'Tomorrow 9am';

const QUICK_PICK_DELTA_MS: Record<Exclude<QuickPick, 'Tomorrow 9am'>, number> = {
  '+15m': 15 * 60 * 1000,
  '+1h': 60 * 60 * 1000,
  '+3h': 3 * 60 * 60 * 1000,
};

/** The time a quick-pick button sets: an offset from now with seconds
    dropped, or 9:00 tomorrow. */
export function quickPickTime(kind: QuickPick, now: Date): Date {
  if (kind === 'Tomorrow 9am') {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const d = new Date(now.getTime() + QUICK_PICK_DELTA_MS[kind]);
  d.setSeconds(0, 0);
  return d;
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
      dateInput.value = toLocalDatetimeValue(defaultCaptureWhen(new Date()));
    }

    // Quick-pick buttons
    const quick = schedFields.createDiv();
    quick.style.display = 'flex';
    quick.style.gap = '6px';
    quick.style.marginTop = '8px';
    quick.style.flexWrap = 'wrap';
    const pick = (kind: QuickPick) => {
      dateInput.value = toLocalDatetimeValue(quickPickTime(kind, new Date()));
    };
    const mkQ = (kind: QuickPick) => {
      const b = quick.createEl('button', { cls: 'cad-btn cad-btn-sm', text: kind });
      b.type = 'button';
      return b;
    };
    for (const kind of ['+15m', '+1h', '+3h'] as const) mkQ(kind).addEventListener('click', () => pick(kind));
    const tomorrow = mkQ('Tomorrow 9am');
    // Flagged, not fixed: the legacy button first ran setQuick(() => {}),
    // writing NaN-NaN-… (Date.now() + a function), before its real listener.
    tomorrow.addEventListener('click', () => { dateInput.value = toLocalDatetimeValue(new Date(NaN)); });
    tomorrow.addEventListener('click', () => pick('Tomorrow 9am'));

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
      const result = buildCaptureResult({
        text: textInput.value,
        scheduled: schedCb.checked,
        datetimeValue: dateInput.value,
        repeat: repeatSelect.value,
      });
      if (!result) { textInput.focus(); return; }
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
