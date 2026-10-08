import { CadencePlugin } from "./legacy/cadence.js";

declare const module: { exports: unknown };

/* Obsidian loads main.js as CommonJS. The original hand-written file set
   module.exports to the plugin class itself (no `default` wrapper), so the
   bundle does the same. */
module.exports = CadencePlugin;
