# FileClass Folder Association Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional folder association to each FileClass so that tagging a note auto-moves it into that folder, and creating a note inside the folder auto-tags it.

**Architecture:** Add `folder?: string` to `FileClassOptions`, build a `foldersMatchingFileClasses` lookup map during indexing, extend `AddFileClassTagModal` with move logic, add a new `NewNoteFileClassModal` for new-note prompting, and wire a `vault.on("create")` handler in `main.ts`.

**Tech Stack:** TypeScript 4.7, Obsidian API. No CLI test harness — all verification is manual in Obsidian. Build: `npm run build`. Deploy: `cp main.js test-vault-mdm/.obsidian/plugins/metadata-menu/main.js` (requires `dangerouslyDisableSandbox: true`). Reload plugin in Obsidian after deploy.

---

## Background

Key files:
- `src/fileClass/fileClass.ts` — `FileClassOptions` interface+class, `FileClass` class, `AddFileClassTagModal`, `indexFileClass()`
- `src/index/FieldIndexBuilder.ts` — index data structures and `flushCache()`
- `src/fileClass/views/fileClassSettingsView.ts` — per-FileClass settings UI
- `src/settings/MetadataMenuSettings.ts` — plugin settings interface and defaults
- `src/settings/MetadataMenuSettingTab.ts` — global settings tab UI
- `main.ts` — plugin entry point, event handlers

The `options` record at the top of `fileClass.ts` (lines 21–29) maps `FileClassOptions` property names to their frontmatter key names and serialization functions. The `updateOptions()` method iterates this record to write options to frontmatter. The `getFileClassOptions()` method reads from frontmatter and constructs a `FileClassOptions` instance.

---

## Task 1: Add `folder` to `FileClassOptions` and data model

**Files:**
- Modify: `src/fileClass/fileClass.ts`

**Step 1: Add `folder` to the `options` serialization record**

At line 21 in `src/fileClass/fileClass.ts`, the `options` record maps option keys to their frontmatter behavior. Add a new entry for `"folder"` after `"fieldsOrder"`:

```typescript
"folder": { name: "folder", toValue: (value: string | undefined) => value || null }
```

The full record becomes (showing existing + new):
```typescript
const options: Record<string, { name: string, toValue: (value: any) => any }> = {
    "limit": { name: "limit", toValue: (value: any) => value },
    "icon": { name: "icon", toValue: (value: any) => `${value || "file-spreadsheet"}` },
    "excludes": { name: "excludes", toValue: (values: FileClassAttribute[]) => values.length ? values.map(attr => attr.name) : null },
    "parent": { name: "extends", toValue: (value: FileClass) => value?.name || null },
    "savedViews": { name: "savedViews", toValue: (value: SavedView[]) => value },
    "favoriteView": { name: "favoriteView", toValue: (value?: string) => value || null },
    "fieldsOrder": { name: "fieldsOrder", toValue: (value?: Field['id'][]) => value || [] },
    "folder": { name: "folder", toValue: (value: string | undefined) => value || null }
}
```

**Step 2: Add `folder` to the `FileClassOptions` interface**

After line 44 (`fieldsOrder?: Field['id'][]`), add:
```typescript
folder?: string
```

**Step 3: Add `folder` to the `FileClassOptions` class constructor**

The `FileClassOptions` class (lines 47–60) has a constructor with positional parameters. Add `public folder?: string` after `fieldsOrder`:

```typescript
export class FileClassOptions {
    constructor(
        public limit: number,
        public icon: string,
        public parent?: FileClass,
        public excludes?: Array<FileClassAttribute>,
        public savedViews?: SavedView[],
        public favoriteView?: string | null,
        public fieldsOrder?: Field['id'][],
        public folder?: string
    ) {}
}
```

**Step 4: Read `folder` in `getFileClassOptions()`**

In `FileClass.getFileClassOptions()` (lines 116–142):
1. Add `folder: _folder` to the destructure from frontmatter (line 117–125)
2. Add a local variable: `const folder: string | undefined = typeof _folder === "string" && _folder !== "" ? _folder : undefined`
3. Pass `folder` as the last argument to `new FileClassOptions(...)` (line 141):

```typescript
return new FileClassOptions(limit, icon, parent, excludes, savedViews, favoriteView, fieldsOrder, folder);
```

**Step 5: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build (no errors from this change).

**Step 6: Commit**

```bash
git add src/fileClass/fileClass.ts
git commit -m "feat: add folder property to FileClassOptions"
```

---

## Task 2: Add `foldersMatchingFileClasses` to `FieldIndexBuilder` and populate in indexing

**Files:**
- Modify: `src/index/FieldIndexBuilder.ts`
- Modify: `src/fileClass/fileClass.ts`

**Step 1: Add property declaration to `FieldIndexBuilder`**

In `src/index/FieldIndexBuilder.ts`, the public properties run from lines 41–76. After `tagsMatchingFileClasses` (line 67), add:

```typescript
public foldersMatchingFileClasses: Map<string, FileClass>;
```

**Step 2: Initialize in `flushCache()`**

In `flushCache()` (lines 104–121), after `this.tagsMatchingFileClasses = new Map()` (line 117), add:

```typescript
this.foldersMatchingFileClasses = new Map();
```

**Step 3: Populate during `indexFileClass()`**

In `src/fileClass/fileClass.ts`, in the `indexFileClass()` function (lines 506–533), after the `tagsMatchingFileClasses.set(...)` block, add:

```typescript
const folder = cache?.frontmatter?.folder
if (typeof folder === "string" && folder !== "") {
    index.foldersMatchingFileClasses.set(folder, fileClass)
}
```

Where `cache` is obtained by adding this line before the `try` block:
```typescript
const cache = index.plugin.app.metadataCache.getFileCache(file)
```

The full updated `indexFileClass` function will look like:

```typescript
export function indexFileClass(index: FieldIndex, file: TFile): void {
    const fileClassName = getFileClassNameFromPath(index.plugin.settings, file.path)
    if (fileClassName) {
        const cache = index.plugin.app.metadataCache.getFileCache(file)
        try {
            const fileClass = createFileClass(index.plugin, fileClassName)
            index.fileClassesFields.set(
                fileClassName,
                fileClass.attributes
                    .map(attr => attr.getIField())
                    .filter(field => field !== undefined) as Field[]
            )
            index.fileClassesPath.set(file.path, fileClass)
            index.fileClassesName.set(fileClass.name, fileClass)
            if ((fileClass.getMajorVersion() === undefined || fileClass.getMajorVersion() as number < 2) && index.plugin.manifest.version < "0.6.0") {
                index.v1FileClassesPath.set(file.path, fileClass)
                index.remainingLegacyFileClasses = true
            }
            if (!fileClassName.includes(" ")) {
                index.tagsMatchingFileClasses.set(fileClassName, fileClass)
            }
            const folder = cache?.frontmatter?.folder
            if (typeof folder === "string" && folder !== "") {
                index.foldersMatchingFileClasses.set(folder, fileClass)
            }
        } catch (error) {
            console.error(error)
        }
    }
}
```

**Step 4: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 5: Commit**

```bash
git add src/index/FieldIndexBuilder.ts src/fileClass/fileClass.ts
git commit -m "feat: build foldersMatchingFileClasses index during FileClass indexing"
```

---

## Task 3: Add folder setting to per-FileClass settings UI

**Files:**
- Modify: `src/fileClass/views/fileClassSettingsView.ts`

**Step 1: Add `folder` row to `buildSettings()`**

In `FileClassSettingsView.buildSettings()` (lines 58–88), after the `"excludes"` `FileClassSetting` block (lines 80–85), add a new setting before `this.buildSaveBtn()`:

```typescript
this.fileClassSettings["folder"] = new FileClassSetting(
    settingsContainer,
    "Associated folder",
    "Vault-relative folder path (e.g. <code>Projects</code>). Adding this FileClass tag to a note moves it into this folder. Creating a note in this folder applies this tag.",
    (action: HTMLDivElement) => this.buildFolderComponent(action)
)
```

**Step 2: Add `buildFolderComponent()` method**

After the `buildExtendComponent()` method (ending around line 180), add:

```typescript
private buildFolderComponent(action: HTMLDivElement): void {
    const input = new TextComponent(action)
        .setValue(this.fileClassOptions.folder || "")
        .onChange((value) => {
            this.saveBtn.addClass("active");
            this.fileClassOptions.folder = value.trim() || undefined;
        })
    input.inputEl.setAttr("id", "fileclass-settings-folder-input")
    input.inputEl.setAttr("placeholder", "folder/path")
}
```

**Step 3: Check imports**

`TextComponent` is already imported at line 1. No new imports needed.

**Step 4: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 5: Commit**

```bash
git add src/fileClass/views/fileClassSettingsView.ts
git commit -m "feat: add associated folder setting to FileClass settings view"
```

---

## Task 4: Add "Prompt for fileclass on new note" plugin setting

**Files:**
- Modify: `src/settings/MetadataMenuSettings.ts`
- Modify: `src/settings/MetadataMenuSettingTab.ts`

**Step 1: Add setting to interface**

In `src/settings/MetadataMenuSettings.ts`, in the `MetadataMenuSettings` interface (lines 8–36), add after `disableDataviewPrompt`:

```typescript
promptFileClassOnNewNote: boolean;
```

**Step 2: Add default value**

In `DEFAULT_SETTINGS` (lines 38–66), add after `disableDataviewPrompt: false,`:

```typescript
promptFileClassOnNewNote: true,
```

**Step 3: Add toggle to settings UI**

In `src/settings/MetadataMenuSettingTab.ts`, inside the FileClass settings section, add after the `showFileClassSelectInModal` setting block (ending around line 528):

```typescript
const promptOnNewNote = new Setting(classFilesSettings.containerEl)
    .setName('Prompt for FileClass on new note')
    .setDesc('When creating a note outside any folder-associated FileClass folder, show a modal to assign a FileClass. Disable if you create notes programmatically.')
    .addToggle(cb => {
        cb.setValue(this.plugin.settings.promptFileClassOnNewNote);
        cb.onChange(value => {
            this.plugin.settings.promptFileClassOnNewNote = value;
            this.plugin.saveSettings();
        })
    })
promptOnNewNote.settingEl.addClass("no-border");
promptOnNewNote.controlEl.addClass("full-width");
```

**Step 4: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 5: Commit**

```bash
git add src/settings/MetadataMenuSettings.ts src/settings/MetadataMenuSettingTab.ts
git commit -m "feat: add promptFileClassOnNewNote setting"
```

---

## Task 5: Update `AddFileClassTagModal` with folder-conflict filtering and move-on-tag

**Files:**
- Modify: `src/fileClass/fileClass.ts`

### 5A: Filter folder-associated FileClasses when note already has one

**Step 1: Update `getSuggestions()`**

The current `getSuggestions()` (lines 78–91) already filters out FileClasses already tagged on the file. We need to additionally filter out all folder-associated FileClasses if the note already has a tag for any folder-associated FileClass.

Replace the current `getSuggestions()` with:

```typescript
getSuggestions(query: string): string[] {
    const cache = this.plugin.app.metadataCache.getFileCache(this.file)
    const fmTags: string | string[] = cache?.frontmatter?.tags || []
    const fmTagArray: string[] = Array.isArray(fmTags)
        ? fmTags
        : fmTags.split(',').map((t: string) => t.trim())
    const inlineTags: string[] = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || []
    const existingTags = new Set([...fmTagArray, ...inlineTags])

    const foldersMap = this.plugin.fieldIndex.foldersMatchingFileClasses
    const folderAssociatedNames = new Set([...foldersMap.values()].map(fc => fc.name))
    const noteAlreadyHasFolderClass = [...existingTags].some(tag => folderAssociatedNames.has(tag))

    return [...this.plugin.fieldIndex.fileClassesName.keys()]
        .filter(name => !existingTags.has(name))
        .filter(name => !(noteAlreadyHasFolderClass && folderAssociatedNames.has(name)))
        .filter(name => name.toLowerCase().contains(query.toLowerCase()))
        .sort()
}
```

### 5B: Move file after tagging when FileClass has a folder

**Step 2: Update `onChooseSuggestion()`**

Replace the current `onChooseSuggestion()` (lines 97–109) with a version that also moves the file if the chosen FileClass has a folder association. The move must happen after the frontmatter write completes:

```typescript
onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
    const fileClass = this.plugin.fieldIndex.fileClassesName.get(item)
    const folder = fileClass?.getFileClassOptions().folder

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
    }).then(() => {
        if (folder) {
            const newPath = `${folder}/${this.file.name}`
            if (this.file.path !== newPath) {
                this.plugin.app.fileManager.renameFile(this.file, newPath)
            }
        }
    })
}
```

**Step 3: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 4: Commit**

```bash
git add src/fileClass/fileClass.ts
git commit -m "feat: filter folder-conflicts in AddFileClassTagModal and move file on tag"
```

---

## Task 6: Add `NewNoteFileClassModal`

**Files:**
- Modify: `src/fileClass/fileClass.ts`

**Step 1: Add the new modal class**

After the `AddFileClassTagModal` class (ending around line 110) and before the `class FileClass {` declaration, add:

```typescript
export class NewNoteFileClassModal extends SuggestModal<string> {

    constructor(
        private plugin: MetadataMenu,
        private file: TFile
    ) {
        super(plugin.app)
        this.setPlaceholder("Choose a FileClass for this new note")
    }

    getSuggestions(query: string): string[] {
        const foldersMap = this.plugin.fieldIndex.foldersMatchingFileClasses
        return [...foldersMap.values()]
            .map(fc => fc.name)
            .filter(name => name.toLowerCase().contains(query.toLowerCase()))
            .sort()
    }

    renderSuggestion(item: string, el: HTMLElement): void {
        el.createEl("div", { text: item })
    }

    onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
        const fileClass = this.plugin.fieldIndex.fileClassesName.get(item)
        const folder = fileClass?.getFileClassOptions().folder

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
        }).then(() => {
            if (folder) {
                const newPath = `${folder}/${this.file.name}`
                if (this.file.path !== newPath) {
                    this.plugin.app.fileManager.renameFile(this.file, newPath)
                }
            }
        })
    }
}
```

**Step 2: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 3: Commit**

```bash
git add src/fileClass/fileClass.ts
git commit -m "feat: add NewNoteFileClassModal for new-note FileClass assignment"
```

---

## Task 7: Wire `vault.on("create")` handler in `main.ts`

**Files:**
- Modify: `main.ts`

**Step 1: Add import for `NewNoteFileClassModal`**

At the top of `main.ts`, add the import (alongside the existing imports from `src/fileClass/fileClass.ts` if any; otherwise add a new import):

```typescript
import { NewNoteFileClassModal } from 'src/fileClass/fileClass'
```

Also add `TFile` and `TFolder` to the obsidian import if not already present:
```typescript
import { MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
```

(Check the existing import — `TFile` may already be imported transitively; verify in the actual file.)

**Step 2: Register the `vault.on("create")` event**

In `onload()`, after the `app.workspace.on("file-open", ...)` block (around lines 93–96) and before the `app.metadataCache.on('metadata-menu:indexed', ...)` block, add:

```typescript
this.registerEvent(
    this.app.vault.on("create", (abstractFile) => {
        if (!(abstractFile instanceof TFile)) return
        if (abstractFile.extension !== "md") return

        const classFilesPath = this.settings.classFilesPath
        if (classFilesPath && abstractFile.path.startsWith(classFilesPath)) return

        if (!this.launched) return

        const parentFolder = abstractFile.parent?.path ?? ""
        const folderFileClass = this.fieldIndex.foldersMatchingFileClasses.get(parentFolder)

        if (folderFileClass) {
            // Auto-tag: file is in a folder-associated folder
            this.app.fileManager.processFrontMatter(abstractFile, (fm) => {
                const tags = fm["tags"]
                if (!tags) {
                    fm["tags"] = [folderFileClass.name]
                } else if (Array.isArray(tags)) {
                    if (!tags.includes(folderFileClass.name)) tags.push(folderFileClass.name)
                } else {
                    const tagArray = String(tags).split(',').map((t: string) => t.trim())
                    if (!tagArray.includes(folderFileClass.name)) fm["tags"] = [...tagArray, folderFileClass.name]
                }
            })
        } else if (this.settings.promptFileClassOnNewNote && this.fieldIndex.foldersMatchingFileClasses.size > 0) {
            // Prompt: file is not in a folder-associated folder
            const modal = new NewNoteFileClassModal(this, abstractFile)
            modal.open()
        }
    })
)
```

**Step 3: Build to verify**

```bash
npm run build 2>&1 | head -50
```

Expected: clean build.

**Step 4: Commit**

```bash
git add main.ts
git commit -m "feat: register vault create handler for folder-based FileClass auto-tagging"
```

---

## Task 8: Deploy and verify in Obsidian

**Step 1: Deploy**

```bash
cp main.js test-vault-mdm/.obsidian/plugins/metadata-menu/main.js
```

(Use `dangerouslyDisableSandbox: true` for this command.)

**Step 2: Set up test fixture**

Open `test-vault-mdm`. In Obsidian:
1. Go to Settings → Metadata Menu → FileClass settings
2. Make sure `Prompt for FileClass on new note` is enabled (the new toggle)
3. Open the `TestFieldTypes` FileClass settings view (navigate to `Fileclasses/TestFieldTypes.md`, click the MM button or use the table view)
4. In the **Associated folder** field, enter `TestFiles` and click Save

**Step 3: Verify folder stored in frontmatter**

Open `test-vault-mdm/Fileclasses/TestFieldTypes.md`. Confirm the frontmatter now contains `folder: TestFiles`.

**Step 4: Verify `AddFileClassTagModal` filters folder classes**

Open any note **outside** `TestFiles/`. Run command `Add fileClass tag to file`. Confirm `TestFieldTypes` appears in the list (since this note has no folder-associated tag yet). Choose it. Confirm:
- `TestFieldTypes` is added to frontmatter `tags`
- The note is moved into `TestFiles/`

**Step 5: Verify folder-conflict filtering**

Open a note that has `TestFieldTypes` in its tags. Run `Add fileClass tag`. Confirm `TestFieldTypes` does not appear (already tagged). If other folder-associated FilClasses exist, confirm they are also absent from the list.

**Step 6: Verify new note auto-tag**

In Obsidian, create a new note directly inside the `TestFiles/` folder (right-click `TestFiles` in file explorer → New note). Confirm the note automatically gets `TestFieldTypes` added to its frontmatter `tags`.

**Step 7: Verify new note prompt**

Create a new note in the vault root or any non-associated folder. Confirm a modal appears listing available folder-associated FilClasses. Choose one. Confirm the note gets the tag and is moved to the associated folder. Press Escape on the modal. Confirm no action is taken.

**Step 8: Verify "Prompt for FileClass" toggle**

Go to Settings → Metadata Menu → FileClass settings. Disable `Prompt for FileClass on new note`. Create a new note outside `TestFiles/`. Confirm no modal appears.

**Step 9: Commit final state if clean**

```bash
git add .
git commit -m "docs: mark folder association implementation complete"
```

---

## Notes & Gotchas

- **`vault.on("create")` fires before frontmatter is populated.** The `processFrontMatter` call in the create handler should still work because Obsidian creates the file first (even empty), but be aware the metadata cache won't have indexed it yet. This is fine — `processFrontMatter` operates directly on the file.
- **`this.launched` guard.** The `vault.on("create")` fires during startup for pre-existing files. Guarding with `this.launched` (set to `true` after `fullIndex()` in `onLayoutReady`) prevents spurious modals on plugin load.
- **Folder path normalization.** The `folder` value stored in frontmatter should NOT have a trailing slash. When building `newPath = \`${folder}/${file.name}\``, this is correct. If a user accidentally enters a trailing slash via the UI, the `buildFolderComponent` `onChange` trims it with `value.trim()` but does not strip trailing slash — consider adding `.replace(/\/$/, '')` if needed.
- **Root folder.** If a user sets `folder: ""` or clears the field, `getFileClassOptions()` returns `folder: undefined`, so no entry is added to `foldersMatchingFileClasses`. This is correct.
- **`file.parent?.path`** returns `""` (empty string) for vault root. If a user sets `folder: ""` in frontmatter, that would match — but `indexFileClass` only registers non-empty strings, so this edge case is safe.
- **`TFile` import in `main.ts`.** Check the top of `main.ts` — it currently imports only `MarkdownView, Notice, Plugin` from `obsidian`. `TFile` must be added.
