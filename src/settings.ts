import {App, PluginSettingTab, Setting} from 'obsidian';
import NoorPlugin from "./main";
import {reciters} from "./constants/reciters";
import {translations} from "./constants/translations";
import {hadithLanguages} from "./constants/hadiths";

export interface NoorPluginSettings {
	reciter: string;
	translationLanguage: string;
	translationOption: string;
	hadithLanguage: string;
}

export const DEFAULT_SETTINGS: NoorPluginSettings = {
	reciter: 'ar.abdulbasitmurattal',
	translationLanguage: 'en',
	translationOption: 'en.ahmedali',
	hadithLanguage: 'ar'
}


export class NoorSettingTab extends PluginSettingTab {
	plugin: NoorPlugin;
	reciterOptions: { [key: string]: any } = {};
	translationLanguagesOptions: { [key: string]: any } = {};
	translationOptionsMap = new Map<string, { [key: string]: any }>();

	constructor(app: App, plugin: NoorPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		reciters.sort((a, b) => a.identifier.localeCompare(b.identifier));
		translations.sort((a, b) => a.identifier.localeCompare(b.identifier));
		// translations.sort((a, b) => a.identifier > b.identifier ? 1 : -1);

		reciters.forEach(reciter => {
			this.reciterOptions[reciter.identifier] = reciter.englishName;
		})
		translations.forEach(translation => {
			this.translationLanguagesOptions[translation.language] = translation.language;
			if (!this.translationOptionsMap.has(translation.language)) this.translationOptionsMap.set(translation.language, {});
			this.translationOptionsMap.get(translation.language)![translation.identifier] = translation.name;
		});
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h3', {text: 'Quran Settings'});

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
			.setName('Translation language')
			.setDesc('Which translation language to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(this.translationLanguagesOptions)
					.setValue(this.plugin.settings.translationLanguage)
					.onChange(async (value) => {
						this.plugin.settings.translationLanguage = value
						this.plugin.settings.translationOption = '';
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName('Translation options')
			.setDesc('Which translation to use')
			.addDropdown(async (dropdown) => {
				dropdown
					.addOptions(this.translationOptionsMap.get(this.plugin.settings.translationLanguage)!)
					.setValue(await this.getTranslationValue())
					.onChange(async (value) => {
						this.plugin.settings.translationOption = value
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("br");
		containerEl.createEl('h3', {text: 'Hadith Settings'});

		new Setting(containerEl)
			.setName('Hadith language')
			.setDesc('Which hadith language to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(hadithLanguages)
					.setValue(this.plugin.settings.hadithLanguage)
					.onChange(async (value) => {
						this.plugin.settings.hadithLanguage = value
						await this.plugin.saveSettings();
					});
			});

	}

	private async getTranslationValue() {
		if (this.plugin.settings.translationOption == '')
			this.plugin.settings.translationOption = Object.keys(this.translationOptionsMap.get(this.plugin.settings.translationLanguage)!)[0];
		await this.plugin.saveSettings();

		return this.plugin.settings.translationOption;
	}
}
