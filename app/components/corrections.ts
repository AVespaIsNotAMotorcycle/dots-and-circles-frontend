// The user's corrections of a page's readings, and the page's text with
// them in place

import type { Corrections, Page, PageBox } from './types';

// Which box a correction is for. A box keeps its place when the page is
// read again in edited boxes, unless the user moved or resized it, so its
// correction stays with it.
export const boxKey = (box: Pick<PageBox, 'x' | 'y' | 'w' | 'h'>) => (
	`${box.x},${box.y},${box.w},${box.h}`);

const words = (text: string) => text.split(' ').filter(Boolean);

// The page's text, in Manchu or Abkai, with each corrected box's words in
// place of the model's. Each line of the server's text is its column's
// boxes in order, with □ for other text, leaving out boxes read as nothing
// and Manchu read with low confidence (unless it was marked Manchu by hand).
// So each box takes the next words if they're its reading, and is taken as
// left out if not. A box left out of the text that the user corrected goes
// in where it would have been: they've said what it is.
function correctLines(page: Page, corrections: Corrections,
	script: 'manchu' | 'abkai') {
	return page[script].split('\n').map((line, index) => {
		const tokens = words(line);
		const out: string[] = [];
		let next = 0;
		const boxes = page.boxes.filter((box) => box.line === index)
			.sort((a, b) => a.position - b.position);
		for (const box of boxes) {
			const reading = box.kind === 'manchu'
				? words(box[script === 'manchu' ? 'prediction-manchu' : 'prediction-abkai'] ?? '')
				: ['□'];
			const correction = box.kind === 'manchu' ? corrections[boxKey(box)] : undefined;
			const inText = reading.length > 0
				&& reading.every((word, i) => tokens[next + i] === word);
			if (inText) next += reading.length;
			if (correction) out.push(...words(correction[script]));
			else if (inText) out.push(...reading);
		}
		// Anything not matched to a box stays, rather than being lost
		out.push(...tokens.slice(next));
		return out.join(' ');
	}).join('\n');
}

export function correctedText(page: Page, corrections: Corrections) {
	if (!page.boxes.some((box) => corrections[boxKey(box)])) {
		return { manchu: page.manchu, abkai: page.abkai };
	}
	return {
		manchu: correctLines(page, corrections, 'manchu'),
		abkai: correctLines(page, corrections, 'abkai'),
	};
}

// For testing that, with no corrections, the boxes account for the text
export const rebuiltText = (page: Page) => ({
	manchu: correctLines(page, {}, 'manchu'),
	abkai: correctLines(page, {}, 'abkai'),
});
