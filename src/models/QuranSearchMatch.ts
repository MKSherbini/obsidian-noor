import {Edition} from "./Edition";

/** A single match returned by the alquran.cloud search endpoint. */
export interface QuranSearchMatch {
	number: number;
	text: string;
	surah: {
		number: number;
		name: string;
		englishName: string;
	};
	numberInSurah: number;
	edition?: Edition;
}
