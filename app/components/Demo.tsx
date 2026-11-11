'use client'

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { useState, useEffect } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import PageResult from './PageResult';
import type { LoadingMessage } from './LoadingCard';
import PredictionCard from './PredictionCard';
import RandomWordForm from './RandomWordForm';
import { ROMANIZATION_NAMES, romanize } from './romanization';
import type { Romanization } from './romanization';
import Switch from './Switch';
import UploadForm from './UploadForm';
import useTokenHighlight from './useTokenHighlight';
import type { ErrorResponse, Page, Source, Word } from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

// Which form shows
type Mode = 'random' | 'upload' | 'page';
const MODES: [Mode, string][] = [
	['random', 'Random word'],
	['upload', 'Your image'],
	['page', 'Your page'],
];
const ROMANIZATIONS = Object.entries(ROMANIZATION_NAMES) as
	[Romanization, string][];

export default function Demo({ backendAwake = false }: {
	backendAwake?: boolean;
}) {
	// The word on show: the backend's /random or /upload/single response
	const [word, setWord] = useState<Word>();
	const results = word?.results ?? [];
	// The page on show: the backend's /upload/multiple response, and the
	// Abkai the user expected it to say ('' if they didn't say)
	const [page, setPage] = useState<{ result: Page; expected: string }>();
	// false, or the LoadingCard message to show
	const [loading, setLoading] = useState<LoadingMessage | false>(false);
	const [mode, setMode] = useState<Mode>('random');
	// { mode, message }: shown only under the mode it came from
	const [error, setError] = useState<{ mode: Mode; message: string }>();
	// How words are spelled in Latin letters
	const [romanization, setRomanization] = useState<Romanization>('abkai');
	const highlight = useTokenHighlight();
	// The true word, if known. The server's label is already Abkai.
	const caption = romanization === 'abkai' ? word?.label
		: word?.manchu && romanize(word.manchu, romanization);

	// Runs a backend request for a new word: shows loadingMessage meanwhile,
	// then the word (or page), or the server's {"error": ...} (or fallback) under
	// errorMode's form
	// and hands the response to onData
	const request = <T,>(
		errorMode: Mode,
		loadingMessage: LoadingMessage,
		send: () => Promise<AxiosResponse<T>>,
		fallback: string,
		onData: (data: T) => void = (data) => {
			setWord(data as Word);
			highlight.reset();
		},
	) => {
		setLoading(loadingMessage);
		setError(undefined);
		send()
			.then(({ data }) => { onData(data); })
			.catch((error) => {
				setError({
					mode: errorMode,
					message: (axios.isAxiosError<ErrorResponse>(error)
						&& error.response?.data?.error) || fallback,
				});
			})
			.finally(() => { setLoading(false); });
	};

	const load = (source: Source = 'photo') => {
		request('random', 'loadingPredictions',
			() => axios.get<Word>(`${BACKEND}/random`, { params: { source } }),
			'Couldn\'t load a word.');
	};

	const read = (file: File, label: string) => {
		const body = new FormData();
		body.append('image', file);
		if (label) body.append('label', label);
		request('upload', 'readingUpload',
			() => axios.post<Word>(`${BACKEND}/upload/single`, body),
			'Couldn\'t read the image.');
	};

	// The server ignores a label for a page, so the comparison with the
	// expected Abkai is made here
	const readPage = (file: File, expected: string) => {
		const body = new FormData();
		body.append('image', file);
		request('page', 'readingPage',
			() => axios.post<Page>(`${BACKEND}/upload/multiple`, body),
			'Couldn\'t read the page.',
			(result) => { setPage({ result, expected }); });
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
				<Switch
					label="Word to read"
					options={MODES}
					value={mode}
					onChange={setMode}
				/>
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
						setError(message ? { mode: 'upload', message } : undefined);
					}}
				/>
				<UploadForm
					page
					hidden={mode !== 'page'}
					disabled={busy}
					onRead={readPage}
					onError={(message) => {
						setError(message ? { mode: 'page', message } : undefined);
					}}
				/>
				<LoadingCard
					loading={Boolean(loading) || !backendAwake}
					message={backendAwake && loading ? loading : 'wakingServer'}
				/>
				{error?.mode === mode && (
					<p className={styles.error} role="alert">{error.message}</p>
				)}
			</div>
			{mode === 'page' ? (
				page && <PageResult page={page.result} expected={page.expected} />
			) : (<>
			<section className={styles.lexigraph}>
				<h3>Lexigraph</h3>
				<figure>
					<img src={word?.image} />
					<figcaption>{caption}</figcaption>
					{word?.font && (
						<p className={styles.font}>Rendered in {word.font}</p>
					)}
				</figure>
				{word?.label && (
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
				)}
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
					<div className={styles.romanization}>
						<span>Romanization:</span>
						<Switch
							label="Romanization"
							options={ROMANIZATIONS}
							value={romanization}
							onChange={setRomanization}
						/>
					</div>
				</section>
				<div className={styles.predictionCards}>
					{results.map((result) => (
						<PredictionCard
							key={result.model}
							name={result.name}
							model={result.model}
							abkai={result['prediction-abkai']}
							manchu={result['prediction-manchu']}
							romanization={romanization}
							truth={word?.manchu}
							ctc={result.ctc}
							probs={result.probs}
							score={result.score}
							preprocessed={word?.['preprocessed-image']}
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
			</>)}
		</section>
	);
}
