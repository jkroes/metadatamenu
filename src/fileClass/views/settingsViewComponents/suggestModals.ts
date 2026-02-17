import { SuggestModal } from "obsidian"
import { FileClassSettingsView } from "../fileClassSettingsView"

export class ParentSuggestModal extends SuggestModal<string> {

    constructor(private view: FileClassSettingsView) {
        super(view.plugin.app)
        this.containerEl.setAttr("id", `${this.view.fileClass.name}-extends-suggest-modal`)
    }

    getSuggestions(query: string): string[] {
        const fileClassesNames = [...this.view.plugin.fieldIndex.fileClassesName.keys()] as string[]
        const currentName = this.view.fileClass.name
        return fileClassesNames
            .sort()
            .filter(name => name !== currentName && name.toLowerCase().includes(query.toLowerCase()))
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        const options = this.view.fileClass.getFileClassOptions()
        const parent = this.view.plugin.fieldIndex.fileClassesName.get(item)
        if (parent) {
            options.parent = parent
            this.view.fileClass.updateOptions(options)
        }
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value)
    }
}

export class FieldSuggestModal extends SuggestModal<string> {

    constructor(private view: FileClassSettingsView) {
        super(view.plugin.app)
        this.containerEl.setAttr("id", `${this.view.fileClass.name}-excludes-suggest-modal`)
    }

    getSuggestions(query: string): string[] {
        const fileClassName = this.view.fileClass.name
        const fileClassFields = this.view.plugin.fieldIndex.fileClassesFields.get(fileClassName) || []
        const excludedFields = this.view.fileClass.getFileClassOptions().excludes

        return fileClassFields
            .filter(fCA =>
                fCA.fileClassName !== fileClassName
                && fCA.fileClassName?.toLowerCase().includes(query.toLowerCase())
                && !excludedFields?.map(attr => attr.name).includes(fCA.name)
            )
            .map(fCA => fCA.name)
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        const options = this.view.fileClass.getFileClassOptions()
        const excludedFields = options.excludes || []
        const excludedField = this.view.fileClass.attributes.find(field => field.name === item)
        if (excludedField) {
            excludedFields.push(excludedField)
            options.excludes = excludedFields
            this.view.fileClass.updateOptions(options)
        }
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value)
    }
}

