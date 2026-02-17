# Property Widget Patching Design

**Date:** 2026-02-16
**Status:** Approved

## Goal

Enhance Obsidian's Properties panel so that when a user edits a property value, Metadata Menu's suggestion logic activates — showing the correct option list, file search, or multi-item suggestions — for any property whose name matches a known MM field on that file.

## Scope

**Target MM field types:** Select, File, Multi, MultiFile
**Coverage:** Files with a FileClass assignment AND files matching global preset fields (i.e., whatever `FieldIndex.filesFields` returns for a given file path)
**Excluded for now:** Cycle (will be removed from MM later)

## Strategy

### Phase 1: Render patching

Monkey-patch the render functions of Obsidian's built-in Text and List property type widgets. After the original render creates the native `<input>` element, attach an `AbstractInputSuggest` subclass that fetches MM's option list for that property on that file.

This approach:
- Preserves existing property type assignments (no user-facing changes required)
- Keeps values stored as plain text or arrays — Obsidian Bases reads them unaffected
- Degrades gracefully: if MM has no field definition for a property, native behavior is unchanged

### Phase 2: Custom type registration (conditional)

If render patching proves insufficient for a specific field type (e.g., a UI interaction that cannot be expressed via `AbstractInputSuggest`), register a custom entry in `app.metadataTypeManager.registeredTypeWidgets` for that case only. This sacrifices Bases compatibility for those specific fields. Phase 2 is deferred until Phase 1 is validated.

## New Module: `src/propertyWidgets/`

```
src/propertyWidgets/
├── PropertyPatchManager.ts          # Component owning all patches and lifecycle
└── suggest/
    ├── SelectPropertySuggest.ts     # Suggestions for Select fields
    ├── FilePropertySuggest.ts       # File search for File fields
    ├── MultiPropertySuggest.ts      # Per-item suggestions for Multi fields
    └── MultiFilePropertySuggest.ts  # Per-item file search for MultiFile fields
```

## New Dependencies

- `monkey-around` — wraps existing render functions without replacing them
- `obsidian-typings` — TypeScript definitions for undocumented Obsidian internal APIs

## Data Flow

At plugin load (inside `onLayoutReady`), `PropertyPatchManager` wraps the render functions of the Text and List widgets. At render time, when the Properties panel opens for a file:

1. Obsidian calls the patched render
2. Patch calls the original render → native `<input>` appears in the container
3. Patch queries the container for the `<input>` element
4. Patch calls `plugin.fieldIndex.filesFields.get(ctx.sourcePath)` to get all MM fields for the file
5. Finds the field matching `ctx.key` (the property name)
6. If a matching field of a supported type is found, instantiates the appropriate suggest and attaches it to the input
7. Returns the original component

### Field type → widget → suggest mapping

| MM field type | Obsidian widget patched | Suggest class |
|---|---|---|
| Select | Text | `SelectPropertySuggest` |
| File | Text | `FilePropertySuggest` |
| Multi | List | `MultiPropertySuggest` |
| MultiFile | List | `MultiFilePropertySuggest` |

### Value format

File and MultiFile suggests insert values as `[[filename]]` wikilinks, matching MM's existing storage convention.

### Internal widget key

The Text widget key is `"text"`. The List widget key is `"list"` per the Obsidian docs, but the internal registry key may be `"multitext"` — this must be confirmed against the live registry at implementation time.

## Integration Point

`PropertyPatchManager` is added as a child component of the plugin inside `onLayoutReady()`, after FieldIndex has been built:

```typescript
this.app.workspace.onLayoutReady(() => {
    // ... existing FieldIndex build ...
    this.addChild(new PropertyPatchManager(this));
});
```

## Error Handling

All failures are silent degradations — no user-visible errors, logged to console only.

| Failure | Behavior |
|---|---|
| `app.metadataTypeManager.registeredTypeWidgets` absent | Log warning, skip all patches |
| Widget key lookup returns undefined | Log warning, skip that patch |
| `getSuggestions()` throws | Return empty array, input remains usable |
| `filesFields` returns nothing for file | No suggest attached, native behavior preserved |

## Testing

Manual testing in Obsidian against `test-vault-mdm/`. No CLI test harness exists.

| Scenario | Expected result |
|---|---|
| Properties panel on file with FileClass → Select field | Typing shows MM option list as suggestions |
| Properties panel on file with global preset Select field | Same as above |
| Select field with ValuesFromDVQuery source | Suggestions populated from dataview query |
| File field | Typing shows vault file search; selecting inserts `[[filename]]` |
| Multi field | Typing each list item shows option suggestions |
| MultiFile field | Typing each list item shows file search |
| File with no MM fields | Properties panel identical to stock Obsidian |
| FieldIndex not yet built | Properties panel identical to stock Obsidian |

## Bases Compatibility

Render patching does not register new property types and does not change how values are stored. Obsidian Bases reads plain text and array values from frontmatter directly and is unaffected. If Phase 2 (custom type registration) is later introduced for specific field types, those fields will not render correctly in Bases filters/formulas.

## Reference Implementations

- [Better Properties](https://github.com/unxok/obsidian-better-properties) — uses custom type registration; known Bases incompatibilities
- [Pretty Properties](https://github.com/anareaty/pretty-properties) — uses render patching; better Bases compatibility
- `docs/plans/custom-property-implementation-guide.md` — local research notes on both approaches
