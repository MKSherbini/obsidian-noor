import * as obsidian from 'obsidian';
import {Editor, MarkdownView, Notice, Plugin} from 'obsidian';
import {MersenneTwister} from './utils/mersenne-twister'
import {DEFAULT_SETTINGS, NoorPluginSettings, NoorSettingTab} from './settings'
import {EditorUtils} from "./utils/EditorUtils";
import {QuranApi} from "./api/QuranApi";
import {HadithApi} from "./api/HadithApi";
import {FileUtils} from "./utils/FileUtils";
import {Logger} from "./utils/Logger";

/**
 * Global scripting API exposed as `window.noorJS` (e.g. for use from Templater).
 */
export interface NoorJS {
	obsidian: typeof obsidian;
	plugin: NoorPlugin;
	randomQuranQuote: () => Promise<string>;
	quranQuoteByCode: (code: string) => Promise<string>;
	randomHadithQuote: () => Promise<string>;
	hadithQuoteByCode: (code: string) => Promise<string>;
}

declare global {
	interface Window {
		noorJS?: NoorJS;
	}
}

export default class NoorPlugin extends Plugin {
	settings: NoorPluginSettings;
	randomGenerator = new MersenneTwister();
	quranApi: QuranApi;
	hadithApi: HadithApi;

	async onload() {
		await this.loadSettings();
		this.quranApi = new QuranApi(this);
		this.hadithApi = new HadithApi(this);

		window.noorJS = {
			obsidian,
			plugin: this,
			randomQuranQuote: this.randomQuranQuoteJS,
			quranQuoteByCode: this.quranQuoteByCodeJS,
			randomHadithQuote: this.randomHadithQuoteJS,
			hadithQuoteByCode: this.hadithQuoteByCodeJS,
		}


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'random-quran-quote',
			name: 'Random Quran quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.runCommand(async () => {
					EditorUtils.insertInNewLine(editor, await this.quranApi.randomQuranQuote());
				});
			}
		});

		this.addCommand({
			id: 'quran-quote-by-code',
			name: 'Quran quote by code',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.runCommand(async () => {
					editor.replaceSelection(await this.quranApi.quranQuoteByCode(editor.getSelection()));
				});
			}
		});

		this.addCommand({
			id: 'random-hadith-quote',
			name: 'Random Hadith quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.runCommand(async () => {
					EditorUtils.insertInNewLine(editor, await this.hadithApi.randomHadithQuote());
				});
			}
		});

		this.addCommand({
			id: 'hadith-quote-by-code',
			name: 'Hadith quote by code',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.runCommand(async () => {
					editor.replaceSelection(await this.hadithApi.hadithQuoteByCode(editor.getSelection()));
				});
			}
		});

		this.addCommand({
			id: 'open-dhikr-file',
			name: 'Open Dhikr file',
			callback: async () => await this.runCommand(() => this.openDhikrFile(false))
		});

		this.addCommand({
			id: 'open-dhikr-file-popup',
			name: 'Open Dhikr file popup',
			callback: async () => await this.runCommand(() => this.openDhikrFile(true))
		});


		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new NoorSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	/** Runs a command body, surfacing any failure as a Notice instead of an unhandled rejection. */
	private async runCommand(action: () => Promise<void>) {
		try {
			await action();
		} catch (error) {
			Logger.error('Command failed', error);
			const message = error instanceof Error && error.message
				? error.message
				: 'Something went wrong. Please check your connection and settings.';
			new Notice(`Noor: ${message}`);
		}
	}

	private async openDhikrFile(popup: boolean) {
		let [quranQuote, hadithQuote] =
			await Promise.all([this.randomQuranQuoteJS(), this.randomHadithQuoteJS()]);
		let content = "\n" + quranQuote + "\n" + hadithQuote;

		let dhikrFile = this.app.vault.getFileByPath(this.settings.dhikrFilepath);
		if (dhikrFile != null) {
			// Update in place so a failed write can never destroy the existing note.
			await this.app.vault.modify(dhikrFile, content);
		} else {
			let lastSlashIdx = this.settings.dhikrFilepath.lastIndexOf('/');
			if (lastSlashIdx != -1) {
				let path = this.settings.dhikrFilepath.slice(0, lastSlashIdx);
				let folder = this.app.vault.getFolderByPath(path);
				if (folder == null)
					await this.app.vault.createFolder(path)
			}

			dhikrFile = await this.app.vault.create(this.settings.dhikrFilepath, content);
		}

		await FileUtils.openFile(this.app, dhikrFile, popup ? 'window' : false);
	}

	private async randomHadithQuoteJS() {
		return await window.noorJS!.plugin.hadithApi.randomHadithQuote();
	}

	private async hadithQuoteByCodeJS(code: string) {
		return await window.noorJS!.plugin.hadithApi.hadithQuoteByCode(code);
	}

	private async randomQuranQuoteJS() {
		return await window.noorJS!.plugin.quranApi.randomQuranQuote();
	}

	private async quranQuoteByCodeJS(code: string) {
		return await window.noorJS!.plugin.quranApi.quranQuoteByCode(code);
	}


	onunload() {
		delete window.noorJS;
	}

	async loadSettings() {
		let data: Partial<NoorPluginSettings> | null = null;
		try {
			data = await this.loadData();
		} catch (error) {
			Logger.error('Failed to load settings, using defaults', error);
			new Notice('Noor: Could not load the saved settings, using defaults instead.');
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			Logger.error('Failed to save settings', error);
			new Notice('Noor: Could not save settings. Please check that your vault is writable.');
		}
	}
}
