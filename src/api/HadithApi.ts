import {Hadith} from "../models/Hadith";
import NoorPlugin from "../main";
import {Surah} from "../models/Surah";
import {requestUrl} from "obsidian";
import {hadiths} from "../constants/hadiths";

export class HadithApi {
	private plugin: NoorPlugin;

	constructor(plugin: NoorPlugin) {
		this.plugin = plugin;
	}

	public async randomHadithQuote() {
		// console.log(hadith)
		let hadith: null | Hadith;
		do {
			hadith = await this.fetchData(this.plugin.settings.hadithLanguage, hadiths[this.plugin.randomGenerator.randomInt() % hadiths.length]);
			// hadith = await this.fetchData(this.plugin.settings.hadithLanguage, 4176);
		} while (hadith == null)

		let moreKeyword = this.plugin.settings.hadithLanguage == 'ar' ? 'مزيد' : 'more';

		return `> [!Quote] [${hadith.grade} - ${hadith.attribution}](https://hadeethenc.com/ar/browse/hadith/${hadith.id})
> ${hadith.hadeeth}
> > [!Quote]+ ${moreKeyword}
${this.getHadithExplanation(hadith)}${this.getHadithWordMeanings(hadith)}${this.getHadithBenefits(hadith)}
`
	}

	fetchData(language: string, id: number): Promise<null | Hadith> {
		return this.callApi<Hadith>(`https://hadeethenc.com/api/v1/hadeeths/one/?language=${language}&id=${id}`);
	}

	callApi<T>(url: string): Promise<null | T> {
		return requestUrl(url)
			.then(response => {
				if (response.status !== 200) {
					return null;
				}
				return response.json as Promise<T>
			}).catch(reason => {
				return null;
			})
	}

	private getHadithWordMeanings(hadith: Hadith) {
		if (hadith.words_meanings == null || hadith.words_meanings.length == 0) return '';
		let title = this.plugin.settings.hadithLanguage == 'ar' ? 'معاني الكلمات' : "Word meanings";
		return `
>> - **${title}**:
` + hadith.words_meanings
			.map(line => {
				return `>>     - **${line.word}**: ${line.meaning}`
			}).join('\n');
	}

	private getHadithBenefits(hadith: Hadith) {
		if (hadith.hints == null || hadith.hints.length == 0) return '';
		let title = this.plugin.settings.hadithLanguage == 'ar' ? 'من فوائد الحديث' : 'Benefits';
		return `
>> - **${title}**:
` + hadith.hints
			.filter(line => line.trim().length > 0)
			.map(line => {
				return `>>     - ${line.replace("\r", "")}`
			}).join('\n');
	}

	private getHadithExplanation(hadith: Hadith) {
		let title = this.plugin.settings.hadithLanguage == 'ar' ? 'الشرح' : 'Explanation';
		return `>> - **${title}**: ${hadith.explanation.replace(/\r\n\r\n/g, '\r\n')}`;
	}
}
