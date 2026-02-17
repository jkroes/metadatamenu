# Bases Plugin Compatibility Notes

## How Bases Uses Property Types

The Bases plugin renders property values in table cells using the same
`registeredTypeWidgets` registry as the metadata editor. Each column calls the
`render` function for that property's registered type widget.

---

## Impact by Approach

### Approach 1 (Custom Type)

Low impact on existing notes — built-in types are untouched and render normally
in Bases.

For notes using the custom type, Bases will call your `render` function in the
table cell context. Simple output (text, numbers, links) should work fine.
Interactive widgets (menus, dropdowns, suggestion inputs) may break due to
constrained cell dimensions.

### Approach 2 (Monkey-Patch)

High impact. Patching `registeredTypeWidgets["text"]` affects every rendering
context, including all Bases table cells. Guard against unintended contexts
using `ctx.metadataEditor`:

```typescript
return function(containerEl, value, ctx) {
    const component = originalRender.call(this, containerEl, value, ctx);

    // Only attach suggestions in the metadata editor, not Bases cells
    if (!ctx.metadataEditor) return component;

    const inputEl = containerEl.querySelector("input");
    if (inputEl && ctx.key === "parent") {
        new FilteredSuggest(this.app, inputEl, "People");
    }

    return component;
};
```

---

## Simple Output Types

For custom types that render simple, short output (numbers, text, links), Bases
compatibility is largely a non-issue. The concern is mainly interactive widgets
that assume more space or a specific DOM context.

The remaining consideration is **inline editing in Bases cells**. If your
custom type doesn't attach a click handler that opens an inline editor, cells
will display values read-only. This may or may not be acceptable depending on
your use case.

---

## Inspecting Built-in Type Implementations

### Runtime Inspection (Developer Console)

Open the Obsidian developer console (`Cmd+Option+I` on Mac, `Ctrl+Shift+I` on
Windows/Linux):

```javascript
// See all registered type IDs
Object.keys(app.metadataTypeManager.registeredTypeWidgets)

// Inspect a specific type's render function source
app.metadataTypeManager.registeredTypeWidgets["text"].render.toString()

// Inspect the full widget object structure including all methods
console.dir(app.metadataTypeManager.registeredTypeWidgets["text"])
```

`toString()` output can be pasted into
[prettier.io/playground](https://prettier.io/playground) for readability.

### Decompiling the Obsidian App Bundle

For fuller context without minification artifacts, extract and search the
Obsidian source bundle directly.

**Locate the bundle:**

| Platform | Path |
|----------|------|
| Mac | `/Applications/Obsidian.app/Contents/Resources/app.asar` |
| Windows | `%LOCALAPPDATA%\Obsidian\resources\app.asar` |
| Linux | `/opt/Obsidian/resources/app.asar` |

**Extract it:**

```bash
npx asar extract /Applications/Obsidian.app/Contents/Resources/app.asar ./obsidian-source
```

The extracted JS is minified but searchable. Use a formatter on individual
sections, or search for known symbols like `registeredTypeWidgets` to locate
the property type rendering code.

This approach gives better context than `toString()` since you can see
surrounding code, but the output is still minified so a formatter is needed for
any non-trivial section.

---

## Open Questions

- **Full PropertyWidget interface:** It is unclear whether `PropertyWidget` has
  methods beyond `type`, `icon`, `name`, `validate`, and `render` (e.g. a
  separate click handler for inline editing). The `render` function may handle
  all interactivity, or there may be additional hooks.

- **Verification:** Check the `obsidian-typings` package for the full
  `PropertyWidget` type definition, or use `console.dir()` on a live widget
  object to see its actual shape.
