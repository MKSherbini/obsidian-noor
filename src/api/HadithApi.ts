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
			hadith = await this.fetchData("ar", hadiths[this.plugin.randomGenerator.randomInt() % hadiths.length]);
		} while (hadith == null)

		return `> [!Quote] [${hadith.grade} - ${hadith.attribution}](https://hadeethenc.com/ar/browse/hadith/${hadith.id})
> ${hadith.hadeeth}
> > [!Quote]+ مزيد
${this.getHadithExplanation(hadith)}${this.getHadithWordMeanings(hadith)}
${this.getHadithBenefits(hadith)}
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
		if (hadith.words_meanings == null) return '';
		let title = 'معاني الكلمات';
		return `
>> - **${title}**:
` + hadith.words_meanings
			.map(line => {
				return `>>     - **${line.word}**: ${line.meaning}`
			}).join('\n');
	}

	private getHadithBenefits(hadith: Hadith) {
		let title = 'من فوائد الحديث';
		return `>> - **${title}**:
` + hadith.hints
			.filter(line => line.trim().length > 0)
			.map(line => {
				return `>>     - ${line}`
			}).join('\n');
	}

	private getHadithExplanation(hadith: Hadith) {
		let title = 'الشرح';
		return `>> - **${title}**: ${hadith.explanation}`;
	}
}
