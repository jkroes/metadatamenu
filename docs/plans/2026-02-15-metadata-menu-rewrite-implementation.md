# Metadata Menu Rewrite - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete rewrite of Metadata Menu plugin with custom property widget, tag-based FileClass system, and 13 field types.

**Architecture:** Five subsystems: Settings Manager, Field Type System, FileClass Resolver, Index Service (in-memory), and UI Layer with custom property widget.

**Tech Stack:** TypeScript 4.7, Obsidian API, ESBuild, React (for UI components), Dataview plugin (for Formula/Lookup fields)

---

## Overview

This implementation plan breaks down the 6-phase rewrite into bite-sized tasks. Due to the scale (3-4 weeks, ~20+ new files), this plan provides:

**Phase 1 (Core Infrastructure):** Detailed step-by-step implementation
**Phases 2-6:** Task structure and key implementation points (to be detailed during execution)

---

## Phase 1: Core Infrastructure (Week 1)

**Goal:** Plugin loads, stores settings, resolves FileClasses via tags, implements basic field types

**Deliverables:**
- Settings data model and persistence
- In-memory Index Service
- FileClass resolver with tag matching and inheritance
- Basic field types (Input, Number, Boolean)
- Plugin loads in Obsidian without errors

---

### Task 1.1: Project Setup & Clean Slate

**Goal:** Archive old code, set up fresh plugin structure

**Step 1: Archive current implementation**

```bash
# Create archive branch
git checkout -b archive/old-implementation
git push origin archive/old-implementation

# Return to master, create fresh start
git checkout master
git checkout -b feature/clean-rewrite
```

**Step 2: Clean src directory**

```bash
# Remove all existing src files (we're starting fresh)
rm -rf src/*

# Keep build configuration
# Keep: esbuild.config.mjs, tsconfig.json, package.json, manifest.json
```

**Step 3: Create new directory structure**

```bash
mkdir -p src/{types,settings,services,fields/{base,types},ui/{components,modals},utils,commands}
```

**Step 4: Update manifest.json version**

Edit `manifest.json`:
```json
{
  "id": "metadata-menu",
  "name": "Metadata Menu",
  "version": "2.0.0",
  "minAppVersion": "1.4.16",
  "description": "Manage note metadata with FileClass schemas and typed fields",
  "author": "Your Name",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean slate for metadata menu rewrite

Archive old implementation, create fresh directory structure

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Core Types & Interfaces

**Files:**
- Create: `src/types/settings.ts`
- Create: `src/types/field.ts`
- Create: `src/types/fileclass.ts`
- Create: `src/types/index.ts`

**Step 1: Define settings types**

Create `src/types/settings.ts`:

```typescript
export interface MetadataMenuSettings {
    fileClasses: FileClass[];
    presetFields: FieldDefinition[];
    showFileCreationPrompt: boolean;
    autoInsertFieldsOnClassAssignment: boolean;
    excludedFolders: string[];
    excludedExtensions: string[];
}

export const DEFAULT_SETTINGS: MetadataMenuSettings = {
    fileClasses: [],
    presetFields: [],
    showFileCreationPrompt: false,
    autoInsertFieldsOnClassAssignment: true,
    excludedFolders: [],
    excludedExtensions: ['.excalidraw.md']
};

// Re-export types for convenience
export type { FileClass } from './fileclass';
export type { FieldDefinition } from './field';
```

**Step 2: Define field types**

Create `src/types/field.ts`:

```typescript
export enum FieldType {
    Input = 'Input',
    Number = 'Number',
    Boolean = 'Boolean',
    Select = 'Select',
    File = 'File',
    Media = 'Media',
    Date = 'Date',
    DateTime = 'DateTime',
    Time = 'Time',
    Lookup = 'Lookup',
    Formula = 'Formula',
    JSON = 'JSON',
    YAML = 'YAML'
}

export interface ValidationRules {
    // Input
    minLength?: number;
    maxLength?: number;
    pattern?: string; // regex pattern

    // Number
    min?: number;
    max?: number;
    integerOnly?: boolean;

    // Date/DateTime/Time
    minDate?: string;
    maxDate?: string;
}

export interface FieldOptions {
    // Select
    selectOptions?: SelectOptions;

    // Lookup
    lookupOptions?: LookupOptions;

    // Formula
    formulaOptions?: FormulaOptions;
}

export interface SelectOptions {
    valueSource: ValueSource;
    allowCustomValues: boolean;
}

export enum ValueSourceType {
    Manual = 'Manual',
    Notes = 'Notes',
    DataviewQuery = 'DataviewQuery'
}

export interface ValueSource {
    type: ValueSourceType;
    values?: string[]; // for Manual
    query?: string; // for DataviewQuery
    tagFilter?: string; // for Notes
}

export interface LookupOptions {
    linkField: string;
    targetField: string;
}

export interface FormulaOptions {
    expression: string;
    dependencies?: string[];
}

export interface FieldDefinition {
    id: string;
    name: string;
    type: FieldType;
    allowMultiple: boolean;
    displayAsCode?: boolean; // Input only
    validation?: ValidationRules;
    options?: FieldOptions;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}
```

**Step 3: Define FileClass types**

Create `src/types/fileclass.ts`:

```typescript
import type { FieldDefinition } from './field';

export interface FileClass {
    id: string;
    name: string;
    icon: string; // lucide icon name
    tagPatterns: string[]; // e.g., ["person", "contact/*"]
    folderPath?: string;
    fields: FieldDefinition[];
    extendsId?: string;
    excludeFields?: string[]; // field IDs to exclude from parent
}
```

**Step 4: Create barrel export**

Create `src/types/index.ts`:

```typescript
export * from './settings';
export * from './field';
export * from './fileclass';
```

**Step 5: Verify types compile**

```bash
npm run build
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/types/
git commit -m "feat: add core type definitions

Define settings, field types, and FileClass interfaces

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Settings Manager

**Files:**
- Create: `src/settings/SettingsManager.ts`

**Step 1: Implement SettingsManager**

Create `src/settings/SettingsManager.ts`:

```typescript
import { Plugin } from 'obsidian';
import { MetadataMenuSettings, DEFAULT_SETTINGS } from '../types';

export class SettingsManager {
    private plugin: Plugin;
    private settings: MetadataMenuSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async load(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.plugin.loadData()
        );
    }

    async save(): Promise<void> {
        await this.plugin.saveData(this.settings);
    }

    getSettings(): MetadataMenuSettings {
        return this.settings;
    }

    updateSettings(updates: Partial<MetadataMenuSettings>): void {
        this.settings = { ...this.settings, ...updates };
    }

    // Circular inheritance detection
    detectCircularInheritance(): boolean {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (classId: string): boolean => {
            if (!visited.has(classId)) {
                visited.add(classId);
                recursionStack.add(classId);

                const fileClass = this.settings.fileClasses.find(fc => fc.id === classId);
                if (fileClass?.extendsId) {
                    if (!visited.has(fileClass.extendsId) && hasCycle(fileClass.extendsId)) {
                        return true;
                    } else if (recursionStack.has(fileClass.extendsId)) {
                        return true;
                    }
                }
            }
            recursionStack.delete(classId);
            return false;
        };

        for (const fileClass of this.settings.fileClasses) {
            if (hasCycle(fileClass.id)) {
                return true;
            }
        }
        return false;
    }
}
```

**Step 2: Build to verify**

```bash
npm run build
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/settings/
git commit -m "feat: add settings manager with persistence

Handles loading/saving settings and circular inheritance detection

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: FileClass Resolver (Tag Matching)

**Files:**
- Create: `src/services/FileClassResolver.ts`
- Create: `src/utils/tagMatcher.ts`

**Step 1: Implement tag matching utility**

Create `src/utils/tagMatcher.ts`:

```typescript
/**
 * Match a tag against a pattern (supports wildcards)
 * Pattern: "project/*" matches "project/active", "project/archive"
 * Pattern: "person" matches exactly "person"
 */
export function matchesTagPattern(tag: string, pattern: string): boolean {
    // Normalize: remove leading # if present
    const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
    const normalizedPattern = pattern.startsWith('#') ? pattern.slice(1) : pattern;

    // Exact match
    if (normalizedTag === normalizedPattern) {
        return true;
    }

    // Wildcard match: "project/*"
    if (normalizedPattern.endsWith('/*')) {
        const prefix = normalizedPattern.slice(0, -2);
        return normalizedTag.startsWith(prefix + '/');
    }

    return false;
}

/**
 * Check if any of the given tags match any of the patterns
 */
export function matchesAnyPattern(tags: string[], patterns: string[]): boolean {
    for (const tag of tags) {
        for (const pattern of patterns) {
            if (matchesTagPattern(tag, pattern)) {
                return true;
            }
        }
    }
    return false;
}
```

**Step 2: Implement FileClassResolver**

Create `src/services/FileClassResolver.ts`:

```typescript
import { App, TFile, CachedMetadata } from 'obsidian';
import { FileClass, FieldDefinition } from '../types';
import { SettingsManager } from '../settings/SettingsManager';
import { matchesAnyPattern } from '../utils/tagMatcher';

export class FileClassResolver {
    private app: App;
    private settingsManager: SettingsManager;

    constructor(app: App, settingsManager: SettingsManager) {
        this.app = app;
        this.settingsManager = settingsManager;
    }

    /**
     * Resolve FileClasses for a file based on its frontmatter tags
     */
    resolveFileClasses(file: TFile): FileClass[] {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter?.tags) {
            return [];
        }

        const tags = this.normalizeTags(metadata.frontmatter.tags);
        const fileClasses: FileClass[] = [];

        for (const fileClass of this.settingsManager.getSettings().fileClasses) {
            if (matchesAnyPattern(tags, fileClass.tagPatterns)) {
                fileClasses.push(fileClass);
            }
        }

        return fileClasses;
    }

    /**
     * Resolve all fields for a file (including inherited fields)
     */
    resolveFields(file: TFile): FieldDefinition[] {
        const fileClasses = this.resolveFileClasses(file);
        const fields: FieldDefinition[] = [];
        const fieldIds = new Set<string>();

        for (const fileClass of fileClasses) {
            const inheritedFields = this.resolveInheritedFields(fileClass);
            for (const field of inheritedFields) {
                if (!fieldIds.has(field.id)) {
                    fields.push(field);
                    fieldIds.add(field.id);
                }
            }
        }

        // Add preset fields
        const presetFields = this.settingsManager.getSettings().presetFields;
        for (const field of presetFields) {
            if (!fieldIds.has(field.id)) {
                fields.push(field);
                fieldIds.add(field.id);
            }
        }

        return fields;
    }

    /**
     * Resolve inherited fields for a FileClass (recursive)
     */
    private resolveInheritedFields(fileClass: FileClass): FieldDefinition[] {
        const fields: FieldDefinition[] = [];
        const excludedIds = new Set(fileClass.excludeFields || []);

        // Get parent fields first
        if (fileClass.extendsId) {
            const parent = this.settingsManager
                .getSettings()
                .fileClasses.find(fc => fc.id === fileClass.extendsId);
            if (parent) {
                const parentFields = this.resolveInheritedFields(parent);
                for (const field of parentFields) {
                    if (!excludedIds.has(field.id)) {
                        fields.push(field);
                    }
                }
            }
        }

        // Add own fields (override parent if same name)
        const fieldNames = new Set(fields.map(f => f.name));
        for (const field of fileClass.fields) {
            if (fieldNames.has(field.name)) {
                // Remove parent field with same name
                const index = fields.findIndex(f => f.name === field.name);
                if (index >= 0) fields.splice(index, 1);
            }
            fields.push(field);
        }

        return fields;
    }

    /**
     * Normalize tags (convert to array if string, remove # prefix)
     */
    private normalizeTags(tags: string | string[]): string[] {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        return tagArray.map(tag => (tag.startsWith('#') ? tag.slice(1) : tag));
    }
}
```

**Step 3: Build to verify**

```bash
npm run build
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/services/ src/utils/
git commit -m "feat: add FileClass resolver with tag matching

Supports wildcard patterns and recursive inheritance

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.5: Index Service (In-Memory)

**Files:**
- Create: `src/services/IndexService.ts`

**Step 1: Implement IndexService**

Create `src/services/IndexService.ts`:

```typescript
import { App, TFile, MetadataCache, Events } from 'obsidian';
import { FileClass, FieldDefinition } from '../types';
import { FileClassResolver } from './FileClassResolver';
import { SettingsManager } from '../settings/SettingsManager';

export class IndexService extends Events {
    private app: App;
    private resolver: FileClassResolver;
    private settingsManager: SettingsManager;

    // In-memory caches
    private fileClassMap: Map<string, FileClass[]> = new Map();
    private fileFieldsMap: Map<string, FieldDefinition[]> = new Map();
    private computedValuesMap: Map<string, Map<string, any>> = new Map();

    private isIndexing = false;

    constructor(
        app: App,
        resolver: FileClassResolver,
        settingsManager: SettingsManager
    ) {
        super();
        this.app = app;
        this.resolver = resolver;
        this.settingsManager = settingsManager;
    }

    /**
     * Build the index (scan all files)
     */
    async buildIndex(): Promise<void> {
        if (this.isIndexing) return;
        this.isIndexing = true;

        console.log('[MetadataMenu] Building index...');
        const startTime = Date.now();

        this.fileClassMap.clear();
        this.fileFieldsMap.clear();
        this.computedValuesMap.clear();

        const files = this.app.vault.getMarkdownFiles();
        const excludedFolders = this.settingsManager.getSettings().excludedFolders;
        const excludedExtensions = this.settingsManager.getSettings().excludedExtensions;

        for (const file of files) {
            // Skip excluded files
            if (this.shouldExcludeFile(file, excludedFolders, excludedExtensions)) {
                continue;
            }

            this.indexFile(file);
        }

        const elapsed = Date.now() - startTime;
        console.log(`[MetadataMenu] Index built in ${elapsed}ms (${files.length} files)`);

        this.isIndexing = false;
        this.trigger('index-updated');
    }

    /**
     * Update index for a single file
     */
    updateFile(file: TFile): void {
        const excludedFolders = this.settingsManager.getSettings().excludedFolders;
        const excludedExtensions = this.settingsManager.getSettings().excludedExtensions;

        if (this.shouldExcludeFile(file, excludedFolders, excludedExtensions)) {
            this.fileClassMap.delete(file.path);
            this.fileFieldsMap.delete(file.path);
            this.computedValuesMap.delete(file.path);
            return;
        }

        this.indexFile(file);
        this.trigger('file-updated', file);
    }

    /**
     * Get FileClasses for a file
     */
    getFileClasses(file: TFile): FileClass[] {
        return this.fileClassMap.get(file.path) || [];
    }

    /**
     * Get all fields for a file
     */
    getFileFields(file: TFile): FieldDefinition[] {
        return this.fileFieldsMap.get(file.path) || [];
    }

    /**
     * Get computed value for a field
     */
    getComputedValue(file: TFile, fieldId: string): any {
        return this.computedValuesMap.get(file.path)?.get(fieldId);
    }

    /**
     * Set computed value for a field
     */
    setComputedValue(file: TFile, fieldId: string, value: any): void {
        if (!this.computedValuesMap.has(file.path)) {
            this.computedValuesMap.set(file.path, new Map());
        }
        this.computedValuesMap.get(file.path)!.set(fieldId, value);
    }

    /**
     * Invalidate computed values for a file
     */
    invalidateComputedValues(file: TFile): void {
        this.computedValuesMap.delete(file.path);
    }

    /**
     * Get all files assigned to a FileClass
     */
    getFilesForFileClass(fileClassId: string): TFile[] {
        const files: TFile[] = [];
        for (const [path, fileClasses] of this.fileClassMap.entries()) {
            if (fileClasses.some(fc => fc.id === fileClassId)) {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    files.push(file);
                }
            }
        }
        return files;
    }

    private indexFile(file: TFile): void {
        const fileClasses = this.resolver.resolveFileClasses(file);
        const fields = this.resolver.resolveFields(file);

        this.fileClassMap.set(file.path, fileClasses);
        this.fileFieldsMap.set(file.path, fields);
    }

    private shouldExcludeFile(
        file: TFile,
        excludedFolders: string[],
        excludedExtensions: string[]
    ): boolean {
        // Check excluded extensions
        for (const ext of excludedExtensions) {
            if (file.path.endsWith(ext)) {
                return true;
            }
        }

        // Check excluded folders
        for (const folder of excludedFolders) {
            if (file.path.startsWith(folder + '/') || file.path === folder) {
                return true;
            }
        }

        return false;
    }
}
```

**Step 2: Build to verify**

```bash
npm run build
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/services/
git commit -m "feat: add in-memory index service

Caches file→FileClass mappings and computed field values

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.6: Basic Field Type System

**Files:**
- Create: `src/fields/base/BaseField.ts`
- Create: `src/fields/types/InputField.ts`
- Create: `src/fields/types/NumberField.ts`
- Create: `src/fields/types/BooleanField.ts`
- Create: `src/fields/FieldFactory.ts`

**Step 1: Create base field class**

Create `src/fields/base/BaseField.ts`:

```typescript
import { FieldDefinition, ValidationResult } from '../../types';

export abstract class BaseField {
    protected definition: FieldDefinition;

    constructor(definition: FieldDefinition) {
        this.definition = definition;
    }

    /**
     * Validate a value against field definition
     */
    abstract validate(value: any): ValidationResult;

    /**
     * Parse a raw value from frontmatter
     */
    abstract parse(value: any): any;

    /**
     * Format a value for display
     */
    abstract format(value: any): string;

    /**
     * Get field definition
     */
    getDefinition(): FieldDefinition {
        return this.definition;
    }
}
```

**Step 2: Implement Input field**

Create `src/fields/types/InputField.ts`:

```typescript
import { BaseField } from '../base/BaseField';
import { ValidationResult } from '../../types';

export class InputField extends BaseField {
    validate(value: any): ValidationResult {
        if (value == null || value === '') {
            return { valid: true };
        }

        const strValue = String(value);
        const validation = this.definition.validation;

        if (validation?.minLength && strValue.length < validation.minLength) {
            return {
                valid: false,
                error: `Minimum length is ${validation.minLength} characters`
            };
        }

        if (validation?.maxLength && strValue.length > validation.maxLength) {
            return {
                valid: false,
                error: `Maximum length is ${validation.maxLength} characters`
            };
        }

        if (validation?.pattern) {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(strValue)) {
                return {
                    valid: false,
                    error: 'Value does not match the required pattern'
                };
            }
        }

        return { valid: true };
    }

    parse(value: any): string | string[] {
        if (value == null) return this.definition.allowMultiple ? [] : '';
        if (Array.isArray(value)) {
            return this.definition.allowMultiple ? value.map(String) : String(value[0]);
        }
        return String(value);
    }

    format(value: any): string {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return String(value || '');
    }
}
```

**Step 3: Implement Number field**

Create `src/fields/types/NumberField.ts`:

```typescript
import { BaseField } from '../base/BaseField';
import { ValidationResult } from '../../types';

export class NumberField extends BaseField {
    validate(value: any): ValidationResult {
        if (value == null || value === '') {
            return { valid: true };
        }

        const numValue = Number(value);
        if (isNaN(numValue)) {
            return { valid: false, error: 'Value must be a number' };
        }

        const validation = this.definition.validation;

        if (validation?.min != null && numValue < validation.min) {
            return {
                valid: false,
                error: `Value must be at least ${validation.min}`
            };
        }

        if (validation?.max != null && numValue > validation.max) {
            return {
                valid: false,
                error: `Value must be at most ${validation.max}`
            };
        }

        if (validation?.integerOnly && !Number.isInteger(numValue)) {
            return { valid: false, error: 'Value must be an integer' };
        }

        return { valid: true };
    }

    parse(value: any): number | number[] {
        if (value == null) return this.definition.allowMultiple ? [] : 0;
        if (Array.isArray(value)) {
            return this.definition.allowMultiple
                ? value.map(Number)
                : Number(value[0]);
        }
        return Number(value);
    }

    format(value: any): string {
        if (Array.isArray(value)) {
            return value.map(String).join(', ');
        }
        return String(value || '');
    }
}
```

**Step 4: Implement Boolean field**

Create `src/fields/types/BooleanField.ts`:

```typescript
import { BaseField } from '../base/BaseField';
import { ValidationResult } from '../../types';

export class BooleanField extends BaseField {
    validate(value: any): ValidationResult {
        // Boolean is always valid (coerces to true/false)
        return { valid: true };
    }

    parse(value: any): boolean | boolean[] {
        if (value == null) return this.definition.allowMultiple ? [] : false;
        if (Array.isArray(value)) {
            return this.definition.allowMultiple
                ? value.map(Boolean)
                : Boolean(value[0]);
        }
        return Boolean(value);
    }

    format(value: any): string {
        if (Array.isArray(value)) {
            return value.map(v => (v ? 'true' : 'false')).join(', ');
        }
        return value ? 'true' : 'false';
    }
}
```

**Step 5: Create field factory**

Create `src/fields/FieldFactory.ts`:

```typescript
import { FieldDefinition, FieldType } from '../types';
import { BaseField } from './base/BaseField';
import { InputField } from './types/InputField';
import { NumberField } from './types/NumberField';
import { BooleanField } from './types/BooleanField';

export class FieldFactory {
    static create(definition: FieldDefinition): BaseField {
        switch (definition.type) {
            case FieldType.Input:
                return new InputField(definition);
            case FieldType.Number:
                return new NumberField(definition);
            case FieldType.Boolean:
                return new BooleanField(definition);
            // TODO: Add other field types in later phases
            default:
                throw new Error(`Unknown field type: ${definition.type}`);
        }
    }
}
```

**Step 6: Build to verify**

```bash
npm run build
```

Expected: No errors

**Step 7: Commit**

```bash
git add src/fields/
git commit -m "feat: add basic field type system

Implement Input, Number, Boolean fields with validation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.7: Plugin Entry Point

**Files:**
- Create: `src/main.ts`

**Step 1: Create main plugin class**

Create `src/main.ts`:

```typescript
import { Plugin, TFile } from 'obsidian';
import { SettingsManager } from './settings/SettingsManager';
import { FileClassResolver } from './services/FileClassResolver';
import { IndexService } from './services/IndexService';

export default class MetadataMenuPlugin extends Plugin {
    settingsManager: SettingsManager;
    resolver: FileClassResolver;
    indexService: IndexService;

    async onload() {
        console.log('[MetadataMenu] Loading plugin v2.0.0');

        // Initialize settings
        this.settingsManager = new SettingsManager(this);
        await this.settingsManager.load();

        // Initialize services
        this.resolver = new FileClassResolver(this.app, this.settingsManager);
        this.indexService = new IndexService(
            this.app,
            this.resolver,
            this.settingsManager
        );

        // Build index when workspace is ready
        this.app.workspace.onLayoutReady(() => {
            this.indexService.buildIndex();
        });

        // Listen for file changes
        this.registerEvent(
            this.app.metadataCache.on('changed', (file: TFile) => {
                this.indexService.updateFile(file);
            })
        );

        console.log('[MetadataMenu] Plugin loaded successfully');
    }

    async onunload() {
        console.log('[MetadataMenu] Unloading plugin');
    }
}
```

**Step 2: Build plugin**

```bash
npm run build
```

Expected: Builds successfully, creates `main.js`

**Step 3: Test in Obsidian**

Manual test steps:
1. Copy `main.js` and `manifest.json` to test vault plugin folder
2. Reload Obsidian
3. Check console for successful load message
4. Verify no errors

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: add plugin entry point with core services

Initializes settings, resolver, and index service

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.8: Phase 1 Testing & Verification

**Goal:** Verify Phase 1 implementation works correctly

**Step 1: Create test FileClass in settings**

Create test file: `test-vault-mdm/test-config.md`

```markdown
# Test Configuration

## Manual Test Steps

1. **Settings Persistence:**
   - Plugin loads without errors
   - Settings are created with defaults

2. **Tag Matching:**
   - Create note with tag `#person`
   - Check console: FileClass resolver identifies it
   - Create note with tag `#project/active`
   - Check console: Wildcard pattern matches

3. **Inheritance:**
   - (Will test when settings UI is ready)

4. **Index Service:**
   - Check console for index build message
   - Verify build time is reasonable
   - Change file metadata, verify incremental update

5. **Field Validation:**
   - (Will test when property widget is ready)
```

**Step 2: Manual testing**

1. Build and deploy: `npm run build && cp main.js manifest.json ~/path/to/test-vault/.obsidian/plugins/metadata-menu/`
2. Reload Obsidian
3. Check console output
4. Create test notes with tags
5. Verify index builds successfully

**Step 3: Document results**

Create `test-checklist.md`:

```markdown
## Phase 1: Core Infrastructure - Test Results

### What Changed
- Created fresh plugin structure (15 new files)
- Implemented settings manager
- Implemented FileClass resolver with tag matching
- Implemented in-memory index service
- Implemented basic field types (Input, Number, Boolean)
- Plugin entry point with service initialization

### Verification Steps
1. Build and deploy: `npm run build && cp main.js manifest.json ~/repos/obsidian-notes/.obsidian/plugins/metadata-menu/`
2. Reload Obsidian
3. Check console for "[MetadataMenu] Plugin loaded successfully"
4. Create note with frontmatter tag `#test`
5. Check console for index updates

### Expected Results
- [x] Plugin loads without errors
- [x] Index builds on workspace ready
- [x] File changes trigger index updates
- [x] No console errors

### Status
- Phase 1 COMPLETE ✓
```

**Step 4: Commit**

```bash
git add test-vault-mdm/ test-checklist.md
git commit -m "test: add Phase 1 verification checklist

Manual testing confirms core infrastructure works

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Property Widget (Week 1-2)

**Goal:** Custom property widget renders fields with suggestions and validation

**Key Tasks:**
1. Research Obsidian property widget API
2. Create custom property widget component
3. Implement field rendering for basic types
4. Add suggestion system
5. Add validation UI (inline errors)
6. Handle add/edit/delete property actions

**Files to create:**
- `src/ui/PropertyWidget.ts` - Main widget component
- `src/ui/components/FieldRenderer.ts` - Renders individual fields
- `src/ui/components/SuggestionModal.ts` - Suggestion dropdown
- `src/ui/components/ValidationError.ts` - Inline error display

**Testing:**
- Property widget appears in sidebar
- Can edit basic field types
- Validation errors show inline
- Changes save to frontmatter

---

## Phase 3: Advanced Field Types (Week 2)

**Goal:** Implement remaining field types

**Key Tasks:**
1. Select field with value sources
2. File/Media fields with vault file suggestions
3. Date/DateTime/Time fields with picker UI
4. JSON/YAML fields with syntax validation

**Files to create:**
- `src/fields/types/SelectField.ts`
- `src/fields/types/FileField.ts`
- `src/fields/types/MediaField.ts`
- `src/fields/types/DateField.ts`
- `src/fields/types/DateTimeField.ts`
- `src/fields/types/TimeField.ts`
- `src/fields/types/JSONField.ts`
- `src/fields/types/YAMLField.ts`
- `src/ui/components/DatePicker.ts`
- `src/ui/components/FileSuggester.ts`

**Testing:**
- Each field type renders correctly
- Validation works for each type
- Multi-value support works
- Select custom values work

---

## Phase 4: Computed Fields (Week 2-3)

**Goal:** Lookup and Formula fields working with on-open recalculation

**Key Tasks:**
1. Implement Lookup field type
2. Implement Formula field type
3. Add Dataview integration
4. Add dependency tracking
5. Implement on-file-open recalculation
6. Error handling for computation failures

**Files to create:**
- `src/fields/types/LookupField.ts`
- `src/fields/types/FormulaField.ts`
- `src/services/ComputedFieldService.ts`
- `src/utils/dataviewUtils.ts`

**Testing:**
- Lookup field resolves values from linked notes
- Formula field evaluates DataviewJS expressions
- Computed values cache correctly
- Errors display gracefully

---

## Phase 5: Bulk Operations & Commands (Week 3)

**Goal:** Commands for inserting missing fields and file creation prompt

**Key Tasks:**
1. Insert missing fields (current note) command
2. Insert missing fields (all instances) command
3. File creation modal
4. Folder auto-move logic
5. FileClass assignment logic

**Files to create:**
- `src/commands/InsertMissingFieldsCommand.ts`
- `src/commands/BulkInsertFieldsCommand.ts`
- `src/ui/modals/FileClassSelectionModal.ts`
- `src/ui/modals/FileClassPickerModal.ts`
- `src/services/FileClassAssigner.ts`

**Testing:**
- Insert missing fields works for one note
- Bulk insert works for all instances
- File creation prompt shows correctly
- Folder auto-move works
- Mutual exclusivity enforced

---

## Phase 6: Settings UI (Week 3-4)

**Goal:** Complete settings panel for managing FileClasses and fields

**Key Tasks:**
1. Tabbed settings layout
2. FileClass editor (list, create, edit, delete)
3. Preset field editor
4. Field configuration modal
5. Inheritance UI
6. General settings tab

**Files to create:**
- `src/settings/SettingsTab.ts`
- `src/ui/settings/FileClassList.ts`
- `src/ui/settings/FileClassEditor.ts`
- `src/ui/settings/PresetFieldList.ts`
- `src/ui/settings/FieldEditorModal.ts`
- `src/ui/settings/GeneralSettings.ts`

**Testing:**
- Can create/edit/delete FileClasses
- Can create/edit/delete preset fields
- Field configuration works for all types
- Inheritance configuration works
- Circular inheritance prevented
- Settings persist correctly

---

## Testing Strategy

### Manual Testing Checklist

After each phase, update `test-checklist.md` with:
- What was implemented
- Specific test scenarios
- Expected vs actual results
- Edge cases tested

### Test Scenarios

**FileClass Assignment:**
- [ ] Tag exact match
- [ ] Tag wildcard match (`project/*`)
- [ ] Multiple FileClasses assigned
- [ ] Folder auto-move
- [ ] Mutual exclusivity for folder-based classes

**Inheritance:**
- [ ] Simple inheritance (one level)
- [ ] Multi-level inheritance chain
- [ ] Field exclusion works
- [ ] Child overrides parent field
- [ ] Circular inheritance detected

**Field Types:**
- [ ] Input: validation (min/max length, regex)
- [ ] Number: validation (min/max, integer only)
- [ ] Boolean: toggle works
- [ ] Select: strict mode, custom values
- [ ] File/Media: file suggestions
- [ ] Date/DateTime/Time: picker UI
- [ ] JSON/YAML: syntax validation
- [ ] Lookup: resolves linked note values
- [ ] Formula: evaluates DataviewJS
- [ ] Multi-value: arrays work for all types

**Bulk Operations:**
- [ ] Insert missing fields (one note)
- [ ] Insert missing fields (all instances)
- [ ] Default values inserted correctly
- [ ] Error handling works

**Settings UI:**
- [ ] Create FileClass
- [ ] Edit FileClass
- [ ] Delete FileClass (with confirmation)
- [ ] Configure inheritance
- [ ] Create preset field
- [ ] Edit field configuration
- [ ] Delete field
- [ ] Settings persist on reload

### Performance Testing

**Index Performance:**
- Measure index build time for various vault sizes:
  - 100 files: < 50ms
  - 500 files: < 200ms
  - 1000 files: < 500ms
- Incremental update: < 5ms per file

**Property Widget Performance:**
- Field rendering: < 100ms
- Computed field calculation: < 200ms
- Suggestion display: < 50ms

---

## Documentation Tasks

After implementation, create:

1. **README.md** - Migration guide, quick start, key differences
2. **docs/field-types.md** - Reference for all 13 field types
3. **docs/fileclasses.md** - FileClass configuration guide
4. **docs/inheritance.md** - Inheritance examples
5. **docs/bulk-operations.md** - Command reference

---

## Commit Message Conventions

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `test:` - Add/update tests
- `docs:` - Documentation
- `chore:` - Maintenance tasks

Always include co-author:
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Notes for Implementation

1. **YAGNI ruthlessly** - Don't add features not in the design
2. **DRY** - Extract common patterns to utilities
3. **TDD mindset** - Validate early, validate often
4. **Frequent commits** - Commit after each task completion
5. **Manual testing** - Test in Obsidian after each phase
6. **Error handling** - Never crash Obsidian, fail gracefully
7. **Console logging** - Use `[MetadataMenu]` prefix for debugging
8. **Performance** - Monitor index build times, optimize if needed

---

## Success Criteria

Implementation is complete when:

1. ✓ Phase 1: Core infrastructure loads without errors
2. ⬜ Phase 2: Property widget renders and edits fields
3. ⬜ Phase 3: All 13 field types work with validation
4. ⬜ Phase 4: Lookup and Formula fields compute correctly
5. ⬜ Phase 5: Bulk operations and file creation work
6. ⬜ Phase 6: Settings UI is complete and intuitive
7. ⬜ All manual test scenarios pass
8. ⬜ Performance meets targets
9. ⬜ Documentation is complete
10. ⬜ Ready for user testing

---

## Next Steps After Implementation

1. User testing with real vaults
2. Bug fixes and polish
3. Performance optimization (if needed)
4. Consider IndexedDB persistence (if performance issues)
5. Consider public API (if requested)
6. Mobile testing and optimization
