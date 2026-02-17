import { Component, MarkdownView, TFile } from "obsidian";
import { around } from "monkey-around";
import type MetadataMenu from "../../main";
import { SelectPropertySuggest } from "./suggest/SelectPropertySuggest";
import { FilePropertySuggest } from "./suggest/FilePropertySuggest";
import { MultiPropertySuggest } from "./suggest/MultiPropertySuggest";
import { MultiFilePropertySuggest } from "./suggest/MultiFilePropertySuggest";

export class PropertyPatchManager extends Component {
    private uninstallPatches: (() => void)[] = [];
    private processedInputs = new WeakSet<Element>();

    constructor(private plugin: MetadataMenu) {
        super();
    }

    onload() {
        console.log("[MDM Debug] PropertyPatchManager onload()");
        const plugin = this.plugin;
        const widgets = plugin.app.metadataTypeManager.registeredTypeWidgets;
        console.log("[MDM Debug] registeredTypeWidgets keys:", Object.keys(widgets ?? {}));

        const textWidget = widgets?.["text"];
        const multitextWidget = widgets?.["multitext"];

        if (!textWidget) {
            console.log("[MDM Debug] text widget not found in registeredTypeWidgets");
        }
        if (!multitextWidget) {
            console.log("[MDM Debug] multitext widget not found in registeredTypeWidgets");
        }

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
                                self.processedInputs.add(inputEl);
                                switch ((field as any).type) {
                                    case "Select":
                                        console.log("[MDM Debug] attaching SelectPropertySuggest to", key);
                                        new SelectPropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                        break;
                                    case "File":
                                        console.log("[MDM Debug] attaching FilePropertySuggest to", key);
                                        new FilePropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                        break;
                                }
                            }
                        }

                        return rendered;
                    };
                }
            });
            this.uninstallPatches.push(uninstall);
            console.log("[MDM Debug] patched text widget render");
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
                                    self.processedInputs.add(inputEl);
                                    switch ((field as any).type) {
                                        case "Multi":
                                            console.log("[MDM Debug] attaching MultiPropertySuggest to input in", key);
                                            new MultiPropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                            break;
                                        case "MultiFile":
                                            console.log("[MDM Debug] attaching MultiFilePropertySuggest to input in", key);
                                            new MultiFilePropertySuggest(plugin.app, inputEl, field, ctx.onChange);
                                            break;
                                    }
                                });
                            };
                        }

                        return rendered;
                    };
                }
            });
            this.uninstallPatches.push(uninstall);
            console.log("[MDM Debug] patched multitext widget render");
        }

        // Post-index scan: attach suggests to properties that rendered before indexing completed
        this.registerEvent(
            plugin.app.metadataCache.on('metadata-menu:indexed', () => {
                console.log("[MDM Debug] metadata-menu:indexed: scanning open views");
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

            for (const rendered of view.metadataEditor.rendered) {
                const key = rendered.entry.key;
                const fields = plugin.fieldIndex.filesFields.get(sourcePath);
                const field = fields?.find((f: any) => f.name === key);
                if (!field) continue;

                const inputEl = rendered.valueEl.querySelector<HTMLInputElement | HTMLDivElement>(
                    ".metadata-input-longtext, input"
                );
                if (!inputEl || this.processedInputs.has(inputEl)) continue;

                this.processedInputs.add(inputEl);
                const file = view.file;
                const onChange = (value: unknown) => {
                    plugin.app.fileManager.processFrontMatter(file, (fm) => {
                        fm[key] = value;
                    });
                };

                console.log("[MDM Debug] post-index attaching suggest for", key, "in", sourcePath);
                switch ((field as any).type) {
                    case "Select":
                        new SelectPropertySuggest(plugin.app, inputEl, field, onChange);
                        break;
                    case "File":
                        new FilePropertySuggest(plugin.app, inputEl, field, onChange);
                        break;
                    case "Multi":
                        new MultiPropertySuggest(plugin.app, inputEl, field, onChange);
                        break;
                    case "MultiFile":
                        new MultiFilePropertySuggest(plugin.app, inputEl, field, onChange);
                        break;
                }
            }
        }
    }

    onunload() {
        this.uninstallPatches.forEach(fn => fn());
        this.uninstallPatches = [];
    }
}
