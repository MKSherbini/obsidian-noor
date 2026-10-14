import {App, PaneType, TFile} from "obsidian";


export class FileUtils {

	static async openFile(app: App, file: TFile, openType?: PaneType | boolean) {
		const leaf = app.workspace.getLeaf(openType);
		await leaf.openFile(file);
		app.workspace.setActiveLeaf(leaf, {focus: true});
	}
}
