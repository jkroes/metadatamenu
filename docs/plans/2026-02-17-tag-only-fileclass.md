# Tag-Only FileClass System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all FileClass assignment mechanisms with a single tag-based system where every FileClass maps to exactly one canonical tag (its own name), and add an "Add FileClass tag" convenience command.

**Architecture:** Remove 4 non-tag resolution functions from `FieldIndex`, strip matching data structures from `FieldIndexBuilder`, clean up 5 removed settings from the interface and UI, unconditionally register every FileClass by name as a tag in `indexFileClass()`, and add a new `AddFileClassTagModal` wired to both command palette and right-click context menu.

**Tech Stack:** TypeScript 4.7, Obsidian API, ESBuild. No CLI test harness — verification requires building and testing inside Obsidian. Build: `npm run build`. Deploy: `cp main.js test-vault-mdm/.obsidian/plugins/metadata-menu/main.js` (requires `dangerouslyDisableSandbox: true`). Reload plugin in Obsidian after each deploy.

---

## Background

FileClasses currently support 6 assignment mechanisms (explicit frontmatter, tags, paths, bookmarks, Dataview queries, global fallback). We are collapsing this to tags-only, with each FileClass always matching the tag equal to its own name.

**Key files:**
- `src/fileClass/fileClass.ts` — FileClass indexing, existing modal, `FileClassOptions` interface
- `src/index/FieldIndex.ts` — resolution orchestration (`indexFields()` at line 144)
- `src/index/FieldIndexBuilder.ts` — data structures and `flushCache()`
- `src/settings/MetadataMenuSettings.ts` — settings interface + defaults
- `src/settings/MetadataMenuSettingTab.ts` — settings UI tab
- `src/fileClass/views/fileClassSettingsView.ts` — per-FileClass options UI
- `src/options/OptionsList.ts` — right-click context menu
- `src/commands/paletteCommands.ts` — command palette commands
- `main.ts` — plugin entry point, event handlers, command wiring

---

## Task 1: Simplify FileClass tag registration in `indexFileClass()`

**Goal:** Every FileClass unconditionally maps to a tag equal to its name. Remove the `mapWithTag`/`tagNames` conditional branches from indexing. Remove `mapWithTag`, `tagNames`, `filesPaths`, `bookmarksGroups` from `FileClassOptions`.

**Files:**
- Modify: `src/fileClass/fileClass.ts`

**Step 1: Find `FileClassOptions` interface**

Search for `export interface FileClassOptions` in `src/fileClass/fileClass.ts`. It will look like:

```typescript
export interface FileClassOptions {
    limit: number,
    icon: string,
    parent?: FileClass;
    excludes?: Array<FileClassAttribute>;
    tagNames?: string[],
    mapWithTag: boolean,
    filesPaths?: string[],
    bookmarksGroups?: string[],
    savedViews?: SavedView[],
    favoriteView?: string | null
    fieldsOrder?: Field['id'][]
}
```

Remove the four lines for `tagNames`, `mapWithTag`, `filesPaths`, and `bookmarksGroups`.

**Step 2: Find `indexFileClass()` tag/path/bookmark registration block**

In `src/fileClass/fileClass.ts`, search for `mapWithTag`. You will find a block around lines 587–600:

```typescript
if (cache?.frontmatter?.mapWithTag) {
    if (!fileClassName.includes(" ")) {
        index.tagsMatchingFileClasses.set(fileClassName, fileClass)
    }
}

if (cache?.frontmatter?.tagNames) {
    const _tagNames = cache?.frontmatter?.tagNames as string | string[];
    const tagNames = Array.isArray(_tagNames) ? [..._tagNames] : _tagNames.split(",").map(t => t.trim())
    tagNames.forEach(tag => {
        if (!tag.includes(" ")) {
            index.tagsMatchingFileClasses.set(tag, fileClass)
        }
    })
}
```

Also find the `filesPaths` block just below it:

```typescript
if (cache?.frontmatter?.filesPaths) {
    ...
}
```

And the `bookmarksGroups` block.

Replace ALL of those conditional blocks with a single unconditional line:

```typescript
if (!fileClassName.includes(" ")) {
    index.tagsMatchingFileClasses.set(fileClassName, fileClass)
}
```

**Step 3: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | head -50
```

Expected: build succeeds or shows only errors from other files (the `FileClassOptions` removal may cause type errors in `fileClassSettingsView.ts` — that is expected and will be fixed in Task 7). If there are unexpected errors, investigate before continuing.

**Step 4: Commit**

```bash
git add src/fileClass/fileClass.ts
git commit -m "refactor: always register FileClass by name as canonical tag"
```

---

## Task 2: Remove non-tag resolution functions from `FieldIndex`

**Goal:** Delete `getFilesFieldsFromFileClass()`, `resolveFileClassMatchingFilesPaths()`, `resolveFileClassMatchingBookmarksGroups()`, `resolveFileClassQueries()` and their calls in `indexFields()`. Remove global FileClass handling from `getFileClasses()` and `getFilesFields()`.

**Files:**
- Modify: `src/index/FieldIndex.ts`

**Step 1: Remove calls from `indexFields()` (line 144)**

`indexFields()` currently calls (around lines 150–154):
```typescript
this.resolveFileClassMatchingTags()
this.resolveFileClassMatchingFilesPaths()
this.resolveFileClassMatchingBookmarksGroups()
this.resolveFileClassQueries()
this.getFilesFieldsFromFileClass()
this.getFilesFields()
```

Remove the four lines for `resolveFileClassMatchingFilesPaths`, `resolveFileClassMatchingBookmarksGroups`, `resolveFileClassQueries`, and `getFilesFieldsFromFileClass`. Keep `resolveFileClassMatchingTags` and `getFilesFields`.

**Step 2: Remove the global FileClass block from `getFileClasses()`**

Find `getFileClasses()` (around line 312). It contains:

```typescript
const globalFileClass = this.settings.globalFileClass
if (!globalFileClass) {
    this.fieldsFromGlobalFileClass = []
} else {
    this.fieldsFromGlobalFileClass = this.fileClassesFields.get(globalFileClass) || []
}
```

Delete these lines entirely.

**Step 3: Delete the four resolution functions**

Find and delete the full bodies of these private methods:
- `getFilesFieldsFromFileClass()` — reads `this.settings.fileClassAlias` from frontmatter
- `resolveFileClassMatchingFilesPaths()` — matches files by parent folder path
- `resolveFileClassMatchingBookmarksGroups()` — matches files via Obsidian bookmarks
- `resolveFileClassQueries()` — runs Dataview queries

**Step 4: Simplify `getFilesFields()` priority logic**

`getFilesFields()` currently merges fields from many sources into a priority order. After the removals it should use only tag-matched fields. Find the large `filesToIndex.forEach(f => { ... })` loop inside `getFilesFields()`.

The current logic combines `fileFieldsFromInnerFileClasses`, `fileFieldsFromTag`, `fileFieldsFromPath`, `fileFieldsFromGroup`, and `fileFieldsFromQuery`, then falls back to `fieldsFromGlobalFileClass` and then `plugin.presetFields`.

Replace the entire per-file resolution block with:

```typescript
filesToIndex.forEach(f => {
    let fileFields: Field[] = []
    const fileFieldsFromTag = this.filesFieldsFromTags.get(f.path)

    if (fileFieldsFromTag?.length) {
        fileFields = fileFieldsFromTag
        // Merge FileClass metadata
        const tagFileClasses = this.filesFileClasses.get(f.path) || []
        tagFileClasses.forEach(fc => {
            if (!this.filesFileClasses.get(f.path)?.includes(fc)) {
                this.filesFileClasses.get(f.path)?.push(fc)
            }
        })
    } else {
        fileFields = this.plugin.presetFields.map(prop => {
            const property = new (buildEmptyField(this.plugin, undefined))
            return Object.assign(property, prop)
        })
    }

    // Deduplicate fields by id
    const fieldIds = new Set<string>()
    const uniqueFields: Field[] = []
    fileFields.forEach(field => {
        if (!fieldIds.has(field.id)) {
            fieldIds.add(field.id)
            uniqueFields.push(field)
        }
    })
    this.filesFields.set(f.path, uniqueFields)
})
```

> **Note:** The original `getFilesFields()` also sets `this.filesFileClassesNames`. Look for that logic in the original and preserve it, adapted to only use tag-matched file classes.

**Step 5: Build to check for errors**

```bash
npm run build 2>&1 | head -80
```

Expected: errors for references to deleted data structures (`filesFieldsFromInnerFileClasses`, etc.) in `FieldIndexBuilder.ts`. Those will be fixed in Task 3. Any other errors investigate now.

**Step 6: Commit**

```bash
git add src/index/FieldIndex.ts
git commit -m "refactor: remove non-tag resolution from FieldIndex"
```

---

## Task 3: Clean up `FieldIndexBuilder` data structures

**Goal:** Remove properties and `flushCache()` initializations for the deleted resolution mechanisms.

**Files:**
- Modify: `src/index/FieldIndexBuilder.ts`

**Step 1: Remove property declarations**

In the public properties section (lines 41–86), find and remove:
- `public filesFieldsFromInnerFileClasses: Map<string, Field[]>`
- `public filesPathsMatchingFileClasses: Map<string, FileClass>`
- `public filesFieldsFromFilesPaths: Map<string, Field[]>`
- `public bookmarksGroupsMatchingFileClasses: Map<string, FileClass>`
- `public filesFieldsFromBookmarksGroups: Map<string, Field[]>`
- `public filesFieldsFromFileClassQueries: Map<string, Field[]>`
- `public fieldsFromGlobalFileClass: Field[]`
- `public fileClassQueries: FileClassQuery[]` (or similar query tracking property)

Also check for and remove a `bookmarks` property that references the internal Obsidian bookmarks plugin — used only by `resolveFileClassMatchingBookmarksGroups`.

**Step 2: Remove `flushCache()` initializations**

In `flushCache()` (lines 115–139), remove initializations for all the properties deleted above. The lines will look like:

```typescript
this.filesFieldsFromInnerFileClasses = new Map()
this.filesPathsMatchingFileClasses = new Map()
this.filesFieldsFromFilesPaths = new Map()
this.bookmarksGroupsMatchingFileClasses = new Map()
this.filesFieldsFromBookmarksGroups = new Map()
this.filesFieldsFromFileClassQueries = new Map()
this.fieldsFromGlobalFileClass = []
```

Remove them all.

**Step 3: Remove `init()` bookmark reference if present**

In `init()` (lines 95–113), if there is a line assigning `this.bookmarks` to the internal bookmarks plugin, remove it.

**Step 4: Build to check errors**

```bash
npm run build 2>&1 | head -80
```

Expected: errors about removed settings (`fileClassAlias`, `globalFileClass`, etc.) from settings files — those are fixed in Task 4. Check for unexpected errors in index files.

**Step 5: Commit**

```bash
git add src/index/FieldIndexBuilder.ts
git commit -m "refactor: remove non-tag resolution data structures from FieldIndexBuilder"
```

---

## Task 4: Remove settings from `MetadataMenuSettings`

**Goal:** Strip five settings from the interface and defaults. Remove `initialFileClassQueries` loading from `main.ts`.

**Files:**
- Modify: `src/settings/MetadataMenuSettings.ts`
- Modify: `main.ts`

**Step 1: Remove from `MetadataMenuSettings` interface**

In `src/settings/MetadataMenuSettings.ts`, find the interface (lines 9–42). Remove these five lines:
- `fileClassAlias: string;` (line 16)
- `globalFileClass?: string;` (line 18)
- `fileClassQueries: Array<FileClassQuery>;` (line 11)
- `chooseFileClassAtFileCreation: boolean;` (line 37)
- `autoInsertFieldsAtFileClassInsertion: boolean;` (line 38)

**Step 2: Remove from `DEFAULT_SETTINGS`**

In the same file, find `DEFAULT_SETTINGS` (around line 44). Remove:
- `fileClassAlias: "fileClass",`
- `globalFileClass: undefined,` (or however it appears)
- `fileClassQueries: [],`
- `chooseFileClassAtFileCreation: false,`
- `autoInsertFieldsAtFileClassInsertion: false,`

**Step 3: Remove `FileClassQuery` import if now unused**

Check the imports at the top of `MetadataMenuSettings.ts`. If `FileClassQuery` is no longer used, remove it.

**Step 4: Remove `initialFileClassQueries` from `main.ts`**

In `main.ts`, find this block (around lines 85–89):

```typescript
this.settings.fileClassQueries.forEach(query => {
    const fileClassQuery = new FileClassQuery();
    Object.assign(fileClassQuery, query);
    this.initialFileClassQueries.push(fileClassQuery);
})
```

Delete it. Then find the declaration of `initialFileClassQueries` on the plugin class itself (a class property like `initialFileClassQueries: FileClassQuery[] = []`) and remove it too.

Also check for any `FileClassQuery` import at the top of `main.ts` — remove if no longer used.

**Step 5: Remove the vault `"create"` event handler from `main.ts`**

Find this block in `main.ts` (around lines 95–103):

```typescript
this.registerEvent(
    this.app.vault.on("create", (file) => {
        if (!this.fieldIndex.fileClassesName.size) return
        if (file instanceof TFile && file.extension === "md" && this.settings.chooseFileClassAtFileCreation) {
            const modal = new AddFileClassToFileModal(this, file)
            modal.open()
        }
    })
)
```

Delete the entire `this.registerEvent(...)` block.

**Step 6: Build to check errors**

```bash
npm run build 2>&1 | head -80
```

Expected: errors about removed settings referenced in `MetadataMenuSettingTab.ts` — fixed in Task 5.

**Step 7: Commit**

```bash
git add src/settings/MetadataMenuSettings.ts main.ts
git commit -m "refactor: remove non-tag settings and plugin init code"
```

---

## Task 5: Remove settings UI controls from `MetadataMenuSettingTab`

**Goal:** Remove the five UI setting blocks from the settings tab.

**Files:**
- Modify: `src/settings/MetadataMenuSettingTab.ts`

**Step 1: Remove `fileClassAlias` setting block**

Find the block around lines 474–488 that creates a setting named `"FileClass field alias"` with a text input. Delete the entire `new Setting(...)` block including its `.setName(...)`, `.setDesc(...)`, `.addText(...)`, and any associated variable declarations.

**Step 2: Remove `globalFileClass` setting block**

Find the block around lines 493–519 that creates a setting named `"Global fileClass"` with a `FileSuggest`. Delete the entire block.

**Step 3: Remove `chooseFileClassAtFileCreation` setting block**

Find the block around lines 579–590 for `"Add a fileclass after create"` with a `Toggle`. Delete it.

**Step 4: Remove `autoInsertFieldsAtFileClassInsertion` setting block**

Find the block around lines 595–606 for `"Insert fileClass fields"` with a `Toggle`. Delete it.

**Step 5: Remove `fileClassQueries` section**

Find the block around lines 704–724 labeled `"Query based FileClass settings"`. This likely includes a header, an add button, and a loop rendering existing queries via `FileClassQuerySetting`. Delete the entire section.

**Step 6: Remove now-unused imports and variables**

Check imports at the top of the file. Remove any that are now unused due to the deletions (e.g., `FileClassQuery`, `FileClassQuerySetting`, `FileClassQuerySettingsModal`, `FileSuggest` if only used for globalFileClass). Also find `this.newFileClassAlias` (line 175) and any other variables only used by the removed blocks.

**Step 7: Build**

```bash
npm run build 2>&1 | head -80
```

Expected: clean or only errors from `fileClassSettingsView.ts` (fixed in Task 7).

**Step 8: Commit**

```bash
git add src/settings/MetadataMenuSettingTab.ts
git commit -m "refactor: remove non-tag settings UI from settings tab"
```

---

## Task 6: Add `AddFileClassTagModal` to `fileClass.ts`

**Goal:** Replace the old explicit-assignment modal with a new modal that adds a tag.

**Files:**
- Modify: `src/fileClass/fileClass.ts`

**Step 1: Remove old `AddFileClassToFileModal` class**

Find the class `AddFileClassToFileModal` (around lines 82–119). Delete the entire class, including `insertFileClassToFile()`.

**Step 2: Add new `AddFileClassTagModal` class**

In the same location, add:

```typescript
export class AddFileClassTagModal extends SuggestModal<string> {

    constructor(
        private plugin: MetadataMenu,
        private file: TFile
    ) {
        super(plugin.app)
        this.setPlaceholder("Choose a fileClass to add as a tag")
    }

    getSuggestions(query: string): string[] {
        const cache = this.plugin.app.metadataCache.getFileCache(this.file)
        const fmTags: string | string[] = cache?.frontmatter?.tags || []
        const fmTagArray: string[] = Array.isArray(fmTags)
            ? fmTags
            : fmTags.split(',').map((t: string) => t.trim())
        const inlineTags: string[] = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || []
        const existingTags = new Set([...fmTagArray, ...inlineTags])

        return [...this.plugin.fieldIndex.fileClassesName.keys()]
            .filter(name => !existingTags.has(name))
            .filter(name => name.toLowerCase().contains(query.toLowerCase()))
            .sort()
    }

    renderSuggestion(item: string, el: HTMLElement): void {
        el.createEl("div", { text: item })
    }

    onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
        this.plugin.app.fileManager.processFrontMatter(this.file, (fm) => {
            const tags = fm["tags"]
            if (!tags) {
                fm["tags"] = [item]
            } else if (Array.isArray(tags)) {
                if (!tags.includes(item)) tags.push(item)
            } else {
                const tagArray = String(tags).split(',').map((t: string) => t.trim())
                if (!tagArray.includes(item)) fm["tags"] = [...tagArray, item]
            }
        })
    }
}
```

**Step 3: Check imports**

`AddFileClassTagModal` uses `SuggestModal`, `TFile`, `MetadataMenu`. Verify these are already imported at the top of the file. Add any that are missing.

**Step 4: Build**

```bash
npm run build 2>&1 | head -50
```

**Step 5: Commit**

```bash
git add src/fileClass/fileClass.ts
git commit -m "feat: add AddFileClassTagModal for tag-based fileClass assignment"
```

---

## Task 7: Update commands in `paletteCommands.ts`

**Goal:** Remove `fileclassToFileCommand()` and the `fileClassAlias` cursor special case. Add `addFileClassTagCommand()`.

**Files:**
- Modify: `src/commands/paletteCommands.ts`

**Step 1: Remove `fileclassToFileCommand()`**

Find the function `fileclassToFileCommand()` (lines 318–335). Delete the entire function.

Find where it is called in `addCommands()` (line 413) and delete that call line.

**Step 2: Remove `fileClassAlias` special case in `manageFieldAtCursorCommand()`**

Find the `else if` block around lines 139–143:

```typescript
} else if (key === plugin.settings.fileClassAlias) {
    const node = note.getNodeForIndexedPath(`fileclass-field-${plugin.settings.fileClassAlias}`)
    if (node) optionsList.createAndOpenNodeFieldModal(node)
    else new Notice("No field with definition at this position", 2000)
}
```

Delete this `else if` block (keep the surrounding `if (field)` logic intact).

**Step 3: Add `addFileClassTagCommand()`**

After the last existing command function (before `addCommands()`), add:

```typescript
function addFileClassTagCommand(plugin: MetadataMenu) {
    plugin.addCommand({
        id: "add_fileclass_tag",
        name: "Add fileClass tag to file",
        icon: "tag",
        checkCallback: (checking: boolean) => {
            const activeFile = plugin.app.workspace.getActiveFile()
            if (checking) {
                return !!activeFile && plugin.fieldIndex.fileClassesName.size > 0
            }
            if (activeFile) {
                const modal = new AddFileClassTagModal(plugin, activeFile)
                modal.open()
            }
        }
    })
}
```

**Step 4: Register the new command**

In `addCommands(plugin)`, add a call:

```typescript
addFileClassTagCommand(plugin)
```

**Step 5: Update import**

At the top of `paletteCommands.ts`, find the import of `AddFileClassToFileModal`. Replace it with `AddFileClassTagModal`:

```typescript
import { AddFileClassTagModal } from 'src/fileClass/fileClass'
```

(Remove `AddFileClassToFileModal` from the same import.)

**Step 6: Build**

```bash
npm run build 2>&1 | head -50
```

**Step 7: Commit**

```bash
git add src/commands/paletteCommands.ts
git commit -m "feat: add 'Add fileClass tag' command, remove explicit assignment command"
```

---

## Task 8: Update context menu in `OptionsList.ts`

**Goal:** Replace `addFileClassToFileOption()` with `addFileClassTagOption()`.

**Files:**
- Modify: `src/options/OptionsList.ts`

**Step 1: Find and replace `addFileClassToFileOption()`**

Find the method `addFileClassToFileOption()` (lines 362–380). Replace the entire method body:

```typescript
private addFileClassTagOption(): void {
    const modal = new AddFileClassTagModal(this.plugin, this.file)
    const action = () => modal.open()
    if (isMenu(this.location)) {
        this.location.addItem((item) => {
            item.setTitle(`Add fileClass tag to ${this.file.basename}`)
            item.onClick(action)
            item.setSection("metadata-menu-fileclass")
        })
    } else if (isSuggest(this.location)) {
        this.location.addItem(
            "tag",
            `Add fileClass tag to ${this.file.basename}`,
            action,
            0
        )
    }
}
```

**Step 2: Update callers**

Find the two call sites (lines 106 and 152) that call `this.addFileClassToFileOption()`. Replace both with `this.addFileClassTagOption()`.

**Step 3: Update import**

Find the import of `AddFileClassToFileModal` at the top of `OptionsList.ts`. Replace it with `AddFileClassTagModal`.

**Step 4: Build**

```bash
npm run build 2>&1 | head -50
```

**Step 5: Commit**

```bash
git add src/options/OptionsList.ts
git commit -m "feat: replace 'Add fileClass' context menu with 'Add fileClass tag'"
```

---

## Task 9: Remove FileClass options UI from `fileClassSettingsView.ts`

**Goal:** Remove the `mapWithTag`, `tagNames`, `filesPaths`, `bookmarksGroups` UI controls from the per-FileClass settings view.

**Files:**
- Modify: `src/fileClass/views/fileClassSettingsView.ts`

**Step 1: Remove `mapWithTag` UI block**

Find the block around lines 74–80 and the `buildMapWithTagComponent()` method (around lines 142–149). Delete both the call site and the method itself.

**Step 2: Remove `tagNames` UI block**

Find the `tagNames` binding block around lines 87–92 and any related `TagSuggestModal` call. Delete the call site. If `TagSuggestModal` is defined elsewhere and only used here, delete the import too.

**Step 3: Remove `filesPaths` UI block**

Find the `filesPaths` binding block around lines 93–98. Delete the call site and related `PathSuggestModal` usage.

**Step 4: Remove `bookmarksGroups` UI block**

Find the `bookmarksGroups` binding block around lines 99–104. Delete the call site and related `BookmarksGroupSuggestModal` usage.

**Step 5: Remove now-unused helper methods and imports**

If `buildBindingComponent()` (lines 167–190) is only called for `tagNames`, `filesPaths`, and `bookmarksGroups`, delete it too. Remove any now-unused imports at the top of the file (e.g., `TagSuggestModal`, `PathSuggestModal`, `BookmarksGroupSuggestModal`).

Update `fileClassOptions` references throughout the class — since the options no longer have `mapWithTag`, `tagNames`, `filesPaths`, or `bookmarksGroups`, any initialization code setting those to defaults should also be removed.

**Step 6: Build cleanly**

```bash
npm run build 2>&1
```

Expected: clean build with no errors. If there are errors, fix them before proceeding.

**Step 7: Commit**

```bash
git add src/fileClass/views/fileClassSettingsView.ts
git commit -m "refactor: remove non-tag FileClass options UI"
```

---

## Task 10: Deploy and verify in Obsidian

**Goal:** Confirm the full system works end-to-end.

**Step 1: Deploy**

```bash
cp main.js test-vault-mdm/.obsidian/plugins/metadata-menu/main.js
```

(Use `dangerouslyDisableSandbox: true` for this command.)

**Step 2: Reload plugin in Obsidian**

Open Obsidian with `test-vault-mdm`. Go to **Settings → Community Plugins** and disable then re-enable Metadata Menu.

**Step 3: Verify tag-based field resolution**

Open `TestFiles/test-suggestions.md`. Add the tag `TestFieldTypes` to its frontmatter. Confirm the `status`, `link`, and `related` field widgets appear in the Properties panel with their respective dropdowns.

Remove the tag. Confirm the fields disappear from the Properties panel (or fall back to preset fields).

**Step 4: Verify "Add fileClass tag" command palette**

Open any note. Press Ctrl+P / Cmd+P. Search for `"Add fileClass tag"`. Confirm the command appears. Select it. Confirm a suggest modal appears listing available FileClasses. Choose one. Confirm the FileClass name is added to the note's `tags` frontmatter array.

**Step 5: Verify "Add fileClass tag" context menu**

Right-click a note in the file explorer. Confirm `"Add fileClass tag to <filename>"` appears. Click it. Confirm the same suggest modal behavior.

**Step 6: Verify no old commands remain**

Open command palette and search for `"Add fileClass to file"`. Confirm it no longer appears.

**Step 7: Verify settings tab**

Open **Settings → Metadata Menu**. Confirm `fileClassAlias`, `Global fileClass`, `Add a fileclass after create`, `Insert fileClass fields`, and the `Query based FileClass` section are all gone.

**Step 8: Commit final state**

```bash
git add .
git commit -m "feat: tag-only fileclass system complete"
```

---

## Notes & Gotchas

- **`getFilesFields()` is complex.** Read the full function before editing. It also updates `this.filesFileClassesNames` — ensure that assignment is preserved (adapted to use only tag-matched file classes).
- **`migrateSetting.ts`** may reference removed settings by name. Check `src/settings/migrateSetting.ts` and remove any branches for `fileClassAlias`, `globalFileClass`, `fileClassQueries`, `chooseFileClassAtFileCreation`, `autoInsertFieldsAtFileClassInsertion`.
- **`fileClassQueries`** in `FieldIndexBuilder` may be stored separately from the removed data structures — grep for it to be sure.
- **Build errors are your guide.** After each task, build to see what remains broken. TypeScript errors from removed types will tell you exactly what was missed.
- The `isSuggest()` helper in `OptionsList.ts` — check how the original `addFileClassToFileOption()` uses it to match the exact call signature for the suggest path.
