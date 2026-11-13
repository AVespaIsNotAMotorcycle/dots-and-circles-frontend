import { useEffect, useRef, useState } from 'react';

import BoxEditor from './BoxEditor';
import type { BoxStatus } from './BoxEditor';
import { NOT_MANCHU, boxKey, textLines } from './corrections';
import type { TextWord } from './corrections';
import {
	alignWords, boxStatuses, flaggedBoxes, pageWords, wordLetters, wordsRight,
} from './pagecompare';
import { abkaiToManchu, standardAbkai } from './romanization';
import type {
	ClosestWord, Confirmed, Correction, Corrections, EditedBox, Page, PageBox, SamplePage,
} from './types';
import useImageScale from './useImageScale';
import styles from './pageresult.module.css';

// How the page was turned to straighten it, or undefined if it barely was
function describeAngle(angle: number) {
	if (Math.abs(angle) < 0.05) return undefined;
	const direction = angle > 0 ? 'anticlockwise' : 'clockwise';
	return `Turned ${Math.abs(angle).toFixed(1)}° ${direction} to straighten it.`;
}

// A page read, perhaps a sample one. A sample page read again in edited
// boxes keeps its transcription and credit, but not the server's score.
export type ReadPage = Page | SamplePage | Omit<SamplePage, 'score'>;

const percent = (value: number) => value
	.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 });

// The Abkai expected, if any, compared letter by letter with the page's
// reading. Words are lined up first, then the letters within them. A random
// page has its transcription and the server's score.
function Comparison({ abkai, expected, transcription, score, corrected }: {
	abkai: string;
	expected: string;
	// Whether the user has corrected any of the page's readings, which this
	// leaves out: it scores the model
	corrected: boolean;
	// Whether expected is a sample page's transcription
	transcription: boolean;
	score?: SamplePage['score'];
}) {
	const aligned = alignWords(pageWords(abkai), pageWords(expected));
	const { right, total } = wordsRight(abkai, expected);

	return (
		<section className={styles.comparison}>
			<h4>{transcription ? 'Compared with the transcription' : 'Compared with your text'}</h4>
			<p>
				{score
					? `${percent(score.characters)} of letters and ${percent(score.words)} of words right, matching each line of the transcription to the closest line read, without punctuation. `
					: `${right} of ${total} words right. `}
				Red letters are wrong, letters with a wavy line are extra, and faint
				letters are missing.
				{corrected && ' This compares the model\'s reading, not your corrections.'}
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

// A badge's radius, in screen pixels
const BADGE = 7;

const SOURCES: Record<ClosestWord['sources'][number], string> = {
	kaikki: 'Wiktionary',
	norman: 'Norman\'s dictionary',
};

// One box on the page. Manchu has its Abkai reading written down it, and is
// green if read right, red if read wrong, blue with nothing to compare it
// with, and yellow if read with too little confidence to be in the text.
// Other text is grey. A box whose closest dictionary words are worth a look
// has a badge on its corner. One the user corrected shows their word in
// teal, with a pencil badge. Clicking it (or Enter or Space) calls onOpen.
function BoxOutline({ box, id, status, suggests, correction, badge, onOpen }: {
	box: PageBox;
	// Its data-box-id, so it can be found to go to
	id?: string;
	correction?: Correction;
	// How its reading compares with the expected text, if it does
	status?: 'right' | 'wrong';
	// Whether it has the badge, and its radius in the image's pixels
	suggests: boolean;
	badge: number;
	onOpen: () => void;
}) {
	const manchu = box.kind === 'manchu';
	const unsure = manchu && Boolean(box['low-confidence']);
	const verdict = status === 'right' ? ', read right'
		: status === 'wrong' ? ', read wrong' : '';
	const read = box['prediction-abkai'] ?? '';
	// Marked by the user as not Manchu, it's drawn as other text
	const notManchu = Boolean(correction?.notManchu);
	const reading = notManchu ? '' : correction?.abkai ?? read;
	// Written top to bottom, as wide as the box allows, but no longer than it
	const fontSize = Math.min(box.w * 0.6,
		(box.h * 0.9) / Math.max(reading.length * 0.6, 1));
	return (
		<g
			className={[manchu && !notManchu ? styles.manchuBox : styles.otherBox,
				manchu && !notManchu && !unsure && styles[status ?? 'unchecked'],
				manchu && !notManchu && unsure && styles.lowConfidence,
				correction && !notManchu && styles.corrected].filter(Boolean).join(' ')}
			data-box-id={id}
			role="button"
			tabIndex={0}
			aria-label={manchu
				? `Manchu word read as ${read}${unsure ? ', with low confidence' : verdict}${notManchu ? ', marked as not Manchu' : correction ? `, corrected to ${correction.abkai}` : suggests ? ', with close dictionary words' : ''}`
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
			{(suggests || correction) && (
				<g className={[styles.badge, correction && styles.correctedBadge]
					.filter(Boolean).join(' ')}>
					<circle cx={box.x + box.w} cy={box.y} r={badge} />
					<text x={box.x + box.w} y={box.y} fontSize={badge * 1.5}>
						{correction ? '✎' : '?'}
					</text>
				</g>
			)}
		</g>
	);
}

// One reading a box could have, as a card: in Manchu and Abkai, with a
// line or two about it. The current one is marked; another, with onPick, is
// a button that makes it the reading, action saying how.
function Choice({ manchu, abkai, details, current, action, onPick }: {
	manchu: string;
	abkai: string;
	details: string[];
	current: boolean;
	action?: string;
	onPick?: () => void;
}) {
	const content = (
		<>
			<span className={styles.choiceManchu} aria-hidden="true">{manchu}</span>
			<span className={styles.choiceText}>
				<span className={styles.choiceWord}>{abkai}</span>
				{details.map((detail) => (
					<span key={detail} className={styles.choiceDetail}>{detail}</span>
				))}
				{current
					? <span className={styles.choiceCurrent}>✓ Current reading</span>
					: action && <span className={styles.choiceAction}>{action}</span>}
			</span>
		</>
	);
	return (
		<li>
			{current || !onPick ? (
				<div className={[styles.choice, current && styles.currentChoice]
					.filter(Boolean).join(' ')}>
					{content}
				</div>
			) : (
				<button type="button" className={styles.choice} onClick={onPick}>
					{content}
				</button>
			)}
		</li>
	);
}

// The box's reading as the user would have it, typed in Abkai and shown in
// Manchu as they type
function TypeReading({ box, onCorrect }: {
	box: PageBox;
	onCorrect: (correction?: Correction) => void;
}) {
	const [typed, setTyped] = useState('');
	const manchu = typed.trim() ? abkaiToManchu(typed) : undefined;
	const invalid = Boolean(typed.trim()) && !manchu;
	const id = `correct-${boxKey(box)}`;

	return (
		<form
			className={styles.typeForm}
			onSubmit={(event) => {
				event.preventDefault();
				if (!manchu) return;
				const abkai = standardAbkai(typed) ?? typed.trim();
				// The model's own reading is no correction
				onCorrect(abkai === box['prediction-abkai'] ? undefined : { manchu, abkai });
			}}
		>
			<label htmlFor={id}>Or type your own, in Abkai</label>
			<div className={styles.typeRow}>
				<input
					id={id}
					type="text"
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
					value={typed}
					aria-invalid={invalid}
					aria-describedby={`${id}-hint`}
					onChange={(event) => { setTyped(event.target.value); }}
				/>
				<button type="submit" disabled={!manchu}>Use</button>
				{manchu && <span className={styles.typedManchu} aria-hidden="true">{manchu}</span>}
			</div>
			<span id={`${id}-hint`} className={invalid ? styles.error : styles.hint}>
				{invalid
					? 'That has a letter Abkai doesn\'t use.'
					: 'Use \' (or ‘) for the loanword marks, as in k\'.'}
			</span>
		</form>
	);
}

// The part of the page in a box beside the model's reading of it, and the
// readings it could have to choose from: the model's (to mark as right, or
// go back to), the closest dictionary words, or the user's own, typed in.
// Or it can be marked as not Manchu.
function BoxDialog({
	box, flagged, correction, confirmed, onCorrect, onConfirm, onClose,
}: {
	box: PageBox | undefined;
	// Whether it's flagged as a possible misreading
	flagged: boolean;
	// Whether the user marked its flagged reading as right, and how to change
	// that
	confirmed: boolean;
	onConfirm: (confirmed: boolean) => void;
	// The user's word for it, if they corrected it, and how to change that
	correction?: Correction;
	onCorrect: (correction?: Correction) => void;
	onClose: () => void;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const close = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (box && !dialog.current?.open) {
			dialog.current?.showModal();
			// Rather than the first choice, so Enter doesn't pick it
			close.current?.focus();
		}
		if (!box && dialog.current?.open) dialog.current?.close();
	}, [box]);

	const header = (title: string, detail?: string) => (
		<header className={styles.dialogHeader}>
			<div>
				<h4 id="box-dialog-title">{title}</h4>
				{detail && <p className={styles.hint}>{detail}</p>}
			</div>
			<button
				ref={close}
				type="button"
				className={styles.closeX}
				aria-label="Close"
				onClick={onClose}
			>
				×
			</button>
		</header>
	);

	let content: React.ReactNode = null;
	if (box && box.kind !== 'manchu') {
		content = (
			<>
				{header('Not Manchu')}
				<div className={styles.dialogBody}>
					<div className={styles.crop}>
						<img src={box.image} alt="The part of the page in this box" />
					</div>
					<p>
						{`The classifier gives it a ${percent(box['manchu-probability'])} chance of being Manchu, so the model didn't read it.`}
					</p>
				</div>
				<footer className={styles.dialogFooter}>
					<span />
					<button type="button" onClick={onClose}>Close</button>
				</footer>
			</>
		);
	} else if (box) {
		const read = box['prediction-abkai'] ?? '';
		const notManchu = Boolean(correction?.notManchu);
		const closest = box['closest-words'] ?? [];
		const sources = (word: ClosestWord) => word.sources
			.map((source) => SOURCES[source] ?? source).join(', ');
		// The dictionary's own entry for the reading, if it has one
		const entry = closest.find(({ distance }) => distance === 0);
		const others = closest.filter((word) => word !== entry);
		const typed = correction && !notManchu
			&& !others.some(({ abkai }) => abkai === correction.abkai) ? correction : undefined;
		const settled = !flagged || confirmed;
		content = (
			<>
				{header(read || '(nothing read)', box.confidence !== null
					? `The model's reading, ${percent(box.confidence)} confident` : undefined)}
				<div className={styles.dialogBody}>
					<div className={styles.crop}>
						<img src={box.image} alt="The part of the page in this box" />
						<span className={styles.dialogManchu} aria-hidden="true">
							{box['prediction-manchu']}
						</span>
					</div>
					<div className={styles.dialogMain}>
						{box['low-confidence'] && (
							<p className={styles.lowConfidenceNote}>
								Low confidence, so the model&apos;s reading is left out of the
								page&apos;s text.
							</p>
						)}
						{notManchu && (
							<p className={styles.statusNote}>
								Marked as not Manchu: it stands as □ in the page&apos;s text.
							</p>
						)}
						{flagged && confirmed && !correction && (
							<p className={styles.statusNote}>
								{'You marked the model\'s reading as right. '}
								<button type="button" onClick={() => { onConfirm(false); }}>
									Undo
								</button>
							</p>
						)}
						<section className={styles.choices}>
							<h5>{flagged && !settled && !correction ? 'Did you mean?' : 'Reading'}</h5>
							<ul>
								<Choice
									manchu={box['prediction-manchu'] ?? ''}
									abkai={read}
									details={[
										'The model\'s reading',
										entry ? `In ${sources(entry)}` : closest.length ? 'Not in the dictionaries' : '',
									].filter(Boolean)}
									current={!correction && settled}
									action={correction ? 'Go back to it' : 'Mark as right'}
									onPick={() => {
										if (correction) onCorrect(undefined);
										else onConfirm(true);
									}}
								/>
								{others.map((word) => (
									<Choice
										key={word.abkai}
										manchu={word.manchu}
										abkai={word.abkai}
										details={[
											`${word.distance} ${word.distance === 1 ? 'change' : 'changes'} from the reading`,
											sources(word),
										]}
										current={correction?.abkai === word.abkai && !notManchu}
										action="Use this"
										onPick={() => { onCorrect({ manchu: word.manchu, abkai: word.abkai }); }}
									/>
								))}
								{typed && (
									<Choice
										manchu={typed.manchu}
										abkai={typed.abkai}
										details={['Your own reading']}
										current
									/>
								)}
							</ul>
						</section>
						<TypeReading key={boxKey(box)} box={box} onCorrect={onCorrect} />
					</div>
				</div>
				<footer className={styles.dialogFooter}>
					{notManchu ? (
						<button type="button" onClick={() => { onCorrect(undefined); }}>
							It&apos;s Manchu after all
						</button>
					) : (
						<button type="button" onClick={() => { onCorrect(NOT_MANCHU); }}>
							Not Manchu
						</button>
					)}
					<button type="button" onClick={onClose}>Close</button>
				</footer>
			</>
		);
	}

	return (
		<dialog
			ref={dialog}
			className={styles.dialog}
			aria-labelledby="box-dialog-title"
			onClose={onClose}
			// A click on the backdrop lands on the dialog itself
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			{content}
		</dialog>
	);
}

// The page with its boxes drawn over it, in the page image's own pixels,
// each Manchu box coloured by how it compares with the expected Abkai. While
// editing, the boxes can be changed and sent with onSubmit to be read again.
function PageImage({ page, statuses, suggests, corrections, boxId, onOpen, editing }: {
	page: Page;
	// Each box's data-box-id, so it can be found to go to
	boxId?: (index: number) => string;
	// How each of page.boxes compares with the expected text, and whether
	// its closest dictionary words are worth a look
	statuses: ('right' | 'wrong' | undefined)[];
	suggests: boolean[];
	// The user's words for boxes
	corrections: Corrections;
	// Shows box index close up
	onOpen: (index: number) => void;
	editing?: {
		busy: boolean;
		onSubmit: (boxes: EditedBox[]) => void;
		onCancel: () => void;
	};
}) {
	const [size, setSize] = useState<{ image: string; w: number; h: number }>();
	const svg = useRef<SVGSVGElement>(null);
	const scale = useImageScale(svg, size?.w);
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
	if (editing) {
		// Coloured as outside the editor, so the boxes read wrong stay marked
		const editStatuses = page.boxes.map((box, index): BoxStatus => (
			box['low-confidence'] ? 'lowConfidence' : statuses[index] ?? 'unchecked'));
		// Labelled with the user's words, as outside the editor
		const labels = page.boxes.map((box) => corrections[boxKey(box)]?.abkai);
		return (
			<BoxEditor
				page={page}
				statuses={editStatuses}
				labels={labels}
				size={size}
				{...editing}
			/>
		);
	}
	return (
		<>
			<svg
				ref={svg}
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
						id={boxId?.(key)}
						status={statuses[key]}
						suggests={suggests[key]}
						correction={box.kind === 'manchu' ? corrections[boxKey(box)] : undefined}
						badge={BADGE * scale}
						onOpen={() => { onOpen(key); }}
					/>
				))}
			</svg>
		</>
	);
}

// A line per column of the page's text, in Manchu or Abkai, with the user's
// corrections in place. Each word read from a box opens that box close up,
// as clicking the box does, and is marked as the box is: a ? if its closest
// dictionary words are worth a look, or a ✎ in teal if corrected.
function PageText({ lines, suggests, corrected, script, boxId, onOpen }: {
	lines: TextWord[][];
	boxId?: (index: number) => string;
	suggests: boolean[];
	// Whether each of the page's boxes was corrected
	corrected: boolean[];
	script: 'manchu' | 'abkai';
	onOpen: (index: number) => void;
}) {
	return (
		<p className={script === 'manchu' ? styles.manchu : styles.abkai}>
			{lines.map((line, number) => (
				<span key={number} className={styles.textLine}>
					{line.map(({ word, box }, key) => {
						const separator = key > 0 ? ' ' : '';
						if (box === undefined) return `${separator}${word}`;
						// A box's words share its mark, on the last of them
						const last = line[key + 1]?.box !== box;
						const mark = corrected[box] ? '✎' : suggests[box] ? '?' : undefined;
						return (
							<span key={key}>
								{separator}
								<span
									className={[styles.textWord,
										corrected[box] && styles.correctedWord].filter(Boolean).join(' ')}
									data-box-id={boxId?.(box)}
									role="button"
									tabIndex={0}
									aria-label={`${word}${mark === '✎' ? ', corrected' : mark ? ', with close dictionary words' : ''}. Show its box closer.`}
									onClick={() => { onOpen(box); }}
									onKeyDown={(event) => {
										if (event.key !== 'Enter' && event.key !== ' ') return;
										event.preventDefault();
										onOpen(box);
									}}
								>
									{word}
									{last && mark && (
										<span
											className={[styles.wordBadge,
												mark === '✎' && styles.correctedWordBadge].filter(Boolean).join(' ')}
											aria-hidden="true"
										>
											{mark}
										</span>
									)}
								</span>
							</span>
						);
					})}
				</span>
			))}
		</p>
	);
}

// A page read by POST /upload/multiple or GET /random?source=page: the page
// with its boxes drawn over it, its text in Manchu and Abkai, and how that
// compares with the Abkai expected (the user's, or a sample page's
// transcription)
export default function PageResult({
	page, expected = '', title = 'Page', id, onReread, corrections = {}, onCorrect,
	confirmed = {}, onConfirm, boxId,
}: {
	page: ReadPage;
	expected?: string;
	// Its heading, e.g. a PDF's page number
	title?: string;
	// Its element id, for links to it
	id?: string;
	// Reads the page again in edited boxes, rejecting with why it couldn't.
	// Without it, the boxes can't be edited.
	onReread?: (boxes: EditedBox[]) => Promise<void>;
	// The user's words for some of its boxes, by boxKey, and how to change
	// one's (undefined goes back to the model's)
	corrections?: Corrections;
	onCorrect?: (box: PageBox, correction?: Correction) => void;
	// The boxes whose flagged reading the user marked as right, by boxKey,
	// and how to mark or unmark one
	confirmed?: Confirmed;
	onConfirm?: (box: PageBox, confirmed: boolean) => void;
	// Each box's data-box-id, on it and its words, so it can be found to go to
	boxId?: (index: number) => string;
}) {
	const random = 'transcription' in page ? page : undefined;
	// The page whose boxes are being edited, so a new page ends the editing
	const [editingPage, setEditingPage] = useState<ReadPage>();
	const editing = editingPage === page;
	const [rereading, setRereading] = useState(false);
	const [rereadError, setRereadError] = useState<string>();

	const reread = (boxes: EditedBox[]) => {
		if (!onReread) return;
		setRereading(true);
		setRereadError(undefined);
		onReread(boxes)
			.catch((error: Error) => { setRereadError(error.message); })
			.finally(() => { setRereading(false); });
	};
	const angle = describeAngle(page.angle);
	const found = page.boxes.some(({ kind }) => kind === 'manchu');
	// Whether there's any text to compare the reading with
	const compared = pageWords(expected).length > 0;
	const statuses = boxStatuses(page.boxes, expected);
	// Which boxes are flagged as possible misreadings, which still have a
	// badge for that (not once marked as read right), and which the user
	// corrected
	const flaggedBox = flaggedBoxes(page.boxes, expected);
	const suggests = flaggedBox.map((flagged, index) => (
		flagged && !confirmed[boxKey(page.boxes[index])]));
	const flagged = suggests.some(Boolean);
	const isCorrected = page.boxes.map((box) => (
		box.kind === 'manchu' && Boolean(corrections[boxKey(box)])));
	const corrected = isCorrected.filter(Boolean).length;
	// The box shown close up, from the page or its text, for this page only
	const [opened, setOpened] = useState<{ page: ReadPage; index: number }>();
	const open = opened?.page === page ? opened.index : undefined;
	const openBox = (index: number) => { setOpened({ page, index }); };
	const closeBox = () => { setOpened(undefined); };

	return (
		<section className={styles.page} id={id}>
			<h3>{title}</h3>
			<div className={styles.reading}>
			<figure className={styles.marked}>
				<PageImage
					page={page}
					statuses={statuses}
					suggests={suggests}
					corrections={corrections}
					boxId={boxId}
					onOpen={openBox}
					editing={editing ? {
						busy: rereading,
						onSubmit: reread,
						onCancel: () => {
							setEditingPage(undefined);
							setRereadError(undefined);
						},
					} : undefined}
				/>
				{rereadError && <p className={styles.error} role="alert">{rereadError}</p>}
				<figcaption>
					{editing && 'Boxes outlined in purple dashes are read again; the rest keep their reading and colour. '}
					{!editing && `Read by ${page.model}. Manchu words are labelled with their reading and outlined ${compared ? 'in green if read right or red if read wrong' : 'in blue'}, or in yellow if read with too little confidence to include in the text; other text is outlined in grey.${flagged ? ` ${compared ? 'Words read wrong' : 'Readings that aren\'t dictionary words'} have a ? on their corner: click one for the closest dictionary words.` : ''}${corrected ? ' Words you corrected are in teal, with a ✎.' : ''} Click any box to see it closer${onCorrect ? ' or correct its reading' : ''}.`}
					{angle && ` ${angle}`}
					{random?.credit && (
						<span className={styles.credit}>
							{'Page: '}
							{random.link
								? <a href={random.link} target="_blank" rel="noreferrer">{random.credit}</a>
								: random.credit}
						</span>
					)}
					{!editing && onReread && (
						<button
							type="button"
							className={styles.editButton}
							onClick={() => { setEditingPage(page); }}
						>
							Edit Boxes
						</button>
					)}
				</figcaption>
			</figure>
			{found ? (
				<div className={styles.texts}>
					<section>
						<h4>Manchu</h4>
						<PageText
							lines={textLines(page, corrections, 'manchu')}
							suggests={suggests}
							corrected={isCorrected}
							script="manchu"
							boxId={boxId}
							onOpen={openBox}
						/>
					</section>
					<section>
						<h4>Abkai</h4>
						<PageText
							lines={textLines(page, corrections, 'abkai')}
							suggests={suggests}
							corrected={isCorrected}
							script="abkai"
							boxId={boxId}
							onOpen={openBox}
						/>
						<p className={styles.hint}>
							A line per column. □ is a box of other text, such as Chinese.
							Click a word to see its box closer.
							{corrected > 0 && ` With your ${corrected} ${corrected === 1 ? 'correction' : 'corrections'}.`}
						</p>
					</section>
				</div>
			) : (
				<p>No Manchu was found on this page.</p>
			)}
			</div>
			<BoxDialog
				box={open !== undefined ? page.boxes[open] : undefined}
				flagged={open !== undefined && flaggedBox[open]}
				correction={open !== undefined ? corrections[boxKey(page.boxes[open])] : undefined}
				confirmed={open !== undefined && Boolean(confirmed[boxKey(page.boxes[open])])}
				onConfirm={(yes) => {
					if (open === undefined || !onConfirm) return;
					onConfirm(page.boxes[open], yes);
					if (yes) closeBox();
				}}
				onCorrect={(correction) => {
					if (open === undefined || !onCorrect) return;
					onCorrect(page.boxes[open], correction);
					closeBox();
				}}
				onClose={closeBox}
			/>
			{expected && (
				<Comparison
					abkai={page.abkai}
					expected={expected}
					transcription={Boolean(random)}
					score={(random as Partial<SamplePage> | undefined)?.score}
					corrected={corrected > 0}
				/>
			)}
		</section>
	);
}
