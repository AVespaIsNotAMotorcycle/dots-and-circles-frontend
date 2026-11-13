'use client'

import Demo from './components/Demo';
import useBackendAwake from './components/useBackendAwake';
import styles from './main.module.css';

export default function Home() {
	const backendAwake = useBackendAwake();

	return (
		<main className={styles.homepage}>
			<h1>Dots and Circles</h1>
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
