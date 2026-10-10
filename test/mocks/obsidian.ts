/* Minimal fakes for the parts of the Obsidian API the plugin touches.
   Enough to load the bundle, run onload(), and exercise vault/metadata logic
   without a real Obsidian instance. Not a faithful reimplementation. */

export type Frontmatter = Record<string, unknown>;

export class TAbstractFile {
  path: string;
  name: string;
  parent: TFolder | null = null;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() ?? path;
  }
}

export class TFile extends TAbstractFile {
  basename: string;
  extension: string;
  constructor(path: string) {
    super(path);
    const dot = this.name.lastIndexOf('.');
    this.basename = dot > 0 ? this.name.slice(0, dot) : this.name;
    this.extension = dot > 0 ? this.name.slice(dot + 1) : '';
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export interface MockFileSpec {
  path: string;
  frontmatter?: Frontmatter;
  body?: string;
}

/* Render frontmatter the way a note on disk would look, so content reads
   (vault.read) and cache reads (metadataCache) agree. */
function renderFrontmatter(fm: Frontmatter | undefined): string {
  if (!fm) return '';
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v ?? ''}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

/* Tiny frontmatter reader for files created through vault.create(). Handles
   `key: value`, `key: [a, b]`, `key: []` and bare `key:` — the shapes the
   plugin's own templates emit. */
export function parseFrontmatter(content: string): Frontmatter | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const fm: Frontmatter = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([^:\s][^:]*):\s?(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim();
    if (value === '') fm[key] = null;
    else if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      fm[key] = inner ? inner.split(',').map((s) => s.trim()) : [];
    } else if (/^-?\d+(\.\d+)?$/.test(value)) fm[key] = Number(value);
    else fm[key] = value;
  }
  return fm;
}

export class Vault {
  private files = new Map<string, TAbstractFile>();
  private contents = new Map<string, string>();
  private listeners = new Map<string, Array<(...args: unknown[]) => unknown>>();
  readonly created: string[] = [];
  readonly modified: string[] = [];
  constructor(private metadata: MetadataCache) {
    const root = new TFolder('/');
    root.name = '';
    this.files.set('/', root);
  }

  private ensureParent(path: string): TFolder {
    const idx = path.lastIndexOf('/');
    if (idx === -1) return this.files.get('/') as TFolder;
    const parentPath = path.slice(0, idx);
    let parent = this.files.get(parentPath);
    if (!parent) {
      const grand = this.ensureParent(parentPath);
      parent = new TFolder(parentPath);
      parent.parent = grand;
      grand.children.push(parent);
      this.files.set(parentPath, parent);
    }
    return parent as TFolder;
  }

  addFile(spec: MockFileSpec): TFile {
    const file = new TFile(spec.path);
    const parent = this.ensureParent(spec.path);
    file.parent = parent;
    parent.children.push(file);
    this.files.set(spec.path, file);
    this.contents.set(spec.path, renderFrontmatter(spec.frontmatter) + (spec.body ?? ''));
    if (spec.frontmatter) this.metadata.setFrontmatter(file, structuredClone(spec.frontmatter));
    return file;
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) ?? null;
  }

  getMarkdownFiles(): TFile[] {
    return [...this.files.values()].filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  async create(path: string, content: string): Promise<TFile> {
    if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
    const file = this.addFile({ path });
    this.contents.set(path, content);
    const fm = parseFrontmatter(content);
    if (fm) this.metadata.setFrontmatter(file, fm);
    this.created.push(path);
    return file;
  }

  async createFolder(path: string): Promise<TFolder> {
    if (this.files.has(path)) throw new Error(`Folder already exists: ${path}`);
    const parent = this.ensureParent(path);
    const folder = new TFolder(path);
    folder.parent = parent;
    parent.children.push(folder);
    this.files.set(path, folder);
    return folder;
  }

  async read(file: TFile): Promise<string> {
    return this.contents.get(file.path) ?? '';
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.contents.set(file.path, content);
    this.modified.push(file.path);
  }

  on(name: string, callback: (...args: unknown[]) => unknown) {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
    return { name, callback };
  }
}

export class MetadataCache {
  private frontmatter = new Map<string, Frontmatter>();
  setFrontmatter(file: TFile, fm: Frontmatter) {
    this.frontmatter.set(file.path, fm);
  }
  getFileCache(file: TFile): { frontmatter?: Frontmatter } | null {
    const fm = this.frontmatter.get(file.path);
    return fm ? { frontmatter: fm } : null;
  }
  on(name: string, callback: (...args: unknown[]) => unknown) {
    return { name, callback };
  }
}

export class FileManager {
  constructor(private metadata: MetadataCache) {}
  async processFrontMatter(file: TFile, fn: (fm: Frontmatter) => void): Promise<void> {
    const existing = this.metadata.getFileCache(file)?.frontmatter ?? {};
    this.metadata.setFrontmatter(file, existing);
    fn(existing);
  }
}

export class Workspace {
  readonly layoutReadyCallbacks: Array<() => unknown> = [];
  onLayoutReady(callback: () => unknown) {
    this.layoutReadyCallbacks.push(callback);
  }
  on(name: string, callback: (...args: unknown[]) => unknown) {
    return { name, callback };
  }
  getLeavesOfType(_type: string): unknown[] {
    return [];
  }
  openLinkText() {}
}

export class MetadataTypeManager {
  readonly types: Record<string, string> = {};
  setType(key: string, type: string) {
    this.types[key] = type;
  }
}

export class App {
  metadataTypeManager = new MetadataTypeManager();
  metadataCache = new MetadataCache();
  vault = new Vault(this.metadataCache);
  fileManager = new FileManager(this.metadataCache);
  workspace = new Workspace();
}

/* Build an App whose vault holds the given files. */
export function createMockApp(files: MockFileSpec[] = []): App {
  const app = new App();
  for (const spec of files) app.vault.addFile(spec);
  return app;
}

export class Notice {
  static readonly messages: string[] = [];
  message: string;
  constructor(message: string) {
    this.message = message;
    Notice.messages.push(message);
  }
  hide() {}
}

export class Component {
  registerEvent(_ref: unknown) {}
  registerInterval(id: number) {
    return id;
  }
  registerDomEvent() {}
}

export class Plugin extends Component {
  app: App;
  manifest: unknown;
  readonly registered = {
    commands: [] as Array<Record<string, unknown>>,
    views: [] as string[],
    ribbonIcons: [] as Array<{ icon: string; title: string }>,
    settingTabs: [] as string[],
    events: [] as string[],
    intervals: 0,
  };
  private data: unknown;
  constructor(app: App, manifest: unknown, data: unknown = null) {
    super();
    this.app = app;
    this.manifest = manifest;
    this.data = data;
  }
  addCommand(command: Record<string, unknown>) {
    this.registered.commands.push(command);
    return command;
  }
  registerView(type: string, _factory: unknown) {
    this.registered.views.push(type);
  }
  addRibbonIcon(icon: string, title: string, _callback: unknown) {
    this.registered.ribbonIcons.push({ icon, title });
    return {};
  }
  addSettingTab(tab: object) {
    this.registered.settingTabs.push(tab.constructor.name);
  }
  override registerEvent(ref: unknown) {
    const name = (ref as { name?: string } | null)?.name;
    this.registered.events.push(String(name));
  }
  override registerInterval(id: number) {
    this.registered.intervals++;
    return id;
  }
  async loadData() {
    return this.data;
  }
  async saveData(data: unknown) {
    this.data = data;
  }
}

/* ─────────── Minimal DOM stub ───────────
   Just enough of Obsidian's element helpers (createEl, createDiv, empty,
   addClass, setText) and of the DOM (value, options, style, listeners) to
   drive a modal's onOpen() and read back what it built. Like Obsidian's
   createEl, it ignores DomElementInfo keys it does not know. */

/* The Obsidian augmentations src/ relies on. Under test/tsconfig.json the
   real obsidian.d.ts is not loaded, so src/ is typechecked against these. */
declare global {
  interface DomElementInfo {
    cls?: string | string[];
    text?: string | DocumentFragment;
    attr?: { [key: string]: string | number | boolean | null };
    title?: string;
    parent?: Node;
    value?: string;
    type?: string;
    prepend?: boolean;
    placeholder?: string;
    href?: string;
  }
  interface Node {
    empty(): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
    createDiv(o?: DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
  }
  interface Element extends Node {
    setText(val: string | DocumentFragment): void;
    addClass(...classes: string[]): void;
  }
}

export interface FakeEvent {
  type: string;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

export class FakeElement {
  readonly tagName: string;
  parent: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly classes: string[] = [];
  readonly attrs: Record<string, string | number | boolean | null> = {};
  readonly style: Record<string, string> = {};
  text = '';
  type = '';
  placeholder = '';
  title = '';
  checked = false;
  rows = 0;
  focusCount = 0;
  selectCount = 0;
  /** Every value assigned through the setter, in order (not createEl's). */
  readonly valueWrites: string[] = [];
  private ownValue = '';
  /* <select> only: undefined = browser default (first option), null = none. */
  private selectedOption: FakeElement | null | undefined = undefined;
  private readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get options(): FakeElement[] {
    return this.children.filter((c) => c.tagName === 'option');
  }

  get lastChild(): FakeElement | null {
    return this.children[this.children.length - 1] ?? null;
  }

  /* <option> only: reads and sets its parent <select>'s selection. */
  get selected(): boolean {
    const select = this.parent;
    if (!select || select.tagName !== 'select' || select.selectedOption === null) return false;
    const options = select.options;
    const current = select.selectedOption && options.includes(select.selectedOption) ? select.selectedOption : options[0];
    return current === this;
  }

  set selected(selected: boolean) {
    const select = this.parent;
    if (!select || select.tagName !== 'select') return;
    if (selected) select.selectedOption = this;
    else if (select.selectedOption === this) select.selectedOption = undefined;
  }

  get value(): string {
    if (this.tagName !== 'select') return this.ownValue;
    const options = this.options;
    if (this.selectedOption === null) return '';
    if (this.selectedOption === undefined || !options.includes(this.selectedOption)) return options[0]?.value ?? '';
    return this.selectedOption.value;
  }

  set value(value: string) {
    this.valueWrites.push(String(value));
    if (this.tagName !== 'select') {
      this.ownValue = String(value);
      return;
    }
    this.selectedOption = this.options.find((o) => o.value === String(value)) ?? null;
  }

  createEl(tag: string, o?: DomElementInfo | string, callback?: (el: FakeElement) => void): FakeElement {
    const el = new FakeElement(tag);
    const info: DomElementInfo = typeof o === 'string' ? { cls: o } : o ?? {};
    if (info.cls) el.addClass(...(Array.isArray(info.cls) ? info.cls : info.cls.split(' ')));
    if (info.text !== undefined) el.text = String(info.text);
    if (info.attr) Object.assign(el.attrs, info.attr);
    if (info.title !== undefined) el.title = info.title;
    if (info.value !== undefined) el.ownValue = info.value;
    if (info.type !== undefined) el.type = info.type;
    if (info.placeholder !== undefined) el.placeholder = info.placeholder;
    el.parent = this;
    if (info.prepend) this.children.unshift(el);
    else this.children.push(el);
    callback?.(el);
    return el;
  }

  createDiv(o?: DomElementInfo | string, callback?: (el: FakeElement) => void): FakeElement {
    return this.createEl('div', o, callback);
  }

  empty() {
    for (const child of this.children) child.parent = null;
    this.children.length = 0;
    this.text = '';
    this.selectedOption = undefined;
  }

  addClass(...classes: string[]) {
    for (const c of classes) if (c && !this.classes.includes(c)) this.classes.push(c);
  }

  setText(text: string) {
    this.text = String(text);
  }

  focus() {
    this.focusCount++;
  }

  select() {
    this.selectCount++;
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  /* Real DOM Event objects (e.g. `new Event('change')`) are routed by type. */
  dispatchEvent(event: { type: string }): boolean {
    this.trigger(event.type);
    return true;
  }

  /** Fire `type` at this element's listeners; returns the event. */
  trigger(type: string, init: { key?: string; metaKey?: boolean; ctrlKey?: boolean } = {}): FakeEvent {
    const event: FakeEvent = {
      type,
      ...init,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  /** Descendants (depth-first, document order) matching `tag`. */
  findAll(tag: string): FakeElement[] {
    return this.children.flatMap((c) => [...(c.tagName === tag ? [c] : []), ...c.findAll(tag)]);
  }
}

/* Cast for places typed as HTMLElement (Modal.contentEl). */
export function fakeElement(tag = 'div'): HTMLElement {
  return new FakeElement(tag) as unknown as HTMLElement;
}

export class Modal {
  app: App;
  contentEl: HTMLElement = fakeElement();
  titleEl: unknown = {};
  modalEl: unknown = {};
  constructor(app: App) {
    this.app = app;
  }
  /* Obsidian calls onOpen() from open() and onClose() from close(). */
  open() {
    void this.onOpen();
  }
  close() {
    this.onClose();
  }
  onOpen(): Promise<void> | void {}
  onClose() {}
}

export class SuggestModal<T> extends Modal {
  setPlaceholder(_text: string) {}
  getSuggestions(_query: string): T[] {
    return [];
  }
}

export class ItemView extends Component {
  leaf: unknown;
  containerEl: unknown = {};
  constructor(leaf: unknown) {
    super();
    this.leaf = leaf;
  }
}

export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: unknown = {};
  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }
}

export class Setting {
  constructor(_containerEl: unknown) {}
}

export const Platform = { isMobile: false, isDesktop: true, isMobileApp: false, isDesktopApp: true };

export function setIcon(_el: unknown, _icon: string) {}

export const MarkdownRenderer = {
  render: async () => {},
};
