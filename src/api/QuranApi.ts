import {surahs} from "../constants/surahs";
import {Surah} from "../models/Surah";
import {Ayah} from "../models/Ayah";
import type {Edition} from "../models/Edition";
import type {QuranSearchMatch} from "../models/QuranSearchMatch";
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
		const surahNumber = this.plugin.randomGenerator.randomInt() % surahs.length + 1;
		const surah = surahs[surahNumber - 1];
		if (surah == null) throw new Error('Could not select a random surah.');

		const ayah = this.plugin.randomGenerator.randomInt() % surah.numberOfAyahs;

		return this.fetchQuran(surahNumber, ayah);
	}

	public async quranQuoteByCode(code: string) {
		const match = code.trim().match(/^(\d+):(\d+)$/);
		if (match == null) {
			throw new Error("Invalid code format. Please use 'Surah:Ayah', for example 2:255.");
		}

		const surah = Number.parseInt(match[1] ?? '', 10);
		const ayah = Number.parseInt(match[2] ?? '', 10);
		const surahInfo = surahs[surah - 1];
		if (surah < 1 || surah > surahs.length || ayah < 1 || ayah > (surahInfo?.numberOfAyahs ?? 0)) {
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
		if (!this.plugin.settings.showAudio || !ayah.audio) return '';

		return `<audio src="${ayah.audio}" controls>
<p> Audio tag not supported </p>
</audio>

`;
	}

	private getSurahTitle(arabicResponse: Surah) {
		const arabicRevelation = arabicResponse.revelationType == 'Meccan' ? 'مكية' : 'مدنية';
		const revelationLocation = this.plugin.settings.showTranslation ? arabicResponse.revelationType : arabicRevelation;
		const surahName = this.plugin.settings.showTranslation ? arabicResponse.englishName : arabicResponse.name;
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
				// An unknown edition silently falls back to a default one (still HTTP 200),
				// hiding a misconfigured setting. Surface it.
				if (data.edition?.identifier !== edition) {
					throw new Error(`The Quran edition "${edition}" is not available. Please check the selected reciter and translation in the settings.`);
				}
				return data;
			});
	}

	async callApi<T>(url: string): Promise<T> {
		const response = await this.request(url);

		// The API can return HTTP 200 for errors, so the body code is checked too.
		const body = response.json as { code?: unknown; data?: T } | null;
		const apiCode = (body && typeof body.code === 'number') ? body.code : response.status;
		if (response.status !== 200 || apiCode !== 200) {
			Logger.error('Unexpected Quran API response', { status: response.status, code: apiCode, url });
			throw new Error('The Quran API is not responding as expected. Please try again later.');
		}
		if (body == null || body.data == null) {
			throw new Error('The Quran API returned an unexpected response. Please try again later.');
		}

		return body.data;
	}

	/** The text translation editions. */
	public translations(): Promise<Edition[]> {
		return this.callApi<Edition[]>('https://api.alquran.cloud/v1/edition?format=text&type=translation');
	}

	/**
	 * Arabic audio editions with per-ayah recitation: whole-surah editions carry none, and the API
	 * repeats some recitations with a numbered identifier.
	 */
	public async reciters(): Promise<Edition[]> {
		const editions = await this.callApi<Edition[]>('https://api.alquran.cloud/v1/edition?format=audio');
		return editions.filter(edition =>
			edition.language === 'ar'
			&& edition.type !== 'surahbysurah'
			&& !/-\d+$/.test(edition.identifier),
		);
	}

	/** Search an edition for a keyword. A 404 means "no match" and yields an empty list. */
	public async search(query: string, edition: string, limit: number): Promise<QuranSearchMatch[]> {
		const keyword = query.trim();
		if (keyword.length === 0) return [];

		const url = `https://api.alquran.cloud/v1/search/${encodeURIComponent(keyword)}/all/${edition}?limit=${limit}`;
		const response = await this.request(url);

		const body = response.json as { code?: unknown; data?: { matches?: QuranSearchMatch[] } } | null;
		// "No match" comes back as 404, either as the HTTP status or as the body code.
		const apiCode = (body && typeof body.code === 'number') ? body.code : response.status;
		if (apiCode === 404) return [];
		if (response.status !== 200 || apiCode !== 200) {
			Logger.error('Unexpected Quran API response', { status: response.status, code: apiCode, url });
			throw new Error('The Quran API is not responding as expected. Please try again later.');
		}

		return body?.data?.matches ?? [];
	}

	private async request(url: string): Promise<RequestUrlResponse> {
		try {
			return await RequestUtils.requestUrlWithTimeout(url);
		} catch (error) {
			Logger.error('Quran API request failed', error);
			throw new Error('Could not reach the Quran API. Please check your connection and try again.', { cause: error });
		}
	}
}
