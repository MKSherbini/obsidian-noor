import {surahs} from "../constants/surahs";
import {Surah} from "../models/Surah";
import {Ayah} from "../models/Ayah";
import type {RequestUrlResponse} from "obsidian";
import NoorPlugin from "../main";
import {Logger} from "../utils/Logger";
import {RequestUtils} from "../utils/RequestUtils";

export class QuranApi {
	private plugin: NoorPlugin;

	constructor(plugin: NoorPlugin) {
		this.plugin = plugin;
	}

	public async randomQuranQuote() {
		let surah = this.plugin.randomGenerator.randomInt() % 114 + 1;
		let ayah = (this.plugin.randomGenerator.randomInt() % surahs[surah - 1].numberOfAyahs);

		return this.fetchQuran(surah, ayah);
	}

	public async quranQuoteByCode(code: string) {
		const match = code.trim().match(/^(\d+):(\d+)$/);
		if (match == null) {
			throw new Error("Invalid code format. Please use 'Surah:Ayah', for example 2:255.");
		}

		let surah = parseInt(match[1]);
		let ayah = parseInt(match[2]);
		if (surah < 1 || surah > 114 || ayah < 1 || ayah > surahs[surah - 1].numberOfAyahs) {
			throw new Error(`Ayah ${surah}:${ayah} does not exist.`);
		}

		return this.fetchQuran(surah, ayah - 1);
	}

	private async fetchQuran(surah: number, ayah: number) {
		const showTranslation = this.plugin.settings.showTranslation;
		const [arabicResponse, translationResponse] = await Promise.all([
			this.fetchData(surah, this.plugin.settings.reciter, ayah),
			showTranslation ? this.fetchData(surah, this.plugin.settings.translationOption, ayah) : null
		]);

		const ayahData = arabicResponse.ayahs?.[0];
		if (ayahData == null) {
			throw new Error(`Could not load ayah ${surah}:${ayah + 1}.`);
		}

		return `${this.getAudioBlock(ayahData)}> [!Quote] ${this.getSurahTitle(arabicResponse)} - [[${arabicResponse.number}:${ayahData.numberInSurah}](https://surahquran.com/english.php?sora=${arabicResponse.number}&aya=${ayahData.numberInSurah})]
> 
> ${ayahData.text}${this.getTranslation(translationResponse)}
`;
	}

	private getAudioBlock(ayah: Ayah) {
		if (!ayah.audio) return '';

		return `<audio src="${ayah.audio}" controls>
<p> Audio tag not supported </p>
</audio>

`;
	}

	private getSurahTitle(arabicResponse: Surah) {
		let arabicRevelation = arabicResponse.revelationType == 'Meccan' ? 'مكية' : 'مدنية';
		let revelationLocation = this.plugin.settings.showTranslation ? arabicResponse.revelationType : arabicRevelation;
		let surahName = this.plugin.settings.showTranslation ? arabicResponse.englishName : arabicResponse.name;
		return `${surahName} "${revelationLocation}"`;
	}

	getTranslation(translationResponse: Surah | null) {
		const text = translationResponse?.ayahs?.[0]?.text;
		if (text == null) return '';
		return `
> 
> ${text}`
	}

	prepareAPIurl(surah: number, edition: string, startAyah: number, ayahRange = 1): string {
		return `https://api.alquran.cloud/v1/surah/${surah}/${edition}?offset=${startAyah}&limit=${ayahRange}`;
	}

	fetchData(surah: number, edition: string, startAyah: number, ayahRange = 1): Promise<Surah> {
		return this.callApi<Surah>(this.prepareAPIurl(surah, edition, startAyah, ayahRange))
			.then(data => {
				// When the requested edition is unknown the API silently falls back to a default
				// one (still HTTP 200), which hides a misconfigured reciter/translation. Surface it.
				if (data.edition?.identifier !== edition) {
					throw new Error(`The Quran edition "${edition}" is not available. Please check the selected reciter and translation in the settings.`);
				}
				return data;
			});
	}

	async callApi<T>(url: string): Promise<T> {
		let response: RequestUrlResponse;
		try {
			response = await RequestUtils.requestUrlWithTimeout(url);
		} catch (error) {
			Logger.error('Quran API request failed', error);
			throw new Error('Could not reach the Quran API. Please check your connection and settings.');
		}

		// The API wraps responses as { code, status, data } and can return HTTP 200 for
		// errors, so the body code has to be checked in addition to the HTTP status.
		const body = response.json;
		const apiCode = (body && typeof body.code === 'number') ? body.code : response.status;
		if (response.status !== 200 || apiCode !== 200) {
			throw new Error(`The Quran API returned an error (code ${apiCode}). Please try again later.`);
		}
		if (body?.data == null) {
			throw new Error('The Quran API returned an unexpected response. Please try again later.');
		}

		return body.data as T;
	}
}
