import {Editor, MarkdownView, Plugin, requestUrl} from 'obsidian';
import {MersenneTwister} from './utils/mersenne-twister'
import * as obsidian from 'obsidian';
import {DEFAULT_SETTINGS, NoorPluginSettings, NoorSettingTab} from './settings'
import {Surah} from "./models/Surah";
import {surahs} from "./constants/surahs";

declare global {
	interface Window {
		noorJS: any;
	}
}

export default class NoorPlugin extends Plugin {
	settings: NoorPluginSettings;
	g = new MersenneTwister();

	async onload() {
		await this.loadSettings();

		window.noorJS = {
			obsidian,
			plugin: this,
			randomQuranQuote: this.randomQuranQuoteJS,
		}


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'random-quran-quote',
			name: 'Random Quran quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				editor.setSelection({line: editor.getCursor().line, ch: editor.getCursor().ch});
				if (editor.getCursor().ch > 1)
					editor.replaceSelection("\n")
				editor.replaceSelection(await this.randomQuranQuote());
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

	private async randomQuranQuoteJS() {
		return await window.noorJS.plugin.randomQuranQuote();
	}

	private async randomQuranQuote() {
		let surah = this.g.randomInt() % 114 + 1;
		let ayah = (this.g.randomInt() % surahs[surah - 1].numberOfAyahs) + 1;
		const [arabicResponse, translationResponse] = await Promise.all([
			this.fetchData(surah, this.settings.reciter, ayah),
			this.fetchData(surah, this.settings.translationOption, ayah)
		]);
		return `<audio src="${arabicResponse.ayahs![0].audio}" controls>
<p> Audio tag not supported </p>
</audio>
> [!Quote] "${arabicResponse.revelationType} Surah" ${arabicResponse.englishName} - [[${arabicResponse.number}:${arabicResponse.ayahs![0].numberInSurah}](https://surahquran.com/english.php?sora=${arabicResponse.number}&aya=${arabicResponse.ayahs![0].numberInSurah})]
> 
> ${arabicResponse.ayahs![0].text}
> 
> ${translationResponse.ayahs![0].text}

`;
	}

	prepareAPIurl(surah: number, edition: string, startAyah: number, ayahRange = 1): string {
		// console.log(`https://api.alquran.cloud/v1/surah/${surah}/${edition}?offset=${startAyah}&limit=${ayahRange}`)
		return `https://api.alquran.cloud/v1/surah/${surah}/${edition}?offset=${startAyah}&limit=${ayahRange}`;
	}

	fetchData(surah: number, edition: string, startAyah: number, ayahRange = 1): Promise<Surah> {
		return this.callApi<Surah>(this.prepareAPIurl(surah, edition, startAyah, ayahRange));
	}

	callApi<T>(url: string): Promise<T> {
		return requestUrl(url)
			.then(response => {
				if (response.status !== 200) {
					throw new Error(`${response.status}: ${response.text}`)
				}
				return response.json as Promise<{ data: T }>
			})
			.then(data => {
				return data.data
			})
	}

	onunload() {
		delete window.noorJS;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		console.log(this.settings)
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
