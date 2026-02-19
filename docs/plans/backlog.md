# Backlog / Future Ideas

## Urgent (affects existing users)

- **Settings migration**: `src/settings/migrateSetting.ts` was never updated after the tag-only refactor. Existing vaults with `fileClassAlias`, `globalFileClass`, `fileClassQueries` etc. in their `data.json` will silently lose those values on load. A migration step should strip the dead keys and log a notice.

- **Debug logging cleanup**: `PropertyPatchManager.ts` and likely other files have `console.log("[MDM Debug] ...")` calls that should be gated behind `MDM_DEBUG` (already used by esbuild define) or removed — they log to every user's console in production.

## Deferred from tag-only refactor

- **Auto-insert fields on tag addition**: When the user picks a FileClass from `AddFileClassTagModal`, automatically inserting the FileClass's missing fields into frontmatter would be high-value UX. Currently deferred.

- **File creation handler**: The vault `create` event handler was removed but never replaced with a tag-based equivalent (e.g. prompt to add a FileClass tag after creating a new note).

## Polish / edge cases

- **`AddFileClassTagModal` empty state**: If all FileClasses are already tagged on the active file, the modal opens with an empty list and no explanation. Add a placeholder message.

- **`resolveFileClassMatchingTags()` edge cases**: Now the sole resolution path — worth auditing for nested tags (e.g. `FileClass/variant`), case sensitivity, and tags stored as inline vs frontmatter.

## Maintenance

- **Docs**: `docs/` still describes path-based, bookmark-based, and explicit `fileClass:` frontmatter assignment mechanisms that no longer exist. Needs a rewrite.

- **Built-in tests**: `src/testing/` likely tests the old `fileClass:` frontmatter assignment path. Should be updated for the tag-only system.
