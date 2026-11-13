// The user's corrections of a page's readings, and the page's text with
// them in place

import type { Corrections, Page, PageBox } from './types';

// Which box a correction is for. A box keeps its place when the page is
// read again in edited boxes, unless the user moved or resized it, so its
// correction stays with it.
export const boxKey = (box: Pick<PageBox, 'x' | 'y' | 'w' | 'h'>) => (
	`${box.x},${box.y},${box.w},${box.h}`);

const words = (text: string) => text.split(' ').filter(Boolean);

// One word of a page's text, and the index in page.boxes of the box it's
// from, if it's matched to one
export type TextWord = { word: string; box?: number };

// The page's text, in Manchu or Abkai, a list of words per line, with each
// corrected box's words in place of the model's. Each line of the server's
// text is its column's boxes in order, with □ for other text, leaving out
// boxes read as nothing and Manchu read with low confidence (unless it was
// marked Manchu by hand). So each box takes the next words if they're its
// reading, and is taken as left out if not. A box left out of the text that
// the user corrected goes in where it would have been: they've said what it
// is.
export function textLines(page: Page, corrections: Corrections,
	script: 'manchu' | 'abkai'): TextWord[][] {
	return page[script].split('\n').map((line, index) => {
		const tokens = words(line);
		const out: TextWord[] = [];
		let next = 0;
		const boxes = page.boxes.map((box, i) => ({ box, i }))
			.filter(({ box }) => box.line === index)
			.sort((a, b) => a.box.position - b.box.position);
		for (const { box, i } of boxes) {
			const reading = box.kind === 'manchu'
				? words(box[script === 'manchu' ? 'prediction-manchu' : 'prediction-abkai'] ?? '')
				: ['□'];
			const correction = box.kind === 'manchu' ? corrections[boxKey(box)] : undefined;
			const inText = reading.length > 0
				&& reading.every((word, j) => tokens[next + j] === word);
			if (inText) next += reading.length;
			const shown = correction ? words(correction[script]) : inText ? reading : [];
			out.push(...shown.map((word) => ({ word, box: i })));
		}
		// Anything not matched to a box stays, rather than being lost
		out.push(...tokens.slice(next).map((word) => ({ word })));
		return out;
	});
}

const join = (lines: TextWord[][]) => lines
	.map((line) => line.map(({ word }) => word).join(' ')).join('\n');

// The page's text with the user's corrections in place
export function correctedText(page: Page, corrections: Corrections) {
	return {
		manchu: join(textLines(page, corrections, 'manchu')),
		abkai: join(textLines(page, corrections, 'abkai')),
	};
}
