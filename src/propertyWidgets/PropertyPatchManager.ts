import { Component } from "obsidian";
import { around } from "monkey-around";
import type MetadataMenu from "../../main";

export class PropertyPatchManager extends Component {
    private uninstallers: Array<() => void> = [];

    constructor(private plugin: MetadataMenu) {
        super();
    }

    onload() {
        this.patchTextWidget();
        this.patchListWidget();
    }

    onunload() {
        this.uninstallers.forEach(u => u());
        this.uninstallers = [];
    }

    private patchTextWidget() {
        const widgets = (this.plugin.app as any).metadataTypeManager?.registeredTypeWidgets;
        if (!widgets) {
            console.warn("[MetadataMenu] metadataTypeManager.registeredTypeWidgets not available — text widget patch skipped");
            return;
        }
        const textWidget = widgets["text"];
        if (!textWidget) {
            console.warn("[MetadataMenu] text widget not found — patch skipped");
            return;
        }

        const plugin = this.plugin;
        const uninstall = around(textWidget, {
            render(originalRender: Function) {
                return function(this: any, containerEl: HTMLElement, value: unknown, ctx: any) {
                    const component = originalRender.call(this, containerEl, value, ctx);
                    return component;
                };
            }
        });
        this.uninstallers.push(uninstall);
    }

    private patchListWidget() {
        const widgets = (this.plugin.app as any).metadataTypeManager?.registeredTypeWidgets;
        if (!widgets) return;

        // "multitext" is the internal key for Obsidian's List property type.
        // Confirmed via obsidian-typings source (PropertyWidgetType union type).
        const listWidget = widgets["multitext"];
        if (!listWidget) {
            console.warn("[MetadataMenu] list widget (multitext) not found — patch skipped");
            return;
        }

        const plugin = this.plugin;
        const uninstall = around(listWidget, {
            render(originalRender: Function) {
                return function(this: any, containerEl: HTMLElement, value: unknown, ctx: any) {
                    const component = originalRender.call(this, containerEl, value, ctx);
                    return component;
                };
            }
        });
        this.uninstallers.push(uninstall);
    }
}
