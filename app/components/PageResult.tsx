import { useEffect, useRef, useState } from 'react';

import { alignWords, boxStatuses, pageWords, wordLetters } from './pagecompare';
import type { Page, PageBox, SamplePage } from './types';
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
	score?: SamplePage['score'];
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

// One box on the page. Manchu has its Abkai reading written down it, and is
// green if read right, red if read wrong, blue with nothing to compare it
// with, and yellow if read with too little confidence to be in the text.
// Other text is grey. Clicking it (or Enter or Space) calls onOpen.
function BoxOutline({ box, status, onOpen }: {
	box: PageBox;
	// How its reading compares with the expected text, if it does
	status?: 'right' | 'wrong';
	onOpen: () => void;
}) {
	const manchu = box.kind === 'manchu';
	const unsure = manchu && Boolean(box['low-confidence']);
	const verdict = status === 'right' ? ', read right'
		: status === 'wrong' ? ', read wrong' : '';
	const reading = box['prediction-abkai'] ?? '';
	// Written top to bottom, as wide as the box allows, but no longer than it
	const fontSize = Math.min(box.w * 0.6,
		(box.h * 0.9) / Math.max(reading.length * 0.6, 1));
	return (
		<g
			className={[manchu ? styles.manchuBox : styles.otherBox,
				manchu && !unsure && styles[status ?? 'unchecked'],
				unsure && styles.lowConfidence].filter(Boolean).join(' ')}
			role="button"
			tabIndex={0}
			aria-label={manchu
				? `Manchu word read as ${reading}${unsure ? ', with low confidence' : verdict}`
				: 'Other text'}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				onOpen();
			}}
		>
			<rect x={box.x} y={box.y} width={box.w} height={box.h} />
			{manchu && reading && (
				<text
					x={box.x + box.w / 2}
					y={box.y + box.h / 2}
					fontSize={fontSize}
				>
					{reading}
				</text>
			)}
		</g>
	);
}

// The part of the page in a box, with the model's reading of it
function BoxDialog({ box, onClose }: {
	box: PageBox | undefined;
	onClose: () => void;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		if (box && !dialog.current?.open) dialog.current?.showModal();
		if (!box && dialog.current?.open) dialog.current?.close();
	}, [box]);
	const manchu = box?.kind === 'manchu';

	return (
		<dialog
			ref={dialog}
			className={styles.dialog}
			onClose={onClose}
			// A click on the backdrop lands on the dialog itself
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			{box && (
				<div className={styles.dialogBody}>
					<img src={box.image} alt="The part of the page in this box" />
					<div className={styles.dialogText}>
						{manchu ? (
							<>
								<h4>Model Prediction</h4>
								<p className={styles.dialogManchu}>{box['prediction-manchu']}</p>
								<p className={styles.abkai}>{box['prediction-abkai']}</p>
								{box.confidence !== null && (
									<p className={styles.hint}>
										{`Confidence: ${percent(box.confidence)}`}
									</p>
								)}
								{box['low-confidence'] && (
									<p className={styles.lowConfidenceNote}>
										Low confidence, so this reading is left out of the page&apos;s
										text.
									</p>
								)}
							</>
						) : (
							<>
								<h4>Not Manchu</h4>
								<p>
									{`The classifier gives it a ${percent(box['manchu-probability'])} chance of being Manchu, so the model didn't read it.`}
								</p>
							</>
						)}
						<button type="button" onClick={onClose}>Close</button>
					</div>
				</div>
			)}
		</dialog>
	);
}

// The page with its boxes drawn over it, in the page image's own pixels,
// each Manchu box coloured by how it compares with the expected Abkai
function PageImage({ page, expected }: { page: Page; expected: string }) {
	const statuses = boxStatuses(page.boxes, expected);
	const [size, setSize] = useState<{ image: string; w: number; h: number }>();
	const [open, setOpen] = useState<PageBox>();
	useEffect(() => {
		const image = new Image();
		image.onload = () => {
			setSize({ image: page.image, w: image.naturalWidth, h: image.naturalHeight });
		};
		image.src = page.image;
	}, [page.image]);

	// Until the new page's size is known
	if (size?.image !== page.image) {
		return <div className={styles.pagePlaceholder} />;
	}
	return (
		<>
			<svg
				className={styles.pageImage}
				width={size.w}
				height={size.h}
				viewBox={`0 0 ${size.w} ${size.h}`}
				role="group"
				aria-label="The page, with each word outlined as the caption describes. Select a box to see it closer."
			>
				<image href={page.image} width={size.w} height={size.h} />
				{page.boxes.map((box, key) => (
					<BoxOutline
						key={key}
						box={box}
						status={statuses[key]}
						onOpen={() => { setOpen(box); }}
					/>
				))}
			</svg>
			<BoxDialog box={open} onClose={() => { setOpen(undefined); }} />
		</>
	);
}

// A page read by POST /upload/multiple or GET /random?source=page: the page
// with its boxes drawn over it, its text in Manchu and Abkai, and how that
// compares with the Abkai expected (the user's, or a sample page's
// transcription)
export default function PageResult({ page, expected = '' }: {
	page: Page | SamplePage;
	expected?: string;
}) {
	const random = 'transcription' in page ? page : undefined;
	const angle = describeAngle(page.angle);
	const found = page.boxes.some(({ kind }) => kind === 'manchu');
	// Whether there's any text to compare the reading with
	const compared = pageWords(expected).length > 0;

	return (
		<section className={styles.page}>
			<h3>Page</h3>
			<div className={styles.reading}>
			<figure className={styles.marked}>
				<PageImage page={page} expected={expected} />
				<figcaption>
					{`Read by ${page.model}. Manchu words are labelled with their reading and outlined ${compared ? 'in green if read right or red if read wrong' : 'in blue'}, or in yellow if read with too little confidence to include in the text; other text is outlined in grey. Click a box to see it closer.`}
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
