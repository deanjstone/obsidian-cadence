import { Modal, Notice, SuggestModal, type App, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { parseCSV } from '../utils/csv';
import { createEntity } from '../utils/entities';
import type { EntityKey } from '../types/entities';
import type { ImportResult } from '../types/modals';
import { autoDetectCsvMapping, csvRowExtras, type CsvMapping } from './csv-import-mapping';

export interface ImportModalOptions {
  /** Pre-selected entity; defaults to 'contact'. */
  entityKey?: EntityKey;
  /** Called after an import runs. Not called on cancel. */
  onSubmit?: (result: ImportResult) => void;
}

/* ─────────── CSV import modal ─────────── */
export class CadenceImportModal extends Modal {
  declare entityKey: EntityKey;
  declare onSubmit: (result: ImportResult) => void;
  declare csvText: string;
  declare headers: string[];
  declare rows: string[][];
  declare mapping: CsvMapping;
  declare previewEl: HTMLElement;
  /** Unset until onOpen() reaches the action row. */
  declare importBtn?: HTMLButtonElement;

  constructor(app: App, opts?: ImportModalOptions) {
    super(app);
    this.entityKey = (opts && opts.entityKey) || 'contact';
    this.onSubmit = (opts && opts.onSubmit) || (() => { });
    this.csvText = '';
    this.headers = [];
    this.rows = [];
    this.mapping = {}; // csv-header → entity-field-key | null
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-import-modal');
    contentEl.createEl('h3', { cls: 'cad-create-title', text: 'Import from CSV' });

    /* Entity selector */
    const entityRow = contentEl.createDiv({ cls: 'cad-create-row' });
    entityRow.createDiv({ cls: 'cad-create-label', text: 'IMPORT AS' });
    const entitySelect = entityRow.createEl('select', { cls: 'cad-create-input' });
    Object.entries(ENTITIES).forEach(([key, def]) => {
      const o = entitySelect.createEl('option', { value: key, text: def.plural });
      if (key === this.entityKey) o.selected = true;
    });
    entitySelect.addEventListener('change', () => {
      this.entityKey = entitySelect.value;
      this._autoDetectMapping();
      this._renderPreview();
    });

    /* CSV input */
    const csvRow = contentEl.createDiv({ cls: 'cad-create-row' });
    csvRow.style.alignItems = 'flex-start';
    csvRow.createDiv({ cls: 'cad-create-label', text: 'CSV DATA' });
    const csvWrap = csvRow.createDiv();
    csvWrap.style.display = 'flex';
    csvWrap.style.flexDirection = 'column';
    csvWrap.style.gap = '8px';

    const tabs = csvWrap.createDiv();
    tabs.style.display = 'flex';
    tabs.style.gap = '6px';
    const pasteBtn = tabs.createEl('button', { cls: 'cad-btn cad-btn-sm', text: 'Paste' });
    pasteBtn.type = 'button';
    const fileBtn = tabs.createEl('button', { cls: 'cad-btn cad-btn-sm', text: 'Pick .csv from vault' });
    fileBtn.type = 'button';

    const ta = csvWrap.createEl('textarea', { cls: 'cad-create-input' });
    ta.rows = 8;
    ta.placeholder = 'Paste CSV here, including a header row…';
    ta.style.fontFamily = 'var(--font-monospace-theme, var(--font-monospace))';
    ta.style.fontSize = '12px';
    ta.style.resize = 'vertical';
    ta.addEventListener('input', () => {
      this.csvText = ta.value;
      this._parse();
      this._renderPreview();
    });

    pasteBtn.addEventListener('click', () => ta.focus());
    fileBtn.addEventListener('click', async () => {
      // Intentional vault-wide enumeration: the user is explicitly picking a
      // .csv file they've placed somewhere in their vault. Limiting this
      // would defeat the feature. All other entity reads are folder-scoped.
      const csvFiles = this.app.vault.getFiles().filter((f) => f.path.toLowerCase().endsWith('.csv'));
      if (!csvFiles.length) {
        new Notice('No .csv files found in vault. Drop one in the vault first.');
        return;
      }
      const picker = new (class extends SuggestModal<TFile> {
        declare files: TFile[];
        declare onPick: (file: TFile) => void;
        constructor(app: App, files: TFile[], onPick: (file: TFile) => void) { super(app); this.files = files; this.onPick = onPick; this.setPlaceholder('Search .csv files…'); }
        getSuggestions(q: string) { return this.files.filter((f) => f.path.toLowerCase().includes(q.toLowerCase())); }
        renderSuggestion(file: TFile, el: HTMLElement) { el.setText(file.path); }
        onChooseSuggestion(file: TFile) { this.onPick(file); }
      })(this.app, csvFiles, async (file: TFile) => {
        try {
          const text = await this.app.vault.read(file);
          ta.value = text;
          this.csvText = text;
          this._parse();
          this._renderPreview();
        } catch (e) {
          new Notice(`Failed to read ${file.path}: ${(e as Error).message}`);
        }
      });
      picker.open();
    });

    /* Preview area */
    this.previewEl = contentEl.createDiv({ cls: 'cad-import-preview' });
    this._renderPreview();

    /* Action row */
    const actions = contentEl.createDiv({ cls: 'cad-create-actions' });
    const cancel = actions.createEl('button', { cls: 'cad-btn', text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    this.importBtn = actions.createEl('button', { cls: 'cad-btn primary', text: 'Import' });
    this.importBtn.type = 'button';
    this.importBtn.disabled = true;
    this.importBtn.addEventListener('click', () => this._submitImport());
  }

  _parse() {
    if (!this.csvText.trim()) { this.headers = []; this.rows = []; return; }
    const all = parseCSV(this.csvText);
    if (!all.length) { this.headers = []; this.rows = []; return; }
    this.headers = all[0].map((h) => String(h).trim());
    this.rows = all.slice(1);
    this._autoDetectMapping();
  }

  _autoDetectMapping() {
    this.mapping = autoDetectCsvMapping(ENTITIES[this.entityKey], this.headers);
  }

  _renderPreview() {
    this.previewEl.empty();
    if (!this.headers.length) {
      this.previewEl.createDiv({ cls: 'cad-empty', text: 'Paste or pick a CSV to preview…' });
      if (this.importBtn) this.importBtn.disabled = true;
      return;
    }

    const def = ENTITIES[this.entityKey];

    /* Mapping table */
    const head = this.previewEl.createDiv({ cls: 'cad-create-label' });
    head.style.marginTop = '14px';
    head.setText('COLUMN MAPPING');

    const tableWrap = this.previewEl.createDiv({ cls: 'cad-import-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'cad-import-table' });
    const thr = table.createEl('thead').createEl('tr');
    thr.createEl('th', { text: 'CSV column' });
    thr.createEl('th', { text: 'Maps to' });
    thr.createEl('th', { text: 'Sample' });
    const tbody = table.createEl('tbody');

    this.headers.forEach((h, i) => {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: h });
      const mc = tr.createEl('td');
      const sel = mc.createEl('select', { cls: 'cad-create-input cad-import-select' });
      sel.createEl('option', { value: '', text: '— skip —' });
      def.fields.forEach((f) => {
        const o = sel.createEl('option', { value: f.key, text: f.label });
        if (this.mapping[h] === f.key) o.selected = true;
      });
      sel.addEventListener('change', () => {
        this.mapping[h] = sel.value || null;
        this._renderPreview(); // re-render to update warning state
      });
      const sample = tr.createEl('td');
      const samples = this.rows.slice(0, 2).map((r) => String(r[i] || '').trim()).filter(Boolean);
      sample.setText(samples.join(' · ').slice(0, 60));
      sample.title = samples.join('\n');
    });

    /* Summary */
    const summary = this.previewEl.createDiv({ cls: 'cad-import-summary' });
    const primaryKey = def.fields[0].key;
    const primaryMapped = Object.values(this.mapping).includes(primaryKey);
    if (!primaryMapped) {
      summary.addClass('cad-import-summary-warn');
      summary.setText(`No CSV column maps to "${def.fields[0].label}" — required to name the file. Pick a column above.`);
      if (this.importBtn) this.importBtn.disabled = true;
    } else {
      const mappedCount = Object.values(this.mapping).filter(Boolean).length;
      summary.setText(`Will create ${this.rows.length} ${this.rows.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} in ${def.folder}/  ·  ${mappedCount} column${mappedCount === 1 ? '' : 's'} mapped`);
      if (this.importBtn) this.importBtn.disabled = false;
    }
  }

  async _submitImport() {
    const def = ENTITIES[this.entityKey];
    const primaryKey = def.fields[0].key;
    const primaryHeader = Object.entries(this.mapping).find(([_, v]) => v === primaryKey);
    if (!primaryHeader) return;
    const primaryColIdx = this.headers.indexOf(primaryHeader[0]);

    this.importBtn!.disabled = true;
    this.importBtn!.setText('Importing…');
    const start = Date.now();
    let created = 0;
    let failed = 0;

    for (const row of this.rows) {
      const primaryValue = String(row[primaryColIdx] || '').trim();
      if (!primaryValue) { failed++; continue; }
      try {
        const file = await createEntity(this.app, this.entityKey, primaryValue);
        const extras = csvRowExtras(def, this.mapping, this.headers, row, primaryKey);
        if (Object.keys(extras).length) {
          await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            Object.entries(extras).forEach(([k, v]) => {
              if (v == null || v === '') return;
              if (Array.isArray(v) && v.length === 0) return;
              fm[k] = v;
            });
          });
        }
        created++;
      } catch (e) {
        failed++;
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    new Notice(`Imported ${created} ${def.plural.toLowerCase()} in ${elapsed}s${failed ? ` · ${failed} skipped` : ''}`, 5000);
    this.close();
    this.onSubmit({ created, failed, entityKey: this.entityKey });
  }

  onClose() { this.contentEl.empty(); }
}
