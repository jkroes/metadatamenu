# Custom Property Value Suggestions in Obsidian

## Context

**Goal:** Customize the dropdown suggestions that appear when entering values for Obsidian properties (e.g., filter to only show files from specific folders or with specific tags).

**Problem:** Obsidian's built-in property types (Text, List, Tags) have hardcoded suggestion logic that cannot be modified using public APIs. There is no official API like `registerPropertyValueSuggester()`.

**Key Finding:** Custom property value suggestions require internal/undocumented Obsidian APIs. This guide covers two viable approaches.

---

## Internal APIs Required (Both Approaches)

### Required Package

```bash
npm install obsidian-typings
```

**Source:** [obsidian-typings](https://github.com/Fevol/obsidian-typings) provides TypeScript definitions for Obsidian's undocumented internal APIs.

### Critical Internal API

```typescript
app.metadataTypeManager.registeredTypeWidgets
```

This is an **internal registry** where Obsidian stores all property type widgets. It is **not part of the official API** and may change without warning in future Obsidian updates.

---

## Approach 1: Create Custom Property Type

### Overview

Register a completely new property type (like "Folder Select") that appears alongside Text, Number, Date, etc. in Obsidian's type dropdown.

### Required Imports

```typescript
// From "obsidian-typings" (internal APIs)
import { PropertyWidget, PropertyRenderContext } from "obsidian-typings";

// From "obsidian" (public APIs)
import { Plugin, Menu, MenuItem, TFile, TFolder, PropertyValueComponent } from "obsidian";
```

### Registration Pattern

```typescript
app.metadataTypeManager.registeredTypeWidgets["custom-type-id"] = {
    type: "custom-type-id",           // Unique identifier (must match key)
    icon: "folder",                   // Lucide icon name (see https://lucide.dev)
    name: () => "Display Name",       // Function returning display name
    validate: (value) => true,        // Validation function (return true/false or error string)
    render: renderFunction            // Render function (see below)
};
```

### PropertyRenderContext Interface

The `ctx` parameter in your render function provides:

```typescript
interface PropertyRenderContext {
    key: string;                      // Property name (e.g., "author")
    onChange: (value: unknown) => void;  // Call this when value changes
    sourcePath: string;               // Path of current file
    metadataEditor: boolean;          // true if rendering in metadata editor
    app: App;                         // App instance
}
```

### Render Function Signature

```typescript
const renderFunction: PropertyWidget["render"] = (
    el: HTMLElement,              // Container to render your UI into
    value: unknown,               // Current property value
    ctx: PropertyRenderContext    // Context object (see above)
): PropertyValueComponent => {
    // Your implementation here
    // 1. Create UI elements in 'el'
    // 2. Call ctx.onChange(newValue) when value changes
    // 3. Return PropertyValueComponent instance

    return component;
};
```

### PropertyValueComponent Return Value

The render function **must** return a `PropertyValueComponent` instance. This is used by Obsidian to track the component lifecycle and handle cleanup.

**Basic usage:**
```typescript
return new PropertyValueComponent();
```

**With cleanup (for event listeners, etc.):**
```typescript
const component = new PropertyValueComponent();
component.registerCleanup(() => {
    // Clean up event listeners, observers, etc.
});
return component;
```

### Complete Implementation Example

```typescript
import { Plugin, Menu, MenuItem, TFile, TFolder, PropertyValueComponent } from "obsidian";
import { PropertyWidget, PropertyRenderContext } from "obsidian-typings";

export default class MyPlugin extends Plugin {
    async onload() {
        // IMPORTANT: Wait for layout ready before registering
        this.app.workspace.onLayoutReady(() => {
            this.registerCustomType();
        });
    }

    registerCustomType() {
        const render: PropertyWidget["render"] = (el, value, ctx) => {
            // Create clickable select element
            const selectEl = el.createDiv({ cls: "custom-select" });
            selectEl.textContent = value?.toString() || "Select...";

            // Attach click handler
            selectEl.addEventListener("click", (event) => {  // ✅ Capture event parameter
                const menu = new Menu();

                // Get target folder
                const folder = this.app.vault.getAbstractFileByPath("MyFolder");
                if (folder instanceof TFolder) {
                    folder.children.forEach(file => {
                        if (file instanceof TFile && file.extension === "md") {
                            menu.addItem((item: MenuItem) => {
                                item.setTitle(file.basename);
                                item.onClick(() => {
                                    selectEl.textContent = file.basename;
                                    ctx.onChange(file.basename);
                                });
                            });
                        }
                    });
                }

                menu.showAtMouseEvent(event as MouseEvent);
            });

            // Return component with cleanup
            const component = new PropertyValueComponent();
            component.registerCleanup(() => {
                // Cleanup would go here if needed
            });
            return component;
        };

        // Register the custom type
        this.app.metadataTypeManager.registeredTypeWidgets["folder-select"] = {
            type: "folder-select",
            icon: "folder",                    // See https://lucide.dev for icon names
            name: () => "Folder Select",
            validate: (value) => {
                // Optional: Add validation logic
                // Return true for valid, false or error string for invalid
                return true;
            },
            render
        };
    }

    onunload() {
        // Cleanup: Remove custom type
        delete this.app.metadataTypeManager.registeredTypeWidgets["folder-select"];
    }
}
```

### Making It Configurable

Add settings to let users configure which folders to filter:

```typescript
interface MyPluginSettings {
    filterFolder: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    filterFolder: "MyFolder"
};

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        this.app.workspace.onLayoutReady(() => {
            this.registerCustomType();
        });

        this.addSettingTab(new MySettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    registerCustomType() {
        const render: PropertyWidget["render"] = (el, value, ctx) => {
            const selectEl = el.createDiv({ cls: "custom-select" });
            selectEl.textContent = value?.toString() || "Select...";

            selectEl.addEventListener("click", (event) => {
                const menu = new Menu();

                // Use configured folder
                const folder = this.app.vault.getAbstractFileByPath(this.settings.filterFolder);
                if (folder instanceof TFolder) {
                    folder.children.forEach(file => {
                        if (file instanceof TFile && file.extension === "md") {
                            menu.addItem((item: MenuItem) => {
                                item.setTitle(file.basename);
                                item.onClick(() => {
                                    selectEl.textContent = file.basename;
                                    ctx.onChange(file.basename);
                                });
                            });
                        }
                    });
                }

                menu.showAtMouseEvent(event as MouseEvent);
            });

            return new PropertyValueComponent();
        };

        this.app.metadataTypeManager.registeredTypeWidgets["folder-select"] = {
            type: "folder-select",
            icon: "folder",
            name: () => "Folder Select",
            validate: () => true,
            render
        };
    }
}
```

---

## Approach 2: Monkey-Patch Existing Property Type

### Overview

Intercept and modify the render function of existing built-in types (Text, List) to add custom suggestion logic. Less invasive than creating new types, but more fragile.

### Additional Dependency

```bash
npm install monkey-around
```

### Required Imports

```typescript
import { Plugin, AbstractInputSuggest, TFile } from "obsidian";
import { around } from "monkey-around";
```

### Pattern

```typescript
const widget = app.metadataTypeManager.registeredTypeWidgets["text"];

const uninstall = around(widget, {
    render(originalRender) {
        return function(containerEl, value, ctx) {
            // Call original to create input element
            const component = originalRender.call(this, containerEl, value, ctx);

            // Find the input element and attach custom suggestions
            const inputEl = containerEl.querySelector("input");
            if (inputEl) {
                // Attach AbstractInputSuggest here
            }

            return component;
        };
    }
});

// Register cleanup
plugin.register(uninstall);
```

### AbstractInputSuggest Lifecycle

Understanding when methods are called:

1. **User types in input** → `getSuggestions(query)` called automatically
2. **For each suggestion** → `renderSuggestion(value, el)` called to render it
3. **User selects suggestion** → `selectSuggestion(value)` called

Your `selectSuggestion` implementation should:
- Update `inputEl.value`
- Trigger input event: `inputEl.trigger("input")`
- Close the suggester: `this.close()`

### Complete Implementation Example

```typescript
import { Plugin, AbstractInputSuggest, TFile, App } from "obsidian";
import { around } from "monkey-around";

class FilteredSuggest extends AbstractInputSuggest<TFile> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        private filterFolder: string
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TFile[] {
        // Called automatically when user types
        return this.app.vault.getMarkdownFiles()
            .filter(f => f.parent?.path === this.filterFolder)
            .filter(f => f.basename.toLowerCase().includes(query.toLowerCase()));
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        // Called for each suggestion to render it
        el.setText(file.basename);
    }

    selectSuggestion(file: TFile): void {
        // Called when user selects a suggestion
        this.inputEl.value = file.basename;
        this.inputEl.trigger("input");  // Notify Obsidian of change
        this.close();                    // Close suggestion dropdown
    }
}

export default class MyPlugin extends Plugin {
    async onload() {
        this.app.workspace.onLayoutReady(() => {
            this.patchTextType();
        });
    }

    patchTextType() {
        const textWidget = this.app.metadataTypeManager.registeredTypeWidgets["text"];
        if (!textWidget) {
            console.error("Text widget not found");
            return;
        }

        const uninstall = around(textWidget, {
            render(originalRender) {
                return function(containerEl, value, ctx) {
                    // Call original render to create input
                    const component = originalRender.call(this, containerEl, value, ctx);

                    // Find the input element
                    const inputEl = containerEl.querySelector("input");

                    // Only patch specific property names
                    if (inputEl && ctx.key === "parent") {
                        new FilteredSuggest(this.app, inputEl, "People");
                    }

                    return component;
                };
            }
        });

        // Register cleanup - called when plugin unloads
        this.register(uninstall);
    }
}
```

### Configurable Property Mappings

Allow users to configure which properties get custom suggestions:

```typescript
interface PropertyMapping {
    propertyName: string;
    filterFolder: string;
}

interface MyPluginSettings {
    propertyMappings: PropertyMapping[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    propertyMappings: [
        { propertyName: "parent", filterFolder: "People" },
        { propertyName: "project", filterFolder: "Projects" }
    ]
};

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        this.app.workspace.onLayoutReady(() => {
            this.patchTextType();
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    patchTextType() {
        const textWidget = this.app.metadataTypeManager.registeredTypeWidgets["text"];
        if (!textWidget) return;

        const uninstall = around(textWidget, {
            render(originalRender) {
                return function(containerEl, value, ctx) {
                    const component = originalRender.call(this, containerEl, value, ctx);

                    const inputEl = containerEl.querySelector("input");
                    if (!inputEl) return component;

                    // Check if this property has a custom mapping
                    const mapping = this.settings.propertyMappings
                        .find(m => m.propertyName === ctx.key);

                    if (mapping) {
                        new FilteredSuggest(this.app, inputEl, mapping.filterFolder);
                    }

                    return component;
                };
            }
        });

        this.register(uninstall);
    }
}
```

---

## Approach Comparison

| Aspect | Custom Type | Monkey-Patch |
|--------|-------------|--------------|
| **Internal API usage** | Medium (PropertyWidget, registeredTypeWidgets) | Medium (registeredTypeWidgets, monkey-around) |
| **Code volume** | More (full render implementation) | Less (only modify suggestions) |
| **Stability** | More stable (you control rendering) | Less stable (depends on Obsidian's input structure) |
| **User experience** | Clear (new type in dropdown) | Transparent (modifies existing types) |
| **Maintenance** | Easier (isolated code) | Harder (coupled to Obsidian internals) |
| **Best for** | New functionality, clear boundaries | Quick prototypes, existing property names |

**Recommendation:** Use **Approach 1 (Custom Type)** for production plugins. Use **Approach 2 (Monkey-Patch)** only for prototyping or when you must preserve existing property type assignments.

---

## Key Public APIs for Filtering

```typescript
// Get all markdown files
app.vault.getMarkdownFiles(): TFile[]

// Get file or folder by path
app.vault.getAbstractFileByPath(path: string): TAbstractFile | null

// Type checking
file instanceof TFile
file instanceof TFolder

// File properties
file.parent: TFolder | null          // Parent folder
file.basename: string                // Name without extension
file.extension: string               // File extension
file.path: string                    // Full path

// Folder properties
folder.children: TAbstractFile[]     // Files and subfolders

// Get file metadata/tags
const cache = app.metadataCache.getFileCache(file);
const tags = cache?.tags;            // Tag array
const frontmatter = cache?.frontmatter;  // Frontmatter object

// AbstractInputSuggest (public API for autocomplete)
abstract class AbstractInputSuggest<T> {
    constructor(app: App, inputEl: HTMLInputElement);

    abstract getSuggestions(query: string): T[];
    abstract renderSuggestion(value: T, el: HTMLElement): void;
    abstract selectSuggestion(value: T): void;

    close(): void;  // Close the suggestion dropdown
}
```

---

## Debugging Checklist

### 1. Verify Registration Worked

```typescript
// After calling registerCustomType()
console.log(Object.keys(app.metadataTypeManager.registeredTypeWidgets));
// Should include your custom type ID
```

### 2. Test Render Function Is Called

```typescript
const render: PropertyWidget["render"] = (el, value, ctx) => {
    console.log("Render called:", ctx.key, value);  // Add this
    // ... rest of implementation
};
```

### 3. Check onChange Is Working

```typescript
ctx.onChange((newValue) => {
    console.log("Value changed:", newValue);  // Add this
});
```

### 4. Verify Suggestions Appear (Approach 2)

```typescript
getSuggestions(query: string): TFile[] {
    const results = this.app.vault.getMarkdownFiles()
        .filter(f => f.parent?.path === this.filterFolder);
    console.log("Suggestions:", results.length);  // Add this
    return results;
}
```

### 5. Check for Errors

```typescript
// Wrap registration in try-catch
try {
    this.app.metadataTypeManager.registeredTypeWidgets["custom-type-id"] = {
        // ... config
    };
    console.log("Custom type registered successfully");
} catch (err) {
    console.error("Failed to register custom type:", err);
}
```

---

## Important Notes

### Timing

⚠️ **Always wait for layout ready:**
```typescript
this.app.workspace.onLayoutReady(() => {
    // Register custom types here
});
```

Registering too early will fail because `metadataTypeManager` may not be initialized.

### Stability

⚠️ **No official API support:**
These internal APIs can break in Obsidian updates without warning. Always:
- Test thoroughly after each Obsidian update
- Add error handling around internal API access
- Provide fallback behavior when APIs change

### Cleanup

✅ **Always clean up on unload:**

**Approach 1:**
```typescript
onunload() {
    delete this.app.metadataTypeManager.registeredTypeWidgets["custom-type-id"];
}
```

**Approach 2:**
```typescript
const uninstall = around(widget, { /* ... */ });
this.register(uninstall);  // Auto-cleanup on unload
```

### TypeScript

You may need `@ts-expect-error` for some obsidian-typings imports:
```typescript
// @ts-expect-error - Internal API
import { PropertyWidget } from "obsidian-typings";
```

### Validation Function

The `validate` function is called when saving property values:

```typescript
validate: (value: unknown) => {
    // Return true if valid
    if (isValidValue(value)) return true;

    // Return false or error string if invalid
    return "Invalid value: must be a file name";
}
```

### Icons

Valid icon names come from [Lucide](https://lucide.dev):
- `"folder"` → Folder icon
- `"file"` → File icon
- `"tag"` → Tag icon
- `"link"` → Link icon

Invalid names fall back to a default icon (no error thrown).

---

## Complete Minimal Plugin Template

```typescript
import { Plugin, PropertyValueComponent, Menu, MenuItem, TFile, TFolder } from "obsidian";
import { PropertyWidget, PropertyRenderContext } from "obsidian-typings";

export default class CustomPropertyPlugin extends Plugin {
    async onload() {
        console.log("Loading Custom Property Plugin");

        this.app.workspace.onLayoutReady(() => {
            this.registerCustomType();
        });
    }

    registerCustomType() {
        const render: PropertyWidget["render"] = (el, value, ctx) => {
            const selectEl = el.createDiv({ cls: "custom-select" });
            selectEl.textContent = value?.toString() || "Select...";

            selectEl.addEventListener("click", (event) => {
                const menu = new Menu();

                const folder = this.app.vault.getAbstractFileByPath("MyFolder");
                if (folder instanceof TFolder) {
                    folder.children.forEach(file => {
                        if (file instanceof TFile && file.extension === "md") {
                            menu.addItem((item: MenuItem) => {
                                item.setTitle(file.basename);
                                item.onClick(() => {
                                    selectEl.textContent = file.basename;
                                    ctx.onChange(file.basename);
                                });
                            });
                        }
                    });
                }

                menu.showAtMouseEvent(event as MouseEvent);
            });

            return new PropertyValueComponent();
        };

        this.app.metadataTypeManager.registeredTypeWidgets["folder-select"] = {
            type: "folder-select",
            icon: "folder",
            name: () => "Folder Select",
            validate: () => true,
            render
        };

        console.log("Custom type registered");
    }

    onunload() {
        delete this.app.metadataTypeManager.registeredTypeWidgets["folder-select"];
        console.log("Custom Property Plugin unloaded");
    }
}
```

---

## Summary

Both approaches work but have different trade-offs:

- **Approach 1 (Custom Type):** More code, more stable, better UX, recommended for production
- **Approach 2 (Monkey-Patch):** Less code, more fragile, good for prototyping

Both require internal APIs from `obsidian-typings` and careful timing (`onLayoutReady`). Always test after Obsidian updates and implement proper cleanup.

## Plugins that use the internal API

[Better Properties](https://github.com/unxok/obsidian-better-properties)
[Pretty Properties](https://github.com/anareaty/pretty-properties)
