// Helpers for reading a model's CTC output: `ctc` has one entry per image
// token, holding the most likely letter or null for the blank.

const LETTER_COLORS = [
	[25, 25, 112],
	[255, 69, 0],
	[255, 215, 0],
	[0, 255, 127],
	[0, 191, 255],
	[0, 0, 255],
	[255, 20, 147],
];
export const BLANK_COLOR = [128, 128, 128];

// CTC decoding collapses runs of the same token and drops blanks, so each
// new run of a non-blank token adds one letter to the decoded word. Blank
// tokens don't map to any letter and return -1.
export function tokenToLetterIndex(ctc, tokenIndex) {
	if (!ctc[tokenIndex]) return -1;
	var letterIndex = -1;
	for (var i = 0; i <= tokenIndex; i++) {
		const startsNewLetter = ctc[i] && ctc[i] !== ctc[i - 1];
		if (startsNewLetter) letterIndex++;
	}
	return letterIndex;
}

// Colors cycle by position in the word, so neighboring letters always differ
export function letterColor(letterIndex) {
	if (letterIndex < 0) return BLANK_COLOR;
	return LETTER_COLORS[letterIndex % LETTER_COLORS.length];
}

// Abkai for each character the models can output, copied from the backend's
// ocr/photos.py. Variation selectors and the other invisible marks have no
// Abkai spelling.
const MANCHU_TO_ABKAI = {
	"ᠠ": "a", "ᡝ": "e", "ᡳ": "i", "ᠢ": "i", "ᠣ": "o", "ᡠ": "u", "ᠤ": "u",
	"ᡡ": "v", "ᠨ": "n", "ᠩ": "ng", "ᠪ": "b", "ᡦ": "p", "ᡤ": "g", "ᠭ": "g",
	"ᡥ": "h", "ᡴ": "k", "ᠺ": "k'", "ᡬ": "g'", "ᡭ": "h'", "ᠮ": "m", "ᠯ": "l",
	"ᠰ": "s", "ᡧ": "x", "ᡨ": "t", "ᡩ": "d", "ᠳ": "d", "ᠴ": "c", "ᠵ": "j",
	"ᠶ": "y", "ᠸ": "w", "ᡵ": "r", "ᡶ": "f", "ᡮ": "ts'", "ᡯ": "dz",
	"ᡰ": "r'", "ᡱ": "c'", "ᡷ": "z", "ᡟ": "y", " ": " ",
	"᠋": "", "᠌": "", "᠍": "", "᠏": "", "᠇": "",
	"᠊": "",
};

// The Abkai spelling of each letter in a Manchu word, e.g. ᠠᠩᡤᠠ -> a, ng, g, a
export function abkaiLetters(manchu) {
	return manchu.split('').map((letter) => MANCHU_TO_ABKAI[letter] ?? '?');
}
