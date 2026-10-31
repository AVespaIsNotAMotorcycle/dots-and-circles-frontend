'use client'

import axios from 'axios';
import { useState, useEffect } from 'react';

import ScoreCard from './ScoreCard';
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

function ManchuPrediction({ manchu, highlightedIndex }) {
  return (
	<p className={styles.manchu}>
	  {manchu.split('').map((letter, index) => (
		<span
		  key={index}
		  className={index == highlightedIndex ?
			styles.highlightedLetter : undefined}>
		  {letter}
		</span>
	  ))}
	</p>
  );
}
function AbkaiPrediction({ abkai, highlightedIndex }) {
  return (
	<p className={styles.abkai}>
	  {abkai.split('').map((letter, index) => (
		<span
		  key={index}
		  className={index == highlightedIndex ?
			styles.highlightedLetter : undefined}>
		  {letter}
		</span>
	  ))}
	</p>
  );
}

export default function PredictionCard({
  name = "NAME MISSING",
  model = "MODEL DETAILS MISSING",
  abkai = "ABKAI MISSING",
  manchu = "MANCHU MISSING",
  ctc = [],
  probs = [],
  score = 0,
  preprocessed = null,
}) {
  const [hovered, setHovered] = useState();
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

  const indexToColor = (index) => {
	const colors = [[25,25,112],
					[255,69,0],
					[255,215,0],
					[0,255,127],
					[0,191,255],
					[0,0,255],
					[255,20,147],
	];
	const isBlank = !ctc[index];
	if (isBlank) return [128, 128, 128];
	const lettersArray = manchu.split('').reduce((accumulator, letter) => {
		if (accumulator.includes(letter)) return accumulator;
		return [...accumulator, letter];
	}, []);
	var indexInWord = lettersArray.findIndex((letter) => letter == ctc[index]);
	if (indexInWord >= colors.length) indexInWord = 0;
	return colors[indexInWord];
  };
  // Opacity from confidence. A floor keeps low-confidence tokens visible,
  // since those are the most interesting ones.
  const scaleProb = (index) => 0.15 + 0.85 * probs[index];
  const tokenColor = (index) => (
	`rgba(${[...indexToColor(index), scaleProb(index)].join(', ')})`);
  const tokenToLetterIndex = (tokenIndex) => {
    // CTC decoding collapses runs of the same token and drops blanks, so each
    // new run of a non-blank token adds one letter to `manchu`. Blank tokens
    // don't map to any letter and return -1.
	if (!ctc[tokenIndex]) return -1;
	var letterIndex = -1;
	for (var i = 0; i <= tokenIndex; i++) {
		const startsNewLetter = ctc[i] && ctc[i] !== ctc[i - 1];
		if (startsNewLetter) letterIndex++;
	}
	return letterIndex;
  };
  const onMouseOver = (index) => {
	  setHovered(index);
  };
  useEffect(() => {
	  setHovered(undefined);
  }, [preprocessed])

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
		    <div className={styles.diagram}>
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
						onMouseOver={() => { onMouseOver(index); }}
					  />
				  );
                })}
              </div>
			</div>
			<HoveredDetail hovered={hovered} ctc={ctc} probs={probs} />
		  </figure>
        </div>
        <div className={styles.results}>
		  <span className={styles.figCapLabel}>Model Prediction</span>
		  <ManchuPrediction
		    manchu={manchu}
			highlightedIndex={tokenToLetterIndex(hovered)}
		  />
		  <AbkaiPrediction
		    abkai={abkai}
			highlightedIndex={tokenToLetterIndex(hovered)}
		  />
          <ScoreCard score={score} />
        </div>
      </div>
    </section>
  );
}
