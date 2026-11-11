// Compares a page's reading with the Abkai the user expected

import { diffLetters } from './ctc';
import type { DiffLetter } from './ctc';
import type { PageBox } from './types';

// The loanword marks the user might type, all counted as one. The server
// writes ‘ after k, g and h and ʻ elsewhere.
const MARKS = /['’‘ʻ]/g;
const normalize = (word: string) => word.toLowerCase().replace(MARKS, '\'');

// The words of an Abkai text, leaving out the □ that stands for each box of
// other text, and the punctuation, brackets and footnote marks ([1]) in
// transcriptions, which the reader doesn't give
export const pageWords = (text: string) => text
	.replace(/\[\d+\]|[,.()᠈᠉]/g, ' ')
	.split(/\s+/)
	.filter((word) => word && word !== '□');

// The edit distance between two words, counting each letter
function editDistance(a: string, b: string) {
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[b.length];
}

// A predicted word lined up with an expected one: right, wrong (a different
// word in its place), extra (no expected word) or missing (no predicted word)
export type WordStatus = 'right' | 'wrong' | 'extra' | 'missing';
export type AlignedWord = {
	predicted?: string;
	expected?: string;
	status: WordStatus;
};

// Lines the predicted words up with the expected ones. Leaving a word out
// costs its letters, and pairing two costs twice the letters that differ
// (a wrong letter counts as one dropped and one added), so words pair up only
// when they're alike. A word the model missed (such as a lone i) is then
// marked missing, and a garbled extra word marked extra, rather than shifting
// the words after them onto the wrong partners.
export function alignWords(predicted: string[], expected: string[]):
	AlignedWord[] {
	const p = predicted.map(normalize);
	const e = expected.map(normalize);
	const pair = (i: number, j: number) => 2 * editDistance(p[i], e[j]);
	// cost[i][j]: the lowest cost of lining up p[i:] with e[j:]
	const cost = Array.from({ length: p.length + 1 },
		() => new Array<number>(e.length + 1).fill(0));
	for (let i = p.length; i >= 0; i--) {
		for (let j = e.length; j >= 0; j--) {
			if (i === p.length && j === e.length) continue;
			cost[i][j] = Math.min(
				i < p.length && j < e.length ? cost[i + 1][j + 1] + pair(i, j)
					: Infinity,
				i < p.length ? cost[i + 1][j] + p[i].length : Infinity,
				j < e.length ? cost[i][j + 1] + e[j].length : Infinity,
			);
		}
	}
	const aligned: AlignedWord[] = [];
	let i = 0;
	let j = 0;
	while (i < p.length || j < e.length) {
		if (i < p.length && j < e.length
			&& cost[i][j] === cost[i + 1][j + 1] + pair(i, j)) {
			aligned.push({
				predicted: predicted[i],
				expected: expected[j],
				status: p[i] === e[j] ? 'right' : 'wrong',
			});
			i++;
			j++;
		} else if (i < p.length && cost[i][j] === cost[i + 1][j] + p[i].length) {
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

// How each box of a page compares with the expected Abkai, in the order of
// page.boxes: 'right' for a Manchu box whose words were all read right,
// 'wrong' if any was read wrong (or is extra), and undefined for other
// boxes, low-confidence ones, and every box when nothing is expected.
// The page's text has a line per column, read top to bottom, of the Manchu
// boxes read with enough confidence (and as something), so each of those
// boxes' words are its next words, in that order.
export function boxStatuses(boxes: PageBox[], expected: string):
	('right' | 'wrong' | undefined)[] {
	const statuses: ('right' | 'wrong' | undefined)[] = boxes.map(() => undefined);
	if (!pageWords(expected).length) return statuses;
	const inText = boxes
		.map((box, index) => ({ box, index }))
		.filter(({ box }) => box.kind === 'manchu' && box.line !== null
			&& !box['low-confidence'] && box['prediction-abkai'])
		.sort((a, b) => (a.box.line! - b.box.line!)
			|| (a.box.position - b.box.position));
	const words = inText.map(({ box }) => pageWords(box['prediction-abkai']!));
	const aligned = alignWords(words.flat(), pageWords(expected))
		.filter(({ predicted }) => predicted !== undefined);
	let next = 0;
	inText.forEach(({ index }, i) => {
		const mine = aligned.slice(next, next + words[i].length);
		next += words[i].length;
		if (mine.length) {
			statuses[index] = mine.every(({ status }) => status === 'right')
				? 'right' : 'wrong';
		}
	});
	return statuses;
}

// The pages of a transcription: its paragraphs, separated by empty lines
export const pageTexts = (text: string) => text
	.split(/\n\s*\n/)
	.map((page) => page.trim())
	.filter(Boolean);

// The text to compare page number (from 1) of a PDF with: paragraph number
// of the transcription. A transcription of just one paragraph is taken as
// the text of whichever page is read on its own (wholePdf false).
export function textForPage(text: string, number: number, wholePdf: boolean) {
	const pages = pageTexts(text);
	if (!wholePdf && pages.length === 1) return pages[0];
	return pages[number - 1] ?? '';
}
