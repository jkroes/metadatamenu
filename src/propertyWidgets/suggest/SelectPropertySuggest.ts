import { AbstractInputSuggest, App } from "obsidian";
import { getOptionsList } from "../../fields/models/abstractModels/AbstractList";

export class SelectPropertySuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        private inputElement: HTMLInputElement,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        private field: any,
    ) {
        super(app, inputElement);
    }

    getSuggestions(query: string): string[] {
        try {
            const options: string[] = getOptionsList(this.field);
            if (!query) return options;
            return options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
        } catch {
            return [];
        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string): void {
        this.inputElement.value = value;
        this.inputElement.trigger("input");
        this.close();
    }
}
