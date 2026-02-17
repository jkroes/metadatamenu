# Tag-Only FileClass System Design

**Date:** 2026-02-17
**Status:** Approved

## Summary

Replace all FileClass assignment mechanisms (explicit frontmatter property, path-based, bookmark-based, Dataview-query-based, global fallback) with a single tag-based system. Every FileClass is identified by exactly one canonical tag — its own name. A new "Add FileClass tag" command makes it easy to assign a FileClass to a note via the command palette and right-click context menu.

---

## Section 1: FileClass → Tag Mapping

**New invariant:** Every FileClass always maps to a tag with the same name as the FileClass. No per-FileClass configuration is needed.

In `indexFileClass()` (`src/fileClass/fileClass.ts`), remove the `mapWithTag` and `tagNames` conditional branches and unconditionally register:

```ts
index.tagsMatchingFileClasses.set(fileClassName, fileClass)
```

**Removed from `FileClassOptions` interface:**
- `mapWithTag: boolean`
- `tagNames?: string[]`
- `filesPaths?: string[]`
- `bookmarksGroups?: string[]`

These properties are stripped from the interface, their parsing in `indexFileClass()`, and any FileClass settings UI that exposes them.

---

## Section 2: FieldIndex Resolution — Removed Mechanisms

The following functions are deleted from `src/index/FieldIndex.ts`:
- `getFilesFieldsFromFileClass()` — explicit `fileClass:` frontmatter property reader
- `resolveFileClassMatchingFilesPaths()` — path-based resolution
- `resolveFileClassMatchingBookmarksGroups()` — bookmark-based resolution
- `resolveFileClassQueries()` — Dataview-query-based resolution

The global FileClass fallback branch in `getFilesFields()` is removed.

**Simplified resolution order (lowest to highest):**
1. Preset fields (settings-level fallback, unchanged)
2. Tag match (via `resolveFileClassMatchingTags()`, the sole FileClass mechanism)

**Removed from `FieldIndexBuilder`:**
- `filesFieldsFromInnerFileClasses: Map<string, Field[]>`
- `filesPathsMatchingFileClasses: Map<string, FileClass>`
- `filesFieldsFromFilesPaths: Map<string, Field[]>`
- `bookmarksGroupsMatchingFileClasses: Map<string, FileClass>`
- `filesFieldsFromBookmarksGroups: Map<string, Field[]>`
- `filesFieldsFromFileClassQueries: Map<string, Field[]>`
- `fileClassQueries` collection and related bookmark-plugin references

---

## Section 3: Settings Cleanup

**Removed from `MetadataMenuSettings` interface and `DEFAULT_SETTINGS`:**
- `fileClassAlias` — frontmatter property name for explicit assignment (was `"fileClass"`)
- `chooseFileClassAtFileCreation` — prompted user to pick FileClass on file create
- `autoInsertFieldsAtFileClassInsertion` — auto-inserted missing fields on explicit assignment
- `globalFileClass` — FileClass applied to files matching no other rule
- `fileClassQueries` — array of Dataview-query-to-FileClass bindings

**Removed from `main.ts`:**
- The `vault.on("create", ...)` event handler that opened `AddFileClassToFileModal`

**Removed from `src/commands/paletteCommands.ts`:**
- The `fileClassAlias` special case in `manageFieldAtCursorCommand()` (lines 139–143) — the branch that treated the explicit frontmatter property as an editable field

**Settings tab UI controls** for the above settings are removed from `src/settings/`.

---

## Section 4: New "Add FileClass Tag" Command

### Modal

New class `AddFileClassTagModal extends SuggestModal<FileClass>` in `src/fileClass/fileClass.ts` (or alongside suggest classes in `src/propertyWidgets/suggest/`):

- `getSuggestions(query)`: returns FileClasses from `fieldIndex.fileClassesName` filtered by query, excluding any whose name is already a tag on the active file
- `onChooseSuggestion(fileClass)`: calls `app.fileManager.processFrontMatter(file, fm => { ... })` to append the FileClass name to the `tags` array; if tag already present, shows an Obsidian `Notice` instead of duplicate-inserting

### Command Palette

New function `addFileClassTagCommand()` in `src/commands/paletteCommands.ts`:
- Command id: `"add_fileclass_tag"`
- Name: `"Add fileClass tag to file"`
- `checkCallback`: active file must exist and at least one FileClass must be defined

### Context Menu

New function `addFileClassTagOption()` in `src/options/OptionsList.ts`:
- Replaces `addFileClassToFileOption()`
- Menu item title: `"Add fileClass tag to <filename>"`
- Section: `"metadata-menu-fileclass"` (unchanged)

### Deleted

- `AddFileClassToFileModal` class in `src/fileClass/fileClass.ts`
- `insertFileClassToFile()` method
- `fileclassToFileCommand()` in `src/commands/paletteCommands.ts`
- `addFileClassToFileOption()` in `src/options/OptionsList.ts`

---

## Out of Scope (Planned Later)

- Re-implementing file class selection on new file creation
- Automatic insertion of a FileClass's missing fields when a tag is added
