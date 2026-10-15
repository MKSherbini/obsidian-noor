import * as obsidian from 'obsidian';
import {Editor, MarkdownView, normalizePath, Notice, Plugin, TFile, TFolder} from 'obsidian';
import {MersenneTwister} from './utils/mersenne-twister'
import {DEFAULT_SETTINGS, NoorPluginSettings, NoorSettingTab} from './settings'
import {EditorUtils} from "./utils/EditorUtils";
import {QuranApi} from "./api/QuranApi";
import {HadithApi} from "./api/HadithApi";
import {FileUtils} from "./utils/FileUtils";
import {Logger} from "./utils/Logger";
import type {QuoteSearchAction, QuoteSearchItem, QuoteSearchOptions} from "./ui/QuoteSearchModal";
import {QuoteSearchModal} from "./ui/QuoteSearchModal";
import type {HadithLanguage} from "./models/HadithLanguage";

/** Covers the Arabic script, including Supplement/Extended-A and presentation forms. */
const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufefc]/;

/** Fallback arabic-script hadith languages, used until the API list loads. */
const ARABIC_HADITH_LANGUAGES = new Set(['ar', 'fa', 'ur', 'ug']);

/** The hadith API answers a phrase shorter than this with HTTP 400, so it is never sent one. */
const HADITH_MIN_QUERY_LENGTH = 3;

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
	settings!: NoorPluginSettings;
	randomGenerator = new MersenneTwister();
	quranApi!: QuranApi;
	hadithApi!: HadithApi;

	/** Hadith languages from the API (loaded on start); the dropdown and the hints read this. */
	hadithLanguages: HadithLanguage[] = [];
	/** Arabic-script codes from {@link hadithLanguages}; the constant is the offline fallback. */
	private arabicHadithLanguages = new Set(ARABIC_HADITH_LANGUAGES);

	async onload() {
		await this.loadSettings();
		this.quranApi = new QuranApi(this);
		this.hadithApi = new HadithApi(this);
		void this.loadHadithLanguages();

		window.noorJS = {
			obsidian,
			plugin: this,
			randomQuranQuote: () => this.randomQuranQuoteJS(),
			quranQuoteByCode: (code: string) => this.quranQuoteByCodeJS(code),
			randomHadithQuote: () => this.randomHadithQuoteJS(),
			hadithQuoteByCode: (code: string) => this.hadithQuoteByCodeJS(code),
		}


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'random-quran-quote',
			name: 'Random quran quote',
			editorCallback: async (editor: Editor) => {
				await this.runCommand(async () => {
					EditorUtils.insertBlock(editor, await this.quranApi.randomQuranQuote());
				});
			}
		});

		this.addCommand({
			id: 'quran-quote-by-code',
			name: 'Quran quote by code',
			editorCallback: async (editor: Editor) => {
				await this.runCommand(async () => {
					EditorUtils.insertBlock(editor, await this.quranApi.quranQuoteByCode(editor.getSelection()));
				});
			}
		});

		this.addCommand({
			id: 'random-hadith-quote',
			name: 'Random hadith quote',
			editorCallback: async (editor: Editor) => {
				await this.runCommand(async () => {
					EditorUtils.insertBlock(editor, await this.hadithApi.randomHadithQuote());
				});
			}
		});

		this.addCommand({
			id: 'hadith-quote-by-code',
			name: 'Hadith quote by code',
			editorCallback: async (editor: Editor) => {
				await this.runCommand(async () => {
					EditorUtils.insertBlock(editor, await this.hadithApi.hadithQuoteByCode(editor.getSelection()));
				});
			}
		});

		this.addCommand({
			id: 'open-dhikr-file',
			name: 'Open dhikr file',
			callback: async () => await this.runCommand(() => this.openDhikrFile(false))
		});

		this.addCommand({
			id: 'open-dhikr-file-popup',
			name: 'Open dhikr file popup',
			callback: async () => await this.runCommand(() => this.openDhikrFile(true))
		});

		this.addCommand({
			id: 'search-quran-quote',
			name: 'Search quran quote',
			callback: async () => await this.runCommand(async () => this.openSearch('quran'))
		});

		this.addCommand({
			id: 'search-hadith-quote',
			name: 'Search hadith quote',
			callback: async () => await this.runCommand(async () => this.openSearch('hadith'))
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
		const [quranQuote, hadithQuote] =
			await Promise.all([this.randomQuranQuoteJS(), this.randomHadithQuoteJS()]);
		await this.writeDhikrFile("\n" + quranQuote + "\n" + hadithQuote, popup);
	}

	private async writeDhikrFile(content: string, popup: boolean) {
		const target = this.app.vault.getAbstractFileByPath(this.settings.dhikrFilepath);
		let dhikrFile: TFile;
		if (target instanceof TFile) {
			// Update in place so a failed write can never destroy the existing note.
			await this.app.vault.modify(target, content);
			dhikrFile = target;
		} else {
			const lastSlashIdx = this.settings.dhikrFilepath.lastIndexOf('/');
			if (lastSlashIdx != -1) {
				const folderPath = this.settings.dhikrFilepath.slice(0, lastSlashIdx);
				if (!(this.app.vault.getAbstractFileByPath(folderPath) instanceof TFolder))
					await this.app.vault.adapter.mkdir(normalizePath(folderPath));
			}

			dhikrFile = await this.app.vault.create(this.settings.dhikrFilepath, content);
		}

		await FileUtils.openFile(this.app, dhikrFile, popup ? 'window' : false);
	}

	private openSearch(source: 'quran' | 'hadith') {
		// The commands can run without an editor; only "Insert" needs one.
		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
		const limit = this.settings.searchResultLimit;

		const options: QuoteSearchOptions = source === 'quran'
			? {
				title: 'Search quran',
				placeholder: 'Type to search the quran',
				emptyText: 'Type to search the quran.',
				cacheKey: 'quran',
				search: (query) => this.searchQuranItems(query, limit),
				onChoose: (item, action) => this.runCommand(() => this.applyQuote(item, action, editor, code => this.quranApi.quranQuoteByCode(code))),
			}
			: {
				title: 'Search hadith',
				placeholder: 'Type to search hadith',
				emptyText: 'Type to search hadith.',
				cacheKey: `hadith:${this.settings.hadithLanguage}`,
				minQueryLength: HADITH_MIN_QUERY_LENGTH,
				search: (query) => this.searchHadithItems(query, limit),
				noResultsText: (query) => this.hadithNoResultsHint(query),
				onChoose: (item, action) => this.runCommand(() => this.applyQuote(item, action, editor, code => this.hadithApi.hadithQuoteByCode(code))),
			};

		new QuoteSearchModal(this.app, options).open();
	}

	private async searchQuranItems(query: string, limit: number): Promise<QuoteSearchItem[]> {
		const arabic = ARABIC_SCRIPT.test(query);
		// The translation edition holds no arabic text, so an arabic query must go to the arabic edition.
		const edition = arabic ? 'quran-uthmani' : this.settings.translationOption;
		const matches = await this.quranApi.search(query, edition, limit);
		return matches.map(match => ({
			code: `${match.surah.number}:${match.numberInSurah}`,
			title: `${arabic ? match.surah.name : match.surah.englishName} ${match.surah.number}:${match.numberInSurah}`,
			detail: match.text,
		}));
	}

	private async searchHadithItems(query: string, limit: number): Promise<QuoteSearchItem[]> {
		// The arabic dataset answers a non-arabic phrase with HTTP 400, so screen it before the request.
		if (this.settings.hadithLanguage === 'ar' && !ARABIC_SCRIPT.test(query)) {
			throw new Error(this.hadithLanguageHint('ar'));
		}

		const results = await this.hadithApi.search(query, this.settings.hadithLanguage, limit);
		return results.map(result => ({
			code: result.id,
			title: result.title,
			detail: result.hadith_text,
		}));
	}

	/**
	 * A query whose script differs from the selected dataset is the likely cause of an empty result.
	 * An arabic query can still match a non-arabic dataset, so this only runs after a real miss.
	 */
	private hadithNoResultsHint(query: string): string | undefined {
		const language = this.settings.hadithLanguage;
		if (ARABIC_SCRIPT.test(query) === this.arabicHadithLanguages.has(language)) return undefined;

		return `No results. ${this.hadithLanguageHint(language)}`;
	}

	/** Guidance for a query whose script does not fit the selected hadith language. */
	private hadithLanguageHint(language: string): string {
		const label = this.hadithLanguages.find(entry => entry.code === language)?.native ?? language;
		return `This search matches ${label} hadith text. Type in ${label}, or change the hadith language in the settings.`;
	}

	private async applyQuote(
		item: QuoteSearchItem,
		action: QuoteSearchAction,
		editor: Editor | null,
		build: (code: string) => Promise<string>,
	) {
		if (action === 'insert') {
			if (editor == null) {
				new Notice('Noor: Open a note to insert the quote.');
				return;
			}
			EditorUtils.insertBlock(editor, await build(item.code));
			return;
		}

		await this.writeDhikrFile(await build(item.code), action === 'file-popup');
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
			data = (await this.loadData()) as Partial<NoorPluginSettings> | null;
		} catch (error) {
			Logger.error('Failed to load settings, using defaults', error);
			new Notice('Noor: Could not load the saved settings, using defaults instead.');
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	/** Loads the API's language list; the settings dropdown reads it, so a failure leaves it empty. */
	private async loadHadithLanguages() {
		try {
			const languages = await this.hadithApi.languages();
			if (languages == null) return;

			this.hadithLanguages = languages;
			this.arabicHadithLanguages = new Set(
				languages.filter(language => ARABIC_SCRIPT.test(language.native)).map(language => language.code),
			);
		} catch (error) {
			Logger.error('Could not load the hadith language list', error);
		}
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
