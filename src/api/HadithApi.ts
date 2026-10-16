import {Hadith} from "../models/Hadith";
import type {HadithLanguage} from "../models/HadithLanguage";
import type {HadithSearchResult} from "../models/HadithSearchResult";
import NoorPlugin from "../main";
import type {RequestUrlResponse} from "obsidian";
import {hadiths} from "../constants/hadiths";
import {Logger} from "../utils/Logger";
import {MarkdownUtils} from "../utils/MarkdownUtils";
import {RequestUtils} from "../utils/RequestUtils";

export class HadithApi {
	private plugin: NoorPlugin;

	constructor(plugin: NoorPlugin) {
		this.plugin = plugin;
	}

	public async randomHadithQuote() {
		const maxAttempts = 30;
		let hadith: null | Hadith = null;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const id = hadiths[this.plugin.randomGenerator.randomInt() % hadiths.length];
			if (id == null) continue;

			hadith = await this.fetchData(this.plugin.settings.hadithLanguage, id);
			if (hadith != null) break;
		}

		if (hadith == null)
			throw new Error('Could not find a Hadith to display. Please try again.');

		return this.formatHadith(hadith);
	}

	public async hadithQuoteByCode(code: string) {
		const id = code.trim();
		if (!/^\d+$/.test(id)) {
			throw new Error("Invalid Hadith code. Please provide a numeric Hadith id.");
		}

		const hadith = await this.fetchData(this.plugin.settings.hadithLanguage, +id);
		if (hadith == null)
			throw new Error(`Hadith ${id} was not found in the selected language.`);

		return this.formatHadith(hadith);
	}


	private formatHadith(hadith: Hadith) {
		return `> [!Quote] [${hadith.grade} - ${hadith.attribution}](https://hadeethenc.com/${this.plugin.settings.hadithLanguage}/browse/hadith/${hadith.id})
${MarkdownUtils.blockquote(hadith.hadeeth)}
${this.getMoreSection(hadith)}
`
	}

	fetchData(language: string, id: number): Promise<null | Hadith> {
		return this.callApi<Hadith>(`https://hadeethenc.com/api/v1/hadeeths/one/?language=${language}&id=${id}`);
	}

	async callApi<T>(url: string): Promise<null | T> {
		const response = await this.request(url);

		// A 404 means this id/language has no hadith (retry with another id); anything else is a real error.
		if (response.status === 404) return null;
		if (response.status !== 200) {
			Logger.error('Unexpected Hadith API status', { status: response.status, url });
			throw new Error('The Hadith API is not responding as expected. Please try again later.');
		}

		return response.json as T;
	}

	/** The languages the API serves, each named in its own language. */
	public async languages(): Promise<HadithLanguage[] | null> {
		return await this.callApi<HadithLanguage[]>('https://hadeethenc.com/api/v1/languages/');
	}

	/** Search by phrase. A 404 or 204 means "no match" and yields an empty list. */
	public async search(query: string, language: string, limit: number): Promise<HadithSearchResult[]> {
		const phrase = query.trim();
		if (phrase.length === 0) return [];

		const url = `https://hadeethenc.com/api/v1/hadeeths/search/?language=${encodeURIComponent(language)}&phrase=${encodeURIComponent(phrase)}&page=1&per_page=${limit}`;
		const response = await this.request(url);
		if (response.status === 404 || response.status === 204) return [];
		if (response.status !== 200) {
			Logger.error('Unexpected Hadith API status', { status: response.status, url });
			throw new Error('The Hadith API is not responding as expected. Please try again later.');
		}

		const results = Array.isArray(response.json) ? response.json as HadithSearchResult[] : [];
		// The endpoint ignores paging and returns the first ~100 matches.
		return results.slice(0, limit);
	}

	private async request(url: string): Promise<RequestUrlResponse> {
		try {
			return await RequestUtils.requestUrlWithTimeout(url);
		} catch (error) {
			Logger.error('Hadith API request failed', error);
			throw new Error('Could not reach the Hadith API. Please check your connection and try again.', { cause: error });
		}
	}

	private getMoreSection(hadith: Hadith) {
		const content = [this.getHadithExplanation(hadith), this.getHadithWordMeanings(hadith), this.getHadithBenefits(hadith)]
			.filter(section => section.length > 0)
			.join('\n');
		if (content.length == 0) return '';

		const moreKeyword = this.plugin.settings.hadithLanguage == 'ar' ? 'مزيد' : 'more';
		return `> > [!Quote]+ ${moreKeyword}
${content}
`;
	}

	private getHadithWordMeanings(hadith: Hadith) {
		if (hadith.words_meanings == null || hadith.words_meanings.length == 0) return '';
		const title = this.plugin.settings.hadithLanguage == 'ar' ? 'معاني الكلمات' : "Word meanings";
		const items = hadith.words_meanings.map(line => `**${line.word}**: ${line.meaning ?? ''}`);
		return MarkdownUtils.section(title, MarkdownUtils.bulletList(items, 2, 1), 2);
	}

	private getHadithBenefits(hadith: Hadith) {
		const items = (hadith.hints ?? [])
			.map(line => line.trim())
			.filter(line => line.length > 0);
		if (items.length == 0) return '';

		const title = this.plugin.settings.hadithLanguage == 'ar' ? 'من فوائد الحديث' : 'Benefits';
		return MarkdownUtils.section(title, MarkdownUtils.bulletList(items, 2, 1), 2);
	}

	private getHadithExplanation(hadith: Hadith) {
		if (hadith.explanation == null || hadith.explanation.length == 0) return '';

		const title = this.plugin.settings.hadithLanguage == 'ar' ? 'الشرح' : 'Explanation';
		return MarkdownUtils.section(title, MarkdownUtils.blockquote(hadith.explanation, 2), 2);
	}
}
