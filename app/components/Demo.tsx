'use client'

import axios from 'axios';
import { useState } from 'react';

import styles from './demo.module.css';
import PredictionCard from './PredictionCard';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

export default function Demo({ backendAwake = false }) {
	const [lexigraph, setLexigraph] = useState();
	const [label, setLabel] = useState();
	const [results, setResults] = useState([]);
	const [preprocessed, setPreprocessed] = useState();

	const load = (event) => {
		event.preventDefault();
		axios.get(`${BACKEND}/random`)
			.then(({ data }) => {
				setLexigraph(data.image);
				setLabel(data.label);
				setResults(data.results);
				setPreprocessed(data['preprocessed-image']);
			});
	};

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
				<div className={styles.predictionCards}>
					{results.map((result) => (
						<PredictionCard
							key={result.model}
							name={result.name}
							model={result.model}
							abkai={result['prediction-abkai']}
							manchu={result['prediction-manchu']}
							ctc={result.ctc}
							probs={result.probs}
							score={result.score}
							preprocessed={preprocessed}
						/>
					))}
				</div>
			</section>
		</section>
	);
}
