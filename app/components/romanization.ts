// Spelling Manchu script in Latin letters, in Abkai or Norman, as in the
// chart at https://en.wikipedia.org/wiki/Transliterations_of_Manchu

export type Romanization = 'abkai' | 'norman';

export const ROMANIZATION_NAMES: Record<Romanization, string> = {
	abkai: 'Abkai',
	norman: 'Norman',
};

// Spellings both share, for every character the models can output. The
// Mongolian letters (ᠢ, ᠤ, ᠭ, ᠳ) take the spelling of their Manchu
// counterparts. Variation selectors and the other invisible marks are
// spelled as nothing.
const SHARED: Record<string, string> = {
	"ᠠ": "a", "ᡝ": "e", "ᡳ": "i", "ᠢ": "i", "ᠣ": "o", "ᡠ": "u", "ᠤ": "u",
	"ᠨ": "n", "ᠩ": "ng", "ᠪ": "b", "ᡦ": "p", "ᡤ": "g", "ᠭ": "g", "ᡥ": "h",
	"ᡴ": "k", "ᠮ": "m", "ᠯ": "l", "ᠰ": "s", "ᡨ": "t", "ᡩ": "d", "ᠳ": "d",
	"ᠵ": "j", "ᠶ": "y", "ᠸ": "w", "ᡵ": "r", "ᡶ": "f", " ": " ",
	"᠋": "", "᠌": "", "᠍": "", "᠏": "", "᠇": "", "᠊": "",
};

// Abkai marks the loanword letters with ‘ (U+2018) after k, g and h, and ʻ
// (U+02BB) elsewhere. The same table as the backend's ocr/photos.py, so the
// two agree.
const ABKAI_QUOTE = '‘';
const ABKAI_MARK = 'ʻ';
// Norman marks them with ’ (U+2019)
const NORMAN_MARK = '’';

const LETTERS: Record<Romanization, Record<string, string>> = {
	abkai: {
		...SHARED,
		"ᡡ": "v", "ᡧ": "x", "ᠴ": "q", "ᡮ": "c", "ᡯ": "z", "ᡱ": "q", "ᡷ": "j",
		"ᠺ": "k" + ABKAI_QUOTE, "ᡬ": "g" + ABKAI_QUOTE, "ᡭ": "h" + ABKAI_QUOTE,
		"ᡰ": "r" + ABKAI_MARK, "ᡟ": "y" + ABKAI_MARK,
	},
	norman: {
		...SHARED,
		"ᡡ": "ū", "ᡧ": "š", "ᠴ": "c", "ᡮ": "ts", "ᡯ": "dz", "ᡰ": "ž",
		"ᠺ": "k" + NORMAN_MARK, "ᡬ": "g" + NORMAN_MARK, "ᡭ": "h" + NORMAN_MARK,
		// The chart only gives ᡱ and ᡷ before ᡳ (see PAIRS). On their own,
		// they're marked like the other loanword letters.
		"ᡱ": "c" + NORMAN_MARK, "ᡷ": "j" + NORMAN_MARK,
		"ᡟ": "y",
	},
};

// Syllables with the apical vowel (as in Chinese zi, zhi, chi), spelled as
// a whole, with one spelling per Manchu letter so each letter can still be
// highlighted. ᡯᡳ only counts with FVS2 (U+180C); plain ᡯᡳ is zi/dzi.
// Syllables that spell letter by letter anyway (Abkai ᡮᡟ cyʻ, ᠰᡟ syʻ;
// Norman ᠰᡟ sy) aren't listed.
const PAIRS: Record<Romanization, Record<string, string[]>> = {
	abkai: {
		"ᡱᡳ": ["q", "y" + ABKAI_MARK],
		"ᡷᡳ": ["j", "y" + ABKAI_MARK],
		"ᡯᡳ᠌": ["z", "y" + ABKAI_MARK, ""],
	},
	norman: {
		"ᡮᡟ": ["ts", ""],
		"ᡱᡳ": ["c", "y"],
		"ᡷᡳ": ["j", "y"],
		"ᡯᡳ᠌": ["dz", "", ""],
	},
};

// One letter on its own, without the context of a word, or ? if unknown
export function spellLetter(letter: string, romanization: Romanization): string {
	return LETTERS[romanization][letter] ?? '?';
}

// The spelling of each letter of a Manchu word in context, one per
// character (so it lines up with manchu.split('')), e.g. ᠠᠩᡤᠠ -> a, ng, g, a
export function spellLetters(
	manchu: string, romanization: Romanization,
): string[] {
	const letters = manchu.split('');
	const pairs = Object.entries(PAIRS[romanization]);
	const spelled: string[] = [];
	while (spelled.length < letters.length) {
		const position = spelled.length;
		const pair = pairs.find(([syllable]) => manchu.startsWith(syllable, position));
		if (pair) {
			spelled.push(...pair[1]);
		} else {
			spelled.push(spellLetter(letters[position], romanization));
		}
	}
	return spelled;
}

// A whole Manchu word, e.g. ᠠᠴᠠᠮᠪᡳ -> aqambi (Abkai), acambi (Norman)
export function romanize(manchu: string, romanization: Romanization): string {
	return spellLetters(manchu, romanization).join('');
}

// Marks with no visible shape of their own: the ones spelled as nothing
export const INVISIBLE = new Set(Object.keys(SHARED)
	.filter((letter) => SHARED[letter] === ''));
