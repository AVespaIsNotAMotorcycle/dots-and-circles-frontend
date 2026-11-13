// The user's corrections of a page's readings, and the page's text with
// them in place

import { flaggedBoxes } from './pagecompare';
import { romanizeText } from './romanization';
import type { Romanization } from './romanization';
import type { ClosestWord, Confirmed, Correction, Corrections, Page, PageBox } from './types';

// What a page's text and readings can be shown in
export type Script = 'manchu' | Romanization;

// A Manchu box the user says isn't Manchu, which stands in the text as
// other text does
export const NOT_MANCHU: Correction = { manchu: '□', abkai: '□', notManchu: true };

// Which box a correction is for. A box keeps its place when the page is
// read again in edited boxes, unless the user moved or resized it, so its
// correction stays with it.
export const boxKey = (box: Pick<PageBox, 'x' | 'y' | 'w' | 'h'>) => (
	`${box.x},${box.y},${box.w},${box.h}`);

const words = (text: string) => text.split(' ').filter(Boolean);

// A box's reading in a script, '' if it has none. Norman is the server's,
// or (from a server from before it sent it) the Manchu romanized here,
// which comes out the same.
export function boxReading(box: PageBox, script: Script) {
	const manchu = box['prediction-manchu'] ?? '';
	if (script === 'manchu') return manchu;
	if (script === 'abkai') return box['prediction-abkai'] ?? '';
	return box['prediction-norman'] ?? romanizeText(manchu, 'norman');
}

// The user's reading of a box in a script: their word, kept in Manchu and
// Abkai, or □ for a box they say isn't Manchu
export function correctionReading(correction: Correction, script: Script) {
	if (correction.notManchu) return '□';
	return script === 'norman' ? romanizeText(correction.manchu, 'norman') : correction[script];
}

// A dictionary word in a romanization
export const closestReading = (word: ClosestWord, romanization: Romanization) => (
	romanization === 'abkai' ? word.abkai : word.norman ?? romanizeText(word.manchu, 'norman'));

// The page's text in a script, as the server gave it (Norman romanized here
// if the server didn't send it)
const serverText = (page: Page, script: Script) => (
	script === 'norman' ? page.norman ?? romanizeText(page.manchu, 'norman') : page[script]);

// One word of a page's text, and the index in page.boxes of the box it's
// from, if it's matched to one
export type TextWord = { word: string; box?: number };

// The page's text, in Manchu or a romanization, a list of words per line,
// with each
// corrected box's words in place of the model's. Each line of the server's
// text is its column's boxes in order, with □ for other text, leaving out
// boxes read as nothing and Manchu read with low confidence (unless it was
// marked Manchu by hand). So each box takes the next words if they're its
// reading, and is taken as left out if not. A box left out of the text that
// the user corrected goes in where it would have been: they've said what it
// is.
export function textLines(page: Page, corrections: Corrections,
	script: Script): TextWord[][] {
	return serverText(page, script).split('\n').map((line, index) => {
		const tokens = words(line);
		const out: TextWord[] = [];
		let next = 0;
		const boxes = page.boxes.map((box, i) => ({ box, i }))
			.filter(({ box }) => box.line === index)
			.sort((a, b) => a.box.position - b.box.position);
		for (const { box, i } of boxes) {
			const reading = box.kind === 'manchu' ? words(boxReading(box, script)) : ['□'];
			const correction = box.kind === 'manchu' ? corrections[boxKey(box)] : undefined;
			const inText = reading.length > 0
				&& reading.every((word, j) => tokens[next + j] === word);
			if (inText) next += reading.length;
			const shown = correction ? words(correctionReading(correction, script))
				: inText ? reading : [];
			out.push(...shown.map((word) => ({ word, box: i })));
		}
		// Anything not matched to a box stays, rather than being lost
		out.push(...tokens.slice(next).map((word) => ({ word })));
		return out;
	});
}

// The boxes of a page still flagged as possible misreadings, by index:
// those the user hasn't corrected or marked as read right
export const unresolvedFlags = (page: Page, expected: string,
	corrections: Corrections = {}, confirmed: Confirmed = {}) => (
	flaggedBoxes(page.boxes, expected)
		.map((flagged, index) => {
			const key = boxKey(page.boxes[index]);
			return flagged && !corrections[key] && !confirmed[key] ? index : -1;
		})
		.filter((index) => index >= 0));

// The page's text in one script, with the user's corrections in place, a
// line per column. withOther false leaves out the □ for each box of other
// text, and any line left empty by that.
export function pageText(page: Page, corrections: Corrections,
	script: Script, withOther: boolean) {
	return textLines(page, corrections, script)
		.map((line) => line.map(({ word }) => word)
			.filter((word) => withOther || word !== '□').join(' '))
		.filter((line) => withOther || line)
		.join('\n');
}
