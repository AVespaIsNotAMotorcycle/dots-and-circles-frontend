'use client'

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';

import LoadingCard from './LoadingCard';
import { alignWords, pageWords, wordLetters } from './pagecompare';
import { romanizeText } from './romanization';
import type { Romanization } from './romanization';
import { useRomanization } from './RomanizationContext';
import Switch from './Switch';
import styles from './testwords.module.css';
import type { ErrorResponse, Lexigraph, LexigraphPage, Source } from './types';
import useBackendAwake from './useBackendAwake';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND;
const MODEL = 'Run 30';
// Words asked for at a time. Each worker reads a word the first time it's
// asked for, so a smaller page shows the first words sooner.
const PER_PAGE = 50;

const SOURCES: [Source, string][] = [
	['photo', 'Real photos'],
	['synthetic', 'Synthetic renders'],
];
const ABOUT: Record<Source, string> = {
	photo: 'Photographed words from printed books, none of which the model trained on.',
	synthetic: 'Words rendered in a random font and made to look like print, from the test split of the lexicon, so the model never saw them in training.',
};

// The words of a source loaded so far, out of total (undefined until the
// first page arrives), and why loading stopped, if it failed
type WordSet = { words: Lexigraph[]; total?: number; error?: string };

const percent = (value: number) => value
	.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 });

// A test word's label and the model's reading of it, in a romanization:
// Norman as the server sends it, or (from a server from before it did)
// romanized here from the Manchu, which comes out the same
const wordIn = (word: Lexigraph, romanization: Romanization) => (romanization === 'abkai'
	? { label: word.label, reading: word['prediction-abkai'] }
	: {
		label: word['label-norman'] ?? romanizeText(word.manchu, 'norman'),
		reading: word['prediction-norman'] ?? romanizeText(word['prediction-manchu'], 'norman'),
	});

// One word: its image, its label, and the model's reading lined up with it,
// in the romanization chosen for the site
function WordCard({ word }: { word: Lexigraph }) {
	const [romanization] = useRomanization();
	const { label, reading } = wordIn(word, romanization);
	const right = word.score === 1;
	const aligned = alignWords(pageWords(reading), pageWords(label));

	return (
		<li className={styles.card}>
			<img src={word.image} alt={`The word ${label}`} />
			<div className={styles.text}>
				<span className={styles.caption}>Word</span>
				<span className={styles.label}>{label}</span>
				<span className={styles.caption}>Read as</span>
				<span className={styles.reading} aria-label={reading || 'nothing'}>
					{aligned.map((part, key) => (
						<span key={key}>
							{wordLetters(part).map(({ letter, status }, index) => (
								<span key={index} className={styles[status]}>{letter}</span>
							))}
						</span>
					))}
				</span>
				<span
					className={`${styles.score} ${right ? styles.right : styles.miss}`}
					title="Share of letters right"
				>
					{right ? '✓' : percent(word.score)}
				</span>
				{word.font && (
					<span className={styles.font}>{word.font.replaceAll('_', ' ')}</span>
				)}
			</div>
		</li>
	);
}

// Every test word of a source, real or synthetic, each with the model's
// reading. Pages of GET /lexigraphs load one after another until all are in.
export default function TestWords() {
	const awake = useBackendAwake();
	const [source, setSource] = useState<Source>('photo');
	const [sets, setSets] = useState<Partial<Record<Source, WordSet>>>({});
	// sets as last written, for the loading loop to read
	const latest = useRef(sets);

	const update = (from: Source, change: (set: WordSet) => WordSet) => {
		const next = {
			...latest.current,
			[from]: change(latest.current[from] ?? { words: [] }),
		};
		latest.current = next;
		setSets(next);
	};

	// Loads the rest of source's words. Switching away stops after the page
	// in flight, and switching back picks up where it left off.
	useEffect(() => {
		if (!awake) return;
		let stopped = false;
		(async () => {
			while (!stopped) {
				const known = latest.current[source];
				const loaded = known?.words.length ?? 0;
				if (known?.total !== undefined && loaded >= known.total) return;
				let data: LexigraphPage;
				try {
					({ data } = await axios.get<LexigraphPage>(`${BACKEND}/lexigraphs`, {
						params: {
							source,
							model: MODEL,
							page: Math.floor(loaded / PER_PAGE) + 1,
							per_page: PER_PAGE,
						},
					}));
				} catch (error) {
					update(source, (set) => ({
						...set,
						error: (axios.isAxiosError<ErrorResponse>(error)
							&& error.response?.data?.error) || 'Couldn\'t load the words.',
					}));
					return;
				}
				// A page another loop already added is left out
				update(source, (set) => ({
					words: data.words[0]?.index === set.words.length
						? [...set.words, ...data.words] : set.words,
					total: data.total,
				}));
				if (data.words.length === 0) return;
			}
		})();
		return () => { stopped = true; };
	}, [awake, source]);

	const set = sets[source] ?? { words: [] };
	const { words, total, error } = set;
	const loading = !error && (total === undefined || words.length < total);
	const exact = words.filter(({ score }) => score === 1).length;
	const mean = words.reduce((sum, { score }) => sum + score, 0)
		/ (words.length || 1);

	return (
		<section className={styles.testWords}>
			<div className={styles.controls}>
				<Switch
					label="Which test words"
					options={SOURCES}
					value={source}
					onChange={setSource}
				/>
				<p>{ABOUT[source]}</p>
			</div>
			{words.length > 0 && (
				<p className={styles.summary}>
					{`${MODEL} read ${exact} of ${words.length} exactly right, with ${percent(mean)} of letters right on average`}
					{loading && total !== undefined && ` (${words.length} of ${total} loaded so far)`}
					{'. '}
					<span className={styles.legend}>
						In each reading, red letters are wrong, letters with a wavy
						line are extra, and faint letters are missing.
					</span>
				</p>
			)}
			<LoadingCard
				loading={loading}
				message={awake ? 'loadingWords' : 'wakingServer'}
			/>
			{error && <p className={styles.error} role="alert">{error}</p>}
			<ul className={styles.grid}>
				{words.map((word) => <WordCard key={word.index} word={word} />)}
			</ul>
		</section>
	);
}
