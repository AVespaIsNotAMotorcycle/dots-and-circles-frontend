'use client'

import axios from 'axios';
import { useState, useEffect } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import PredictionCard from './PredictionCard';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

// Words are written top to bottom, and the models read them at 32 pixels wide
// and squash anything over 256 tall, so taller than 1:8 is refused
const MAX_HEIGHT_PER_WIDTH = 8;

// Resolves to why an image file can't be uploaded, or undefined if it can.
// The browser applies EXIF orientation as the server does, so the
// dimensions match what the server sees.
function checkImage(file) {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			const { naturalWidth: width, naturalHeight: height } = image;
			if (height > width * MAX_HEIGHT_PER_WIDTH) {
				resolve(`The image is ${width}×${height}, taller than 1:${MAX_HEIGHT_PER_WIDTH}. Crop it closer to the word.`);
			} else {
				resolve(undefined);
			}
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve('That file isn\'t an image that can be read.');
		};
		image.src = url;
	});
}

export default function Demo({ backendAwake = false }) {
	const [lexigraph, setLexigraph] = useState();
	const [label, setLabel] = useState();
	const [labelManchu, setLabelManchu] = useState();
	const [results, setResults] = useState([]);
	const [preprocessed, setPreprocessed] = useState();
	// The font a synthetic word was rendered in
	const [font, setFont] = useState();
	// Where random words come from: 'photo' or 'synthetic'
	const [source, setSource] = useState('photo');
	// false, or the LoadingCard message to show
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState();
	// The user's image once it passes checkImage, and its optional label
	const [upload, setUpload] = useState();
	const [uploadLabel, setUploadLabel] = useState('');
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

	const show = (data) => {
		setLexigraph(data.image);
		setLabel(data.label);
		setLabelManchu(data.manchu);
		setResults(data.results);
		setPreprocessed(data['preprocessed-image']);
		setFont(data.font);
		setHovered(undefined);
		setPinned(false);
	};
	// The server's {"error": ...} message, or a fallback
	const showError = (error, fallback) => {
		setError(error.response?.data?.error ?? fallback);
	};

	const load = () => {
		setLoading('loadingPredictions');
		setError(undefined);
		axios.get(`${BACKEND}/random`, { params: { source } })
			.then(({ data }) => { show(data); })
			.catch((error) => { showError(error, 'Couldn\'t load a word.'); })
			.finally(() => { setLoading(false); });
	};

	const onPickFile = async (event) => {
		const file = event.target.files[0];
		setUpload(undefined);
		setError(undefined);
		if (!file) return;
		const problem = await checkImage(file);
		if (problem) {
			setError(problem);
			return;
		}
		setUpload(file);
	};

	const read = (event) => {
		event.preventDefault();
		if (!upload) return;
		const body = new FormData();
		body.append('image', upload);
		if (uploadLabel.trim()) body.append('label', uploadLabel.trim());
		setLoading('readingUpload');
		setError(undefined);
		axios.post(`${BACKEND}/upload/single`, body)
			.then(({ data }) => { show(data); })
			.catch((error) => { showError(error, 'Couldn\'t read the image.'); })
			.finally(() => { setLoading(false); });
	};

	useEffect(() => {
		if (!backendAwake) return;
		load();
	}, [backendAwake]);

	return (
		<section className={styles.demo}>
			<h2>Demo</h2>
			<div className={styles.form}>
				<label className={styles.source}>
					Random words from
					<select
						value={source}
						onChange={(event) => { setSource(event.target.value); }}
					>
						<option value="photo">Real photos</option>
						<option value="synthetic">Synthetic renders</option>
					</select>
				</label>
				<button
					type="button"
					disabled={!backendAwake || Boolean(loading)}
					onClick={load}
				>
					Load Random Word
				</button>
				<span className={styles.or}>or</span>
				<form className={styles.upload} onSubmit={read}>
					<label>
						Your image of one word, written top to bottom
						<input
							type="file"
							accept="image/*"
							onChange={onPickFile}
						/>
					</label>
					<label>
						What it says, in Abkai (optional)
						<input
							type="text"
							value={uploadLabel}
							placeholder="abka"
							onChange={(event) => { setUploadLabel(event.target.value); }}
						/>
					</label>
					<button
						type="submit"
						disabled={!backendAwake || Boolean(loading) || !upload}
					>
						Read My Image
					</button>
				</form>
				<LoadingCard
					loading={Boolean(loading) || !backendAwake}
					message={backendAwake ? loading : 'wakingServer'}
				/>
				{error && <p className={styles.error} role="alert">{error}</p>}
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
