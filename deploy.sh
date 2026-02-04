#!/bin/bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="$HOME/repos/obsidian-notes/.obsidian/plugins/metadata-menu"

cd "$SRC_DIR"

# Build
npm run build
npm run build:css

mkdir -p "$DEST_DIR"

# Copy build output
cp "$SRC_DIR/main.js" "$SRC_DIR/styles.css" "$SRC_DIR/manifest.json" "$DEST_DIR/"

# Merge settings: existing data.json values take priority, new defaults fill gaps
EXISTING="$DEST_DIR/data.json"
DEFAULTS="$SRC_DIR/src/settings/MetadataMenuSettings.ts"

if [ -f "$EXISTING" ]; then
    # Extract default keys and values from DEFAULT_SETTINGS in the source
    DEFAULT_JSON=$(DEFAULTS_FILE="$DEFAULTS" node <<'NODESCRIPT'
        const fs = require('fs');
        const src = fs.readFileSync(process.env.DEFAULTS_FILE, 'utf8');
        const match = src.match(/export const DEFAULT_SETTINGS[\s\S]*?=\s*(\{[\s\S]*?\n\};)/);
        if (!match) { console.log('{}'); process.exit(0); }
        let block = match[1].replace(/;$/, '');
        block = block.replace(/\/\/.*$/gm, '');
        block = block.replace(/(\w+):/g, '"$1":');
        block = block.replace(/undefined/g, 'null');
        block = block.replace(/MultiDisplayType\.\w+/g, '"asArray"');
        block = block.replace(/,(\s*[}\]])/g, '$1');
        try { JSON.parse(block); console.log(block); }
        catch(e) { console.log('{}'); }
NODESCRIPT
    )

    # Merge: defaults * (under) existing (existing wins on conflicts)
    jq -s '.[0] * .[1]' <(echo "$DEFAULT_JSON") "$EXISTING" > "$EXISTING.tmp"
    mv "$EXISTING.tmp" "$EXISTING"
    echo "Merged settings into $EXISTING"
else
    echo "No existing data.json; skipping merge"
fi

echo "Deployed to $DEST_DIR"
