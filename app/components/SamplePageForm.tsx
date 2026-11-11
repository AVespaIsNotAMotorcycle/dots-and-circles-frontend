'use client'

import { useState } from 'react';

import styles from './wordforms.module.css';

// Picks one of the sample pages by name, or any one ('') at random, and asks
// for it with onLoad(name)
export default function SamplePageForm({
	hidden = false,
	disabled = false,
	names = [],
	onLoad = () => {},
}: {
	hidden?: boolean;
	disabled?: boolean;
	// The pages GET /pages lists
	names?: string[];
	onLoad?: (name: string) => void;
}) {
	const [name, setName] = useState('');

	return (
		<div className={styles.options} hidden={hidden}>
			<label>
				Page
				<select
					value={name}
					onChange={(event) => { setName(event.target.value); }}
				>
					<option value="">Any page, at random</option>
					{names.map((page) => (
						<option key={page} value={page}>{page}</option>
					))}
				</select>
			</label>
			<button
				type="button"
				disabled={disabled}
				onClick={() => { onLoad(name); }}
			>
				{name ? 'Load Page' : 'Load Random Page'}
			</button>
		</div>
	);
}
