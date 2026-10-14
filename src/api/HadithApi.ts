import {Hadith} from "../models/Hadith";
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
		let response: RequestUrlResponse;
		try {
			response = await RequestUtils.requestUrlWithTimeout(url);
		} catch (error) {
			Logger.error('Hadith API request failed', error);
			throw new Error('Could not reach the Hadith API. Please check your connection and settings.', { cause: error });
		}

		// A 404 just means this id/language has no hadith (used to retry with another random id);
		// any other failure is a real error and must be surfaced.
		if (response.status === 404) return null;
		if (response.status !== 200) {
			throw new Error(`The Hadith API returned an error (status ${response.status}). Please try again later.`);
		}

		return response.json as T;
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
