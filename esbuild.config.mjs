import esbuild from "esbuild";

/* Bundles src/main.ts into the root main.js that manifest.json points at.
   Unminified and without sourcemaps so the committed bundle stays reviewable
   and reproducible (CI rebuilds it and fails on any diff). */
await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  banner: {
    js: "/* Cadence — built from src/ by esbuild (pnpm build). Do not edit main.js directly. */",
  },
  outfile: "main.js",
  logLevel: "info",
  legalComments: "none",
});
