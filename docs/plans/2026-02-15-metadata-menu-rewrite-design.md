# Metadata Menu Plugin - Clean Rewrite Design

**Date:** 2026-02-15
**Status:** Approved
**Approach:** Clean rewrite with modern Obsidian APIs

---

## Executive Summary

Complete rewrite of the Metadata Menu plugin focusing on frontmatter-only field editing with FileClass-based schemas and smart suggestions. The rewrite simplifies the architecture by removing inline field support, table views, and external APIs while modernizing the UI with a custom property widget that replaces Obsidian's native Properties view.

**Timeline:** 3-4 weeks
**Development Phases:** 6 phases (core → UI → advanced features → settings)
**Testing:** Manual testing in test vault

---

## Core Philosophy

- **Frontmatter-only**: All fields stored in standard Obsidian YAML frontmatter
- **Clean slate**: No migration from old plugin, fresh start
- **Modern APIs**: Use Obsidian's latest property widget APIs
- **Simplicity**: Remove complexity where possible (in-memory indexing, combined field types)
- **Data quality**: Validation, type safety, smart suggestions

---

## High-Level Architecture

### Five Major Subsystems

**1. Settings Manager**
- Stores all configuration (FileClasses, preset fields, plugin options)
- Single source of truth in Obsidian's plugin settings
- Handles serialization/deserialization

**2. Field Type System**
- 13 field types (Input, Number, Boolean, Select, File, Media, Date/DateTime/Time, Lookup, Formula, JSON, YAML)
- Each type has: validator, value parser, suggestion provider
- Shared base classes for common functionality (multi-value support, validation)

**3. FileClass Resolver**
- Tag-based FileClass assignment (uses Obsidian's MetadataCache)
- Handles folder auto-move for folder-associated FileClasses
- Enforces mutual exclusivity for folder-based classes
- In-memory cache of file→FileClass mappings (rebuilt on vault load)

**4. Index Service** *(in-memory only)*
- Scans vault on load to build file→FileClass mappings
- Updates incrementally on file changes
- Caches computed field values in memory
- Auto-recalculates Lookup/Formula on file open

**5. UI Layer**
- Custom property widget (replaces native Properties view)
- Provides metadata menu suggestions instead of Obsidian defaults
- Settings panel UI
- Command palette commands
- File creation modal (optional)

**Data Flow:** Settings → Index Service → Property Widget → Field Types → Frontmatter

---

## Data Model

### Settings Schema

```typescript
interface MetadataMenuSettings {
  // FileClass definitions (all stored here now, not markdown files)
  fileClasses: FileClass[];

  // Global preset fields (available to all notes)
  presetFields: FieldDefinition[];

  // UI behavior
  showFileCreationPrompt: boolean;
  autoInsertFieldsOnClassAssignment: boolean;

  // Other options (indexing exclusions, etc.)
  excludedFolders?: string[];
  excludedExtensions?: string[];
}
```

### FileClass Structure

```typescript
interface FileClass {
  id: string;                    // unique identifier
  name: string;                  // display name
  icon: string;                  // lucide icon name
  tagPatterns: string[];         // tags that assign this class (e.g., ["person", "contact/*"])
  folderPath?: string;           // optional auto-move destination
  fields: FieldDefinition[];     // fields specific to this class

  // Inheritance
  extendsId?: string;            // parent FileClass ID
  excludeFields?: string[];      // field IDs to exclude from parent(s)
}
```

**Inheritance Resolution (recursive):**
When resolving fields for a FileClass:
1. Start with direct fields from this class
2. Walk up the parent chain (via `extendsId`)
3. Collect all inherited fields
4. Remove any fields in `excludeFields` (at any level)
5. Child fields override parent fields with same name

**Example:**
```
Base FileClass "Document"
  - fields: [title, date, tags]

FileClass "Article" extends "Document"
  - fields: [author, wordCount]
  - excludeFields: ["tags"]
  - → Effective fields: [title, date, author, wordCount]

FileClass "BlogPost" extends "Article"
  - fields: [publishedUrl]
  - excludeFields: []
  - → Effective fields: [title, date, author, wordCount, publishedUrl]
```

### Field Definition

```typescript
interface FieldDefinition {
  id: string;                    // unique identifier
  name: string;                  // property name in frontmatter
  type: FieldType;               // Input, Number, Boolean, Select, etc.
  allowMultiple: boolean;        // single vs multi-value
  displayAsCode?: boolean;       // for Input type only
  validation?: ValidationRules;  // type-specific validation
  options?: FieldOptions;        // type-specific options (e.g., Select values)
}
```

**Key Decisions:**
- FileClasses stored as array in settings (not separate files)
- Each FileClass has its own field definitions
- Preset fields are separate array (shared across all notes)
- Tag patterns support wildcards (e.g., "project/*" matches "project/active", "project/archived")

---

## Field Type System

### The 13 Field Types

**Basic Types:**
- **Input**: Free text (with optional code display styling)
- **Number**: Numeric values with min/max validation
- **Boolean**: True/false toggle
- **Select**: Single/multiple choice from predefined values (with optional custom value input)
- **Date**: Calendar date picker
- **DateTime**: Date + time picker
- **Time**: Time-only picker

**File Types:**
- **File**: Link(s) to vault files (single/multiple based on `allowMultiple`)
- **Media**: Link(s) to media files (images, audio, video)

**Advanced Types:**
- **Lookup**: References field value(s) from linked note(s)
- **Formula**: Computed via DataviewJS expression
- **JSON**: Raw JSON data with validation
- **YAML**: Raw YAML data with validation

### Base Class Hierarchy

```typescript
abstract class BaseField {
  validate(value: any): ValidationResult;
  parse(value: any): any;
  getSuggestions(context: SuggestionContext): Suggestion[];
}

class ValueField extends BaseField {
  // Input, Number, Boolean, Date, etc.
}

class SelectField extends BaseField {
  // Select type with value sources
  getValueSource(): ValueSource;
}

class ComputedField extends BaseField {
  // Lookup, Formula - read-only, auto-calculated
  compute(file: TFile): any;
}
```

**Multi-value Handling:**
All types respect the `allowMultiple` flag. When true, values stored as YAML arrays in frontmatter.

---

## Property Widget UI

### Integration Strategy

Obsidian's API allows registering custom property widgets that replace the native Properties view. We'll create a custom widget that:
- Renders in the Properties sidebar (same location as native view)
- Looks visually consistent with Obsidian's native Properties UI
- Uses metadata menu field definitions instead of Obsidian's default suggestions

### Property Rendering

For each property in the current file's frontmatter:
1. Check if a field definition exists (from FileClass or preset fields)
2. If defined: Render with our field type's custom editor + suggestions
3. If undefined: Render with basic Obsidian input (fallback)

### Adding New Properties

- Show "+ Add property" button
- When clicked, suggest:
  - Missing fields from assigned FileClass(es)
  - Preset fields not yet added
  - Custom property (free text name, defaults to Input type)

### Suggestion System

Each field type provides suggestions based on its configuration:
- **Select**: Values from configured value source (manual list, query, etc.)
- **File/Media**: Vault files matching criteria
- **Boolean**: True/False
- **Date/Time**: Calendar/time picker (not text suggestions)
- **Lookup/Formula**: Read-only, shows computed value
- **Input/Number**: No suggestions (free input)

### Visual Design

Match Obsidian's native Properties view styling:
- Same typography, spacing, colors
- Respect user's theme
- Icons for field types (consistent with Obsidian's property icons)
- Validation errors shown inline

**Storage:**
All property values stored in standard Obsidian frontmatter (YAML). No custom formats.

---

## FileClass Assignment & Resolution

### Tag-Based Assignment

When a file is opened or modified, the resolver:
1. Reads frontmatter tags from the file
2. Matches against all FileClass `tagPatterns` (supports wildcards)
3. Assigns all matching FileClasses to the file

**Tag Pattern Matching:**
- Exact match: `"person"` matches tag `#person`
- Wildcard: `"project/*"` matches `#project/active`, `#project/archive`
- Multiple patterns: FileClass can have multiple tagPatterns (any match assigns the class)

### Folder Auto-Move

When a FileClass is manually assigned (via command or file creation modal):
1. If the FileClass has a `folderPath` configured, move the file there
2. Add the FileClass's tag(s) to frontmatter
3. If `autoInsertFieldsOnClassAssignment` is enabled, insert missing fields

### Mutual Exclusivity (Folder-Based Classes)

- FileClasses with `folderPath` set are "folder-based"
- A file can only have ONE folder-based FileClass at a time
- When assigning a new folder-based class, it replaces the previous one
- Non-folder FileClasses can stack (multiple tags allowed)

**Example:**
```
FileClass "Person" - tags: ["person"], folderPath: "People"
FileClass "Contact" - tags: ["contact"], no folder
FileClass "Employee" - tags: ["employee"], folderPath: "Staff"

File with tags [person, contact]:
  → Assigned: Person (folder-based), Contact (tag-only) ✓

Assigning "Employee" to this file:
  → Removes "Person" (replaces folder-based class)
  → Keeps "Contact" (tag-only class)
  → Moves file to "Staff" folder
  → Final tags: [employee, contact]
```

---

## Index Service (In-Memory)

### What Gets Cached

```typescript
class IndexService {
  // File → FileClasses mapping
  private fileClassMap: Map<string, FileClass[]>;

  // File → All effective fields (inherited + direct)
  private fileFieldsMap: Map<string, FieldDefinition[]>;

  // Computed field values (Lookup/Formula results)
  private computedValuesMap: Map<string, Map<string, any>>;
  // Key: filePath, Value: Map<fieldId, computedValue>
}
```

### Index Rebuild (on vault load)

1. Iterate all files in vault (via `app.vault.getMarkdownFiles()`)
2. Read frontmatter tags (via `app.metadataCache`)
3. Match against FileClass tag patterns
4. Build `fileClassMap` and `fileFieldsMap`
5. Clear `computedValuesMap` (will recalculate on file open)

### Incremental Updates (on file change)

When a file's metadata changes:
1. Re-resolve FileClasses for that file only
2. Update `fileClassMap` entry
3. Rebuild `fileFieldsMap` entry (resolve inheritance)
4. Invalidate computed values for that file
5. If file is currently open, recalculate computed fields

### Computed Field Recalculation

When a file is opened in the property widget:
1. Check if file has Lookup or Formula fields
2. For each computed field:
   - Check if cached value exists and dependencies unchanged
   - If stale, recalculate and update cache
   - Display computed value (read-only)

### Performance

- Initial index build: O(n) where n = number of files
- Incremental update: O(1) per file change
- Typical vault (500 files): ~100ms initial build

---

## Lookup & Formula System

### Lookup Fields

Pull field values from linked notes.

**Configuration:**
```typescript
interface LookupOptions {
  linkField: string;        // which field contains the link (e.g., "assignedTo")
  targetField: string;      // which field to pull from linked note (e.g., "department")
  allowMultiple: boolean;   // if linkField has multiple links, return array
}
```

**Example:**
```yaml
# Project note
assignedTo: "[[John Smith]]"
department: <lookup from assignedTo.department>

# John Smith note
department: Engineering
```
→ Project's `department` Lookup displays "Engineering"

### Formula Fields

Computed using DataviewJS expressions.

**Configuration:**
```typescript
interface FormulaOptions {
  expression: string;       // DataviewJS code
  dependencies: string[];   // field names this formula depends on (optional, for optimization)
}
```

**Example:**
```yaml
price: 100
quantity: 5
total: <formula: dv.current().price * dv.current().quantity>
```
→ `total` displays 500

### Recalculation Strategy

Both Lookup and Formula fields recalculate on file open:
1. File opens in property widget
2. For each Lookup field: Resolve links, fetch target field values
3. For each Formula field: Execute expression with current file context
4. Cache results in `computedValuesMap`
5. Display as read-only in UI

### Dependency Tracking

- Lookup dependencies: Automatically track via `linkField`
- Formula dependencies: Optional manual list (for optimization)
- When a dependency changes, invalidate cached value

### Dataview Integration

**Required Dependency:**
- Dataview plugin must be installed for Formula and Lookup fields
- Formula fields use DataviewJS expressions (`dv.current()`, etc.)
- Lookup fields may use Dataview API to read field values
- Select fields can use Dataview queries as value source

**Not Included:**
- No `fieldModifier()` function for Dataview tables
- No public MetadataMenuAPI for other plugins
- No FileClass table view integration

---

## Bulk Operations

### Command 1: Insert Missing Fields (Current Note)

**Behavior:**
1. Identify all FileClasses assigned to current note
2. Collect all fields from those FileClasses (with inheritance resolved)
3. Filter to fields not yet in frontmatter
4. If multiple FileClasses have missing fields:
   - Show modal: "Select FileClasses to insert fields from"
   - User picks one or more
5. Insert selected missing fields into frontmatter with default values

**Default Values:**
- Input/Number/Select: empty
- Boolean: false
- Date/DateTime/Time: empty
- File/Media: empty
- Lookup/Formula: compute immediately
- JSON/YAML: `{}` or `[]`

### Command 2: Insert Missing Fields (All Instances of FileClass)

**Behavior:**
1. Show modal: "Select FileClass"
2. User picks a FileClass
3. Find all files assigned to that FileClass (via `fileClassMap`)
4. For each file:
   - Identify missing fields
   - Insert with default values
5. Show confirmation: "Inserted fields into X files"

**Safety:**
- Show preview: "This will insert fields into X files"
- Require explicit confirmation

---

## File Creation Flow

### Setting

`showFileCreationPrompt` (boolean, default: false)

### When Enabled

When a new file is created, show FileClass selection modal **only if** there are FileClasses with `folderPath` configured.

### Modal UI

- Title: "Assign FileClass"
- Searchable list of FileClasses that have `folderPath` set (with icons)
- No selection by default
- No buttons (Enter to confirm, Escape to dismiss)

### User Actions

- **Select + Enter**: Assign FileClass and proceed
- **Enter without selection**: Create file without FileClass
- **Escape**: Create file without FileClass

### On FileClass Selection

1. Add FileClass tag(s) to frontmatter
2. Move file to configured `folderPath`
3. If `autoInsertFieldsOnClassAssignment` is enabled, insert missing fields with defaults
4. Close modal, file is ready for editing

### When Modal Doesn't Show

- No FileClasses have `folderPath` configured → Skip modal entirely
- File created in a folder associated with a FileClass → Auto-assign that class (skip modal)

**Example Workflow:**
```
User creates "Untitled.md" in root folder
showFileCreationPrompt: true
FileClasses with folders: [Person, Project]

→ Modal shows: [Person, Project] (neither selected)
→ User selects "Person" and presses Enter
→ File moves to "People/Untitled.md"
→ Frontmatter: tags: [person], name: "", email: ""
→ Ready for editing
```

---

## Settings UI Organization

### Structure

Tabbed interface with three main sections.

### Tab 1: FileClasses

- List of all FileClasses (sortable, searchable)
- Each item shows: Icon, Name, Tag patterns, Folder (if set), Parent class (if extends)
- "Add FileClass" button at top
- Click to expand/edit:
  - Basic info (name, icon, tags, folder)
  - Inheritance (extends selector, exclude fields list)
  - Fields list (add/edit/remove/reorder)
  - Delete FileClass button (with confirmation)

### Tab 2: Preset Fields

- List of global preset fields (sortable, searchable)
- Each item shows: Name, Type
- "Add Preset Field" button at top
- Click to expand/edit:
  - Field configuration (type, validation, options)
  - Delete field button (with confirmation)

### Tab 3: General Settings

**File Creation:**
- [ ] Show FileClass prompt when creating files
- [ ] Auto-insert fields when assigning FileClass

**Indexing:**
- Excluded folders (text input, comma-separated)
- Excluded extensions (text input, comma-separated)

### Field Editor Modal

When adding/editing a field (in FileClass or Preset):
- Field name (text input)
- Field type (dropdown: Input, Number, Boolean, ...)
- Type-specific options (shown dynamically based on type):
  - Input: [ ] Display as code
  - Number: Min/max validation
  - Select: Value source configuration, [ ] Allow custom values
  - Lookup: Link field + target field
  - Formula: Expression editor
  - etc.
- [ ] Allow multiple values
- Validation rules (type-specific)

---

## Validation System

### Validation Rules by Field Type

**Input:**
- Min/max length
- Regex pattern match

**Number:**
- Min/max value
- Integer only (no decimals)

**Boolean:**
- Always valid (true/false)

**Select:**
- **Strict mode** (default): Value must be in allowed list
- **Allow custom values**: User can type free text OR select from list

**File/Media:**
- File must exist in vault
- File type validation (e.g., Media only allows image/audio/video)

**Date/DateTime/Time:**
- Valid date/time format
- Date range (not before/after specific dates)

**Lookup/Formula:**
- Expression must be valid (syntax check)
- Dependencies must exist
- Read-only (no user input validation needed)

**JSON/YAML:**
- Valid syntax (parse check)

### Select Field Configuration

```typescript
interface SelectOptions {
  valueSource: ValueSource;     // manual list, query, etc.
  allowCustomValues: boolean;   // if true, acts like combo box
  allowMultiple: boolean;       // inherited from FieldDefinition
}
```

### When Validation Runs

1. **On value change** (live validation in property widget)
2. **Before saving** (prevents saving invalid values)

### Error Display

- Show inline below field in property widget (red text)
- Example: "Invalid number: must be between 0 and 100"
- Clear error when value becomes valid

### Handling Invalid Values

- Prevent saving to frontmatter (keep field editor open)
- Show error message
- Allow user to fix or revert

---

## Error Handling

### Lookup/Formula Computation Errors

If expression fails to evaluate or linked note doesn't exist:
- Display error in field: `⚠️ Error: [error message]`
- Don't crash the UI
- Cache the error so we don't recompute on every render

### File System Errors

**Folder auto-move fails** (folder doesn't exist, permissions):
- Show notice: "Failed to move file to [folder]: [reason]"
- Keep file in current location
- Still add tags and insert fields

**File operations during bulk operations:**
- Collect all errors
- Show summary: "Completed with X errors. See details below."
- List failed files with reasons

### Index Service Errors

**File metadata is corrupted or unparseable:**
- Skip that file
- Log warning to console
- Continue indexing other files

**Entire index build fails:**
- Fall back to empty index
- Show notice: "Failed to build field index. Some features may not work."

### Settings Validation

- Prevent saving invalid settings (e.g., circular FileClass inheritance)
- Show error inline: "Cannot save: FileClass inheritance forms a cycle"
- Keep settings panel open for correction

### UI Errors

- Catch React/component errors with error boundary
- Display friendly message: "Something went wrong. Try reloading."
- Log full error to console for debugging

### General Philosophy

- Fail gracefully (never crash Obsidian)
- Show user-friendly error messages (not stack traces)
- Log detailed errors to console for debugging
- Allow partial success (e.g., bulk operations continue after individual failures)

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

- Settings manager and data model
- Index service (in-memory)
- FileClass resolver (tag matching, inheritance)
- Basic field type system (Input, Number, Boolean)

**Deliverable:** Plugin loads, resolves FileClasses, stores settings

### Phase 2: Property Widget (Week 1-2)

- Custom property widget integration
- Field rendering and editing
- Suggestion system
- Validation UI

**Deliverable:** Custom Properties view renders fields with suggestions

### Phase 3: Advanced Field Types (Week 2)

- Select (with value sources)
- File/Media types
- Date/DateTime/Time types
- JSON/YAML types

**Deliverable:** All 13 field types functional

### Phase 4: Computed Fields (Week 2-3)

- Lookup implementation
- Formula implementation
- Dependency tracking and recalculation

**Deliverable:** Lookup and Formula fields working

### Phase 5: Bulk Operations & Commands (Week 3)

- Insert missing fields commands
- File creation prompt integration
- Command palette commands

**Deliverable:** All commands functional

### Phase 6: Settings UI (Week 3-4)

- Tabbed settings panel
- FileClass editor
- Preset field editor
- Field configuration modals

**Deliverable:** Complete, polished settings UI

---

## Testing Strategy

### Manual Testing

- Test in dedicated test vault (similar to current approach)
- Create test FileClasses with various configurations
- Test files with different tag/folder combinations
- Test edge cases (circular inheritance, missing files, etc.)

### Test Scenarios

**FileClass Assignment:**
- Tag matching (exact, wildcard)
- Folder auto-move
- Mutual exclusivity for folder-based classes
- Inheritance resolution

**Field Types:**
- Each type with single/multiple values
- Validation rules (min/max, regex, etc.)
- Custom values in Select fields
- Lookup/Formula computation

**Bulk Operations:**
- Insert missing fields for one note
- Insert missing fields for all instances of class
- Error handling during bulk operations

**Settings UI:**
- Create/edit/delete FileClasses
- Create/edit/delete preset fields
- Inheritance configuration
- Field configuration for each type

### No Automated Tests Initially

Manual testing is sufficient for initial release. Add automated tests later if needed.

---

## Documentation

### README

- Migration guide from old plugin (clean break, manual reconfiguration)
- Quick start guide
- Key differences from original plugin

### Settings Reference

- Detailed explanation of each setting
- FileClass configuration options
- Field type reference

### FileClass Inheritance Examples

- Simple inheritance (one level)
- Multi-level inheritance chains
- Field exclusion patterns

### Field Type Reference

- Each of the 13 field types
- Configuration options
- Examples and use cases

---

## What's Removed from Original Plugin

### Features

- Inline field support (Dataview `fieldName:: value` syntax)
- FileClass table views
- FileClass markdown files (now in settings)
- Custom field commands (hotkeys for individual fields)
- Cycle field type (merged into Select)
- Canvas field types (Canvas, CanvasGroup, CanvasGroupLink)
- Required field validation
- Public MetadataMenuAPI for other plugins
- `fieldModifier()` for Dataview tables

### Technical

- IndexedDB persistence (using in-memory only initially)
- Inline field parsing from note bodies
- LineNode tracking
- Migration system from old plugin

---

## Success Criteria

**Plugin is successful if:**

1. Users can define FileClasses in settings with tag patterns and fields
2. Files are automatically assigned FileClasses based on tags
3. Custom property widget provides smart suggestions based on field definitions
4. All 13 field types work correctly with validation
5. Lookup and Formula fields compute correctly
6. Bulk operations work for inserting missing fields
7. File creation prompt (optional) works with folder auto-move
8. Settings UI is intuitive and easy to use
9. Performance is acceptable for typical vaults (<1000 files)
10. Error handling prevents crashes and provides helpful messages

---

## Future Enhancements (Not in Initial Release)

- IndexedDB persistence if performance becomes an issue with large vaults
- Automated tests
- Public API (if requested by users)
- Additional field types (based on user feedback)
- Import tool from old plugin (if there's demand)
- Mobile-specific optimizations

---

## Appendix: Design Decisions

### Why Clean Rewrite vs Refactor?

- Scope of changes too large (40%+ of code removed/changed)
- Moving from FileClass markdown files to settings = major data model change
- Custom property widget needs modern APIs
- Clean break allows removing technical debt
- Faster to build from scratch than untangle old code

### Why In-Memory Indexing Initially?

- Simpler architecture
- Faster startup (no DB reads)
- Always fresh data
- Sufficient for typical vaults (<1000 files)
- Can add persistence later if needed

### Why Frontmatter-Only?

- Obsidian's native property widget only works with frontmatter
- Simpler parsing (Obsidian does it for us)
- Dropping Dataview table integration removes need for inline fields
- Most users prefer frontmatter for structured data anyway

### Why Drop Table Views?

- Complex feature that adds significant UI complexity
- Users can use Dataview for querying if needed
- Focusing on core field editing experience
- Can add back later if there's demand

### Why Drop Public API?

- Simplifies architecture
- No known plugins currently depend on it
- Can add back later with stable, documented API
- Dataview integration sufficient for most use cases
