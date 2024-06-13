import {Ayah} from "./Ayah";
import {Edition} from "./Edition";

export interface Surah {
	number: number;
	name: string;
	englishName: string;
	englishNameTranslation: string;
	revelationType: string;
	numberOfAyahs: number;
	ayahs?: Ayah[];
	edition?: Edition;
}
