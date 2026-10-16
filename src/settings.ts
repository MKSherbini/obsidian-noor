import {App, PluginSettingTab, Setting} from 'obsidian';
import NoorPlugin from "./main";
import type {HadithLanguage} from "./models/HadithLanguage";
import type {Edition} from "./models/Edition";

export interface NoorPluginSettings {
	dhikrFilepath: string;
	reciter: string;
	showTranslation: boolean;
	translationLanguage: string;
	translationOption: string;
	hadithLanguage: string;
	searchResultLimit: number;
	/** Hadith languages from the API, kept for offline use. */
	hadithLanguages: HadithLanguage[];
	/** Translation editions from the API, kept for offline use. */
	translations: Edition[];
	/** Arabic reciters from the API, kept for offline use. */
	reciters: Edition[];
}

export const DEFAULT_SETTINGS: NoorPluginSettings = {
	dhikrFilepath: 'dhikr.md',
	reciter: 'ar.abdulbasitmurattal',
	showTranslation: true,
	translationLanguage: 'en',
	translationOption: 'en.ahmedali',
	hadithLanguage: 'ar',
	searchResultLimit: 20,
	hadithLanguages: [],
	translations: [],
	reciters: []
}


export class NoorSettingTab extends PluginSettingTab {
	plugin: NoorPlugin;

	constructor(app: App, plugin: NoorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		const options = this.plugin.dropdownOptions;

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
					.addOptions(options.reciters)
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
						.addOptions(options.translationLanguages)
						.setValue(this.plugin.settings.translationLanguage)
						.onChange(async (value) => {
							this.plugin.settings.translationLanguage = value
							const identifiers = Object.keys(options.translationsByLanguage.get(value) ?? {});
							this.plugin.settings.translationOption = identifiers[0] ?? '';
							await this.plugin.saveSettings();
							this.display();
						});
				});

			const translationOptions = options.translationsByLanguage.get(this.plugin.settings.translationLanguage) ?? {};
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

		new Setting(containerEl)
			.setName('Hadith language')
			.setDesc('Which hadith language to use')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(options.hadithLanguages)
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
