// Compares a page's reading with the Abkai the user expected

import { diffLetters } from './ctc';
import type { DiffLetter } from './ctc';

// The loanword marks the user might type, all counted as one. The server
// writes ‘ after k, g and h and ʻ elsewhere.
const MARKS = /['’‘ʻ]/g;
const normalize = (word: string) => word.toLowerCase().replace(MARKS, '\'');

// The words of an Abkai text, leaving out the □ that stands for each box of
// other text
export const pageWords = (text: string) => text.split(/\s+/)
	.filter((word) => word && word !== '□');

// A predicted word lined up with an expected one: right, wrong (a different
// word in its place), extra (no expected word) or missing (no predicted word)
export type WordStatus = 'right' | 'wrong' | 'extra' | 'missing';
export type AlignedWord = {
	predicted?: string;
	expected?: string;
	status: WordStatus;
};

// Lines the predicted words up with the expected ones, with as few wrong,
// extra and missing words as possible
export function alignWords(predicted: string[], expected: string[]):
	AlignedWord[] {
	const p = predicted.map(normalize);
	const e = expected.map(normalize);
	// cost[i][j]: the fewest edits between p[i:] and e[j:]
	const cost = Array.from({ length: p.length + 1 },
		() => new Array<number>(e.length + 1).fill(0));
	for (let i = p.length; i >= 0; i--) {
		for (let j = e.length; j >= 0; j--) {
			if (i === p.length) cost[i][j] = e.length - j;
			else if (j === e.length) cost[i][j] = p.length - i;
			else {
				cost[i][j] = Math.min(
					cost[i + 1][j + 1] + (p[i] === e[j] ? 0 : 1),
					cost[i + 1][j] + 1,
					cost[i][j + 1] + 1,
				);
			}
		}
	}
	const aligned: AlignedWord[] = [];
	let i = 0;
	let j = 0;
	while (i < p.length || j < e.length) {
		if (i < p.length && j < e.length
			&& cost[i][j] === cost[i + 1][j + 1] + (p[i] === e[j] ? 0 : 1)) {
			aligned.push({
				predicted: predicted[i],
				expected: expected[j],
				status: p[i] === e[j] ? 'right' : 'wrong',
			});
			i++;
			j++;
		} else if (i < p.length && cost[i][j] === cost[i + 1][j] + 1) {
			aligned.push({ predicted: predicted[i], status: 'extra' });
			i++;
		} else {
			aligned.push({ expected: expected[j], status: 'missing' });
			j++;
		}
	}
	return aligned;
}

// The letters of an aligned word, each marked ok, wrong, extra or missing
// as in a single word's prediction. Marks are compared in one form, but
// predicted letters are shown as the server wrote them.
export function wordLetters({ predicted = '', expected = '' }: AlignedWord):
	DiffLetter[] {
	return diffLetters(normalize(predicted), normalize(expected))
		.map((entry) => (entry.index >= 0
			? { ...entry, letter: predicted[entry.index] } : entry));
}
