'use client'

import axios from 'axios';

import ScoreCard from './ScoreCard';
import {
  tokenToLetterIndex, letterColor, abkaiLetter, abkaiLetters, diffLetters,
} from './ctc';
import styles from './predictioncard.module.css';
const BACKEND = process.env.NEXT_PUBLIC_BACKEND

function HoveredDetail({ hovered, ctc, probs }) {
	const formatProb = (prob) => prob
      .toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
	const fallback = <li className={styles.hoveredDetail} />;
	if (hovered === undefined) return fallback;
	if (hovered >= probs.length) return fallback;
	if (probs[hovered] === undefined) return fallback;
	try {
	  return (
		<li className={styles.hoveredDetail}>
		  <span>{ctc[hovered] || 'blank'}</span>
		  <span>{formatProb(probs[hovered])}</span>
		</li>
	  );
	} catch (error) {
	  console.error(error);
	  return fallback;
	}
}

// One letter of a predicted word: tinted with its tokens' color, and marked
// if it's wrong, extra or missing compared to the true word
function PredictedLetter({ entry, text, highlightedIndex }) {
  const { index, status } = entry;
  const classNames = [styles[status]];
  if (index >= 0 && index === highlightedIndex) {
	classNames.push(styles.highlightedLetter);
  }
  return (
	<span
	  className={classNames.join(' ')}
	  style={index >= 0 ? {
		backgroundColor: `rgba(${letterColor(index).join(', ')}, .35)`,
	  } : undefined}>
	  {text}
	</span>
  );
}

function ManchuPrediction({ letters, highlightedIndex }) {
  return (
	<p className={styles.manchu}>
	  {letters.map((entry, key) => (
		<PredictedLetter
		  key={key}
		  entry={entry}
		  text={entry.letter}
		  highlightedIndex={highlightedIndex}
		/>
	  ))}
	</p>
  );
}
function AbkaiPrediction({ abkai, manchu, letters, highlightedIndex }) {
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
		/>
	  ))}
	</p>
  );
}

// One column of the CTC collapse, with a cell lined up with each image token.
// cellText(index) gives the cell's letter, '·' for a blank, or '' for none.
function CollapseColumn({ label, ctc, cellText, hovered, onHover }) {
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
			style={isLetter ? {
			  backgroundColor: `rgba(${color.join(', ')}, .35)`,
			} : undefined}
			onMouseOver={() => { onHover(index); }}
			onClick={() => { onHover(index); }}
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
  preprocessed = null,
  // The hovered token is shared by every card, so the same image row lights
  // up in all models at once
  hovered = undefined,
  onHover = (index) => {},
}) {
  const scoreColorBrackets = [
    [1, 'green'],
    [0.9, 'yellow'],
    [0.7, 'orange'],
    [0, 'red'],
  ];
  const scorePercentString = score
    .toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
  const scoreColor = scoreColorBrackets.find(([threshold, color]) => {
    if (score >= threshold) return true;
    return false;
  })[1];

  const indexToColor = (index) => letterColor(tokenToLetterIndex(ctc, index));
  // Opacity from confidence. A floor keeps low-confidence tokens visible,
  // since those are the most interesting ones.
  const scaleProb = (index) => 0.15 + 0.85 * probs[index];
  const tokenColor = (index) => (
	`rgba(${[...indexToColor(index), scaleProb(index)].join(', ')})`);
  // The predicted letters, compared to the true word when there is one
  const letters = truth ? diffLetters(manchu, truth)
	: manchu.split('').map((letter, index) => ({ letter, index, status: 'ok' }));

  // The three steps of CTC decoding, one cell per token
  const startsRun = (index) => index === 0 || ctc[index] !== ctc[index - 1];
  // Cells are spelled in Abkai, since Manchu letters are unreadable at one
  // token's height. Invisible marks (variation selectors) show as ◌.
  const rawCell = (index) => (ctc[index]
	? abkaiLetter(ctc[index]) || '◌' : '·');
  const mergedCell = (index) => (startsRun(index) ? rawCell(index) : '');
  const wordCell = (index) => (startsRun(index) && ctc[index]
	? rawCell(index) : '');
  // Arrow keys step through the tokens, for keyboard users
  const onKeyDown = (event) => {
	const steps = { ArrowDown: 1, ArrowUp: -1 };
	if (!(event.key in steps)) return;
	event.preventDefault();
	const next = (hovered ?? -1) + steps[event.key];
	onHover(Math.min(Math.max(next, 0), ctc.length - 1));
  };

  return (
    <section className={styles.card}>
      <details>
        <summary>
          <h4>{name}</h4>
        </summary>
        <p className="model">{model}</p>
      </details>
      <div className={styles.cardBody}>
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
			  onFocus={() => { if (hovered === undefined) onHover(0); }}
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
						onClick={() => { onHover(index); }}
					  />
				  );
                })}
              </div>
			</div>
			</div>
			<CollapseColumn label="tokens" ctc={ctc} cellText={rawCell}
			  hovered={hovered} onHover={onHover} />
			<CollapseColumn label="merged" ctc={ctc} cellText={mergedCell}
			  hovered={hovered} onHover={onHover} />
			<CollapseColumn label="word" ctc={ctc} cellText={wordCell}
			  hovered={hovered} onHover={onHover} />
		  </div>
			<HoveredDetail hovered={hovered} ctc={ctc} probs={probs} />
		  </figure>
        </div>
        <div className={styles.results}>
		  <span className={styles.figCapLabel}>Model Prediction</span>
		  <ManchuPrediction
		    letters={letters}
			highlightedIndex={tokenToLetterIndex(ctc, hovered)}
		  />
		  <AbkaiPrediction
		    abkai={abkai}
		    manchu={manchu}
		    letters={letters}
			highlightedIndex={tokenToLetterIndex(ctc, hovered)}
		  />
          <ScoreCard score={score} />
        </div>
      </div>
    </section>
  );
}
