import {App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

let MersenneTwister = require("mersenne-twister")

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	reciter: string;
	translationLanguage: string;
	translationOption: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	reciter: 'ar.abdulbasitmurattal',
	translationLanguage: 'en',
	translationOption: ''
}

const reciterOptions: { [key: string]: any } = {};
const translationLanguagesOptions: { [key: string]: any } = {};
const translationOptionsMap = new Map<string, { [key: string]: any }>();
const g = new MersenneTwister();

export default class NoorPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		reciters.sort((a, b) => a.identifier.localeCompare(b.identifier));
		translations.sort((a, b) => a.identifier.localeCompare(b.identifier));
		// translations.sort((a, b) => a.identifier > b.identifier ? 1 : -1);

		reciters.forEach(reciter => {
			reciterOptions[reciter.identifier] = reciter.englishName;
		})
		translations.forEach(translation => {
			translationLanguagesOptions[translation.language] = translation.language;
			if (!translationOptionsMap.has(translation.language)) translationOptionsMap.set(translation.language, {});
			translationOptionsMap.get(translation.language)![translation.identifier] = translation.name;
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'random-quran-quote',
			name: 'Random quran quote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				let surah = g.randomInt() % 114;
				let ayah = g.randomInt() % surahs[surah].numberOfAyahs;
				console.log(surah)
				console.log(ayah)
				const [arabicResponse, translationResponse] = await Promise.all([
					this.fetchData(surah, this.settings.reciter, ayah),
					this.fetchData(surah, this.settings.translationOption, ayah)
				]);
				console.log(arabicResponse)
				console.log(translationResponse)
				editor.setSelection({line: editor.getCursor().line, ch: editor.getCursor().ch});
				if (editor.getCursor().ch > 1)
					editor.replaceSelection("\n")
				editor.replaceSelection(`> [!Quote] "${arabicResponse.revelationType} Surah" ${arabicResponse.englishName} - [[${arabicResponse.number}:${arabicResponse.ayahs![0].numberInSurah}](https://surahquran.com/english.php?sora=${arabicResponse.number}&aya=${arabicResponse.ayahs![0].numberInSurah})]  ([Recitation](${arabicResponse.ayahs![0].audio}))
> 
> ${arabicResponse.ayahs![0].text}
> 
> ${translationResponse.ayahs![0].text}

`);
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

	prepareAPIurl(surah: number, edition: string, startAyah: number, ayahRange = 1): string {
		// console.log(`https://api.alquran.cloud/v1/surah/${surah}/${edition}?offset=${startAyah}&limit=${ayahRange}`)
		return `https://api.alquran.cloud/v1/surah/${surah}/${edition}?offset=${startAyah}&limit=${ayahRange}`;
	}

	fetchData(surah: number, edition: string, startAyah: number, ayahRange = 1): Promise<Surah> {
		return this.callApi<Surah>(this.prepareAPIurl(surah, edition, startAyah, ayahRange));
	}

	callApi<T>(url: string): Promise<T> {
		return fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error(response.statusText)
				}
				return response.json() as Promise<{ data: T }>
			})
			.then(data => {
				return data.data
			})
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		console.log(this.settings)
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class NoorSettingTab extends PluginSettingTab {
	plugin: NoorPlugin;

	constructor(app: App, plugin: NoorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Noor Settings'});

		new Setting(containerEl)
			.setName('Translation Language')
			.setDesc('Which translation language to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(translationLanguagesOptions)
					.setValue(this.plugin.settings.translationLanguage)
					.onChange(async (value) => {
						this.plugin.settings.translationLanguage = value
						this.plugin.settings.translationOption = '';
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName('Translation Options')
			.setDesc('Which translation to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(translationOptionsMap.get(this.plugin.settings.translationLanguage)!)
					.setValue(this.plugin.settings.translationOption == '' ?
						Object.keys(translationOptionsMap.get(this.plugin.settings.translationLanguage)!)[0] :
						this.plugin.settings.translationOption)
					.onChange(async (value) => {
						this.plugin.settings.translationOption = value
						await this.plugin.saveSettings();
					});

			});

	}
}

interface Ayah {
	number: number;
	audio?: string;
	audioSecondary?: string[];
	text: string;
	numberInSurah: number;
	juz: number;
	manzil: number;
	page: number;
	ruku: number;
	hizbQuarter: number;
	sajda: boolean;
}

interface Edition {
	identifier: string;
	language: string;
	name: string;
	englishName: string;
	format: string;
	type: string;
	direction: string | null;
}

interface Surah {
	number: number;
	name: string;
	englishName: string;
	englishNameTranslation: string;
	revelationType: string;
	numberOfAyahs: number;
	ayahs?: Ayah[];
	edition?: Edition;
}

// Create the array of surah objects

const surahs: Surah[] = [
	{
		number: 1,
		name: "سُورَةُ ٱلْفَاتِحَةِ",
		englishName: "Al-Faatiha",
		englishNameTranslation: "The Opening",
		numberOfAyahs: 7,
		revelationType: "Meccan"
	},
	{
		number: 2,
		name: "سُورَةُ البَقَرَةِ",
		englishName: "Al-Baqara",
		englishNameTranslation: "The Cow",
		numberOfAyahs: 286,
		revelationType: "Medinan"
	},
	{
		number: 3,
		name: "سُورَةُ آلِ عِمۡرَانَ",
		englishName: "Aal-i-Imraan",
		englishNameTranslation: "The Family of Imraan",
		numberOfAyahs: 200,
		revelationType: "Medinan"
	},
	{
		number: 4,
		name: "سُورَةُ النِّسَاءِ",
		englishName: "An-Nisaa",
		englishNameTranslation: "The Women",
		numberOfAyahs: 176,
		revelationType: "Medinan"
	},
	{
		number: 5,
		name: "سُورَةُ المَائـِدَةِ",
		englishName: "Al-Maaida",
		englishNameTranslation: "The Table",
		numberOfAyahs: 120,
		revelationType: "Medinan"
	},
	{
		number: 6,
		name: "سُورَةُ الأَنۡعَامِ",
		englishName: "Al-An'aam",
		englishNameTranslation: "The Cattle",
		numberOfAyahs: 165,
		revelationType: "Meccan"
	},
	{
		number: 7,
		name: "سُورَةُ الأَعۡرَافِ",
		englishName: "Al-A'raaf",
		englishNameTranslation: "The Heights",
		numberOfAyahs: 206,
		revelationType: "Meccan"
	},
	{
		number: 8,
		name: "سُورَةُ الأَنفَالِ",
		englishName: "Al-Anfaal",
		englishNameTranslation: "The Spoils of War",
		numberOfAyahs: 75,
		revelationType: "Medinan"
	},
	{
		number: 9,
		name: "سُورَةُ التَّوۡبَةِ",
		englishName: "At-Tawba",
		englishNameTranslation: "The Repentance",
		numberOfAyahs: 129,
		revelationType: "Medinan"
	},
	{
		number: 10,
		name: "سُورَةُ يُونُسَ",
		englishName: "Yunus",
		englishNameTranslation: "Jonas",
		numberOfAyahs: 109,
		revelationType: "Meccan"
	},
	{
		number: 11,
		name: "سُورَةُ هُودٍ",
		englishName: "Hud",
		englishNameTranslation: "Hud",
		numberOfAyahs: 123,
		revelationType: "Meccan"
	},
	{
		number: 12,
		name: "سُورَةُ يُوسُفَ",
		englishName: "Yusuf",
		englishNameTranslation: "Joseph",
		numberOfAyahs: 111,
		revelationType: "Meccan"
	},
	{
		number: 13,
		name: "سُورَةُ الرَّعۡدِ",
		englishName: "Ar-Ra'd",
		englishNameTranslation: "The Thunder",
		numberOfAyahs: 43,
		revelationType: "Medinan"
	},
	{
		number: 14,
		name: "سُورَةُ إِبۡرَاهِيمَ",
		englishName: "Ibrahim",
		englishNameTranslation: "Abraham",
		numberOfAyahs: 52,
		revelationType: "Meccan"
	},
	{
		number: 15,
		name: "سُورَةُ الحِجۡرِ",
		englishName: "Al-Hijr",
		englishNameTranslation: "The Rock",
		numberOfAyahs: 99,
		revelationType: "Meccan"
	},
	{
		number: 16,
		name: "سُورَةُ النَّحۡلِ",
		englishName: "An-Nahl",
		englishNameTranslation: "The Bee",
		numberOfAyahs: 128,
		revelationType: "Meccan"
	},
	{
		number: 17,
		name: "سُورَةُ الإِسۡرَاءِ",
		englishName: "Al-Israa",
		englishNameTranslation: "The Night Journey",
		numberOfAyahs: 111,
		revelationType: "Meccan"
	},
	{
		number: 18,
		name: "سُورَةُ الكَهۡفِ",
		englishName: "Al-Kahf",
		englishNameTranslation: "The Cave",
		numberOfAyahs: 110,
		revelationType: "Meccan"
	},
	{
		number: 19,
		name: "سُورَةُ مَرۡيَمَ",
		englishName: "Maryam",
		englishNameTranslation: "Mary",
		numberOfAyahs: 98,
		revelationType: "Meccan"
	},
	{
		number: 20,
		name: "سُورَةُ طه",
		englishName: "Taa-Haa",
		englishNameTranslation: "Taa-Haa",
		numberOfAyahs: 135,
		revelationType: "Meccan"
	},
	{
		number: 21,
		name: "سُورَةُ الأَنبِيَاءِ",
		englishName: "Al-Anbiyaa",
		englishNameTranslation: "The Prophets",
		numberOfAyahs: 112,
		revelationType: "Meccan"
	},
	{
		number: 22,
		name: "سُورَةُ الحَجِّ",
		englishName: "Al-Hajj",
		englishNameTranslation: "The Pilgrimage",
		numberOfAyahs: 78,
		revelationType: "Medinan"
	},
	{
		number: 23,
		name: "سُورَةُ المُؤۡمِنُونَ",
		englishName: "Al-Muminoon",
		englishNameTranslation: "The Believers",
		numberOfAyahs: 118,
		revelationType: "Meccan"
	},
	{
		number: 24,
		name: "سُورَةُ النُّورِ",
		englishName: "An-Noor",
		englishNameTranslation: "The Light",
		numberOfAyahs: 64,
		revelationType: "Medinan"
	},
	{
		number: 25,
		name: "سُورَةُ الفُرۡقَانِ",
		englishName: "Al-Furqaan",
		englishNameTranslation: "The Criterion",
		numberOfAyahs: 77,
		revelationType: "Meccan"
	},
	{
		number: 26,
		name: "سُورَةُ الشُّعَرَاءِ",
		englishName: "Ash-Shu'araa",
		englishNameTranslation: "The Poets",
		numberOfAyahs: 227,
		revelationType: "Meccan"
	},
	{
		number: 27,
		name: "سُورَةُ النَّمۡلِ",
		englishName: "An-Naml",
		englishNameTranslation: "The Ant",
		numberOfAyahs: 93,
		revelationType: "Meccan"
	},
	{
		number: 28,
		name: "سُورَةُ القَصَصِ",
		englishName: "Al-Qasas",
		englishNameTranslation: "The Stories",
		numberOfAyahs: 88,
		revelationType: "Meccan"
	},
	{
		number: 29,
		name: "سُورَةُ العَنكَبُوتِ",
		englishName: "Al-Ankaboot",
		englishNameTranslation: "The Spider",
		numberOfAyahs: 69,
		revelationType: "Meccan"
	},
	{
		number: 30,
		name: "سُورَةُ الرُّومِ",
		englishName: "Ar-Room",
		englishNameTranslation: "The Romans",
		numberOfAyahs: 60,
		revelationType: "Meccan"
	},
	{
		number: 31,
		name: "سُورَةُ لُقۡمَانَ",
		englishName: "Luqman",
		englishNameTranslation: "Luqman",
		numberOfAyahs: 34,
		revelationType: "Meccan"
	},
	{
		number: 32,
		name: "سُورَةُ السَّجۡدَةِ",
		englishName: "As-Sajda",
		englishNameTranslation: "The Prostration",
		numberOfAyahs: 30,
		revelationType: "Meccan"
	},
	{
		number: 33,
		name: "سُورَةُ الأَحۡزَابِ",
		englishName: "Al-Ahzaab",
		englishNameTranslation: "The Clans",
		numberOfAyahs: 73,
		revelationType: "Medinan"
	},
	{
		number: 34,
		name: "سُورَةُ سَبَإٍ",
		englishName: "Saba",
		englishNameTranslation: "Sheba",
		numberOfAyahs: 54,
		revelationType: "Meccan"
	},
	{
		number: 35,
		name: "سُورَةُ فَاطِرٍ",
		englishName: "Faatir",
		englishNameTranslation: "The Originator",
		numberOfAyahs: 45,
		revelationType: "Meccan"
	},
	{
		number: 36,
		name: "سُورَةُ يسٓ",
		englishName: "Yaseen",
		englishNameTranslation: "Yaseen",
		numberOfAyahs: 83,
		revelationType: "Meccan"
	},
	{
		number: 37,
		name: "سُورَةُ الصَّافَّاتِ",
		englishName: "As-Saaffaat",
		englishNameTranslation: "Those drawn up in Ranks",
		numberOfAyahs: 182,
		revelationType: "Meccan"
	},
	{
		number: 38,
		name: "سُورَةُ صٓ",
		englishName: "Saad",
		englishNameTranslation: "The letter Saad",
		numberOfAyahs: 88,
		revelationType: "Meccan"
	},
	{
		number: 39,
		name: "سُورَةُ الزُّمَرِ",
		englishName: "Az-Zumar",
		englishNameTranslation: "The Groups",
		numberOfAyahs: 75,
		revelationType: "Meccan"
	},
	{
		number: 40,
		name: "سُورَةُ غَافِرٍ",
		englishName: "Ghafir",
		englishNameTranslation: "The Forgiver",
		numberOfAyahs: 85,
		revelationType: "Meccan"
	},
	{
		number: 41,
		name: "سُورَةُ فُصِّلَتۡ",
		englishName: "Fussilat",
		englishNameTranslation: "Explained in detail",
		numberOfAyahs: 54,
		revelationType: "Meccan"
	},
	{
		number: 42,
		name: "سُورَةُ الشُّورَىٰ",
		englishName: "Ash-Shura",
		englishNameTranslation: "Consultation",
		numberOfAyahs: 53,
		revelationType: "Meccan"
	},
	{
		number: 43,
		name: "سُورَةُ الزُّخۡرُفِ",
		englishName: "Az-Zukhruf",
		englishNameTranslation: "Ornaments of gold",
		numberOfAyahs: 89,
		revelationType: "Meccan"
	},
	{
		number: 44,
		name: "سُورَةُ الدُّخَانِ",
		englishName: "Ad-Dukhaan",
		englishNameTranslation: "The Smoke",
		numberOfAyahs: 59,
		revelationType: "Meccan"
	},
	{
		number: 45,
		name: "سُورَةُ الجَاثِيَةِ",
		englishName: "Al-Jaathiya",
		englishNameTranslation: "Crouching",
		numberOfAyahs: 37,
		revelationType: "Meccan"
	},
	{
		number: 46,
		name: "سُورَةُ الأَحۡقَافِ",
		englishName: "Al-Ahqaf",
		englishNameTranslation: "The Dunes",
		numberOfAyahs: 35,
		revelationType: "Meccan"
	},
	{
		number: 47,
		name: "سُورَةُ مُحَمَّدٍ",
		englishName: "Muhammad",
		englishNameTranslation: "Muhammad",
		numberOfAyahs: 38,
		revelationType: "Medinan"
	},
	{
		number: 48,
		name: "سُورَةُ الفَتۡحِ",
		englishName: "Al-Fath",
		englishNameTranslation: "The Victory",
		numberOfAyahs: 29,
		revelationType: "Medinan"
	},
	{
		number: 49,
		name: "سُورَةُ الحُجُرَاتِ",
		englishName: "Al-Hujuraat",
		englishNameTranslation: "The Inner Apartments",
		numberOfAyahs: 18,
		revelationType: "Medinan"
	},
	{
		number: 50,
		name: "سُورَةُ قٓ",
		englishName: "Qaaf",
		englishNameTranslation: "The letter Qaaf",
		numberOfAyahs: 45,
		revelationType: "Meccan"
	},
	{
		number: 51,
		name: "سُورَةُ الذَّارِيَاتِ",
		englishName: "Adh-Dhaariyat",
		englishNameTranslation: "The Winnowing Winds",
		numberOfAyahs: 60,
		revelationType: "Meccan"
	},
	{
		number: 52,
		name: "سُورَةُ الطُّورِ",
		englishName: "At-Tur",
		englishNameTranslation: "The Mount",
		numberOfAyahs: 49,
		revelationType: "Meccan"
	},
	{
		number: 53,
		name: "سُورَةُ النَّجۡمِ",
		englishName: "An-Najm",
		englishNameTranslation: "The Star",
		numberOfAyahs: 62,
		revelationType: "Meccan"
	},
	{
		number: 54,
		name: "سُورَةُ القَمَرِ",
		englishName: "Al-Qamar",
		englishNameTranslation: "The Moon",
		numberOfAyahs: 55,
		revelationType: "Meccan"
	},
	{
		number: 55,
		name: "سُورَةُ الرَّحۡمَٰن",
		englishName: "Ar-Rahmaan",
		englishNameTranslation: "The Beneficent",
		numberOfAyahs: 78,
		revelationType: "Medinan"
	},
	{
		number: 56,
		name: "سُورَةُ الوَاقِعَةِ",
		englishName: "Al-Waaqia",
		englishNameTranslation: "The Inevitable",
		numberOfAyahs: 96,
		revelationType: "Meccan"
	},
	{
		number: 57,
		name: "سُورَةُ الحَدِيدِ",
		englishName: "Al-Hadid",
		englishNameTranslation: "The Iron",
		numberOfAyahs: 29,
		revelationType: "Medinan"
	},
	{
		number: 58,
		name: "سُورَةُ المُجَادلَةِ",
		englishName: "Al-Mujaadila",
		englishNameTranslation: "The Pleading Woman",
		numberOfAyahs: 22,
		revelationType: "Medinan"
	},
	{
		number: 59,
		name: "سُورَةُ الحَشۡرِ",
		englishName: "Al-Hashr",
		englishNameTranslation: "The Exile",
		numberOfAyahs: 24,
		revelationType: "Medinan"
	},
	{
		number: 60,
		name: "سُورَةُ المُمۡتَحنَةِ",
		englishName: "Al-Mumtahana",
		englishNameTranslation: "She that is to be examined",
		numberOfAyahs: 13,
		revelationType: "Medinan"
	},
	{
		number: 61,
		name: "سُورَةُ الصَّفِّ",
		englishName: "As-Saff",
		englishNameTranslation: "The Ranks",
		numberOfAyahs: 14,
		revelationType: "Medinan"
	},
	{
		number: 62,
		name: "سُورَةُ الجُمُعَةِ",
		englishName: "Al-Jumu'a",
		englishNameTranslation: "Friday",
		numberOfAyahs: 11,
		revelationType: "Medinan"
	},
	{
		number: 63,
		name: "سُورَةُ المُنَافِقُونَ",
		englishName: "Al-Munaafiqoon",
		englishNameTranslation: "The Hypocrites",
		numberOfAyahs: 11,
		revelationType: "Medinan"
	},
	{
		number: 64,
		name: "سُورَةُ التَّغَابُنِ",
		englishName: "At-Taghaabun",
		englishNameTranslation: "Mutual Disillusion",
		numberOfAyahs: 18,
		revelationType: "Medinan"
	},
	{
		number: 65,
		name: "سُورَةُ الطَّلَاقِ",
		englishName: "At-Talaaq",
		englishNameTranslation: "Divorce",
		numberOfAyahs: 12,
		revelationType: "Medinan"
	},
	{
		number: 66,
		name: "سُورَةُ التَّحۡرِيمِ",
		englishName: "At-Tahrim",
		englishNameTranslation: "The Prohibition",
		numberOfAyahs: 12,
		revelationType: "Medinan"
	},
	{
		number: 67,
		name: "سُورَةُ المُلۡكِ",
		englishName: "Al-Mulk",
		englishNameTranslation: "The Sovereignty",
		numberOfAyahs: 30,
		revelationType: "Meccan"
	},
	{
		number: 68,
		name: "سُورَةُ القَلَمِ",
		englishName: "Al-Qalam",
		englishNameTranslation: "The Pen",
		numberOfAyahs: 52,
		revelationType: "Meccan"
	},
	{
		number: 69,
		name: "سُورَةُ الحَاقَّةِ",
		englishName: "Al-Haaqqa",
		englishNameTranslation: "The Reality",
		numberOfAyahs: 52,
		revelationType: "Meccan"
	},
	{
		number: 70,
		name: "سُورَةُ المَعَارِجِ",
		englishName: "Al-Ma'aarij",
		englishNameTranslation: "The Ascending Stairways",
		numberOfAyahs: 44,
		revelationType: "Meccan"
	},
	{
		number: 71,
		name: "سُورَةُ نُوحٍ",
		englishName: "Nooh",
		englishNameTranslation: "Noah",
		numberOfAyahs: 28,
		revelationType: "Meccan"
	},
	{
		number: 72,
		name: "سُورَةُ الجِنِّ",
		englishName: "Al-Jinn",
		englishNameTranslation: "The Jinn",
		numberOfAyahs: 28,
		revelationType: "Meccan"
	},
	{
		number: 73,
		name: "سُورَةُ المُزَّمِّلِ",
		englishName: "Al-Muzzammil",
		englishNameTranslation: "The Enshrouded One",
		numberOfAyahs: 20,
		revelationType: "Meccan"
	},
	{
		number: 74,
		name: "سُورَةُ المُدَّثِّرِ",
		englishName: "Al-Muddaththir",
		englishNameTranslation: "The Cloaked One",
		numberOfAyahs: 56,
		revelationType: "Meccan"
	},
	{
		number: 75,
		name: "سُورَةُ القِيَامَةِ",
		englishName: "Al-Qiyaama",
		englishNameTranslation: "The Resurrection",
		numberOfAyahs: 40,
		revelationType: "Meccan"
	},
	{
		number: 76,
		name: "سُورَةُ الإِنسَانِ",
		englishName: "Al-Insaan",
		englishNameTranslation: "Man",
		numberOfAyahs: 31,
		revelationType: "Medinan"
	},
	{
		number: 77,
		name: "سُورَةُ المُرۡسَلَاتِ",
		englishName: "Al-Mursalaat",
		englishNameTranslation: "The Emissaries",
		numberOfAyahs: 50,
		revelationType: "Meccan"
	},
	{
		number: 78,
		name: "سُورَةُ النَّبَإِ",
		englishName: "An-Naba",
		englishNameTranslation: "The Announcement",
		numberOfAyahs: 40,
		revelationType: "Meccan"
	},
	{
		number: 79,
		name: "سُورَةُ النَّازِعَاتِ",
		englishName: "An-Naazi'aat",
		englishNameTranslation: "Those who drag forth",
		numberOfAyahs: 46,
		revelationType: "Meccan"
	},
	{
		number: 80,
		name: "سُورَةُ عَبَسَ",
		englishName: "Abasa",
		englishNameTranslation: "He frowned",
		numberOfAyahs: 42,
		revelationType: "Meccan"
	},
	{
		number: 81,
		name: "سُورَةُ التَّكۡوِيرِ",
		englishName: "At-Takwir",
		englishNameTranslation: "The Overthrowing",
		numberOfAyahs: 29,
		revelationType: "Meccan"
	},
	{
		number: 82,
		name: "سُورَةُ الانفِطَارِ",
		englishName: "Al-Infitaar",
		englishNameTranslation: "The Cleaving",
		numberOfAyahs: 19,
		revelationType: "Meccan"
	},
	{
		number: 83,
		name: "سُورَةُ المُطَفِّفِينَ",
		englishName: "Al-Mutaffifin",
		englishNameTranslation: "Defrauding",
		numberOfAyahs: 36,
		revelationType: "Meccan"
	},
	{
		number: 84,
		name: "سُورَةُ الانشِقَاقِ",
		englishName: "Al-Inshiqaaq",
		englishNameTranslation: "The Splitting Open",
		numberOfAyahs: 25,
		revelationType: "Meccan"
	},
	{
		number: 85,
		name: "سُورَةُ البُرُوجِ",
		englishName: "Al-Burooj",
		englishNameTranslation: "The Constellations",
		numberOfAyahs: 22,
		revelationType: "Meccan"
	},
	{
		number: 86,
		name: "سُورَةُ الطَّارِقِ",
		englishName: "At-Taariq",
		englishNameTranslation: "The Morning Star",
		numberOfAyahs: 17,
		revelationType: "Meccan"
	},
	{
		number: 87,
		name: "سُورَةُ الأَعۡلَىٰ",
		englishName: "Al-A'laa",
		englishNameTranslation: "The Most High",
		numberOfAyahs: 19,
		revelationType: "Meccan"
	},
	{
		number: 88,
		name: "سُورَةُ الغَاشِيَةِ",
		englishName: "Al-Ghaashiya",
		englishNameTranslation: "The Overwhelming",
		numberOfAyahs: 26,
		revelationType: "Meccan"
	},
	{
		number: 89,
		name: "سُورَةُ الفَجۡرِ",
		englishName: "Al-Fajr",
		englishNameTranslation: "The Dawn",
		numberOfAyahs: 30,
		revelationType: "Meccan"
	},
	{
		number: 90,
		name: "سُورَةُ البَلَدِ",
		englishName: "Al-Balad",
		englishNameTranslation: "The City",
		numberOfAyahs: 20,
		revelationType: "Meccan"
	},
	{
		number: 91,
		name: "سُورَةُ الشَّمۡسِ",
		englishName: "Ash-Shams",
		englishNameTranslation: "The Sun",
		numberOfAyahs: 15,
		revelationType: "Meccan"
	},
	{
		number: 92,
		name: "سُورَةُ اللَّيۡلِ",
		englishName: "Al-Lail",
		englishNameTranslation: "The Night",
		numberOfAyahs: 21,
		revelationType: "Meccan"
	},
	{
		number: 93,
		name: "سُورَةُ الضُّحَىٰ",
		englishName: "Ad-Dhuhaa",
		englishNameTranslation: "The Morning Hours",
		numberOfAyahs: 11,
		revelationType: "Meccan"
	},
	{
		number: 94,
		name: "سُورَةُ الشَّرۡحِ",
		englishName: "Ash-Sharh",
		englishNameTranslation: "The Consolation",
		numberOfAyahs: 8,
		revelationType: "Meccan"
	},
	{
		number: 95,
		name: "سُورَةُ التِّينِ",
		englishName: "At-Tin",
		englishNameTranslation: "The Fig",
		numberOfAyahs: 8,
		revelationType: "Meccan"
	},
	{
		number: 96,
		name: "سُورَةُ العَلَقِ",
		englishName: "Al-Alaq",
		englishNameTranslation: "The Clot",
		numberOfAyahs: 19,
		revelationType: "Meccan"
	},
	{
		number: 97,
		name: "سُورَةُ القَدۡرِ",
		englishName: "Al-Qadr",
		englishNameTranslation: "The Power, Fate",
		numberOfAyahs: 5,
		revelationType: "Meccan"
	},
	{
		number: 98,
		name: "سُورَةُ البَيِّنَةِ",
		englishName: "Al-Bayyina",
		englishNameTranslation: "The Evidence",
		numberOfAyahs: 8,
		revelationType: "Medinan"
	},
	{
		number: 99,
		name: "سُورَةُ الزَّلۡزَلَةِ",
		englishName: "Az-Zalzala",
		englishNameTranslation: "The Earthquake",
		numberOfAyahs: 8,
		revelationType: "Medinan"
	},
	{
		number: 100,
		name: "سُورَةُ العَادِيَاتِ",
		englishName: "Al-Aadiyaat",
		englishNameTranslation: "The Chargers",
		numberOfAyahs: 11,
		revelationType: "Meccan"
	},
	{
		number: 101,
		name: "سُورَةُ القَارِعَةِ",
		englishName: "Al-Qaari'a",
		englishNameTranslation: "The Calamity",
		numberOfAyahs: 11,
		revelationType: "Meccan"
	},
	{
		number: 102,
		name: "سُورَةُ التَّكَاثُرِ",
		englishName: "At-Takaathur",
		englishNameTranslation: "Competition",
		numberOfAyahs: 8,
		revelationType: "Meccan"
	},
	{
		number: 103,
		name: "سُورَةُ العَصۡرِ",
		englishName: "Al-Asr",
		englishNameTranslation: "The Declining Day, Epoch",
		numberOfAyahs: 3,
		revelationType: "Meccan"
	},
	{
		number: 104,
		name: "سُورَةُ الهُمَزَةِ",
		englishName: "Al-Humaza",
		englishNameTranslation: "The Traducer",
		numberOfAyahs: 9,
		revelationType: "Meccan"
	},
	{
		number: 105,
		name: "سُورَةُ الفِيلِ",
		englishName: "Al-Fil",
		englishNameTranslation: "The Elephant",
		numberOfAyahs: 5,
		revelationType: "Meccan"
	},
	{
		number: 106,
		name: "سُورَةُ قُرَيۡشٍ",
		englishName: "Quraish",
		englishNameTranslation: "Quraysh",
		numberOfAyahs: 4,
		revelationType: "Meccan"
	},
	{
		number: 107,
		name: "سُورَةُ المَاعُونِ",
		englishName: "Al-Maa'un",
		englishNameTranslation: "Almsgiving",
		numberOfAyahs: 7,
		revelationType: "Meccan"
	},
	{
		number: 108,
		name: "سُورَةُ الكَوۡثَرِ",
		englishName: "Al-Kawthar",
		englishNameTranslation: "Abundance",
		numberOfAyahs: 3,
		revelationType: "Meccan"
	},
	{
		number: 109,
		name: "سُورَةُ الكَافِرُونَ",
		englishName: "Al-Kaafiroon",
		englishNameTranslation: "The Disbelievers",
		numberOfAyahs: 6,
		revelationType: "Meccan"
	},
	{
		number: 110,
		name: "سُورَةُ النَّصۡرِ",
		englishName: "An-Nasr",
		englishNameTranslation: "Divine Support",
		numberOfAyahs: 3,
		revelationType: "Medinan"
	},
	{
		number: 111,
		name: "سُورَةُ المَسَدِ",
		englishName: "Al-Masad",
		englishNameTranslation: "The Palm Fibre",
		numberOfAyahs: 5,
		revelationType: "Meccan"
	},
	{
		number: 112,
		name: "سُورَةُ الإِخۡلَاصِ",
		englishName: "Al-Ikhlaas",
		englishNameTranslation: "Sincerity",
		numberOfAyahs: 4,
		revelationType: "Meccan"
	},
	{
		number: 113,
		name: "سُورَةُ الفَلَقِ",
		englishName: "Al-Falaq",
		englishNameTranslation: "The Dawn",
		numberOfAyahs: 5,
		revelationType: "Meccan"
	},
	{
		number: 114,
		name: "سُورَةُ النَّاسِ",
		englishName: "An-Naas",
		englishNameTranslation: "Mankind",
		numberOfAyahs: 6,
		revelationType: "Meccan"
	}
];

const reciters: Edition[] = [
	{
		identifier: "ar.abdulbasitmurattal",
		language: "ar",
		name: "عبد الباسط عبد الصمد المرتل",
		englishName: "Abdul Basit",
		format: "audio",
		type: "translation",
		direction: null
	},
	{
		identifier: "ar.abdullahbasfar",
		language: "ar",
		name: "عبد الله بصفر",
		englishName: "Abdullah Basfar",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.abdurrahmaansudais",
		language: "ar",
		name: "عبدالرحمن السديس",
		englishName: "Abdurrahmaan As-Sudais",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.abdulsamad",
		language: "ar",
		name: "عبدالباسط عبدالصمد",
		englishName: "Abdul Samad",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.shaatree",
		language: "ar",
		name: "أبو بكر الشاطري",
		englishName: "Abu Bakr Ash-Shaatree",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.ahmedajamy",
		language: "ar",
		name: "أحمد بن علي العجمي",
		englishName: "Ahmed ibn Ali al-Ajamy",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.alafasy",
		language: "ar",
		name: "مشاري العفاسي",
		englishName: "Alafasy",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.hanirifai",
		language: "ar",
		name: "هاني الرفاعي",
		englishName: "Hani Rifai",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.husary",
		language: "ar",
		name: "محمود خليل الحصري",
		englishName: "Husary",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.husarymujawwad",
		language: "ar",
		name: "محمود خليل الحصري (المجود)",
		englishName: "Husary (Mujawwad)",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.hudhaify",
		language: "ar",
		name: "علي بن عبدالرحمن الحذيفي",
		englishName: "Hudhaify",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.ibrahimakhbar",
		language: "ar",
		name: "إبراهيم الأخضر",
		englishName: "Ibrahim Akhdar",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.mahermuaiqly",
		language: "ar",
		name: "ماهر المعيقلي",
		englishName: "Maher Al Muaiqly",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.minshawi",
		language: "ar",
		name: "محمد صديق المنشاوي",
		englishName: "Minshawi",
		format: "audio",
		type: "translation",
		direction: null
	},
	{
		identifier: "ar.minshawimujawwad",
		language: "ar",
		name: "محمد صديق المنشاوي (المجود)",
		englishName: "Minshawy (Mujawwad)",
		format: "audio",
		type: "translation",
		direction: null
	},
	{
		identifier: "ar.muhammadayyoub",
		language: "ar",
		name: "محمد أيوب",
		englishName: "Muhammad Ayyoub",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.muhammadjibreel",
		language: "ar",
		name: "محمد جبريل",
		englishName: "Muhammad Jibreel",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.saoodshuraym",
		language: "ar",
		name: "سعود الشريم",
		englishName: "Saood bin Ibraaheem Ash-Shuraym",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.parhizgar",
		language: "ar",
		name: "شهریار پرهیزگار",
		englishName: "Parhizgar",
		format: "audio",
		type: "versebyverse",
		direction: null
	},
	{
		identifier: "ar.aymanswoaid",
		language: "ar",
		name: "أيمن سويد",
		englishName: "Ayman Sowaid",
		format: "audio",
		type: "versebyverse",
		direction: null
	}
];

const translations: Edition[] = [
	{
		identifier: "az.mammadaliyev",
		language: "az",
		name: "Məmmədəliyev & Bünyadov",
		englishName: "Vasim Mammadaliyev and Ziya Bunyadov",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "az.musayev",
		language: "az",
		name: "Musayev",
		englishName: "Alikhan Musayev",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "bn.bengali",
		language: "bn",
		name: "মুহিউদ্দীন খান",
		englishName: "Muhiuddin Khan",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "cs.hrbek",
		language: "cs",
		name: "Hrbek",
		englishName: "Preklad I. Hrbek",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "cs.nykl",
		language: "cs",
		name: "Nykl",
		englishName: "A. R. Nykl",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "de.aburida",
		language: "de",
		name: "Abu Rida",
		englishName: "Abu Rida Muhammad ibn Ahmad ibn Rassoul",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "de.bubenheim",
		language: "de",
		name: "Bubenheim & Elyas",
		englishName: "A. S. F. Bubenheim and N. Elyas",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "de.khoury",
		language: "de",
		name: "Khoury",
		englishName: "Adel Theodor Khoury",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "de.zaidan",
		language: "de",
		name: "Zaidan",
		englishName: "Amir Zaidan",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "dv.divehi",
		language: "dv",
		name: "ދިވެހި",
		englishName: "Office of the President of Maldives",
		format: "text",
		type: "translation",
		direction: "rtl"
	},
	{
		identifier: "en.ahmedali",
		language: "en",
		name: "Ahmed Ali",
		englishName: "Ahmed Ali",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.ahmedraza",
		language: "en",
		name: "Ahmed Raza Khan",
		englishName: "Ahmed Raza Khan",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.arberry",
		language: "en",
		name: "Arberry",
		englishName: "A. J. Arberry",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.asad",
		language: "en",
		name: "Asad",
		englishName: "Muhammad Asad",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.daryabadi",
		language: "en",
		name: "Daryabadi",
		englishName: "Abdul Majid Daryabadi",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.hilali",
		language: "en",
		name: "Hilali & Khan",
		englishName: "Muhammad Taqi-ud-Din al-Hilali and Muhammad Muhsin Khan",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.pickthall",
		language: "en",
		name: "Pickthall",
		englishName: "Mohammed Marmaduke William Pickthall",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.qaribullah",
		language: "en",
		name: "Qaribullah & Darwish",
		englishName: "Hasan al-Fatih Qaribullah and Ahmad Darwish",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.sahih",
		language: "en",
		name: "Saheeh International",
		englishName: "Saheeh International",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.sarwar",
		language: "en",
		name: "Sarwar",
		englishName: "Muhammad Sarwar",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "en.yusufali",
		language: "en",
		name: "Yusuf Ali",
		englishName: "Abdullah Yusuf Ali",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "fa.ayati",
		language: "fa",
		name: "آیتی",
		englishName: "AbdolMohammad Ayati",
		format: "text",
		type: "translation",
		direction: "rtl"
	},
	{
		identifier: "fa.fooladvand",
		language: "fa",
		name: "فولادوند",
		englishName: "Mohammad Mahdi Fooladvand",
		format: "text",
		type: "translation",
		direction: "rtl"
	},
	{
		identifier: "fa.ghomshei",
		language: "fa",
		name: "الهی قمشهای",
		englishName: "Mahdi Elahi Ghomshei",
		format: "text",
		type: "translation",
		direction: "rtl"
	},
	{
		identifier: "fa.makarem",
		language: "fa",
		name: "مکارم شیرازی",
		englishName: "Naser Makarem Shirazi",
		format: "text",
		type: "translation",
		direction: "rtl"
	},
	{
		identifier: "fr.hamidullah",
		language: "fr",
		name: "Hamidullah",
		englishName: "Muhammad Hamidullah",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "ha.gumi",
		language: "ha",
		name: "Gumi",
		englishName: "Abubakar Mahmoud Gumi",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "hi.hindi",
		language: "hi",
		name: "फ़ारूक़ ख़ान & नदवी",
		englishName: "Suhel Farooq Khan and Saifur Rahman Nadwi",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "id.indonesian",
		language: "id",
		name: "Bahasa Indonesia",
		englishName: "Unknown",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		identifier: "it.piccardo",
		language: "it",
		name: "Piccardo",
		englishName: "Hamza Roberto Piccardo",
		format: "text",
		type: "translation",
		direction: "ltr"
	},
	{
		"identifier": "ja.japanese",
		"language": "ja",
		"name": "Japanese",
		"englishName": "Unknown",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ko.korean",
		"language": "ko",
		"name": "Korean",
		"englishName": "Unknown",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ku.asan",
		"language": "ku",
		"name": "تهفسیری ئاسان",
		"englishName": "Burhan Muhammad-Amin",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ml.abdulhameed",
		"language": "ml",
		"name": "അബ്ദുല് ഹമീദ് & പറപ്പൂര്",
		"englishName": "Cheriyamundam Abdul Hameed and Kunhi Mohammed Parappoor",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "nl.keyzer",
		"language": "nl",
		"name": "Keyzer",
		"englishName": "Salomo Keyzer",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "no.berg",
		"language": "no",
		"name": "Einar Berg",
		"englishName": "Einar Berg",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "pl.bielawskiego",
		"language": "pl",
		"name": "Bielawskiego",
		"englishName": "Józefa Bielawskiego",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "pt.elhayek",
		"language": "pt",
		"name": "El-Hayek",
		"englishName": "Samir El-Hayek",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ro.grigore",
		"language": "ro",
		"name": "Grigore",
		"englishName": "George Grigore",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ru.kuliev",
		"language": "ru",
		"name": "Кулиев",
		"englishName": "Elmir Kuliev",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ru.osmanov",
		"language": "ru",
		"name": "Османов",
		"englishName": "Magomed-Nuri Osmanovich Osmanov",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ru.porokhova",
		"language": "ru",
		"name": "Порохова",
		"englishName": "V. Porokhova",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sd.amroti",
		"language": "sd",
		"name": "امروٽي",
		"englishName": "Taj Mehmood Amroti",
		"format": "text",
		"type": "translation",
		"direction": "rtl"
	},
	{
		"identifier": "so.abduh",
		"language": "so",
		"name": "Abduh",
		"englishName": "Mahmud Muhammad Abduh",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sq.ahmeti",
		"language": "sq",
		"name": "Sherif Ahmeti",
		"englishName": "Sherif Ahmeti",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sq.mehdiu",
		"language": "sq",
		"name": "Feti Mehdiu",
		"englishName": "Feti Mehdiu",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sq.nahi",
		"language": "sq",
		"name": "Efendi Nahi",
		"englishName": "Hasan Efendi Nahi",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sv.bernstrom",
		"language": "sv",
		"name": "Bernström",
		"englishName": "Knut Bernström",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "sw.barwani",
		"language": "sw",
		"name": "Al-Barwani",
		"englishName": "Ali Muhsin Al-Barwani",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "ta.tamil",
		"language": "ta",
		"name": "ஜான் டிரஸ்ட்",
		"englishName": "Jan Turst Foundation",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "tg.ayati",
		"language": "tg",
		"name": "Оятӣ",
		"englishName": "AbdolMohammad Ayati",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	},
	{
		"identifier": "th.thai",
		"language": "th",
		"name": "ภาษาไทย",
		"englishName": "King Fahad Quran Complex",
		"format": "text",
		"type": "translation",
		"direction": "ltr"
	}, {
		identifier: "tr.ates",
		language: "tr",
		name: "Süleyman Ateş",
		englishName: "Suleyman Ates",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.bulac",
		language: "tr",
		name: "Alİ Bulaç",
		englishName: "Alİ Bulaç",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.diyanet",
		language: "tr",
		name: "Diyanet İşleri",
		englishName: "Diyanet Isleri",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.golpinarli",
		language: "tr",
		name: "Abdulbakî Gölpınarlı",
		englishName: "Abdulbaki Golpinarli",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.ozturk",
		language: "tr",
		name: "Öztürk",
		englishName: "Yasar Nuri Ozturk",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.vakfi",
		language: "tr",
		name: "Diyanet Vakfı",
		englishName: "Diyanet Vakfi",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.yazir",
		language: "tr",
		name: "Elmalılı Hamdi Yazır",
		englishName: "Elmalili Hamdi Yazir",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.yildirim",
		language: "tr",
		name: "Suat Yıldırım",
		englishName: "Suat Yildirim",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tr.yuksel",
		language: "tr",
		name: "Edip Yüksel",
		englishName: "Edip Yüksel",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "tt.nugman",
		language: "tt",
		name: "Yakub Ibn Nugman",
		englishName: "Yakub Ibn Nugman",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ug.saleh",
		language: "ug",
		name: "محمد صالح",
		englishName: "Muhammad Saleh",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.ahmedali",
		language: "ur",
		name: "احمد علی",
		englishName: "Ahmed Ali",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.jalandhry",
		language: "ur",
		name: "جالندہری",
		englishName: "Fateh Muhammad Jalandhry",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.jawadi",
		language: "ur",
		name: "علامہ جوادی",
		englishName: "Syed Zeeshan Haider Jawadi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.kanzuliman",
		language: "ur",
		name: "احمد رضا خان",
		englishName: "Ahmed Raza Khan",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.qadri",
		language: "ur",
		name: "طاہر القادری",
		englishName: "Tahir ul Qadri",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "uz.sodik",
		language: "uz",
		name: "Мухаммад Содик",
		englishName: "Muhammad Sodik Muhammad Yusuf",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.maududi",
		language: "en",
		name: "Maududi",
		englishName: "Abul Ala Maududi",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.shakir",
		language: "en",
		name: "Shakir",
		englishName: "Mohammad Habib Shakir",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "es.cortes",
		language: "es",
		name: "Cortes",
		englishName: "Julio Cortes",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "fa.ansarian",
		language: "fa",
		name: "انصاریان",
		englishName: "Hussain Ansarian",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "bg.theophanov",
		language: "bg",
		name: "Теофанов",
		englishName: "Tzvetan Theophanov",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "bs.mlivo",
		language: "bs",
		name: "Mlivo",
		englishName: "Mustafa Mlivo",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "fa.bahrampour",
		language: "fa",
		name: "بهرام پور",
		englishName: "Abolfazl Bahrampour",
		format: "text",
		type: "translation",
		direction: "rtl",
	}, {
		identifier: "es.asad",
		language: "es",
		name: "Asad",
		englishName: "Muhammad Asad - Abdurrasak Pérez",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "fa.khorramshahi",
		language: "fa",
		name: "خرمشاهی",
		englishName: "Baha'oddin Khorramshahi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "fa.mojtabavi",
		language: "fa",
		name: "مجتبوی",
		englishName: "Sayyed Jalaloddin Mojtabavi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "hi.farooq",
		language: "hi",
		name: "फ़ारूक़ ख़ान & अहमद",
		englishName: "Muhammad Farooq Khan and Muhammad Ahmed",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "id.muntakhab",
		language: "id",
		name: "Quraish Shihab",
		englishName: "Muhammad Quraish Shihab et al.",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ms.basmeih",
		language: "ms",
		name: "Basmeih",
		englishName: "Abdullah Muhammad Basmeih",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ru.abuadel",
		language: "ru",
		name: "Абу Адель",
		englishName: "Abu Adel",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ru.krachkovsky",
		language: "ru",
		name: "Крачковский",
		englishName: "Ignaty Yulianovich Krachkovsky",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ru.muntahab",
		language: "ru",
		name: "Аль-Мунтахаб",
		englishName: "Ministry of Awqaf, Egypt",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ru.sablukov",
		language: "ru",
		name: "Саблуков",
		englishName: "Gordy Semyonovich Sablukov",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ur.junagarhi",
		language: "ur",
		name: "محمد جوناگڑھی",
		englishName: "Muhammad Junagarhi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ur.maududi",
		language: "ur",
		name: "ابوالاعلی مودودی",
		englishName: "Abul A'ala Maududi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "zh.jian",
		language: "zh",
		name: "Ma Jian",
		englishName: "Ma Jian",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "zh.majian",
		language: "zh",
		name: "Ma Jian (Traditional)",
		englishName: "Ma Jian",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "fa.khorramdel",
		language: "fa",
		name: "خرمدل",
		englishName: "Mostafa Khorramdel",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "fa.moezzi",
		language: "fa",
		name: "معزی",
		englishName: "Mohammad Kazem Moezzi",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "bs.korkut",
		language: "bs",
		name: "Korkut",
		englishName: "Besim Korkut",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "si.naseemismail",
		language: "si",
		name: "Naseem Ismail",
		englishName: "Naseem Isamil and Masoor Maulana, Kaleel",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "zh.mazhonggang",
		language: "zh",
		name: "Ma Zhong Gang",
		englishName: "马仲刚",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ba.mehanovic",
		language: "ba",
		name: "Kur'an - sa prevodom (značenja) na bosanski jezik, utemeljen na Ibn Kesirovom tumačenju, i kratki komentar",
		englishName: "Quran translation by Muhamed Mehanovic",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.itani",
		language: "en",
		name: "Clear Qur'an - Talal Itani",
		englishName: "Clear Qur'an by Talal Itani",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "my.ghazi",
		language: "my",
		name: "Ghazi Muhammed Hashim",
		englishName: "Translation by Ghazi Muhammed Hashim",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.mubarakpuri",
		language: "en",
		name: "Mubarakpuri",
		englishName: "Mubarakpuri",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "am.sadiq",
		language: "am",
		name: "ሳዲቅ & ሳኒ ሐቢብ",
		englishName: "ሳዲቅ & ሳኒ ሐቢብ",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ber.mensur",
		language: "ber",
		name: "At Mensur",
		englishName: "At Mensur",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "bn.hoque",
		language: "bn",
		name: "জহুরুল হক",
		englishName: "জহুরুল হক",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.qarai",
		language: "en",
		name: "Qarai",
		englishName: "Qarai",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "en.wahiduddin",
		language: "en",
		name: "Wahiduddin Khan",
		englishName: "Wahiduddin Khan",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "es.bornez",
		language: "es",
		name: "Bornez",
		englishName: "Bornez",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "es.garcia",
		language: "es",
		name: "Garcia",
		englishName: "Garcia",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ur.najafi",
		language: "ur",
		name: "محمد حسین نجفی",
		englishName: "محمد حسین نجفی",
		format: "text",
		type: "translation",
		direction: "rtl",
	}, {
		identifier: "fa.gharaati",
		language: "fa",
		name: "قرائتی",
		englishName: "قرائتی",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "fa.sadeqi",
		language: "fa",
		name: "صادقی تهرانی",
		englishName: "صادقی تهرانی",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "fa.safavi",
		language: "fa",
		name: "صفوی",
		englishName: "صفوی",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "id.jalalayn",
		language: "id",
		name: "Tafsir Jalalayn",
		englishName: "Tafsir Jalalayn",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ml.karakunnu",
		language: "ml",
		name: "കാരകുന്ന് & എളയാവൂര്",
		englishName: "കാരകുന്ന് & എളയാവൂര്",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "nl.leemhuis",
		language: "nl",
		name: "Leemhuis",
		englishName: "Leemhuis",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "nl.siregar",
		language: "nl",
		name: "Siregar",
		englishName: "Siregar",
		format: "text",
		type: "translation",
		direction: "ltr",
	},
	{
		identifier: "ps.abdulwali",
		language: "ps",
		name: "عبدالولي",
		englishName: "عبدالولي",
		format: "text",
		type: "translation",
		direction: "rtl",
	},
	{
		identifier: "ru.kuliev-alsaadi",
		language: "ru",
		name: "Кулиев + ас-Саади",
		englishName: "Кулиев + ас-Саади",
		format: "text",
		type: "translation",
		direction: "ltr",
	}
];

