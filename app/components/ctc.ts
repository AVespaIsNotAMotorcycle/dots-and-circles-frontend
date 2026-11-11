// Lines a predicted word up with the true one, letter by letter

import { INVISIBLE } from './romanization';

// One letter of a predicted word lined up against the true word (see
// diffLetters)
export type DiffLetter = {
	letter: string;
	// The letter's place in the prediction, or -1 if it's missing
	index: number;
	status: 'ok' | 'wrong' | 'extra' | 'missing';
};

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
	for (let i = 0; i <= visible.length; i++) {
		for (let j = 0; j <= target.length; j++) {
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
	let i = visible.length;
	let j = target.length;
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
	let next = 0;
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
