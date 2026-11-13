// Reads a transcription to compare with from a .txt in the format Save the
// text writes: a line per column; Manchu, a romanization (Abkai or Norman)
// or both (Manchu, then the romanization, a blank line apart); and for a
// PDF, each page under a "Page n" heading. Gives the Abkai, as the
// transcription box has it, since that's what's compared: a paragraph per
// page, a line per column.

import { romanize, toManchu } from './romanization';

const MANCHU = /[᠀-᢯]/;
const HEADING = /^Page (\d+)$/;
// Save the text's note for a page that couldn't be read
const UNREAD = '(This page couldn\'t be read.)';
// Stands for a page with nothing to compare with, so the pages after it
// keep their places (an empty paragraph would be dropped)
export const EMPTY_PAGE = '□';

// Letters only Norman has, to tell its text from Abkai's
const NORMAN = /[ūšž]/i;

// Manchu written in Abkai, word by word, keeping □ for other text
const toAbkai = (block: string) => block.split('\n')
	.map((line) => line.split(/\s+/).filter(Boolean)
		.map((word) => (word === '□' ? word : romanize(word, 'abkai'))).join(' '))
	.join('\n');

// Norman written in Abkai, by way of the Manchu, word by word. A word with
// a letter Norman doesn't have is kept as it is.
const normanToAbkai = (block: string) => block.split('\n')
	.map((line) => line.split(/\s+/).filter(Boolean)
		.map((word) => {
			const manchu = word === '□' ? undefined : toManchu(word, 'norman');
			return manchu === undefined ? word : romanize(manchu, 'abkai');
		}).join(' '))
	.join('\n');

// The Abkai of some of the file: its Manchu blocks in Abkai if it has any
// (exact, whichever romanization is beside them), or else its romanized
// blocks, Norman ones (with ū, š or ž) turned into Abkai. Blocks are kept
// apart by a blank line, as they may be pages.
function abkaiOf(text: string) {
	const blocks = text.split(/\n\s*\n/)
		.map((block) => block.trim())
		.filter((block) => block && block !== UNREAD);
	const manchu = blocks.filter((block) => MANCHU.test(block));
	if (manchu.length) return manchu.map(toAbkai).join('\n\n');
	const norman = blocks.some((block) => NORMAN.test(block));
	return (norman ? blocks.map(normanToAbkai) : blocks).join('\n\n');
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
