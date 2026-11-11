'use client'

import { useState } from 'react';

import styles from './wordforms.module.css';

// A small option to load one of the sample pages by name, or any one ('')
// at random, instead of uploading: asks for it with onLoad(name)
export default function SamplePageForm({
	disabled = false,
	names = [],
	onLoad = () => {},
}: {
	disabled?: boolean;
	// The pages GET /pages lists
	names?: string[];
	onLoad?: (name: string) => void;
}) {
	const [name, setName] = useState('');

	return (
		<div className={styles.sample}>
			<label>
				<span>No page to hand? Try a sample:</span>
				<select
					value={name}
					aria-label="Sample page"
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
				{name ? 'Load sample' : 'Load a random sample'}
			</button>
		</div>
	);
}
