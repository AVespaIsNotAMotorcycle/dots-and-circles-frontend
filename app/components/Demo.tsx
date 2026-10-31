'use client'

import axios from 'axios';
import { useState, useEffect } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import PredictionCard from './PredictionCard';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

export default function Demo({ backendAwake = false }) {
	const [lexigraph, setLexigraph] = useState();
	const [label, setLabel] = useState();
	const [labelManchu, setLabelManchu] = useState();
	const [results, setResults] = useState([]);
	const [preprocessed, setPreprocessed] = useState();
	const [loading, setLoading] = useState(false);
	const [hovered, setHovered] = useState();
	// Where the mouse and keyboard focus are, each true while inside a card's
	// CTC or prediction. The full detail shows while either is.
	const [inside, setInside] = useState({ mouse: false, focus: false });
	// A click pins the detail on, and the clicked token, until the same token
	// (or the card outside any token) is clicked again
	const [pinned, setPinned] = useState(false);
	// The toggle keeps the full detail on all the time
	const [alwaysDetailed, setAlwaysDetailed] = useState(false);
	const detailed = alwaysDetailed || inside.mouse || inside.focus || pinned;
	const onInside = (kind, isInside) => {
		setInside((previous) => ({ ...previous, [kind]: isInside }));
		if (!isInside && !pinned) setHovered(undefined);
	};
	const onHover = (index) => {
		if (!pinned) setHovered(index);
	};
	const onSelect = (index) => {
		if (pinned && (index === undefined || index === hovered)) {
			setPinned(false);
			return;
		}
		setPinned(true);
		if (index !== undefined) setHovered(index);
	};

	const load = (event) => {
		if (event) event.preventDefault();
		setLoading(true);
		axios.get(`${BACKEND}/random`)
			.then(({ data }) => {
				setLexigraph(data.image);
				setLabel(data.label);
				setLabelManchu(data.manchu);
				setResults(data.results);
				setPreprocessed(data['preprocessed-image']);
				setHovered(undefined);
				setPinned(false);
				setLoading(false);
			});
	};

	useEffect(() => {
		if (!backendAwake) return;
		load();
	}, [backendAwake]);

	return (
		<section className={styles.demo}>
			<h2>Demo</h2>
			<form
				className={styles.form}
					disabled={!backendAwake}
					onClick={load}
			>
				<button>
					Load Random Word
				</button>
				<LoadingCard
					loading={loading || !backendAwake}
					message={backendAwake ? 'loadingPredictions' : 'wakingServer'}
				/>
			</form>
			<section className={styles.lexigraph}>
				<h3>Lexigraph</h3>
				<figure>
					<img src={lexigraph} />
					<figcaption>{label}</figcaption>
				</figure>
				<ul className={styles.shortResults}>
				  {results.map((result) => (
				    <li key={result.name} className={styles.shortResult}>
						<span>{result.name}</span>
						<span
						  className={result.score === 1 ? styles.true
							  : styles.false}
						>
						  {result.score === 1 ? '✓' : '𐄂'}
						</span>
					</li>
				  ))}
				</ul>
			</section>
			<section>
				<h3>Model Predictions</h3>
				<section className={styles.ctcLegend}>
				  <h4>CTC output legend: </h4>
				  <span>Colored bands are letters, </span>
				  <span>grey bands are blanks, </span>
				  <span>darker color means more confident. </span>
				  <span>In predictions, red letters are wrong, </span>
				  <span>letters with a wavy line are extra, </span>
				  <span>faint letters are missing.</span>
				  <label className={styles.detailToggle}>
					<input
					  type="checkbox"
					  checked={alwaysDetailed}
					  onChange={(event) => { setAlwaysDetailed(event.target.checked); }}
					/>
					Always show letter colors
				  </label>
				</section>
				<div className={styles.predictionCards}>
					{results.map((result) => (
						<PredictionCard
							key={result.model}
							name={result.name}
							model={result.model}
							abkai={result['prediction-abkai']}
							manchu={result['prediction-manchu']}
							truth={labelManchu}
							ctc={result.ctc}
							probs={result.probs}
							score={result.score}
							preprocessed={preprocessed}
							hovered={hovered}
							onHover={onHover}
							onSelect={onSelect}
							onMove={setHovered}
							detailed={detailed}
							onInside={onInside}
						/>
					))}
				</div>
			</section>
		</section>
	);
}
