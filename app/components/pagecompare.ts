// Compares a page's reading with the Abkai the user expected

// The loanword marks the user might type, all counted as one. The server
// writes ‘ after k, g and h and ʻ elsewhere.
const MARKS = /['’‘ʻ]/g;
const normalize = (word: string) => word.toLowerCase().replace(MARKS, '\'');

// The words of an Abkai text, leaving out the □ that stands for each box of
// other text
export const pageWords = (text: string) => text.split(/\s+/)
	.filter((word) => word && word !== '□');

// The edit distance between two strings, counting each character
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

// Character accuracy of the predicted words against the expected, as the
// server scores single words: max(0, 1 - edit distance / length)
export function characterAccuracy(predicted: string[], expected: string[]) {
	const truth = expected.map(normalize).join(' ');
	if (!truth) return 0;
	const distance = editDistance(predicted.map(normalize).join(' '), truth);
	return Math.max(0, 1 - distance / truth.length);
}

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
