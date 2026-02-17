# Property Widget Patching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Monkey-patch Obsidian's Text and List property type widgets so that MM's suggestion logic activates in the Properties panel for Select, File, Multi, and MultiFile fields.

**Architecture:** A new `PropertyPatchManager` component wraps the render functions of Obsidian's `text` and `multitext` (internal key for "List") widgets using `monkey-around`. At render time it looks up the MM field definition from `FieldIndex.filesFields` using `ctx.sourcePath` and `ctx.key`, then attaches an `AbstractInputSuggest` subclass to the rendered `<input>`. Select and File use the Text widget; Multi and MultiFile use the List widget.

**Tech Stack:** TypeScript, `monkey-around` (monkey-patching), `obsidian-typings` (internal API types), Obsidian's `AbstractInputSuggest` (public API), `getOptionsList` / `getFiles` from MM's existing abstractModels.

**Design doc:** `docs/plans/2026-02-16-property-widget-patching-design.md`

---

## Task 1: Install dependencies and verify internal widget keys

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `main.ts` (temporary debug log, removed in this task)

**Step 1: Install packages**

```bash
npm install monkey-around obsidian-typings
```

Expected: both appear in `node_modules/` and `package.json` `dependencies`.

**Step 2: Add temporary debug log to `main.ts`**

Inside `onLayoutReady`, after `await this.fieldIndex.fullIndex()` (around line 132), add:

```typescript
console.log("[MDM Debug] registeredTypeWidgets keys:", Object.keys((this.app as any).metadataTypeManager?.registeredTypeWidgets ?? {}));
```

**Step 3: Build and check in Obsidian**

```bash
npm run build && npm run build:css
```

Reload the plugin in Obsidian (Settings → Community Plugins → disable then enable). Open the developer console. You should see a log line like:

```
[MDM Debug] registeredTypeWidgets keys: ["text", "multitext", "number", "checkbox", "date", "datetime", "aliases", "tags"]
```

Note the exact key used for the List/"multitext" widget. It is almost certainly `"multitext"`, but confirm here. If it is different, substitute the correct key throughout all later tasks.

**Step 4: Remove the debug log from `main.ts`**

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add monkey-around and obsidian-typings dependencies"
```

---

## Task 2: Create `PropertyPatchManager` stub + integrate into `main.ts`

**Files:**
- Create: `src/propertyWidgets/PropertyPatchManager.ts`
- Modify: `main.ts`

The stub patches both widgets but only logs — used to confirm the patch intercepts renders before adding any suggest logic.

**Step 1: Create `src/propertyWidgets/PropertyPatchManager.ts`**

```typescript
import { Component, TFile } from "obsidian";
import { around } from "monkey-around";
import type MetadataMenu from "../../main";

export class PropertyPatchManager extends Component {
    private uninstallers: Array<() => void> = [];

    constructor(private plugin: MetadataMenu) {
        super();
    }

    onload() {
        this.patchTextWidget();
        this.patchListWidget();
    }

    onunload() {
        this.uninstallers.forEach(u => u());
        this.uninstallers = [];
    }

    private patchTextWidget() {
        const widgets = (this.plugin.app as any).metadataTypeManager?.registeredTypeWidgets;
        if (!widgets) {
            console.warn("[MetadataMenu] metadataTypeManager.registeredTypeWidgets not available — text widget patch skipped");
            return;
        }
        const textWidget = widgets["text"];
        if (!textWidget) {
            console.warn("[MetadataMenu] text widget not found — patch skipped");
            return;
        }

        const plugin = this.plugin;
        const uninstall = around(textWidget, {
            render(originalRender: Function) {
                return function(containerEl: HTMLElement, value: unknown, ctx: any) {
                    const component = originalRender.call(this, containerEl, value, ctx);
                    console.log("[MDM Debug] text render:", ctx.key, ctx.sourcePath);
                    return component;
                };
            }
        });
        this.uninstallers.push(uninstall);
    }

    private patchListWidget() {
        const widgets = (this.plugin.app as any).metadataTypeManager?.registeredTypeWidgets;
        if (!widgets) return;

        // "multitext" is the internal key for Obsidian's List property type.
        // Confirmed in Task 1 — update this key if it differed.
        const listWidget = widgets["multitext"];
        if (!listWidget) {
            console.warn("[MetadataMenu] list widget (multitext) not found — patch skipped");
            return;
        }

        const plugin = this.plugin;
        const uninstall = around(listWidget, {
            render(originalRender: Function) {
                return function(containerEl: HTMLElement, value: unknown, ctx: any) {
                    const component = originalRender.call(this, containerEl, value, ctx);
                    console.log("[MDM Debug] list render:", ctx.key, ctx.sourcePath);
                    return component;
                };
            }
        });
        this.uninstallers.push(uninstall);
    }
}
```

**Step 2: Import and instantiate in `main.ts`**

Add import near the top of `main.ts` with the other local imports:

```typescript
import { PropertyPatchManager } from "./src/propertyWidgets/PropertyPatchManager";
```

Inside the `onLayoutReady` callback (after `this.launched = true`, around line 133), add:

```typescript
this.addChild(new PropertyPatchManager(this));
```

**Step 3: Build and verify the patch fires**

```bash
npm run build && npm run build:css
```

Reload the plugin. Open a file with any properties. Open the Properties panel (right sidebar or inline). Click a text property or list property to edit it. The developer console should show the debug log lines for whichever widget type you clicked.

**Step 4: Remove the debug `console.log` lines from `PropertyPatchManager`**

(Keep the `console.warn` lines for missing widgets — those are permanent error handling.)

**Step 5: Commit**

```bash
git add src/propertyWidgets/PropertyPatchManager.ts main.ts
git commit -m "feat: add PropertyPatchManager stub patching text and list widgets"
```

---

## Task 3: Implement `SelectPropertySuggest` and wire it into the text widget patch

**Files:**
- Create: `src/propertyWidgets/suggest/SelectPropertySuggest.ts`
- Modify: `src/propertyWidgets/PropertyPatchManager.ts`

**Step 1: Check AbstractList exports**

Open `src/fields/models/abstractModels/AbstractList.ts`. Confirm:
- `getOptionsList` is exported
- There is an `Options` interface exported (or a `ListOptions` type)

If `Options` is not exported by that name, note the actual exported type name and substitute it in Step 2.

**Step 2: Create `src/propertyWidgets/suggest/SelectPropertySuggest.ts`**

```typescript
import { AbstractInputSuggest, App } from "obsidian";
import { getOptionsList } from "../../fields/models/abstractModels/AbstractList";

export class SelectPropertySuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private field: any,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): string[] {
        try {
            const options: string[] = getOptionsList(this.field);
            if (!query) return options;
            return options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
        } catch {
            return [];
        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string): void {
        this.inputEl.value = value;
        this.inputEl.trigger("input");
        this.close();
    }
}
```

**Step 3: Replace the stub render body in `patchTextWidget`**

Replace the body of the `render` function inside `around(textWidget, ...)` with:

```typescript
return function(containerEl: HTMLElement, value: unknown, ctx: any) {
    const component = originalRender.call(this, containerEl, value, ctx);

    const inputEl = containerEl.querySelector("input") as HTMLInputElement | null;
    if (!inputEl) return component;

    const fields = plugin.fieldIndex.filesFields.get(ctx.sourcePath);
    const field = fields?.find((f: any) => f.name === ctx.key);
    if (!field) return component;

    const targetFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(targetFile instanceof TFile)) return component;

    if (field.type === "Select") {
        new SelectPropertySuggest(plugin.app, inputEl, field);
    }

    return component;
};
```

Add the import at the top of `PropertyPatchManager.ts`:

```typescript
import { SelectPropertySuggest } from "./suggest/SelectPropertySuggest";
```

**Step 4: Build and test in Obsidian**

```bash
npm run build && npm run build:css
```

Reload the plugin. Open a note that has a FileClass with a Select field, or a global preset Select field. Open the Properties panel. Click the Select field's text input. Type one or two characters — the option list should appear as a dropdown. Press Enter or click an option to select it. The property value should be set.

If no MM Select fields exist in the test vault, create one:
- Open Settings → Metadata Menu → add a global preset field, type = Select, name = `status`, options = `todo, done, in-progress`
- Open any note, add a `status` property, set its Obsidian type to Text

**Step 5: Commit**

```bash
git add src/propertyWidgets/suggest/SelectPropertySuggest.ts src/propertyWidgets/PropertyPatchManager.ts
git commit -m "feat: add SelectPropertySuggest for Properties panel text widget"
```

---

## Task 4: Implement `FilePropertySuggest` and wire it into the text widget patch

**Files:**
- Create: `src/propertyWidgets/suggest/FilePropertySuggest.ts`
- Modify: `src/propertyWidgets/PropertyPatchManager.ts`

**Step 1: Check AbstractFile exports**

Open `src/fields/models/abstractModels/AbstractFile.ts`. Confirm `getFiles` is exported.

**Step 2: Create `src/propertyWidgets/suggest/FilePropertySuggest.ts`**

```typescript
import { AbstractInputSuggest, App, TFile } from "obsidian";
import { getFiles } from "../../fields/models/abstractModels/AbstractFile";

export class FilePropertySuggest extends AbstractInputSuggest<TFile> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private field: any,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TFile[] {
        try {
            const files: TFile[] = getFiles(this.field);
            if (!query) return files.slice(0, 20);
            return files.filter(f =>
                f.basename.toLowerCase().includes(query.toLowerCase())
            );
        } catch {
            return [];
        }
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.basename);
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = `[[${file.basename}]]`;
        this.inputEl.trigger("input");
        this.close();
    }
}
```

**Note:** `getFiles` accepts an `IField` or `IFieldManager`. Passing an `IField` without a `target` means dvQueryString-based file filters won't have the current file as context. This is an acceptable first-pass limitation.

**Step 3: Wire into `patchTextWidget`**

In `PropertyPatchManager.ts`, add the import:

```typescript
import { FilePropertySuggest } from "./suggest/FilePropertySuggest";
```

In the render body, extend the type switch after the `Select` branch:

```typescript
} else if (field.type === "File") {
    new FilePropertySuggest(plugin.app, inputEl, field);
}
```

**Step 4: Build and test in Obsidian**

```bash
npm run build && npm run build:css
```

Reload the plugin. Open a note with a FileClass that has a File field. Open Properties panel. Click the File field — type a filename fragment. Vault markdown files matching that fragment should appear. Selecting one inserts `[[filename]]`.

**Step 5: Commit**

```bash
git add src/propertyWidgets/suggest/FilePropertySuggest.ts src/propertyWidgets/PropertyPatchManager.ts
git commit -m "feat: add FilePropertySuggest for Properties panel text widget"
```

---

## Task 5: Implement `MultiPropertySuggest` and wire it into the list widget patch

**Files:**
- Create: `src/propertyWidgets/suggest/MultiPropertySuggest.ts`
- Modify: `src/propertyWidgets/PropertyPatchManager.ts`

**Step 1: Create `src/propertyWidgets/suggest/MultiPropertySuggest.ts`**

```typescript
import { AbstractInputSuggest, App } from "obsidian";
import { getOptionsList } from "../../fields/models/abstractModels/AbstractList";

export class MultiPropertySuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private field: any,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): string[] {
        try {
            const options: string[] = getOptionsList(this.field);
            if (!query) return options;
            return options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
        } catch {
            return [];
        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string): void {
        this.inputEl.value = value;
        this.inputEl.trigger("input");
        this.close();
    }
}
```

**Step 2: Replace the stub render body in `patchListWidget`**

Replace the render body inside `around(listWidget, ...)` with:

```typescript
return function(containerEl: HTMLElement, value: unknown, ctx: any) {
    const component = originalRender.call(this, containerEl, value, ctx);

    const inputEl = containerEl.querySelector("input") as HTMLInputElement | null;
    if (!inputEl) return component;

    const fields = plugin.fieldIndex.filesFields.get(ctx.sourcePath);
    const field = fields?.find((f: any) => f.name === ctx.key);
    if (!field) return component;

    if (field.type === "Multi") {
        new MultiPropertySuggest(plugin.app, inputEl, field);
    }

    return component;
};
```

Add the import at the top of `PropertyPatchManager.ts`:

```typescript
import { MultiPropertySuggest } from "./suggest/MultiPropertySuggest";
```

**Step 3: Build and test in Obsidian**

```bash
npm run build && npm run build:css
```

Reload the plugin. Open a note with a Multi field (a FileClass or global preset field of type Multi with a ValuesList). Open Properties panel. Click the list property and start typing a new item — the option list should appear as suggestions.

**Note on list widget input:** Obsidian's list widget renders an input for the item currently being typed. The suggest attaches to that input. If the widget re-renders (after adding an item), the patch fires again and re-attaches.

**Step 4: Commit**

```bash
git add src/propertyWidgets/suggest/MultiPropertySuggest.ts src/propertyWidgets/PropertyPatchManager.ts
git commit -m "feat: add MultiPropertySuggest for Properties panel list widget"
```

---

## Task 6: Implement `MultiFilePropertySuggest` and wire it into the list widget patch

**Files:**
- Create: `src/propertyWidgets/suggest/MultiFilePropertySuggest.ts`
- Modify: `src/propertyWidgets/PropertyPatchManager.ts`

**Step 1: Create `src/propertyWidgets/suggest/MultiFilePropertySuggest.ts`**

```typescript
import { AbstractInputSuggest, App, TFile } from "obsidian";
import { getFiles } from "../../fields/models/abstractModels/AbstractFile";

export class MultiFilePropertySuggest extends AbstractInputSuggest<TFile> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private field: any,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TFile[] {
        try {
            const files: TFile[] = getFiles(this.field);
            if (!query) return files.slice(0, 20);
            return files.filter(f =>
                f.basename.toLowerCase().includes(query.toLowerCase())
            );
        } catch {
            return [];
        }
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.basename);
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = `[[${file.basename}]]`;
        this.inputEl.trigger("input");
        this.close();
    }
}
```

**Step 2: Wire into `patchListWidget`**

Add the import:

```typescript
import { MultiFilePropertySuggest } from "./suggest/MultiFilePropertySuggest";
```

Extend the type check in the render body after the `Multi` branch:

```typescript
} else if (field.type === "MultiFile") {
    new MultiFilePropertySuggest(plugin.app, inputEl, field);
}
```

**Step 3: Build and test in Obsidian**

```bash
npm run build && npm run build:css
```

Reload the plugin. Open a note with a MultiFile field. Open Properties panel. Add an item to the list — typing a filename fragment should show vault files as suggestions. Selecting inserts `[[filename]]`.

**Step 4: Commit**

```bash
git add src/propertyWidgets/suggest/MultiFilePropertySuggest.ts src/propertyWidgets/PropertyPatchManager.ts
git commit -m "feat: add MultiFilePropertySuggest for Properties panel list widget"
```

---

## Task 7: Full integration test

No code changes — this task validates the complete feature against the test matrix from the design doc.

**Test matrix:**

| Scenario | Expected |
|---|---|
| File with FileClass → Select field | Typing in Properties panel text input shows MM option list |
| File with global preset Select field | Same |
| Select field with ValuesFromDVQuery source | Suggestions from dataview query |
| File field | File search suggestions; selecting inserts `[[filename]]` |
| Multi field | Per-item option suggestions in list input |
| MultiFile field | Per-item file search in list input |
| File with no MM fields | Properties panel identical to stock Obsidian |
| Plugin reload / disable-enable | Patches uninstalled cleanly, no doubled-up suggests on reload |

For the "plugin reload" test: disable the plugin, re-enable it, open the Properties panel — confirms `onunload` calls the uninstallers and `onload` re-registers cleanly.

If any test fails, investigate before committing. Common failure modes:
- Wrong field type string: log `field.type` and compare to `"Select"` / `"File"` / `"Multi"` / `"MultiFile"`
- Input element not found: log `containerEl.innerHTML` to inspect the DOM structure — the input selector may need adjustment
- `getOptionsList` returns empty: check the field's `sourceType` and whether the FieldIndex has indexed the options note

**Final commit (after all tests pass):**

```bash
git add -A
git commit -m "feat: property widget patching complete — Select, File, Multi, MultiFile suggestions in Properties panel"
```

---

## Reference

- Design doc: `docs/plans/2026-02-16-property-widget-patching-design.md`
- Key source files:
  - `src/fields/models/abstractModels/AbstractList.ts` — `getOptionsList()`
  - `src/fields/models/abstractModels/AbstractFile.ts` — `getFiles()`
  - `src/index/FieldIndex.ts` — `filesFields: Map<string, Field[]>`
  - `main.ts:131-152` — `onLayoutReady` callback
- External reference: [monkey-around](https://github.com/pjeby/monkey-around)
- Internal API reference: `docs/plans/custom-property-implementation-guide.md`
