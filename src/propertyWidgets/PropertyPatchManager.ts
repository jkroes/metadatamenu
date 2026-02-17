import { Component, TFile } from "obsidian";
import type MetadataMenu from "../../main";
import { SelectPropertySuggest } from "./suggest/SelectPropertySuggest";
import { FilePropertySuggest } from "./suggest/FilePropertySuggest";
import { MultiPropertySuggest } from "./suggest/MultiPropertySuggest";
import { MultiFilePropertySuggest } from "./suggest/MultiFilePropertySuggest";

export class PropertyPatchManager extends Component {
    private processedInputs = new WeakSet<HTMLInputElement>();
    private observer: MutationObserver | null = null;

    constructor(private plugin: MetadataMenu) {
        super();
    }

    onload() {
        this.observer = new MutationObserver(this.onMutation.bind(this));
        this.observer.observe(document.body, { childList: true, subtree: true });
        // Process any properties panels already open at load time
        document.querySelectorAll<HTMLElement>(".metadata-property-value").forEach(el => {
            this.processPropertyValueEl(el);
        });
    }

    onunload() {
        this.observer?.disconnect();
        this.observer = null;
    }

    private onMutation(mutations: MutationRecord[]) {
        for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.classList.contains("metadata-property-value")) {
                    this.processPropertyValueEl(node);
                }
                node.querySelectorAll<HTMLElement>(".metadata-property-value").forEach(el => {
                    this.processPropertyValueEl(el);
                });
            }
        }
    }

    private processPropertyValueEl(valueEl: HTMLElement) {
        const inputEl = valueEl.querySelector<HTMLInputElement>("input");
        if (!inputEl) return;
        if (this.processedInputs.has(inputEl)) return;

        const propertyEl = valueEl.closest<HTMLElement>(".metadata-property");
        if (!propertyEl) return;

        // Try data attribute first, then fall back to reading the key input value
        const propertyKey =
            propertyEl.dataset.propertyKey ??
            propertyEl.querySelector<HTMLInputElement>(".metadata-property-key input")?.value;
        console.log("[MDM Debug] processPropertyValueEl", { propertyKey, valueEl, inputEl });
        if (!propertyKey) return;

        const file = this.plugin.app.workspace.getActiveFile();
        if (!(file instanceof TFile)) return;

        const fields = this.plugin.fieldIndex.filesFields.get(file.path);
        const field = fields?.find((f: any) => f.name === propertyKey);
        console.log("[MDM Debug] field lookup", { filePath: file.path, propertyKey, field: field ? { name: (field as any).name, type: (field as any).type } : null });
        if (!field) return;

        this.processedInputs.add(inputEl);

        switch ((field as any).type) {
            case "Select":
                new SelectPropertySuggest(this.plugin.app, inputEl, field);
                break;
            case "File":
                new FilePropertySuggest(this.plugin.app, inputEl, field);
                break;
            case "Multi":
                new MultiPropertySuggest(this.plugin.app, inputEl, field);
                break;
            case "MultiFile":
                new MultiFilePropertySuggest(this.plugin.app, inputEl, field);
                break;
        }
    }
}
