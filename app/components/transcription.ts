// Reads a transcription to compare with from a .txt in the format Save the
// text writes: a line per column; Manchu, Abkai or both (Manchu, then
// Abkai, a blank line apart); and for a PDF, each page under a "Page n"
// heading. Gives the Abkai, as the transcription box has it: a paragraph
// per page, a line per column.

import { romanize } from './romanization';

const MANCHU = /[᠀-᢯]/;
const HEADING = /^Page (\d+)$/;
// Save the text's note for a page that couldn't be read
const UNREAD = '(This page couldn\'t be read.)';
// Stands for a page with nothing to compare with, so the pages after it
// keep their places (an empty paragraph would be dropped)
export const EMPTY_PAGE = '□';

// Manchu written in Abkai, word by word, keeping □ for other text
const toAbkai = (block: string) => block.split('\n')
	.map((line) => line.split(/\s+/).filter(Boolean)
		.map((word) => (word === '□' ? word : romanize(word, 'abkai'))).join(' '))
	.join('\n');

// The Abkai of some of the file: its Abkai blocks if it has any (leaving
// out the Manchu, which says the same), or else its Manchu in Abkai.
// Blocks are kept apart by a blank line, as they may be pages.
function abkaiOf(text: string) {
	const blocks = text.split(/\n\s*\n/)
		.map((block) => block.trim())
		.filter((block) => block && block !== UNREAD);
	const abkai = blocks.filter((block) => !MANCHU.test(block));
	return (abkai.length ? abkai : blocks.map(toAbkai)).join('\n\n');
}

export function transcriptionFromText(file: string) {
	const text = file.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
	const lines = text.split('\n');
	if (!lines.some((line) => HEADING.test(line.trim()))) return abkaiOf(text);
	// A PDF's pages, each in its place by its number
	const pages: string[] = [];
	let page: number | undefined;
	let body: string[] = [];
	const finish = () => {
		if (page !== undefined) pages[page - 1] = abkaiOf(body.join('\n')).replace(/\n\n+/g, '\n');
	};
	for (const line of lines) {
		const heading = HEADING.exec(line.trim());
		if (heading) {
			finish();
			page = Number(heading[1]);
			body = [];
		} else {
			body.push(line);
		}
	}
	finish();
	return Array.from(pages, (one) => one || EMPTY_PAGE).join('\n\n');
}
