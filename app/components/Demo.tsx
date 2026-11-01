'use client'

import axios from 'axios';
import { useState, useEffect } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import PredictionCard from './PredictionCard';
import RandomWordForm from './RandomWordForm';
import UploadForm from './UploadForm';
import useTokenHighlight from './useTokenHighlight';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

export default function Demo({ backendAwake = false }) {
	const [lexigraph, setLexigraph] = useState();
	const [label, setLabel] = useState();
	const [labelManchu, setLabelManchu] = useState();
	const [results, setResults] = useState([]);
	const [preprocessed, setPreprocessed] = useState();
	// The font a synthetic word was rendered in
	const [font, setFont] = useState();
	// false, or the LoadingCard message to show
	const [loading, setLoading] = useState(false);
	// Which form shows: 'random' or 'upload'
	const [mode, setMode] = useState('random');
	// { mode, message }: shown only under the mode it came from
	const [error, setError] = useState();
	const highlight = useTokenHighlight();

	const show = (data) => {
		setLexigraph(data.image);
		setLabel(data.label);
		setLabelManchu(data.manchu);
		setResults(data.results);
		setPreprocessed(data['preprocessed-image']);
		setFont(data.font);
		highlight.reset();
	};
	// The server's {"error": ...} message, or a fallback
	const showError = (errorMode, error, fallback) => {
		setError({
			mode: errorMode,
			message: error.response?.data?.error ?? fallback,
		});
	};

	const load = (source = 'photo') => {
		setLoading('loadingPredictions');
		setError(undefined);
		axios.get(`${BACKEND}/random`, { params: { source } })
			.then(({ data }) => { show(data); })
			.catch((error) => { showError('random', error, 'Couldn\'t load a word.'); })
			.finally(() => { setLoading(false); });
	};

	const read = (file, label) => {
		const body = new FormData();
		body.append('image', file);
		if (label) body.append('label', label);
		setLoading('readingUpload');
		setError(undefined);
		axios.post(`${BACKEND}/upload/single`, body)
			.then(({ data }) => { show(data); })
			.catch((error) => { showError('upload', error, 'Couldn\'t read the image.'); })
			.finally(() => { setLoading(false); });
	};

	useEffect(() => {
		if (!backendAwake) return;
		load();
	}, [backendAwake]);

	const busy = !backendAwake || Boolean(loading);

	return (
		<section className={styles.demo}>
			<h2>Demo</h2>
			<div className={styles.form}>
				<div className={styles.modes} role="group" aria-label="Word to read">
					{[['random', 'Random word'], ['upload', 'Your image']].map(
						([value, text]) => (
							<button
								key={value}
								type="button"
								aria-pressed={mode === value}
								className={mode === value ? styles.selectedMode : undefined}
								onClick={() => { setMode(value); }}
							>
								{text}
							</button>
						))}
				</div>
				{/* Hidden rather than removed, so a picked file survives a switch */}
				<RandomWordForm
					hidden={mode !== 'random'}
					disabled={busy}
					onLoad={load}
				/>
				<UploadForm
					hidden={mode !== 'upload'}
					disabled={busy}
					onRead={read}
					onError={(message) => {
						setError(message && { mode: 'upload', message });
					}}
				/>
				<LoadingCard
					loading={Boolean(loading) || !backendAwake}
					message={backendAwake ? loading : 'wakingServer'}
				/>
				{error?.mode === mode && (
					<p className={styles.error} role="alert">{error.message}</p>
				)}
			</div>
			<section className={styles.lexigraph}>
				<h3>Lexigraph</h3>
				<figure>
					<img src={lexigraph} />
					<figcaption>{label}</figcaption>
					{font && <p className={styles.font}>Rendered in {font}</p>}
				</figure>
				{label && <ul className={styles.shortResults}>
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
				</ul>}
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
					  checked={highlight.alwaysDetailed}
					  onChange={(event) => {
						highlight.setAlwaysDetailed(event.target.checked);
					  }}
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
							hovered={highlight.hovered}
							onHover={highlight.onHover}
							onSelect={highlight.onSelect}
							onMove={highlight.onMove}
							detailed={highlight.detailed}
							onInside={highlight.onInside}
						/>
					))}
				</div>
			</section>
		</section>
	);
}
