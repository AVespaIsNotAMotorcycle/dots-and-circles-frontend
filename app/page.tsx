'use client'

import axios from 'axios';
import { useState, useEffect } from 'react';

import Demo from './components/Demo';
import styles from './main.module.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

export default function Home() {
	const [backendAwake, setBackendAwake] = useState(false);

	useEffect(() => {
		axios.get(`${BACKEND}/awake`)
			.then(() => { setBackendAwake(true); });
	}, []);

	return (
		<main className={styles.homepage}>
			<h1>Dots and Circles</h1>
			<Demo backendAwake={backendAwake} />
		</main>
	);
}
