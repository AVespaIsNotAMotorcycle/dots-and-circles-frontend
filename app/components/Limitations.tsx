'use client'

import { useEffect, useState } from 'react';
import styles from './limitations.module.css';

// 'open' or 'closed', as the visitor last left the card
const KEY = 'limitationsOpen';

// What the reader can't do well: open until the visitor closes it, and
// kept as they left it on later visits
export default function Limitations() {
	const [open, setOpen] = useState(true);

	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- read once kept storage is available
			if (localStorage.getItem(KEY) === 'closed') setOpen(false);
		} catch {
			// Nothing kept, so open
		}
	}, []);

	const toggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
		const next = event.currentTarget.open;
		// Also fires when the kept state is applied, so only save real changes
		if (next === open) return;
		setOpen(next);
		try {
			localStorage.setItem(KEY, next ? 'open' : 'closed');
		} catch {
			// Not kept, but used while the page is open
		}
	};

	return (
		<details className={styles.limitations} open={open} onToggle={toggle}>
			<summary>
				<h2>Known limitations</h2>
			</summary>
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
		</details>
	);
}
