# Metadata Menu Plugin - Feature Summary

## Overview

Metadata Menu is an Obsidian plugin for managing note metadata, designed for data quality enthusiasts and Dataview users. It enables structured management of YAML frontmatter properties and Dataview inline fields (`fieldName::value` syntax).

**Plugin ID:** `metadata-menu`
**Version:** 0.8.9
**Minimum Obsidian Version:** 1.4.16

---

## Core Capabilities

### 1. Metadata Access and Editing

The plugin provides multiple interfaces for viewing and modifying metadata:

- **Context Menus:** Right-click links to edit frontmatter fields
- **Inline Editing:** Direct editing of Dataview inline fields within notes
- **Command Palette:** Access metadata operations via Obsidian's command palette
- **Extra Buttons:** UI buttons appear alongside notes in various locations (file explorer, search, backlinks, etc.)
- **Fields Modal:** Dedicated modal for viewing and editing all fields in a note
- **Properties View Integration:** Enhanced editing within Obsidian's native properties view

**Implementation Notes:**
- Context menu functionality in `src/components/ContextMenu.ts`
- Extra buttons managed by `src/components/ExtraButton.ts`
- 14+ commands registered via `src/commands/paletteCommands.ts`
- Configurable display in different panes (settings control `enableFileExplorer`, `enableSearch`, `enableProperties`, etc.)

### 2. Field Types

The plugin supports 23 distinct field types, each with specialized editing interfaces:

#### Basic Types
- **Input:** Free-text entry
- **Number:** Numeric values with optional validation
- **Boolean:** True/false toggles

#### Selection Types
- **Select:** Single-choice dropdown
- **Multi:** Multiple-choice selection
- **Cycle:** Sequential cycling through predefined values

#### Date and Time Types
- **Date:** Calendar date picker
- **DateTime:** Combined date and time selector
- **Time:** Time-only picker
- **Time-shifting features:** Support for spaced repetition and date postponing

#### File and Media Types
- **File:** Single file link
- **MultiFile:** Multiple file links
- **Media:** Single media file (images, audio, video)
- **MultiMedia:** Multiple media files

#### Canvas Types
- **Canvas:** Link to canvas files
- **CanvasGroup:** Canvas group organization
- **CanvasGroupLink:** Links between canvas groups (enables Kanban board creation)

#### Computed Types
- **Formula:** Dynamic calculations based on other field values
- **Lookup:** References to values in other notes

#### Structured Data Types
- **Object:** Nested field structures
- **ObjectList:** Arrays of nested objects
- **JSON:** Raw JSON data
- **YAML:** Raw YAML data

**Implementation Notes:**
- Field models in `src/fields/models/`
- Each type has its own modal, settings, and value management classes
- Field types defined in `src/fields/Fields.ts`
- Some types restricted to frontmatter only (`YAML`, `Object`, `ObjectList`)
- Some types restricted to root level only (`Canvas`, `CanvasGroup`, `CanvasGroupLink`, `Lookup`, `Formula`)

### 3. Field Configuration System

#### Preset Fields (Global Fields)
- Define fields globally in plugin settings
- Available across all notes in the vault
- Support for nested field structures (via `path` property)
- Optional command palette shortcuts for quick insertion

#### FileClass System
- File-specific metadata schemas
- Defined in dedicated markdown files (configurable path, default: notes in a specific folder)
- Inheritance support (via `extends` property)
- Field exclusion from parent classes (via `excludes` array)
- File-to-FileClass mapping via:
  - Tag-based association (`mapWithTag: true`)
  - Explicit tag lists (`tagNames` array)
  - File path matching (`filesPaths` array)
  - Bookmark groups (`bookmarksGroups` array)

**FileClass Options:**
- `limit`: Maximum records in table view (default: 20)
- `icon`: Custom icon for the file class (default: "package")
- `extends`: Parent file class for inheritance
- `excludes`: Fields to exclude from parent class
- `mapWithTag`: Automatic tag mapping
- `tagNames`: Specific tags to match
- `filesPaths`: File paths to match
- `bookmarksGroups`: Bookmark groups to match
- `savedViews`: Stored table view configurations
- `favoriteView`: Default view for the file class
- `fieldsOrder`: Custom field ordering

**Implementation Notes:**
- FileClass definitions in `src/fileClass/`
- Settings management in `src/settings/MetadataMenuSettings.ts`
- Preset fields stored as array in settings
- FileClass queries support folder-based and tag-based matching
- FileClass inheritance creates a hierarchy (`fileClassesAncestors` map)
- Index maintains maps of file classes by name, path, and file associations

### 4. Field Value Sources

Fields can pull values from multiple sources:

- **ValuesList:** Manually defined key-value pairs
- **Notes:** Values from other notes (for File/MultiFile types)
- **Formula:** Computed from other field values using DataviewJS expressions
- **Lookup:** References to specific fields in other notes
- **ValuesListNotePath:** Values from a list in a specific note
- **Dataview Query:** Dynamic values from Dataview query results

**Implementation Notes:**
- Source type configurations in field options
- Lookup and Formula support auto-update on dependency changes
- Commands to manually update lookups and formulas:
  - `update_all_lookups`: Update all lookups and formulas across the vault
  - `update_file_lookups`: Update active file's lookup fields
  - `update_file_formulas`: Update active file's formula fields

### 5. Field Indexing System

The plugin maintains a comprehensive index of all fields and files:

- **FieldIndex:** Central indexing system (`src/index/FieldIndex.ts`)
- Tracks:
  - All preset fields
  - All FileClass fields
  - Files associated with each FileClass
  - Fields available for each file
  - FileClass hierarchy and inheritance
- **Index Database:** Persistent storage using IndexedDB (`src/db/DatabaseManager.ts`)
- **Status Indicator:** Visual feedback on indexing status (statusbar icon)
- **Auto-indexing:** Runs on workspace ready and vault changes

**Indexing Features:**
- Configurable exclusions:
  - Folders (`fileIndexingExcludedFolders`)
  - Extensions (`fileIndexingExcludedExtensions`, default: `.excalidraw.md`)
  - Regex patterns (`fileIndexingExcludedRegex`)
- Status shown in status bar (configurable via `showIndexingStatusInStatusBar`)
- Index status component updates on file open and metadata changes

### 6. Autocompletion and Suggestions

- **Value Autosuggestion:** As you type, suggests values based on field definitions
- **Field Name Suggestions:** Suggests field names for inline fields
- **Works in:**
  - Frontmatter editor
  - Inline field syntax (`fieldName::`)
  - Note body when typing field values

**Implementation Notes:**
- Editor suggest implementation in `src/suggester/metadataSuggester.ts`
- Registered via `registerEditorSuggest()` in main plugin
- Can be toggled with `isAutosuggestEnabled` setting

### 7. Bulk Operations

#### Insert Missing Fields
- Command to bulk-insert all defined fields that don't exist in a note
- Respects FileClass definitions
- User chooses insertion location (frontmatter, specific line, as list, as blockquote)
- Optional auto-insertion when adding FileClass to file (`autoInsertFieldsAtFileClassInsertion`)

**Implementation:**
- Command: `insert_missing_fields`
- Function: `src/commands/insertMissingFields.ts`
- Modal for location selection: `src/modals/chooseSectionModal.ts`

#### Multi-target Modification
- Edit field values across multiple files simultaneously
- Confirmation modal before applying changes
- Useful for batch updates via Dataview tables

### 8. FileClass Views and Tables

#### Table View
- Display files matching a FileClass as a table
- Configurable columns (show/hide fields)
- Filtering support
- Sorting by columns
- Row limit configuration
- Save/load custom views (`savedViews`, `favoriteView`)

#### CodeBlock Views
- Embed FileClass tables in notes using `mdm` code blocks
- Dynamic updates as files change
- Custom query syntax for filtering

**Implementation Notes:**
- View manager: `src/components/FileClassViewManager.ts`
- CodeBlock processor registered for `mdm` blocks
- Table implementation: `src/fileClass/views/fileClassTableView.ts`
- Views stored in IndexedDB (`src/db/stores/fileClassViews.ts`)

### 9. Field Display Customization

Fields support visual styling:

- **Style Options:**
  - Bold
  - Italic
  - Underline
  - Code formatting
  - Highlight
  - Strikethrough

- **Multi-value Display:**
  - Array format (YAML flow style: `[a, b, c]`)
  - List format (YAML block style: each item on new line)
  - Configurable default: `frontmatterListDisplay` setting

**Implementation:**
- Style configuration in `FieldStyle` interface
- Style labels defined in `src/types/dataviewTypes.ts`
- Display format in `MultiDisplayType` enum

### 10. Integration with Dataview

The plugin has deep integration with the Dataview plugin:

- **Field Modifier:** Render editable fields in Dataview tables
  - Function: `fieldModifier(dv, p, fieldName, attrs?)`
  - Creates interactive field editors inline in Dataview results
- **Requires DataviewJS:** Plugin notifies if Dataview or DataviewJS not enabled
- **Dataview API Access:** Uses Dataview's page API for metadata reading

**Implementation:**
- Field modifier: `src/commands/fieldModifier.ts`
- Dataview types: `src/types/dataviewTypes.ts`
- Dataview utilities: `src/utils/dataviewUtils.ts`

### 11. Command Palette Integration

The plugin registers numerous commands for quick access:

#### Field Operations
- **Fields options:** Open field menu for current note
- **Manage field at cursor:** Edit field at current cursor position
- **Choose a field to insert at cursor:** Insert new field at cursor
- **Open this note's fields modal:** View all fields in dedicated modal
- **Bulk insert missing fields:** Add all undefined fields

#### FileClass Operations
- **All fileClass attributes options:** Manage fields in FileClass definition
- **Insert a new fileClass attribute:** Add new field to FileClass
- **Add fileClass to file:** Associate FileClass with current note
- **Open fileClass view:** Display FileClass table view

#### Update Operations
- **Update all lookups and formulas:** Recalculate all computed fields
- **Update active file lookups fields:** Recalculate lookups in current file
- **Update active file formulas fields:** Recalculate formulas in current file

#### Custom Field Commands
- FileClass attributes can have custom commands
- Preset fields can have custom commands
- Commands for quick field insertion with hotkeys

**Implementation:**
- Commands defined in `src/commands/paletteCommands.ts`
- Dynamic command generation for fields with custom commands
- Commands conditional based on context (FileClass file vs. regular note)

### 12. API for Developers

The plugin exposes a JavaScript API (`window.MetadataMenuAPI`) for automation and integration:

```javascript
MetadataMenuAPI.getValues(file, attribute)
MetadataMenuAPI.getValuesForIndexedPath(file, indexedPath)
MetadataMenuAPI.fileFields(file)
MetadataMenuAPI.namedFileFields(file)
MetadataMenuAPI.fieldModifier(dv, p, fieldName, attrs)
MetadataMenuAPI.insertMissingFields(file, lineNumber, asList, asBlockquote, fileClassName)
MetadataMenuAPI.postValues(file, payload, lineNumber, asList, asBlockquote)
MetadataMenuAPI.postNamedFieldsValues(file, payload, lineNumber, asList, asBlockquote)
```

**Use Cases:**
- Programmatic field value updates
- Custom automation scripts
- Integration with other plugins
- Batch processing of metadata

**Implementation:**
- API definition: `src/MetadataMenuApi.ts`
- Exposed on window object in `main.ts:44`
- Full plugin also exposed as `window.MetadataMenu` for debugging

### 13. Settings and Configuration

#### Global Settings
- **Preset Fields:** Define global field definitions
- **FileClass Queries:** Define FileClass to file mappings
- **Context Menu Display:** Toggle field display in right-click menus
- **Globally Ignored Fields:** Fields to exclude from all operations
- **Class Files Path:** Location of FileClass definition files
- **Autosuggest:** Enable/disable value autocompletion
- **FileClass Alias:** Customize the term for "fileClass" (e.g., "template", "type")

#### UI Toggles
Enable/disable buttons in different panes:
- Links pane
- Tab headers
- Editor
- Backlinks pane
- Starred pane
- File explorer
- Search pane
- Properties view

#### Indexing Configuration
- Excluded folders for FileClass discovery
- Excluded folders for file indexing
- Excluded file extensions
- Excluded files by regex pattern
- Frontmatter-only mode (ignore inline fields)
- Status bar indicator toggle

#### FileClass Behavior
- Show FileClass selector in field modal
- Prompt for FileClass at file creation
- Auto-insert fields when adding FileClass
- Custom FileClass icon

#### Misc
- First day of week (for date pickers)
- Table view record limit
- Frontmatter list display format (array vs. list)
- Auto-calculation toggle for formulas

**Implementation:**
- Settings definition: `src/settings/MetadataMenuSettings.ts`
- Settings UI: `src/settings/MetadataMenuSettingTab.ts`
- Settings migration: `src/settings/migrateSetting.ts`

---

## Architecture Overview

### Core Components

1. **Plugin Entry Point** (`main.ts`)
   - Initializes all subsystems
   - Registers commands, events, code blocks
   - Waits for workspace ready before indexing
   - Processes already-open files after initialization

2. **Field System** (`src/fields/`)
   - Field type definitions
   - Field value managers
   - Field modals and settings
   - Field validation and persistence

3. **FileClass System** (`src/fileClass/`)
   - FileClass definitions and queries
   - Inheritance and exclusion logic
   - FileClass views and tables
   - File-to-FileClass mapping

4. **Indexing System** (`src/index/`)
   - Field indexing
   - File indexing
   - FileClass hierarchy tracking
   - Persistent storage via IndexedDB

5. **Command System** (`src/commands/`)
   - Palette command registration
   - Field operations (insert, update, delete)
   - Bulk operations
   - Lookup and formula updates

6. **Component System** (`src/components/`)
   - Context menus
   - Extra buttons
   - Fields modal
   - Index status indicator
   - CodeBlock managers

7. **API Layer** (`src/MetadataMenuApi.ts`)
   - Public API for developers
   - Wrapper around core functionality

### Key Data Structures

- **Field:** Core field definition with type, options, name, ID, path, FileClass association
- **ExistingField:** Field with current value in a specific note
- **FieldManager:** Combines field definition with target file(s) and value management
- **FileClass:** Collection of field attributes with options and inheritance
- **FileClassAttribute:** Single field within a FileClass definition
- **LineNode:** Represents a field instance within a note's content

### Event Flow

1. User creates/modifies note
2. Metadata cache updates
3. Plugin indexes field changes
4. UI components update (context menus, buttons, etc.)
5. Computed fields recalculate (if auto-calculation enabled)
6. Views refresh (FileClass tables, etc.)

---

## Technical Implementation Notes

### Field Identification
- Each field has a unique 6-character alphanumeric ID
- Nested fields use path notation with `____` separator
- Indexed paths include array indices: `fieldId[0]____childId`

### Value Persistence
Fields can be stored as:
- **Frontmatter:** YAML in document header
- **Inline fields:** Dataview syntax `fieldName:: value`
- Choice determined by field type and user preference

### Nested Field Support
- Object and ObjectList types support arbitrary nesting
- Path tracking maintains hierarchy
- Indentation preserved in inline format
- Parent-child relationships enforced

### Performance Optimizations
- Lazy field initialization (fields created only when needed)
- Index caching in IndexedDB
- Debounced reindexing on rapid changes
- Selective view updates

### Compatibility
- Works with Dataview plugin (recommended, not required)
- Compatible with most Obsidian themes
- Mobile support included

---

## User Guide Quality Notes

The official documentation at https://mdelobelle.github.io/metadatamenu/ provides comprehensive coverage but has several issues:

- **Language barriers:** English may not be author's first language, leading to unclear phrasing
- **Organizational issues:** Features sometimes buried in unexpected locations
- **Missing context:** Assumes familiarity with concepts not yet explained
- **Terminology inconsistency:** Terms like "fileClass" vs "template" used interchangeably
- **Outdated sections:** Some screenshots and examples may not match current version

Despite these issues, the documentation includes helpful video tutorials and covers most features in detail.

---

## Future Exploration Topics

Based on the code, these features exist but may benefit from further documentation:

1. **Canvas integration specifics:** How Canvas, CanvasGroup, and CanvasGroupLink interact
2. **Formula syntax:** Complete reference for formula expressions
3. **Lookup configuration:** Advanced lookup patterns and performance considerations
4. **Custom field commands:** Best practices for command ID and hotkey assignment
5. **Migration system:** How settings migrate between plugin versions
6. **IndexedDB schema:** Structure of persistent storage
7. **Hook system:** Integration points for other plugins

---

## Summary

Metadata Menu is a powerful, feature-rich plugin that transforms Obsidian's metadata management. It provides:

- 23 specialized field types
- Flexible schema definition (global and per-FileClass)
- Multiple editing interfaces
- Computed fields (formulas, lookups)
- Bulk operations
- Deep Dataview integration
- Comprehensive API

The plugin is best suited for users who:
- Maintain structured knowledge bases
- Use Dataview for queries and dashboards
- Need consistent metadata across many notes
- Want to define reusable metadata schemas
- Value data quality and validation

For simple use cases, the plugin may be overkill. For complex knowledge management systems, it's an essential tool.
