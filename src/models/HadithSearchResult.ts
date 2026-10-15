/** A single match returned by the hadeethenc.com search endpoint. */
export interface HadithSearchResult {
	id: string;
	title: string;
	hadith_text: string;
	hadith_text_highlights?: string;
}
