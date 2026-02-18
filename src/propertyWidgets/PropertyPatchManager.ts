import { Component, MarkdownView } from "obsidian";
import { around } from "monkey-around";
import type MetadataMenu from "../../main";
import { SelectPropertySuggest } from "./suggest/SelectPropertySuggest";
import { FilePropertySuggest } from "./suggest/FilePropertySuggest";
import { MultiPropertySuggest } from "./suggest/MultiPropertySuggest";
import { MultiFilePropertySuggest } from "./suggest/MultiFilePropertySuggest";

export class PropertyPatchManager extends Component {
    private uninstallPatches: (() => void)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private processedInputs = new WeakMap<Element, any>();

    constructor(private plugin: MetadataMenu) {
        super();
    }

    onload() {
        const plugin = this.plugin;
        const widgets = plugin.app.metadataTypeManager.registeredTypeWidgets;

        const textWidget = widgets?.["text"];
        const multitextWidget = widgets?.["multitext"];

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        if (textWidget) {
            const uninstall = around(textWidget, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                render(oldRender: (...args: any[]) => any) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return function (this: any, ...args: any[]) {
                        const rendered = oldRender && oldRender.apply(this, args);
                        const containerEl = args[0] as HTMLElement;
                        const ctx = args[2] as { key: string; sourcePath: string; onChange: (v: unknown) => void };
                        const { key, sourcePath } = ctx;

                        const fields = plugin.fieldIndex.filesFields.get(sourcePath);
                        const field = fields?.find((f: any) => f.name === key);

                        if (field) {
                            const inputEl = containerEl.querySelector<HTMLInputElement | HTMLDivElement>(
                                ".metadata-input-longtext, input"
                            );
                            if (inputEl && !self.processedInputs.has(inputEl)) {
                                switch ((field as any).type) {
                                    case "Select": {
                                        const suggest = new SelectPropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                        self.processedInputs.set(inputEl, suggest);
                                        break;
                                    }
                                    case "File": {
                                        const suggest = new FilePropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                        self.processedInputs.set(inputEl, suggest);
                                        break;
                                    }
                                }
                            }
                        }

                        return rendered;
                    };
                }
            });
            this.uninstallPatches.push(uninstall);
        }

        if (multitextWidget) {
            const uninstall = around(multitextWidget, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                render(oldRender: (...args: any[]) => any) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return function (this: any, ...args: any[]) {
                        const rendered = oldRender && oldRender.apply(this, args);
                        const containerEl = args[0] as HTMLElement;
                        const ctx = args[2] as { key: string; sourcePath: string; onChange: (v: unknown) => void };
                        const { key, sourcePath } = ctx;

                        const fields = plugin.fieldIndex.filesFields.get(sourcePath);
                        const field = fields?.find((f: any) => f.name === key);

                        if (field && rendered?.multiselect) {
                            const multiselect = rendered.multiselect;
                            const origRenderValues = multiselect.renderValues.bind(multiselect);
                            multiselect.renderValues = () => {
                                origRenderValues();
                                const inputs = containerEl.querySelectorAll<HTMLInputElement | HTMLDivElement>(
                                    ".metadata-input-longtext, input"
                                );
                                inputs.forEach(inputEl => {
                                    if (self.processedInputs.has(inputEl)) return;
                                    switch ((field as any).type) {
                                        case "Multi": {
                                            const suggest = new MultiPropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                            self.processedInputs.set(inputEl, suggest);
                                            break;
                                        }
                                        case "MultiFile": {
                                            const suggest = new MultiFilePropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                            self.processedInputs.set(inputEl, suggest);
                                            break;
                                        }
                                    }
                                });
                            };
                        }

                        return rendered;
                    };
                }
            });
            this.uninstallPatches.push(uninstall);
        }

        // Post-index scan: attach suggests to properties that rendered before indexing completed
        this.registerEvent(
            plugin.app.metadataCache.on('metadata-menu:indexed', () => {
                this.processOpenViews();
            })
        );
    }

    private processOpenViews() {
        const plugin = this.plugin;
        for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
            const view = leaf.view as MarkdownView;
            if (!view.file || !view.metadataEditor?.rendered) continue;
            const sourcePath = view.file.path;
            const fields = plugin.fieldIndex.filesFields.get(sourcePath);

            for (const rendered of view.metadataEditor.rendered) {
                const key = rendered.entry.key;
                const field = fields?.find((f: any) => f.name === key);

                const inputEl = rendered.valueEl.querySelector<HTMLInputElement | HTMLDivElement>(
                    ".metadata-input-longtext, input"
                );
                if (!inputEl) continue;

                const existing = this.processedInputs.get(inputEl);

                if (!field) {
                    // Field no longer applies — disable any attached suggest
                    if (existing) {
                        existing.getSuggestions = () => [];
                        existing.close();
                        this.processedInputs.delete(inputEl);
                    }
                    continue;
                }

                if (existing) continue; // Already attached, field still applies

                const file = view.file;
                const onChange = (value: unknown) => {
                    plugin.app.fileManager.processFrontMatter(file, (fm) => {
                        fm[key] = value;
                    });
                };

                switch ((field as any).type) {
                    case "Select": {
                        const suggest = new SelectPropertySuggest(plugin.app, inputEl, field, onChange);
                        this.processedInputs.set(inputEl, suggest);
                        break;
                    }
                    case "File": {
                        const suggest = new FilePropertySuggest(plugin.app, inputEl, field, onChange);
                        this.processedInputs.set(inputEl, suggest);
                        break;
                    }
                    case "Multi": {
                        const suggest = new MultiPropertySuggest(plugin.app, inputEl, field, onChange);
                        this.processedInputs.set(inputEl, suggest);
                        break;
                    }
                    case "MultiFile": {
                        const suggest = new MultiFilePropertySuggest(plugin.app, inputEl, field, onChange);
                        this.processedInputs.set(inputEl, suggest);
                        break;
                    }
                }
            }
        }
    }

    onunload() {
        this.uninstallPatches.forEach(fn => fn());
        this.uninstallPatches = [];
    }
}
