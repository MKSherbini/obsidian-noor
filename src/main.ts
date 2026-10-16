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
import {buildDropdownOptions} from "./utils/DropdownOptions";
import type {DropdownOptions} from "./utils/DropdownOptions";

/** Matches any arabic-script character. */
const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufefc]/;

/** Fallback until the API language list loads. */
const ARABIC_HADITH_LANGUAGES = new Set(['ar', 'fa', 'ur', 'ug']);

/** The API rejects shorter phrases, so they are never sent. */
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

	/** Settings dropdown contents, rebuilt when a fetched list changes. */
	dropdownOptions!: DropdownOptions;

	async onload() {
		await this.loadSettings();
		this.quranApi = new QuranApi(this);
		this.hadithApi = new HadithApi(this);
		this.dropdownOptions = buildDropdownOptions(this.settings);
		void this.loadHadithLanguages();
		void this.loadQuranEditions();

		window.noorJS = {
			obsidian,
			plugin: this,
			randomQuranQuote: () => this.randomQuranQuoteJS(),
			quranQuoteByCode: (code: string) => this.quranQuoteByCodeJS(code),
			randomHadithQuote: () => this.randomHadithQuoteJS(),
			hadithQuoteByCode: (code: string) => this.hadithQuoteByCodeJS(code),
		}


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


		this.addSettingTab(new NoorSettingTab(this.app, this));
	}

	/** Runs a command, showing any failure as a Notice. */
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
		// The translation edition has no arabic text, so an arabic query goes to the arabic edition.
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

	/** Explains a miss caused by searching a dataset in another script. */
	private hadithNoResultsHint(query: string): string | undefined {
		const language = this.settings.hadithLanguage;
		if (ARABIC_SCRIPT.test(query) === this.hadithDatasetUsesArabicScript(language)) return undefined;

		return `No results. ${this.hadithLanguageHint(language)}`;
	}

	/** Whether the hadith dataset for `language` is written in arabic script. */
	private hadithDatasetUsesArabicScript(language: string): boolean {
		// Before the language list loads the dropdown label is just the code, hence the fallback.
		const native = this.dropdownOptions.hadithLanguages[language] ?? language;
		return ARABIC_SCRIPT.test(native) || ARABIC_HADITH_LANGUAGES.has(language);
	}

	/** Guidance for a query whose script does not fit the selected hadith language. */
	private hadithLanguageHint(language: string): string {
		const label = this.dropdownOptions.hadithLanguages[language] ?? language;
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

	/** Refreshes the hadith language list from the API. */
	private async loadHadithLanguages() {
		try {
			const languages = await this.hadithApi.languages();
			if (languages == null) return;

			if (await this.storeFetchedList('hadithLanguages', languages)) {
				this.dropdownOptions = buildDropdownOptions(this.settings);
			}
		} catch (error) {
			Logger.error('Could not load the hadith language list', error);
		}
	}

	/** Refreshes the translation and reciter lists from the API. */
	private async loadQuranEditions() {
		try {
			const [translations, reciters] = await Promise.all([
				this.quranApi.translations(),
				this.quranApi.reciters(),
			]);
			const translationsChanged = await this.storeFetchedList('translations', translations);
			const recitersChanged = await this.storeFetchedList('reciters', reciters);
			if (translationsChanged || recitersChanged) {
				this.dropdownOptions = buildDropdownOptions(this.settings);
			}
		} catch (error) {
			Logger.error('Could not load the Quran editions', error);
		}
	}

	/** Stores a fetched list, saving only when it changed. Returns whether it changed. */
	private async storeFetchedList<K extends keyof NoorPluginSettings>(key: K, value: NoorPluginSettings[K]): Promise<boolean> {
		if (JSON.stringify(this.settings[key]) === JSON.stringify(value)) return false;
		this.settings[key] = value;
		await this.saveSettings();
		return true;
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
