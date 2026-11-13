import { useEffect, useId, useRef, useState } from 'react';

import BoxEditor from './BoxEditor';
import type { BoxStatus } from './BoxEditor';
import {
	NOT_MANCHU, boxKey, boxReading, closestReading, correctionReading, textLines,
} from './corrections';
import type { Script, TextWord } from './corrections';
import {
	alignWords, boxStatuses, flaggedBoxes, pageWords, wordLetters, wordsRight,
} from './pagecompare';
import { ROMANIZATION_NAMES, abkaiToManchu, romanizeText, standardAbkai } from './romanization';
import { useRomanization } from './RomanizationContext';
import type {
	ClosestWord, Confirmed, Correction, Corrections, EditedBox, Page, PageBox, SamplePage,
} from './types';
import useImageScale from './useImageScale';
import ZoomFrame from './ZoomFrame';
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
function Comparison({ abkai, expected, transcription, score, corrected, inNorman }: {
	abkai: string;
	expected: string;
	// Whether the page is shown in Norman, though this compares in Abkai
	inNorman: boolean;
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
				{inNorman && ' It compares in Abkai, as the transcription is written.'}
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
// Which box is linked (hovered or focused, as a box or a word of the
// text), so its box and words are highlighted together, and how to change
// that: a box's index, or undefined for none
type Linking = { linked?: number; onLink: (index: number | undefined) => void };

// The events that link a box or word while it's hovered or focused
const linkEvents = (index: number, onLink: Linking['onLink']) => ({
	onMouseEnter: () => { onLink(index); },
	onMouseLeave: () => { onLink(undefined); },
	onFocus: () => { onLink(index); },
	onBlur: () => { onLink(undefined); },
});

function BoxOutline({
	box, id, status, suggests, correction, badge, linked, linkEvents: events, onOpen,
}: {
	box: PageBox;
	// Whether it's highlighted with its words, and the events that do that
	linked: boolean;
	linkEvents: ReturnType<typeof linkEvents>;
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
	const [romanization] = useRomanization();
	const read = boxReading(box, romanization);
	// Marked by the user as not Manchu, it's drawn as other text
	const notManchu = Boolean(correction?.notManchu);
	const reading = notManchu ? '' : correction ? correctionReading(correction, romanization) : read;
	// Written top to bottom, as wide as the box allows, but no longer than it
	const fontSize = Math.min(box.w * 0.6,
		(box.h * 0.9) / Math.max(reading.length * 0.6, 1));
	return (
		<g
			className={[manchu && !notManchu ? styles.manchuBox : styles.otherBox,
				manchu && !notManchu && !unsure && styles[status ?? 'unchecked'],
				manchu && !notManchu && unsure && styles.lowConfidence,
				correction && !notManchu && styles.corrected,
				linked && styles.linked].filter(Boolean).join(' ')}
			data-box-id={id}
			{...events}
			role="button"
			tabIndex={0}
			aria-label={manchu
				? `Manchu word read as ${read}${unsure ? ', with low confidence' : verdict}${notManchu ? ', marked as not Manchu' : correction ? `, corrected to ${reading}` : suggests ? ', with close dictionary words' : ''}`
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

// One reading a box could have, as a card: in Manchu and romanized, with a
// line or two about it. The current one is marked; another, with onPick, is
// a button that makes it the reading, action saying how.
type ChoiceProps = {
	manchu: string;
	// Romanized, as the user has chosen
	reading: string;
	details: string[];
	current: boolean;
	action?: string;
	onPick?: () => void;
};

function Choice({ manchu, reading, details, current, action, onPick, shortcut }: ChoiceProps & {
	// The number key that picks it, if any
	shortcut?: number;
}) {
	const content = (
		<>
			<span className={styles.choiceManchu} aria-hidden="true">{manchu}</span>
			<span className={styles.choiceText}>
				<span className={styles.choiceWord}>{reading}</span>
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
				<button
					type="button"
					className={styles.choice}
					aria-keyshortcuts={shortcut ? String(shortcut) : undefined}
					onClick={onPick}
				>
					{content}
					{shortcut && <kbd className={styles.shortcut} aria-hidden="true">{shortcut}</kbd>}
				</button>
			)}
		</li>
	);
}

// The size of an image in pixels, once it's loaded, and the image it's
// for, so a new image's size isn't taken from the last
type ImageSize = { image: string; w: number; h: number };
function useImageSize(src: string) {
	const [size, setSize] = useState<ImageSize>();
	useEffect(() => {
		const image = new Image();
		image.onload = () => {
			setSize({ image: src, w: image.naturalWidth, h: image.naturalHeight });
		};
		image.src = src;
	}, [src]);
	return size?.image === src ? size : undefined;
}

// A box with a margin of the page around it, from the page image, with the
// box outlined, to see what it takes in and what it leaves out. Its own
// image until the page's size is known.
function BoxCrop({ box, page }: {
	box: PageBox;
	page?: { image: string; size?: ImageSize };
}) {
	if (!page?.size) {
		return <img className={styles.cropImage} src={box.image} alt="The part of the page in this box" />;
	}
	const { size } = page;
	// A few pixels each side, more for a bigger box
	const margin = Math.max(6, Math.round(0.2 * Math.min(box.w, box.h)));
	const left = Math.max(0, box.x - margin);
	const top = Math.max(0, box.y - margin);
	const right = Math.min(size.w, box.x + box.w + margin);
	const bottom = Math.min(size.h, box.y + box.h + margin);
	return (
		<svg
			className={styles.cropImage}
			width={right - left}
			height={bottom - top}
			viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
			// As tall as there's room for, unless that makes it too wide
			style={{
				width: `min(11rem, calc(var(--crop-height) * ${(right - left) / (bottom - top)}))`,
				aspectRatio: `${right - left} / ${bottom - top}`,
			}}
			role="img"
			aria-label="The part of the page in this box, with a little of the page around it"
		>
			<image href={page.image} width={size.w} height={size.h} />
			<rect
				className={styles.cropBox}
				x={box.x}
				y={box.y}
				width={box.w}
				height={box.h}
			/>
		</svg>
	);
}

// The box's reading as the user would have it, typed in Abkai and shown in
// Manchu as they type
function TypeReading({ box, inputRef, onCorrect }: {
	box: PageBox;
	// Its text box, for the T key to go to
	inputRef: React.RefObject<HTMLInputElement | null>;
	onCorrect: (correction?: Correction) => void;
}) {
	const [typed, setTyped] = useState('');
	const [romanization] = useRomanization();
	const manchu = typed.trim() ? abkaiToManchu(typed) : undefined;
	const invalid = Boolean(typed.trim()) && !manchu;
	// Unique on the page, which may have a close-up for each of a PDF's pages
	const id = useId();

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
					ref={inputRef}
					id={id}
					type="text"
					aria-keyshortcuts="T"
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
				{manchu && romanization === 'norman' && (
					<span className={styles.typedNorman}>{`Norman: ${romanizeText(manchu, 'norman')}`}</span>
				)}
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
	box, page, flagged, correction, confirmed, onCorrect, onConfirm, onClose,
}: {
	box: PageBox | undefined;
	// The page image the box is in, and its size once known
	page?: { image: string; size?: ImageSize };
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
	const [romanization] = useRomanization();
	// Unique on the page, which may have one for each of a PDF's pages
	const titleId = useId();
	const typeBox = useRef<HTMLInputElement>(null);
	// What the keys do in a Manchu box's close-up: a number picks that
	// card, T goes to the text box, N marks it not Manchu (or takes that
	// back). Not while typing, nor with Ctrl, Alt or ⌘.
	let onKey: ((key: string) => boolean) | undefined;
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
				<h4 id={titleId}>{title}</h4>
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
						<BoxCrop box={box} page={page} />
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
		const read = boxReading(box, romanization);
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
		const choices: (ChoiceProps & { key: string })[] = [
			{
				key: 'model',
				manchu: box['prediction-manchu'] ?? '',
				reading: read,
				details: [
					'The model\'s reading',
					entry ? `In ${sources(entry)}` : closest.length ? 'Not in the dictionaries' : '',
				].filter(Boolean),
				current: !correction && settled,
				action: correction ? 'Go back to it' : 'Mark as right',
				onPick: () => {
					if (correction) onCorrect(undefined);
					else onConfirm(true);
				},
			},
			...others.map((word) => ({
				key: word.abkai,
				manchu: word.manchu,
				reading: closestReading(word, romanization),
				details: [
					`${word.distance} ${word.distance === 1 ? 'change' : 'changes'} from the reading`,
					sources(word),
				],
				current: correction?.abkai === word.abkai && !notManchu,
				action: 'Use this',
				onPick: () => { onCorrect({ manchu: word.manchu, abkai: word.abkai }); },
			})),
			...(typed ? [{
				key: 'typed',
				manchu: typed.manchu,
				reading: correctionReading(typed, romanization),
				details: ['Your own reading'],
				current: true,
			}] : []),
		];
		// Numbered in order, leaving out the current one, which can't be picked
		const numbered = choices.filter(({ current, onPick }) => !current && onPick).slice(0, 9);
		const toggleNotManchu = () => { onCorrect(notManchu ? undefined : NOT_MANCHU); };
		onKey = (key) => {
			const number = Number(key);
			if (number >= 1 && number <= numbered.length) {
				numbered[number - 1].onPick?.();
				return true;
			}
			if (key === 't') {
				typeBox.current?.focus();
				return true;
			}
			if (key === 'n') {
				toggleNotManchu();
				return true;
			}
			return false;
		};
		content = (
			<>
				{header(read || '(nothing read)', box.confidence !== null
					? `The model's reading, ${percent(box.confidence)} confident` : undefined)}
				<div className={styles.dialogBody}>
					<div className={styles.crop}>
						<BoxCrop box={box} page={page} />
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
								{choices.map(({ key, ...choice }) => {
									const index = numbered.findIndex((one) => one.key === key);
									return (
										<Choice
											key={key}
											{...choice}
											shortcut={index >= 0 ? index + 1 : undefined}
										/>
									);
								})}
							</ul>
						</section>
						<TypeReading key={boxKey(box)} box={box} inputRef={typeBox} onCorrect={onCorrect} />
					</div>
				</div>
				<footer className={styles.dialogFooter}>
					<button type="button" aria-keyshortcuts="N" onClick={toggleNotManchu}>
						{notManchu ? 'It\'s Manchu after all' : 'Not Manchu'}
						<kbd className={styles.footerKey} aria-hidden="true">N</kbd>
					</button>
					<p className={styles.keys} aria-hidden="true">
						{numbered.length > 0 && <><kbd>{numbered.length > 1 ? `1–${numbered.length}` : '1'}</kbd> choose · </>}
						<kbd>T</kbd>
						{' type · '}
						<kbd>Esc</kbd>
						{' close'}
					</p>
					<button type="button" onClick={onClose}>Close</button>
				</footer>
			</>
		);
	}

	return (
		<dialog
			ref={dialog}
			className={styles.dialog}
			aria-labelledby={titleId}
			onKeyDown={(event) => {
				const { target } = event;
				if (event.ctrlKey || event.altKey || event.metaKey
					|| (target instanceof HTMLElement && target.closest('input, textarea'))) return;
				if (onKey?.(event.key.toLowerCase())) event.preventDefault();
			}}
			// Escape closes it through the box being taken away, as the buttons
			// do, so the dialog only closes one way
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			// If the browser closes it anyway (it may skip cancel for a second
			// Escape), that's dealt with here. Not the close that follows the box
			// being taken away, which has been, nor a late one that arrives after
			// the next box has opened it again.
			onClose={() => { if (box && !dialog.current?.open) onClose(); }}
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
function PageImage({
	page, statuses, suggests, corrections, boxId, linked, onLink, onOpen, editing,
}: Linking & {
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
	const size = useImageSize(page.image);
	const [romanization] = useRomanization();
	const svg = useRef<SVGSVGElement>(null);
	const scale = useImageScale(svg, size?.w);

	// Until the new page's size is known
	if (!size) {
		return <div className={styles.pagePlaceholder} />;
	}
	if (editing) {
		// Coloured as outside the editor, so the boxes read wrong stay marked
		const editStatuses = page.boxes.map((box, index): BoxStatus => (
			box['low-confidence'] ? 'lowConfidence' : statuses[index] ?? 'unchecked'));
		// Labelled as outside the editor: in the chosen romanization, with the
		// user's words
		const labels = page.boxes.map((box) => {
			const correction = corrections[boxKey(box)];
			return correction ? correctionReading(correction, romanization) : boxReading(box, romanization);
		});
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
		<ZoomFrame width={size.w}>
			{(zoomStyle) => (
			<svg
				ref={svg}
				className={styles.pageImage}
				style={zoomStyle}
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
						linked={linked === key}
						linkEvents={linkEvents(key, onLink)}
						onOpen={() => { onOpen(key); }}
					/>
				))}
			</svg>
			)}
		</ZoomFrame>
	);
}

// A line per column of the page's text, in Manchu or Abkai, with the user's
// corrections in place. Each word read from a box opens that box close up,
// as clicking the box does, and is marked as the box is: a ? if its closest
// dictionary words are worth a look, or a ✎ in teal if corrected.
function PageText({
	lines, suggests, corrected, script, boxId, linked, onLink, onOpen,
}: Linking & {
	lines: TextWord[][];
	boxId?: (index: number) => string;
	suggests: boolean[];
	// Whether each of the page's boxes was corrected
	corrected: boolean[];
	script: Script;
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
										corrected[box] && styles.correctedWord,
										linked === box && styles.linkedWord].filter(Boolean).join(' ')}
									{...linkEvents(box, onLink)}
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

// What the colours and marks on the page mean, for those it has: a swatch
// (a box's outline) or a badge, and what it stands for
function Legend({ compared, lowConfidence, other, flagged, corrected }: {
	// Whether there's text to compare the reading with
	compared: boolean;
	// Whether the page has any of each
	lowConfidence: boolean;
	other: boolean;
	flagged: boolean;
	corrected: boolean;
}) {
	const items: { mark: React.ReactNode; label: string }[] = [
		...(compared
			? [
				{ mark: <span className={`${styles.swatch} ${styles.swatchRight}`} />, label: 'Read right' },
				{ mark: <span className={`${styles.swatch} ${styles.swatchWrong}`} />, label: 'Read wrong' },
			]
			: [{ mark: <span className={`${styles.swatch} ${styles.swatchUnchecked}`} />, label: 'Manchu' }]),
		...(lowConfidence
			? [{ mark: <span className={`${styles.swatch} ${styles.swatchLow}`} />, label: 'Low confidence, left out of the text' }]
			: []),
		...(other ? [{ mark: <span className={`${styles.swatch} ${styles.swatchOther}`} />, label: 'Other text, such as Chinese' }] : []),
		...(flagged
			? [{ mark: <span className={styles.legendBadge}>?</span>, label: 'Possible misreading: see close dictionary words' }]
			: []),
		...(corrected
			? [{ mark: <span className={`${styles.legendBadge} ${styles.legendCorrected}`}>✎</span>, label: 'Your correction' }]
			: []),
	];
	return (
		<ul className={styles.legend} aria-label="Key">
			{items.map(({ mark, label }) => (
				<li key={label}>
					<span aria-hidden="true">{mark}</span>
					{label}
				</li>
			))}
		</ul>
	);
}

// A page read by POST /upload/multiple or GET /random?source=page: the page
// with its boxes drawn over it, its text in Manchu and Abkai, and how that
// compares with the Abkai expected (the user's, or a sample page's
// transcription)
export default function PageResult({
	page, expected = '', title = 'Page', id, onReread, corrections = {}, onCorrect,
	confirmed = {}, onConfirm, boxId, onBoxClosed,
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
	// Called when a box's close-up closes, ruled true if that's because the
	// user settled its reading: picked one, marked the model's right, or
	// marked it as not Manchu
	onBoxClosed?: (ruled: boolean) => void;
}) {
	const random = 'transcription' in page ? page : undefined;
	const [romanization] = useRomanization();
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
	// For the close-up's margin of the page round a box
	const pageSize = useImageSize(page.image);
	// ruled: whether the user made a ruling on the word, rather than just
	// closing it
	// The box linked with its words, for this page only
	const [linking, setLinking] = useState<{ page: ReadPage; index: number }>();
	const link: Linking = {
		linked: linking?.page === page ? linking.index : undefined,
		onLink: (index) => {
			setLinking((previous) => {
				if (index === undefined) return undefined;
				return previous?.page === page && previous.index === index ? previous : { page, index };
			});
		},
	};
	const closeBox = (ruled = false) => {
		setOpened(undefined);
		onBoxClosed?.(ruled);
	};

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
					{...link}
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
					{!editing && (
						<Legend
							compared={compared}
							lowConfidence={page.boxes.some((box) => box.kind === 'manchu' && box['low-confidence'])}
							other={page.boxes.some((box) => box.kind !== 'manchu')}
							flagged={flagged}
							corrected={corrected > 0}
						/>
					)}
					{!editing && `Read by ${page.model}. Click a box or a word to see it closer${onCorrect ? ' and correct it' : ''}.`}
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
							{...link}
						/>
					</section>
					<section>
						<h4>{ROMANIZATION_NAMES[romanization]}</h4>
						<PageText
							lines={textLines(page, corrections, romanization)}
							suggests={suggests}
							corrected={isCorrected}
							script={romanization}
							boxId={boxId}
							onOpen={openBox}
							{...link}
						/>
						<p className={styles.hint}>
							A line per column. □ is a box of other text, such as Chinese.
							Click a word to see its box closer.
							{corrected > 0 && ` With your ${corrected} ${corrected === 1 ? 'correction' : 'corrections'}, kept in this browser.`}
						</p>
					</section>
				</div>
			) : (
				<p>No Manchu was found on this page.</p>
			)}
			</div>
			<BoxDialog
				box={open !== undefined ? page.boxes[open] : undefined}
				page={{ image: page.image, size: pageSize }}
				flagged={open !== undefined && flaggedBox[open]}
				correction={open !== undefined ? corrections[boxKey(page.boxes[open])] : undefined}
				confirmed={open !== undefined && Boolean(confirmed[boxKey(page.boxes[open])])}
				onConfirm={(yes) => {
					if (open === undefined || !onConfirm) return;
					onConfirm(page.boxes[open], yes);
					if (yes) closeBox(true);
				}}
				onCorrect={(correction) => {
					if (open === undefined || !onCorrect) return;
					onCorrect(page.boxes[open], correction);
					// Going back to the model's reading leaves the word unsettled
					closeBox(correction !== undefined);
				}}
				onClose={() => { closeBox(); }}
			/>
			{expected && (
				<Comparison
					abkai={page.abkai}
					expected={expected}
					transcription={Boolean(random)}
					score={(random as Partial<SamplePage> | undefined)?.score}
					corrected={corrected > 0}
					inNorman={romanization === 'norman'}
				/>
			)}
		</section>
	);
}
