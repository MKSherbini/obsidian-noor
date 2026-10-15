import {App, PluginSettingTab, Setting} from 'obsidian';
import NoorPlugin from "./main";
import {reciters} from "./constants/reciters";
import {translations} from "./constants/translations";
import {languageNames} from "./constants/languages";

export interface NoorPluginSettings {
	dhikrFilepath: string;
	reciter: string;
	showTranslation: boolean;
	translationLanguage: string;
	translationOption: string;
	hadithLanguage: string;
	searchResultLimit: number;
}

export const DEFAULT_SETTINGS: NoorPluginSettings = {
	dhikrFilepath: 'dhikr.md',
	reciter: 'ar.abdulbasitmurattal',
	showTranslation: true,
	translationLanguage: 'en',
	translationOption: 'en.ahmedali',
	hadithLanguage: 'ar',
	searchResultLimit: 20
}


export class NoorSettingTab extends PluginSettingTab {
	plugin: NoorPlugin;
	reciterOptions: Record<string, string> = {};
	translationLanguagesOptions: { [key: string]: string } = {};
	translationOptionsMap = new Map<string, Record<string, string>>();

	constructor(app: App, plugin: NoorPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		reciters.sort((a, b) => a.identifier.localeCompare(b.identifier));
		translations.sort((a, b) => a.identifier.localeCompare(b.identifier));

		reciters.forEach(reciter => {
			this.reciterOptions[reciter.identifier] = reciter.englishName;
		})
		translations.forEach(translation => {
			const languageName = languageNames.get(translation.language);
			if (languageName != void 0)
				this.translationLanguagesOptions[translation.language] = languageName;
			if (!this.translationOptionsMap.has(translation.language)) this.translationOptionsMap.set(translation.language, {});
			this.translationOptionsMap.get(translation.language)![translation.identifier] = translation.name;
		});

		this.translationLanguagesOptions = Object.fromEntries(Object.entries(this.translationLanguagesOptions).sort((a, b) => a[1].localeCompare(b[1])))
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl).setName('Dhikr file').setHeading();

		new Setting(containerEl)
			.setName("Dhikr file path")
			.setDesc("Where to create the dhikr note")
			.addText(text =>
				text
					.setValue(this.plugin.settings.dhikrFilepath)
					.onChange(async (value) => {
						this.plugin.settings.dhikrFilepath = value;
						await this.plugin.saveSettings();
					})
			)

		new Setting(containerEl).setName('Quran').setHeading();

		new Setting(containerEl)
			.setName('Reciter')
			.setDesc('Which reciter voice to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(this.reciterOptions)
					.setValue(this.plugin.settings.reciter)
					.onChange(async (value) => {
						this.plugin.settings.reciter = value
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Show translation')
			.setDesc('Show quran translation in another language')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showTranslation)
					.onChange(async (value) => {
						this.plugin.settings.showTranslation = value
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.showTranslation) {
			new Setting(containerEl)
				.setName('Translation language')
				.setDesc('Which translation language to use')
				.addDropdown((dropdown) => {
					dropdown
						.addOptions(this.translationLanguagesOptions)
						.setValue(this.plugin.settings.translationLanguage)
						.onChange(async (value) => {
							this.plugin.settings.translationLanguage = value
							const options = Object.keys(this.translationOptionsMap.get(this.plugin.settings.translationLanguage) ?? {});
							this.plugin.settings.translationOption = options[0] ?? '';
							await this.plugin.saveSettings();
							this.display();
						});
				});

			const translationOptions = this.translationOptionsMap.get(this.plugin.settings.translationLanguage) ?? {};
			new Setting(containerEl)
				.setName('Translation options')
				.setDesc('Which translation to use')
				.addDropdown((dropdown) => {
					dropdown
						.addOptions(translationOptions)
						.setValue(this.plugin.settings.translationOption)
						.onChange(async (value) => {
							this.plugin.settings.translationOption = value
							await this.plugin.saveSettings();
						});
				});
		}


		containerEl.createEl("br");
		new Setting(containerEl).setName('Hadith').setHeading();

		const hadithLanguageOptions: Record<string, string> = {};
		for (const language of this.plugin.hadithLanguages) {
			hadithLanguageOptions[language.code] = language.native;
		}
		// The list is fetched on start; until it arrives, keep at least the selected language.
		const currentHadithLanguage = this.plugin.settings.hadithLanguage;
		if (hadithLanguageOptions[currentHadithLanguage] == null) {
			hadithLanguageOptions[currentHadithLanguage] = currentHadithLanguage;
		}

		new Setting(containerEl)
			.setName('Hadith language')
			.setDesc('Which hadith language to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(hadithLanguageOptions)
					.setValue(this.plugin.settings.hadithLanguage)
					.onChange(async (value) => {
						this.plugin.settings.hadithLanguage = value
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("br");
		new Setting(containerEl).setName('Search').setHeading();

		new Setting(containerEl)
			.setName('Search results')
			.setDesc('How many results to show (1-100)')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.inputEl.max = '100';
				text
					.setValue(String(this.plugin.settings.searchResultLimit))
					.onChange(async (value) => {
						const limit = Number.parseInt(value, 10);
						if (Number.isNaN(limit)) return;
						this.plugin.settings.searchResultLimit = Math.min(100, Math.max(1, limit));
						await this.plugin.saveSettings();
					});
			});

	}
}
