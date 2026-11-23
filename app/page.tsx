'use client'

import Demo from './components/Demo';
import Limitations from './components/Limitations';
import useBackendAwake from './components/useBackendAwake';
import styles from './main.module.css';
import StructuredData from './StructuredData';
import Updates from './components/Updates';

export default function Home() {
	const backendAwake = useBackendAwake();

	return (
		<main className={styles.homepage}>
			<StructuredData />
			<Updates />
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
			<Limitations />
			<Demo backendAwake={backendAwake} />
		</main>
	);
}
