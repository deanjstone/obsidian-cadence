# `src/views/` — the app view seam

`CadenceAppView` is one class, at the end of `src/views/app-view.ts`. Each surface is a set of exported functions that take the view as their first argument. The class keeps a one-line delegate for each, so every `this.x()` and `view.x()` call site lands on the same function.

Set by [#10](https://github.com/deanjstone/obsidian-cadence/issues/10). The view tickets on map [#1](https://github.com/deanjstone/obsidian-cadence/issues/1) followed it, and [#23](https://github.com/deanjstone/obsidian-cadence/issues/23) moved the classes out of the old hand-written file, which is now gone. "The end state" below records where everything landed.

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

```ts
// src/views/app-view.ts, inside class CadenceAppView
renderHome(root: HTMLElement) { return renderHome(this, root); }
```

The delegate has no `async` and no default parameters. It returns what the function returns, and the function keeps the original `async` and defaults. `return` passes the promise through, so callers that `await this.renderHome(...)` behave as before.

## Rules

1. **Move the body verbatim.** The only change is `this` → `view`, plus `obsidian.X` → a named import from `'obsidian'`. Add types, but don't change the logic. Fix indentation if the original body had it wrong.
2. **Never import another surface's function.** Cross-surface calls go through `view.x()`, which lands on that surface's delegate. Each view ticket then depends only on this seam, not on the other view tickets.
3. **Pure logic takes plain data, not `view`.** Examples are `migrateModeId(id, settings)`, `routeFor(mode, customPages)` and `planEntityLinks(def, defaults, values)`. Pure functions are the unit-test target.
4. **Add an `AppViewHost` member only when your surface reads or calls it.** Add it to `host.ts` in the same PR. Until #20, members owned by a later ticket went in a "Called by the shell, owned by later view tickets" block, typed from how the callers used them. Every routed surface has now moved, so that block is gone.
5. **Keep the underscore names on the class and on `AppViewHost`** (`_renderPageHeader`, `_createEntityFromPrompt`, …). Name the exported function without the underscore (`renderPageHeader`). If the plain name would be ambiguous or would shadow a global, pick a specific one: `render` → `renderAppView`, `onOpen` → `onOpenAppView`, `_prompt` → `openPrompt`, and the constructor body → `initAppViewState`.
6. **The class `implements AppViewHost`** ([#23](https://github.com/deanjstone/obsidian-cadence/issues/23)), so `tsc` checks the whole contract against the delegates. `host.ts` is the only place the contract is written down, so keep it accurate.

Members that are Obsidian's `View` contract and have no logic stay on the class: `getViewType`, `getDisplayText`, `getIcon` and `onClose`.

## Files

| File | Holds |
|---|---|
| `host.ts` | `AppViewHost` (the view state and every member a moved surface uses), `AppViewPlugin` and `PromptOptions` |
| `nav.ts` | `migrateModeId`, `resolveSurface`, `visibleNavGroups`, `modeUsesEntityFolder`, `routeFor` (pure), plus `toggleMobileNav`, `toggleCadenceDark`, `setMode` and `toggleGroup` |
| `app-view.ts` | the `CadenceAppView` class, plus `initAppViewState`, `onOpenAppView`, `renderAppView`, the entity-detail open/close functions, `renderComingSoon`, `renderPageHeader`, `openSettingsTab`, `openPrompt`, `createEntityFromPrompt` and the pure `planEntityLinks` |
| `components/charts.ts` | `drawChart`, `drawChartEmpty`, `drawDonutChart`, `drawBarChart`, `drawKpiGrid`, `drawSimpleList`, plus the pure `chartData`, `sectionChartData`, `donutGeometry`, `barRows`, `kpiCards` and the dashboard widget helpers `dashboardWidgets`, `removeWidget` and `WIDGET_STYLE_OPTIONS` |
| `components/cards.ts` | `dashCardSection`, plus the `DashCardRow`, `StatCard` and `MiniStat` types |
| `components/entity-table.ts` | `renderEntityLinks`, `renderOwnerLinks`, `renderEntityTable` and `getEntityFiles` |
| `components/sections.ts` | `renderMarkdownTextCard`, `renderProjectTextSection`, `renderGenericTextSection`, `renderSingleCrossSection`, `renderCrossSections`, `renderDynamicH2Section`, plus the pure `linksTo`, `crossSectionRows` and `dynamicH2Kind` |
| `home.ts` | `renderHome`, `homeCard`, `renderBriefing`, `loadBriefing` and the eight `home*Card` functions, plus the pure `computeBriefing`, `briefingHeadline`, `visibleBriefing` and one selector per card (`selectInboxCard`, `inboxRowMeta`, `taskNotesToday`, `selectTodayCard`, `toggleTaskLine`, `countTaskLines`, `countWeekTaskNotes`, `weekProgress`, `selectUpcomingItems`, `selectPartnerRows`, `isHomeActiveProject`, `selectPipelineCard`, `selectRecentActivities`) |
| `inbox.ts` | `renderInbox`, `renderProjectTasksSection`, `renderInboxRow`, `inboxOverdueCount`, plus the pure `inboxRows`, `overdueCount`, `openProjectTasks`, `projectTasksHeading`, `repeatLabel`, `notesPreview`, `tomorrowAtNine` and `inboxRowActions` |
| `today.ts` | `renderTodayPane`, `toggleTodayTask`, `appendTodayTask`, `saveTodayJournal`, `quickAddTodayTask`, plus the pure `todaySummary`, `taskNotesProjectPath`, `customSectionKeys` and `journalRows` |
| `calendar.ts` | `renderPlannerPane`, `togglePlannerTask` and the `PlannerDay` type, plus the pure `plannerWeekTitle` and `plannerWeek` |
| `task-links.ts` | `getTaskProjectLink`, `setTaskProjectLink`, `openTaskProjectPicker`, `propagateTaskComplete`, `tickProjectTaskByText`, `tickDailyNoteTaskByText`, plus the pure `taskLinkKey` and `propagationTargets` |
| `entity-list.ts` | `renderEntityList` (Pipeline, Contacts, Companies, Activities, Projects, the PRM lists, Sequences, Team and custom pages), plus the pure `listLayout`, `listSubtitle`, `filterableKeys`, `filterOptions`, `listColumns`, `filterEntities`, `sortEntities`, `nextSort`, `primaryField`, `tableCell`, `cardStatusField`, `pillText`, `pillClass`, `cardMetaRows` and `cardLinkEntityKey` |
| `kanban.ts` | `getEntityKanbanParams` and `renderEntityKanban` (no call site; kept and flagged), plus the pure `unwrapLink`, `kanbanGroupBy`, `kanbanOptions`, `distinctGroups`, `kanbanGroupByFields`, `inKanbanGroup`, `kanbanGroups`, `kanbanValueField`, `kanbanColumnMeta`, `kanbanDropValue` and `kanbanCardLinks` |
| `entity-detail.ts` | `renderEntityDetail` (the generic detail form; hands projects and companies to their own views), plus the pure `entityDetailTitle`, `detailFields` and `detailControl` |
| `company-detail.ts` | `renderCompanyDetail`, plus the pure `companyDetailTitle` and `companyMetaFields`. It re-exports `companyMetaControl` (`metaControl`), `metaInputType`, `metaInputValue` and `splitSectionColumns` from `src/utils/field-edit.ts` |
| `project-detail.ts` | `renderProjectDetail`, `renderMilestoneSection`, `renderTaskSection`, and the write paths `saveMilestones`, `saveTasks` and `saveProjectFrontmatter`, plus the pure `projectDetailTitle`, `projectPills`, `projectMetaFields`, `writeProjectFrontmatter`, `projectProgress`, `projectTextSection`, `milestoneCardTitle`, `milestoneDateValue`, `milestoneDateFromInput`, `commitMilestones`, `updateItem`, `removeItem`, `addMilestone`, `taskCardTitle`, `taskNotesItems`, `commitTasks`, `addTask`, `taskBell`, `newTaskReminder`, `taskNotePath` and `taskNoteContent` |
| `projects-dashboard.ts` | `renderProjectsDashboard` and `renderProjectsView` (no call site; kept and flagged), plus the pure `projectsSummary`, `dashboardOptions`, `statusAccent`, `priorityAccent`, `projectRowName`, `dashRowPill`, `acceptsDrop`, `projectsViewGroups` and `projectCardPills` |
| `crm-dashboard.ts` | `renderCrmDashboard` (the class's `renderDashboard`), plus the pure `dealValue`, `crmSummary`, `crmStatCards`, `pipelineByStage`, `hotDeals`, `staleDeals`, `recentActivities` and `customerBase` |
| `templates.ts` | `renderTemplatesDashboard`, `renderTemplateDetail`, `renderTemplateSectionWithDelete`, and the propagation `getFilesUsingTemplateSection`, `propagateTemplateSectionAdd` and `propagateTemplateSectionDelete`, plus the pure `templatePathCandidates`, `templateEntityKey`, `templateBadge`, `templateDetailDef`, `crossSectionBlock`, `chartSectionBlock`, `deleteSectionMessage`, `templateHeader`, `appendTemplateSection`, `propagateSectionAdd`, `propagateSectionDelete`, `removeTemplateSection`, `moveTemplateSection`, `sectionInUse` and `filesUsingTemplateSection` |
| `reports.ts` | `renderReportPipeline`, `renderReportSales`, `renderReportPartners`, `renderReportActivity` and `renderProductivity`, plus the pure `pipelineReport`, `salesReport`, `partnersReport`, `activityReport`, `productivityReport`, `productivityDates` and `reportBar` |
| `report-graph.ts` | `renderReportGraph`, plus the pure `graphNodeType`, `graphNodeRadius`, `graphNodeColor`, `GRAPH_TYPE_COLORS`, `buildEntityGraph`, `layoutGraph`, `toGraphPoint`, `nodeAt`, `zoomAt` and `graphTooltip` |
| `prm.ts` | `renderPRMAnalytics` and `renderTeam`, plus the pure `prmAnalytics`, `isTeamMember` and `teamListOptions` |
| `../settings/host.ts` | `SettingTabHost` and `SettingTabPlugin`, the setting tab's seam |
| `../settings/setting-tab.ts` | `CadenceSettingTab`, `renderModulesSettings`, `renderReminderSettings`, `renderAppSettings` and `renderCloudSyncSettings`, plus the pure `MODULE_TOGGLES`, `ensureModules`, `shouldRequestPermission`, `notificationPermissionDesc`, `completedReminderCount`, `openReminders`, `TASK_SYSTEM_OPTIONS`, `taskNotesStatus`, `CURRENCY_OPTIONS`, `weekStartsOnFromOption`, `defaultTabOptions` and `defaultTabValue` |
| `../settings/custom-pages.ts` | `renderCustomPagesSettings`, plus the pure `SECTION_OPTIONS`, `LAYOUT_OPTIONS`, `ICON_OPTIONS`, `sectionLabel`, `customPageLayoutLabel`, `customPageRows`, `customPageEntityKey`, `customEntityLabel`, `addCustomPage` and `deleteCustomPage` |
| `../settings/entity-properties.ts` | `renderEntityPropertiesSettings` and `FolderSuggestModal`, plus the pure `entityPickerLabel`, `entityPickerOptions`, `isPermanentlyLocked`, `isFieldLocked`, `snapshotCustomEntities`, `fieldKeySuggestions`, `filterKeySuggestions`, `sanitizeFieldKey`, `parseEnumOptions`, `fieldTypeOptions`, `optionsCellKind`, `sourceOptions`, `sourceState`, `folderSource`, `folderBadge`, `vaultFolderPaths`, `filterFolders`, `nextPropertyKey`, `moveField` and `applyPropertyEdit` |
| `../plugin/host.ts` | `PluginHost`, the plugin's seam, plus `MetadataTypeManager` and `AppWithMetadataTypes` |
| `../plugin/reminders-engine.ts` | `addReminder`, `updateReminder`, `deleteReminder`, `snoozeReminder`, `completeReminder`, `tickReminders` and `fireReminder`, plus the pure `newReminder`, `isDue`, `dueReminders`, `advanceReminder`, `continueSeries`, `snoozePatch` and `COMPLETE_PATCH` |
| `../plugin/settings.ts` | `loadSettings`, `saveSettings` and `registerCustomPropertyTypes`, plus the pure `CORE_ENTITY_KEYS`, `PROPERTY_TYPE_ENTITIES`, `fillSettingDefaults`, `customEntityNames`, `reconstructEntities` and `propertyTypeFor` |
| `../plugin/contact-project-sync.ts` | `syncContactProjectRelationships` and `handleProjectDeletion`, plus the pure `extractEntitiesFromValue`, `isContactField`, `isProjectField`, `noteLinks`, `collectValidLinks`, `autoCreateName`, `projectLinkValue`, `writeProjectLinks`, `addProjectLink`, `removeProjectLink` and `contactProjectsPlan` |
| `../constants/settings.ts` | `DEFAULT_SETTINGS` and `CURRENCY_OPTIONS` (`setting-tab.ts` re-exports it) |
| `../main.ts` | the `CadencePlugin` class (`onload`, `onunload`, `openApp`, `openQuickCapture`, `refreshOpenViews` and the delegates) and the `QuickCapturePrefill` type. esbuild bundles it into the root `main.js` |

Use one file per major surface (`home.ts`, `today.ts`, `planner.ts`, `inbox.ts`, `entity-list.ts`, …), as in the map's module layout. Named exports only.

Pure helpers that several surfaces share live in `src/utils/`, not in a surface file. `src/utils/task-lines.ts` ([#13](https://github.com/deanjstone/obsidian-cadence/issues/13)) is the one implementation of checklist lines and the daily-note and project task rewrites (`toggleDailyTask`, `appendDailyTask`, `replaceJournal`, `tickProjectTasks`, `tickDailyTasks`), used by Home, Today, the Calendar and task propagation. When a helper moves out of a surface into `src/utils/`, the surface re-exports it, so existing imports and tests keep working. `home.ts` does this for `toggleTaskLine`, `countTaskLines` and `taskNotesToday`.

**A report is one pure function over plain data** ([#19](https://github.com/deanjstone/obsidian-cadence/issues/19)). Each surface in `reports.ts` reads the vault, calls its `xReport(...)` with the clock passed in (`Date.now()` or `new Date()`), and draws the result: stat cards, `ReportBar` columns (`reportBar(value, max)` sets the height and band), mini stats and `DashCardRow` lists. Productivity reads each daily note in `productivityDates(now, weekStartsOn)` once, and `productivityReport` takes their contents by `ymd` date. The deal totals the CRM dashboard and the reports share (`dealValue`, `sumValues`, `crmSummary`) live in `src/utils/deals.ts`, and `crm-dashboard.ts` re-exports them.

Both detail views edit fields the same way, so their shared pure logic is in `src/utils/field-edit.ts` ([#15](https://github.com/deanjstone/obsidian-cadence/issues/15)): the save-time coercion (`coerceFieldEdit`), the frontmatter write (`applyFieldEdit`, used as the `processFrontMatter` callback), and the chip input's source, values, suggestions, link targets and note creation (`chipConfig`, `chipValues`, `chipWriteValue`, `chipAdd`, `historyValues`, `folderNoteNames`, `filterSuggestions`, `findNoteByName`, `chipLinkTarget`, `chipCreation`). `chipLinkTarget` returns its target as data, and each view maps it to `view.openEntityDetail`, `view.openEntityDetailFromFile` or `openLinkText`. The DOM bodies stay one function each, and the chip DOM is still duplicated between them.

The project page ([#16](https://github.com/deanjstone/obsidian-cadence/issues/16)) reuses the same chip seams, plus the meta-cell and column helpers (`metaControl`, `metaInputType`, `metaInputValue`, `splitSectionColumns`), which moved from `company-detail.ts` into `field-edit.ts`, so its chip DOM is a third copy. Its writes keep their own frontmatter rule (`writeProjectFrontmatter` keeps an empty list), so they go through `view._writeProjectFrontmatter`, not `applyFieldEdit`.

**A checklist section shares its list with the caller.** `renderMilestoneSection` and `renderTaskSection` edit through pure list operations (`updateItem`, `removeItem`, `addMilestone`, `addTask`) that return new lists. Each handler then replaces the shared list's contents (`replaceItems`), so every row and the + Add button keep seeing one list, as the in-place edits did. The commit seams (`commitMilestones`, `commitTasks`) are `(content, items, rawKey) → content`. Where a moved method's name is taken by its pure seam, the moved function is `saveX` (`_commitMilestones` → `saveMilestones`).

**Template propagation is a per-note transform** ([#18](https://github.com/deanjstone/obsidian-cadence/issues/18)). Adding or deleting a template section runs `propagateSectionAdd(content, section)` or `propagateSectionDelete(content, sectionKey)` over each of the entity's notes, and writes only where the transform returns content (`null` = no change). A note's section is the template's when the name and the tag both match ([#43](https://github.com/deanjstone/obsidian-cadence/issues/43)); a daily-template delete changes the template only. The in-use check before a delete is `filesUsingTemplateSection(notes, sectionKey)` over `{ file, content }` pairs, so a test can run either over a fake vault without a view. The default template bodies are `defaultTemplateContent` and `DAILY_TEMPLATE_CONTENT` in `src/utils/templates.ts`, shared with `ensureDefaultTemplates`, and every appended section goes through `appendSection` in `src/utils/parsing.ts`, which `replaceSection` also uses.

**The relationship graph is a seam over plain data, and its canvas is manual QA** ([#20](https://github.com/deanjstone/obsidian-cadence/issues/20)). `buildEntityGraph(files, resolvedLinks, random)` gives the nodes (typed by folder) and the edges (from `metadataCache.resolvedLinks`), and the start positions are its only randomness, so a test passes `random`. `layoutGraph(graph, size, pinned)` is one deterministic physics step that moves the nodes in place, because the pointer handlers hold the same node objects. Hit testing and zoom are `nodeAt`, `toGraphPoint` and `zoomAt`. The surface keeps the canvas, the `ResizeObserver`, the `requestAnimationFrame` loop and the drawing; the tests drive them through the recording `FakeCanvasContext` in `test/mocks/obsidian.ts`. PRM analytics is one `prmAnalytics(partners, deals)` over `crmSummary` and `sumValues`, and shares `MiniStat` with the reports through `components/cards.ts`.

The list's kanban layout is drawn inside `renderEntityList`, so `entity-list.ts` imports the **pure** kanban helpers from `kanban.ts` (`kanbanGroups`, `kanbanDropValue`, …). It still reaches `getEntityKanbanParams` through `view.x()`, because that takes the view. ([#14](https://github.com/deanjstone/obsidian-cadence/issues/14))

Components that several surfaces share live in `components/` ([#11](https://github.com/deanjstone/obsidian-cadence/issues/11)). Surfaces still reach their DOM functions only through `view._x()`, never by import. A component's **pure** helpers take no `view`, so another component or a surface may import them: `sections.ts` uses `sectionChartData`, and both dashboards ([#17](https://github.com/deanjstone/obsidian-cadence/issues/17)) count their widgets with `chartData` and read and remove them with `dashboardWidgets` and `removeWidget`. The drawing still goes through `view._drawChart`.

## The setting tab

`CadenceSettingTab` ([#21](https://github.com/deanjstone/obsidian-cadence/issues/21)) follows the same seam with three differences, all because it is a `PluginSettingTab` with one caller rather than the app view:

1. **The whole class moved, not just its bodies.** The tab has no cross-surface callers, so there are no delegates to keep. `src/settings/setting-tab.ts` holds the class, `src/main.ts` imports it for `addSettingTab`, and the class name stays `CadenceSettingTab`, which the registration-parity snapshot records. `plugin` is a `declare` field, so esbuild emits no class field for it.
2. **The host is `SettingTabHost`** (`src/settings/host.ts`): `app`, `plugin` (a `SettingTabPlugin` with `settings`, `saveSettings`, `refreshOpenViews` and `registerCustomPropertyTypes`), `containerEl` and `display()`. `display()` draws the `h2`, then calls one `renderXSettings(tab, containerEl)` per section, in order: Modules, Reminders, App, Cloud sync (in `setting-tab.ts`), Custom Navigation Pages (`custom-pages.ts`) and Custom Entity Properties (`entity-properties.ts`). A section redraws the page with `tab.display()`. `setting-tab.ts` imports the two section renderers directly, because they are parts of one surface, not other surfaces.
3. **Edits change the live registry, not a copy.** The property editor edits `ENTITIES` in place, and each save copies every schema into `settings.customEntities` (`snapshotCustomEntities`). So its seam, `applyPropertyEdit(entities, entityKey, edit)`, mutates the registry it is given and returns `{ ok, migrations, notice, rerender }`. The migrations are data (`{ kind: 'key' | 'type', … }`), which the surface runs in order through `migrateFrontmatterKey` and `migrateFrontmatterType` in `src/utils/entities.ts`. A test passes a plain registry. `addCustomPage(settings, entities, form, now)` and `deleteCustomPage(settings, entities, pageId)` change the settings and the registry the same way. (#15 already took the name `applyFieldEdit`, for the detail views' frontmatter write.)

The section DOM stays in one function per section, as in #14. The per-row DOM of the property table stays in `renderEntityPropertiesSettings`. The inline folder picker is now the named `FolderSuggestModal(app, folders, onChoose)`.

The tests drive the tab through `test/helpers/setting-tab.ts` (`makeSettingTab`, `settingRows`, `settingByName`, `snapshotEntities`/`restoreEntities`) and the mock's `Setting`, whose toggle, dropdown, text and button components fire their handlers with `await component.change(value)` or `await button.click()`. `ENTITIES` is shared module state, so restore it after each test.

## The plugin

`CadencePlugin`'s logic ([#22](https://github.com/deanjstone/obsidian-cadence/issues/22)) follows the view seam, adapted the way the setting tab was, for a class that is neither a view nor a one-caller tab:

1. **The class keeps one-line delegates.** Unlike the setting tab, the plugin has many callers (`onload`, the app view, the setting tab, the modals), all of which call `plugin.x()`. So the methods moved out and the class keeps `addReminder(partial: ReminderInput) { return addReminder(this, partial); }` for each. `_fireReminder` becomes `fireReminder` (rule 5). `onload`, `onunload`, `openApp`, `openQuickCapture` and `refreshOpenViews` stay on the class, in `src/main.ts` since [#23](https://github.com/deanjstone/obsidian-cadence/issues/23).
2. **The host is `PluginHost`** (`src/plugin/host.ts`): `app`, `settings` (a `PluginSettings`), `_syncInProgress`, `loadData`, `saveData`, `saveSettings`, `refreshOpenViews`, `updateReminder` and `_fireReminder`. Calls between moved functions go through it (`snoozeReminder` calls `plugin.updateReminder`, `tickReminders` calls `plugin._fireReminder`), so a spy on the class still sees them, as rule 2 has views do.
3. **The plain data:**
   - **Reminders** take the clock: `dueReminders(reminders, now)` and `advanceReminder(reminder, now)` (the first occurrence after `now`, built on `nextRepeat`, keeping notes and project), `continueSeries(reminder, now)`, `newReminder(partial, now)` and `snoozePatch(ms, now)`. A repeating occurrence hands its series on once ([#44](https://github.com/deanjstone/obsidian-cadence/issues/44)), the first time it fires, is completed or is snoozed, and is then marked `advanced`. The ticker fires and marks each due reminder, then appends the next occurrences.
   - **Settings load** is a shallow merge over `DEFAULT_SETTINGS` (`src/constants/settings.ts`), then `fillSettingDefaults(settings, defaults)` and `reconstructEntities(settings, entities)`. Like `applyPropertyEdit`, `reconstructEntities` edits the registry it is given (`ENTITIES` in production), so a test passes a plain one.
   - **The sync** reads each note as a `SyncNote` (`{ entityKey, basename, frontmatter }`). `noteLinks` and `collectValidLinks` give the contact–project pairs a note backs, and `contactProjectsPlan`, `addProjectLink`, `removeProjectLink` and `writeProjectLinks` give the `project` value to write. The surface keeps the vault reads, `createEntity`, `processFrontMatter` and the notices. The one `extractEntitiesFromValue` replaces the two inline copies.

The tests build the plugin with `test/helpers/plugin.ts` (`makePlugin`, `makeLoadedPlugin`, `fakeNotification`). The sync tests run `onload`, then fire its handlers with the mock's `app.metadataCache.trigger('changed', file)` and `app.vault.trigger('delete', file)`, and read the frontmatter back (`fileManager.processed` logs each write). `ENTITIES` is shared module state, so restore it after each test with `snapshotEntities`/`restoreEntities`.

## The end state

[#23](https://github.com/deanjstone/obsidian-cadence/issues/23) moved the last two classes out of the hand-written file and deleted it:

- **`CadencePlugin` is in `src/main.ts`**, a named export, and the file still ends with `module.exports = CadencePlugin`. Obsidian reads `module.exports` as the plugin class, as it did from the original `main.js`, so the bundle keeps that shape. The registration-parity smoke test checks it (`exportIsClass`). The named export adds esbuild's `__toCommonJS` header, which that last line then replaces. The tests import the class from `src/main`.
- **`CadenceAppView` is at the end of `src/views/app-view.ts`.** It is the one module that imports every surface. Rule 2 still holds for the surfaces themselves.
- **Both classes keep their one-line delegates as class methods.** The other choice was to drop them and have callers import the functions directly. That was rejected for three reasons:
  - `AppViewHost`, `PluginHost`, `AppViewPlugin` and `SettingTabPlugin` are contracts of methods on an instance. Every surface calls `view.x()`, and the engine, the tab and the modals call `plugin.x()`. Dropping a delegate would mean rewriting each caller to import the function, which is what rule 2 forbids.
  - The tests spy on the instance (`stubSurfaces`, `makeLoadedPlugin`), and the calls between moved functions go through the host so that a spy sees them.
  - The esbuild-normalised classes are identical to the originals, so the emitted code does not change.
- **The classes are typed in place.** `CadenceAppView implements AppViewHost`, and `CadencePlugin implements PluginHost, AppViewPlugin, SettingTabPlugin`, so `tsc` checks each delegate against its contract. Their state is declared with `declare` fields, as in the setting tab, so esbuild emits no class fields. A class field would also overwrite what `ItemView`'s constructor set. Where Obsidian types `leaf.view` as a plain `View`, the shell casts inline (`(leaf.view as CadenceAppView).mode`). esbuild erases the cast, so the emitted code does not change.

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

- **Verbatim check.** Pass each original method body (with `this` → `view`) and each moved function through esbuild's `transformSync`, which strips the types and normalises the formatting, then compare the function bodies. #10's script is in its PR description, and #11's handles default parameters.
  - If you rewrite `this` → `view` mechanically, skip string literals. #11's rewrite turned "Open this note" into "Open view note", and only a characterization test caught it.
- **Mutation check.** Make a handful of one-line mutations to the extracted module, and confirm that each one breaks at least one test. If one survives, add the missing characterization test and say so in the PR.
- **A seam that builds click handlers** returns a target as data instead (`{ kind: 'mode', mode }`, `{ kind: 'file', file }`), and the surface function maps targets to `view.x()` calls. `computeBriefing` and `loadBriefing` ([#12](https://github.com/deanjstone/obsidian-cadence/issues/12)) are the example. That keeps the seam free of `view` and lets a test compare the whole result with `toEqual`.
- **A markdown write path is a `(content, input) → content` transform.** The surface reads the file, calls the transform and writes the result. When a write is conditional, the transform returns `null` for "no change" (`tickProjectTasks`).
- **An inline class keeps its own `this`.** `_openTaskProjectPicker` declared `const view = this;` for its inline `SuggestModal` to close over. The moved function drops that line, because `view` is already the parameter, and leaves `this` alone inside the class body. The verbatim check strips the alias line and restores the class's `this` before comparing.
- **When a moved method's name is taken by its pure seam**, name the moved function after what it does with the view. `_computeBriefing` became `loadBriefing`, because the pure `computeBriefing` is the briefing maths.
- **A seam whose callers belong to a later ticket** can land unwired, as long as it is tested and its doc comment names the callers that will adopt it. `chartData` is an example: it landed with #11 as the dashboards' counting loop. #17 swapped it into the Projects and CRM dashboards, and #20 into PRM analytics, so no inline copy is left. When a ticket swaps an unwired seam in, its PR shows the inline copy and the seam are the same code after esbuild normalisation, and the characterization tests that count through the dashboard stay unchanged.
- Run `pnpm typecheck && pnpm test && pnpm build`, and check that `git diff --exit-code -- main.js` is clean after the build. The registration-parity smoke test must be green with its snapshot unedited.
