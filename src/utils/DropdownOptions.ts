import {languageNames} from "../constants/languages";
import type {NoorPluginSettings} from "../settings";

/** The contents of the settings dropdowns, built from the API lists in the settings. */
export interface DropdownOptions {
	/** Reciter identifier → name. */
	reciters: Record<string, string>;
	/** Translation language code → language name. */
	translationLanguages: Record<string, string>;
	/** Translation language code → { edition identifier: edition name }. */
	translationsByLanguage: Map<string, Record<string, string>>;
	/** Hadith language code → native name. */
	hadithLanguages: Record<string, string>;
}

/** Keeps a dropdown non-empty before the lists load, falling back to the value itself. */
function ensureOption(options: Record<string, string>, value: string) {
	if (options[value] == null) options[value] = value;
}

/** Builds the settings dropdown contents. */
export function buildDropdownOptions(settings: NoorPluginSettings): DropdownOptions {
	const reciters: Record<string, string> = {};
	for (const reciter of [...settings.reciters].sort((a, b) => a.englishName.localeCompare(b.englishName))) {
		reciters[reciter.identifier] = reciter.englishName;
	}
	ensureOption(reciters, settings.reciter);

	const translationLanguages: Record<string, string> = {};
	const translationsByLanguage = new Map<string, Record<string, string>>();
	for (const translation of [...settings.translations].sort((a, b) => a.identifier.localeCompare(b.identifier))) {
		// The API gives no language names, so skip codes we cannot label.
		const languageName = languageNames.get(translation.language);
		if (languageName == void 0) continue;
		translationLanguages[translation.language] = languageName;
		if (!translationsByLanguage.has(translation.language)) translationsByLanguage.set(translation.language, {});
		translationsByLanguage.get(translation.language)![translation.identifier] = translation.name;
	}
	ensureOption(translationLanguages, settings.translationLanguage);
	const selectedTranslations = translationsByLanguage.get(settings.translationLanguage) ?? {};
	ensureOption(selectedTranslations, settings.translationOption);
	translationsByLanguage.set(settings.translationLanguage, selectedTranslations);

	const hadithLanguages: Record<string, string> = {};
	for (const language of settings.hadithLanguages) {
		hadithLanguages[language.code] = language.native;
	}
	ensureOption(hadithLanguages, settings.hadithLanguage);

	return {
		reciters,
		translationLanguages: Object.fromEntries(
			Object.entries(translationLanguages).sort((a, b) => a[1].localeCompare(b[1])),
		),
		translationsByLanguage,
		hadithLanguages,
	};
}
