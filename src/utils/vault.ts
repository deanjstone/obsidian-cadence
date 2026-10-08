import type { App, TAbstractFile } from 'obsidian';

/* A vault entry as the folder walkers see it: folders expose `children`,
   files don't. */
export type VaultNode = TAbstractFile & { children?: VaultNode[] };

export async function ensureFolderSync(app: App, path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  let cur = '';
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    if (!app.vault.getAbstractFileByPath(cur)) {
      await app.vault.createFolder(cur).catch(() => { });
    }
  }
}
