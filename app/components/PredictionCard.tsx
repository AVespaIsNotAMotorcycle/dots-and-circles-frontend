'use client'

import ScoreCard from './ScoreCard';
import {
	tokenToLetterIndex, letterColor, abkaiLetter, abkaiLetters, diffLetters,
	QUIET_COLOR, BLANK_COLOR,
} from './ctc';
import type { DiffLetter } from './ctc';
import type { Ctc } from './types';
import type { InsideKind } from './useTokenHighlight';
import styles from './predictioncard.module.css';

function HoveredDetail({ hovered, ctc, probs }: {
	hovered: number | undefined;
	ctc: Ctc;
	probs: number[];
}) {
	const formatProb = (prob: number) => prob
		.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	if (hovered === undefined || probs[hovered] === undefined) {
		return <li className={styles.hoveredDetail} />;
	}
	return (
		<li className={styles.hoveredDetail}>
			<span>{ctc[hovered] || 'blank'}</span>
			<span>{formatProb(probs[hovered])}</span>
		</li>
	);
}

// One letter of a predicted word: tinted with its tokens' color in the
// detailed view, and marked if it's wrong, extra or missing compared to the
// true word
type LetterProps = {
	highlightedIndex: number;
	detailed: boolean;
};

function PredictedLetter({ entry, text, highlightedIndex, detailed }:
	LetterProps & { entry: DiffLetter; text: string }) {
	const { index, status } = entry;
	const classNames = [styles[status]];
	if (index >= 0 && index === highlightedIndex) {
		classNames.push(styles.highlightedLetter);
	}
	return (
		<span
			className={classNames.join(' ')}
			style={detailed && index >= 0 ? {
				backgroundColor: `rgba(${letterColor(index).join(', ')}, .35)`,
			} : undefined}>
			{text}
		</span>
	);
}

function ManchuPrediction({ letters, highlightedIndex, detailed }:
	LetterProps & { letters: DiffLetter[] }) {
	return (
		<p className={styles.manchu}>
			{letters.map((entry, key) => (
				<PredictedLetter
					key={key}
					entry={entry}
					text={entry.letter}
					highlightedIndex={highlightedIndex}
					detailed={detailed}
				/>
			))}
		</p>
	);
}
function AbkaiPrediction({
	abkai, manchu, letters, highlightedIndex, detailed,
}: LetterProps & { abkai: string; manchu: string; letters: DiffLetter[] }) {
	// Spell each Manchu letter separately, so a highlight covers the whole
	// spelling of a letter (both n and g for ᠩ). If the table disagrees with
	// the server's spelling, show the server's as plain text.
	if (abkaiLetters(manchu).join('') !== abkai) {
		return <p className={styles.abkai}>{abkai}</p>;
	}
	return (
		<p className={styles.abkai}>
			{letters.map((entry, key) => abkaiLetter(entry.letter) && (
				<PredictedLetter
					key={key}
					entry={entry}
					text={abkaiLetter(entry.letter)}
					highlightedIndex={highlightedIndex}
					detailed={detailed}
				/>
			))}
		</p>
	);
}

// One column of the CTC collapse, with a cell lined up with each image token.
// cellText(index) gives the cell's letter, '·' for a blank, or '' for none.
function CollapseColumn({
	label, ctc, cellText, hovered, onHover, onSelect, detailed,
}: {
	label: string;
	ctc: Ctc;
	cellText: (index: number) => string;
	hovered: number | undefined;
	onHover: (index: number) => void;
	onSelect: (index?: number) => void;
	detailed: boolean;
}) {
	return (
		<div className={styles.collapseColumn}>
			<span className={styles.collapseLabel}>{label}</span>
			{ctc.map((_, index) => {
				const text = cellText(index);
				const isLetter = text && text !== '·';
				const color = letterColor(tokenToLetterIndex(ctc, index));
				return (
					<span
						key={index}
						className={hovered === index ? styles.collapseCellHovered
							: styles.collapseCell}
						style={detailed && isLetter ? {
							backgroundColor: `rgba(${color.join(', ')}, .35)`,
						} : undefined}
						onMouseOver={() => { onHover(index); }}
						onClick={(event) => {
							event.stopPropagation();
							onSelect(index);
						}}
					>
						{text}
					</span>
				);
			})}
		</div>
	);
}

export default function PredictionCard({
	name = "NAME MISSING",
	model = "MODEL DETAILS MISSING",
	abkai = "ABKAI MISSING",
	manchu = "MANCHU MISSING",
	truth = undefined,
	ctc = [],
	probs = [],
	score = 0,
	preprocessed = undefined,
	// The hovered token is shared by every card, so the same image row lights
	// up in all models at once
	hovered = undefined,
	onHover = () => {},
	// Clicks pin the detail on: onSelect(index) for a token, onSelect() for
	// anywhere else in the card. onMove sets the token even while pinned, for
	// the arrow keys.
	onSelect = () => {},
	onMove = () => {},
	// Letter colors show only in the detailed view; otherwise all letter
	// tokens share one color. onInside reports the mouse or keyboard focus
	// entering or leaving the card's CTC and prediction.
	detailed = true,
	onInside = () => {},
}: {
	name?: string;
	model?: string;
	abkai?: string;
	manchu?: string;
	// The true word in Manchu script, if it's known
	truth?: string | null;
	ctc?: Ctc;
	probs?: number[];
	score?: number | null;
	// The preprocessed image, as a URL
	preprocessed?: string;
	hovered?: number;
	onHover?: (index: number) => void;
	onSelect?: (index?: number) => void;
	onMove?: (index: number) => void;
	detailed?: boolean;
	onInside?: (kind: InsideKind, inside: boolean) => void;
}) {
	const indexToColor = (index: number) => {
		if (!ctc[index]) return BLANK_COLOR;
		if (!detailed) return QUIET_COLOR;
		return letterColor(tokenToLetterIndex(ctc, index));
	};
	// Opacity from confidence. A floor keeps low-confidence tokens visible,
	// since those are the most interesting ones.
	const scaleProb = (index: number) => 0.15 + 0.85 * probs[index];
	const tokenColor = (index: number) => (
		`rgba(${[...indexToColor(index), scaleProb(index)].join(', ')})`);
	// The predicted letters, compared to the true word when there is one
	const letters: DiffLetter[] = truth ? diffLetters(manchu, truth)
		: manchu.split('').map((letter, index) => ({ letter, index, status: 'ok' as const }));

	// The three steps of CTC decoding, one cell per token
	const startsRun = (index: number) => index === 0 || ctc[index] !== ctc[index - 1];
	// Cells are spelled in Abkai, since Manchu letters are unreadable at one
	// token's height. Invisible marks (variation selectors) show as ◌.
	const rawCell = (index: number) => (ctc[index]
		? abkaiLetter(ctc[index]) || '◌' : '·');
	const mergedCell = (index: number) => (startsRun(index) ? rawCell(index) : '');
	const wordCell = (index: number) => (startsRun(index) && ctc[index]
		? rawCell(index) : '');
	// Arrow keys step through the tokens, for keyboard users
	const onKeyDown = (event: React.KeyboardEvent) => {
		const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
		if (!(event.key in steps)) return;
		event.preventDefault();
		const next = (hovered ?? -1) + steps[event.key];
		onMove(Math.min(Math.max(next, 0), ctc.length - 1));
	};

	return (
		<section className={styles.card}>
			<details>
				<summary>
					<h4>{name}</h4>
				</summary>
				<p className="model">{model}</p>
			</details>
			<div
				className={styles.cardBody}
				onMouseEnter={() => { onInside('mouse', true); }}
				onMouseLeave={() => { onInside('mouse', false); }}
				// Only keyboard focus counts: a click also focuses the token strip, and
				// shouldn't keep the detail on after the mouse leaves
				onFocus={(event) => {
					if (event.target.matches(':focus-visible')) onInside('focus', true);
				}}
				onBlur={() => { onInside('focus', false); }}
				onClick={() => { onSelect(); }}
			>
				<div className={styles.ctc}>
					<figure>
						<figcaption>
							<span className={styles.figCapLabel}>CTC Output</span>
						</figcaption>
					<div className={styles.collapse}>
						<div className={styles.collapseColumn}>
							<span className={styles.collapseLabel}>image</span>
						<div
							className={styles.diagram}
							tabIndex={0}
							aria-label="CTC tokens: use the up and down arrow keys to step through them"
							onFocus={() => { if (hovered === undefined) onMove(0); }}
							onKeyDown={onKeyDown}
						>
							<img src={preprocessed} className={styles.preprocessed} />
							<div className={styles.tokens}>
								{ctc.map((letter, index) => {
									const classKey = hovered === index ? 'tokenProbHovered'
											: 'tokenProb';
									const style = {
										backgroundColor: tokenColor(index),
									};
									return (
											<div
												key={index}
												className={styles[classKey]}
												style={style}
												onMouseOver={() => { onHover(index); }}
												onClick={(event) => {
													event.stopPropagation();
													onSelect(index);
												}}
											/>
									);
								})}
							</div>
						</div>
						</div>
						<CollapseColumn label="tokens" ctc={ctc} cellText={rawCell}
							hovered={hovered} onHover={onHover} onSelect={onSelect}
							detailed={detailed} />
						<CollapseColumn label="merged" ctc={ctc} cellText={mergedCell}
							hovered={hovered} onHover={onHover} onSelect={onSelect}
							detailed={detailed} />
						<CollapseColumn label="word" ctc={ctc} cellText={wordCell}
							hovered={hovered} onHover={onHover} onSelect={onSelect}
							detailed={detailed} />
					</div>
						<HoveredDetail hovered={hovered} ctc={ctc} probs={probs} />
					</figure>
				</div>
				<div className={styles.results}>
					<span className={styles.figCapLabel}>Model Prediction</span>
					<ManchuPrediction
						letters={letters}
						highlightedIndex={tokenToLetterIndex(ctc, hovered)}
						detailed={detailed}
					/>
					<AbkaiPrediction
						abkai={abkai}
						manchu={manchu}
						letters={letters}
						highlightedIndex={tokenToLetterIndex(ctc, hovered)}
						detailed={detailed}
					/>
					<ScoreCard score={score} />
				</div>
			</div>
		</section>
	);
}
