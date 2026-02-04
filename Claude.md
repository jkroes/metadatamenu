# Metadata Menu Plugin

## Overview

This is a fork of the [Metadata Menu](https://github.com/mdelobelle/metadatamenu) plugin for [Obsidian](https://obsidian.md/). The plugin manages note metadata (frontmatter and dataview inline fields) through context menus, modals, autocompletion, and dataview table integration. Users define typed field presets globally or per-fileClass.

## Project Structure

```
.
├── src/                    # TypeScript source (~125 files)
│   ├── fields/             # Field type system (25 types) and base classes
│   │   └── models/         # Individual field type implementations
│   ├── fileClass/          # FileClass structured data types and views
│   │   └── views/          # Table views, settings, code block views
│   ├── index/              # Field indexing and caching (FieldIndex, FieldIndexBuilder)
│   ├── commands/           # Command palette and field modifier commands
│   ├── components/         # UI components (ContextMenu, ExtraButton, etc.)
│   ├── note/               # Note parsing and metadata extraction
│   ├── settings/           # Settings UI and configuration
│   ├── db/                 # IndexedDB wrapper for caching
│   ├── suggester/          # Autocomplete/suggestion system
│   ├── options/            # Context menu options and property updates
│   ├── modals/             # Modal dialogs
│   ├── utils/              # Helpers (parser, dataviewUtils, fileUtils, etc.)
│   ├── testing/            # Built-in test runner and test suites
│   ├── assets/css/         # SCSS stylesheets (12 files)
│   ├── types/              # TypeScript type definitions
│   └── MetadataMenuApi.ts  # Public API
├── main.ts                 # Plugin entry point
├── docs/                   # MkDocs documentation (fields, fileclasses, api, etc.)
├── test-vault-mdm/         # Test Obsidian vault with fixtures
├── manifest.json           # Obsidian plugin manifest
├── package.json            # Dependencies and build scripts
├── esbuild.config.mjs      # ESBuild bundler configuration
├── tsconfig.json           # TypeScript configuration
├── styles.css              # Compiled CSS output
└── versions.json           # Version-to-Obsidian-version mapping
```

## Tech Stack

- **Language:** TypeScript 4.7, targeting ES6
- **Bundler:** ESBuild
- **CSS:** Sass/SCSS
- **Key dependencies:** Obsidian API, CodeMirror 6, `yaml`, `@popperjs/core`
- **Linting:** ESLint with `@typescript-eslint`

## Build & Development

```bash
# Development build (debug mode, source maps)
npm run dev

# Development build (no debug logging)
npm run dev:silent

# Production build (type-check + bundle)
npm run build

# Compile SCSS to styles.css
npm run build:css

# Watch SCSS changes
npm run build:css:watch

# Bump version in manifest.json and versions.json
npm run version
```

Build output (`main.js`, `styles.css`, `manifest.json`) is automatically copied to `test-vault-mdm/.obsidian/plugins/metadata-menu/` during dev builds.

The `MDM_DEBUG` flag controls debug logging; set via esbuild define.

## Testing

The plugin uses a custom built-in test runner (`src/testing/runner.ts`) that runs inside Obsidian against the test vault at `test-vault-mdm/`. Tests cover settings creation, fileClass creation, and field modal interactions. There is no CLI test harness.

## Key Concepts

- **Field types:** 25 types (Input, Boolean, Number, Select, Multi, Cycle, File, Date, Lookup, Canvas, JSON, YAML, Object, etc.) defined in `src/fields/models/`
- **FileClasses:** Structured data type definitions that assign field schemas to notes based on folder, tag, or explicit assignment. Defined in `src/fileClass/`
- **Field Index:** Caching layer (`src/index/FieldIndex.ts`) that discovers and indexes fields across the vault, backed by IndexedDB (`src/db/`)
- **Controls:** Multiple UI entry points — context menus, editor autocompletion, dataview tables, metadata buttons, modals
- **API:** `MetadataMenuApi` (`src/MetadataMenuApi.ts`) exposes `getValues()`, `fieldModifier()`, `postValues()`, etc.

## Key Resources

- [Obsidian Developer Docs](https://docs.obsidian.md/Home)
- [Obsidian Plugin Directory](https://obsidian.md/plugins)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugins)
- [Original Metadata Menu Docs](https://mdelobelle.github.io/metadatamenu)
- [Original Metadata Menu Repo](https://github.com/mdelobelle/metadatamenu)

## Notes for Claude

- Read relevant source files before proposing changes. The codebase is ~21,600 lines across 124 files.
- Field type implementations follow a consistent pattern — check an existing model in `src/fields/models/` before adding or modifying one.
- FileClass views (`src/fileClass/views/`) contain substantial UI logic including table view components with filtering and sorting.
- Settings migration logic lives in `src/settings/migrateSetting.ts` — account for it when changing settings interfaces.
- The plugin supports both YAML frontmatter and dataview inline field syntax (`field::value`). Changes to parsing must handle both.
- Optional Dataview plugin integration exists in `src/utils/dataviewUtils.ts`.
- Prefer minimal, focused changes. Don't over-engineer.
