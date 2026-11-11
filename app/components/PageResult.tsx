import { alignWords, pageWords, wordLetters } from './pagecompare';
import type { Page, RandomPage } from './types';
import styles from './pageresult.module.css';

// How the page was turned to straighten it, or undefined if it barely was
function describeAngle(angle: number) {
	if (Math.abs(angle) < 0.05) return undefined;
	const direction = angle > 0 ? 'anticlockwise' : 'clockwise';
	return `Turned ${Math.abs(angle).toFixed(1)}° ${direction} to straighten it.`;
}

const percent = (value: number) => value
	.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 });

// The Abkai expected, if any, compared letter by letter with the page's
// reading. Words are lined up first, then the letters within them. A random
// page has its transcription and the server's score.
function Comparison({ abkai, expected, score }: {
	abkai: string;
	expected: string;
	score?: RandomPage['score'];
}) {
	const predicted = pageWords(abkai);
	const truth = pageWords(expected);
	const aligned = alignWords(predicted, truth);
	const right = aligned.filter(({ status }) => status === 'right').length;

	return (
		<section className={styles.comparison}>
			<h4>{score ? 'Compared with the transcription' : 'Compared with your text'}</h4>
			<p>
				{score
					? `${percent(score.characters)} of letters and ${percent(score.words)} of words right, matching each line of the transcription to the closest line read, without punctuation. `
					: `${right} of ${truth.length} words right. `}
				Red letters are wrong, letters with a wavy line are extra, and faint
				letters are missing.
			</p>
			<p className={styles.diff}>
				{aligned.map((word, key) => (
					<span key={key}>
						{wordLetters(word).map(({ letter, status }, index) => (
							<span key={index} className={styles[status]}>{letter}</span>
						))}
					</span>
				))}
			</p>
		</section>
	);
}

// A page read by POST /upload/multiple or GET /random?source=page: the page
// with its boxes drawn on, its text in Manchu and Abkai, and how that
// compares with the Abkai expected (the user's, or a random page's
// transcription)
export default function PageResult({ page, expected = '' }: {
	page: Page | RandomPage;
	expected?: string;
}) {
	const random = 'transcription' in page ? page : undefined;
	const angle = describeAngle(page.angle);
	const found = page.boxes.some(({ kind }) => kind === 'manchu');

	return (
		<section className={styles.page}>
			<h3>Page</h3>
			<div className={styles.reading}>
			<figure className={styles.marked}>
				<img
					src={page.image}
					alt="Your page, with each Manchu word outlined in green and labelled with its reading, and other text outlined in red"
				/>
				<figcaption>
					{`Read by ${page.model}. Manchu words are outlined in green and labelled with their reading; other text is outlined in red.`}
					{angle && ` ${angle}`}
					{random?.credit && (
						<span className={styles.credit}>
							{'Page: '}
							{random.link
								? <a href={random.link} target="_blank" rel="noreferrer">{random.credit}</a>
								: random.credit}
						</span>
					)}
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
			</div>
			{expected && (
				<Comparison abkai={page.abkai} expected={expected} score={random?.score} />
			)}
		</section>
	);
}
