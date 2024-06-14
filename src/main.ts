import {Editor, MarkdownView, Plugin, requestUrl} from 'obsidian';
import {MersenneTwister} from './utils/mersenne-twister'
import * as obsidian from 'obsidian';
import {DEFAULT_SETTINGS, NoorPluginSettings, NoorSettingTab} from './settings'
import {Surah} from "./models/Surah";
import {surahs} from "./constants/surahs";
import {EditorUtils} from "./utils/EditorUtils";
import {Hadith} from "./models/Hadith";
import {lineNumbers} from "@codemirror/view";
import {QuranApi} from "./api/QuranApi";
import {HadithApi} from "./api/HadithApi";

declare global {
	interface Window {
		noorJS: any;
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
			randomHadithQuote: this.randomHadithQuoteJS,
		}


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'random-quran-quote',
			name: 'Random Quran quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				EditorUtils.insertInNewLine(editor, await this.quranApi.randomQuranQuote());
			}
		});

		this.addCommand({
			id: 'random-hadith-quote',
			name: 'Random Hadith quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				EditorUtils.insertInNewLine(editor, await this.hadithApi.randomHadithQuote());
			}
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

	private async randomHadithQuoteJS() {
		return await window.noorJS.plugin.hadithApi.randomHadithQuote();
	}


	private async randomQuranQuoteJS() {
		return await window.noorJS.plugin.quranApi.randomQuranQuote();
	}


	onunload() {
		delete window.noorJS;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
