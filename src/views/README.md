# `src/views/` — the app view seam

`CadenceAppView` (in `src/legacy/cadence.js`) stays one class until the plugin-entry ticket. Each surface moves out of it as exported functions that take the view as their first argument. The class keeps a one-line delegate for each moved method, so every `this.x()` call site still works.

Set by [#10](https://github.com/deanjstone/obsidian-cadence/issues/10). The view tickets on map [#1](https://github.com/deanjstone/obsidian-cadence/issues/1) follow it.

## The pattern

```ts
// src/views/home.ts
import type { AppViewHost } from './host';

export async function renderHome(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-home');
  view._renderPageHeader(root, 'Home', '');   // cross-surface call: through the view
  …                                            // body moved verbatim, `this` → `view`
}
```

```js
// src/legacy/cadence.js, inside class CadenceAppView
renderHome(root) { return renderHome(this, root); }
```

The delegate has no `async` and no default parameters. It returns what the function returns, and the function keeps the original `async` and defaults. `return` passes the promise through, so callers that `await this.renderHome(...)` behave as before.

## Rules

1. **Move the body verbatim.** The only change is `this` → `view`, plus `obsidian.X` → a named import from `'obsidian'`. Add types, but don't change the logic. Fix indentation if the legacy body had it wrong.
2. **Never import another surface's function.** Cross-surface calls go through `view.x()`, which lands on that surface's delegate. Each view ticket then depends only on this seam, not on the other view tickets.
3. **Pure logic takes plain data, not `view`.** Examples are `migrateModeId(id, settings)`, `routeFor(mode, customPages)` and `planEntityLinks(def, defaults, values)`. Pure functions are the unit-test target.
4. **Add an `AppViewHost` member only when your surface reads or calls it.** Add it to `host.ts` in the same PR. Members owned by a later ticket go in the "Called by the shell, owned by later view tickets" block, typed from how the callers use them.
5. **Keep the underscore names on the class and on `AppViewHost`** (`_renderPageHeader`, `_createEntityFromPrompt`, …). Name the exported function without the underscore (`renderPageHeader`). If the plain name would be ambiguous or would shadow a global, pick a specific one: `render` → `renderAppView`, `onOpen` → `onOpenAppView`, `_prompt` → `openPrompt`, and the constructor body → `initAppViewState`.
6. **The plugin-entry ticket makes the class `implements AppViewHost`,** so `tsc` checks the whole contract once. Until then the legacy class is untyped JS. `host.ts` is the only place the contract is written down, so keep it accurate.

Members that are Obsidian's `View` contract and have no logic stay on the class: `getViewType`, `getDisplayText`, `getIcon` and `onClose`.

## Files

| File | Holds |
|---|---|
| `host.ts` | `AppViewHost` (the view state and every member a moved surface uses), `AppViewPlugin` and `PromptOptions` |
| `nav.ts` | `migrateModeId`, `resolveSurface`, `visibleNavGroups`, `modeUsesEntityFolder`, `routeFor` (pure), plus `toggleMobileNav`, `toggleCadenceDark`, `setMode` and `toggleGroup` |
| `app-view.ts` | `initAppViewState`, `onOpenAppView`, `renderAppView`, the entity-detail open/close functions, `renderComingSoon`, `renderPageHeader`, `openSettingsTab`, `openPrompt`, `createEntityFromPrompt` and the pure `planEntityLinks` |

Use one file per major surface (`home.ts`, `today.ts`, `planner.ts`, `inbox.ts`, `entity-list.ts`, …), as in the map's module layout. Named exports only.

## How a view ticket applies the loop

1. **Characterize** through the class, in place. `test/helpers/app-view.ts` gives you:
   - `makeAppView({ settings, files })`, which builds a `CadenceAppView` on the mock App with a plugin stub
   - `stubSurfaces(view)`, which spies on every routed surface
   - `surfaceCalls(spies)` and `flush()`

   Drive the surface through its method (`view.renderHome(root)`) and read the result back from the `FakeElement` DOM stub in `test/mocks/obsidian.ts`. Extend the stub there rather than forking it. Encode quirks as `QUIRK:` tests. Commit the tests before any code moves.
2. **Extract.** Move the bodies into `src/views/<surface>.ts` and delete them from the class, but don't add the delegates yet. Run the tests: that is the red run, and it must fail only on wiring (`view.x is not a function`, spying on an undefined method). Record the counts. Then add the one-line delegates and get back to green.
3. **Type.** Use the Obsidian types and `src/types/`. Where the real `obsidian.d.ts` lacks an API the code uses (`workspace.getActiveLeaf()`, `app.setting`), add a local interface and cast to it. Prefer `unknown` plus `// TODO: confirm shape` to a guessed type.
4. **Refactor guard.** Lift the pure logic into plain-data functions and test them directly. The characterization tests must stay unchanged and green.

### Evidence for the PR

- **Verbatim check.** Pass each legacy method body (with `this` → `view`) and each moved function through esbuild's `transformSync`, which strips the types and normalises the formatting, then compare the function bodies. #10's script is in its PR description.
- **Mutation check.** Make a handful of one-line mutations to the extracted module, and confirm that each one breaks at least one test.
- Run `pnpm typecheck && pnpm test && pnpm build`, and check that `git diff --exit-code -- main.js` is clean after the build. The registration-parity smoke test must be green with its snapshot unedited.
