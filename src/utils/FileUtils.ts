import {App, PaneType, TFile, WorkspaceLeaf} from "obsidian";


export class FileUtils {

	static async openFile(app: App, file: TFile, openType?: PaneType | boolean) {
		const leaf: WorkspaceLeaf = app.workspace.getLeaf(openType);
		await leaf.openFile(file);
		app.workspace.setActiveLeaf(leaf);
	}
}
