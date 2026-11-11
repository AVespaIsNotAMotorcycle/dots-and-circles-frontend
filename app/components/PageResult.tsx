import { alignWords, characterAccuracy, pageWords } from './pagecompare';
import ScoreCard from './ScoreCard';
import type { Page } from './types';
import styles from './pageresult.module.css';

// How the page was turned to straighten it, or undefined if it barely was
function describeAngle(angle: number) {
	if (Math.abs(angle) < 0.05) return undefined;
	const direction = angle > 0 ? 'anticlockwise' : 'clockwise';
	return `Turned ${Math.abs(angle).toFixed(1)}° ${direction} to straighten it.`;
}

// The Abkai the user expected, if any, compared word by word with the
// page's reading
function Comparison({ abkai, expected }: { abkai: string; expected: string }) {
	const predicted = pageWords(abkai);
	const truth = pageWords(expected);
	const aligned = alignWords(predicted, truth);
	const right = aligned.filter(({ status }) => status === 'right').length;

	return (
		<section className={styles.comparison}>
			<h4>Compared with your text</h4>
			<p>
				{`${right} of ${truth.length} words right. `}
				Red words are wrong, with what you expected after them; words with a
				wavy line are extra; faint words are missing.
			</p>
			<ScoreCard score={characterAccuracy(predicted, truth)} />
			<p className={styles.diff}>
				{aligned.map(({ predicted, expected, status }, key) => (
					<span key={key} className={styles[status]}>
						{status === 'missing' ? expected : predicted}
						{status === 'wrong' && (
							<span className={styles.expected}> ({expected})</span>
						)}
					</span>
				))}
			</p>
		</section>
	);
}

// A page read by POST /upload/multiple: the page with its boxes drawn on,
// its text in Manchu and Abkai, and how that compares with the Abkai the
// user expected, if they gave it
export default function PageResult({ page, expected = '' }: {
	page: Page;
	expected?: string;
}) {
	const angle = describeAngle(page.angle);
	const found = page.boxes.some(({ kind }) => kind === 'manchu');

	return (
		<section className={styles.page}>
			<h3>Page</h3>
			<figure className={styles.marked}>
				<img
					src={page.image}
					alt="Your page, with each Manchu word outlined in green and labelled with its reading, and other text outlined in red"
				/>
				<figcaption>
					{`Read by ${page.model}. Manchu words are outlined in green and labelled with their reading; other text is outlined in red.`}
					{angle && ` ${angle}`}
				</figcaption>
			</figure>
			{found ? (
				<div className={styles.texts}>
					<section>
						<h4>Manchu</h4>
						<p className={styles.manchu}>{page.manchu}</p>
					</section>
					<section>
						<h4>Abkai</h4>
						<p className={styles.abkai}>{page.abkai}</p>
						<p className={styles.hint}>
							A line per column. □ is a box of other text, such as Chinese.
						</p>
					</section>
				</div>
			) : (
				<p>No Manchu was found on this page.</p>
			)}
			{expected && <Comparison abkai={page.abkai} expected={expected} />}
		</section>
	);
}
