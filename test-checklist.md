## Task: Fix console errors when deleting files

### What Changed
- `src/options/updateProps.ts`:
  - Added file existence checks in `updateProps()` before building Note
  - Added file existence checks in `updatePropertiesPane()` for propView files
  - Added file existence check in `updatePropertiesSection()` for currentView file
- `src/note/note.ts`:
  - Added file existence check at start of `build()` method
  - Wrapped file read in try-catch to handle race conditions
  - Added debug logging for file read errors

### Issue Fixed
When deleting files (even ones without a fileClass), console errors occurred:
```
ENOENT: no such file or directory, open '/Users/jkroes/repos/obsidian-notes/Untitled.md'
```

**Root cause**: When a file is deleted, the vault fires a "delete" event that triggers a full re-index. During re-indexing, the plugin tries to update property editors for all open views, which attempt to read files that may have just been deleted.

**Solution**: Added existence checks before attempting to read files, and added error handling in case of race conditions where files are deleted during the read operation.

### Verification Steps
1. Build and deploy:
   ```bash
   npm run build && cp main.js manifest.json styles.css ~/repos/obsidian-notes/.obsidian/plugins/metadata-menu/
   ```
2. Open Obsidian and open the developer console (Cmd+Option+I on Mac)
3. Create a new file (with or without a fileClass)
4. Delete the file using the file explorer context menu or right-click menu
5. Check the console for errors

Expected results:
- No ENOENT errors in console when deleting files
- File deletion works normally
- No other functionality is affected

---

## Task: Fix fileClass selection bugs - COMPLETED ✓

### What Changed
- `src/fileClass/fileClass.ts`:
  - Fixed field insertion to respect `autoInsertFieldsAtFileCreation` setting ✓
  - Added duplicate filename handling with auto-incrementing ✓
  - Added pattern detection to strip Obsidian's auto-increment numbers from source filenames ✓
  - Removed debug logging ✓

### Issues Fixed
1. **Field insertion bug**: Fields now only insert when `autoInsertFieldsAtFileCreation` is enabled
2. **Filename conflicts**: Multiple files with same name can be moved to same folder
3. **Double numbering**: Clean sequential numbering (no more "Untitled 1 1.md")

### Final Test

Build and deploy:
```bash
npm run build && cp main.js manifest.json styles.css ~/repos/obsidian-notes/.obsidian/plugins/metadata-menu/
```

Expected behavior:
- Creating multiple files of same class: "Untitled.md", "Untitled 1.md", "Untitled 2.md", etc.
- Interrupting sequence with different class: Still maintains clean numbering
- Field insertion respects the setting
- All files successfully moved and associated with fileClass

### Status
✅ All issues resolved and tested successfully
