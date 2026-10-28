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

  const neighboringProbs = (index) => {
    var pre = probs[index];
    var post = probs[index];
    if (index > 0) pre = probs[index - 1];
    if (index < probs.length) post = probs[index + 1];
    return [pre, post];
  };
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
  const scaleProb = (index) => (probs[index] - .5) * 2;
  const blendIndices = (first, second) => {
	  const firstRGBA = [...indexToColor(first), scaleProb(first)];
	  const secondRGBA = [...indexToColor(second), scaleProb(second)];
	  const blend = firstRGBA.map((val, index) => (
		  (val + secondRGBA[index]) / 2));
	  return `rgba(${blend.join(', ')})`;
  };
  const gradientString = (index) => {
    const colorIndices = [index - 1, index, index + 1];
	if (index === 0) colorIndices[0] = index;
	if (index === probs.length - 1) colorIndices[2] = index;
	const colorStrings = [
		blendIndices(colorIndices[0], colorIndices[1]),
		blendIndices(colorIndices[1], colorIndices[1]),
		blendIndices(colorIndices[1], colorIndices[2]),
	];
    return `linear-gradient(to bottom, ${colorStrings.join(', ')})`;
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
		    <div className={styles.diagram}>
              <img src={preprocessed} className={styles.preprocessed} />
              <div className={styles.tokens}>
                {ctc.map((letter, index) => {
                  const prob = probs[index];
                  const [pre, post] = neighboringProbs(index);
                  const classKey = hovered === index ? 'tokenProbHovered'
					  : 'tokenProb';
                  const style = {
                    backgroundImage: gradientString(index),
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
			<figcaption>
			  <span className={styles.figCapLabel}>CTC Output</span>
			  <ul>
				<HoveredDetail hovered={hovered} ctc={ctc} probs={probs} />
			    <li>Colored bands are letters.</li>
			    <li>Grey bands are blanks.</li>
				<li>Darker color means more confident.</li>
			  </ul>
			</figcaption>
		  </figure>
        </div>
        <div className={styles.results}>
          <p className={styles.manchu}>{manchu}</p>
          <p className={styles.abkai}>{abkai}</p>
          <ScoreCard score={score} />
        </div>
      </div>
    </section>
  );
}
