import {surahs} from "../constants/surahs";
import {Surah} from "../models/Surah";
import {requestUrl} from "obsidian";
import * as url from "url";
import NoorPlugin from "../main";

export class QuranApi {
	private plugin: NoorPlugin;

	constructor(plugin: NoorPlugin) {
		this.plugin = plugin;
	}

	public async randomQuranQuote() {
		let surah = this.plugin.randomGenerator.randomInt() % 114 + 1;
		let ayah = (this.plugin.randomGenerator.randomInt() % surahs[surah - 1].numberOfAyahs);
		const [arabicResponse, translationResponse] = await Promise.all([
			this.fetchData(surah, this.plugin.settings.reciter, ayah),
			this.fetchData(surah, this.plugin.settings.translationOption, ayah)
		]);
		return `<audio src="${arabicResponse.ayahs![0].audio}" controls>
<p> Audio tag not supported </p>
</audio>
> [!Quote] ${this.getSurahTitle(arabicResponse)} - [[${arabicResponse.number}:${arabicResponse.ayahs![0].numberInSurah}](https://surahquran.com/english.php?sora=${arabicResponse.number}&aya=${arabicResponse.ayahs![0].numberInSurah})]
> 
> ${arabicResponse.ayahs![0].text}${this.getTranslation(translationResponse)}
`;
	}

	private getSurahTitle(arabicResponse: Surah) {
		let arabicRevelation = arabicResponse.revelationType == 'Meccan' ? 'مكية' : 'مدنية';
		// let revelationLocation = this.plugin.settings.showTranslation ?
		// 	`${arabicResponse.revelationType} Surah`
		// 	: `سورة ${arabicRevelation}`;

		let revelationLocation = this.plugin.settings.showTranslation ? arabicResponse.revelationType : arabicRevelation;
		let surahName = this.plugin.settings.showTranslation ? arabicResponse.englishName : arabicResponse.name;
		return `${surahName} "${revelationLocation}"`;
	}

	getTranslation(translationResponse: Surah) {
		if (!this.plugin.settings.showTranslation) return '';
		return `
> 
> ${translationResponse.ayahs![0].text}`
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
}
