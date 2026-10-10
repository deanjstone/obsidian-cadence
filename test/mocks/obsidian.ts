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
  /** Set only when the spec gives an mtime, so code guarding on `file.stat` sees none by default. */
  stat?: { ctime: number; mtime: number; size: number };
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
  /** File modification time (ms); sets `file.stat`. */
  mtime?: number;
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
    if (spec.mtime !== undefined) file.stat = { ctime: spec.mtime, mtime: spec.mtime, size: 0 };
    parent.children.push(file);
    this.files.set(spec.path, file);
    this.contents.set(spec.path, renderFrontmatter(spec.frontmatter) + (spec.body ?? ''));
    if (spec.frontmatter) this.metadata.setFrontmatter(file, structuredClone(spec.frontmatter));
    return file;
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) ?? null;
  }

  /** Obsidian 1.6+ lists folders directly; unset here, so callers fall back. Set it in a test. */
  getAllFolders?: (includeRoot?: boolean) => TFolder[];

  getMarkdownFiles(): TFile[] {
    return [...this.files.values()].filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  getFiles(): TFile[] {
    return [...this.files.values()].filter((f): f is TFile => f instanceof TFile);
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

  /** Records the path; the file stays in the vault. */
  readonly trashed: string[] = [];
  async trash(file: TAbstractFile, _system: boolean): Promise<void> {
    this.trashed.push(file.path);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each event passes its own args, as in obsidian.d.ts
  on(name: string, callback: (...args: any[]) => unknown) {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
    return { name, callback };
  }

  /** Run every handler registered with on(name), in order, and wait for them. */
  async trigger(name: string, ...args: unknown[]): Promise<void> {
    for (const callback of this.listeners.get(name) ?? []) await callback(...args);
  }
}

export class MetadataCache {
  private frontmatter = new Map<string, Frontmatter>();
  /** What getTags() reports: `#tag` → count. Set directly in tests. */
  tags: Record<string, number> = {};
  /** Source path → linked path → count, as Obsidian resolves links. Set directly in tests. */
  resolvedLinks: Record<string, Record<string, number>> = {};
  getTags(): Record<string, number> {
    return this.tags;
  }
  setFrontmatter(file: TFile, fm: Frontmatter) {
    this.frontmatter.set(file.path, fm);
  }
  getFileCache(file: TFile): { frontmatter?: Frontmatter } | null {
    const fm = this.frontmatter.get(file.path);
    return fm ? { frontmatter: fm } : null;
  }
  private listeners = new Map<string, Array<(...args: unknown[]) => unknown>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each event passes its own args, as in obsidian.d.ts
  on(name: string, callback: (...args: any[]) => unknown) {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
    return { name, callback };
  }

  /** Run every handler registered with on(name), in order, and wait for them. */
  async trigger(name: string, ...args: unknown[]): Promise<void> {
    for (const callback of this.listeners.get(name) ?? []) await callback(...args);
  }
}

export class FileManager {
  /** Every processFrontMatter() call's path, in order. */
  readonly processed: string[] = [];
  constructor(private metadata: MetadataCache) {}
  async processFrontMatter(file: TFile, fn: (fm: Frontmatter) => void): Promise<void> {
    this.processed.push(file.path);
    const existing = this.metadata.getFileCache(file)?.frontmatter ?? {};
    this.metadata.setFrontmatter(file, existing);
    fn(existing);
  }
}

export interface EventRef {
  name: string;
  callback: (...args: unknown[]) => unknown;
}

export class WorkspaceLeaf {
  app: App;
  /** The view the leaf shows; null until setViewState() (tests set it directly). */
  view: unknown = null;
  constructor(app: App) {
    this.app = app;
  }
  async setViewState(_state: unknown) {}
}

export class Workspace {
  readonly layoutReadyCallbacks: Array<() => unknown> = [];
  /** What getActiveLeaf() reports. Set directly in tests. */
  activeLeaf: unknown = null;
  /** Every openLinkText(linktext, sourcePath, newLeaf) call, in order. */
  readonly openedLinks: unknown[][] = [];
  onLayoutReady(callback: () => unknown) {
    this.layoutReadyCallbacks.push(callback);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each event passes its own args, as in obsidian.d.ts
  on(name: string, callback: (...args: any[]) => unknown) {
    return { name, callback };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests stand plain { view } objects in for leaves
  getLeavesOfType(_type: string): any[] {
    return [];
  }
  /* The plugin shell's leaf calls. Tests that check them replace them on the instance. */
  getLeaf(_kind?: unknown): WorkspaceLeaf {
    return new WorkspaceLeaf(null as unknown as App);
  }
  revealLeaf(_leaf: WorkspaceLeaf) {}
  detachLeavesOfType(_type: string) {}
  getActiveLeaf(): unknown {
    return this.activeLeaf;
  }
  openLinkText(...args: unknown[]) {
    this.openedLinks.push(args);
  }
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
  /** Obsidian's community-plugin registry (not in the public obsidian.d.ts). */
  plugins = { enabledPlugins: new Set<string>() };
  /** Obsidian's settings window (not in the public obsidian.d.ts). Records calls. */
  setting = {
    calls: [] as string[],
    open() {
      this.calls.push('open');
    },
    openTabById(id: string) {
      this.calls.push(`openTabById:${id}`);
    },
  };
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
  duration?: number;
  constructor(message: string, duration?: number) {
    this.message = message;
    this.duration = duration;
    Notice.messages.push(message);
    Notice.durations.push(duration);
  }
  /** The duration argument of every Notice, parallel to `messages`. */
  static readonly durations: Array<number | undefined> = [];
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
  manifest: { id: string };
  readonly registered = {
    commands: [] as Array<Record<string, unknown>>,
    views: [] as string[],
    ribbonIcons: [] as Array<{ icon: string; title: string }>,
    settingTabs: [] as string[],
    events: [] as string[],
    intervals: 0,
  };
  private data: unknown;
  constructor(app: App, manifest: { id: string }, data: unknown = null) {
    super();
    this.app = app;
    this.manifest = manifest;
    this.data = data;
  }
  addCommand(command: Record<string, unknown>) {
    this.registered.commands.push(command);
    return command;
  }
  registerView(type: string, _factory: (leaf: WorkspaceLeaf) => unknown) {
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
  interface SvgElementInfo {
    cls?: string | string[];
    attr?: { [key: string]: string | number | boolean | null };
    parent?: Node;
    prepend?: boolean;
  }
  interface Node {
    empty(): void;
    appendText(val: string): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
    createDiv(o?: DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
    createSvg<K extends keyof SVGElementTagNameMap>(tag: K, o?: SvgElementInfo | string, callback?: (el: SVGElementTagNameMap[K]) => void): SVGElementTagNameMap[K];
  }
  interface Element extends Node {
    setText(val: string | DocumentFragment): void;
    addClass(...classes: string[]): void;
    removeClass(...classes: string[]): void;
    toggleClass(classes: string | string[], value: boolean): void;
    hasClass(cls: string): boolean;
  }
  interface HTMLElement extends Element {
    createSpan(o?: DomElementInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
  }
}

export interface FakeEvent {
  type: string;
  /** Extra fields passed to trigger() (dataTransfer, relatedTarget, …). */
  [extra: string]: unknown;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export class FakeElement {
  /** Lower-case tag, as passed to createEl. */
  readonly localName: string;
  parent: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly classes: string[] = [];
  readonly attrs: Record<string, string | number | boolean | null> = {};
  readonly style: Record<string, string> = {};
  text = '';
  type = '';
  placeholder = '';
  title = '';
  id = '';
  /** Last icon set on this element through setIcon(). */
  icon = '';
  checked = false;
  draggable = false;
  disabled = false;
  required = false;
  rows = 0;
  /** Fixed at 0: the stub does no layout. */
  scrollHeight = 0;
  /** 0 unless a test sets them: the stub does no layout. */
  clientWidth = 0;
  clientHeight = 0;
  /** <canvas> only: the bitmap size the code assigns. */
  width = 0;
  height = 0;
  /** What getBoundingClientRect() reports. Set directly in tests. */
  rect = { left: 0, top: 0 };
  /** True unless a test sets it, as for an element in the document. */
  isConnected = true;
  private context2d: FakeCanvasContext | null = null;
  readonly dataset: Record<string, string> = {};
  /** The DOM's classList, backed by `classes`. */
  readonly classList = {
    add: (...classes: string[]) => this.addClass(...classes),
    remove: (...classes: string[]) => this.removeClass(...classes),
    contains: (cls: string) => this.hasClass(cls),
  };
  focusCount = 0;
  selectCount = 0;
  blurCount = 0;
  /** Every value assigned through the setter, in order (not createEl's). */
  readonly valueWrites: string[] = [];
  private ownValue = '';
  /* <select> only: undefined = browser default (first option), null = none. */
  private selectedOption: FakeElement | null | undefined = undefined;
  private readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(localName: string) {
    this.localName = localName;
  }

  /* Upper-case, as an HTML document's elements report it. */
  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get options(): FakeElement[] {
    return this.children.filter((c) => c.localName === 'option');
  }

  get lastChild(): FakeElement | null {
    return this.children[this.children.length - 1] ?? null;
  }

  /* <option> only: reads and sets its parent <select>'s selection. */
  get selected(): boolean {
    const select = this.parent;
    if (!select || select.localName !== 'select' || select.selectedOption === null) return false;
    const options = select.options;
    const current = select.selectedOption && options.includes(select.selectedOption) ? select.selectedOption : options[0];
    return current === this;
  }

  set selected(selected: boolean) {
    const select = this.parent;
    if (!select || select.localName !== 'select') return;
    if (selected) select.selectedOption = this;
    else if (select.selectedOption === this) select.selectedOption = undefined;
  }

  get value(): string {
    if (this.localName !== 'select') return this.ownValue;
    const options = this.options;
    if (this.selectedOption === null) return '';
    if (this.selectedOption === undefined || !options.includes(this.selectedOption)) return options[0]?.value ?? '';
    return this.selectedOption.value;
  }

  set value(value: string) {
    this.valueWrites.push(String(value));
    if (this.localName !== 'select') {
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

  /* Like createEl: SvgElementInfo carries only cls and attr. */
  createSvg(tag: string, o?: SvgElementInfo | string, callback?: (el: FakeElement) => void): FakeElement {
    return this.createEl(tag, o, callback);
  }

  /* Stored with createEl's `attr` values, so getAttribute reads either. */
  setAttribute(name: string, value: string) {
    this.attrs[name] = String(value);
  }

  getAttribute(name: string): string | null {
    const value = this.attrs[name];
    return value == null ? null : String(value);
  }

  contains(other: unknown): boolean {
    for (let node = other as FakeElement | null; node; node = node.parent) if (node === this) return true;
    return false;
  }

  /** Descendants matching `tag`, `.cls` or `tag.cls` (one class only). */
  querySelectorAll(selector: string): FakeElement[] {
    const [tag, cls] = selector.split('.');
    const all = this.children.flatMap((c) => [c, ...c.querySelectorAll('*')]);
    return all.filter((e) => (!tag || tag === '*' || e.localName === tag) && (!cls || e.classes.includes(cls)));
  }

  /** The first descendant matching querySelectorAll's selectors, or null. */
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
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

  removeClass(...classes: string[]) {
    for (const c of classes) {
      const index = this.classes.indexOf(c);
      if (index !== -1) this.classes.splice(index, 1);
    }
  }

  toggleClass(classes: string | string[], value: boolean) {
    const list = Array.isArray(classes) ? classes : [classes];
    if (value) this.addClass(...list);
    else this.removeClass(...list);
  }

  hasClass(cls: string): boolean {
    return this.classes.includes(cls);
  }

  createSpan(o?: DomElementInfo | string, callback?: (el: FakeElement) => void): FakeElement {
    return this.createEl('span', o, callback);
  }

  setText(text: string) {
    this.text = String(text);
  }

  /* Obsidian's appendText adds a text node; the stub appends to `text`. */
  appendText(text: string) {
    this.text += String(text);
  }

  focus() {
    this.focusCount++;
  }

  select() {
    this.selectCount++;
  }

  blur() {
    this.blurCount++;
  }

  /* Detach from the parent, as Element.remove() does. */
  remove() {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index !== -1) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  /* Move `node` to just before `ref` (or to the end when ref is null),
     detaching it from wherever it was, as Node.insertBefore does. */
  insertBefore(node: FakeElement, ref: FakeElement | null): FakeElement {
    node.remove();
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index === -1) this.children.push(node);
    else this.children.splice(index, 0, node);
    node.parent = this;
    return node;
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
  trigger(type: string, init: { key?: string; metaKey?: boolean; ctrlKey?: boolean; [extra: string]: unknown } = {}): FakeEvent {
    const event: FakeEvent = {
      type,
      ...init,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  /** Descendants (depth-first, document order) matching `tag`. */
  findAll(tag: string): FakeElement[] {
    return this.children.flatMap((c) => [...(c.localName === tag ? [c] : []), ...c.findAll(tag)]);
  }

  getBoundingClientRect(): { left: number; top: number } {
    return this.rect;
  }

  /* <canvas> only: one recording 2D context per element. */
  getContext(_kind: string): FakeCanvasContext {
    this.context2d ??= new FakeCanvasContext();
    return this.context2d;
  }
}

/* A 2D canvas context that records every call and style write, in order:
   a call as `[method, ...args]`, a write as `['fillStyle=', value]`. */
export class FakeCanvasContext {
  readonly ops: unknown[][] = [];
  private readonly props: Record<string, unknown> = {};

  constructor() {
    for (const prop of ['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign']) {
      Object.defineProperty(this, prop, {
        get: () => this.props[prop],
        set: (value: unknown) => {
          this.props[prop] = value;
          this.ops.push([`${prop}=`, value]);
        },
      });
    }
    for (const method of [
      'scale', 'resetTransform', 'clearRect', 'save', 'restore', 'translate', 'beginPath', 'moveTo', 'lineTo',
      'stroke', 'arc', 'fill', 'fillText',
    ]) {
      (this as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        this.ops.push([method, ...args]);
      };
    }
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
  modalEl: HTMLElement = fakeElement();
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

/* Like Obsidian's View: app comes from the leaf, and containerEl holds the
   header (children[0]) and the content element (children[1]). */
export class ItemView extends Component {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  /** Every registerEvent() ref, in order. Fire one with `ref.callback(...)`. */
  readonly registeredEvents: EventRef[] = [];
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.app = leaf.app;
    const container = new FakeElement('div');
    container.createDiv({ cls: 'view-header' });
    container.createDiv({ cls: 'view-content' });
    this.containerEl = container as unknown as HTMLElement;
  }
  override registerEvent(ref: unknown) {
    this.registeredEvents.push(ref as EventRef);
  }
}

export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: HTMLElement = fakeElement();
  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }
}

/* ─────────── Setting and its components ───────────
   Each Setting appends a `div.setting-item` (holding name, description and
   control elements) to its container, records its components in order, and
   hangs itself on the element as `setting`, so a test can find a row by
   name and drive its controls. A component's handler is fired with
   `await component.change(value)` or `await button.click()`. */

type ChangeHandler<T> = (value: T) => unknown;

export class ToggleComponent {
  readonly kind = 'toggle';
  value = false;
  changeHandler: ChangeHandler<boolean> | null = null;
  setValue(value: boolean) {
    this.value = value;
    return this;
  }
  getValue() {
    return this.value;
  }
  onChange(handler: ChangeHandler<boolean>) {
    this.changeHandler = handler;
    return this;
  }
  /** Set the value as a click would, and await the handler. */
  async change(value: boolean) {
    this.value = value;
    await this.changeHandler?.(value);
  }
}

export class DropdownComponent {
  readonly kind = 'dropdown';
  readonly selectEl = new FakeElement('select');
  changeHandler: ChangeHandler<string> | null = null;
  addOption(value: string, display: string) {
    this.selectEl.createEl('option', { value, text: display });
    return this;
  }
  setValue(value: string) {
    this.selectEl.value = value;
    return this;
  }
  getValue() {
    return this.selectEl.value;
  }
  onChange(handler: ChangeHandler<string>) {
    this.changeHandler = handler;
    return this;
  }
  /** [value, label] of every option, in order. */
  get optionPairs(): Array<[string, string]> {
    return this.selectEl.options.map((o) => [o.value, o.text]);
  }
  async change(value: string) {
    this.selectEl.value = value;
    await this.changeHandler?.(value);
  }
}

export class TextComponent {
  readonly kind = 'text';
  readonly inputEl = new FakeElement('input');
  changeHandler: ChangeHandler<string> | null = null;
  setPlaceholder(placeholder: string) {
    this.inputEl.placeholder = placeholder;
    return this;
  }
  setValue(value: string) {
    this.inputEl.value = value;
    return this;
  }
  getValue() {
    return this.inputEl.value;
  }
  onChange(handler: ChangeHandler<string>) {
    this.changeHandler = handler;
    return this;
  }
  async change(value: string) {
    this.inputEl.value = value;
    await this.changeHandler?.(value);
  }
}

export class ButtonComponent {
  readonly kind = 'button';
  readonly buttonEl = new FakeElement('button');
  clickHandler: (() => unknown) | null = null;
  setButtonText(text: string) {
    this.buttonEl.text = text;
    return this;
  }
  onClick(handler: () => unknown) {
    this.clickHandler = handler;
    return this;
  }
  async click() {
    await this.clickHandler?.();
  }
}

export type SettingComponent = ToggleComponent | DropdownComponent | TextComponent | ButtonComponent;

export class Setting {
  readonly settingEl: FakeElement;
  readonly nameEl: FakeElement;
  readonly descEl: FakeElement;
  readonly controlEl: FakeElement;
  readonly components: SettingComponent[] = [];
  name = '';
  desc = '';
  constructor(containerEl: unknown) {
    this.settingEl = (containerEl as FakeElement).createDiv({ cls: 'setting-item' });
    (this.settingEl as unknown as { setting: Setting }).setting = this;
    const info = this.settingEl.createDiv({ cls: 'setting-item-info' });
    this.nameEl = info.createDiv({ cls: 'setting-item-name' });
    this.descEl = info.createDiv({ cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
  }
  setName(name: string) {
    this.name = name;
    this.nameEl.setText(name);
    return this;
  }
  setDesc(desc: string) {
    this.desc = desc;
    this.descEl.setText(desc);
    return this;
  }
  private add<C extends SettingComponent>(component: C, el: FakeElement, cb: (component: C) => unknown) {
    this.controlEl.children.push(el);
    el.parent = this.controlEl;
    this.components.push(component);
    cb(component);
    return this;
  }
  addToggle(cb: (component: ToggleComponent) => unknown) {
    return this.add(new ToggleComponent(), new FakeElement('div'), cb);
  }
  addDropdown(cb: (component: DropdownComponent) => unknown) {
    const component = new DropdownComponent();
    return this.add(component, component.selectEl, cb);
  }
  addText(cb: (component: TextComponent) => unknown) {
    const component = new TextComponent();
    return this.add(component, component.inputEl, cb);
  }
  addButton(cb: (component: ButtonComponent) => unknown) {
    const component = new ButtonComponent();
    return this.add(component, component.buttonEl, cb);
  }
}

export const Platform = { isMobile: false, isDesktop: true, isMobileApp: false, isDesktopApp: true };

export function setIcon(el: unknown, icon: string) {
  if (el instanceof FakeElement) el.icon = icon;
}

/* Renders nothing; spy on renderMarkdown to fake its output. */
export const MarkdownRenderer = {
  render: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderMarkdown: async (_markdown: string, _el: HTMLElement, _sourcePath: string, _component: unknown) => {},
};
