// Spelling Manchu script in Latin letters, in Abkai or Norman, as in the
// chart at https://en.wikipedia.org/wiki/Transliterations_of_Manchu

export type Romanization = 'abkai' | 'norman';

// The languages of Manchu text, for browsers, screen readers and search
// engines: in Manchu script, and romanized (Abkai or Norman)
export const MANCHU_LANG = 'mnc-Mong';
export const ROMANIZED_LANG = 'mnc-Latn';

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
	// The Manchu comma and full stop
	"᠈": ",", "᠉": ".",
};

// Abkai marks the loanword letters with ‘ (U+2018) after k, g and h, and ʻ
// (U+02BB) elsewhere. The same table as the backend's ocr/photos.py, so the
// two agree.
const ABKAI_QUOTE = '‘';
const ABKAI_MARK = 'ʻ';
// Norman marks them with ', as the backend's manchu_to_norman does
const NORMAN_MARK = "'";

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

// Typed romanization -> Manchu: for Abkai, as the backend's
// abkai_to_manchu (ocr/photos.py) has it. Each spelling is the first
// letter in the table that has it (so i is ᡳ, not ᠢ, and Abkai q is ᠴ, not
// ᡱ), and the whole syllables where they're spelled apart from their
// letters; Norman spells some (ts, dz) as one of their letters alone, and
// those are read as that letter. People type the marks in many ways, so any
// of them is read as the romanization's own.
const TYPED_MARKS = /['’‘ʻ]/g;
const OWN_MARK: Record<Romanization, string> = { abkai: ABKAI_MARK, norman: NORMAN_MARK };
const TO_MANCHU: Record<Romanization, Record<string, string>> = {
	abkai: typedTable('abkai'),
	norman: typedTable('norman'),
};
function typedTable(romanization: Romanization) {
	const table: Record<string, string> = {};
	const typed = (spelling: string) => spelling.replace(TYPED_MARKS, OWN_MARK[romanization]);
	for (const [letter, spelling] of Object.entries(LETTERS[romanization])) {
		if (spelling && !(typed(spelling) in table)) table[typed(spelling)] = letter;
	}
	for (const [syllable, spellings] of Object.entries(PAIRS[romanization])) {
		const spelling = typed(spellings.join(''));
		if (!(spelling in table)) table[spelling] = syllable;
	}
	return table;
}

// Words typed in a romanization, in Manchu script, reading the longest
// spelling it can at each step (so ng is ᠩ), e.g. aqambi (Abkai) or
// acambi (Norman) -> ᠠᠴᠠᠮᠪᡳ. Any of ' ’ ‘ ʻ marks a loanword letter.
// Undefined if a letter has no Manchu.
export function toManchu(text: string, romanization: Romanization): string | undefined {
	const table = TO_MANCHU[romanization];
	const longest = Math.max(...Object.keys(table).map((spelling) => spelling.length));
	const typed = text.trim().toLowerCase().replace(/\s+/g, ' ')
		.replace(TYPED_MARKS, OWN_MARK[romanization]);
	let manchu = '';
	let position = 0;
	while (position < typed.length) {
		let length = longest;
		while (length > 0 && !(typed.slice(position, position + length) in table)) {
			length--;
		}
		if (!length) return undefined;
		manchu += table[typed.slice(position, position + length)];
		position += length;
	}
	return manchu;
}

export const abkaiToManchu = (text: string) => toManchu(text, 'abkai');

// Manchu words in a romanization, a word at a time, keeping the □ that
// stands for other text and the lines
export const romanizeText = (manchu: string, romanization: Romanization) => manchu
	.split('\n')
	.map((line) => line.split(' ')
		.map((word) => (word === '□' || !word ? word : romanize(word, romanization))).join(' '))
	.join('\n');

// Typed Abkai in the standard form, with ‘ after k, g and h and ʻ
// elsewhere, as the server writes it, e.g. k'a -> k‘a
export const standardAbkai = (text: string) => {
	const manchu = abkaiToManchu(text);
	return manchu === undefined ? undefined
		: manchu.split(' ').map((word) => romanize(word, 'abkai')).join(' ');
};
