'use client'

import Demo from './components/Demo';
import useBackendAwake from './components/useBackendAwake';
import styles from './main.module.css';
import StructuredData from './StructuredData';

export default function Home() {
	const backendAwake = useBackendAwake();

	return (
		<main className={styles.homepage}>
			<StructuredData />
			<h1>Dots and Circles</h1>
			<p className={styles.intro}>
				{'Dots and Circles is a personal project by '}
				<a href="https://sasha-m-ebersole.com/">Sasha Madden Ebersole</a>
				{' for automatically transcribing scans of Manchu documents. '}
				Upload a photo of a page,
				or a whole PDF, and it finds each word, reads it with a transformer-based
				model, and gives you the page&apos;s text in Manchu script and in Abkai or
				Norman/Möllendorff romanization. Words it may have misread are flagged
				with the closest entries in Norman&apos;s dictionary and Wiktionary, so
				you can correct them before saving the text.
			</p>
			<aside className={styles.limitations} aria-labelledby="limitations-title">
				<h2 id="limitations-title">Known limitations</h2>
				<ul>
					<li>It&apos;s made for printed Manchu, and struggles with other styles, such as manuscripts.</li>
					<li>It struggles with words set close together.</li>
					<li>
						It sometimes takes decorations or other text (such as Chinese) for
						Manchu, or Manchu for other text.
					</li>
					<li>
						It may flag words that are right as possible misreadings: its
						dictionaries are fairly small, and don&apos;t know every suffix.
					</li>
				</ul>
			</aside>
			<Demo backendAwake={backendAwake} />
		</main>
	);
}
