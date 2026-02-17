import { AbstractInputSuggest, App, TFile } from "obsidian";
import { getFiles } from "../../fields/models/abstractModels/AbstractFile";

export class FilePropertySuggest extends AbstractInputSuggest<TFile> {
    constructor(
        app: App,
        private inputElement: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private field: any,
    ) {
        super(app, inputElement);
        inputElement.addEventListener("focus", () => inputElement.dispatchEvent(new Event("input")));
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
        this.inputElement.value = `[[${file.basename}]]`;
        this.inputElement.trigger("input");
        this.close();
    }
}
