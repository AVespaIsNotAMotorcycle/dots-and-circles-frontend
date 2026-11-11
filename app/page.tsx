'use client'

import Demo from './components/Demo';
import useBackendAwake from './components/useBackendAwake';
import styles from './main.module.css';

export default function Home() {
	const backendAwake = useBackendAwake();

	return (
		<main className={styles.homepage}>
			<h1>Dots and Circles</h1>
			<Demo backendAwake={backendAwake} />
		</main>
	);
}
