export interface Hadith {
	id: string
	title: string
	hadeeth: string
	attribution: string
	grade: string
	explanation: string
	hints: Array<string>
	categories: Array<any>
	translations: Array<string>
	words_meanings?: Array<{
		word: string
		meaning: string
	}>
	reference: string
}
