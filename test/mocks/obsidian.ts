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

export class Modal {
  app: App;
  contentEl: unknown = {};
  titleEl: unknown = {};
  modalEl: unknown = {};
  constructor(app: App) {
    this.app = app;
  }
  open() {}
  close() {}
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
