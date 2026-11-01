// Helpers for reading a model's CTC output: `ctc` has one entry per image
// token, holding the most likely letter or null for the blank.

import type { Ctc } from './types';

// An RGB color, each channel 0-255
export type Rgb = [number, number, number];

// One letter of a predicted word lined up against the true word (see
// diffLetters)
export type DiffLetter = {
	letter: string;
	// The letter's place in the prediction, or -1 if it's missing
	index: number;
	status: 'ok' | 'wrong' | 'extra' | 'missing';
};

const LETTER_COLORS: Rgb[] = [
	[25, 25, 112],
	[255, 69, 0],
	[255, 215, 0],
	[0, 255, 127],
	[0, 191, 255],
	[0, 0, 255],
	[255, 20, 147],
];
export const BLANK_COLOR: Rgb = [128, 128, 128];
// Every letter token's color in the quiet view, before anyone interacts
export const QUIET_COLOR: Rgb = [70, 130, 180];

// CTC decoding collapses runs of the same token and drops blanks, so each
// new run of a non-blank token adds one letter to the decoded word. Blank
// tokens don't map to any letter and return -1.
export function tokenToLetterIndex(
	ctc: Ctc, tokenIndex: number | undefined,
): number {
	if (tokenIndex === undefined) return -1;
	if (!ctc[tokenIndex]) return -1;
	var letterIndex = -1;
	for (var i = 0; i <= tokenIndex; i++) {
		const startsNewLetter = ctc[i] && ctc[i] !== ctc[i - 1];
		if (startsNewLetter) letterIndex++;
	}
	return letterIndex;
}

// Colors cycle by position in the word, so neighboring letters always differ
export function letterColor(letterIndex: number): Rgb {
	if (letterIndex < 0) return BLANK_COLOR;
	return LETTER_COLORS[letterIndex % LETTER_COLORS.length];
}

// Abkai for each character the models can output, copied from the backend's
// ocr/photos.py. Variation selectors and the other invisible marks have no
// Abkai spelling.
const MANCHU_TO_ABKAI: Record<string, string> = {
	"ᠠ": "a", "ᡝ": "e", "ᡳ": "i", "ᠢ": "i", "ᠣ": "o", "ᡠ": "u", "ᠤ": "u",
	"ᡡ": "v", "ᠨ": "n", "ᠩ": "ng", "ᠪ": "b", "ᡦ": "p", "ᡤ": "g", "ᠭ": "g",
	"ᡥ": "h", "ᡴ": "k", "ᠺ": "k'", "ᡬ": "g'", "ᡭ": "h'", "ᠮ": "m", "ᠯ": "l",
	"ᠰ": "s", "ᡧ": "x", "ᡨ": "t", "ᡩ": "d", "ᠳ": "d", "ᠴ": "c", "ᠵ": "j",
	"ᠶ": "y", "ᠸ": "w", "ᡵ": "r", "ᡶ": "f", "ᡮ": "ts'", "ᡯ": "dz",
	"ᡰ": "r'", "ᡱ": "c'", "ᡷ": "z", "ᡟ": "y", " ": " ",
	"᠋": "", "᠌": "", "᠍": "", "᠏": "", "᠇": "",
	"᠊": "",
};

export function abkaiLetter(letter: string): string {
	return MANCHU_TO_ABKAI[letter] ?? '?';
}

// The Abkai spelling of each letter in a Manchu word, e.g. ᠠᠩᡤᠠ -> a, ng, g, a
export function abkaiLetters(manchu: string): string[] {
	return manchu.split('').map(abkaiLetter);
}

// Variation selectors and other marks with no visible shape of their own.
// Labels never have them, so they're left out when comparing words.
const INVISIBLE = new Set(["᠋", "᠌", "᠍", "᠏", "᠇", "᠊"]);

// Lines up a predicted word with the true one by edit distance, letter by
// letter. Returns the predicted letters in order, with the true letters the
// model missed inserted where they belong. Each entry is { letter, index,
// status }: index is the letter's place in the prediction (-1 if missing),
// and status is 'ok', 'wrong' (read as another letter), 'extra' (not in the
// true word) or 'missing'.
export function diffLetters(predicted: string, truth: string): DiffLetter[] {
	const all = predicted.split('');
	const visible = all.map((letter, index) => ({ letter, index }))
		.filter(({ letter }) => !INVISIBLE.has(letter));
	const target = truth.split('');

	// distance[i][j] = edits to turn visible[..i] into target[..j]
	const distance: number[][] = visible.map(() => []);
	distance.push([]);
	for (var i = 0; i <= visible.length; i++) {
		for (var j = 0; j <= target.length; j++) {
			if (i === 0 || j === 0) {
				distance[i][j] = i + j;
				continue;
			}
			const same = visible[i - 1].letter === target[j - 1];
			distance[i][j] = Math.min(
				distance[i - 1][j - 1] + (same ? 0 : 1),
				distance[i - 1][j] + 1,
				distance[i][j - 1] + 1,
			);
		}
	}

	// Walk back from the end to recover the edits, last letter first
	const steps: DiffLetter[] = [];
	var i = visible.length;
	var j = target.length;
	while (i > 0 || j > 0) {
		const same = i > 0 && j > 0 && visible[i - 1].letter === target[j - 1];
		if (i > 0 && j > 0
				&& distance[i][j] === distance[i - 1][j - 1] + (same ? 0 : 1)) {
			steps.push({ ...visible[i - 1], status: same ? 'ok' : 'wrong' });
			i--;
			j--;
		} else if (i > 0 && distance[i][j] === distance[i - 1][j] + 1) {
			steps.push({ ...visible[i - 1], status: 'extra' });
			i--;
		} else {
			steps.push({ letter: target[j - 1], index: -1, status: 'missing' });
			j--;
		}
	}
	steps.reverse();

	// Put the invisible marks back in their places
	const result: DiffLetter[] = [];
	var next = 0;
	for (const step of steps) {
		while (step.index >= 0 && next < step.index) {
			result.push({ letter: all[next], index: next, status: 'ok' });
			next++;
		}
		result.push(step);
		if (step.index >= 0) next = step.index + 1;
	}
	for (; next < all.length; next++) {
		result.push({ letter: all[next], index: next, status: 'ok' });
	}
	return result;
}
