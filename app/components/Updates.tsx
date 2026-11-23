'use client'

import axios from 'axios';
import { useEffect, useState } from 'react';
import styles from './updates.module.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND;
// The date (YYYY-MM-DD) of the newest update the visitor dismissed
const KEY = 'updatesSeen';

type Update = { date: string; summary: string[] };

function seen() {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

const formatDate = (date: string) => new Date(`${date}T00:00:00`)
	.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

// What's changed since the visitor last dismissed this card; a first visit
// shows every update. Nothing is shown until GET /updates answers.
export default function Updates() {
	const [updates, setUpdates] = useState<Update[]>([]);

	useEffect(() => {
		const since = seen();
		axios.get<{ updates: Update[] }>(`${BACKEND}/updates`, {
			params: since ? { since } : {},
		})
			.then(({ data }) => { setUpdates(data.updates); })
			.catch(() => {
				// No card, rather than an error about a card
			});
	}, []);

	if (!updates.length) return null;

	const dismiss = () => {
		try {
			// Newest first, so the first is the newest seen
			localStorage.setItem(KEY, updates[0].date);
		} catch {
			// Not kept, so shown again next visit
		}
		setUpdates([]);
	};

	return (
		<aside className={styles.updates} aria-labelledby="updates-title">
			<div className={styles.heading}>
				<h2 id="updates-title">What&apos;s new</h2>
				<button type="button" className={styles.dismiss} onClick={dismiss}
					aria-label="Dismiss what's new">
					&times;
				</button>
			</div>
			{updates.map(({ date, summary }) => (
				<section key={date} className={styles.update}>
					<h3><time dateTime={date}>{formatDate(date)}</time></h3>
					{summary.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
				</section>
			))}
		</aside>
	);
}
