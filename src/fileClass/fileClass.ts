import { FileClassAttribute } from "./fileClassAttribute";
import MetadataMenu from "main";
import { Notice, SuggestModal, TFile } from "obsidian";
import { capitalize } from "src/utils/textUtils";
import { FieldStyleLabel } from "src/types/dataviewTypes";
import { Note } from "src/note/note";
import FieldIndex from "src/index/FieldIndex";
import { MetadataMenuSettings } from "src/settings/MetadataMenuSettings";
import { SavedView } from "./views/tableViewComponents/saveViewModal";
import { compareArrays } from "src/utils/array";
import { FieldType, FieldType as IFieldType, MultiDisplayType, fieldTypes } from "src/fields/Fields"
import { Field, getNewFieldId, FieldCommand } from "src/fields/Field";

//#region Fileclass, options

interface ShortId {
    id: string
    path: string
}

const options: Record<string, { name: string, toValue: (value: any) => any }> = {
    "limit": { name: "limit", toValue: (value: any) => value },
    "icon": { name: "icon", toValue: (value: any) => `${value || "file-spreadsheet"}` },
    "excludes": { name: "excludes", toValue: (values: FileClassAttribute[]) => values.length ? values.map(attr => attr.name) : null },
    "parent": { name: "extends", toValue: (value: FileClass) => value?.name || null },
    "savedViews": { name: "savedViews", toValue: (value: SavedView[]) => value },
    "favoriteView": { name: "favoriteView", toValue: (value?: string) => value || null },
    "fieldsOrder": { name: "fieldsOrder", toValue: (value?: Field['id'][]) => value || [] },
    "folder": { name: "folder", toValue: (value: string | undefined) => value || null }
}

export interface FileClassChild {
    name: string,
    path: string[],
    fileClass: FileClass
}

export interface FileClassOptions {
    limit: number,
    icon: string,
    parent?: FileClass;
    excludes?: Array<FileClassAttribute>;
    savedViews?: SavedView[],
    favoriteView?: string | null
    fieldsOrder?: Field['id'][]
    folder?: string
}

export class FileClassOptions {

    constructor(
        public limit: number,
        public icon: string,
        public parent?: FileClass,
        public excludes?: Array<FileClassAttribute>,
        public savedViews?: SavedView[],
        public favoriteView?: string | null,
        public fieldsOrder?: Field['id'][],
        public folder?: string
    ) {

    }
}

interface FileClass extends FileClassOptions {
    attributes: Array<FileClassAttribute>;
    errors: string[];
    options: FileClassOptions;
}

export class AddFileClassTagModal extends SuggestModal<string> {

    constructor(
        private plugin: MetadataMenu,
        private file: TFile
    ) {
        super(plugin.app)
        this.setPlaceholder("Choose a fileClass to add as a tag")
    }

    onOpen(): void {
        super.onOpen()
        const cache = this.plugin.app.metadataCache.getFileCache(this.file)
        const fmTags: string | string[] = cache?.frontmatter?.tags || []
        const fmTagArray: string[] = Array.isArray(fmTags)
            ? fmTags
            : fmTags.split(',').map((t: string) => t.trim())
        const inlineTags: string[] = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || []
        const existingTags = new Set([...fmTagArray, ...inlineTags])

        const foldersMap = this.plugin.fieldIndex.foldersMatchingFileClasses
        const folderAssociatedNames = new Set([...foldersMap.values()].map(fc => fc.name))
        const noteAlreadyHasFolderClass = [...existingTags].some(tag => folderAssociatedNames.has(tag))

        if (noteAlreadyHasFolderClass && folderAssociatedNames.size > 0) {
            new Notice("Folder-associated FileClasses are hidden. This note already has a folder FileClass — edit frontmatter directly to change it.")
        }
    }

    getSuggestions(query: string): string[] {
        const cache = this.plugin.app.metadataCache.getFileCache(this.file)
        const fmTags: string | string[] = cache?.frontmatter?.tags || []
        const fmTagArray: string[] = Array.isArray(fmTags)
            ? fmTags
            : fmTags.split(',').map((t: string) => t.trim())
        const inlineTags: string[] = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || []
        const existingTags = new Set([...fmTagArray, ...inlineTags])

        const foldersMap = this.plugin.fieldIndex.foldersMatchingFileClasses
        const folderAssociatedNames = new Set([...foldersMap.values()].map(fc => fc.name))
        const noteAlreadyHasFolderClass = [...existingTags].some(tag => folderAssociatedNames.has(tag))

        return [...this.plugin.fieldIndex.fileClassesName.keys()]
            .filter(name => !existingTags.has(name))
            .filter(name => !(noteAlreadyHasFolderClass && folderAssociatedNames.has(name)))
            .filter(name => name.toLowerCase().contains(query.toLowerCase()))
            .sort()
    }

    renderSuggestion(item: string, el: HTMLElement): void {
        el.createEl("div", { text: item })
    }

    onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
        const fileClass = this.plugin.fieldIndex.fileClassesName.get(item)
        const folder = fileClass?.getFileClassOptions().folder

        this.plugin.app.fileManager.processFrontMatter(this.file, (fm) => {
            const tags = fm["tags"]
            if (!tags) {
                fm["tags"] = [item]
            } else if (Array.isArray(tags)) {
                if (!tags.includes(item)) tags.push(item)
            } else {
                const tagArray = String(tags).split(',').map((t: string) => t.trim())
                if (!tagArray.includes(item)) fm["tags"] = [...tagArray, item]
            }
        }).then(() => {
            if (folder) {
                const newPath = `${folder}/${this.file.name}`
                if (this.file.path !== newPath) {
                    this.plugin.app.fileManager.renameFile(this.file, newPath)
                        .catch((err) => new Notice(`Failed to move file: ${err.message}`))
                }
            }
        }).catch((err) => new Notice(`Failed to update frontmatter: ${err.message}`))
    }
}

export class NewNoteFileClassModal extends SuggestModal<string> {

    constructor(
        private plugin: MetadataMenu,
        private file: TFile
    ) {
        super(plugin.app)
        this.setPlaceholder("Choose a FileClass for this new note")
    }

    getSuggestions(query: string): string[] {
        const foldersMap = this.plugin.fieldIndex.foldersMatchingFileClasses
        return [...foldersMap.values()]
            .map(fc => fc.name)
            .filter(name => name.toLowerCase().contains(query.toLowerCase()))
            .sort()
    }

    renderSuggestion(item: string, el: HTMLElement): void {
        el.createEl("div", { text: item })
    }

    onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
        const fileClass = this.plugin.fieldIndex.fileClassesName.get(item)
        const folder = fileClass?.getFileClassOptions().folder

        this.plugin.app.fileManager.processFrontMatter(this.file, (fm) => {
            const tags = fm["tags"]
            if (!tags) {
                fm["tags"] = [item]
            } else if (Array.isArray(tags)) {
                if (!tags.includes(item)) tags.push(item)
            } else {
                const tagArray = String(tags).split(',').map((t: string) => t.trim())
                if (!tagArray.includes(item)) fm["tags"] = [...tagArray, item]
            }
        }).then(() => {
            if (folder) {
                const newPath = `${folder}/${this.file.name}`
                if (this.file.path !== newPath) {
                    this.plugin.app.fileManager.renameFile(this.file, newPath)
                        .catch((err) => new Notice(`Failed to move file: ${err.message}`))
                }
            }
        }).catch((err) => new Notice(`Failed to update frontmatter: ${err.message}`))
    }
}

class FileClass {
    constructor(public plugin: MetadataMenu, public name: string) {
        this.attributes = [];
    }

    public getFileClassOptions(): FileClassOptions {
        const {
            extends: _parent,
            limit: _limit,
            excludes: _excludes,
            icon: _icon,
            savedViews: _savedViews,
            favoriteView: _favoriteView,
            fieldsOrder: _fieldsOrder,
            folder: _folder
        } = this.plugin.app.metadataCache.getFileCache(this.getClassFile())?.frontmatter as Record<string, any> || {}
        const index = this.plugin.fieldIndex
        const parent = index.fileClassesName.get(_parent);
        const excludedNames = getExcludedFieldsFromFrontmatter(_excludes);

        const excludes: FileClassAttribute[] = []
        index.fileClassesAncestors.get(this.getClassFile().basename)?.forEach(ancestorName => {
            index.fileClassesName.get(ancestorName)?.attributes.forEach(attr => {
                if (excludedNames.includes(attr.name) && !excludes.map(attr => attr.name).includes(attr.name)) excludes.push(attr)
            })
        })
        const limit = typeof (_limit) === 'number' ? _limit : this.plugin.settings.tableViewMaxRecords
        const icon = typeof (_icon) === 'string' ? _icon : this.plugin.settings.fileClassIcon
        const savedViews: SavedView[] = _savedViews || [];
        const favoriteView: string | null = (typeof _favoriteView === "string" && _favoriteView !== "") ? _favoriteView : null
        const fieldsOrder: Field['id'][] = _fieldsOrder || []
        const folder: string | undefined = typeof _folder === "string" && _folder !== "" ? _folder : undefined
        return new FileClassOptions(limit, icon, parent, excludes, savedViews, favoriteView, fieldsOrder, folder);
    }

    public getClassFile(): TFile {
        const filesClassPath = this.plugin.settings.classFilesPath;
        const file = this.plugin.app.vault.getAbstractFileByPath(`${filesClassPath}${this.name}.md`);
        if (file instanceof TFile && file.extension == "md") {
            return file;
        } else {
            const error = new Error(
                `no file named <${this.name}.md> in <${filesClassPath}> folder`
            );
            throw error;
        }
    }

    public getIcon(): string {
        const parents = [this.name, ...this.plugin.fieldIndex.fileClassesAncestors.get(this.name) || []]
        let icon: string | undefined;
        parents.some((fileClassName, i) => {
            const fileClass = this.plugin.fieldIndex.fileClassesName.get(fileClassName)
            if (fileClass) {
                const file = fileClass.getClassFile();
                const _icon = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.icon
                if (_icon) {
                    icon = _icon
                    return true;
                };
            }
        })
        return icon || this.plugin.settings.fileClassIcon
    }

    public async missingFieldsForFileClass(file: TFile): Promise<boolean> {

        const note = await Note.buildNote(this.plugin, file)
        const currentFieldsIds: string[] = note.existingFields.map(_f => _f.field.id)

        const missingFields = this && file ?
            !this.plugin.fieldIndex.fileClassesFields.get(this.name)?.map(f => f.id).every(id => currentFieldsIds.includes(id)) :
            false
        return missingFields
    }

    public moveField(thisId: string, direction: "upwards" | "downwards") {
        const thisPath = getFileClassAttributes(this.plugin, this).find(attr => attr.id === thisId)?.path
        const sortedPaths: ShortId[] = []
        for (const attr of buildSortedAttributes(this.plugin, this)) {
            sortedPaths.push({ id: attr.id, path: attr.getField().path })
        }
        const compareShortId = (a: ShortId) => a.id === thisId && a.path === thisPath
        const thisIndex = sortedPaths.findIndex(compareShortId)
        let newIndex = thisIndex
        const testPath = (j: number) => {
            if (sortedPaths[j].path === thisPath) {
                newIndex = j;
                return true
            }
            return false
        }
        if (direction === "upwards" && thisIndex > 0) {
            for (let j = thisIndex - 1; j >= 0; j--) if (testPath(j)) break
        } else if (direction === "downwards" && thisIndex < sortedPaths.length) {
            for (let j = thisIndex + 1; j < sortedPaths.length; j++) if (testPath(j)) break
        }
        [sortedPaths[thisIndex], sortedPaths[newIndex]] = [sortedPaths[newIndex], sortedPaths[thisIndex]]
        this.options.fieldsOrder = sortedPaths.map(p => p.id)
        this.updateOptions(this.options)
    }

    public getViewChildren(name?: string): FileClassChild[] {
        if (!name) return []
        const childrenNames = this.getFileClassOptions().savedViews?.find(_view => _view.name === name)?.children || []
        return this.getChildren().filter(c => childrenNames.includes(c.name))
    }


    public getAttributes(): void {
        try {
            const file = this.getClassFile();
            const ancestors = this.plugin.fieldIndex.fileClassesAncestors.get(this.name);
            const _excludedFields = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.excludes
            let excludedFields = getExcludedFieldsFromFrontmatter(_excludedFields);

            const ancestorsAttributes: Map<string, FileClassAttribute[]> = new Map();
            ancestorsAttributes.set(this.name, getFileClassAttributes(this.plugin, this, excludedFields))

            ancestors?.forEach(ancestorName => {
                const ancestorFile = this.plugin.app.vault.getAbstractFileByPath(`${this.plugin.settings.classFilesPath}${ancestorName}.md`)
                const ancestor = new FileClass(this.plugin, ancestorName);
                ancestorsAttributes.set(ancestorName, getFileClassAttributes(this.plugin, ancestor, excludedFields))
                if (ancestorFile instanceof TFile && ancestorFile.extension === "md") {
                    const _excludedFields = this.plugin.app.metadataCache.getFileCache(ancestorFile)?.frontmatter?.excludes
                    excludedFields.push(...getExcludedFieldsFromFrontmatter(_excludedFields));
                }
            })
            for (const [fileClassName, fileClassAttributes] of ancestorsAttributes) {
                this.attributes.push(...fileClassAttributes.filter(attr => !this.attributes.map(_attr => _attr.name).includes(attr.name)))
            }
        } catch (error) {
            throw (error);
        }
    }

    public getVersion(): string | undefined {
        return this.plugin.app.metadataCache.getFileCache(this.getClassFile())?.frontmatter?.version
    }

    public getMajorVersion(): number | undefined {
        const version = this.getVersion();
        if (version) {
            //in v1 of fileClass, version was a number; in newer versions it is a string x.y
            const [x, y] = `${version}`.split(".")
            if (!y) return undefined
            return parseInt(x)
        } else {
            return undefined
        }
    }

    private async incrementVersion(): Promise<void> {
        const file = this.getClassFile()
        const currentVersion = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.version
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            if (currentVersion) {
                const [x, y] = currentVersion.split(".");
                fm.version = `${x}.${parseInt(y) + 1}`
            } else {
                fm.version = "2.0"
            }
        })
    }

    public async updateOptions(newOptions: FileClassOptions): Promise<void> {
        const file = this.getClassFile()
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            Object.keys(options).forEach(async (key: keyof typeof options) => {
                const { name, toValue } = options[key]
                fm[name] = toValue(newOptions[key as keyof FileClassOptions])
            })
        })
        await this.incrementVersion();
    }

    public getChildren(): FileClassChild[] {
        const childrenNames: FileClassChild[] = [];
        [...this.plugin.fieldIndex.fileClassesAncestors].forEach(([_fName, ancestors]) => {
            if (ancestors.includes(this.name)) {
                const path = [...ancestors.slice(0, ancestors.indexOf(this.name)).reverse(), _fName]
                const fileClass = this.plugin.fieldIndex.fileClassesName.get(_fName)
                if (fileClass) {
                    childrenNames.push({
                        name: _fName,
                        path: path,
                        fileClass: fileClass
                    })
                }
            }
        })
        return childrenNames
    }

    public async updateAttribute(
        newType: FieldType,
        newName: string,
        newOptions?: string[] | Record<string, string>,
        attr?: FileClassAttribute,
        newCommand?: FieldCommand,
        newDisplay?: MultiDisplayType,
        newStyle?: Record<keyof typeof FieldStyleLabel, boolean>,
        newPath?: string
    ): Promise<void> {
        const fileClass = attr ? this.plugin.fieldIndex.fileClassesName.get(attr.fileClassName)! : this
        const file = fileClass.getClassFile();
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            fm.fields = fm.fields || []
            if (attr) {
                const field = fm.fields.find((f: FileClassAttribute) => f.id === attr.id)
                field.type = newType;
                if (newOptions) field.options = newOptions;
                if (newCommand) field.command = newCommand;
                if (newDisplay) field.display = newDisplay;
                if (newStyle) field.style = newStyle;
                if (newName) field.name = newName;
                if (newPath !== undefined) field.path = newPath
            } else {
                fm.fields.push({
                    name: newName,
                    type: newType,
                    options: newOptions,
                    command: newCommand,
                    display: newDisplay,
                    style: newStyle,
                    path: newPath,
                    id: getNewFieldId(this.plugin)
                })
            }
        })
        await this.incrementVersion();
    }

    public async updateIAttribute(
        attr: Field,
        newType: IFieldType,
        newName: string,
        newOptions?: string[] | Record<string, string>,
        newCommand?: FieldCommand,
        newDisplay?: MultiDisplayType,
        newStyle?: Record<keyof typeof FieldStyleLabel, boolean>,
        newPath?: string
    ): Promise<void> {
        const fileClass = attr && attr.fileClassName ? this.plugin.fieldIndex.fileClassesName.get(attr.fileClassName)! : this
        const file = fileClass.getClassFile();
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            fm.fields = fm.fields || []
            const field = fm.fields.find((f: FileClassAttribute) => f.id === attr.id)
            if (field) {
                field.type = newType;
                if (newOptions) field.options = newOptions;
                if (newCommand) field.command = newCommand;
                if (newDisplay) field.display = newDisplay;
                if (newStyle) field.style = newStyle;
                if (newName) field.name = newName;
                if (newPath !== undefined) field.path = newPath
            } else {
                fm.fields.push({
                    name: newName,
                    type: newType,
                    options: newOptions,
                    command: newCommand,
                    display: newDisplay,
                    style: newStyle,
                    path: newPath,
                    id: getNewFieldId(this.plugin)
                })
            }
        })
        await this.incrementVersion();
    }

    public async removeAttribute(attr: FileClassAttribute): Promise<void> {
        const file = this.getClassFile();
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            fm.fields = fm.fields.filter((f: any) => f.id !== attr.id)
        })
    }

    public async removeIAttribute(attr: Field): Promise<void> {
        const file = this.getClassFile();
        await this.plugin.app.fileManager.processFrontMatter(file, fm => {
            fm.fields = fm.fields.filter((f: any) => f.id !== attr.id)
        })
    }
}

export { FileClass }
//#endregion
//#region methods

export function buildSortedAttributes(plugin: MetadataMenu, fileClass: FileClass): FileClassAttribute[] {
    const attributes = getFileClassAttributes(plugin, fileClass);
    const options = fileClass.getFileClassOptions()
    const presetOrder = options.fieldsOrder || []
    //1 sort according to preset order
    attributes.sort((a, b) =>
        presetOrder.indexOf(a.id) > presetOrder.indexOf(b.id) ? 1 : -1
    )
    //2. rebuild a clean herarchy
    const sortedAttributes = attributes.filter(attr => !attr.path)
    let hasError: boolean = false
    while (sortedAttributes.length < attributes.length) {
        const _initial = [...sortedAttributes]
        sortedAttributes.forEach((sAttr, parentIndex) => {
            for (const attr of attributes) {
                if (
                    attr.path?.split("____").last() === sAttr.id &&
                    !sortedAttributes.includes(attr)
                ) {
                    //insert before next field at same or lower level as parent
                    const parentLevel = sAttr.getLevel()
                    const parentSibling = sortedAttributes.slice(parentIndex + 1).find(oAttr => oAttr.getLevel() <= parentLevel)
                    const parentSiblingIndex = parentSibling ? sortedAttributes.indexOf(parentSibling) : sortedAttributes.length
                    sortedAttributes.splice(parentSiblingIndex, 0, attr)
                    break
                }
            }
        })
        if (_initial.length === sortedAttributes.length) {
            console.error("Impossible to restore field hierarchy, check you fileclass configuration")
            new Notice("Impossible to restore field hierarchy, check you fileclass configuration")
            hasError = true
            return getFileClassAttributes(plugin, fileClass);
        }
    }
    //3. update the fieldsOrder to store a clean hierarchy
    options.fieldsOrder = sortedAttributes.map(sAttr => sAttr.id)
    if (!compareArrays(presetOrder, options.fieldsOrder)) fileClass.updateOptions(options)
    //4. return the sortedAttributes
    return sortedAttributes
}

export function createFileClass(plugin: MetadataMenu, name: string): FileClass {
    const fileClass = new FileClass(plugin, name);
    fileClass.options = fileClass.getFileClassOptions()
    fileClass.getAttributes();
    return fileClass
}

export function getExcludedFieldsFromFrontmatter(excludedFields: string[] | string | undefined): string[] {
    if (Array.isArray(excludedFields)) {
        return excludedFields;
    } else if (excludedFields) {
        return excludedFields.split(",")
    } else {
        return []
    }
}

export function getFileClassAttributes(plugin: MetadataMenu, fileClass: FileClass, excludes?: string[]): FileClassAttribute[] {
    const file = fileClass.getClassFile();
    const rawAttributes = plugin.app.metadataCache.getFileCache(file)?.frontmatter?.fields || []
    const attributes: FileClassAttribute[] = [];
    rawAttributes.forEach((attr: any) => {
        const { name, id, type, options, command, display, style, path } = attr;
        const fieldType = capitalize(type) as FieldType;
        attributes.push(new FileClassAttribute(plugin, name, id, fieldType, options, fileClass.name, command, display, style, path))
    })
    if (excludes) {
        return attributes.filter(attr => !excludes.includes(attr.name))
    } else {
        return attributes
    }
}

export function getFileClassNameFromPath(settings: MetadataMenuSettings, path: string): string | undefined {
    const fileClassNameRegex = new RegExp(`${settings.classFilesPath}(?<fileClassName>.*).md`);
    return path.match(fileClassNameRegex)?.groups?.fileClassName
}

export function getSortedRootFields(plugin: MetadataMenu, fileClass: FileClass): Field[] {
    const fieldsOrder = fileClass.fieldsOrder ||
        buildSortedAttributes(plugin, fileClass).map(attr => attr.id)
    const iFinder = (f: Field) => { return (id: string) => f.id === id }
    const fields = plugin.fieldIndex.fileClassesFields
        .get(fileClass.name)?.filter(_f => _f.isRoot()) || [];
    const sortedFields = fields.sort((f1, f2) => {
        return fieldsOrder.findIndex(iFinder(f1)) < fieldsOrder.findIndex(iFinder(f2)) ? -1 : 1
    })
    return sortedFields
}

export function sortFileFields(index: FieldIndex, file: TFile): Field[] {
    const fileClasses = index.filesFileClasses.get(file.path) || [];
    const sortedAttributes: Field[] = []
    for (const fileClass of fileClasses) {
        const fileClassFields = index.fileClassesFields.get(fileClass.name) || []
        const order = fileClass.options.fieldsOrder
        const sortedFields = order
            ? fileClassFields.sort((f1, f2) => order.indexOf(f1.id) < order.indexOf(f2.id) ? -1 : 1)
            : fileClassFields
        sortedAttributes.push(...sortedFields)
    }
    return sortedAttributes
}

export function indexFileClass(index: FieldIndex, file: TFile): void {
    const fileClassName = getFileClassNameFromPath(index.plugin.settings, file.path)
    if (fileClassName) {
        const cache = index.plugin.app.metadataCache.getFileCache(file)
        try {
            const fileClass = createFileClass(index.plugin, fileClassName)
            index.fileClassesFields.set(
                fileClassName,
                fileClass.attributes
                    .map(attr => attr.getIField())
                    .filter(field =>
                        field !== undefined
                        /* in case getIField doesn't resolve the field won't be added and the error will be silent*/
                    ) as Field[]
            )
            index.fileClassesPath.set(file.path, fileClass)
            index.fileClassesName.set(fileClass.name, fileClass)
            if ((fileClass.getMajorVersion() === undefined || fileClass.getMajorVersion() as number < 2) && index.plugin.manifest.version < "0.6.0") {
                index.v1FileClassesPath.set(file.path, fileClass)
                index.remainingLegacyFileClasses = true
            }
            if (!fileClassName.includes(" ")) {
                index.tagsMatchingFileClasses.set(fileClassName, fileClass)
            }
            const folder = cache?.frontmatter?.folder
            if (typeof folder === "string" && folder !== "" && !index.foldersMatchingFileClasses.has(folder)) {
                index.foldersMatchingFileClasses.set(folder, fileClass)
            }
        } catch (error) {
            console.error(error)
        }
    }
}

//#endregion