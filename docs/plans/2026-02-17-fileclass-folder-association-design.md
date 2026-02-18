# FileClass Folder Association — Design

**Date:** 2026-02-17
**Status:** Approved

## Overview

Add an optional folder association to each FileClass. When a FileClass has a folder set:
- Adding its tag to a note automatically moves the note into that folder
- Creating a note inside that folder automatically applies the tag
- A note may not have tags for more than one folder-associated FileClass

## Data Model

Add optional `folder` to `FileClassOptions` in `src/fileClass/fileClass.ts`:

```typescript
export interface FileClassOptions {
    limit: number
    icon: string
    folder?: string          // vault-relative path, e.g. "Projects"
    parent?: FileClass
    excludes?: Array<FileClassAttribute>
    savedViews?: SavedView[]
    favoriteView?: string | null
    fieldsOrder?: Field['id'][]
}
```

Stored as frontmatter in each FileClass definition file, consistent with `limit`, `icon`, etc. Empty string or absent = unset.

Add a derived map to `FieldIndexBuilder`:

```typescript
foldersMatchingFileClasses: Map<string, FileClass>
```

Built during indexing from all FilClasses with a `folder` value set. Enables O(1) folder lookups. Only exact folder paths (not recursive subfolders).

## Settings UI

### Per-FileClass settings (`src/fileClass/views/fileClassSettingsView.ts`)

New row: **"Associated folder"** — plain text input, placeholder `folder/path`. Saving writes via `updateOptions()`. Clearing the field unsets the association.

### Global plugin settings (`MetadataMenuSettingTab`)

New toggle: **"Prompt for fileclass on new note"** (default: on). When enabled, creating a note outside any associated folder shows a modal to pick a FileClass. The disable setting is the primary escape hatch for users who create notes programmatically.

## Tag + Move Behavior

When a FileClass tag is added via `AddFileClassTagModal`:

1. Check if the note already has a tag for any folder-associated FileClass (via `foldersMatchingFileClasses` + note's existing tags). If so, filter that FileClass out of the suggestion list silently. Show a `Notice` only if the modal is opened but all folder-associated classes are already blocked — explaining the note must be manually edited.
2. After writing the tag to frontmatter, if the selected FileClass has a `folder`, call `app.fileManager.renameFile(file, newPath)` to move the note into that folder (preserving filename).

## New Note Detection

Register `vault.on("create", ...)` in `main.ts`. On each new markdown file:

1. **Parent folder is associated with a FileClass** → auto-tag using the tag-writing logic directly (no modal). Skip if the index isn't ready yet.
2. **Parent folder is not associated, and "Prompt for fileclass on new note" is enabled** → open `NewNoteFileClassModal` (a `SuggestModal`) listing only folder-associated FilClasses. On selection: tag + move. On cancel: no action.
3. **"Prompt for fileclass on new note" is disabled** → no action.

`NewNoteFileClassModal` is a new class in `src/fileClass/`, parallel to `AddFileClassTagModal`.

## Edge Cases

| Case | Behavior |
|------|----------|
| Non-markdown file created | Skip entirely |
| File created in fileclass definitions folder (`classFilesPath`) | Skip |
| Programmatic creation (Templater, QuickAdd, etc.) | Modal fires — user disables setting if unwanted |
| File created in a subfolder of an associated folder (e.g. `Projects/2024/`) | No auto-tag — only exact parent match |
| Renamed/moved file lands in an associated folder | No auto-tag — `vault.on("create")` does not fire on rename |
| Multiple FilClasses map to the same folder | Unsupported — first match wins; document in settings UI |
| Note creation before index is ready | Guard with index-initialized check; skip if not ready |
| Note already has a folder-associated tag when modal opens | Folder-associated options hidden; Notice shown explaining manual edit required |
